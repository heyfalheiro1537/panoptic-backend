/**
 * Operation Record Types for Panoptic Billing System
 * 
 * OperationRecord represents tracked operations from the SDK,
 * stored in Loki and used for rate card cost estimation.
 */

import { BillingEvent, BillingMetadata } from '../../sdk/types/billingEvent';
import { Providers, ProvidersType } from '../../sdk/types/providers';

/**
 * Operation Record - Extends BillingEvent with additional tracking fields
 * This is what we query from Loki to apply rate cards
 */
export interface OperationRecord {
    /** Unique operation ID */
    id: string;

    /** Timestamp (ISO string) */
    timestamp: string;

    /** Project ID */
    projectId?: string;

    /** Environment */
    environment: string;

    // ─────────────────────────────────────────────────────────
    // Provider Information
    // ─────────────────────────────────────────────────────────

    /** Provider category */
    category: ProvidersType;

    /** Provider name */
    provider: Providers | string;

    /** Service name */
    service?: string;

    /** Resource/function name */
    resource?: string;

    // ─────────────────────────────────────────────────────────
    // Usage Metrics (for rate card application)
    // ─────────────────────────────────────────────────────────

    /** Duration in milliseconds */
    durationMs?: number;

    /** Request count */
    requestCount?: number;

    /** Token counts (for AI providers) */
    tokens?: {
        input?: number;
        output?: number;
        total?: number;
    };

    /** Data transfer (bytes) */
    dataTransfer?: {
        ingress?: number;
        egress?: number;
    };

    /** Storage operations */
    storageOps?: {
        reads?: number;
        writes?: number;
        deletes?: number;
    };

    /** CPU usage (for compute) */
    cpuUsage?: {
        seconds?: number;
        millicores?: number;
    };

    /** Memory usage (for compute) */
    memoryUsage?: {
        gbSeconds?: number;
        maxMb?: number;
    };

    // ─────────────────────────────────────────────────────────
    // Attribution
    // ─────────────────────────────────────────────────────────

    /** Tenant ID */
    tenantId?: string;

    /** User ID */
    userId?: string;

    /** Feature name */
    feature?: string;

    /** Endpoint */
    endpoint?: string;

    /** Request ID for correlation */
    requestId?: string;

    /** Trace ID for distributed tracing */
    traceId?: string;

    // ─────────────────────────────────────────────────────────
    // Status & Metadata
    // ─────────────────────────────────────────────────────────

    /** Operation status */
    status: 'success' | 'error' | 'timeout';

    /** Error message if failed */
    errorMessage?: string;

    /** Additional metadata */
    metadata?: BillingMetadata;
}

/**
 * Operation aggregation for a period
 */
export interface OperationAggregation {
    /** Provider */
    provider: string;

    /** Service */
    service: string;

    /** Period (YYYY-MM) */
    period: string;

    /** Total operations */
    totalOperations: number;

    /** Successful operations */
    successCount: number;

    /** Failed operations */
    errorCount: number;

    /** Total duration (ms) */
    totalDurationMs: number;

    /** Average duration (ms) */
    avgDurationMs: number;

    /** Total tokens (if applicable) */
    totalTokens?: number;

    /** Total reads (if applicable) */
    totalReads?: number;

    /** Total writes (if applicable) */
    totalWrites?: number;

    /** Breakdown by tenant */
    byTenant: Map<string, number>;

    /** Breakdown by feature */
    byFeature: Map<string, number>;
}

/**
 * Query options for fetching operations
 */
export interface OperationQueryOptions {
    /** Start time (ISO string) */
    startTime: string;

    /** End time (ISO string) */
    endTime: string;

    /** Filter by provider */
    provider?: string;

    /** Filter by service */
    service?: string;

    /** Filter by tenant ID */
    tenantId?: string;

    /** Filter by feature */
    feature?: string;

    /** Filter by environment */
    environment?: string;

    /** Filter by status */
    status?: 'success' | 'error' | 'timeout';

    /** Maximum records to return */
    limit?: number;
}

/**
 * Convert a BillingEvent to an OperationRecord
 */
export function billingEventToOperation(
    event: BillingEvent,
    id?: string
): OperationRecord {
    return {
        id: id || `op-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        timestamp: event.ts,
        projectId: event.projectId,
        environment: event.env || 'unknown',
        category: event.category,
        provider: event.provider,
        service: event.service,
        resource: event.resource,
        durationMs: event.metadata?.duration_ms,
        requestCount: event.quantity || 1,
        tenantId: event.metadata?.tenant_id,
        userId: event.metadata?.user_id,
        feature: event.metadata?.feature,
        endpoint: event.metadata?.endpoint,
        requestId: event.metadata?.request_id,
        traceId: event.metadata?.trace_id,
        status: 'success',
        metadata: event.metadata,
    };
}

/**
 * Get period (YYYY-MM) from a timestamp
 */
export function getPeriodFromTimestamp(timestamp: string): string {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
}

/**
 * Get start and end of a period
 */
export function getPeriodBounds(period: string): { start: string; end: string } {
    const [year, month] = period.split('-').map(Number);
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59, 999);

    return {
        start: start.toISOString(),
        end: end.toISOString(),
    };
}

