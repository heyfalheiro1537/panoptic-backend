import { Providers } from './providers';
import { ContextMetrics } from './context';

export interface SDKConfig {
  /** Project identifier */
  project?: string;
  /** Environment (defaults to NODE_ENV or 'development') */
  env?: 'production' | 'development' | 'staging';
}

export interface WrapAsyncOptions<T> {
  provider: Providers;
  service: string;
  context?: (result: T) => ContextMetrics;
  onError?: (error: Error) => Record<string, unknown>;
  attributes?: Record<string, string | number | boolean>;
  tags?: string[];
}
