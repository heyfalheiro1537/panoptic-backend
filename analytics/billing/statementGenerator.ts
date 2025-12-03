/**
 * Statement Generator for Panoptic Billing System
 * 
 * Orchestrates the billing process:
 * 1. Fetch operations from Loki
 * 2. Apply rate cards to estimate costs
 * 3. Import real costs from GCP BigQuery
 * 4. Generate unified CostStatement with variance analysis
 */

import {
    CostStatement,
    StatementGenerationOptions,
    DEFAULT_STATEMENT_OPTIONS,
    ProviderCostSummary,
    ServiceCostSummary,
    TenantCostSummary,
    FeatureCostSummary,
    DataSourceInfo,
    createEmptyStatement,
    calculateVariancePercent,
} from './types/statement';
import { LineItem } from './types/lineItem';
import { OperationRecord, getPeriodBounds } from '../types/operation';
import { RateCardRegistry } from '../pricing/registry/rateCardRegistry';
import { CostCalculator } from '../pricing/costCalculator';
import { GCPBillingProcessor } from '../providers/gcp/billingProcessor';
import { GCPBillingRecord } from '../providers/gcp/types/billingRecord';
import { LokiClient } from '../datasources/loki/lokiClient';
import { MockLokiClient } from '../datasources/loki/mockLokiClient';
import { MockBigQuerySimulator } from '../providers/gcp/mockBigQuery';

/**
 * Statement Generator Configuration
 */
export interface StatementGeneratorConfig {
    /** Rate card registry */
    registry: RateCardRegistry;
    /** Loki client (real or mock) */
    lokiClient?: LokiClient | MockLokiClient;
    /** GCP billing processor */
    gcpProcessor?: GCPBillingProcessor;
    /** Mock BigQuery simulator */
    mockBigQuery?: MockBigQuerySimulator;
}

/**
 * Statement Generator - Main orchestrator for billing
 */
export class StatementGenerator {
    private registry: RateCardRegistry;
    private calculator: CostCalculator;
    private lokiClient?: LokiClient | MockLokiClient;
    private gcpProcessor: GCPBillingProcessor;
    private mockBigQuery?: MockBigQuerySimulator;

    constructor(config: StatementGeneratorConfig) {
        this.registry = config.registry;
        this.calculator = new CostCalculator(config.registry);
        this.lokiClient = config.lokiClient;
        this.gcpProcessor = config.gcpProcessor || new GCPBillingProcessor();
        this.mockBigQuery = config.mockBigQuery;
    }

    /**
     * Generate a cost statement for a period
     */
    async generateStatement(
        options: StatementGenerationOptions
    ): Promise<CostStatement> {
        const { period, includeEstimates, includeReal, useMockData } = {
            ...DEFAULT_STATEMENT_OPTIONS,
            ...options,
        };

        const statement = createEmptyStatement(period);
        const dataSources: DataSourceInfo[] = [];

        // Track rate cards used
        const rateCardsUsed = new Set<string>();

        // 1. Generate estimated line items from operations
        if (includeEstimates) {
            const { lineItems, dataSource } = await this.generateEstimatedLineItems(
                period,
                useMockData
            );

            statement.estimatedLineItems = lineItems;
            statement.lineItems.push(...lineItems);
            dataSources.push(dataSource);

            // Track rate cards used
            for (const item of lineItems) {
                if (item.rateCardId) {
                    rateCardsUsed.add(item.rateCardId);
                }
            }
        }

        // 2. Import real costs from GCP billing
        if (includeReal) {
            const { lineItems, dataSource } = await this.generateRealLineItems(
                period,
                useMockData
            );

            statement.realLineItems = lineItems;
            statement.lineItems.push(...lineItems);
            dataSources.push(dataSource);
        }

        // 3. Calculate totals
        statement.estimatedTotal = this.sumCosts(statement.estimatedLineItems);
        statement.realTotal = this.sumCosts(statement.realLineItems);
        statement.variance = statement.realTotal - statement.estimatedTotal;
        statement.variancePercent = calculateVariancePercent(
            statement.estimatedTotal,
            statement.realTotal
        );

        // 4. Generate breakdowns
        statement.byProvider = this.aggregateByProvider(statement);
        statement.byTenant = this.aggregateByTenant(statement);
        statement.byFeature = this.aggregateByFeature(statement);

        // 5. Set metadata
        statement.dataSources = dataSources;
        statement.rateCardsUsed = Array.from(rateCardsUsed);

        // 6. Add warnings
        statement.warnings = this.generateWarnings(statement);

        return statement;
    }

