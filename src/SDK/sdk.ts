import { createProviderLogger, BillingLogger } from '../types/logger';
import { BillableMeta } from '../types/meta';
import { BillableOptions } from '../types/options';
import { BillingEvent } from '../types/billingEvent';
import { Providers, ProvidersType } from '../types/providers';

export class BillableSDK {
    private apiKey?: string;
    private project?: string;
    private username: string;
    private env: string;
    private connected = false;
    private autoConnect: boolean;
    
    // Cache for provider-specific loggers
    private providerLoggers: Map<string, BillingLogger> = new Map();
    
    // SDK-level logger for internal logging
    private sdkLogger: BillingLogger;

    constructor(options: BillableOptions) {
        if (!options.username) {
            throw new Error('username is required in BillableOptions');
        }

        this.apiKey = options.apiKey;
        this.project = options.project;
        this.username = options.username;
        this.env = options.env || process.env.NODE_ENV || 'development';
        this.autoConnect = options.autoConnect ?? true;

        // Create SDK-level logger
        this.sdkLogger = createProviderLogger({
            provider: Providers.USER_DEFINED,
            username: this.username,
            projectId: this.project,
            env: this.env,
            service: 'SDK'
        });

        this.sdkLogger.info(`Billing SDK initialized for project: ${this.project || 'default'}`);
    }

    /**
     * Get or create a provider-specific logger with caching
     */
    private getProviderLogger(provider: Providers, service?: string): BillingLogger {
        const cacheKey = `${provider}-${service || 'default'}`;

        if (!this.providerLoggers.has(cacheKey)) {
            const logger = createProviderLogger({
                provider,
                username: this.username,
                projectId: this.project,
                env: this.env,
                service,
            });

            this.providerLoggers.set(cacheKey, logger);
        }

        return this.providerLoggers.get(cacheKey)!;
    }

    /**
     * Create a dedicated logger for a specific provider/service combination
     * Useful when wrapping multiple functions that should share the same logger
     * 
     * @example
     * const gcpLogger = sdk.createLogger(Providers.GOOGLE, 'BigQuery');
     * const wrapped1 = sdk.wrap(runQuery1, { logger: gcpLogger });
     * const wrapped2 = sdk.wrap(runQuery2, { logger: gcpLogger });
     */
    createLogger(provider: Providers, service?: string): BillingLogger {
        return createProviderLogger({
            provider,
            username: this.username,
            projectId: this.project,
            env: this.env,
            service,
        });
    }

    connect() {
        this.connected = true;
        this.sdkLogger.info('Connected to billing service');
    }

    disconnect() {
        this.connected = false;
        this.sdkLogger.info('Disconnected from billing service');
    }

    /**
     * Wrap a function to automatically track billing/cost information
     * 
     * Function name is automatically captured from fn.name
     * Can be overridden with meta.resource
     * Falls back to 'anonymous' if no name available
     * 
     * @example
     * // Named function - auto-captures 'calculatePrice'
     * function calculatePrice(items: number, price: number) { return items * price; }
     * const wrapped = sdk.wrap(calculatePrice, { provider: Providers.USER_DEFINED });
     * 
     * // Override with custom resource name
     * const wrapped = sdk.wrap(calculatePrice, { resource: 'custom-pricing' });
     */
    wrap<T extends (...args: any[]) => any>(
        fn: T,
        meta?: BillableMeta
    ): T {
        const self = this;

        return function (this: any, ...args: Parameters<T>): ReturnType<T> {
            // 1. Auto-extract function name (PRIORITY: meta.resource → fn.name → 'anonymous')
            const functionName = meta?.resource || fn.name || 'anonymous';

            // 2. Get or create provider-specific logger
            const provider = (meta?.provider as Providers) || Providers.USER_DEFINED;
            const logger = meta?.logger || self.getProviderLogger(provider, meta?.service);

            // 3. Start timing
            const start = Date.now();

            // 4. Log execution start
            logger.billing({
                msg: 'Execution started',
                resource: functionName,
            });

            try {
                // 5. Execute original function
                const result = fn.apply(this, args);
                const duration = Date.now() - start;

                // 6. Determine category from provider
                let category: ProvidersType;
                if (provider === Providers.OPENAI) {
                    category = ProvidersType.AI;
                } else {
                    category = ProvidersType.INFRA;
                }

                // 7. Construct COMPLETE BillingEvent
                const event: BillingEvent = {
                    ts: new Date().toISOString(),
                    projectId: self.project,
                    env: self.env,
                    category,
                    provider,
                    service: meta?.service,
                    resource: functionName,  // Function name stored here
                    quantity: 1,
                    unit: 'execution',
                    amount: 0, // Will be calculated by pricing calculator later
                    currency: 'USD',
                    metadata: {
                        function_name: functionName,  // ALSO in metadata
                        duration_ms: duration,
                        args_types: args.map(a => typeof a),
                        user: meta?.user,
                        requestId: meta?.requestId,
                        tags: meta?.tags,
                    }
                };

                // 8. Log complete billing event
                logger.invoice(event);

                // 9. Return original result
                return result;

            } catch (error) {
                const duration = Date.now() - start;

                // 10. Log error (but don't suppress it)
                logger.error({
                    msg: 'Execution failed',
                    resource: functionName,
                    duration_ms: duration,
                    error: error instanceof Error ? error.message : String(error)
                });

                // 11. Re-throw error (don't break caller's code)
                throw error;
            }
        } as T;
    }

    /**
     * Wrap an async function to automatically track billing/cost information
     */
    wrapAsync<T extends (...args: any[]) => Promise<any>>(
        fn: T,
        meta?: BillableMeta
    ): T {
        const self = this;

        return async function (this: any, ...args: Parameters<T>): Promise<Awaited<ReturnType<T>>> {
            // 1. Auto-extract function name
            const functionName = meta?.resource || fn.name || 'anonymous';

            // 2. Get or create provider-specific logger
            const provider = (meta?.provider as Providers) || Providers.USER_DEFINED;
            const logger = meta?.logger || self.getProviderLogger(provider, meta?.service);

            // 3. Start timing
            const start = Date.now();

            // 4. Log execution start
            logger.billing({
                msg: 'Async execution started',
                resource: functionName,
            });

            try {
                // 5. Execute original async function
                const result = await fn.apply(this, args);
                const duration = Date.now() - start;

                // 6. Determine category from provider
                let category: ProvidersType;
                if (provider === Providers.OPENAI) {
                    category = ProvidersType.AI;
                } else {
                    category = ProvidersType.INFRA;
                }

                // 7. Construct COMPLETE BillingEvent
                const event: BillingEvent = {
                    ts: new Date().toISOString(),
                    projectId: self.project,
                    env: self.env,
                    category,
                    provider,
                    service: meta?.service,
                    resource: functionName,
                    quantity: 1,
                    unit: 'execution',
                    amount: 0,
                    currency: 'USD',
                    metadata: {
                        function_name: functionName,
                        duration_ms: duration,
                        args_types: args.map(a => typeof a),
                        user: meta?.user,
                        requestId: meta?.requestId,
                        tags: meta?.tags,
                    }
                };

                // 8. Log complete billing event
                logger.invoice(event);

                // 9. Return original result
                return result;

            } catch (error) {
                const duration = Date.now() - start;

                // Log error
                logger.error({
                    msg: 'Async execution failed',
                    resource: functionName,
                    duration_ms: duration,
                    error: error instanceof Error ? error.message : String(error)
                });

                // Re-throw error
                throw error;
            }
        } as T;
    }
}
