import { BillingLogger } from './logger';

export interface BillableMeta {
    provider?: string;        // e.g. "openai", "aws"
    service?: string;         // e.g. "gpt-4o-mini", "s3", "lambda"
    resource?: string;        // your internal resource / client program / feature (auto-captured from fn.name if not provided)
    user?: string;
    requestId?: string;       // traceability
    source?: string;
    tags?: string[];
    logger?: BillingLogger;   // Optional: custom logger for this operation
    [key: string]: any;
}