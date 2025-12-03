/**
 * Mock BigQuery Data for Development
 * 
 * Generates realistic GCP billing records for testing
 * without requiring access to real BigQuery billing export.
 */

import {
    GCPBillingRecord,
    GCPLabel,
    GCP_SERVICE_IDS,
} from './types/billingRecord';
import { getPeriodBounds } from '../../types/operation';

/**
 * Mock BigQuery Configuration
 */
export interface MockBigQueryConfig {
    /** Project ID */
    projectId?: string;
    /** Tenant IDs to simulate */
    tenantIds?: string[];
    /** Features to simulate */
    features?: string[];
    /** Multiply costs by this factor */
    costMultiplier?: number;
    /** Random seed for reproducible data */
    seed?: number;
}

/**
 * Simple random number generator with seed
 */
class SeededRandom {
    private seed: number;

    constructor(seed: number = Date.now()) {
        this.seed = seed;
    }

    next(): number {
        this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
        return this.seed / 0x7fffffff;
    }

    nextInt(min: number, max: number): number {
        return Math.floor(this.next() * (max - min + 1)) + min;
    }

    nextFloat(min: number, max: number): number {
        return min + this.next() * (max - min);
    }

    pick<T>(array: T[]): T {
        return array[this.nextInt(0, array.length - 1)];
    }
}

/**
 * Mock BigQuery Simulator - Generates fake GCP billing data
 */
export class MockBigQuerySimulator {
    private config: MockBigQueryConfig;
    private random: SeededRandom;

    constructor(config: MockBigQueryConfig = {}) {
        this.config = {
            projectId: 'mock-project',
            tenantIds: ['tenant-acme', 'tenant-beta', 'tenant-gamma'],
            features: ['api-server', 'reporting', 'payments', 'notifications'],
            costMultiplier: 1.0,
            ...config,
        };
        this.random = new SeededRandom(config.seed);
    }

    /**
     * Generate billing records for a period
     */
    generateBillingRecords(period: string): GCPBillingRecord[] {
        const records: GCPBillingRecord[] = [];
        const bounds = getPeriodBounds(period);
        const startDate = new Date(bounds.start);
        const endDate = new Date(bounds.end);

        // Generate Cloud Run records
        records.push(...this.generateCloudRunRecords(period, startDate, endDate));

        // Generate Firestore records
        records.push(...this.generateFirestoreRecords(period, startDate, endDate));

        // Generate Cloud Storage records
        records.push(...this.generateStorageRecords(period, startDate, endDate));

        return records;
    }

    /**
     * Generate Cloud Run billing records
     */
    private generateCloudRunRecords(
        period: string,
        startDate: Date,
        endDate: Date
    ): GCPBillingRecord[] {
        const records: GCPBillingRecord[] = [];
        const daysInMonth = this.getDaysInMonth(startDate);

        // Generate daily records for each SKU
        for (let day = 1; day <= daysInMonth; day++) {
            const usageDate = new Date(startDate.getFullYear(), startDate.getMonth(), day);
            const nextDate = new Date(usageDate.getTime() + 86400000);

            // CPU Allocation Time
            for (const tenantId of this.config.tenantIds!) {
                for (const feature of this.config.features!) {
                    // CPU seconds (0.25-2 vCPU-hours per day = 900-7200 seconds)
                    const cpuSeconds = this.random.nextFloat(900, 7200);
                    const cpuCost = cpuSeconds * 0.00002400 * this.config.costMultiplier!;

                    records.push(this.createRecord({
                        serviceId: GCP_SERVICE_IDS.CLOUD_RUN,
                        serviceName: 'Cloud Run',
                        skuId: 'CPU-ALLOCATION',
                        skuDescription: 'CPU Allocation Time',
                        usageAmount: cpuSeconds,
                        usageUnit: 'seconds',
                        cost: cpuCost,
                        usageStartTime: usageDate.toISOString(),
                        usageEndTime: nextDate.toISOString(),
                        tenantId,
                        feature,
                    }));

                    // Memory GiB-seconds (0.5-4 GiB-hours = 1800-14400 GiB-seconds)
                    const memoryGbSeconds = this.random.nextFloat(1800, 14400);
                    const memoryCost = memoryGbSeconds * 0.00000250 * this.config.costMultiplier!;

                    records.push(this.createRecord({
                        serviceId: GCP_SERVICE_IDS.CLOUD_RUN,
                        serviceName: 'Cloud Run',
                        skuId: 'MEMORY-ALLOCATION',
                        skuDescription: 'Memory Allocation Time',
                        usageAmount: memoryGbSeconds,
                        usageUnit: 'gibibyte second',
                        cost: memoryCost,
                        usageStartTime: usageDate.toISOString(),
                        usageEndTime: nextDate.toISOString(),
                        tenantId,
                        feature,
                    }));

                    // Requests (1000-50000 per day)
                    const requests = this.random.nextInt(1000, 50000);
                    const requestCost = (requests / 1000000) * 0.40 * this.config.costMultiplier!;

                    records.push(this.createRecord({
                        serviceId: GCP_SERVICE_IDS.CLOUD_RUN,
                        serviceName: 'Cloud Run',
                        skuId: 'REQUESTS',
                        skuDescription: 'Requests',
                        usageAmount: requests,
                        usageUnit: 'requests',
                        cost: requestCost,
                        usageStartTime: usageDate.toISOString(),
                        usageEndTime: nextDate.toISOString(),
                        tenantId,
                        feature,
                    }));
                }
            }
        }

        return records;
    }

