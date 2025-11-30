import { createSDK, PanopticSDK } from '../src/SDK/sdk';
import { Providers } from '../src/types/providers';
import { withExecutionMetadata, setExecutionMetadata } from '../src/context/executionContext';

// Basic setup for local testing
const sdk: PanopticSDK = createSDK({
    project: 'demo-project',
    env: 'development',
});

// Example synchronous function to wrap
function calculateTotal(items: number, pricePerItem: number): number {
    // Simulate some CPU work
    let total = 0;
    for (let i = 0; i < items; i++) {
        total += pricePerItem;
    }
    return total;
}

// Example async function to wrap
async function fetchUser(id: string): Promise<{ id: string; name: string }> {
    // Simulate I/O latency
    await new Promise((resolve) => setTimeout(resolve, 100));
    return { id, name: 'Ada Lovelace' };
}

// Wrap the functions with billing tracking
const wrappedCalculateTotal = sdk.wrap(calculateTotal, {
    provider: Providers.USER_DEFINED,
    service: 'BillingDemo',
    resource: 'calculate-total',
    tags: ['example', 'sync'],
    attributes: {
        feature: 'basic-usage',
    },
});

const wrappedFetchUser = sdk.wrapAsync(fetchUser, {
    provider: Providers.USER_DEFINED,
    service: 'BillingDemo',
    resource: 'fetch-user',
    tags: ['example', 'async'],
    attributes: {
        feature: 'basic-usage',
    },
});

async function main() {
    // Run everything inside an execution metadata context
    await withExecutionMetadata(
        {
            user_id: 'user-123',
            tenant_id: 'tenant-xyz',
            request_source: 'example-script',
        },
        async () => {
            // You can also add/override metadata later in the call chain
            setExecutionMetadata({ feature_flag: 'beta-billing' });

            const total = wrappedCalculateTotal(5, 10);
            console.log('Sync result (calculateTotal):', total);

            const user = await wrappedFetchUser('user-123');
            console.log('Async result (fetchUser):', user);

            console.log('Example finished. Check your logger output for billing events.');
        }
    );
}

main().catch((err) => {
    console.error('Error running basic example:', err);
    process.exit(1);
});


