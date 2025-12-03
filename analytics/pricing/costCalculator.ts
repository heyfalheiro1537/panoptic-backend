/**
 * Cost Calculator for Panoptic Billing System
 * 
 * Applies rate cards to operations to estimate costs.
 * Supports volume-based pricing tiers and calibration multipliers.
 */

import {
    RateCard,
    PricingRule,
    VolumeTier,
    CostEstimate,
    CostBreakdownItem,
    TierBreakdownItem,
    CostEstimatorConfig,
    DEFAULT_COST_ESTIMATOR_CONFIG,
} from './types/rateCard';
import { RateCardRegistry } from './registry/rateCardRegistry';
import { LineItem, createLineItemId } from '../billing/types/lineItem';
import { OperationRecord, OperationAggregation } from '../types/operation';

/**
 * Usage metrics extracted from operations
 */
export interface UsageMetrics {
    /** Provider */
    provider: string;
    /** Service */
    service: string;
    /** SKU (optional) */
    sku?: string;
    /** Period (YYYY-MM) */
    period: string;
    /** Metrics by unit type */
    metrics: Record<string, number>;
    /** Attribution */
    tenantId?: string;
    feature?: string;
    environment?: string;
    /** Operation count */
    operationCount: number;
}

/**
 * Cost Calculator - Applies rate cards to estimate costs
 */
export class CostCalculator {
    private registry: RateCardRegistry;
    private config: CostEstimatorConfig;

    constructor(registry: RateCardRegistry, config?: Partial<CostEstimatorConfig>) {
        this.registry = registry;
        this.config = { ...DEFAULT_COST_ESTIMATOR_CONFIG, ...config };
    }

    /**
     * Calculate cost estimate for usage metrics
     */
    calculateCost(usage: UsageMetrics): CostEstimate | null {
        // Find matching rate card
        const rateCard = this.registry.find(usage.provider, usage.service, usage.sku);
        if (!rateCard) {
            return null;
        }

        const breakdown: CostBreakdownItem[] = [];
        let subtotal = 0;

        // Apply each pricing rule
        for (const rule of rateCard.rules) {
            const quantity = this.getMetricValue(usage.metrics, rule);
            if (quantity <= 0) {
                continue;
            }

            const breakdownItem = this.calculateRuleCost(rule, quantity);
            breakdown.push(breakdownItem);
            subtotal += breakdownItem.cost;
        }

        // Apply calibration multiplier
        const calibrationMultiplier = this.config.applyCalibration
            ? rateCard.calibrationMultiplier
            : 1.0;

        const total = this.round(subtotal * calibrationMultiplier);

        return {
            rateCardId: rateCard.id,
            provider: rateCard.provider,
            service: rateCard.service,
            breakdown,
            subtotal: this.round(subtotal),
            calibrationMultiplier,
            total,
            currency: rateCard.currency,
            estimatedAt: new Date().toISOString(),
        };
    }

    /**
     * Calculate cost for a single pricing rule
     */
    private calculateRuleCost(rule: PricingRule, quantity: number): CostBreakdownItem {
        // Apply free allowance
        const freeAllowance = rule.freeAllowance || 0;
        const billableQuantity = Math.max(0, quantity - freeAllowance);

        let cost = 0;
        let tierBreakdown: TierBreakdownItem[] | undefined;

        if (rule.tiers && rule.tiers.length > 0) {
            // Volume-based pricing
            const { totalCost, breakdown } = this.calculateTieredCost(rule.tiers, billableQuantity);
            cost = totalCost;
            tierBreakdown = breakdown;
        } else if (rule.pricePerUnit !== undefined) {
            // Simple flat pricing
            cost = billableQuantity * rule.pricePerUnit;
        }

        // Apply minimum charge
        if (rule.minimumCharge !== undefined && cost < rule.minimumCharge && billableQuantity > 0) {
            cost = rule.minimumCharge;
        }

        return {
            ruleId: rule.id,
            ruleName: rule.name,
            quantity,
            unit: rule.customUnit || rule.unit,
            freeAllowanceApplied: Math.min(quantity, freeAllowance),
            billableQuantity,
            cost: this.round(cost),
            tierBreakdown,
        };
    }

    /**
     * Calculate cost using volume tiers
     */
    private calculateTieredCost(
        tiers: VolumeTier[],
        quantity: number
    ): { totalCost: number; breakdown: TierBreakdownItem[] } {
        const breakdown: TierBreakdownItem[] = [];
        let totalCost = 0;
        let remaining = quantity;

        // Sort tiers by min value
        const sortedTiers = [...tiers].sort((a, b) => a.min - b.min);

        for (const tier of sortedTiers) {
            if (remaining <= 0) {
                break;
            }

            const tierMax = tier.max ?? Infinity;
            const tierRange = tierMax - tier.min;
            const tierQuantity = Math.min(remaining, tierRange);

            if (tierQuantity > 0) {
                const tierCost = tierQuantity * tier.pricePerUnit;
                totalCost += tierCost;

                breakdown.push({
                    tierMin: tier.min,
                    tierMax: tier.max,
                    quantity: tierQuantity,
                    pricePerUnit: tier.pricePerUnit,
                    cost: this.round(tierCost),
                });

                remaining -= tierQuantity;
            }
        }

        return { totalCost, breakdown };
    }

