/**
 * Rate Card Registry for Panoptic Billing System
 * 
 * Central registry for managing rate cards. Supports registration,
 * lookup, and lifecycle management of pricing definitions.
 */

import {
    RateCard,
    CalibrationData,
    CalibrationConfig,
    DEFAULT_CALIBRATION_CONFIG,
} from '../types/rateCard';

/**
 * Rate Card Registry Interface
 */
export interface IRateCardRegistry {
    /** Register a rate card */
    register(card: RateCard): void;

    /** Find a rate card by provider and service */
    find(provider: string, service: string, sku?: string): RateCard | undefined;

    /** Find a rate card by ID */
    findById(id: string): RateCard | undefined;

    /** List all rate cards */
    list(): RateCard[];

    /** List rate cards for a provider */
    listFor(provider: string): RateCard[];

    /** Remove a rate card */
    remove(id: string): boolean;

    /** Clear all rate cards */
    clear(): void;

    /** Update calibration multiplier for a rate card */
    calibrate(id: string, multiplier: number): boolean;

    /** Get calibration history for a rate card */
    getCalibrationHistory(id: string): CalibrationData[];

    /** Add calibration data point */
    addCalibrationData(data: CalibrationData): void;
}

/**
 * Rate Card Registry Implementation
 */
export class RateCardRegistry implements IRateCardRegistry {
    /** Rate cards indexed by ID */
    private cardsById: Map<string, RateCard> = new Map();

    /** Rate cards indexed by provider:service:sku */
    private cardsByKey: Map<string, RateCard> = new Map();

    /** Calibration history by rate card ID */
    private calibrationHistory: Map<string, CalibrationData[]> = new Map();

    /** Calibration configuration */
    private calibrationConfig: CalibrationConfig;

    constructor(config?: Partial<CalibrationConfig>) {
        this.calibrationConfig = { ...DEFAULT_CALIBRATION_CONFIG, ...config };
    }

    /**
     * Generate lookup key for a rate card
     */
    private generateKey(provider: string, service: string, sku?: string): string {
        const normalizedProvider = provider.toLowerCase();
        const normalizedService = service.toLowerCase();
        const normalizedSku = sku?.toLowerCase() || '*';
        return `${normalizedProvider}:${normalizedService}:${normalizedSku}`;
    }

    /**
     * Register a rate card
     */
    register(card: RateCard): void {
        // Validate card
        if (!card.id || !card.provider || !card.service) {
            throw new Error('Rate card must have id, provider, and service');
        }

        // Check for duplicate ID
        if (this.cardsById.has(card.id)) {
            throw new Error(`Rate card with ID '${card.id}' already exists`);
        }

        // Store by ID
        this.cardsById.set(card.id, card);

        // Store by key (provider:service:sku)
        const key = this.generateKey(card.provider, card.service, card.sku);
        this.cardsByKey.set(key, card);

        // Also store without SKU for fallback lookup
        if (card.sku) {
            const keyWithoutSku = this.generateKey(card.provider, card.service);
            if (!this.cardsByKey.has(keyWithoutSku)) {
                this.cardsByKey.set(keyWithoutSku, card);
            }
        }

        // Initialize calibration history
        if (!this.calibrationHistory.has(card.id)) {
            this.calibrationHistory.set(card.id, []);
        }
    }

    /**
     * Find a rate card by provider and service
     */
    find(provider: string, service: string, sku?: string): RateCard | undefined {
        // Try exact match with SKU first
        if (sku) {
            const exactKey = this.generateKey(provider, service, sku);
            const exactMatch = this.cardsByKey.get(exactKey);
            if (exactMatch) {
                return exactMatch;
            }
        }

        // Fallback to provider:service without SKU
        const fallbackKey = this.generateKey(provider, service);
        return this.cardsByKey.get(fallbackKey);
    }

    /**
     * Find a rate card by ID
     */
    findById(id: string): RateCard | undefined {
        return this.cardsById.get(id);
    }

    /**
     * List all rate cards
     */
    list(): RateCard[] {
        return Array.from(this.cardsById.values());
    }

    /**
     * List rate cards for a provider
     */
    listFor(provider: string): RateCard[] {
        const normalizedProvider = provider.toLowerCase();
        return this.list().filter(
            card => card.provider.toLowerCase() === normalizedProvider
        );
    }

