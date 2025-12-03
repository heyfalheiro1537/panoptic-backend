/**
 * Storage Interfaces for Panoptic Billing System
 * 
 * Defines interfaces for persisting operations, billing records, and statements.
 */

import { OperationRecord, OperationQueryOptions } from '../types/operation';
import { GCPBillingRecord } from '../providers/gcp/types/billingRecord';
import { CostStatement } from '../billing/types/statement';
import { CalibrationData } from '../pricing/types/rateCard';

/**
 * Operation Store Interface
 * Stores tracked operations from the SDK
 */
export interface IOperationStore {
    /**
     * Save an operation record
     */
    save(operation: OperationRecord): Promise<void>;

    /**
     * Save multiple operation records
     */
    saveBatch(operations: OperationRecord[]): Promise<void>;

    /**
     * Get operations for a billing period
     */
    getByPeriod(period: string): Promise<OperationRecord[]>;

    /**
     * Query operations with filters
     */
    query(options: OperationQueryOptions): Promise<OperationRecord[]>;

    /**
     * Get operation count for a period
     */
    count(period: string): Promise<number>;

    /**
     * Delete operations older than a date
     */
    deleteOlderThan(date: Date): Promise<number>;
}

/**
 * Billing Store Interface
 * Stores imported GCP billing records
 */
export interface IBillingStore {
    /**
     * Save a billing record
     */
    save(record: GCPBillingRecord): Promise<void>;

    /**
     * Save multiple billing records
     */
    saveBatch(records: GCPBillingRecord[]): Promise<void>;

    /**
     * Get billing records for a period
     */
    getByPeriod(period: string): Promise<GCPBillingRecord[]>;

    /**
     * Get billing records by service
     */
    getByService(period: string, serviceId: string): Promise<GCPBillingRecord[]>;

    /**
     * Get total cost for a period
     */
    getTotalCost(period: string): Promise<number>;

    /**
     * Check if billing data exists for a period
     */
    hasPeriod(period: string): Promise<boolean>;

    /**
     * Delete billing records for a period
     */
    deletePeriod(period: string): Promise<number>;
}

/**
 * Statement Store Interface
 * Stores generated cost statements
 */
export interface IStatementStore {
    /**
     * Save a cost statement
     */
    save(statement: CostStatement): Promise<void>;

    /**
     * Get a statement by period
     */
    get(period: string): Promise<CostStatement | null>;

    /**
     * Get the most recent statement
     */
    getLatest(): Promise<CostStatement | null>;

    /**
     * List all statements
     */
    list(options?: { limit?: number; offset?: number }): Promise<CostStatement[]>;

    /**
     * List statement periods
     */
    listPeriods(): Promise<string[]>;

    /**
     * Delete a statement
     */
    delete(period: string): Promise<boolean>;

    /**
     * Check if statement exists
     */
    exists(period: string): Promise<boolean>;
}

/**
 * Calibration Store Interface
 * Stores calibration history for rate cards
 */
export interface ICalibrationStore {
    /**
     * Save calibration data
     */
    save(data: CalibrationData): Promise<void>;

    /**
     * Get calibration history for a rate card
     */
    getHistory(rateCardId: string, limit?: number): Promise<CalibrationData[]>;

    /**
     * Get latest calibration for a rate card
     */
    getLatest(rateCardId: string): Promise<CalibrationData | null>;

    /**
     * Get all calibration data for a period
     */
    getByPeriod(period: string): Promise<CalibrationData[]>;

    /**
     * Delete old calibration data
     */
    deleteOlderThan(date: Date): Promise<number>;
}

/**
 * Combined Storage Interface
 */
export interface IStorage {
    operations: IOperationStore;
    billing: IBillingStore;
    statements: IStatementStore;
    calibration: ICalibrationStore;
}

/**
 * Storage Factory
 */
export interface IStorageFactory {
    createOperationStore(): IOperationStore;
    createBillingStore(): IBillingStore;
    createStatementStore(): IStatementStore;
    createCalibrationStore(): ICalibrationStore;
    createStorage(): IStorage;
}

