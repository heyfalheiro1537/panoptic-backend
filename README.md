# PanOptic - Implementation Plan

## Project Overview
Building a TypeScript SDK that wraps cloud provider functions (starting with GCP) to automatically track and log billing/cost information to MongoDB with dynamic collection routing based on provider and username.

---

## Current State
- ✅ Basic SDK structure with `wrap()` method
- ✅ Pino logger with custom levels (charge, billing, quota, token_usage, invoice)
- ✅ MongoDB transport configured
- ✅ Type definitions for providers, services, and billing events
- ✅ Support for multiple cloud providers (GCP, AWS, OpenAI, MongoDB Atlas)

---

## Critical Requirements Summary

### 1. MongoDB Structure
- **Database naming:** `panoptic-{env}` (e.g., `panoptic-prod`, `panoptic-dev`)
- **Collection naming:** `{provider}_{username}` (e.g., `gcp_john_doe`, `aws_acme_corp`)
- **Indexes:** ts (desc), service, env, compound (ts + service)

### 2. Child Logger Architecture
- Base logger should NOT be used directly
- Each provider gets a child logger with automatic context
- Context includes: provider, username, projectId, env, service
- Transport routes to correct collection based on context

### 3. Function Name Auto-Capture
- `wrap()` should automatically extract function name
- Priority: meta.resource → fn.name → 'anonymous'
- Stored in `BillingEvent.metadata.function_name` and `resource` field

---

## Week 1: Core Functionality (Child Loggers + MongoDB Routing)

### Task 1.1: Implement Child Logger System
**File:** `src/types/logger.ts`

**Requirements:**
- Create base logger (NOT exported for direct use)
- Export `createProviderLogger(context)` function
- Add TypeScript type augmentation for custom log methods
- Add `ProviderLoggerContext` interface

**Interface:**
```typescript
export interface ProviderLoggerContext {
    provider: Providers;
    username: string;
    projectId?: string;
    env?: string;
    service?: string;
}

export function createProviderLogger(context: ProviderLoggerContext): pino.Logger;
```

**Type Augmentation:**
```typescript
declare module 'pino' {
    interface Logger {
        charge: pino.LogFn;
        billing: pino.LogFn;
        quota: pino.LogFn;
        token_usage: pino.LogFn;
        invoice: pino.LogFn;
    }
}
```

---

### Task 1.2: Update MongoDB Transport with Dynamic Routing
**File:** `src/types/transporter/mongoDB.ts`

**Requirements:**
- Implement custom Pino transport using `pino-abstract-transport`
- Read provider and username from log context
- Sanitize collection name: `{provider}_{username}` (lowercase, no special chars)
- Determine database from env: `panoptic-{env}`
- Create indexes on first write to collection
- Cache collections to avoid re-creating indexes

**Functions to implement:**
```typescript
function sanitizeCollectionName(provider: string, username: string): string;
function getDatabaseName(env: string): string;
async function ensureCollection(db: Db, collectionName: string): Promise<Collection>;
```

**Index requirements:**
- `{ ts: -1 }` - descending timestamp
- `{ service: 1 }` - service name
- `{ env: 1 }` - environment
- `{ ts: -1, service: 1 }` - compound index

**Error handling:**
- MongoDB errors should NOT break the application
- Log errors to stderr
- Continue execution even if MongoDB is unavailable

---

### Task 1.3: Update SDK with Child Logger Management
**File:** `src/SDK/sdk.ts`

**Requirements:**
1. **Constructor changes:**
   - Make `username` required in options
   - Store `env` from options or `NODE_ENV`
   - Create SDK-level logger using `createProviderLogger()`
   - Initialize provider loggers Map

2. **Add `getProviderLogger()` private method:**
   - Get or create child logger for provider
   - Cache loggers in Map
   - Key format: `${provider}-${service}`

3. **Add `createLogger()` public method:**
   - Allow users to create dedicated loggers
   - Useful for wrapping multiple functions with same context

4. **Update `wrap()` method:**
   - Auto-extract function name with priority: `meta.resource` → `fn.name` → `'anonymous'`
   - Use provided logger OR get/create provider-specific logger
   - Store function name in both `resource` AND `metadata.function_name`
   - Log execution start with `logger.billing()`
   - Construct complete `BillingEvent` on success
   - Calculate duration in milliseconds
   - Determine category based on provider (AI vs INFRA)
   - Log complete event with `logger.invoice(event)`
   - Handle errors with `logger.error()`

