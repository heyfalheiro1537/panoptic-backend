import 'dotenv/config';
import winston from 'winston';
import LokiTransport from 'winston-loki';
import { Providers } from './providers';
import { config } from '../config/env';

export interface ProviderLoggerContext {
    provider: Providers;
    projectId?: string;
    env?: string;
    service?: string;
}

// Custom log levels for billing events
const customLevels = {
    levels: {
        error: 0,
        warn: 1,
        info: 2,
        http: 3,
        verbose: 4,
        debug: 5,
        silly: 6,
        charge: 7,
        billing: 8,
        quota: 9,
        token_usage: 10,
        invoice: 11,
    },
    colors: {
        error: 'red',
        warn: 'yellow',
        info: 'green',
        http: 'magenta',
        verbose: 'cyan',
        debug: 'blue',
        silly: 'grey',
        charge: 'green bold',
        billing: 'cyan bold',
        quota: 'yellow bold',
        token_usage: 'magenta bold',
        invoice: 'blue bold',
    }
};

// Add custom colors
winston.addColors(customLevels.colors);

// Custom logger type with billing-specific methods
export interface BillingLogger extends winston.Logger {
    info: winston.LeveledLogMethod;
    error: winston.LeveledLogMethod;
    warn: winston.LeveledLogMethod;
    debug: winston.LeveledLogMethod;
    verbose: winston.LeveledLogMethod;
    silly: winston.LeveledLogMethod;
    charge: winston.LeveledLogMethod;
    billing: winston.LeveledLogMethod;
    quota: winston.LeveledLogMethod;
    token_usage: winston.LeveledLogMethod;
    invoice: winston.LeveledLogMethod;
}


export function createProviderLogger(context: ProviderLoggerContext): BillingLogger {
    const env = context.env || config.env;
    
    const transports: winston.transport[] = [
        new LokiTransport({
            host: process.env.LOKI_HOST as string,
            labels: { 
                app: config.appName,
                provider: context.provider,
                env: env,
            },
            json: true,
            basicAuth: `${process.env.LOKI_USER}:${process.env.LOKI_API_KEY}`,
            format: winston.format.json(),
            replaceTimestamp: true,
            onConnectionError: (err) => console.error(err),
        })
    ];

    // Add console transport in non-production
    if (config.env !== 'production') {
        transports.push(new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        }));
    }

    return winston.createLogger({
        levels: customLevels.levels,
        level: "invoice",
        format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json()
        ),
        defaultMeta: {
            projectId: context.projectId,
            service: context.service,
        },
        transports,
    }) as BillingLogger;
}
