/**
 * Rate Card Types for Panoptic Billing System
 * 
 * Rate cards define pricing rules for estimating costs based on usage metrics.
 * These estimates are compared against real billing data for calibration.
 */

/**
 * Supported pricing units for rate calculations
 */
export type PricingUnit =
    | 'requests'
    | 'tokens'
    | 'input_tokens'
    | 'output_tokens'
    | 'cpu_seconds'
    | 'memory_gb_seconds'
    | 'storage_gb_months'
    | 'reads'
    | 'writes'
    | 'deletes'
    | 'network_egress_gb'
    | 'invocations'
    | 'duration_ms'
    | 'custom';

/**
 * Volume-based pricing tier
 * Supports tiered pricing where cost per unit decreases at higher volumes
 */
export interface VolumeTier {
    /** Minimum quantity for this tier (inclusive) */
    min: number;
    /** Maximum quantity for this tier (exclusive), null = unlimited */
    max: number | null;
    /** Price per unit in this tier */
    pricePerUnit: number;
}

/**
 * A single pricing rule within a rate card
 * Defines how to calculate cost for a specific metric
 */
export interface PricingRule {
    /** Unique identifier for this rule */
    id: string;
    /** Human-readable name */
    name: string;
    /** The unit of measurement */
    unit: PricingUnit;
    /** Custom unit name when unit is 'custom' */
    customUnit?: string;
    /** Flat price per unit (simple pricing) */
    pricePerUnit?: number;
    /** Volume-based tiers (overrides pricePerUnit if present) */
    tiers?: VolumeTier[];
    /** Minimum charge for this rule */
    minimumCharge?: number;
    /** Free tier allowance (units) */
    freeAllowance?: number;
}

/**
 * Rate Card - Complete pricing definition for a provider/service combination
 */
export interface RateCard {
    /** Unique identifier */
    id: string;
    /** Human-readable name */
    name: string;
    /** Provider identifier (e.g., 'gcp', 'openai') */
    provider: string;
    /** Service identifier (e.g., 'cloud-run', 'firestore') */
    service: string;
    /** Optional SKU for more granular matching */
    sku?: string;
    /** Version of this rate card */
    version: string;
    /** Effective date (ISO string) */
    effectiveDate: string;
    /** Expiration date (ISO string), null = no expiration */
    expirationDate?: string | null;
    /** Currency for all prices */
    currency: string;
    /** Pricing rules */
    rules: PricingRule[];
    /** Calibration multiplier - adjusted based on real vs estimate comparison */
    calibrationMultiplier: number;
    /** Last calibration date */
    lastCalibratedAt?: string;
    /** Metadata for tracking */
    metadata?: Record<string, unknown>;
}

/**
 * Cost estimate result from applying a rate card
 */
export interface CostEstimate {
    /** Rate card used for estimation */
    rateCardId: string;
    /** Provider */
    provider: string;
    /** Service */
    service: string;
    /** Breakdown by pricing rule */
    breakdown: CostBreakdownItem[];
    /** Subtotal before calibration */
    subtotal: number;
    /** Calibration multiplier applied */
    calibrationMultiplier: number;
    /** Final estimated cost */
    total: number;
    /** Currency */
    currency: string;
    /** Estimation timestamp */
    estimatedAt: string;
}

/**
 * Individual cost breakdown item
 */
export interface CostBreakdownItem {
    /** Rule ID */
    ruleId: string;
    /** Rule name */
    ruleName: string;
    /** Quantity used */
    quantity: number;
    /** Unit */
    unit: PricingUnit | string;
    /** Free allowance applied */
    freeAllowanceApplied: number;
    /** Billable quantity after free allowance */
    billableQuantity: number;
    /** Cost for this rule */
    cost: number;
    /** Tier breakdown if volume pricing */
    tierBreakdown?: TierBreakdownItem[];
}

/**
 * Tier breakdown for volume pricing
 */
export interface TierBreakdownItem {
    tierMin: number;
    tierMax: number | null;
    quantity: number;
    pricePerUnit: number;
    cost: number;
}

/**
 * Configuration for cost estimation
 */
export interface CostEstimatorConfig {
    /** Default currency */
    defaultCurrency: string;
    /** Whether to apply calibration multipliers */
    applyCalibration: boolean;
    /** Round costs to this many decimal places */
    roundingPrecision: number;
}

/**
 * Default configuration
 */
export const DEFAULT_COST_ESTIMATOR_CONFIG: CostEstimatorConfig = {
    defaultCurrency: 'USD',
    applyCalibration: true,
    roundingPrecision: 6,
};

/**
 * Calibration data for adjusting rate cards
 */
export interface CalibrationData {
    /** Rate card ID */
    rateCardId: string;
    /** Period analyzed (YYYY-MM) */
    period: string;
    /** Total estimated cost for the period */
    estimatedTotal: number;
    /** Total real cost for the period */
    realTotal: number;
    /** Variance (real - estimated) */
    variance: number;
    /** Variance percentage */
    variancePercent: number;
    /** Suggested new multiplier */
    suggestedMultiplier: number;
    /** Confidence score (0-1) based on sample size */
    confidence: number;
    /** Sample size (number of operations) */
    sampleSize: number;
    /** Calculated at */
    calculatedAt: string;
}

/**
 * Calibration configuration
 */
export interface CalibrationConfig {
    /** Minimum sample size for calibration */
    minSampleSize: number;
    /** Maximum multiplier adjustment per calibration */
    maxMultiplierChange: number;
    /** Minimum variance threshold to trigger calibration */
    varianceThreshold: number;
    /** Historical periods to consider */
    lookbackPeriods: number;
}

/**
 * Default calibration configuration
 */
export const DEFAULT_CALIBRATION_CONFIG: CalibrationConfig = {
    minSampleSize: 100,
    maxMultiplierChange: 0.2,  // Max 20% change per calibration
    varianceThreshold: 0.05,   // 5% variance threshold
    lookbackPeriods: 3,        // Consider last 3 months
};

