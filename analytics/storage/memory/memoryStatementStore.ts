/**
 * Memory Statement Store for Development
 * 
 * In-memory implementation of the statement store.
 * Useful for development and testing without a database.
 */

import { IStatementStore } from '../interfaces';
import { CostStatement } from '../../billing/types/statement';

/**
 * Memory Statement Store
 */
export class MemoryStatementStore implements IStatementStore {
    private statements: Map<string, CostStatement> = new Map();

    /**
     * Save a cost statement
     */
    async save(statement: CostStatement): Promise<void> {
        this.statements.set(statement.period, statement);
    }

    /**
     * Get a statement by period
     */
    async get(period: string): Promise<CostStatement | null> {
        return this.statements.get(period) || null;
    }

    /**
     * Get the most recent statement
     */
    async getLatest(): Promise<CostStatement | null> {
        const periods = Array.from(this.statements.keys()).sort().reverse();
        if (periods.length === 0) {
            return null;
        }
        return this.statements.get(periods[0]) || null;
    }

    /**
     * List all statements
     */
    async list(options?: { limit?: number; offset?: number }): Promise<CostStatement[]> {
        const { limit, offset = 0 } = options || {};
        
        const sorted = Array.from(this.statements.values())
            .sort((a, b) => b.period.localeCompare(a.period));

        const start = offset;
        const end = limit ? offset + limit : undefined;

        return sorted.slice(start, end);
    }

    /**
     * List statement periods
     */
    async listPeriods(): Promise<string[]> {
        return Array.from(this.statements.keys()).sort().reverse();
    }

    /**
     * Delete a statement
     */
    async delete(period: string): Promise<boolean> {
        return this.statements.delete(period);
    }

    /**
     * Check if statement exists
     */
    async exists(period: string): Promise<boolean> {
        return this.statements.has(period);
    }

    /**
     * Clear all statements (for testing)
     */
    clear(): void {
        this.statements.clear();
    }

    /**
     * Get store size (for debugging)
     */
    size(): number {
        return this.statements.size;
    }
}

/**
 * Create a memory statement store
 */
export function createMemoryStatementStore(): MemoryStatementStore {
    return new MemoryStatementStore();
}

