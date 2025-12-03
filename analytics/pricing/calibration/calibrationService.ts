/**
 * Calibration Service for Panoptic Billing System
 * 
 * Analyzes variance between estimated and real costs,
 * and suggests/applies calibration multipliers to rate cards.
 */

import {
    RateCard,
    CalibrationData,
    CalibrationConfig,
    DEFAULT_CALIBRATION_CONFIG,
} from '../types/rateCard';
import { RateCardRegistry } from '../registry/rateCardRegistry';
import { CostStatement, ProviderCostSummary, ServiceCostSummary } from '../../billing/types/statement';

/**
 * Calibration Result
 */
export interface CalibrationResult {
    /** Rate card ID */
    rateCardId: string;
    /** Current multiplier */
    currentMultiplier: number;
    /** Suggested multiplier */
    suggestedMultiplier: number;
    /** Whether calibration was applied */
    applied: boolean;
    /** Reason for decision */
    reason: string;
    /** Variance data that led to this suggestion */
    varianceData: {
        estimatedTotal: number;
        realTotal: number;
        variance: number;
        variancePercent: number;
        sampleSize: number;
    };
    /** Confidence score (0-1) */
    confidence: number;
}

/**
 * Calibration Report
 */
export interface CalibrationReport {
    /** Period analyzed */
    period: string;
    /** Timestamp */
    generatedAt: string;
    /** Results per rate card */
    results: CalibrationResult[];
    /** Summary */
    summary: {
        totalCardsAnalyzed: number;
        cardsNeedingCalibration: number;
        cardsCalibrated: number;
        averageVariance: number;
    };
    /** Recommendations */
    recommendations: string[];
}

/**
 * Calibration Service
 */
export class CalibrationService {
    private registry: RateCardRegistry;
    private config: CalibrationConfig;

    constructor(registry: RateCardRegistry, config?: Partial<CalibrationConfig>) {
        this.registry = registry;
        this.config = { ...DEFAULT_CALIBRATION_CONFIG, ...config };
    }

    /**
     * Analyze a statement and suggest calibrations
     */
    analyzeStatement(statement: CostStatement): CalibrationReport {
        const results: CalibrationResult[] = [];
        const recommendations: string[] = [];

        // Analyze each provider's services
        for (const providerSummary of statement.byProvider) {
            for (const serviceSummary of providerSummary.byService) {
                const result = this.analyzeService(
                    providerSummary.provider,
                    serviceSummary,
                    statement.period
                );

                if (result) {
                    results.push(result);
                }
            }
        }

        // Generate summary
        const cardsNeedingCalibration = results.filter(
            r => Math.abs(r.varianceData.variancePercent) > this.config.varianceThreshold * 100
        ).length;

        const cardsCalibrated = results.filter(r => r.applied).length;

        const avgVariance = results.length > 0
            ? results.reduce((sum, r) => sum + Math.abs(r.varianceData.variancePercent), 0) / results.length
            : 0;

        // Generate recommendations
        if (avgVariance > 15) {
            recommendations.push(
                'High average variance detected. Review rate card pricing against actual GCP pricing.'
            );
        }

        const highVarianceCards = results.filter(r => Math.abs(r.varianceData.variancePercent) > 25);
        for (const card of highVarianceCards) {
            recommendations.push(
                `Rate card "${card.rateCardId}" has ${card.varianceData.variancePercent.toFixed(1)}% variance. ` +
                `Consider manual review of pricing rules.`
            );
        }

        if (cardsNeedingCalibration > 0 && cardsCalibrated === 0) {
            recommendations.push(
                `${cardsNeedingCalibration} rate cards need calibration but weren't auto-calibrated. ` +
                `Run calibration with autoApply=true or manually adjust multipliers.`
            );
        }

        return {
            period: statement.period,
            generatedAt: new Date().toISOString(),
            results,
            summary: {
                totalCardsAnalyzed: results.length,
                cardsNeedingCalibration,
                cardsCalibrated,
                averageVariance: avgVariance,
            },
            recommendations,
        };
    }

