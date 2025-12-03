/**
 * GCP Prebuilt Rate Cards
 * 
 * Rate cards for Google Cloud Platform services:
 * - Cloud Run
 * - Firestore
 * - Cloud Storage
 * 
 * Prices are based on GCP public pricing (as of 2024).
 * These are estimates - use calibration to adjust based on real billing.
 */

import { RateCard, PricingRule } from '../types/rateCard';

/**
 * GCP Cloud Run Rate Card
 * 
 * Pricing model:
 * - CPU: per vCPU-second
 * - Memory: per GiB-second
 * - Requests: per million requests
 * - Networking: per GB egress
 */
export function createCloudRunRateCard(): RateCard {
    const rules: PricingRule[] = [
        {
            id: 'cloud-run-cpu',
            name: 'CPU Allocation Time',
            unit: 'cpu_seconds',
            // $0.00002400 per vCPU-second
            pricePerUnit: 0.00002400,
            // First 180,000 vCPU-seconds free per month
            freeAllowance: 180000,
        },
        {
            id: 'cloud-run-memory',
            name: 'Memory Allocation Time',
            unit: 'memory_gb_seconds',
            // $0.00000250 per GiB-second
            pricePerUnit: 0.00000250,
            // First 360,000 GiB-seconds free per month
            freeAllowance: 360000,
        },
        {
            id: 'cloud-run-requests',
            name: 'Requests',
            unit: 'requests',
            // $0.40 per million requests
            pricePerUnit: 0.0000004,
            // First 2 million requests free per month
            freeAllowance: 2000000,
        },
        {
            id: 'cloud-run-egress',
            name: 'Network Egress',
            unit: 'network_egress_gb',
            tiers: [
                { min: 0, max: 1, pricePerUnit: 0 }, // First 1 GB free
                { min: 1, max: 10240, pricePerUnit: 0.12 }, // 1 GB - 10 TB
                { min: 10240, max: null, pricePerUnit: 0.08 }, // > 10 TB
            ],
        },
    ];

    return {
        id: 'gcp-cloud-run-v1',
        name: 'GCP Cloud Run',
        provider: 'gcp',
        service: 'cloud-run',
        version: '1.0.0',
        effectiveDate: '2024-01-01',
        currency: 'USD',
        rules,
        calibrationMultiplier: 1.0,
        metadata: {
            source: 'https://cloud.google.com/run/pricing',
            region: 'us-central1',
            notes: 'Prices for Tier 1 regions',
        },
    };
}

/**
 * GCP Firestore Rate Card
 * 
 * Pricing model:
 * - Document reads
 * - Document writes
 * - Document deletes
 * - Storage (per GiB-month)
 * - Network egress
 */
export function createFirestoreRateCard(): RateCard {
    const rules: PricingRule[] = [
        {
            id: 'firestore-reads',
            name: 'Document Reads',
            unit: 'reads',
            // $0.036 per 100,000 documents
            pricePerUnit: 0.00000036,
            // First 50,000 reads free per day (1.5M per month)
            freeAllowance: 1500000,
        },
        {
            id: 'firestore-writes',
            name: 'Document Writes',
            unit: 'writes',
            // $0.108 per 100,000 documents
            pricePerUnit: 0.00000108,
            // First 20,000 writes free per day (600K per month)
            freeAllowance: 600000,
        },
        {
            id: 'firestore-deletes',
            name: 'Document Deletes',
            unit: 'deletes',
            // $0.012 per 100,000 documents
            pricePerUnit: 0.00000012,
            // First 20,000 deletes free per day (600K per month)
            freeAllowance: 600000,
        },
        {
            id: 'firestore-storage',
            name: 'Storage',
            unit: 'storage_gb_months',
            // $0.108 per GiB-month
            pricePerUnit: 0.108,
            // First 1 GiB free
            freeAllowance: 1,
        },
        {
            id: 'firestore-egress',
            name: 'Network Egress',
            unit: 'network_egress_gb',
            tiers: [
                { min: 0, max: 10, pricePerUnit: 0 }, // First 10 GB free
                { min: 10, max: 10240, pricePerUnit: 0.12 }, // 10 GB - 10 TB
                { min: 10240, max: null, pricePerUnit: 0.08 }, // > 10 TB
            ],
        },
    ];

    return {
        id: 'gcp-firestore-v1',
        name: 'GCP Firestore',
        provider: 'gcp',
        service: 'firestore',
        version: '1.0.0',
        effectiveDate: '2024-01-01',
        currency: 'USD',
        rules,
        calibrationMultiplier: 1.0,
        metadata: {
            source: 'https://cloud.google.com/firestore/pricing',
            mode: 'native',
            region: 'us-central1',
        },
    };
}