    /**
     * Generate Firestore billing records
     */
    private generateFirestoreRecords(
        period: string,
        startDate: Date,
        endDate: Date
    ): GCPBillingRecord[] {
        const records: GCPBillingRecord[] = [];
        const daysInMonth = this.getDaysInMonth(startDate);

        for (let day = 1; day <= daysInMonth; day++) {
            const usageDate = new Date(startDate.getFullYear(), startDate.getMonth(), day);
            const nextDate = new Date(usageDate.getTime() + 86400000);

            for (const tenantId of this.config.tenantIds!) {
                for (const feature of this.config.features!) {
                    // Document reads (10000-500000 per day)
                    const reads = this.random.nextInt(10000, 500000);
                    const readCost = (reads / 100000) * 0.036 * this.config.costMultiplier!;

                    records.push(this.createRecord({
                        serviceId: GCP_SERVICE_IDS.FIRESTORE,
                        serviceName: 'Firestore',
                        skuId: 'DOCUMENT-READS',
                        skuDescription: 'Document Reads',
                        usageAmount: reads,
                        usageUnit: 'count',
                        cost: readCost,
                        usageStartTime: usageDate.toISOString(),
                        usageEndTime: nextDate.toISOString(),
                        tenantId,
                        feature,
                    }));

                    // Document writes (1000-50000 per day)
                    const writes = this.random.nextInt(1000, 50000);
                    const writeCost = (writes / 100000) * 0.108 * this.config.costMultiplier!;

                    records.push(this.createRecord({
                        serviceId: GCP_SERVICE_IDS.FIRESTORE,
                        serviceName: 'Firestore',
                        skuId: 'DOCUMENT-WRITES',
                        skuDescription: 'Document Writes',
                        usageAmount: writes,
                        usageUnit: 'count',
                        cost: writeCost,
                        usageStartTime: usageDate.toISOString(),
                        usageEndTime: nextDate.toISOString(),
                        tenantId,
                        feature,
                    }));
                }
            }
        }

        // Monthly storage record
        for (const tenantId of this.config.tenantIds!) {
            const storageGb = this.random.nextFloat(0.5, 10);
            const storageCost = storageGb * 0.108 * this.config.costMultiplier!;

            records.push(this.createRecord({
                serviceId: GCP_SERVICE_IDS.FIRESTORE,
                serviceName: 'Firestore',
                skuId: 'STORAGE',
                skuDescription: 'Storage',
                usageAmount: storageGb,
                usageUnit: 'gibibyte month',
                cost: storageCost,
                usageStartTime: startDate.toISOString(),
                usageEndTime: endDate.toISOString(),
                tenantId,
                feature: '_storage',
            }));
        }

        return records;
    }