    /**
     * Analyze a service and generate calibration result
     */
    private analyzeService(
        provider: string,
        serviceSummary: ServiceCostSummary,
        period: string
    ): CalibrationResult | null {
        // Find the rate card for this service
        const rateCard = this.registry.find(provider, serviceSummary.service);
        if (!rateCard) {
            return null;
        }

        const { estimatedTotal, realTotal, variance, variancePercent } = serviceSummary;

        // Calculate sample size (rough estimate based on cost)
        const avgCostPerOp = 0.001; // Assume $0.001 per operation average
        const sampleSize = Math.round(realTotal / avgCostPerOp);

        // Calculate confidence based on sample size
        const confidence = Math.min(1, sampleSize / this.config.minSampleSize);

        // Calculate suggested multiplier
        let suggestedMultiplier = rateCard.calibrationMultiplier;
        let reason = 'Variance within acceptable threshold';
        let needsCalibration = false;

        if (estimatedTotal > 0 && Math.abs(variancePercent) > this.config.varianceThreshold * 100) {
            needsCalibration = true;

            // Calculate adjustment factor
            const adjustmentFactor = realTotal / estimatedTotal;
            
            // Apply with dampening to avoid over-correction
            const dampeningFactor = 0.5; // Only apply 50% of the adjustment
            const adjustment = (adjustmentFactor - 1) * dampeningFactor;
            
            suggestedMultiplier = rateCard.calibrationMultiplier * (1 + adjustment);

            // Clamp to max allowed change
            const maxChange = this.config.maxMultiplierChange;
            const currentMultiplier = rateCard.calibrationMultiplier;
            suggestedMultiplier = Math.max(
                currentMultiplier * (1 - maxChange),
                Math.min(currentMultiplier * (1 + maxChange), suggestedMultiplier)
            );

            if (variancePercent > 0) {
                reason = `Real costs ${variancePercent.toFixed(1)}% higher than estimated. Increasing multiplier.`;
            } else {
                reason = `Real costs ${Math.abs(variancePercent).toFixed(1)}% lower than estimated. Decreasing multiplier.`;
            }
        }

        // Store calibration data
        const calibrationData: CalibrationData = {
            rateCardId: rateCard.id,
            period,
            estimatedTotal,
            realTotal,
            variance,
            variancePercent,
            suggestedMultiplier,
            confidence,
            sampleSize,
            calculatedAt: new Date().toISOString(),
        };

        this.registry.addCalibrationData(calibrationData);

        return {
            rateCardId: rateCard.id,
            currentMultiplier: rateCard.calibrationMultiplier,
            suggestedMultiplier,
            applied: false,
            reason,
            varianceData: {
                estimatedTotal,
                realTotal,
                variance,
                variancePercent,
                sampleSize,
            },
            confidence,
        };
    }

    /**
     * Apply calibration to rate cards
     */
    applyCalibrations(
        results: CalibrationResult[],
        options?: { minConfidence?: number; force?: boolean }
    ): CalibrationResult[] {
        const minConfidence = options?.minConfidence ?? 0.8;
        const force = options?.force ?? false;

        const updatedResults: CalibrationResult[] = [];

        for (const result of results) {
            const shouldApply = force || (
                result.confidence >= minConfidence &&
                Math.abs(result.varianceData.variancePercent) > this.config.varianceThreshold * 100
            );

            if (shouldApply) {
                const success = this.registry.calibrate(
                    result.rateCardId,
                    result.suggestedMultiplier
                );

                updatedResults.push({
                    ...result,
                    applied: success,
                    reason: success
                        ? `Calibration applied. Multiplier changed from ${result.currentMultiplier.toFixed(4)} to ${result.suggestedMultiplier.toFixed(4)}`
                        : result.reason,
                });
            } else {
                updatedResults.push({
                    ...result,
                    applied: false,
                    reason: result.confidence < minConfidence
                        ? `Confidence (${(result.confidence * 100).toFixed(0)}%) below threshold (${(minConfidence * 100).toFixed(0)}%)`
                        : result.reason,
                });
            }
        }

        return updatedResults;
    }

    /**
     * Get calibration history for a rate card
     */
    getCalibrationHistory(rateCardId: string): CalibrationData[] {
        return this.registry.getCalibrationHistory(rateCardId);
    }

    /**
     * Analyze historical variance trends
     */
    analyzeVarianceTrend(rateCardId: string): {
        trend: 'improving' | 'worsening' | 'stable';
        averageVariance: number;
        dataPoints: number;
    } | null {
        const history = this.getCalibrationHistory(rateCardId);
        
        if (history.length < 2) {
            return null;
        }

        // Calculate average variance
        const avgVariance = history.reduce((sum, d) => sum + Math.abs(d.variancePercent), 0) / history.length;

        // Analyze trend (compare recent vs older)
        const midpoint = Math.floor(history.length / 2);
        const olderVariance = history.slice(0, midpoint).reduce((sum, d) => sum + Math.abs(d.variancePercent), 0) / midpoint;
        const recentVariance = history.slice(midpoint).reduce((sum, d) => sum + Math.abs(d.variancePercent), 0) / (history.length - midpoint);

        let trend: 'improving' | 'worsening' | 'stable';
        if (recentVariance < olderVariance * 0.8) {
            trend = 'improving';
        } else if (recentVariance > olderVariance * 1.2) {
            trend = 'worsening';
        } else {
            trend = 'stable';
        }

        return {
            trend,
            averageVariance: avgVariance,
            dataPoints: history.length,
        };
    }

    /**
     * Reset calibration for a rate card
     */
    resetCalibration(rateCardId: string): boolean {
        return this.registry.calibrate(rateCardId, 1.0);
    }

    /**
     * Get all calibration config
     */
    getConfig(): CalibrationConfig {
        return { ...this.config };
    }

    /**
     * Update calibration config
     */
    updateConfig(config: Partial<CalibrationConfig>): void {
        this.config = { ...this.config, ...config };
    }
}

/**
 * Create a calibration service
 */
export function createCalibrationService(
    registry: RateCardRegistry,
    config?: Partial<CalibrationConfig>
): CalibrationService {
    return new CalibrationService(registry, config);
}

