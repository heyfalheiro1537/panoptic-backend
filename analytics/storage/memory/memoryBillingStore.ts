/**
 * Memory Billing Store for Development
 * 
 * In-memory implementation of the billing store.
 * Useful for development and testing without a database.
 */

import { IBillingStore } from '../interfaces';
import { GCPBillingRecord } from '../../providers/gcp/types/billingRecord';

/**
 * Memory Billing Store
 */
export class MemoryBillingStore implements IBillingStore {
    private records: GCPBillingRecord[] = [];
    private byPeriod: Map<string, GCPBillingRecord[]> = new Map();

    /**
     * Extract period from billing record
     */
    private getPeriod(record: GCPBillingRecord): string {
        const date = new Date(record.usage_start_time);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        return `${year}-${month}`;
    }

    /**
     * Save a billing record
     */
    async save(record: GCPBillingRecord): Promise<void> {
        this.records.push(record);

        // Index by period
        const period = this.getPeriod(record);
        if (!this.byPeriod.has(period)) {
            this.byPeriod.set(period, []);
        }
        this.byPeriod.get(period)!.push(record);
    }

    /**
     * Save multiple billing records
     */
    async saveBatch(records: GCPBillingRecord[]): Promise<void> {
        for (const record of records) {
            await this.save(record);
        }
    }

    /**
     * Get billing records for a period
     */
    async getByPeriod(period: string): Promise<GCPBillingRecord[]> {
        return this.byPeriod.get(period) || [];
    }

    /**
     * Get billing records by service
     */
    async getByService(period: string, serviceId: string): Promise<GCPBillingRecord[]> {
        const periodRecords = await this.getByPeriod(period);
        return periodRecords.filter(r => r.service.id === serviceId);
    }

    /**
     * Get total cost for a period
     */
    async getTotalCost(period: string): Promise<number> {
        const records = await this.getByPeriod(period);
        return records.reduce((sum, r) => sum + r.cost, 0);
    }

    /**
     * Check if billing data exists for a period
     */
    async hasPeriod(period: string): Promise<boolean> {
        return this.byPeriod.has(period) && (this.byPeriod.get(period)?.length || 0) > 0;
    }

    /**
     * Delete billing records for a period
     */
    async deletePeriod(period: string): Promise<number> {
        const periodRecords = this.byPeriod.get(period);
        if (!periodRecords) {
            return 0;
        }

        const count = periodRecords.length;
        
        // Remove from main array
        this.records = this.records.filter(r => this.getPeriod(r) !== period);
        
        // Remove from index
        this.byPeriod.delete(period);

        return count;
    }

    /**
     * Clear all records (for testing)
     */
    clear(): void {
        this.records = [];
        this.byPeriod.clear();
    }

    /**
     * Get store size (for debugging)
     */
    size(): number {
        return this.records.length;
    }

    /**
     * Get all periods with data
     */
    getPeriods(): string[] {
        return Array.from(this.byPeriod.keys()).sort().reverse();
    }
}

/**
 * Create a memory billing store
 */
export function createMemoryBillingStore(): MemoryBillingStore {
    return new MemoryBillingStore();
}

