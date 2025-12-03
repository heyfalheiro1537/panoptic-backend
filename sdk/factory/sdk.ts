import { createProviderLogger, BillingLogger } from '../types/logger';
import { BillingEvent } from '../types/billingEvent';
import { Providers, ProvidersType } from '../types/providers';
import { SDKConfig } from '../types/options';
import { getExecutionMetadata, ExecutionMetadata, setExecutionMetadata, withExecutionMetadata } from '../context/executionContext';
import { HttpRequest } from '../types/httpRequest';


// ─────────────────────────────────────────────────────────────
// Wrap Options (required for every wrap call)
// ─────────────────────────────────────────────────────────────

export interface CaptureContextOptions {
    /**
     * Whether to merge AsyncLocalStorage execution metadata into the event.
     * Defaults to true when not specified.
     */
    includeExecutionMetadata?: boolean;
}

export interface WrapOptions {
    provider: Providers;
    service?: string;
    resource?: string;
    /**
     * Optional request identifier for correlation.
     * For HTTP calls this might come from a header such as X-Request-Id.
     */
    requestId?: string;
    /**
     * Arbitrary tags that will be attached to the event metadata.
     */
    tags?: string[];
    /**
     * Optional extra static attribution/metadata fields that should be merged
     * into BillingEvent.metadata. This is a convenient escape hatch
     * for callers who want to attach tenant/user/feature information
     * without relying on AsyncLocalStorage helpers.
     */
    attributes?: Record<string, string | number | boolean>;

    /**
     * Optional explicit context to merge into BillingEvent.metadata.
     * Dynamically merged with AsyncLocalStorage context.
     * If provided as a function, it will be lazily evaluated when the
     * billing event is built. This has higher precedence than context
     * coming from AsyncLocalStorage.
     */
    context?: ExecutionMetadata | (() => ExecutionMetadata);

    /**
     * Fine-grained control over how context is captured/merged.
     */
    captureContext?: CaptureContextOptions;
}

// ─────────────────────────────────────────────────────────────
// SDK Factory
// ─────────────────────────────────────────────────────────────