**Function name extraction:**
```typescript
const functionName = meta?.resource || fn.name || 'anonymous';
```

**BillingEvent structure:**
```typescript
const event: BillingEvent = {
    ts: new Date().toISOString(),
    projectId: self.project,
    env: self.env,
    category: /* determine from provider */,
    provider: /* from meta or USER_DEFINED */,
    service: meta?.service,
    resource: functionName,  // ← Function name here
    quantity: 1,
    unit: 'execution',
    amount: 0,
    currency: 'USD',
    metadata: {
        function_name: functionName,  // ← Also in metadata
        duration_ms: duration,
        args_types: args.map(a => typeof a),
        user: meta?.user,
        requestId: meta?.requestId,
        tags: meta?.tags,
    }
};
```

---

### Task 1.4: Update Type Definitions
**File:** `src/types/options.ts`

**Requirements:**
- Make `username` required
- Add optional `env` field

```typescript
export interface BillableOptions {
    apiKey?: string;
    project?: string;
    username: string;  // ← REQUIRED
    env?: 'production' | 'development' | 'staging';
    autoConnect?: boolean;
}
```

**File:** `src/types/meta.ts`

**Requirements:**
- Add optional `logger` field to allow passing custom logger

```typescript
export interface BillableMeta {
    provider?: string;
    service?: string;
    resource?: string;  // Optional - will use function name if not provided
    user?: string;
    requestId?: string;
    source?: string;
    tags?: string[];
    logger?: pino.Logger;  // ← NEW: allow custom logger
    [key: string]: any;
}
```

---

### Task 1.5: Environment Configuration
**File:** `src/config/env.ts` (NEW)

**Requirements:**
- Centralize all environment configuration
- Export config object with defaults

```typescript
export const config = {
    env: process.env.NODE_ENV || 'development',
    mongodb: {
        uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/',
        database: `panoptic-${process.env.NODE_ENV || 'dev'}`,
        user: process.env.MONGODB_USER,
        password: process.env.MONGODB_PASSWORD,
    },
    logging: {
        level: process.env.PINO_LOG_LEVEL || 'info',
    }
};
```

**File:** `.env.example` (NEW)

```bash
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/
MONGODB_USER=
MONGODB_PASSWORD=
PINO_LOG_LEVEL=info
```

---

### Task 1.6: Create Usage Examples
**File:** `examples/basic-usage.ts` (NEW)

**Requirements:**
- Show SDK initialization with username
- Demonstrate function wrapping with auto name capture
- Show how to create dedicated loggers
- Include error handling example

```typescript
import { BillableSDK } from '../src/SDK/sdk';
import { Providers } from '../src/types/providers';

// Initialize SDK
const sdk = new BillableSDK({
    username: 'john_doe',
    project: 'my-project',
    env: 'development'
});

// Example 1: Auto function name capture
function calculatePrice(items: number, pricePerItem: number): number {
    return items * pricePerItem;
}

const wrappedCalculate = sdk.wrap(calculatePrice, {
    provider: Providers.USER_DEFINED,
    service: 'PricingService'
    // No resource needed - will use 'calculatePrice' automatically
});

const total = wrappedCalculate(5, 10);
// MongoDB will show: resource: 'calculatePrice', metadata.function_name: 'calculatePrice'

// Example 2: Manual resource name (overrides function name)
const wrappedWithCustomName = sdk.wrap(calculatePrice, {
    provider: Providers.USER_DEFINED,
    resource: 'custom-pricing-calculation'
    // Will use 'custom-pricing-calculation' instead of 'calculatePrice'
});

// Example 3: Create dedicated logger
const gcpLogger = sdk.createLogger(Providers.GOOGLE, 'BigQuery');

function runQuery(sql: string) {
    // ... query logic
}

const wrappedQuery = sdk.wrap(runQuery, {
    provider: Providers.GOOGLE,
    service: 'BigQuery',
    logger: gcpLogger
});
```

---

## Week 2: GCP Integration

### Task 2.1: Install GCP Dependencies
**Command:**
```bash
npm install @google-cloud/bigquery @google-cloud/billing dotenv
npm install -D @types/node
```

---

### Task 2.2: Create GCP Billing Connector
**File:** `src/connectors/gcp/billing.ts` (NEW)

**Requirements:**
- Use `@google-cloud/billing` to fetch real cost data
- Support authentication via service account or ADC
- Implement date range queries
- Return normalized cost data

