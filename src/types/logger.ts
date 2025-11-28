import pino from 'pino';
import { Providers } from './providers';
import { config } from '../config/env';
import path from 'path';

/**
 * Context for creating provider-specific child loggers
 */
export interface ProviderLoggerContext {
    provider: Providers;
    username: string;
    projectId?: string;
    env?: string;
    service?: string;
}

// Custom log levels for billing events
const customLevels = {
    charge: 34,
    billing: 35,
    quota: 37,
    token_usage: 38,
    invoice: 39,
} as const;

type CustomLevelNames = keyof typeof customLevels;

// Custom logger type with billing-specific methods
export type BillingLogger = pino.Logger<CustomLevelNames> & {
    charge: pino.LogFn;
    billing: pino.LogFn;
    quota: pino.LogFn;
    token_usage: pino.LogFn;
    invoice: pino.LogFn;
};

// Transport configuration - use absolute path for the custom transport
const transportConfig = {
    target: path.join(__dirname, 'transporter', 'mongoDB.js'),
    level: 'info' as const,
    options: {
        uri: config.mongodb.uri,
    }
};

/**
 * Base logger - PRIVATE, not exported
 * All logging should go through child loggers created via createProviderLogger
 */
const baseLogger = pino({
    level: config.logging.level,
    customLevels,
    transport: transportConfig,
});

/**
 * Create a provider-specific child logger with automatic context propagation
 * 
 * The context (provider, username, env, etc.) is automatically included in ALL logs
 * from this child logger. The MongoDB transport reads this context to route logs
 * to the correct database and collection.
 * 
 * @param context - Provider logger context including provider, username, etc.
 * @returns A pino child logger with the context bound
 * 
 * @example
 * const logger = createProviderLogger({
 *     provider: Providers.GOOGLE,
 *     username: 'john_doe',
 *     projectId: 'my-project',
 *     env: 'production',
 *     service: 'BigQuery'
 * });
 * 
 * // All logs from this logger will include the context
 * logger.invoice({ resource: 'queryJob', amount: 0.05 });
 * // Logs to: panoptic-production database, gcp_john_doe collection
 */
export function createProviderLogger(context: ProviderLoggerContext): BillingLogger {
    return baseLogger.child({
        provider: context.provider,
        username: context.username,
        projectId: context.projectId,
        env: context.env || process.env.NODE_ENV || 'development',
        service: context.service,
    }) as BillingLogger;
}