export function createPanoptic(config: SDKConfig = {}) {
    const { project, env = process.env.NODE_ENV || 'development' } = config;

    // Internal logger cache (one logger per provider+service combo)
    const loggerCache = new Map<string, BillingLogger>();

    
    function getOrCreateLogger(provider: Providers, service?: string): BillingLogger {
        const cacheKey = `${provider}:${service || 'default'}`;

        if (!loggerCache.has(cacheKey)) {
            loggerCache.set(cacheKey, createProviderLogger({
                provider,
                projectId: project,
                env,
                service,
            }));
        }

        return loggerCache.get(cacheKey)!;
    }

    /**
     * Determine provider category
     */
    function getCategory(provider: Providers): ProvidersType {
        if (provider === Providers.OPENAI) {
            return ProvidersType.AI;
        }
        return ProvidersType.INFRA;
    }

    /**
     * Build a billing event
     */
    function buildBillingEvent(
        options: WrapOptions,
        resource: string,
        duration: number
    ): BillingEvent {
        // Resolve explicit context, if provided
        const explicitContext: ExecutionMetadata | undefined =
            typeof options.context === 'function'
                ? options.context()
                : options.context;

        const shouldIncludeExecutionMeta =
            options.captureContext?.includeExecutionMetadata !== false;

        const executionMeta: ExecutionMetadata =
            (shouldIncludeExecutionMeta ? getExecutionMetadata() : undefined) || {};

        const baseMeta = {
            function_name: resource,
            duration_ms: duration,
            request_id: options.requestId,
            tags: options.tags,
        };

        // Precedence: execution metadata (from AsyncLocalStorage),
        // then per-call attributes, and finally base fields to ensure
        // core keys like function_name/duration_ms are always present.
        const mergedMetadata = {
            ...executionMeta,
            ...(explicitContext || {}),
            ...(options.attributes || {}),
            ...baseMeta,
        };

        return {
            ts: new Date().toISOString(),
            projectId: project,
            env,
            category: getCategory(options.provider),
            provider: options.provider,
            service: options.service,
            resource,
            // placeholder for manual billing events
            // quantity: 1,
            // unit: 'execution',
            // amount: 0,
            // currency: 'USD',
            metadata: mergedMetadata,
        };
    }

    /**
     * Default way of extracting execution metadata from a generic HTTP request.
     * All fields are optional and only populated when present on the request.
     */
    function defaultHttpMetadataExtractor(req: HttpRequest): ExecutionMetadata {
        const meta: ExecutionMetadata = {};

        const requestId = req.headers['x-request-id'];
        if (requestId) {
            meta.request_id = requestId;
        }

        const tenantId = req.headers['x-tenant-id'] || req.user?.organizationId;
        if (tenantId) {
            meta.tenant_id = tenantId;
        }

        const userId = req.user?.id;
        if (userId) {
            meta.user_id = userId;
        }

        if (req.method && req.path) {
            meta.endpoint = `${req.method} ${req.path}`;
        }

        if (req.method) {
            meta.http_method = req.method;
        }

        if (req.ip) {
            meta.region = req.ip;
        }

        return meta;
    }

    // ─────────────────────────────────────────────────────────
    // Public API
    // ─────────────────────────────────────────────────────────

    return {
        
        /**
         * Wrap a synchronous function for billing tracking
         *
         * @example
         * const tracked = sdk.wrap(calculatePrice, {
         *     provider: Providers.USER_DEFINED,
         *     service: 'PricingService',
         * });
         * tracked(100, 5); // Logs billing event automatically
         */
        wrap<T extends (...args: any[]) => any>(fn: T, options: WrapOptions): T {
            const logger = getOrCreateLogger(options.provider, options.service);
            const resource = options.resource || fn.name || 'anonymous';

            return function (this: any, ...args: Parameters<T>): ReturnType<T> {
                const start = Date.now();
                
                // Capture execution metadata at invocation time
                const invocationMeta = getExecutionMetadata();

                logger.billing({
                    msg: 'Execution started',
                    resource,
                    ...invocationMeta,
                });

                try {
                    const result = fn.apply(this, args);
                    const duration = Date.now() - start;
                    const event = buildBillingEvent(options, resource, duration);
                    
                    logger.invoice({
                        ...event,
                        msg: 'Execution completed',
                    });
                    
                    return result;
                } catch (error) {
                    const duration = Date.now() - start;
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    const errorStack = error instanceof Error ? error.stack : undefined;

                    const event = buildBillingEvent(options, resource, duration);

                    logger.error({
                        ...event,
                        msg: 'Execution failed',
                        error: errorMessage,
                        error_stack: errorStack,
                        error_type: error instanceof Error ? error.constructor.name : typeof error,
                    });

                    throw error;
                }
            } as T;
        },

        /**
         * Wrap an async function for billing tracking with execution context isolation
         *
         * @example
         * const tracked = sdk.wrapAsync(fetchData, {
         *     provider: Providers.AWS,
         *     service: 'DynamoDB',
         *     resource: 'getUser',
         * });
         * await tracked('user-123'); // Logs billing event automatically
         */
        wrapAsync<T extends (...args: any[]) => Promise<any>>(fn: T, options: WrapOptions): T {
            const logger = getOrCreateLogger(options.provider, options.service);
            const resource = options.resource || fn.name || 'anonymous';

            return async function (this: any, ...args: Parameters<T>): Promise<Awaited<ReturnType<T>>> {
                const timestamps = {
                    start: Date.now(),
                    executionStart: 0,
                    executionEnd: 0,
                    end: 0,
                };
                
                // Capture execution metadata at invocation time
                const invocationMeta = getExecutionMetadata();

                // Log execution start with context
                logger.billing({
                    msg: 'Async execution started',
                    resource,
                    ...invocationMeta,
                });

                try {
                    // Execute within its own context if context options provided
                    let result: Awaited<ReturnType<T>>;
                    
                    if (options.context || options.attributes) {
                        // Merge any per-call context
                        const callContext = {
                            ...(invocationMeta || {}),
                            ...(options.attributes || {}),
                            ...(typeof options.context === 'function' ? options.context() : options.context || {}),
                        };
                        
                        // Execute with merged context
                        timestamps.executionStart = Date.now();
                        result = await withExecutionMetadata(callContext, async () => {
                            return await fn.apply(this, args);
                        });
                        timestamps.executionEnd = Date.now();
                    } else {
                        // Execute normally, preserving existing context
                        timestamps.executionStart = Date.now();
                        result = await fn.apply(this, args);
                        timestamps.executionEnd = Date.now();
                    }
                    
                    timestamps.end = Date.now();
                    const duration = timestamps.end - timestamps.start;
                    const executionTime = timestamps.executionEnd - timestamps.executionStart;
                    const overhead = duration - executionTime;
                    
                    const event = buildBillingEvent(options, resource, duration);
                    
                    // Log invoice with full context and timing
                    logger.invoice({
                        ...event,
                        msg: 'Async execution completed',
                        timing: {
                            total_ms: duration,
                            execution_ms: executionTime,
                            overhead_ms: overhead,
                        },
                    });

                    return result;
                    
                } catch (error) {
                    timestamps.end = Date.now();
                    const duration = timestamps.end - timestamps.start;
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    const errorStack = error instanceof Error ? error.stack : undefined;

                    // Build event even for errors to track cost/usage
                    const event = buildBillingEvent(options, resource, duration);
                    
                    logger.error({
                        ...event,
                        msg: 'Async execution failed',
                        error: errorMessage,
                        error_stack: errorStack,
                        error_type: error instanceof Error ? error.constructor.name : typeof error,
                    });

                    throw error;
                }
            } as T;
        },

        /**
         * Get a logger for custom/manual billing events
         * 
         * Use this for advanced scenarios where you need to log
         * custom events outside of function wrapping.
         *
         * @example
         * const logger = sdk.getLogger(Providers.OPENAI, 'GPT-4o');
         * logger.token_usage({ promptTokens: 100, completionTokens: 50 });
         */
        getLogger(provider: Providers, service?: string): BillingLogger {
            return getOrCreateLogger(provider, service);
        },
        
        createHttpMiddleware<Req = HttpRequest>(options?: {
            mapRequest?: (req: Req) => HttpRequest;
            extractMetadata?: (req: HttpRequest) => ExecutionMetadata;
        }) {
            const mapRequest = options?.mapRequest ?? ((req: unknown) => req as HttpRequest);
            const extractMetadata = options?.extractMetadata ?? defaultHttpMetadataExtractor;
        
            return function(req: Req, next: () => void | Promise<void>) {
                const httpReq = mapRequest(req);
                const metadata = extractMetadata(httpReq);
                
                // Execute next within the metadata context
                setExecutionMetadata(metadata);
        
                const result = next();
                
                // If next returns a Promise, return it; otherwise return void
                if (result instanceof Promise) {
                    return result;
                }
            };
        }
    };
}

// ─────────────────────────────────────────────────────────────
// Type exports
// ─────────────────────────────────────────────────────────────

export type PanopticSDK = ReturnType<typeof createPanoptic>;
