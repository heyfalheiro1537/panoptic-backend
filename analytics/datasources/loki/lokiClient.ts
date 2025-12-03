/**
 * Loki Client for Panoptic Billing System
 * 
 * Queries Loki for operation records logged by the SDK.
 * Converts Loki log entries to OperationRecords for cost estimation.
 */

import { OperationRecord, OperationQueryOptions, getPeriodBounds } from '../../types/operation';
import { Providers, ProvidersType } from '../../../sdk/types/providers';

/**
 * Loki query response types
 */
export interface LokiQueryResponse {
    status: string;
    data: {
        resultType: string;
        result: LokiStream[];
        stats?: Record<string, unknown>;
    };
}

export interface LokiStream {
    stream: Record<string, string>;
    values: [string, string][]; // [timestamp_ns, log_line]
}

/**
 * Loki client configuration
 */
export interface LokiClientConfig {
    /** Loki base URL */
    baseUrl: string;
    /** Optional authentication token */
    authToken?: string;
    /** Request timeout in ms */
    timeout?: number;
    /** Default labels to filter by */
    defaultLabels?: Record<string, string>;
}

/**
 * Parsed log entry from Loki
 */
export interface ParsedLogEntry {
    timestamp: string;
    level: string;
    message: string;
    labels: Record<string, string>;
    fields: Record<string, unknown>;
}

/**
 * Loki Client - Queries Loki for billing events
 */
export class LokiClient {
    private config: LokiClientConfig;

    constructor(config: LokiClientConfig) {
        this.config = {
            timeout: 30000,
            ...config,
        };
    }

    /**
     * Build LogQL query for operations
     */
    private buildQuery(options: OperationQueryOptions): string {
        const labelMatchers: string[] = [];

        // Add default labels
        if (this.config.defaultLabels) {
            for (const [key, value] of Object.entries(this.config.defaultLabels)) {
                labelMatchers.push(`${key}="${value}"`);
            }
        }

        // Add job label for billing events
        labelMatchers.push(`job="panoptic"`);

        // Add level filter for invoice logs
        labelMatchers.push(`level="invoice"`);

        // Build the query
        let query = `{${labelMatchers.join(', ')}}`;

        // Add line filters
        const lineFilters: string[] = [];

        if (options.provider) {
            lineFilters.push(`provider="${options.provider}"`);
        }

        if (options.service) {
            lineFilters.push(`service="${options.service}"`);
        }

        if (options.tenantId) {
            lineFilters.push(`tenant_id="${options.tenantId}"`);
        }

        if (options.feature) {
            lineFilters.push(`feature="${options.feature}"`);
        }

        if (options.environment) {
            lineFilters.push(`env="${options.environment}"`);
        }

        // Add JSON parsing and filters
        query += ' | json';

        for (const filter of lineFilters) {
            query += ` | ${filter}`;
        }

        return query;
    }

    /**
     * Query Loki for operations in a time range
     */
    async queryOperations(options: OperationQueryOptions): Promise<OperationRecord[]> {
        const query = this.buildQuery(options);
        const startNs = new Date(options.startTime).getTime() * 1000000;
        const endNs = new Date(options.endTime).getTime() * 1000000;

        const url = new URL(`${this.config.baseUrl}/loki/api/v1/query_range`);
        url.searchParams.set('query', query);
        url.searchParams.set('start', startNs.toString());
        url.searchParams.set('end', endNs.toString());
        url.searchParams.set('limit', String(options.limit || 10000));

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };

        if (this.config.authToken) {
            headers['Authorization'] = `Bearer ${this.config.authToken}`;
        }

