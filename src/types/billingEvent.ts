import { Providers, ProviderServicesMap, ProvidersType } from "./providers";

interface BaseBillingEvent {
    ts: string;
    projectId?: string;
    env?: string;
    category: ProvidersType;
    provider: Providers;
    resource?: string;
    quantity?: number;
    unit?: string;
    amount?: number;
    currency?: string;
    metadata?: Record<string, any>;
}


export type BillingEvent<P extends Providers = Providers> = BaseBillingEvent & {
    provider: P;
    service?: ProviderServicesMap[P];
};