    /**
     * Generate estimated line items from Loki operations
     */
    private async generateEstimatedLineItems(
        period: string,
        useMockData: boolean
    ): Promise<{ lineItems: LineItem[]; dataSource: DataSourceInfo }> {
        const bounds = getPeriodBounds(period);
        let operations: OperationRecord[] = [];
        let sourceType: 'loki' | 'mock' = 'loki';

        // Fetch operations from Loki or mock
        if (useMockData || !this.lokiClient) {
            const mockClient = new MockLokiClient();
            operations = await mockClient.queryPeriod(period);
            sourceType = 'mock';
        } else {
            operations = await this.lokiClient.queryPeriod(period);
        }

        // Apply rate cards to calculate estimated costs
        const lineItems = this.calculator.calculateFromOperations(operations, period);

        const dataSource: DataSourceInfo = {
            type: sourceType,
            name: sourceType === 'mock' ? 'Mock Loki' : 'Loki',
            periodStart: bounds.start,
            periodEnd: bounds.end,
            recordCount: operations.length,
            queriedAt: new Date().toISOString(),
        };

        return { lineItems, dataSource };
    }

    /**
     * Generate real line items from GCP billing
     */
    private async generateRealLineItems(
        period: string,
        useMockData: boolean
    ): Promise<{ lineItems: LineItem[]; dataSource: DataSourceInfo }> {
        const bounds = getPeriodBounds(period);
        let billingRecords: GCPBillingRecord[] = [];
        let sourceType: 'bigquery' | 'mock' = 'bigquery';

        // Fetch billing records from BigQuery or mock
        if (useMockData || this.mockBigQuery) {
            const mockBQ = this.mockBigQuery || new MockBigQuerySimulator();
            billingRecords = mockBQ.generateBillingRecords(period);
            sourceType = 'mock';
        }

        // Process billing records into line items
        const lineItems = await this.gcpProcessor.processPeriod(period, billingRecords);

        const dataSource: DataSourceInfo = {
            type: sourceType,
            name: sourceType === 'mock' ? 'Mock BigQuery' : 'GCP BigQuery',
            periodStart: bounds.start,
            periodEnd: bounds.end,
            recordCount: billingRecords.length,
            queriedAt: new Date().toISOString(),
        };

        return { lineItems, dataSource };
    }

    /**
     * Sum costs from line items
     */
    private sumCosts(lineItems: LineItem[]): number {
        return lineItems.reduce((sum, item) => sum + item.totalCost, 0);
    }

    /**
     * Aggregate costs by provider
     */
    private aggregateByProvider(statement: CostStatement): ProviderCostSummary[] {
        const providers = new Map<string, {
            estimated: Map<string, number>;
            real: Map<string, number>;
        }>();

        // Aggregate estimated costs
        for (const item of statement.estimatedLineItems) {
            if (!providers.has(item.provider)) {
                providers.set(item.provider, {
                    estimated: new Map(),
                    real: new Map(),
                });
            }
            const provider = providers.get(item.provider)!;
            const current = provider.estimated.get(item.service) || 0;
            provider.estimated.set(item.service, current + item.totalCost);
        }

        // Aggregate real costs
        for (const item of statement.realLineItems) {
            if (!providers.has(item.provider)) {
                providers.set(item.provider, {
                    estimated: new Map(),
                    real: new Map(),
                });
            }
            const provider = providers.get(item.provider)!;
            const current = provider.real.get(item.service) || 0;
            provider.real.set(item.service, current + item.totalCost);
        }

        // Convert to summary format
        return Array.from(providers.entries()).map(([provider, data]) => {
            const estimatedTotal = Array.from(data.estimated.values()).reduce((a, b) => a + b, 0);
            const realTotal = Array.from(data.real.values()).reduce((a, b) => a + b, 0);

            // Get all services
            const allServices = new Set([
                ...data.estimated.keys(),
                ...data.real.keys(),
            ]);

            const byService: ServiceCostSummary[] = Array.from(allServices).map(service => {
                const estCost = data.estimated.get(service) || 0;
                const realCost = data.real.get(service) || 0;
                return {
                    service,
                    estimatedTotal: estCost,
                    realTotal: realCost,
                    variance: realCost - estCost,
                    variancePercent: calculateVariancePercent(estCost, realCost),
                };
            });

            return {
                provider,
                estimatedTotal,
                realTotal,
                variance: realTotal - estimatedTotal,
                variancePercent: calculateVariancePercent(estimatedTotal, realTotal),
                byService,
            };
        });
    }