    /**
     * Generate Cloud Storage billing records
     */
    private generateStorageRecords(
        period: string,
        startDate: Date,
        endDate: Date
    ): GCPBillingRecord[] {
        const records: GCPBillingRecord[] = [];

        for (const tenantId of this.config.tenantIds!) {
            // Monthly storage (1-50 GB)
            const storageGb = this.random.nextFloat(1, 50);
            const storageCost = storageGb * 0.020 * this.config.costMultiplier!;

            records.push(this.createRecord({
                serviceId: GCP_SERVICE_IDS.CLOUD_STORAGE,
                serviceName: 'Cloud Storage',
                skuId: 'STANDARD-STORAGE',
                skuDescription: 'Standard Storage',
                usageAmount: storageGb,
                usageUnit: 'gibibyte month',
                cost: storageCost,
                usageStartTime: startDate.toISOString(),
                usageEndTime: endDate.toISOString(),
                tenantId,
                feature: '_storage',
            }));

            // Class A operations (1000-100000 per month)
            const classAOps = this.random.nextInt(1000, 100000);
            const classACost = (classAOps / 10000) * 0.05 * this.config.costMultiplier!;

            records.push(this.createRecord({
                serviceId: GCP_SERVICE_IDS.CLOUD_STORAGE,
                serviceName: 'Cloud Storage',
                skuId: 'CLASS-A-OPS',
                skuDescription: 'Class A Operations',
                usageAmount: classAOps,
                usageUnit: 'count',
                cost: classACost,
                usageStartTime: startDate.toISOString(),
                usageEndTime: endDate.toISOString(),
                tenantId,
                feature: '_storage',
            }));

            // Class B operations (10000-1000000 per month)
            const classBOps = this.random.nextInt(10000, 1000000);
            const classBCost = (classBOps / 10000) * 0.004 * this.config.costMultiplier!;

            records.push(this.createRecord({
                serviceId: GCP_SERVICE_IDS.CLOUD_STORAGE,
                serviceName: 'Cloud Storage',
                skuId: 'CLASS-B-OPS',
                skuDescription: 'Class B Operations',
                usageAmount: classBOps,
                usageUnit: 'count',
                cost: classBCost,
                usageStartTime: startDate.toISOString(),
                usageEndTime: endDate.toISOString(),
                tenantId,
                feature: '_storage',
            }));

            // Network egress (0.1-5 GB per month)
            const egressGb = this.random.nextFloat(0.1, 5);
            const egressCost = egressGb * 0.12 * this.config.costMultiplier!;

            records.push(this.createRecord({
                serviceId: GCP_SERVICE_IDS.CLOUD_STORAGE,
                serviceName: 'Cloud Storage',
                skuId: 'NETWORK-EGRESS',
                skuDescription: 'Network Egress',
                usageAmount: egressGb,
                usageUnit: 'gibibyte',
                cost: egressCost,
                usageStartTime: startDate.toISOString(),
                usageEndTime: endDate.toISOString(),
                tenantId,
                feature: '_storage',
            }));
        }

        return records;
    }

    /**
     * Create a billing record
     */
    private createRecord(params: {
        serviceId: string;
        serviceName: string;
        skuId: string;
        skuDescription: string;
        usageAmount: number;
        usageUnit: string;
        cost: number;
        usageStartTime: string;
        usageEndTime: string;
        tenantId: string;
        feature: string;
    }): GCPBillingRecord {
        const labels: GCPLabel[] = [
            { key: 'tenant_id', value: params.tenantId },
            { key: 'feature', value: params.feature },
            { key: 'env', value: 'production' },
        ];

        return {
            billing_account_id: 'MOCK-BILLING-ACCOUNT',
            service: {
                id: params.serviceId,
                description: params.serviceName,
            },
            sku: {
                id: params.skuId,
                description: params.skuDescription,
            },
            usage_start_time: params.usageStartTime,
            usage_end_time: params.usageEndTime,
            project: {
                id: this.config.projectId!,
                name: this.config.projectId!,
                number: '123456789',
                labels: {},
            },
            labels,
            system_labels: [],
            location: {
                location: 'us-central1',
                country: 'US',
                region: 'us-central1',
            },
            usage: {
                amount: params.usageAmount,
                unit: params.usageUnit,
                amount_in_pricing_units: params.usageAmount,
                pricing_unit: params.usageUnit,
            },
            credits: [],
            cost: params.cost,
            currency: 'USD',
            cost_type: 'regular',
            export_time: new Date().toISOString(),
        };
    }

    /**
     * Get days in month
     */
    private getDaysInMonth(date: Date): number {
        return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    }
}

/**
 * Generate mock billing records for a period
 */
export function generateMockBillingRecords(
    period: string,
    config?: MockBigQueryConfig
): GCPBillingRecord[] {
    const simulator = new MockBigQuerySimulator(config);
    return simulator.generateBillingRecords(period);
}

/**
 * Create a mock BigQuery simulator
 */
export function createMockBigQuery(config?: MockBigQueryConfig): MockBigQuerySimulator {
    return new MockBigQuerySimulator(config);
}