        try {
            const response = await fetch(url.toString(), {
                method: 'GET',
                headers,
                signal: AbortSignal.timeout(this.config.timeout || 30000),
            });

            if (!response.ok) {
                throw new Error(`Loki query failed: ${response.status} ${response.statusText}`);
            }

            const data: LokiQueryResponse = await response.json();
            return this.parseQueryResponse(data);
        } catch (error) {
            if (error instanceof Error) {
                throw new Error(`Loki query error: ${error.message}`);
            }
            throw error;
        }
    }

    /**
     * Query operations for a billing period
     */
    async queryPeriod(period: string, filter?: Partial<OperationQueryOptions>): Promise<OperationRecord[]> {
        const bounds = getPeriodBounds(period);
        
        return this.queryOperations({
            startTime: bounds.start,
            endTime: bounds.end,
            ...filter,
        });
    }

    /**
     * Parse Loki query response into OperationRecords
     */
    private parseQueryResponse(response: LokiQueryResponse): OperationRecord[] {
        const operations: OperationRecord[] = [];

        if (response.status !== 'success' || !response.data?.result) {
            return operations;
        }

        for (const stream of response.data.result) {
            for (const [timestampNs, logLine] of stream.values) {
                try {
                    const parsed = this.parseLogLine(logLine, stream.stream);
                    const operation = this.logEntryToOperation(parsed, timestampNs);
                    if (operation) {
                        operations.push(operation);
                    }
                } catch (error) {
                    // Skip malformed log entries
                    console.warn('Failed to parse log entry:', error);
                }
            }
        }

        return operations;
    }

    /**
     * Parse a single log line
     */
    private parseLogLine(logLine: string, streamLabels: Record<string, string>): ParsedLogEntry {
        // Try to parse as JSON
        const parsed = JSON.parse(logLine);

        return {
            timestamp: parsed.ts || parsed.timestamp || new Date().toISOString(),
            level: parsed.level || streamLabels.level || 'info',
            message: parsed.msg || parsed.message || '',
            labels: streamLabels,
            fields: parsed,
        };
    }

    /**
     * Convert parsed log entry to OperationRecord
     */
    private logEntryToOperation(entry: ParsedLogEntry, timestampNs: string): OperationRecord | null {
        const fields = entry.fields;

        // Skip non-billing entries
        if (entry.level !== 'invoice' && !fields.category) {
            return null;
        }

        const timestamp = new Date(parseInt(timestampNs) / 1000000).toISOString();

        return {
            id: `loki-${timestampNs}`,
            timestamp,
            projectId: fields.projectId as string,
            environment: (fields.env as string) || 'production',
            category: (fields.category as ProvidersType) || ProvidersType.INFRA,
            provider: (fields.provider as Providers) || Providers.USER_DEFINED,
            service: fields.service as string,
            resource: fields.resource as string,
            durationMs: fields.metadata?.duration_ms as number,
            requestCount: (fields.quantity as number) || 1,
            tenantId: fields.metadata?.tenant_id as string,
            userId: fields.metadata?.user_id as string,
            feature: fields.metadata?.feature as string,
            endpoint: fields.metadata?.endpoint as string,
            requestId: fields.metadata?.request_id as string,
            traceId: fields.metadata?.trace_id as string,
            status: 'success',
            metadata: fields.metadata as Record<string, unknown>,

            // GCP-specific metrics
            cpuUsage: fields.cpuUsage as { seconds?: number; millicores?: number },
            memoryUsage: fields.memoryUsage as { gbSeconds?: number; maxMb?: number },
            storageOps: fields.storageOps as { reads?: number; writes?: number; deletes?: number },
            dataTransfer: fields.dataTransfer as { ingress?: number; egress?: number },
            tokens: fields.tokens as { input?: number; output?: number; total?: number },
        };
    }

    /**
     * Test connection to Loki
     */
    async testConnection(): Promise<boolean> {
        try {
            const url = `${this.config.baseUrl}/ready`;
            const response = await fetch(url, {
                signal: AbortSignal.timeout(5000),
            });
            return response.ok;
        } catch {
            return false;
        }
    }
}

/**
 * Create a Loki client from environment variables
 */
export function createLokiClientFromEnv(): LokiClient {
    const baseUrl = process.env.LOKI_URL || 'http://localhost:3100';
    const authToken = process.env.LOKI_AUTH_TOKEN;

    return new LokiClient({
        baseUrl,
        authToken,
        defaultLabels: {
            app: 'panoptic',
        },
    });
}

