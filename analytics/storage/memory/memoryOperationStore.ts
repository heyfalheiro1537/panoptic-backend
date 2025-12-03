/**
 * Memory Operation Store for Development
 * 
 * In-memory implementation of the operation store.
 * Useful for development and testing without a database.
 */

import { IOperationStore } from '../interfaces';
import { OperationRecord, OperationQueryOptions, getPeriodFromTimestamp, getPeriodBounds } from '../../types/operation';

/**
 * Memory Operation Store
 */
export class MemoryOperationStore implements IOperationStore {
    private operations: Map<string, OperationRecord> = new Map();
    private byPeriod: Map<string, Set<string>> = new Map();

    /**
     * Save an operation record
     */
    async save(operation: OperationRecord): Promise<void> {
        this.operations.set(operation.id, operation);

        // Index by period
        const period = getPeriodFromTimestamp(operation.timestamp);
        if (!this.byPeriod.has(period)) {
            this.byPeriod.set(period, new Set());
        }
        this.byPeriod.get(period)!.add(operation.id);
    }

    /**
     * Save multiple operation records
     */
    async saveBatch(operations: OperationRecord[]): Promise<void> {
        for (const op of operations) {
            await this.save(op);
        }
    }

    /**
     * Get operations for a billing period
     */
    async getByPeriod(period: string): Promise<OperationRecord[]> {
        const ids = this.byPeriod.get(period);
        if (!ids) {
            return [];
        }

        return Array.from(ids)
            .map(id => this.operations.get(id))
            .filter((op): op is OperationRecord => op !== undefined);
    }

    /**
     * Query operations with filters
     */
    async query(options: OperationQueryOptions): Promise<OperationRecord[]> {
        const startTime = new Date(options.startTime).getTime();
        const endTime = new Date(options.endTime).getTime();

        let results = Array.from(this.operations.values()).filter(op => {
            const opTime = new Date(op.timestamp).getTime();
            return opTime >= startTime && opTime <= endTime;
        });

        // Apply filters
        if (options.provider) {
            results = results.filter(op => 
                String(op.provider).toLowerCase() === options.provider!.toLowerCase()
            );
        }

        if (options.service) {
            results = results.filter(op => 
                op.service?.toLowerCase() === options.service!.toLowerCase()
            );
        }

        if (options.tenantId) {
            results = results.filter(op => op.tenantId === options.tenantId);
        }

        if (options.feature) {
            results = results.filter(op => op.feature === options.feature);
        }

        if (options.environment) {
            results = results.filter(op => op.environment === options.environment);
        }

        if (options.status) {
            results = results.filter(op => op.status === options.status);
        }

        // Apply limit
        if (options.limit && results.length > options.limit) {
            results = results.slice(0, options.limit);
        }

        return results;
    }

    /**
     * Get operation count for a period
     */
    async count(period: string): Promise<number> {
        return this.byPeriod.get(period)?.size || 0;
    }

    /**
     * Delete operations older than a date
     */
    async deleteOlderThan(date: Date): Promise<number> {
        const threshold = date.getTime();
        let deleted = 0;

        for (const [id, op] of this.operations) {
            if (new Date(op.timestamp).getTime() < threshold) {
                this.operations.delete(id);
                deleted++;

                // Remove from period index
                const period = getPeriodFromTimestamp(op.timestamp);
                this.byPeriod.get(period)?.delete(id);
            }
        }

        // Clean up empty period sets
        for (const [period, ids] of this.byPeriod) {
            if (ids.size === 0) {
                this.byPeriod.delete(period);
            }
        }

        return deleted;
    }

    /**
     * Clear all operations (for testing)
     */
    clear(): void {
        this.operations.clear();
        this.byPeriod.clear();
    }

    /**
     * Get store size (for debugging)
     */
    size(): number {
        return this.operations.size;
    }
}

/**
 * Create a memory operation store
 */
export function createMemoryOperationStore(): MemoryOperationStore {
    return new MemoryOperationStore();
}