**Interface:**
```typescript
export class GCPBillingConnector {
    constructor(projectId: string, keyFilePath?: string);
    async getCosts(startDate: Date, endDate: Date): Promise<CostData[]>;
}

interface CostData {
    date: Date;
    service: string;
    cost: number;
    currency: string;
}
```

---

### Task 2.3: Create GCP Pricing Calculator
**File:** `src/calculators/gcp/pricing.ts` (NEW)

**Requirements:**
- Implement pricing calculations for main GCP services
- All pricing configurable by region
- Return cost estimates based on usage metrics

**Methods:**
```typescript
export class GCPPricingCalculator {
    calculateBigQueryCost(bytesProcessed: number): number;
    // $5 per TB processed (on-demand pricing)
    
    calculateCloudRunCost(executionTimeMs: number, memoryMB: number, cpuCount: number): number;
    // CPU: $0.00002400 per vCPU-second
    // Memory: $0.00000250 per GiB-second
    
    calculateCloudStorageCost(storageGB: number, storageClass: string): number;
    // Standard: $0.020 per GB per month
    // Nearline: $0.010 per GB per month
    
    calculateCloudFunctionsCost(invocations: number, executionTimeMs: number, memoryMB: number): number;
    // First 2M invocations free
    // $0.40 per million invocations after
}
```

---

## Week 3: GCP Service Wrappers

### Task 3.1: Create Base GCP Wrapper
**File:** `src/wrappers/gcp/base.ts` (NEW)

**Requirements:**
- Base class for all GCP wrappers
- Common logging logic
- Provider/category automatically set
- Timing and error handling

```typescript
export abstract class BaseGCPWrapper {
    protected logger: pino.Logger;
    protected calculator: GCPPricingCalculator;
    
    constructor(logger: pino.Logger);
    
    protected logExecution(
        functionName: string,
        duration: number,
        metadata: any,
        cost?: number
    ): void;
    
    protected abstract calculateCost(metadata: any): number;
}
```

---

### Task 3.2: Create BigQuery Wrapper
**File:** `src/wrappers/gcp/bigquery.ts` (NEW)

**Requirements:**
- Wrap `@google-cloud/bigquery` client
- Intercept `query()` method
- Extract: bytes_processed, rows_returned, cache_hit
- Calculate cost using pricing calculator
- Log complete BillingEvent
- Return original response unchanged

**Usage:**
```typescript
import { BigQuery } from '@google-cloud/bigquery';
import { BigQueryWrapper } from './wrappers/gcp/bigquery';

const sdk = new BillableSDK({ username: 'john', project: 'my-gcp' });
const bqLogger = sdk.createLogger(Providers.GOOGLE, 'BigQuery');

const bigquery = new BigQuery();
const wrapper = new BigQueryWrapper(bqLogger);
const wrappedBQ = wrapper.wrap(bigquery);

// Use normally - auto-tracked
const [rows] = await wrappedBQ.query('SELECT * FROM dataset.table');
```

---

## Week 4: Testing, Documentation, Polish

### Task 4.1: Add Unit Tests
**File:** `tests/sdk.test.ts` (NEW)
**File:** `tests/logger.test.ts` (NEW)
**File:** `tests/transport.test.ts` (NEW)

**Requirements:**
- Test child logger creation
- Test function name extraction
- Test collection name sanitization
- Test wrap() with various function types
- Mock MongoDB writes

**Install:**
```bash
npm install -D jest ts-jest @types/jest
```

---

### Task 4.2: Update README
**File:** `README.md`

**Sections:**
1. Installation
2. Quick Start
3. MongoDB Structure Explanation
4. Environment Variables
5. Function Name Auto-Capture
6. Creating Child Loggers
7. Provider-Specific Examples (GCP, AWS, OpenAI)
8. API Reference

---

### Task 4.3: Create Additional Examples
**File:** `examples/gcp-bigquery.ts` (NEW)
**File:** `examples/multi-provider.ts` (NEW)
**File:** `examples/error-handling.ts` (NEW)

---

## Implementation Notes

### Function Name Extraction Priority
1. **Explicit resource in meta:** `meta.resource` (highest priority)
2. **Function name:** `fn.name` (JavaScript native property)
3. **Fallback:** `'anonymous'` (when function has no name)

**Examples:**
```typescript
// Case 1: Named function
function myFunction() {}
wrap(myFunction) // → resource: 'myFunction'

// Case 2: Anonymous function
wrap(() => {}) // → resource: 'anonymous'

// Case 3: Arrow function stored in const
const myArrow = () => {}
wrap(myArrow) // → resource: 'myArrow'

// Case 4: Explicit resource (overrides all)
wrap(myFunction, { resource: 'custom-name' }) // → resource: 'custom-name'
```

