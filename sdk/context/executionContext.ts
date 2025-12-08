import { AsyncLocalStorage } from 'node:async_hooks';
import { PropagatedContext } from '../types/context';

const storage = new AsyncLocalStorage<PropagatedContext>();

/**
 * Gets the current propagated context.
 */
export function getExecutionContext(): PropagatedContext | undefined {
  return storage.getStore();
}

/**
 * Executes a function with propagated context.
 * Use in HTTP middleware to isolate context per request.
 */
export function runWithContext<T>(ctx: PropagatedContext, fn: () => T): T {
  const current = storage.getStore() || {};
  return storage.run({ ...current, ...ctx }, fn);
}

/**
 * Captures the current context to restore later.
 * Useful for callbacks that lose context (setTimeout, EventEmitter).
 */
export function captureContext(): <T>(fn: () => T) => T {
  return AsyncLocalStorage.snapshot();
}
