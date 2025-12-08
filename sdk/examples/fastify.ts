import Fastify from 'fastify';
import { createPanoptic, Providers, runWithContext } from '../index';

// ─────────────────────────────────────────────────────────────
// Initialize SDK
// ─────────────────────────────────────────────────────────────

const panoptic = createPanoptic({ 
  project: 'fastify-test',
  env: 'development' 
});

// ─────────────────────────────────────────────────────────────
// Create Fastify app
// ─────────────────────────────────────────────────────────────

const app = Fastify({ logger: true });

// ─────────────────────────────────────────────────────────────
// Register Panoptic middleware
// ─────────────────────────────────────────────────────────────

app.addHook('onRequest', async (request, reply) => {
  const middleware = panoptic.createHttpMiddleware({
    mapRequest: (req) => ({
      headers: req.headers as Record<string, string | undefined>,
      method: req.method,
      path: req.url,
      ip: req.ip,
    }),
  });

  // Wrap the request handling in context
  await new Promise<void>((resolve) => {
    middleware(request, reply, () => {
      resolve();
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Example wrapped functions
// ─────────────────────────────────────────────────────────────

// Simulated database
const fakeDb = {
  clients: [
    { id: '1', name: 'Acme Corp', tenantId: 'tenant-123' },
    { id: '2', name: 'Globex', tenantId: 'tenant-123' },
    { id: '3', name: 'Initech', tenantId: 'tenant-456' },
  ],
};

const fetchClients = panoptic.wrapAsync(
  async function fetchClients(tenantId: string) {
    // Simulate database latency
    await new Promise(resolve => setTimeout(resolve, 50));
    
    const docs = fakeDb.clients.filter(c => c.tenantId === tenantId);
    return { docs, size: JSON.stringify(docs).length };
  },
  {
    provider: Providers.GOOGLE,
    service: 'firestore',
    attributes: { region: 'us-central1', collection: 'clients' },
    tags: ['database', 'read'],
    context: (result) => ({
      reads: result.docs.length,
      bytes_scanned: result.size,
    }),
  }
);

const generateSummary = panoptic.wrapAsync(
  async function generateSummary(text: string) {
    // Simulate AI API latency
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return {
      model: 'gpt-4o',
      usage: { 
        prompt_tokens: Math.floor(text.length / 4), 
        completion_tokens: 50 
      },
      choices: [{ 
        message: { 
          content: `Summary of: "${text.substring(0, 50)}..."` 
        } 
      }],
    };
  },
  {
    provider: Providers.OPENAI,
    service: 'gpt-4o',
    attributes: { feature: 'summarization' },
    tags: ['ai', 'chat'],
    context: (response) => ({
      input_tokens: response.usage?.prompt_tokens,
      output_tokens: response.usage?.completion_tokens,
      model: response.model,
    }),
  }
);

// ─────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────

app.get('/health', async () => {
  return { status: 'ok' };
});

app.get('/clients/:tenantId', async (request) => {
  const { tenantId } = request.params as { tenantId: string };
  const result = await fetchClients(tenantId);
  return { 
    clients: result.docs,
    count: result.docs.length,
  };
});

app.post('/summarize', async (request) => {
  const { text } = request.body as { text: string };
  const result = await generateSummary(text);
  return { 
    summary: result.choices[0].message.content,
    tokens: result.usage,
  };
});

// ─────────────────────────────────────────────────────────────
// Start server
// ─────────────────────────────────────────────────────────────

const start = async () => {
  try {
    await app.listen({ port: 3000, host: '0.0.0.0' });
    console.log('\n🚀 Fastify server running at http://localhost:3000\n');
    console.log('Test endpoints:');
    console.log('  GET  /health');
    console.log('  GET  /clients/:tenantId');
    console.log('  POST /summarize { "text": "..." }');
    console.log('\nExample with headers:');
    console.log('  curl -H "x-tenant-id: tenant-123" -H "x-request-id: req-001" http://localhost:3000/clients/tenant-123');
    console.log('  curl -X POST -H "Content-Type: application/json" -H "x-tenant-id: tenant-123" -d \'{"text":"Hello world"}\' http://localhost:3000/summarize\n');
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();

