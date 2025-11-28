import { BillableSDK } from '../src/SDK/sdk';
import { Providers } from '../src/types/providers';

// Initialize SDK with username (required for MongoDB collection routing)
const sdk = new BillableSDK({
    username: 'john_doe',
    project: 'my-project',
    env: 'development'
});

// ============================================
// Example 1: Named function - auto-captures 'calculatePrice'
// ============================================
function calculatePrice(items: number, pricePerItem: number): number {
    return items * pricePerItem;
}

const wrappedCalculate = sdk.wrap(calculatePrice, {
    provider: Providers.USER_DEFINED,
    service: 'PricingService'
});

console.log('Example 1 - Named function:');
console.log('Total:', wrappedCalculate(5, 10));
// MongoDB: resource: 'calculatePrice', metadata.function_name: 'calculatePrice'
// Collection: user_defined_john_doe

// ============================================
// Example 2: Arrow function - auto-captures variable name
// ============================================
const processOrder = (orderId: string) => {
    console.log('Processing order:', orderId);
    return { status: 'completed', orderId };
};

const wrappedProcess = sdk.wrap(processOrder, {
    provider: Providers.USER_DEFINED,
    service: 'OrderService'
});

console.log('\nExample 2 - Arrow function:');
console.log(wrappedProcess('ORDER-123'));
// MongoDB: resource: 'processOrder'

// ============================================
// Example 3: Anonymous function - uses fallback 'anonymous'
// ============================================
const wrappedAnon = sdk.wrap(() => {
    return 'done';
}, {
    provider: Providers.USER_DEFINED
});

console.log('\nExample 3 - Anonymous function:');
console.log(wrappedAnon());
// MongoDB: resource: 'anonymous'

// ============================================
// Example 4: Override with custom resource name
// ============================================
const wrappedCustom = sdk.wrap(calculatePrice, {
    provider: Providers.USER_DEFINED,
    resource: 'custom-price-calculation'  // Overrides fn.name
});

console.log('\nExample 4 - Custom resource name:');
console.log('Total:', wrappedCustom(3, 7));
// MongoDB: resource: 'custom-price-calculation'

// ============================================
// Example 5: Create dedicated logger for multiple functions
// ============================================
const gcpLogger = sdk.createLogger(Providers.GOOGLE, 'BigQuery');

function runQuery1(sql: string) {
    console.log('Running query 1:', sql);
    return { rows: 100 };
}

function runQuery2(sql: string) {
    console.log('Running query 2:', sql);
    return { rows: 50 };
}

const wrapped1 = sdk.wrap(runQuery1, { logger: gcpLogger });
const wrapped2 = sdk.wrap(runQuery2, { logger: gcpLogger });

console.log('\nExample 5 - Shared logger for multiple functions:');
console.log(wrapped1('SELECT * FROM users'));
console.log(wrapped2('SELECT * FROM orders'));
// Both will log to same collection: google_cloud_gcp_john_doe

// ============================================
// Example 6: Async function wrapping
// ============================================
async function fetchUserData(userId: string): Promise<{ id: string; name: string }> {
    // Simulate async operation
    await new Promise(resolve => setTimeout(resolve, 100));
    return { id: userId, name: 'John Doe' };
}

const wrappedFetch = sdk.wrapAsync(fetchUserData, {
    provider: Providers.USER_DEFINED,
    service: 'UserService'
});

async function runAsyncExample() {
    console.log('\nExample 6 - Async function:');
    const user = await wrappedFetch('user-123');
    console.log('User:', user);
}

runAsyncExample().catch(console.error);

// ============================================
// Example 7: Different providers route to different collections
// ============================================
const awsLogger = sdk.createLogger(Providers.AWS, 'S3');
const openaiLogger = sdk.createLogger(Providers.OPENAI, 'GPT-4');

function uploadFile(bucket: string, key: string) {
    return { bucket, key, uploaded: true };
}

function generateText(prompt: string) {
    return { text: 'Generated response for: ' + prompt };
}

const wrappedUpload = sdk.wrap(uploadFile, { logger: awsLogger });
const wrappedGenerate = sdk.wrap(generateText, { logger: openaiLogger });

console.log('\nExample 7 - Multiple providers:');
console.log(wrappedUpload('my-bucket', 'file.txt'));
// Logs to: panoptic-development.aws_john_doe

console.log(wrappedGenerate('Hello world'));
// Logs to: panoptic-development.openai_john_doe

