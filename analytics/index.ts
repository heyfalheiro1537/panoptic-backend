/**
 * Panoptic Analytics - Main Exports
 * 
 * Provides billing analytics with rate card estimation,
 * GCP billing import, and calibration.
 */

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────

// Rate Card Types
export type {
    PricingUnit,
    VolumeTier,
    PricingRule,
    RateCard,
    CostEstimate,
    CostBreakdownItem,
    TierBreakdownItem,
    CostEstimatorConfig,
    CalibrationData,
    CalibrationConfig,
} from './pricing/types/rateCard';

export {
    DEFAULT_COST_ESTIMATOR_CONFIG,
    DEFAULT_CALIBRATION_CONFIG,
} from './pricing/types/rateCard';

// Line Item Types
export type {
    LineItem,
    LineItemSource,
    AggregatedLineItem,
    LineItemFilter,
} from './billing/types/lineItem';

export { createLineItemId } from './billing/types/lineItem';

// Statement Types
export type {
    CostStatement,
    ProviderCostSummary,
    ServiceCostSummary,
    TenantCostSummary,
    FeatureCostSummary,
    DataSourceInfo,
    StatementGenerationOptions,
} from './billing/types/statement';

export {
    DEFAULT_STATEMENT_OPTIONS,
    calculateVariancePercent,
    createEmptyStatement,
} from './billing/types/statement';

// Operation Types
export type {
    OperationRecord,
    OperationAggregation,
    OperationQueryOptions,
} from './types/operation';

export {
    billingEventToOperation,
    getPeriodFromTimestamp,
    getPeriodBounds,
} from './types/operation';

// GCP Types
export type {
    GCPBillingRecord,
    GCPLabel,
    GCPCredit,
    SimplifiedGCPRecord,
} from './providers/gcp/types/billingRecord';

export {
    GCP_SERVICE_IDS,
    GCP_SERVICE_NAMES,
    GCP_LABEL_KEYS,
    extractTenantId,
    extractFeature,
    simplifyGCPRecord,
} from './providers/gcp/types/billingRecord';

// ─────────────────────────────────────────────────────────
// Pricing
// ─────────────────────────────────────────────────────────

// Registry
export {
    RateCardRegistry,
    getGlobalRegistry,
    resetGlobalRegistry,
} from './pricing/registry/rateCardRegistry';

export type { IRateCardRegistry } from './pricing/registry/rateCardRegistry';

// Calculator
export { CostCalculator } from './pricing/costCalculator';
export type { UsageMetrics } from './pricing/costCalculator';

// Prebuilt Rate Cards
export {
    createCloudRunRateCard,
    createFirestoreRateCard,
    createCloudStorageRateCard,
    createBigQueryRateCard,
    getAllGCPRateCards,
    GCP_SERVICE_MAPPING,
    getGCPRateCardId,
} from './pricing/prebuilt/gcp';

export {
    getAllPrebuiltRateCards,
    registerAllPrebuiltCards,
    createGCPRegistry,
} from './pricing/prebuilt';

// ─────────────────────────────────────────────────────────
// Calibration
// ─────────────────────────────────────────────────────────

export {
    CalibrationService,
    createCalibrationService,
} from './pricing/calibration/calibrationService';

export type {
    CalibrationResult,
    CalibrationReport,
} from './pricing/calibration/calibrationService';

// ─────────────────────────────────────────────────────────
// Billing
// ─────────────────────────────────────────────────────────

export {
    StatementGenerator,
    createStatementGenerator,
} from './billing/statementGenerator';

export type { StatementGeneratorConfig } from './billing/statementGenerator';

// ─────────────────────────────────────────────────────────
// Providers
// ─────────────────────────────────────────────────────────

// GCP
export {
    GCPBillingProcessor,
    createGCPProcessor,
} from './providers/gcp/billingProcessor';

export type { GCPBillingProcessorConfig } from './providers/gcp/billingProcessor';

export {
    MockBigQuerySimulator,
    generateMockBillingRecords,
    createMockBigQuery,
} from './providers/gcp/mockBigQuery';

export type { MockBigQueryConfig } from './providers/gcp/mockBigQuery';

// ─────────────────────────────────────────────────────────
// Datasources
// ─────────────────────────────────────────────────────────

// Loki
export {
    LokiClient,
    createLokiClientFromEnv,
} from './datasources/loki/lokiClient';

export type {
    LokiClientConfig,
    LokiQueryResponse,
    LokiStream,
    ParsedLogEntry,
} from './datasources/loki/lokiClient';

export {
    MockLokiClient,
    createMockLokiClient,
} from './datasources/loki/mockLokiClient';

export type { MockLokiConfig } from './datasources/loki/mockLokiClient';

// ─────────────────────────────────────────────────────────
// Storage
// ─────────────────────────────────────────────────────────

export type {
    IOperationStore,
    IBillingStore,
    IStatementStore,
    ICalibrationStore,
    IStorage,
    IStorageFactory,
} from './storage/interfaces';

export {
    MemoryStatementStore,
    MemoryOperationStore,
    MemoryBillingStore,
    MemoryCalibrationStore,
    MemoryStorageFactory,
    createMemoryStorage,
    createMemoryStatementStore,
    createMemoryOperationStore,
    createMemoryBillingStore,
    createMemoryCalibrationStore,
} from './storage/memory';

// ─────────────────────────────────────────────────────────
// CLI
// ─────────────────────────────────────────────────────────

export { StatementFormatter, createFormatter } from './cli/formatters/statementFormatter';
export { generateCommand, getCurrentPeriod, getPreviousPeriod } from './cli/commands/generate';
export { viewCommand } from './cli/commands/view';
export { listCommand } from './cli/commands/list';
export { calibrateCommand, showCalibrationHistory } from './cli/commands/calibrate';

// ─────────────────────────────────────────────────────────
// Server
// ─────────────────────────────────────────────────────────

export { createBillingServer } from './server/billingServer';
export type { BillingServerConfig } from './server/billingServer';