/**
 * GCP Cloud Storage Rate Card
 * 
 * Pricing model:
 * - Storage (per GiB-month)
 * - Class A operations (mutating: insert, update)
 * - Class B operations (read)
 * - Network egress
 */
export function createCloudStorageRateCard(): RateCard {
    const rules: PricingRule[] = [
        {
            id: 'storage-standard',
            name: 'Standard Storage',
            unit: 'storage_gb_months',
            // $0.020 per GB-month for Standard storage
            pricePerUnit: 0.020,
            // First 5 GB free
            freeAllowance: 5,
        },
        {
            id: 'storage-class-a-ops',
            name: 'Class A Operations (Insert, Update)',
            unit: 'writes',
            // $0.05 per 10,000 operations
            pricePerUnit: 0.000005,
            // First 5,000 Class A ops free
            freeAllowance: 5000,
        },
        {
            id: 'storage-class-b-ops',
            name: 'Class B Operations (Get, List)',
            unit: 'reads',
            // $0.004 per 10,000 operations
            pricePerUnit: 0.0000004,
            // First 50,000 Class B ops free
            freeAllowance: 50000,
        },
        {
            id: 'storage-egress',
            name: 'Network Egress',
            unit: 'network_egress_gb',
            tiers: [
                { min: 0, max: 1, pricePerUnit: 0 }, // First 1 GB free
                { min: 1, max: 10240, pricePerUnit: 0.12 }, // 1 GB - 10 TB
                { min: 10240, max: 153600, pricePerUnit: 0.11 }, // 10 TB - 150 TB
                { min: 153600, max: null, pricePerUnit: 0.08 }, // > 150 TB
            ],
        },
    ];

    return {
        id: 'gcp-cloud-storage-v1',
        name: 'GCP Cloud Storage',
        provider: 'gcp',
        service: 'cloud-storage',
        version: '1.0.0',
        effectiveDate: '2024-01-01',
        currency: 'USD',
        rules,
        calibrationMultiplier: 1.0,
        metadata: {
            source: 'https://cloud.google.com/storage/pricing',
            storageClass: 'standard',
            region: 'us-central1',
        },
    };
}

/**
 * GCP BigQuery Rate Card (for completeness)
 */
export function createBigQueryRateCard(): RateCard {
    const rules: PricingRule[] = [
        {
            id: 'bigquery-analysis',
            name: 'Analysis (On-demand)',
            unit: 'custom',
            customUnit: 'tb_scanned',
            // $5.00 per TB scanned
            pricePerUnit: 5.0,
            // First 1 TB free per month
            freeAllowance: 1,
        },
        {
            id: 'bigquery-storage',
            name: 'Active Storage',
            unit: 'storage_gb_months',
            // $0.020 per GB-month for active storage
            pricePerUnit: 0.020,
            // First 10 GB free
            freeAllowance: 10,
        },
        {
            id: 'bigquery-streaming',
            name: 'Streaming Inserts',
            unit: 'custom',
            customUnit: 'rows_streamed',
            // $0.01 per 200 MB (roughly $0.05 per million rows)
            pricePerUnit: 0.00000005,
        },
    ];

    return {
        id: 'gcp-bigquery-v1',
        name: 'GCP BigQuery',
        provider: 'gcp',
        service: 'bigquery',
        version: '1.0.0',
        effectiveDate: '2024-01-01',
        currency: 'USD',
        rules,
        calibrationMultiplier: 1.0,
        metadata: {
            source: 'https://cloud.google.com/bigquery/pricing',
            pricingModel: 'on-demand',
            region: 'us',
        },
    };
}

/**
 * Get all GCP rate cards
 */
export function getAllGCPRateCards(): RateCard[] {
    return [
        createCloudRunRateCard(),
        createFirestoreRateCard(),
        createCloudStorageRateCard(),
        createBigQueryRateCard(),
    ];
}

/**
 * GCP service name mapping
 */
export const GCP_SERVICE_MAPPING: Record<string, string> = {
    'Cloud Run': 'cloud-run',
    'Firestore': 'firestore',
    'Cloud Storage': 'cloud-storage',
    'BigQuery': 'bigquery',
    'Compute Engine': 'compute-engine',
    'Cloud Functions': 'cloud-functions',
};

/**
 * Get rate card ID for a GCP service
 */
export function getGCPRateCardId(serviceName: string): string | undefined {
    const normalizedService = GCP_SERVICE_MAPPING[serviceName] || serviceName.toLowerCase().replace(/\s+/g, '-');
    return `gcp-${normalizedService}-v1`;
}

