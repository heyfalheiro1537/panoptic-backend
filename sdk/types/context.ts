/**
 * Base context - fields that always make sense for cost attribution.
 */
export interface BaseContext {
  tenant_id?: string;
  feature?: string;
}

/**
 * Database operation context for cost calculation.
 */
export interface DatabaseContext extends BaseContext {
  reads?: number;
  writes?: number;
  deletes?: number;
  bytes_scanned?: number;
}

/**
 * Compute operation context for cost calculation.
 */
export interface ComputeContext extends BaseContext {
  cpu_seconds?: number;
  memory_gb_seconds?: number;
  invocations?: number;
}

/**
 * AI operation context for cost calculation.
 */
export interface AIContext extends BaseContext {
  input_tokens?: number;
  output_tokens?: number;
  model?: string;
}

/**
 * Union type for flexibility - use the appropriate context type
 * based on the operation category.
 */
export type ContextMetrics = BaseContext | DatabaseContext | ComputeContext | AIContext;

/**
 * Context propagated automatically via AsyncLocalStorage.
 * Set once in the middleware, available in all wrapped functions.
 */
export interface PropagatedContext {
  tenant_id?: string;
  request_id?: string;
}

