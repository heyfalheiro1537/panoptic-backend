/**
 * LineItem Types for Panoptic Billing System
 * 
 * LineItem is the atomic unit of billing - represents a single cost entry
 * that can come from either rate card estimates or real billing data.
 */

/**
 * Source of the line item - crucial for estimate vs real comparison
 */
export type LineItemSource = 'estimate' | 'real';

/**
 * LineItem - A single cost entry in the billing system
 */
export interface LineItem {
    /** Unique identifier */
    id: string;

    /** Source: 'estimate' (from rate cards) or 'real' (from billing import) */
    source: LineItemSource;

    /** Period (YYYY-MM) */
    period: string;

    // ─────────────────────────────────────────────────────────
    // Provider & Service Information
    // ─────────────────────────────────────────────────────────

    /** Provider identifier (e.g., 'gcp') */
    provider: string;

    /** Service identifier (e.g., 'cloud-run', 'firestore') */
    service: string;

    /** SKU identifier for granular matching */
    sku?: string;

    /** Human-readable description */
    description: string;

    // ─────────────────────────────────────────────────────────
    // Attribution (for breakdown by tenant/feature)
    // ─────────────────────────────────────────────────────────

    /** Multi-tenant customer/organization ID */
    tenantId?: string;

    /** Business feature (e.g., 'checkout', 'reporting', 'api-server') */
    feature?: string;

    /** Environment (e.g., 'production', 'staging') */
    environment?: string;

    /** GCP labels or custom tags */
    labels?: Record<string, string>;

    // ─────────────────────────────────────────────────────────
    // Usage & Cost Details
    // ─────────────────────────────────────────────────────────

    /** Usage quantity */
    quantity: number;

    /** Unit of measurement (e.g., 'cpu_seconds', 'reads', 'gb_months') */
    unit: string;

    /** Cost per unit (for reference) */
    unitCost?: number;

    /** Total cost for this line item */
    totalCost: number;

    /** Currency */
    currency: string;

    // ─────────────────────────────────────────────────────────
    // Metadata & Tracking
    // ─────────────────────────────────────────────────────────

    /** Rate card ID used (for estimates) */
    rateCardId?: string;

    /** Original billing record ID (for real costs) */
    billingRecordId?: string;

    /** Timestamp when this cost was incurred */
    usageStartTime?: string;

    /** Timestamp when usage ended */
    usageEndTime?: string;

    /** When this line item was created */
    createdAt: string;

    /** Additional metadata */
    metadata?: Record<string, unknown>;
}

/**
 * Aggregated line items by a dimension
 */
export interface AggregatedLineItem {
    /** Aggregation key */
    key: string;

    /** Human-readable label */
    label: string;

    /** Source of aggregation */
    source: LineItemSource;

    /** Total cost */
    totalCost: number;

    /** Percentage of total */
    percentage: number;

    /** Number of line items aggregated */
    count: number;

    /** Currency */
    currency: string;
}

/**
 * Line item filter options
 */
export interface LineItemFilter {
    source?: LineItemSource;
    provider?: string;
    service?: string;
    tenantId?: string;
    feature?: string;
    environment?: string;
    minCost?: number;
    maxCost?: number;
}

/**
 * Create a unique ID for a line item
 */
export function createLineItemId(
    source: LineItemSource,
    provider: string,
    service: string,
    period: string,
    suffix?: string
): string {
    const base = `${source}-${provider}-${service}-${period}`;
    return suffix ? `${base}-${suffix}` : `${base}-${Date.now()}`;
}

