import { Providers } from './providers';
import { ContextMetrics } from './context';

/**
 * Cost event logged after execution of a wrapped function.
 * Final structure sent to Loki.
 */
export interface CostEvent {
  timestamp: string;
  name: string;
  provider: Providers;
  service: string;
  duration_ms: number;
  status: 'success' | 'error';
  tenant_id?: string;
  request_id?: string;
  attributes?: Record<string, string | number | boolean>;
  tags?: string[];
  context?: ContextMetrics;
  error?: {
    message: string;
    type: string;
  };
}

