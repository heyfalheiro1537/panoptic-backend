import { Providers, ProviderServicesMap, ProvidersType } from "./providers";

/**
 * Common attribution-related metadata fields.
 *
 * These are never required, but when present they allow you to
 * break down costs by endpoint, tenant, user, feature, etc.
 *
 * All of these live under BillingEvent.metadata.* rather than as
 * separate top-level fields.
 */
export interface AttributionMetadata {
    /** Logical endpoint or operation, e.g. "POST /api/users" */
    endpoint?: string;
    /** HTTP method when applicable, e.g. "GET", "POST" */
    http_method?: string;
    /** Multi-tenant identifier, e.g. customer/organization ID */
    tenant_id?: string;
    /** End-user identifier when available */
    user_id?: string;
    /** Business feature or flow name, e.g. "checkout", "bulk-import" */
    feature?: string;
    /** Subscription / pricing tier information */
    subscription_tier?: string;
    /** Region or logical location, e.g. "us-east-1" */
    region?: string;
    /** Correlation / tracing identifiers */
    trace_id?: string;
    request_id?: string;
}

/**
 * Generic metadata bag for billing events.
 *
 * It is a free-form object, but we document some common, typed
 * fields for better tooling and reuse.
 */

export type BillingMetadata = Record<string, any> & Partial<AttributionMetadata>;

interface BaseBillingEvent {
    ts: string;
    projectId?: string;
    env?: string;
    category: ProvidersType;
    provider: Providers;
    resource?: string;
    /** Optional manual billing values, mainly for custom events */
    quantity?: number;
    unit?: string;
    amount?: number;
    currency?: string;
    metadata?: BillingMetadata;
}


export type BillingEvent<P extends Providers = Providers> = BaseBillingEvent & {
    provider: P;
    service?: ProviderServicesMap[P];
};


