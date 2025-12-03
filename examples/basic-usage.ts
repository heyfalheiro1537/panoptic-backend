
import fastify, {
    FastifyInstance,
    FastifyReply,
    FastifyRequest,
  } from 'fastify';
  import { createPanoptic } from '../sdk/factory/sdk';
  import { Providers } from '../sdk/types/providers';
  import type { HttpRequest } from '../sdk/types/httpRequest';
import { getExecutionMetadata } from '../sdk/context/executionContext';
  
  // Create the Panoptic instance
  const panoptic = createPanoptic({
    project: 'demo-project',
  });
  const httpLogger = panoptic.getLogger(Providers.HTTP_ROUTES);
  
  // Example wrapped handler to show billing in action
  const listItems = panoptic.wrapAsync(
    async () => {
      // Mock data
      return [{ id: 1, name: 'Item 1' }];
    },
    {
      provider: Providers.USER_DEFINED,
      service: 'DemoService',
      resource: 'listItems',
    }
  );
  
  const app: FastifyInstance = fastify({
    logger: true,
  });
  
  /**
   * Panoptic HTTP middleware, adapted to Fastify.
   * You can customize mapRequest and extractMetadata to control billing params.
   */
  const panopticMiddleware = panoptic.createHttpMiddleware<FastifyRequest>({
    mapRequest: (req): HttpRequest => ({
      headers: req.headers as Record<string, string | undefined>,
      method: req.method,
      path: req.url,
      ip: req.ip,
      // If you attach a user somewhere (e.g. via auth), map it here:
      user: (req as any).user,
    }),
    extractMetadata: (req) => ({
      // Request identification
      request_id: req.headers['x-request-id'],
      method: req.method,
      path: req.path,
      endpoint: `${req.method} ${req.path}`,
      tenant_id: req.headers['x-tenant-id'],
      user_id: req.user?.id,
      plan: req.headers['x-plan'],
      feature: 'demo_api',
    }),
  });
  
// Attach middleware as a Fastify hook (runs for all routes)
app.addHook('onRequest', async (request, reply) => {
    await new Promise<void>((resolve) => {
      panopticMiddleware(request, resolve);
    });
  });

  // ─────────────────────────────────────────
  // Routes: GET, POST, PATCH, DELETE
  // ─────────────────────────────────────────
  
  app.get(
    '/items',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const items = await listItems();
      return reply.send({
        method: 'GET',
        items,
      });
    }
  );
  
  app.post(
    '/items',
    async (request: FastifyRequest, reply: FastifyReply) => {
      // Mock create
      const body = request.body ?? {};
      return reply.code(201).send({
        method: 'POST',
        created: true,
        body,
      });
    }
  );
  
  app.patch(
    '/items/:id',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const body = request.body ?? {};
      return reply.send({
        method: 'PATCH',
        id,
        updated: true,
        body,
      });
    }
  );
  
  app.delete(
    '/items/:id',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      return reply.send({
        method: 'DELETE',
        id,
        deleted: true,
      });
    }
  );
  
  // ─────────────────────────────────────────
  // Server bootstrap
  // ─────────────────────────────────────────
  
  async function start() {
    try {
      await app.listen({ port: 3000, host: '0.0.0.0' });
      console.log('Fastify server listening on http://localhost:3000');
    } catch (err) {
      app.log.error(err);
      process.exit(1);
    }
  }
  
  void start();