### MongoDB Collection Sanitization Rules
```typescript
// Input: "Google Cloud (GCP)", "John Doe"
// Output: "google_cloud_gcp_john_doe"

Steps:
1. Convert to lowercase
2. Replace non-alphanumeric with underscore
3. Collapse multiple underscores to single
4. Trim leading/trailing underscores
```

### Error Handling Philosophy
- **Wrapped functions:** Should throw errors normally (don't suppress)
- **Logging/MongoDB:** Should NEVER break wrapped function execution
- **Transport errors:** Log to stderr, continue execution
- **Missing credentials:** Warn but don't crash

### Performance Considerations
- Cache child loggers (don't recreate)
- Use MongoDB connection pooling
- Async logging (don't block wrapped functions)
- Consider bulk writes for high-volume scenarios

---

## Deliverables Checklist

### Week 1
- [ ] `src/types/logger.ts` - Child logger system
- [ ] `src/types/transporter/mongoDB.ts` - Dynamic routing transport
- [ ] `src/SDK/sdk.ts` - Updated with child logger management
- [ ] `src/types/options.ts` - Required username
- [ ] `src/types/meta.ts` - Optional logger field
- [ ] `src/config/env.ts` - Centralized config
- [ ] `.env.example` - Environment template
- [ ] `examples/basic-usage.ts` - Usage examples
- [ ] Function name auto-capture working
- [ ] MongoDB collections created dynamically
- [ ] Indexes created automatically

### Week 2
- [ ] GCP dependencies installed
- [ ] `src/connectors/gcp/billing.ts` - Billing API integration
- [ ] `src/calculators/gcp/pricing.ts` - Cost calculations

### Week 3
- [ ] `src/wrappers/gcp/base.ts` - Base wrapper class
- [ ] `src/wrappers/gcp/bigquery.ts` - BigQuery wrapper
- [ ] Working end-to-end GCP example

### Week 4
- [ ] Unit tests written
- [ ] README updated
- [ ] Multiple examples created
- [ ] Code documented with JSDoc comments

---

## Success Criteria

✅ SDK can be initialized with username  
✅ Function names are captured automatically  
✅ Child loggers route to correct MongoDB collections  
✅ Collections follow `{provider}_{username}` format  
✅ Databases follow `panoptic-{env}` format  
✅ Indexes created automatically  
✅ GCP BigQuery integration works end-to-end  
✅ Costs are calculated and logged  
✅ Errors don't break wrapped functions  
✅ Documentation is complete and clear  

---

## Questions to Address During Implementation

1. **Collection creation:** On-demand or upfront?
   - **Recommendation:** On-demand (when first event is logged)

2. **Event batching:** Individual writes or batched?
   - **Recommendation:** Individual for simplicity, batching for optimization later

3. **MongoDB unavailable:** Queue in memory, file, or drop?
   - **Recommendation:** Log to stderr and drop (fail-safe mode)

4. **Cost query API:** Should SDK expose methods to query costs?
   - **Recommendation:** Yes, add in Week 4 as bonus feature

5. **Multiple environments:** How to handle same username across envs?
   - **Recommendation:** Database separation handles this (panoptic-prod vs panoptic-dev)

---

## Next Steps After Week 4

1. **Add more providers:**
   - AWS wrapper (Lambda, S3, EC2)
   - OpenAI wrapper (GPT, embeddings, TTS)
   - MongoDB Atlas wrapper

2. **Advanced features:**
   - Cost forecasting
   - Budget alerts
   - Dashboard/UI for visualizing costs
   - Export to CSV/Excel

3. **Publishing:**
   - Publish to npm as `@panoptic/billing-sdk`
   - Create GitHub repository
   - Add CI/CD pipeline
   - Add contribution guidelines

---

## Timeline Summary

| Week | Focus | Deliverable |
|------|-------|-------------|
| 1 | Core + Child Loggers | Working SDK with auto function capture + MongoDB routing |
| 2 | GCP Integration | Billing API connector + pricing calculator |
| 3 | GCP Wrappers | BigQuery wrapper + base wrapper class |
| 4 | Polish | Tests + docs + examples |

**Total:** 4 weeks to production-ready SDK

---

*Document created: 2025-01-15*  
*Last updated: 2025-01-15*