    /**
     * Get metric value for a pricing rule
     */
    private getMetricValue(metrics: Record<string, number>, rule: PricingRule): number {
        // Direct match by unit
        if (metrics[rule.unit] !== undefined) {
            return metrics[rule.unit];
        }

        // Try custom unit
        if (rule.customUnit && metrics[rule.customUnit] !== undefined) {
            return metrics[rule.customUnit];
        }

        // Try rule ID as key
        if (metrics[rule.id] !== undefined) {
            return metrics[rule.id];
        }

        return 0;
    }

    /**
     * Round to configured precision
     */
    private round(value: number): number {
        const multiplier = Math.pow(10, this.config.roundingPrecision);
        return Math.round(value * multiplier) / multiplier;
    }

    /**
     * Aggregate operations by provider/service for a period
     */
    aggregateOperations(operations: OperationRecord[], period: string): UsageMetrics[] {
        // Group by provider + service + tenant + feature
        const groups = new Map<string, UsageMetrics>();

        for (const op of operations) {
            const key = this.createGroupKey(op);
            
            if (!groups.has(key)) {
                groups.set(key, {
                    provider: String(op.provider).toLowerCase(),
                    service: op.service || 'default',
                    period,
                    metrics: {},
                    tenantId: op.tenantId,
                    feature: op.feature,
                    environment: op.environment,
                    operationCount: 0,
                });
            }

            const group = groups.get(key)!;
            group.operationCount++;

            // Aggregate metrics
            this.aggregateMetrics(group.metrics, op);
        }

        return Array.from(groups.values());
    }

    /**
     * Create grouping key for an operation
     */
    private createGroupKey(op: OperationRecord): string {
        return [
            op.provider,
            op.service || 'default',
            op.tenantId || '_default',
            op.feature || '_default',
        ].join(':');
    }

    /**
     * Aggregate metrics from an operation
     */
    private aggregateMetrics(metrics: Record<string, number>, op: OperationRecord): void {
        // Request count
        metrics['requests'] = (metrics['requests'] || 0) + (op.requestCount || 1);

        // Duration
        if (op.durationMs) {
            metrics['duration_ms'] = (metrics['duration_ms'] || 0) + op.durationMs;
        }

        // CPU usage
        if (op.cpuUsage?.seconds) {
            metrics['cpu_seconds'] = (metrics['cpu_seconds'] || 0) + op.cpuUsage.seconds;
        }

        // Memory usage
        if (op.memoryUsage?.gbSeconds) {
            metrics['memory_gb_seconds'] = (metrics['memory_gb_seconds'] || 0) + op.memoryUsage.gbSeconds;
        }

        // Storage operations
        if (op.storageOps) {
            if (op.storageOps.reads) {
                metrics['reads'] = (metrics['reads'] || 0) + op.storageOps.reads;
            }
            if (op.storageOps.writes) {
                metrics['writes'] = (metrics['writes'] || 0) + op.storageOps.writes;
            }
            if (op.storageOps.deletes) {
                metrics['deletes'] = (metrics['deletes'] || 0) + op.storageOps.deletes;
            }
        }

        // Data transfer
        if (op.dataTransfer) {
            if (op.dataTransfer.egress) {
                metrics['network_egress_gb'] = (metrics['network_egress_gb'] || 0) + (op.dataTransfer.egress / (1024 * 1024 * 1024));
            }
        }

        // Tokens (for AI providers)
        if (op.tokens) {
            if (op.tokens.input) {
                metrics['input_tokens'] = (metrics['input_tokens'] || 0) + op.tokens.input;
            }
            if (op.tokens.output) {
                metrics['output_tokens'] = (metrics['output_tokens'] || 0) + op.tokens.output;
            }
            if (op.tokens.total) {
                metrics['tokens'] = (metrics['tokens'] || 0) + op.tokens.total;
            }
        }
    }

    /**
     * Calculate estimated costs for operations and return line items
     */
    calculateFromOperations(operations: OperationRecord[], period: string): LineItem[] {
        const lineItems: LineItem[] = [];
        const usageGroups = this.aggregateOperations(operations, period);

        for (const usage of usageGroups) {
            const estimate = this.calculateCost(usage);
            if (!estimate || estimate.total === 0) {
                continue;
            }

            // Create line item for each cost breakdown
            for (const breakdown of estimate.breakdown) {
                if (breakdown.cost === 0) {
                    continue;
                }

                const lineItem: LineItem = {
                    id: createLineItemId('estimate', usage.provider, usage.service, period, breakdown.ruleId),
                    source: 'estimate',
                    period,
                    provider: usage.provider,
                    service: usage.service,
                    description: `${breakdown.ruleName} (estimated)`,
                    tenantId: usage.tenantId,
                    feature: usage.feature,
                    environment: usage.environment,
                    quantity: breakdown.billableQuantity,
                    unit: String(breakdown.unit),
                    unitCost: estimate.breakdown.length > 0 
                        ? breakdown.cost / Math.max(breakdown.billableQuantity, 1) 
                        : 0,
                    totalCost: breakdown.cost * estimate.calibrationMultiplier,
                    currency: estimate.currency,
                    rateCardId: estimate.rateCardId,
                    createdAt: new Date().toISOString(),
                    metadata: {
                        operationCount: usage.operationCount,
                        freeAllowanceApplied: breakdown.freeAllowanceApplied,
                        calibrationMultiplier: estimate.calibrationMultiplier,
                    },
                };

                lineItems.push(lineItem);
            }
        }

        return lineItems;
    }
}

