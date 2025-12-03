/**
 * CostStatement Types for Panoptic Billing System
 * 
 * CostStatement is the unified output combining estimated and real costs
 * with variance analysis for calibration.
 */

import { LineItem, AggregatedLineItem } from './lineItem';

/**
 * Provider cost summary with estimate vs real comparison
 */
export interface ProviderCostSummary {
    /** Provider identifier */
    provider: string;

    /** Estimated total from rate cards */
    estimatedTotal: number;

    /** Real total from billing import */
    realTotal: number;

    /** Variance (real - estimated) */
    variance: number;

    /** Variance percentage ((real - estimated) / estimated * 100) */
    variancePercent: number;

    /** Breakdown by service */
    byService: ServiceCostSummary[];
}

/**
 * Service cost summary
 */
export interface ServiceCostSummary {
    /** Service identifier */
    service: string;

    /** Estimated total */
    estimatedTotal: number;

    /** Real total */
    realTotal: number;

    /** Variance */
    variance: number;

    /** Variance percentage */
    variancePercent: number;
}

/**
 * Tenant cost summary
 */
export interface TenantCostSummary {
    /** Tenant identifier */
    tenantId: string;

    /** Estimated total */
    estimatedTotal: number;

    /** Real total */
    realTotal: number;

    /** Variance */
    variance: number;

    /** Variance percentage */
    variancePercent: number;

    /** Breakdown by provider */
    byProvider: { provider: string; estimated: number; real: number }[];
}

/**
 * Feature cost summary
 */
export interface FeatureCostSummary {
    /** Feature identifier */
    feature: string;

    /** Estimated total */
    estimatedTotal: number;

    /** Real total */
    realTotal: number;

    /** Variance */
    variance: number;

    /** Variance percentage */
    variancePercent: number;
}

/**
 * CostStatement - The main billing output combining all data
 */
export interface CostStatement {
    /** Unique statement ID */
    id: string;

    /** Billing period (YYYY-MM) */
    period: string;

    /** Statement generation timestamp */
    generatedAt: string;

    /** Currency */
    currency: string;

    // ─────────────────────────────────────────────────────────
    // Totals with Estimate vs Real Comparison
    // ─────────────────────────────────────────────────────────

    /** Total estimated cost (from rate cards) */
    estimatedTotal: number;

    /** Total real cost (from billing import) */
    realTotal: number;

    /** Total variance (real - estimated) */
    variance: number;

    /** Variance percentage */
    variancePercent: number;

    // ─────────────────────────────────────────────────────────
    // Breakdowns
    // ─────────────────────────────────────────────────────────

    /** Breakdown by provider */
    byProvider: ProviderCostSummary[];

    /** Breakdown by tenant */
    byTenant: TenantCostSummary[];

    /** Breakdown by feature */
    byFeature: FeatureCostSummary[];

    // ─────────────────────────────────────────────────────────
    // Line Items
    // ─────────────────────────────────────────────────────────

    /** All line items (estimate + real) */
    lineItems: LineItem[];

    /** Estimated line items only */
    estimatedLineItems: LineItem[];

    /** Real line items only */
    realLineItems: LineItem[];

    // ─────────────────────────────────────────────────────────
    // Metadata
    // ─────────────────────────────────────────────────────────

    /** Data sources used */
    dataSources: DataSourceInfo[];

    /** Rate cards used for estimation */
    rateCardsUsed: string[];

    /** Warnings or notes */
    warnings: string[];

    /** Additional metadata */
    metadata?: Record<string, unknown>;
}

/**
 * Data source information
 */
export interface DataSourceInfo {
    /** Source type */
    type: 'loki' | 'bigquery' | 'mock';

    /** Source name/identifier */
    name: string;

    /** Query period start */
    periodStart: string;

    /** Query period end */
    periodEnd: string;

    /** Number of records fetched */
    recordCount: number;

    /** Query timestamp */
    queriedAt: string;
}

/**
 * Statement generation options
 */
export interface StatementGenerationOptions {
    /** Period to generate (YYYY-MM) */
    period: string;

    /** Include estimated costs */
    includeEstimates: boolean;

    /** Include real costs */
    includeReal: boolean;

    /** Filter by tenant IDs */
    tenantIds?: string[];

    /** Filter by features */
    features?: string[];

    /** Use mock data for development */
    useMockData: boolean;
}

/**
 * Default statement generation options
 */
export const DEFAULT_STATEMENT_OPTIONS: Omit<StatementGenerationOptions, 'period'> = {
    includeEstimates: true,
    includeReal: true,
    useMockData: false,
};

/**
 * Calculate variance percentage safely (handles zero estimated)
 */
export function calculateVariancePercent(estimated: number, real: number): number {
    if (estimated === 0) {
        return real === 0 ? 0 : 100;
    }
    return ((real - estimated) / estimated) * 100;
}

/**
 * Create an empty cost statement for a period
 */
export function createEmptyStatement(period: string): CostStatement {
    return {
        id: `stmt-${period}-${Date.now()}`,
        period,
        generatedAt: new Date().toISOString(),
        currency: 'USD',
        estimatedTotal: 0,
        realTotal: 0,
        variance: 0,
        variancePercent: 0,
        byProvider: [],
        byTenant: [],
        byFeature: [],
        lineItems: [],
        estimatedLineItems: [],
        realLineItems: [],
        dataSources: [],
        rateCardsUsed: [],
        warnings: [],
    };
}