    /**
     * Remove a rate card
     */
    remove(id: string): boolean {
        const card = this.cardsById.get(id);
        if (!card) {
            return false;
        }

        // Remove from ID index
        this.cardsById.delete(id);

        // Remove from key index
        const key = this.generateKey(card.provider, card.service, card.sku);
        this.cardsByKey.delete(key);

        // Remove fallback key if no other card uses it
        const fallbackKey = this.generateKey(card.provider, card.service);
        const fallbackCard = this.cardsByKey.get(fallbackKey);
        if (fallbackCard?.id === id) {
            this.cardsByKey.delete(fallbackKey);
        }

        return true;
    }

    /**
     * Clear all rate cards
     */
    clear(): void {
        this.cardsById.clear();
        this.cardsByKey.clear();
        this.calibrationHistory.clear();
    }

    /**
     * Update calibration multiplier for a rate card
     */
    calibrate(id: string, multiplier: number): boolean {
        const card = this.cardsById.get(id);
        if (!card) {
            return false;
        }

        // Validate multiplier within allowed range
        const currentMultiplier = card.calibrationMultiplier;
        const maxChange = this.calibrationConfig.maxMultiplierChange;
        const clampedMultiplier = Math.max(
            currentMultiplier - maxChange,
            Math.min(currentMultiplier + maxChange, multiplier)
        );

        // Update the card
        card.calibrationMultiplier = clampedMultiplier;
        card.lastCalibratedAt = new Date().toISOString();

        return true;
    }

    /**
     * Get calibration history for a rate card
     */
    getCalibrationHistory(id: string): CalibrationData[] {
        return this.calibrationHistory.get(id) || [];
    }

    /**
     * Add calibration data point
     */
    addCalibrationData(data: CalibrationData): void {
        const history = this.calibrationHistory.get(data.rateCardId) || [];
        history.push(data);

        // Keep only recent history based on lookback periods
        const maxHistory = this.calibrationConfig.lookbackPeriods * 2;
        if (history.length > maxHistory) {
            history.splice(0, history.length - maxHistory);
        }

        this.calibrationHistory.set(data.rateCardId, history);
    }

    /**
     * Calculate suggested calibration based on history
     */
    calculateSuggestedCalibration(id: string): CalibrationData | null {
        const card = this.cardsById.get(id);
        if (!card) {
            return null;
        }

        const history = this.getCalibrationHistory(id);
        if (history.length < this.calibrationConfig.lookbackPeriods) {
            return null;
        }

        // Get recent calibration data
        const recentData = history.slice(-this.calibrationConfig.lookbackPeriods);

        // Calculate weighted average variance
        let totalWeight = 0;
        let weightedVariance = 0;
        let totalSampleSize = 0;

        for (let i = 0; i < recentData.length; i++) {
            const data = recentData[i];
            const weight = i + 1; // More recent = higher weight
            weightedVariance += data.variancePercent * weight;
            totalWeight += weight;
            totalSampleSize += data.sampleSize;
        }

        const avgVariance = weightedVariance / totalWeight;

        // Check if calibration is needed
        if (Math.abs(avgVariance) < this.calibrationConfig.varianceThreshold * 100) {
            return null;
        }

        // Calculate suggested multiplier
        const currentMultiplier = card.calibrationMultiplier;
        const adjustment = avgVariance / 100;
        const suggestedMultiplier = currentMultiplier * (1 + adjustment);

        // Calculate confidence based on sample size
        const minSamples = this.calibrationConfig.minSampleSize;
        const confidence = Math.min(1, totalSampleSize / (minSamples * this.calibrationConfig.lookbackPeriods));

        const latestData = recentData[recentData.length - 1];

        return {
            rateCardId: id,
            period: latestData.period,
            estimatedTotal: latestData.estimatedTotal,
            realTotal: latestData.realTotal,
            variance: latestData.variance,
            variancePercent: avgVariance,
            suggestedMultiplier,
            confidence,
            sampleSize: totalSampleSize,
            calculatedAt: new Date().toISOString(),
        };
    }

    /**
     * Auto-calibrate a rate card based on history
     */
    autoCalibrate(id: string): boolean {
        const suggestion = this.calculateSuggestedCalibration(id);
        if (!suggestion) {
            return false;
        }

        // Only calibrate if confidence is high enough
        if (suggestion.confidence < 0.8) {
            return false;
        }

        return this.calibrate(id, suggestion.suggestedMultiplier);
    }
}

/**
 * Create a singleton registry instance
 */
let globalRegistry: RateCardRegistry | null = null;

export function getGlobalRegistry(): RateCardRegistry {
    if (!globalRegistry) {
        globalRegistry = new RateCardRegistry();
    }
    return globalRegistry;
}

export function resetGlobalRegistry(): void {
    globalRegistry = null;
}

