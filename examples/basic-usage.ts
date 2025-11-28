/**
 * Panoptic SDK - Basic Usage Examples
 * 
 * The SDK's primary purpose is wrapping functions to track billing/usage.
 * Each wrapped function automatically logs events to Grafana Loki.
 */

import { createSDK } from '../src/SDK/sdk';
import { 
    Providers, 
    OpenAIServices, 
    AwsServices, 
    GoogleServices 
} from '../src/types/providers';

// ─────────────────────────────────────────────────────────────
// 1. Create SDK instance
// ─────────────────────────────────────────────────────────────

const sdk = createSDK({
    project: 'ecommerce-app',
    env: 'development',
});

// ─────────────────────────────────────────────────────────────
// 2. Wrap functions - the primary API
// ─────────────────────────────────────────────────────────────

// OpenAI - AI inference
async function generateText(prompt: string): Promise<string> {
    await new Promise(r => setTimeout(r, 100));
    return `Response to: ${prompt}`;
}

const trackedGenerate = sdk.wrapAsync(generateText, {
    provider: Providers.OPENAI,
    service: OpenAIServices.GPT4o,
    tags: ['ai', 'generation'],
});

// AWS S3 - Storage
function uploadFile(bucket: string, key: string): { url: string } {
    return { url: `s3://${bucket}/${key}` };
}

const trackedUpload = sdk.wrap(uploadFile, {
    provider: Providers.AWS,
    service: AwsServices.S3,
});

// Google BigQuery - Analytics
async function runQuery(sql: string): Promise<{ rows: number }> {
    await new Promise(r => setTimeout(r, 150));
    return { rows: 42 };
}

const trackedQuery = sdk.wrapAsync(runQuery, {
    provider: Providers.GOOGLE,
    service: GoogleServices.BIGQUERY,
});

// Custom business logic
function calculateTotal(items: number[]): number {
    return items.reduce((a, b) => a + b, 0);
}

const trackedCalculate = sdk.wrap(calculateTotal, {
    provider: Providers.USER_DEFINED,
    service: 'OrderService',
    resource: 'calculate-total',
});

// ─────────────────────────────────────────────────────────────
// 3. Advanced: Get logger for custom events
// ─────────────────────────────────────────────────────────────

const openaiLogger = sdk.getLogger(Providers.OPENAI, OpenAIServices.GPT4o);

function logTokenUsage(prompt: number, completion: number) {
    openaiLogger.token_usage({
        promptTokens: prompt,
        completionTokens: completion,
        totalTokens: prompt + completion,
    });
}

// ─────────────────────────────────────────────────────────────
// Run examples
// ─────────────────────────────────────────────────────────────

async function main() {
    console.log('\n🚀 Panoptic SDK Examples\n');

    // Use wrapped functions normally - billing is automatic
    console.log('1. OpenAI:');
    const text = await trackedGenerate('Hello world');
    console.log(`   → ${text}`);

    console.log('\n2. AWS S3:');
    const upload = trackedUpload('my-bucket', 'file.txt');
    console.log(`   → ${upload.url}`);

    console.log('\n3. BigQuery:');
    const query = await trackedQuery('SELECT * FROM users');
    console.log(`   → ${query.rows} rows`);

    console.log('\n4. Custom:');
    const total = trackedCalculate([10, 20, 30]);
    console.log(`   → Total: ${total}`);

    console.log('\n5. Direct logger:');
    logTokenUsage(100, 250);
    console.log('   → Logged token usage');

    console.log('\n✅ Done! Check Grafana Loki:\n');
    console.log('   {app="panoptic", provider="OpenAI"}');
    console.log('   {app="panoptic", env="development"} | json\n');
}

main().catch(console.error);
