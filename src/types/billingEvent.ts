import { Providers, ProviderServicesMap, ProvidersType } from "./providers";

/**
 * BaseBillingEvent describes the structure of a usage or billing event.
 */
interface BaseBillingEvent {
    /**
     * ISO-formatted timestamp of when the event occurred.
     */
    ts: string;

    /**
     * Optional project ID (typically the customer or workspace identifier).
     */
    projectId?: string;

    /**
     * Optional environment name (such as 'development', 'production').
     */
    env?: string;

    /**
     * Category of provider: e.g. AI, INFRA, based on ProvidersType enum.
     */
    category: ProvidersType;

    /**
     * The provider in use (e.g. OPENAI, AWS), based on Providers enum.
     */
    provider: Providers;

    /**
     * Optional resource operated on (e.g. function name, API endpoint).
     */
    resource?: string;

    /**
     * Optional quantity used in the billing event (e.g. number of executions, tokens).
     */
    quantity?: number;

    /**
     * Optional unit for the quantity (e.g. 'execution', 'token', 'GB').
     */
    unit?: string; 

    /**
     * Optional amount charged or cost of the event (usually in the specified currency).
     */
    amount?: number;

    /**
     * Optional currency code for the amount (e.g. 'USD').
     */
    currency?: string;

    /**
     * Optional metadata map for any additional data (duration, user, requestId, tags, etc).
     */
    metadata?: Record<string, any>;
}


export type BillingEvent<P extends Providers = Providers> = BaseBillingEvent & {
    provider: P;
    service?: ProviderServicesMap[P];
};
