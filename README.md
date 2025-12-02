<div align="center">
  <img src="./public/logo_panoptic.png" alt="Panoptic Logo" width="200"/>
  
  # Panoptic SDK
  
  A TypeScript SDK for tracking, billing, and monitoring cloud service usage with automatic context propagation using AsyncLocalStorage.
  
  [![npm version](https://img.shields.io/badge/npm-v0.1.0-blue)](https://www.npmjs.com/package/@panoptic/sdk)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue)](https://www.typescriptlang.org/)
  [![License](https://img.shields.io/badge/license-MIT-green)](./LICENSE)
  
</div>

## Table of Contents
- [Overview](#overview)
- [Installation](#installation)
- [Configuration](#configuration)
- [Quick Start](#quick-start)
- [Core Concepts](#core-concepts)
- [API Reference](#api-reference)
- [Advanced Usage](#advanced-usage)
- [Examples](#examples)

---

## Overview

Panoptic automatically tracks function execution and builds billing events with rich context attribution. Using Node.js AsyncLocalStorage, it propagates metadata (tenant, user, plan, etc.) through your entire request chain without manual parameter threading.

### Key Features

- ✅ **Automatic billing tracking** for wrapped functions
- ✅ **Context propagation** via AsyncLocalStorage
- ✅ **HTTP middleware** for request-level attribution
- ✅ **Detailed timing metrics** (execution time vs overhead)
- ✅ **Error tracking** with stack traces
- ✅ **Type-safe** with full TypeScript support
- ✅ **Framework-agnostic** (works with Fastify, Express, etc.)

---

## Installation

```bash
npm install @panoptic/sdk
```

---

## Configuration

### Environment Variables

Create a `.env` file in your project root:

```bash
# Application Configuration
APP_NAME=panoptic
NODE_ENV=development

# Grafana Loki Configuration (required for logging)
LOKI_HOST=https://your-loki-instance.com
LOKI_USER=your-username
LOKI_API_KEY=your-api-key

# Logging Configuration
WINSTON_LOG_LEVEL=info

# Panoptic SDK Configuration
PANOPTIC_PROJECT=my-project
PANOPTIC_ENV=development
```

### Configuration Options

When creating a Panoptic instance, you can configure:

```typescript
const panoptic = createPanoptic({
  project: 'my-app',       // Project identifier (default: from env)
  env: 'production',       // Environment (default: NODE_ENV)
});
```

---

## Quick Start

### 1. Create Panoptic Instance

```typescript
import { createPanoptic } from '@panoptic/sdk';
import { Providers } from '@panoptic/sdk';

const panoptic = createPanoptic({
  project: 'my-project',
  env: 'production',
});
```

### 2. Set Up HTTP Middleware

```typescript
import fastify from 'fastify';

const app = fastify();

// Create middleware that extracts context from requests
const panopticMiddleware = panoptic.createHttpMiddleware({
  extractMetadata: (req) => ({
    tenant_id: req.headers['x-tenant-id'],
    user_id: req.user?.id,
    plan: req.headers['x-plan'],
    method: req.method,
    path: req.url,
  }),
});

// Attach to all requests
app.addHook('onRequest', async (request, reply) => {
    await new Promise<void>((resolve) => {
      panopticMiddleware(request, resolve);
    });
  });
```

### 3. Wrap Functions for Tracking

```typescript
// Wrap any async function
const getUserProfile = panoptic.wrapAsync(
  async (userId: string) => {
    // Your business logic
    return await db.users.findById(userId);
  },
  {
    provider: Providers.POSTGRES,
    service: 'users_db',
    resource: 'getUserProfile',
  }
);

// Use normally - billing happens automatically
app.get('/users/:id', async (req, reply) => {
  const user = await getUserProfile(req.params.id);
  // Billing event automatically includes:
  // - tenant_id, user_id, plan (from middleware)
  // - method, path (from middleware)
  // - duration_ms, function_name (from wrapper)
  return user;
});
```

---

## Core Concepts

### AsyncLocalStorage Context

Panoptic uses Node.js AsyncLocalStorage to automatically propagate metadata through your async call chain:

```typescript
// Middleware sets context
setExecutionMetadata({ tenant_id: 'acme', plan: 'enterprise' });

// Anywhere in the request chain:
async function deepFunction() {
  const meta = getExecutionMetadata();
  console.log(meta.tenant_id); // 'acme' ✅
}
```

**Benefits:**
- No manual parameter passing
- Works across async boundaries
- Isolated per-request (concurrent-safe)
- Framework-agnostic

### Three Storage Functions

| Function | Purpose | When to Use |
|----------|---------|-------------|
| `setExecutionMetadata(meta)` | Set context for entire request flow | HTTP middleware |
| `withExecutionMetadata(meta, fn)` | Set context for specific callback | Isolated operations |
| `getExecutionMetadata()` | Read current context | Anywhere |

---

## API Reference

### `createPanoptic(config)`

Creates a new Panoptic instance.

```typescript
interface SDKConfig {
  project?: string;      // Project identifier
  env?: string;          // Environment (default: NODE_ENV)
}

const panoptic = createPanoptic({
  project: 'my-app',
  env: 'production',
});
```

---

### `panoptic.wrapAsync(fn, options)`

Wraps an async function for automatic billing tracking.

```typescript
interface WrapOptions {
  provider: Providers;              // Required: service provider
  service?: string;                 // Optional: specific service/model
  resource?: string;                // Optional: operation name (defaults to fn.name)
  requestId?: string;               // Optional: request correlation ID
  tags?: string[];                  // Optional: categorization tags
  attributes?: Record<string, any>; // Optional: static metadata
  context?: ExecutionMetadata | (() => ExecutionMetadata); // Optional: dynamic metadata
  captureContext?: {
    includeExecutionMetadata?: boolean; // Default: true
  };
}
```

**Example:**

```typescript
const fetchData = panoptic.wrapAsync(
  async (id: string) => {
    return await api.get(`/data/${id}`);
  },
  {
    provider: Providers.EXTERNAL_API,
    service: 'DataService',
    resource: 'fetchData',
    tags: ['read', 'external'],
  }
);

await fetchData('123');
// Logs billing event with execution time and metadata
```

---

### `panoptic.wrap(fn, options)`

Wraps a synchronous function for billing tracking.

```typescript
const calculatePrice = panoptic.wrap(
  (items: number, price: number) => {
    return items * price;
  },
  {
    provider: Providers.USER_DEFINED,
    resource: 'calculatePrice',
  }
);

const total = calculatePrice(10, 5.99);
```

---

### `panoptic.createHttpMiddleware(options)`

Creates middleware for HTTP framework integration.

```typescript
interface HttpMiddlewareOptions<Req> {
  mapRequest?: (req: Req) => HttpRequest;
  extractMetadata?: (req: HttpRequest) => ExecutionMetadata;
}

const middleware = panoptic.createHttpMiddleware({
  extractMetadata: (req) => ({
    tenant_id: req.headers['x-tenant-id'],
    user_id: req.user?.id,
    plan: req.headers['x-plan'],
    feature: 'api',
    method: req.method,
    path: req.url,
    request_id: req.headers['x-request-id'],
  }),
});
```

---

### `panoptic.getLogger(provider, service?)`

Gets a logger for manual billing events.

```typescript
const logger = panoptic.getLogger(Providers.OPENAI, 'gpt-4');

logger.billing({
  msg: 'Chat completion started',
  model: 'gpt-4',
  temperature: 0.7,
});

logger.invoice({
  msg: 'Chat completion finished',
  prompt_tokens: 100,
  completion_tokens: 50,
  total_tokens: 150,
});
```

---

## Advanced Usage

### Static Attributes vs Dynamic Context

**Attributes** - Static values set at wrap-time:
```typescript
const fn = panoptic.wrapAsync(work, {
  provider: Providers.AWS,
  attributes: {
    feature: 'premium',    // Always the same
    version: 2,
    requires_auth: true,
  }
});
```

**Context** - Dynamic values evaluated at call-time:
```typescript
const fn = panoptic.wrapAsync(work, {
  provider: Providers.AWS,
  context: () => ({
    timestamp: Date.now(),        // ✅ Different each call
    server_load: getServerLoad(), // ✅ Current value
    retry_count: getRetries(),    // ✅ Dynamic
  })
});
```

### Lazy Evaluation Example

```typescript
let requestCounter = 0;

const trackRequest = panoptic.wrapAsync(
  async (data: any) => {
    return await process(data);
  },
  {
    provider: Providers.USER_DEFINED,
    context: () => ({
      request_number: ++requestCounter,  // Increments each call
      timestamp: new Date().toISOString(),
      environment_vars: process.env.FEATURE_FLAGS,
    })
  }
);

await trackRequest(data1); // request_number: 1
await trackRequest(data2); // request_number: 2
await trackRequest(data3); // request_number: 3
```

### Disabling AsyncLocalStorage Context

For background jobs or system operations that shouldn't inherit request context:

```typescript
// Request context: { tenant_id: 'acme', user_id: 'user-123' }

const systemJob = panoptic.wrapAsync(
  async () => {
    // System-level cleanup
  },
  {
    provider: Providers.SYSTEM,
    captureContext: {
      includeExecutionMetadata: false  // Ignore AsyncLocalStorage
    },
    context: {
      job_type: 'system_cleanup',
      scope: 'global',
    }
  }
);

await systemJob();
// Billing event has ONLY: job_type, scope
// Not associated with any tenant or user
```

### Context Precedence

Metadata is merged in this order (later overwrites earlier):

1. **AsyncLocalStorage** (from middleware) - lowest priority
2. **options.context** - higher priority
3. **options.attributes** - even higher
4. **Base metadata** (function_name, duration_ms) - highest priority

```typescript
// Middleware sets
setExecutionMetadata({ plan: 'basic', region: 'us-east-1' });

const fn = panoptic.wrapAsync(work, {
  provider: Providers.AWS,
  context: { plan: 'premium' },      // Overrides 'basic'
  attributes: { region: 'eu-west-1' } // Overrides 'us-east-1'
});

await fn();
// Final: { plan: 'premium', region: 'eu-west-1' }
```

---

## Examples

### Complete Fastify Example

```typescript
import fastify from 'fastify';
import { createPanoptic } from '@panoptic/sdk';
import { Providers } from '@panoptic/sdk';

const panoptic = createPanoptic({ project: 'my-api' });

// Create middleware
const panopticMiddleware = sdk.createHttpMiddleware({
  extractMetadata: (req) => ({
    tenant_id: req.headers['x-tenant-id'],
    user_id: req.user?.id,
    plan: req.headers['x-plan'],
    method: req.method,
    path: req.url,
    request_id: req.headers['x-request-id'],
  }),
});

const app = fastify();

// Attach middleware
app.addHook('onRequest', async (request, reply) => {
  await panopticMiddleware(request, async () => {});
});

// Wrap business logic
const getItems = panoptic.wrapAsync(
  async () => {
    return await db.items.find();
  },
  {
    provider: Providers.POSTGRES,
    service: 'items_db',
    resource: 'getItems',
    tags: ['database', 'read'],
  }
);

const createItem = panoptic.wrapAsync(
  async (data: any) => {
    return await db.items.create(data);
  },
  {
    provider: Providers.POSTGRES,
    service: 'items_db',
    resource: 'createItem',
    tags: ['database', 'write'],
  }
);

// Routes
app.get('/items', async (req, reply) => {
  const items = await getItems();
  return { items };
});

app.post('/items', async (req, reply) => {
  const item = await createItem(req.body);
  return { item };
});

app.listen({ port: 3000 });
```

### AI Service Example

```typescript
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const chatCompletion = panoptic.wrapAsync(
  async (messages: any[], model: string) => {
    const response = await openai.chat.completions.create({
      model,
      messages,
    });
    return response;
  },
  {
    provider: Providers.OPENAI,
    service: 'chat',
    resource: 'chatCompletion',
    context: () => ({
      model: 'gpt-4',
      timestamp: Date.now(),
    }),
  }
);

// Usage
const response = await chatCompletion(
  [{ role: 'user', content: 'Hello!' }],
  'gpt-4'
);

// Billing event includes:
// - provider: OPENAI
// - service: chat
// - duration_ms: 1500
// - tenant_id, user_id (from middleware)
// - model: 'gpt-4'
```

### Multi-Provider Example

```typescript
// Database operation
const dbQuery = panoptic.wrapAsync(queryFn, {
  provider: Providers.POSTGRES,
  service: 'main_db',
});

// Cache operation
const cacheGet = panoptic.wrapAsync(getFn, {
  provider: Providers.REDIS,
  service: 'session_cache',
});

// AI operation
const aiGenerate = panoptic.wrapAsync(generateFn, {
  provider: Providers.OPENAI,
  service: 'gpt-4',
});

// External API
const fetchExternal = panoptic.wrapAsync(fetchFn, {
  provider: Providers.EXTERNAL_API,
  service: 'PaymentGateway',
});

// All operations are tracked with proper attribution
app.get('/process', async (req, reply) => {
  const cached = await cacheGet(req.params.id);
  if (cached) return cached;
  
  const data = await dbQuery(req.params.id);
  const enhanced = await aiGenerate(data);
  const payment = await fetchExternal(enhanced);
  
  return payment;
  // All 4 operations logged with tenant_id, user_id, etc.
});
```

### Error Tracking Example

```typescript
const riskyOperation = panoptic.wrapAsync(
  async (data: any) => {
    if (!data.valid) {
      throw new Error('Invalid data');
    }
    return await process(data);
  },
  {
    provider: Providers.USER_DEFINED,
    resource: 'riskyOperation',
  }
);

try {
  await riskyOperation({ valid: false });
} catch (error) {
  // Error is logged with:
  // - error message
  // - stack trace
  // - error type
  // - execution duration
  // - all context metadata
}
```

### Timing Breakdown Example

```typescript
const operation = panoptic.wrapAsync(heavyWork, {
  provider: Providers.AWS,
  resource: 'heavyWork',
});

await operation();

// Billing event includes timing breakdown:
// {
//   timing: {
//     total_ms: 150,       // Total wrapper time
//     execution_ms: 120,   // Actual function time
//     overhead_ms: 30      // Metadata capture + logging
//   }
// }
```

---

## Billing Event Structure

Every tracked operation generates a billing event:

```typescript
interface BillingEvent {
  ts: string;              // ISO timestamp
  projectId?: string;      // Project identifier
  env?: string;            // Environment
  category: ProvidersType; // AI, INFRA, etc.
  provider: Providers;     // Specific provider
  service?: string;        // Service/model name
  resource: string;        // Operation name
  metadata: {
    // From AsyncLocalStorage (middleware)
    tenant_id?: string;
    user_id?: string;
    plan?: string;
    method?: string;
    path?: string;
    request_id?: string;
    
    // From wrapper
    function_name: string;
    duration_ms: number;
    
    // From options.attributes
    // ... your custom attributes
    
    // From options.context
    // ... your dynamic context
    
    // Timing (wrapAsync only)
    timing?: {
      total_ms: number;
      execution_ms: number;
      overhead_ms: number;
    };
  };
}
```

---

## Best Practices

### 1. Set Up Middleware Early
Always attach middleware at the application entry point to ensure context is available everywhere.

### 2. Use Descriptive Resource Names
```typescript
// ❌ Not helpful
const fn = panoptic.wrapAsync(async () => {...}, { provider: Providers.AWS });

// ✅ Clear and searchable
const fn = panoptic.wrapAsync(async () => {...}, {
  provider: Providers.AWS,
  service: 'DynamoDB',
  resource: 'getUserProfile',
  tags: ['database', 'read', 'user'],
});
```

### 3. Leverage Context for Dynamic Values
```typescript
// ❌ Static - won't change
const fn = panoptic.wrapAsync(work, {
  provider: Providers.AWS,
  attributes: { timestamp: Date.now() }  // Captured once
});

// ✅ Dynamic - evaluated each call
const fn = panoptic.wrapAsync(work, {
  provider: Providers.AWS,
  context: () => ({ timestamp: Date.now() })
});
```

### 4. Tag Appropriately
```typescript
const fn = panoptic.wrapAsync(operation, {
  provider: Providers.POSTGRES,
  tags: ['critical', 'write', 'payment', 'user-data'],
});
```

### 5. Handle Errors Gracefully
Wrapped functions automatically log errors, but you should still handle them:
```typescript
try {
  await wrappedOperation();
} catch (error) {
  // Error already logged by wrapper
  // Handle business logic
  return errorResponse;
}
```

---

## TypeScript Support

Full type safety included:

```typescript
import type { WrapOptions, ExecutionMetadata } from '@panoptic/sdk';
import { Providers } from '@panoptic/sdk';

const options: WrapOptions = {
  provider: Providers.AWS,
  service: 'DynamoDB',
  resource: 'getUser',
};

const meta: ExecutionMetadata = {
  tenant_id: 'acme',
  user_id: 'user-123',
};
```

---

## License

MIT

---

## Contributing

Contributions welcome! Please open an issue or PR.
