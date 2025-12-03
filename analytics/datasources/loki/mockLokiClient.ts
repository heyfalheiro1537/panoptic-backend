/**
 * Mock Loki Client for Development
 * 
 * Generates fake operation data for testing the billing system
 * without requiring a real Loki instance.
 */

import { OperationRecord, OperationQueryOptions, getPeriodBounds } from '../../types/operation';
import { Providers, ProvidersType } from '../../../sdk/types/providers';

/**
 * Mock Loki Client Configuration
 */
export interface MockLokiConfig {
    /** Number of operations to generate per service */
    operationsPerService?: number;
    /** Tenant IDs to use */
    tenantIds?: string[];
    /** Features to use */
    features?: string[];
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

    pick<T>(array: T[]): T {
        return array[this.nextInt(0, array.length - 1)];
    }
}

/**
 * Mock Loki Client - Generates fake operation data
 */
export class MockLokiClient {
    private config: MockLokiConfig;
    private random: SeededRandom;

    constructor(config: MockLokiConfig = {}) {
        this.config = {
            operationsPerService: 100,
            tenantIds: ['tenant-acme', 'tenant-beta', 'tenant-gamma'],
            features: ['api-server', 'reporting', 'payments', 'notifications'],
            ...config,
        };
        this.random = new SeededRandom(config.seed);
    }

    /**
     * Query operations for a period (returns mock data)
     */
    async queryOperations(options: OperationQueryOptions): Promise<OperationRecord[]> {
        const operations: OperationRecord[] = [];
        const startDate = new Date(options.startTime);
        const endDate = new Date(options.endTime);

        // Generate Cloud Run operations
        operations.push(...this.generateCloudRunOperations(startDate, endDate, options));

        // Generate Firestore operations
        operations.push(...this.generateFirestoreOperations(startDate, endDate, options));

        // Generate Cloud Storage operations
        operations.push(...this.generateStorageOperations(startDate, endDate, options));

        // Apply filters
        let filtered = operations;

        if (options.provider) {
            filtered = filtered.filter(op => 
                String(op.provider).toLowerCase().includes(options.provider!.toLowerCase())
            );
        }

        if (options.service) {
            filtered = filtered.filter(op => 
                op.service?.toLowerCase() === options.service!.toLowerCase()
            );
        }

        if (options.tenantId) {
            filtered = filtered.filter(op => op.tenantId === options.tenantId);
        }

        if (options.feature) {
            filtered = filtered.filter(op => op.feature === options.feature);
        }

        // Apply limit
        if (options.limit && filtered.length > options.limit) {
            filtered = filtered.slice(0, options.limit);
        }

        return filtered;
    }

    /**
     * Query operations for a billing period
     */
    async queryPeriod(period: string, filter?: Partial<OperationQueryOptions>): Promise<OperationRecord[]> {
        const bounds = getPeriodBounds(period);
        
        return this.queryOperations({
            startTime: bounds.start,
            endTime: bounds.end,
            ...filter,
        });
    }

    /**
     * Generate Cloud Run operations
     */
    private generateCloudRunOperations(
        startDate: Date,
        endDate: Date,
        options: OperationQueryOptions
    ): OperationRecord[] {
        const operations: OperationRecord[] = [];
        const count = this.config.operationsPerService!;

        for (let i = 0; i < count; i++) {
            const timestamp = this.randomTimestamp(startDate, endDate);
            const durationMs = this.random.nextInt(50, 5000);
            const cpuSeconds = durationMs / 1000 * (this.random.nextInt(1, 4) / 4); // 0.25-1 vCPU
            const memoryGbSeconds = durationMs / 1000 * (this.random.nextInt(128, 2048) / 1024); // 128MB-2GB

            operations.push({
                id: `mock-cloudrun-${i}-${timestamp.getTime()}`,
                timestamp: timestamp.toISOString(),
                projectId: 'mock-project',
                environment: 'production',
                category: ProvidersType.INFRA,
                provider: Providers.GOOGLE,
                service: 'cloud-run',
                resource: this.random.pick(['api-handler', 'worker', 'webhook', 'cron-job']),
                durationMs,
                requestCount: 1,
                tenantId: this.random.pick(this.config.tenantIds!),
                feature: this.random.pick(this.config.features!),
                status: this.random.next() > 0.02 ? 'success' : 'error',
                cpuUsage: {
                    seconds: cpuSeconds,
                },
                memoryUsage: {
                    gbSeconds: memoryGbSeconds,
                },
                dataTransfer: {
                    egress: this.random.nextInt(1000, 100000), // 1KB - 100KB
                },
            });
        }

        return operations;
    }

