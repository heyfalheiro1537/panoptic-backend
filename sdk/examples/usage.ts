import { createPanoptic, Providers, runWithContext } from '../index';

// ─────────────────────────────────────────────────────────────
// 1. Initialize SDK
// ─────────────────────────────────────────────────────────────

const panoptic = createPanoptic({ 
  project: 'my-saas-app',
  env: 'production' 
});

// ─────────────────────────────────────────────────────────────
// 2. HTTP Middleware - propagates tenant_id and request_id
// ─────────────────────────────────────────────────────────────

// Express example
// app.use((req, res, next) => {
//   panoptic.httpMiddleware()(req, next);
// });

// ─────────────────────────────────────────────────────────────
// 3. Database Operations - using context for rate card metrics
// ─────────────────────────────────────────────────────────────

// Firestore read example
const fetchClients = panoptic.wrapAsync(
  async function fetchClients(tenantId: string) {
    // const snapshot = await db.collection('clients')
    //   .where('tenantId', '==', tenantId)
    //   .get();
    // return snapshot;
    return { docs: [], size: 0 }; // placeholder
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

// Firestore write example
interface ClientData {
  id: string;
  name: string;
}

const saveClient = panoptic.wrapAsync(
  async function saveClient(data: ClientData) {
    // await db.collection('clients').doc(data.id).set(data);
    return { written: 1 };
  },
  {
    provider: Providers.GOOGLE,
    service: 'firestore',
    attributes: { region: 'us-central1', collection: 'clients' },
    tags: ['database', 'write'],
    context: (result) => ({
      writes: result.written,
    }),
  }
);

// ─────────────────────────────────────────────────────────────
// 4. AI Operations - tracking token usage
// ─────────────────────────────────────────────────────────────

const generateSummary = panoptic.wrapAsync(
  async function generateSummary(text: string) {
    // const response = await openai.chat.completions.create({
    //   model: 'gpt-4o',
    //   messages: [{ role: 'user', content: `Summarize: ${text}` }],
    // });
    // return response;
    return {
      model: 'gpt-4o',
      usage: { prompt_tokens: 100, completion_tokens: 50 },
      choices: [{ message: { content: 'Summary...' } }],
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
    onError: (error) => ({
      error_code: (error as any).code,
      error_status: (error as any).status,
    }),
  }
);

// ─────────────────────────────────────────────────────────────
// 5. AWS Lambda / Compute tracking
// ─────────────────────────────────────────────────────────────

async function heavyComputation(jobId: string) {
  // Simulate heavy work
  await new Promise(resolve => setTimeout(resolve, 100));
}

const processJob = panoptic.wrapAsync(
  async function processJob(jobId: string) {
    const startMem = process.memoryUsage().heapUsed;
    const startCpu = process.cpuUsage();
    
    await heavyComputation(jobId);
    
    const endCpu = process.cpuUsage(startCpu);
    const memUsed = process.memoryUsage().heapUsed - startMem;
    
    return {
      cpu_us: endCpu.user + endCpu.system,
      memory_bytes: memUsed,
    };
  },
  {
    provider: Providers.AWS,
    service: 'lambda',
    attributes: { function: 'processJob', memory: '1024MB' },
    tags: ['compute', 'batch'],
    context: (result) => ({
      cpu_seconds: result.cpu_us / 1_000_000,
      memory_gb_seconds: (result.memory_bytes / 1_073_741_824) * 0.1,
      invocations: 1,
    }),
  }
);

// ─────────────────────────────────────────────────────────────
// 6. Using in route handlers
// ─────────────────────────────────────────────────────────────

// app.get('/api/clients', async (req, res) => {
//   // tenant_id and request_id automatically available from middleware
//   const clients = await fetchClients(req.params.tenantId);
//   res.json(clients.docs.map(d => d.data()));
// });

// app.post('/api/summarize', async (req, res) => {
//   const summary = await generateSummary(req.body.text);
//   res.json({ summary: summary.choices[0].message.content });
// });

// ─────────────────────────────────────────────────────────────
// 7. Manual context propagation (for queues, cron jobs, etc.)
// ─────────────────────────────────────────────────────────────

interface QueueMessage {
  tenantId: string;
  correlationId: string;
  jobId: string;
}

async function handleQueueMessage(message: QueueMessage) {
  // Manually set context for non-HTTP flows
  await runWithContext(
    { 
      tenant_id: message.tenantId, 
      request_id: message.correlationId 
    },
    async () => {
      await processJob(message.jobId);
    }
  );
}

// ─────────────────────────────────────────────────────────────
// 8. Custom logging with getLogger
// ─────────────────────────────────────────────────────────────

const storageLogger = panoptic.getLogger(Providers.AWS, 's3');

async function uploadFile(bucket: string, key: string, data: Buffer) {
  // await s3.putObject({ Bucket: bucket, Key: key, Body: data });
  
  // Manual cost event for operations not easily wrapped
  storageLogger.invoice({
    timestamp: new Date().toISOString(),
    name: 'uploadFile',
    provider: Providers.AWS,
    service: 's3',
    duration_ms: 0,
    status: 'success',
    attributes: { bucket, key },
    context: { bytes: data.length },
  });
}

// ─────────────────────────────────────────────────────────────
// Example: What gets logged (CostEvent structure)
// ─────────────────────────────────────────────────────────────

/*
{
  "timestamp": "2025-12-07T15:30:00.000Z",
  "name": "fetchClients",
  "provider": "Google Cloud (GCP)",
  "service": "firestore",
  "duration_ms": 142,
  "status": "success",
  "tenant_id": "tenant-123",
  "request_id": "req-abc-456",
  "attributes": { "region": "us-central1", "collection": "clients" },
  "tags": ["database", "read"],
  "context": { "reads": 47, "bytes_scanned": 12480 }
}
*/

// ─────────────────────────────────────────────────────────────
// Demo execution
// ─────────────────────────────────────────────────────────────

async function demo() {
  // Simulate a request with context
  await runWithContext(
    { tenant_id: 'tenant-123', request_id: 'req-abc-456' },
    async () => {
      console.log('Fetching clients...');
      const clients = await fetchClients('tenant-123');
      console.log('Clients:', clients);

      console.log('\nGenerating summary...');
      const summary = await generateSummary('This is a long text to summarize...');
      console.log('Summary:', summary.choices[0].message.content);

      console.log('\nProcessing job...');
      const job = await processJob('job-789');
      console.log('Job result:', job);
    }
  );
}

// Uncomment to run demo
// demo().catch(console.error);

export { 
  fetchClients, 
  saveClient, 
  generateSummary, 
  processJob, 
  handleQueueMessage,
  uploadFile,
  demo,
};

