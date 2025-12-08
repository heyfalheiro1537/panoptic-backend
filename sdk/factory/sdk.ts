import { createProviderLogger, BillingLogger } from '../types/logger';
import { Providers } from '../types/providers';
import { SDKConfig, WrapAsyncOptions } from '../types/options';
import { CostEvent } from '../types/costEvent';
import { getExecutionContext } from '../context/executionContext';

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

  /**
   * Default way of extracting propagated context from a generic HTTP request.
   * All fields are optional and only populated when present on the request.
   */
//   function defaultHttpContextExtractor(req: HttpRequest): PropagatedContext {
//     const ctx: PropagatedContext = {};

//     const requestId = req.headers['x-request-id'];
//     if (requestId) {
//       ctx.request_id = requestId;
//     }

//     const tenantId = req.headers['x-tenant-id'] || req.user?.organizationId;
//     if (tenantId) {
//       ctx.tenant_id = tenantId;
//     }

//     return ctx;
//   }

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
     * Creates HTTP middleware to propagate context (tenant_id, request_id).
     * 
     * @example
     * // Basic usage with Express
     * app.use(panoptic.createHttpMiddleware());
     * 
     * // Custom request mapping (e.g., Fastify)
     * app.use(panoptic.createHttpMiddleware({
     *   mapRequest: (req) => ({ headers: req.headers, user: req.user }),
     * }));
     * 
     * // Custom context extraction
     * app.use(panoptic.createHttpMiddleware({
     *   extractContext: (req) => ({
     *     tenant_id: req.headers['x-org-id'],
     *     request_id: req.headers['x-correlation-id'],
     *   }),
     * }));
     */
    // createHttpMiddleware<Req = HttpRequest>(options?: {
    //   mapRequest?: (req: Req) => HttpRequest;
    //   extractContext?: (req: HttpRequest) => PropagatedContext;
    // }) {
    //   const mapRequest = options?.mapRequest ?? ((req: unknown) => req as HttpRequest);
    //   const extractContext = options?.extractContext ?? defaultHttpContextExtractor;

    //   return function(req: Req, res: unknown, next: () => void | Promise<void>) {
    //     const httpReq = mapRequest(req);
    //     const context = extractContext(httpReq);

    //     return runWithContext(context, () => {
    //       const result = next();
    //       if (result instanceof Promise) {
    //         return result;
    //       }
    //     });
    //   };
    // },

    /**
     * Gets logger for custom events.
     */
    getLogger(provider: Providers, service: string): BillingLogger {
      return getOrCreateLogger(provider, service);
    },
  };
}

export type PanopticSDK = ReturnType<typeof createPanoptic>;
