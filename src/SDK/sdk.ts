import { createProviderLogger, BillingLogger } from '../types/logger';
import { BillingEvent } from '../types/billingEvent';
import { Providers, ProvidersType } from '../types/providers';
import { SDKConfig } from '../types/options';
import { getExecutionMetadata } from '../context/executionContext';


// ─────────────────────────────────────────────────────────────
// Wrap Options (required for every wrap call)
// ─────────────────────────────────────────────────────────────

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
     * Optional extra attribution/metadata fields that should be merged
     * into BillingEvent.metadata. This is a convenient escape hatch
     * for callers who want to attach tenant/user/feature information
     * without relying on AsyncLocalStorage helpers.
     */
    attributes?: Record<string, string | number | boolean>;
}

// ─────────────────────────────────────────────────────────────
// SDK Factory
// ─────────────────────────────────────────────────────────────

export function createSDK(config: SDKConfig = {}) {
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
        const executionMeta = getExecutionMetadata() || {};

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

            return function (this: any, ...args: Parameters<T>): ReturnType<T> {
                const resource = options.resource || fn.name || 'anonymous';
                const start = Date.now();
                console.log('Executing function', resource);
                console.log(logger)
                try {
                    logger.billing({
                        msg: 'Execution started',
                        resource,
                    });
                } catch (error) {
                    console.error('Error logging execution started', error);
                }

                try {
                    const result = fn.apply(this, args);
                    const duration = Date.now() - start;
                    const event = buildBillingEvent(options, resource, duration);
                    logger.invoice(event);
                    console.log('Billing event:', event);
                    return result;
                } catch (error) {
                    const duration = Date.now() - start;

                    logger.error({
                        msg: 'Execution failed',
                        resource,
                        duration_ms: duration,
                        error: error instanceof Error ? error.message : String(error),
                    });

                    throw error;
                }
            } as T;
        },

        /**
         * Wrap an async function for billing tracking
         *
         * @example
         * const tracked = sdk.wrapAsync(fetchData, {
         *     provider: Providers.AWS,
         *     service: 'DynamoDB',
         * });
         * await tracked('user-123'); // Logs billing event automatically
         */
        wrapAsync<T extends (...args: any[]) => Promise<any>>(fn: T, options: WrapOptions): T {
            const logger = getOrCreateLogger(options.provider, options.service);

            return async function (this: any, ...args: Parameters<T>): Promise<Awaited<ReturnType<T>>> {
                const resource = options.resource || fn.name || 'anonymous';
                const start = Date.now();

                logger.billing({
                    msg: 'Async execution started',
                    resource,
                });

                try {
                    const result = await fn.apply(this, args);
                    const duration = Date.now() - start;

                    logger.invoice(buildBillingEvent(options, resource, duration));

                    return result;
                } catch (error) {
                    const duration = Date.now() - start;

                    logger.error({
                        msg: 'Async execution failed',
                        resource,
                        duration_ms: duration,
                        error: error instanceof Error ? error.message : String(error),
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
    };
}

// ─────────────────────────────────────────────────────────────
// Type exports
// ─────────────────────────────────────────────────────────────

export type PanopticSDK = ReturnType<typeof createSDK>;
