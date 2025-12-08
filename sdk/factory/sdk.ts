import { createProviderLogger, BillingLogger } from '../types/logger';
import { Providers } from '../types/providers';
import { SDKConfig, WrapAsyncOptions } from '../types/options';
import { CostEvent } from '../types/costEvent';
import { getExecutionContext, runWithContext } from '../context/executionContext';
import { HttpRequest } from '../types/httpRequest';

export function createPanoptic(config: SDKConfig = {}) {
  const { project, env = process.env.NODE_ENV || 'development' } = config;

  const loggerCache = new Map<string, BillingLogger>();

  function getOrCreateLogger(provider: Providers, service: string): BillingLogger {
    const cacheKey = `${provider}:${service}`;
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

  return {
    /**
     * Wrap an async function for cost tracking.
     * 
     * @example
     * const fetchClients = panoptic.wrapAsync(
     *   async () => {
     *     return await db.collection('clients').get();
     *   },
     *   {
     *     provider: Providers.GOOGLE,
     *     service: 'firestore',
     *     context: (result) => ({ reads: result.docs.length }),
     *   }
     * );
     */
    wrapAsync<T extends (...args: any[]) => Promise<any>>(
      fn: T,
      options: WrapAsyncOptions<Awaited<ReturnType<T>>>
    ): T {
      const logger = getOrCreateLogger(options.provider, options.service);
      const name = fn.name || 'anonymous';

      return async function(this: any, ...args: Parameters<T>): Promise<Awaited<ReturnType<T>>> {
        const start = Date.now();
        const propagated = getExecutionContext();

        try {
          const result = await fn.apply(this, args);
          const duration = Date.now() - start;

          const event: CostEvent = {
            timestamp: new Date().toISOString(),
            name,
            provider: options.provider,
            service: options.service,
            duration_ms: duration,
            status: 'success',
            tenant_id: propagated?.tenant_id,
            request_id: propagated?.request_id,
            attributes: options.attributes,
            tags: options.tags,
            context: options.context?.(result),
          };

          logger.invoice(event);
          return result;

        } catch (error) {
          const duration = Date.now() - start;
          const err = error instanceof Error ? error : new Error(String(error));

          const event: CostEvent = {
            timestamp: new Date().toISOString(),
            name,
            provider: options.provider,
            service: options.service,
            duration_ms: duration,
            status: 'error',
            tenant_id: propagated?.tenant_id,
            request_id: propagated?.request_id,
            attributes: options.attributes,
            tags: options.tags,
            context: options.onError?.(err) as any,
            error: {
              message: err.message,
              type: err.constructor.name,
            },
          };

          logger.invoice(event);
          throw error;
        }
      } as T;
    },

    /**
     * Creates HTTP middleware to propagate tenant_id and request_id.
     * 
     * @example
     * app.use((req, res, next) => {
     *   panoptic.httpMiddleware()(req, next);
     * });
     */
    httpMiddleware() {
      return function<T>(req: HttpRequest, next: () => T): T {
        return runWithContext(
          {
            tenant_id: req.headers['x-tenant-id'],
            request_id: req.headers['x-request-id'],
          },
          next
        );
      };
    },

    /**
     * Gets logger for custom events.
     */
    getLogger(provider: Providers, service: string): BillingLogger {
      return getOrCreateLogger(provider, service);
    },
  };
}

export type PanopticSDK = ReturnType<typeof createPanoptic>;
