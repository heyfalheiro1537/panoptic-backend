export interface BillableMeta {
    provider?: string;        // e.g. "openai", "aws"
    service?: string;         // e.g. "gpt-4o-mini", "s3", "lambda"
    resource?: string;        // your internal resource / client program / feature
    user?: string;
    requestId?: string;       // traceability
    source?: string;
    tags?: string[];
    [key: string]: any;
}