    /**
     * Aggregate costs by tenant
     */
    private aggregateByTenant(statement: CostStatement): TenantCostSummary[] {
        const tenants = new Map<string, {
            estimated: number;
            real: number;
            byProvider: Map<string, { estimated: number; real: number }>;
        }>();

        // Helper to get or create tenant entry
        const getOrCreate = (tenantId: string) => {
            if (!tenants.has(tenantId)) {
                tenants.set(tenantId, {
                    estimated: 0,
                    real: 0,
                    byProvider: new Map(),
                });
            }
            return tenants.get(tenantId)!;
        };

        // Aggregate estimated costs
        for (const item of statement.estimatedLineItems) {
            const tenantId = item.tenantId || '_unattributed';
            const tenant = getOrCreate(tenantId);
            tenant.estimated += item.totalCost;

            if (!tenant.byProvider.has(item.provider)) {
                tenant.byProvider.set(item.provider, { estimated: 0, real: 0 });
            }
            tenant.byProvider.get(item.provider)!.estimated += item.totalCost;
        }

        // Aggregate real costs
        for (const item of statement.realLineItems) {
            const tenantId = item.tenantId || '_unattributed';
            const tenant = getOrCreate(tenantId);
            tenant.real += item.totalCost;

            if (!tenant.byProvider.has(item.provider)) {
                tenant.byProvider.set(item.provider, { estimated: 0, real: 0 });
            }
            tenant.byProvider.get(item.provider)!.real += item.totalCost;
        }

        // Convert to summary format
        return Array.from(tenants.entries()).map(([tenantId, data]) => ({
            tenantId,
            estimatedTotal: data.estimated,
            realTotal: data.real,
            variance: data.real - data.estimated,
            variancePercent: calculateVariancePercent(data.estimated, data.real),
            byProvider: Array.from(data.byProvider.entries()).map(([provider, costs]) => ({
                provider,
                estimated: costs.estimated,
                real: costs.real,
            })),
        }));
    }

    /**
     * Aggregate costs by feature
     */
    private aggregateByFeature(statement: CostStatement): FeatureCostSummary[] {
        const features = new Map<string, { estimated: number; real: number }>();

        // Aggregate estimated costs
        for (const item of statement.estimatedLineItems) {
            const feature = item.feature || '_unattributed';
            if (!features.has(feature)) {
                features.set(feature, { estimated: 0, real: 0 });
            }
            features.get(feature)!.estimated += item.totalCost;
        }

        // Aggregate real costs
        for (const item of statement.realLineItems) {
            const feature = item.feature || '_unattributed';
            if (!features.has(feature)) {
                features.set(feature, { estimated: 0, real: 0 });
            }
            features.get(feature)!.real += item.totalCost;
        }

        // Convert to summary format
        return Array.from(features.entries()).map(([feature, data]) => ({
            feature,
            estimatedTotal: data.estimated,
            realTotal: data.real,
            variance: data.real - data.estimated,
            variancePercent: calculateVariancePercent(data.estimated, data.real),
        }));
    }

    /**
     * Generate warnings for the statement
     */
    private generateWarnings(statement: CostStatement): string[] {
        const warnings: string[] = [];

        // High variance warning
        if (Math.abs(statement.variancePercent) > 20) {
            warnings.push(
                `High variance detected: ${statement.variancePercent.toFixed(1)}% difference between estimated and real costs. Consider calibrating rate cards.`
            );
        }

        // No estimated data warning
        if (statement.estimatedLineItems.length === 0) {
            warnings.push('No estimated costs generated. Check Loki connectivity and operation logging.');
        }

        // No real data warning
        if (statement.realLineItems.length === 0) {
            warnings.push('No real costs imported. Check BigQuery billing export configuration.');
        }

        // Unattributed costs warning
        const unattributedEstimated = statement.estimatedLineItems.filter(i => !i.tenantId).length;
        const unattributedReal = statement.realLineItems.filter(i => !i.tenantId).length;

        if (unattributedEstimated > 0 || unattributedReal > 0) {
            warnings.push(
                `${unattributedEstimated + unattributedReal} line items have no tenant attribution. Add tenant_id labels for better cost breakdown.`
            );
        }

        return warnings;
    }
}

/**
 * Create a statement generator with default configuration
 */
export function createStatementGenerator(
    registry: RateCardRegistry,
    options?: {
        useMockData?: boolean;
        lokiUrl?: string;
    }
): StatementGenerator {
    const config: StatementGeneratorConfig = {
        registry,
    };

    if (options?.useMockData) {
        config.lokiClient = new MockLokiClient();
        config.mockBigQuery = new MockBigQuerySimulator();
    } else if (options?.lokiUrl) {
        config.lokiClient = new LokiClient({ baseUrl: options.lokiUrl });
    }

    return new StatementGenerator(config);
}

