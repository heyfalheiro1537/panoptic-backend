/**
 * Memory Calibration Store for Development
 * 
 * In-memory implementation of the calibration store.
 * Useful for development and testing without a database.
 */

import { ICalibrationStore } from '../interfaces';
import { CalibrationData } from '../../pricing/types/rateCard';

/**
 * Memory Calibration Store
 */
export class MemoryCalibrationStore implements ICalibrationStore {
    private byRateCard: Map<string, CalibrationData[]> = new Map();
    private byPeriod: Map<string, CalibrationData[]> = new Map();

    /**
     * Save calibration data
     */
    async save(data: CalibrationData): Promise<void> {
        // Store by rate card
        if (!this.byRateCard.has(data.rateCardId)) {
            this.byRateCard.set(data.rateCardId, []);
        }
        this.byRateCard.get(data.rateCardId)!.push(data);

        // Store by period
        if (!this.byPeriod.has(data.period)) {
            this.byPeriod.set(data.period, []);
        }
        this.byPeriod.get(data.period)!.push(data);
    }

    /**
     * Get calibration history for a rate card
     */
    async getHistory(rateCardId: string, limit?: number): Promise<CalibrationData[]> {
        const history = this.byRateCard.get(rateCardId) || [];
        
        // Sort by period descending
        const sorted = [...history].sort((a, b) => b.period.localeCompare(a.period));
        
        return limit ? sorted.slice(0, limit) : sorted;
    }

    /**
     * Get latest calibration for a rate card
     */
    async getLatest(rateCardId: string): Promise<CalibrationData | null> {
        const history = await this.getHistory(rateCardId, 1);
        return history[0] || null;
    }

    /**
     * Get all calibration data for a period
     */
    async getByPeriod(period: string): Promise<CalibrationData[]> {
        return this.byPeriod.get(period) || [];
    }

    /**
     * Delete old calibration data
     */
    async deleteOlderThan(date: Date): Promise<number> {
        const threshold = date.toISOString().slice(0, 7); // YYYY-MM
        let deleted = 0;

        // Clean up byRateCard
        for (const [rateCardId, history] of this.byRateCard) {
            const filtered = history.filter(d => d.period >= threshold);
            deleted += history.length - filtered.length;
            this.byRateCard.set(rateCardId, filtered);
        }

        // Clean up byPeriod
        for (const [period] of this.byPeriod) {
            if (period < threshold) {
                this.byPeriod.delete(period);
            }
        }

        return deleted;
    }

    /**
     * Clear all calibration data (for testing)
     */
    clear(): void {
        this.byRateCard.clear();
        this.byPeriod.clear();
    }

    /**
     * Get all rate cards with calibration data
     */
    getRateCardIds(): string[] {
        return Array.from(this.byRateCard.keys());
    }

    /**
     * Get all periods with calibration data
     */
    getPeriods(): string[] {
        return Array.from(this.byPeriod.keys()).sort().reverse();
    }
}

/**
 * Create a memory calibration store
 */
export function createMemoryCalibrationStore(): MemoryCalibrationStore {
    return new MemoryCalibrationStore();
}

