/**
 * GCP Billing Processor for Panoptic Billing System
 * 
 * Imports and processes billing data from GCP BigQuery billing export.
 * Converts GCP billing records to LineItems for comparison with rate card estimates.
 */

import {
    GCPBillingRecord,
    SimplifiedGCPRecord,
    simplifyGCPRecord,
    GCP_SERVICE_NAMES,
    GCP_LABEL_KEYS,
} from './types/billingRecord';
import { LineItem, createLineItemId } from '../../billing/types/lineItem';

/**
 * GCP Billing Processor Configuration
 */
export interface GCPBillingProcessorConfig {
    /** Project ID filter */
    projectId?: string;
    /** Service ID filter */
    serviceIds?: string[];
    /** Minimum cost to include (filters noise) */
    minCost?: number;
    /** Whether to use mock data */
    useMockData?: boolean;
}

/**
 * BigQuery query options
 */
export interface BigQueryOptions {
    /** BigQuery dataset containing billing export */
    dataset: string;
    /** Table name (or pattern) */
    table: string;
    /** Period to query (YYYY-MM) */
    period: string;
}

/**
 * GCP Billing Processor - Processes GCP billing data
 */
export class GCPBillingProcessor {
    private config: GCPBillingProcessorConfig;

    constructor(config: GCPBillingProcessorConfig = {}) {
        this.config = {
            minCost: 0.0001, // Filter out tiny costs
            useMockData: false,
            ...config,
        };
    }

    /**
     * Process billing records for a period
     */
    async processPeriod(
        period: string,
        records?: GCPBillingRecord[]
    ): Promise<LineItem[]> {
        // Use provided records or fetch from BigQuery
        const billingRecords = records || await this.fetchBillingRecords(period);

        // Convert to simplified format
        const simplified = billingRecords.map(r => simplifyGCPRecord(r));

        // Filter records
        const filtered = this.filterRecords(simplified);

        // Convert to line items
        const lineItems = this.convertToLineItems(filtered, period);

        return lineItems;
    }

    /**
     * Fetch billing records from BigQuery (placeholder - would use @google-cloud/bigquery)
     */
    private async fetchBillingRecords(period: string): Promise<GCPBillingRecord[]> {
        // In production, this would query BigQuery:
        // const bigquery = new BigQuery();
        // const query = `SELECT * FROM \`project.dataset.gcp_billing_export_v1_*\` WHERE ...`;
        // const [rows] = await bigquery.query(query);
        
        console.warn('BigQuery integration not implemented - use mock data or provide records');
        return [];
    }

    /**
     * Filter billing records
     */
    private filterRecords(records: SimplifiedGCPRecord[]): SimplifiedGCPRecord[] {
        return records.filter(record => {
            // Filter by minimum cost
            if (this.config.minCost && record.costUsd < this.config.minCost) {
                return false;
            }

            // Filter by project
            if (this.config.projectId && record.projectId !== this.config.projectId) {
                return false;
            }

            // Filter by service
            if (this.config.serviceIds && this.config.serviceIds.length > 0) {
                if (!this.config.serviceIds.includes(record.serviceId)) {
                    return false;
                }
            }

            return true;
        });
    }

    /**
     * Convert simplified records to line items
     */
    private convertToLineItems(
        records: SimplifiedGCPRecord[],
        period: string
    ): LineItem[] {
        return records.map((record, index) => {
            const serviceName = this.normalizeServiceName(record.serviceName);

            return {
                id: createLineItemId('real', 'gcp', serviceName, period, `${index}`),
                source: 'real',
                period,
                provider: 'gcp',
                service: serviceName,
                sku: record.skuId,
                description: record.skuDescription,
                tenantId: record.tenantId,
                feature: record.feature,
                environment: record.environment,
                labels: record.labels,
                quantity: record.usageAmount,
                unit: record.usageUnit,
                totalCost: record.costUsd,
                currency: 'USD',
                billingRecordId: `${record.serviceId}-${record.skuId}-${record.usageStartTime}`,
                usageStartTime: record.usageStartTime,
                usageEndTime: record.usageEndTime,
                createdAt: new Date().toISOString(),
                metadata: {
                    projectId: record.projectId,
                    region: record.region,
                    serviceId: record.serviceId,
                    skuId: record.skuId,
                },
            };
        });
    }

    /**
     * Normalize service name for matching with rate cards
     */
    private normalizeServiceName(serviceName: string): string {
        const mapping: Record<string, string> = {
            'Cloud Run': 'cloud-run',
            'Firestore': 'firestore',
            'Cloud Storage': 'cloud-storage',
            'BigQuery': 'bigquery',
            'Compute Engine': 'compute-engine',
            'Cloud Functions': 'cloud-functions',
            'Pub/Sub': 'pubsub',
        };

        return mapping[serviceName] || serviceName.toLowerCase().replace(/\s+/g, '-');
    }

    /**
     * Aggregate line items by service
     */
    aggregateByService(lineItems: LineItem[]): Map<string, number> {
        const aggregation = new Map<string, number>();

        for (const item of lineItems) {
            const current = aggregation.get(item.service) || 0;
            aggregation.set(item.service, current + item.totalCost);
        }

        return aggregation;
    }

    /**
     * Aggregate line items by tenant
     */
    aggregateByTenant(lineItems: LineItem[]): Map<string, number> {
        const aggregation = new Map<string, number>();

        for (const item of lineItems) {
            const tenantId = item.tenantId || '_unattributed';
            const current = aggregation.get(tenantId) || 0;
            aggregation.set(tenantId, current + item.totalCost);
        }

        return aggregation;
    }
}

/**
 * Create a GCP billing processor with default configuration
 */
export function createGCPProcessor(config?: GCPBillingProcessorConfig): GCPBillingProcessor {
    return new GCPBillingProcessor(config);
}

