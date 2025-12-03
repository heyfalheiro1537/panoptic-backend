import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Generic execution-scoped metadata store built on AsyncLocalStorage.
 *
 * This is intentionally framework-agnostic: any layer (HTTP, queue,
 * cron, etc.) can attach key/value pairs that will later be merged
 * into BillingEvent.metadata by the SDK.
 */

export type ExecutionMetadata = Record<string, any>;

const storage = new AsyncLocalStorage<ExecutionMetadata>();

/**
 * Get the current execution metadata, if any.
 */

export function getExecutionMetadata(): ExecutionMetadata | undefined {
    return storage.getStore();
}

/**
 * Merge additional metadata into the current execution context.
 *
 * If no context exists yet, this will create one.
 */

export function setExecutionMetadata(meta: ExecutionMetadata): void {
    const current = storage.getStore() || {};
    const merged = { ...current, ...meta };
    storage.enterWith(merged);
}

/**
 * Run a function within a specific execution metadata context.
 *
 * Any wrapped/async calls inside `fn` will be able to read this metadata
 * via getExecutionMetadata().
 */

export function withExecutionMetadata<T>(
    meta: ExecutionMetadata,
    fn: () => T
): T {
    const current = storage.getStore() || {};
    const merged = { ...current, ...meta };
    return storage.run(merged, fn);
}