    /**
     * Generate Firestore operations
     */
    private generateFirestoreOperations(
        startDate: Date,
        endDate: Date,
        options: OperationQueryOptions
    ): OperationRecord[] {
        const operations: OperationRecord[] = [];
        const count = this.config.operationsPerService!;

        for (let i = 0; i < count; i++) {
            const timestamp = this.randomTimestamp(startDate, endDate);
            const opType = this.random.pick(['read', 'write', 'delete']);
            
            const reads = opType === 'read' ? this.random.nextInt(1, 100) : 0;
            const writes = opType === 'write' ? this.random.nextInt(1, 50) : 0;
            const deletes = opType === 'delete' ? this.random.nextInt(1, 20) : 0;

            operations.push({
                id: `mock-firestore-${i}-${timestamp.getTime()}`,
                timestamp: timestamp.toISOString(),
                projectId: 'mock-project',
                environment: 'production',
                category: ProvidersType.INFRA,
                provider: Providers.GOOGLE,
                service: 'firestore',
                resource: this.random.pick(['users', 'orders', 'products', 'sessions']),
                durationMs: this.random.nextInt(5, 200),
                requestCount: 1,
                tenantId: this.random.pick(this.config.tenantIds!),
                feature: this.random.pick(this.config.features!),
                status: 'success',
                storageOps: {
                    reads,
                    writes,
                    deletes,
                },
            });
        }

        return operations;
    }

    /**
     * Generate Cloud Storage operations
     */
    private generateStorageOperations(
        startDate: Date,
        endDate: Date,
        options: OperationQueryOptions
    ): OperationRecord[] {
        const operations: OperationRecord[] = [];
        const count = Math.floor(this.config.operationsPerService! / 2); // Fewer storage ops

        for (let i = 0; i < count; i++) {
            const timestamp = this.randomTimestamp(startDate, endDate);
            const isWrite = this.random.next() > 0.7; // 30% writes, 70% reads

            operations.push({
                id: `mock-storage-${i}-${timestamp.getTime()}`,
                timestamp: timestamp.toISOString(),
                projectId: 'mock-project',
                environment: 'production',
                category: ProvidersType.INFRA,
                provider: Providers.GOOGLE,
                service: 'cloud-storage',
                resource: this.random.pick(['uploads', 'exports', 'backups', 'assets']),
                durationMs: this.random.nextInt(100, 2000),
                requestCount: 1,
                tenantId: this.random.pick(this.config.tenantIds!),
                feature: this.random.pick(this.config.features!),
                status: 'success',
                storageOps: {
                    reads: isWrite ? 0 : this.random.nextInt(1, 10),
                    writes: isWrite ? this.random.nextInt(1, 5) : 0,
                },
                dataTransfer: {
                    egress: this.random.nextInt(10000, 10000000), // 10KB - 10MB
                },
            });
        }

        return operations;
    }

    /**
     * Generate a random timestamp within a range
     */
    private randomTimestamp(start: Date, end: Date): Date {
        const startMs = start.getTime();
        const endMs = end.getTime();
        const randomMs = startMs + this.random.next() * (endMs - startMs);
        return new Date(randomMs);
    }

    /**
     * Test connection (always succeeds for mock)
     */
    async testConnection(): Promise<boolean> {
        return true;
    }
}

/**
 * Create a mock Loki client with default configuration
 */
export function createMockLokiClient(seed?: number): MockLokiClient {
    return new MockLokiClient({ seed });
}

