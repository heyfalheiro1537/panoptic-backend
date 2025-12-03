/**
 * Memory Storage - Index
 * 
 * Exports all memory storage implementations.
 */

export { MemoryStatementStore, createMemoryStatementStore } from './memoryStatementStore';
export { MemoryOperationStore, createMemoryOperationStore } from './memoryOperationStore';
export { MemoryBillingStore, createMemoryBillingStore } from './memoryBillingStore';
export { MemoryCalibrationStore, createMemoryCalibrationStore } from './memoryCalibrationStore';

import { IStorage, IStorageFactory } from '../interfaces';
import { MemoryStatementStore } from './memoryStatementStore';
import { MemoryOperationStore } from './memoryOperationStore';
import { MemoryBillingStore } from './memoryBillingStore';
import { MemoryCalibrationStore } from './memoryCalibrationStore';

/**
 * Memory Storage Factory
 */
export class MemoryStorageFactory implements IStorageFactory {
    createOperationStore(): MemoryOperationStore {
        return new MemoryOperationStore();
    }

    createBillingStore(): MemoryBillingStore {
        return new MemoryBillingStore();
    }

    createStatementStore(): MemoryStatementStore {
        return new MemoryStatementStore();
    }

    createCalibrationStore(): MemoryCalibrationStore {
        return new MemoryCalibrationStore();
    }

    createStorage(): IStorage {
        return {
            operations: this.createOperationStore(),
            billing: this.createBillingStore(),
            statements: this.createStatementStore(),
            calibration: this.createCalibrationStore(),
        };
    }
}

/**
 * Create memory storage
 */
export function createMemoryStorage(): IStorage {
    return new MemoryStorageFactory().createStorage();
}

