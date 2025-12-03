/**
 * GCP Billing Record Types
 * 
 * Represents billing data imported from BigQuery GCP billing export.
 * This is the "real" cost data used for comparison against rate card estimates.
 */

/**
 * GCP Billing Record - matches BigQuery billing export schema
 */
export interface GCPBillingRecord {
    /** Billing account ID */
    billing_account_id: string;

    /** Service information */
    service: {
        id: string;           // e.g., '6F81-5844-456A' (Cloud Run)
        description: string;  // e.g., 'Cloud Run'
    };

    /** SKU information */
    sku: {
        id: string;           // e.g., '0048-AA73-1F53'
        description: string;  // e.g., 'CPU Allocation Time'
    };

    /** Usage start time (ISO string) */
    usage_start_time: string;

    /** Usage end time (ISO string) */
    usage_end_time: string;

    /** Project information */
    project: {
        id: string;
        name: string;
        number: string;
        labels?: Record<string, string>;
    };

    /** Labels attached to the resource */
    labels: GCPLabel[];

    /** System labels */
    system_labels: GCPLabel[];

    /** Location */
    location: {
        location: string;     // e.g., 'us-central1'
        country: string;      // e.g., 'US'
        region: string;       // e.g., 'us-central1'
        zone?: string;        // e.g., 'us-central1-a'
    };

    /** Resource information */
    resource?: {
        name?: string;
        global_name?: string;
    };

    /** Usage information */
    usage: {
        amount: number;
        unit: string;         // e.g., 'seconds', 'byte-seconds', 'requests'
        amount_in_pricing_units: number;
        pricing_unit: string; // e.g., 'hour', 'gibibyte month'
    };

    /** Credits applied */
    credits: GCPCredit[];

    /** Invoice information */
    invoice?: {
        month: string;        // e.g., '202411'
    };

    /** Cost information */
    cost: number;             // Total cost in billing currency

    /** Currency */
    currency: string;         // e.g., 'USD'

    /** Currency conversion rate */
    currency_conversion_rate?: number;

    /** Cost type */
    cost_type: string;        // e.g., 'regular', 'tax', 'adjustment'

    /** Export time */
    export_time: string;
}

/**
 * GCP Label
 */
export interface GCPLabel {
    key: string;
    value: string;
}

/**
 * GCP Credit
 */
export interface GCPCredit {
    name: string;
    amount: number;
    full_name?: string;
    id?: string;
    type?: string;
}

/**
 * Simplified GCP billing record for internal processing
 */
export interface SimplifiedGCPRecord {
    /** Service ID */
    serviceId: string;

    /** Service name (human-readable) */
    serviceName: string;

    /** SKU ID */
    skuId: string;

    /** SKU description */
    skuDescription: string;

    /** Project ID */
    projectId: string;

    /** Usage amount */
    usageAmount: number;

    /** Usage unit */
    usageUnit: string;

    /** Cost in USD */
    costUsd: number;

    /** Usage start time */
    usageStartTime: string;

    /** Usage end time */
    usageEndTime: string;

    /** Location/region */
    region: string;

    /** Labels (flattened) */
    labels: Record<string, string>;

    /** Tenant ID (extracted from labels) */
    tenantId?: string;

    /** Feature (extracted from labels) */
    feature?: string;

    /** Environment (extracted from labels) */
    environment?: string;
}

/**
 * GCP Service IDs (common ones)
 */
export const GCP_SERVICE_IDS = {
    CLOUD_RUN: '6F81-5844-456A',
    FIRESTORE: '460E-B8A6-C9D6',
    CLOUD_STORAGE: '95FF-2EF5-5EA1',
    BIGQUERY: '24E6-581D-38E5',
    COMPUTE_ENGINE: '6F81-5844-456A',
    CLOUD_FUNCTIONS: '29E7-DA93-CA13',
    PUB_SUB: 'A1E8-BE35-7EBC',
} as const;

/**
 * GCP Service names for display
 */
export const GCP_SERVICE_NAMES: Record<string, string> = {
    [GCP_SERVICE_IDS.CLOUD_RUN]: 'Cloud Run',
    [GCP_SERVICE_IDS.FIRESTORE]: 'Firestore',
    [GCP_SERVICE_IDS.CLOUD_STORAGE]: 'Cloud Storage',
    [GCP_SERVICE_IDS.BIGQUERY]: 'BigQuery',
    [GCP_SERVICE_IDS.COMPUTE_ENGINE]: 'Compute Engine',
    [GCP_SERVICE_IDS.CLOUD_FUNCTIONS]: 'Cloud Functions',
    [GCP_SERVICE_IDS.PUB_SUB]: 'Pub/Sub',
};

/**
 * Label keys used for attribution
 */
export const GCP_LABEL_KEYS = {
    TENANT_ID: 'tenant_id',
    FEATURE: 'feature',
    ENVIRONMENT: 'env',
    SERVICE_NAME: 'service_name',
    COMPONENT: 'component',
} as const;

/**
 * Extract tenant ID from GCP labels
 */
export function extractTenantId(labels: GCPLabel[]): string | undefined {
    const tenantLabel = labels.find(
        l => l.key === GCP_LABEL_KEYS.TENANT_ID || l.key === 'tenant-id'
    );
    return tenantLabel?.value;
}

/**
 * Extract feature from GCP labels
 */
export function extractFeature(labels: GCPLabel[]): string | undefined {
    const featureLabel = labels.find(
        l => l.key === GCP_LABEL_KEYS.FEATURE || l.key === 'feature-name'
    );
    return featureLabel?.value;
}

/**
 * Convert GCP billing record to simplified format
 */
export function simplifyGCPRecord(record: GCPBillingRecord): SimplifiedGCPRecord {
    const flatLabels: Record<string, string> = {};
    for (const label of record.labels) {
        flatLabels[label.key] = label.value;
    }

    return {
        serviceId: record.service.id,
        serviceName: record.service.description,
        skuId: record.sku.id,
        skuDescription: record.sku.description,
        projectId: record.project.id,
        usageAmount: record.usage.amount,
        usageUnit: record.usage.unit,
        costUsd: record.cost,
        usageStartTime: record.usage_start_time,
        usageEndTime: record.usage_end_time,
        region: record.location.region,
        labels: flatLabels,
        tenantId: extractTenantId(record.labels),
        feature: extractFeature(record.labels),
        environment: flatLabels[GCP_LABEL_KEYS.ENVIRONMENT],
    };
}

