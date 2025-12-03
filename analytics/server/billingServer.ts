/**
 * Billing Server - Fastify Server for Panoptic Billing
 * 
 * Provides HTTP endpoints for:
 * - Generating billing statements
 * - Viewing statements
 * - Running calibration
 * - Mock data endpoints for development
 */

import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { RateCardRegistry } from '../pricing/registry/rateCardRegistry';
import { registerAllPrebuiltCards } from '../pricing/prebuilt';
import { createStatementGenerator, StatementGenerator } from '../billing/statementGenerator';
import { CalibrationService, createCalibrationService } from '../pricing/calibration/calibrationService';
import { MockLokiClient } from '../datasources/loki/mockLokiClient';
import { MockBigQuerySimulator, generateMockBillingRecords } from '../providers/gcp/mockBigQuery';
import { createMemoryStorage, MemoryStorageFactory } from '../storage/memory';
import { IStorage } from '../storage/interfaces';
import { CostStatement } from '../billing/types/statement';

/**
 * Server Configuration
 */
export interface BillingServerConfig {
    /** Port to listen on */
    port: number;
    /** Host to bind to */
    host?: string;
    /** Enable mock endpoints */
    enableMockEndpoints?: boolean;
    /** Logger options */
    logger?: boolean | object;
}

/**
 * Server Context
 */
interface ServerContext {
    registry: RateCardRegistry;
    generator: StatementGenerator;
    calibrationService: CalibrationService;
    storage: IStorage;
}

/**
 * Create Billing Server
 */
export async function createBillingServer(config: BillingServerConfig): Promise<FastifyInstance> {
    const {
        port,
        host = '0.0.0.0',
        enableMockEndpoints = true,
        logger = true,
    } = config;

    // Create Fastify instance
    const server = Fastify({ logger });

    // Setup context
    const registry = new RateCardRegistry();
    registerAllPrebuiltCards(registry);

    const storage = createMemoryStorage();
    const generator = createStatementGenerator(registry, { useMockData: true });
    const calibrationService = createCalibrationService(registry);

    const context: ServerContext = {
        registry,
        generator,
        calibrationService,
        storage,
    };

    // Register routes
    registerBillingRoutes(server, context);

    if (enableMockEndpoints) {
        registerMockRoutes(server, context);
    }

    // Health check
    server.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

    // Root info
    server.get('/', async () => ({
        name: 'Panoptic Billing Server',
        version: '0.1.0',
        endpoints: {
            billing: {
                'POST /billing/generate/:period': 'Generate statement',
                'GET /billing/statements/:period': 'Get statement',
                'GET /billing/statements': 'List statements',
                'GET /billing/summary/:period': 'Get summary',
                'POST /billing/calibrate/:period': 'Run calibration',
            },
            mock: enableMockEndpoints ? {
                'GET /mock/bigquery/:period': 'Mock BigQuery data',
                'GET /mock/operations/:period': 'Mock Loki operations',
                'GET /mock/rate-cards': 'List rate cards',
            } : 'Disabled',
        },
    }));

    // Start server
    await server.listen({ port, host });

    return server;
}

/**
 * Register billing routes
 */
function registerBillingRoutes(server: FastifyInstance, context: ServerContext): void {
    const { generator, storage, calibrationService } = context;

    // Generate statement
    server.post<{
        Params: { period: string };
        Querystring: { mock?: string; calibrate?: string };
    }>('/billing/generate/:period', async (request, reply) => {
        const { period } = request.params;
        const useMockData = request.query.mock !== 'false';
        const runCalibration = request.query.calibrate === 'true';

        // Validate period
        if (!/^\d{4}-\d{2}$/.test(period)) {
            return reply.status(400).send({ error: 'Invalid period format. Use YYYY-MM' });
        }

        try {
            // Generate statement
            const statement = await generator.generateStatement({
                period,
                includeEstimates: true,
                includeReal: true,
                useMockData,
            });

            // Save to storage
            await storage.statements.save(statement);

            // Run calibration if requested
            let calibrationReport = null;
            if (runCalibration) {
                calibrationReport = calibrationService.analyzeStatement(statement);
            }

            return {
                success: true,
                statement,
                calibration: calibrationReport,
            };
        } catch (error) {
            request.log.error(error);
            return reply.status(500).send({
                error: 'Failed to generate statement',
                message: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    });

    // Get statement
    server.get<{
        Params: { period: string };
    }>('/billing/statements/:period', async (request, reply) => {
        const { period } = request.params;

        const statement = await storage.statements.get(period);
        if (!statement) {
            return reply.status(404).send({ error: `No statement found for period ${period}` });
        }

        return statement;
    });

    // List statements
    server.get<{
        Querystring: { limit?: string };
    }>('/billing/statements', async (request) => {
        const limit = request.query.limit ? parseInt(request.query.limit) : 12;
        const statements = await storage.statements.list({ limit });

        return {
            count: statements.length,
            statements: statements.map(s => ({
                period: s.period,
                estimatedTotal: s.estimatedTotal,
                realTotal: s.realTotal,
                variance: s.variance,
                variancePercent: s.variancePercent,
                generatedAt: s.generatedAt,
            })),
        };
    });

    // Get summary
    server.get<{
        Params: { period: string };
    }>('/billing/summary/:period', async (request, reply) => {
        const { period } = request.params;

        const statement = await storage.statements.get(period);
        if (!statement) {
            return reply.status(404).send({ error: `No statement found for period ${period}` });
        }

        return {
            period: statement.period,
            estimatedTotal: statement.estimatedTotal,
            realTotal: statement.realTotal,
            variance: statement.variance,
            variancePercent: statement.variancePercent,
            byProvider: statement.byProvider.map(p => ({
                provider: p.provider,
                estimated: p.estimatedTotal,
                real: p.realTotal,
                variance: p.variancePercent,
            })),
            byTenant: statement.byTenant.map(t => ({
                tenant: t.tenantId,
                estimated: t.estimatedTotal,
                real: t.realTotal,
            })),
            byFeature: statement.byFeature.map(f => ({
                feature: f.feature,
                estimated: f.estimatedTotal,
                real: f.realTotal,
            })),
            warnings: statement.warnings,
        };
    });

    // Run calibration
    server.post<{
        Params: { period: string };
        Querystring: { apply?: string; minConfidence?: string };
    }>('/billing/calibrate/:period', async (request, reply) => {
        const { period } = request.params;
        const applyCalibration = request.query.apply === 'true';
        const minConfidence = request.query.minConfidence
            ? parseFloat(request.query.minConfidence)
            : 0.8;

        // Get or generate statement
        let statement = await storage.statements.get(period);

        if (!statement) {
            // Generate statement first
            statement = await generator.generateStatement({
                period,
                includeEstimates: true,
                includeReal: true,
                useMockData: true,
            });
            await storage.statements.save(statement);
        }

        // Run calibration analysis
        let report = calibrationService.analyzeStatement(statement);

        // Apply if requested
        if (applyCalibration) {
            report.results = calibrationService.applyCalibrations(report.results, {
                minConfidence,
            });
        }

        return {
            success: true,
            applied: applyCalibration,
            report,
        };
    });
}

/**
 * Register mock data routes
 */
function registerMockRoutes(server: FastifyInstance, context: ServerContext): void {
    const { registry } = context;

    // Mock BigQuery data
    server.get<{
        Params: { period: string };
        Querystring: { seed?: string };
    }>('/mock/bigquery/:period', async (request) => {
        const { period } = request.params;
        const seed = request.query.seed ? parseInt(request.query.seed) : undefined;

        const records = generateMockBillingRecords(period, { seed });

        return {
            period,
            recordCount: records.length,
            totalCost: records.reduce((sum, r) => sum + r.cost, 0),
            records,
        };
    });

    // Mock Loki operations
    server.get<{
        Params: { period: string };
        Querystring: { seed?: string; limit?: string };
    }>('/mock/operations/:period', async (request) => {
        const { period } = request.params;
        const seed = request.query.seed ? parseInt(request.query.seed) : undefined;
        const limit = request.query.limit ? parseInt(request.query.limit) : 1000;

        const mockClient = new MockLokiClient({ seed });
        const operations = await mockClient.queryPeriod(period, { limit });

        return {
            period,
            operationCount: operations.length,
            operations,
        };
    });

    // List rate cards
    server.get('/mock/rate-cards', async () => {
        const cards = registry.list();

        return {
            count: cards.length,
            cards: cards.map(c => ({
                id: c.id,
                name: c.name,
                provider: c.provider,
                service: c.service,
                calibrationMultiplier: c.calibrationMultiplier,
                rulesCount: c.rules.length,
            })),
        };
    });

    // Get specific rate card
    server.get<{
        Params: { id: string };
    }>('/mock/rate-cards/:id', async (request, reply) => {
        const { id } = request.params;
        const card = registry.findById(id);

        if (!card) {
            return reply.status(404).send({ error: `Rate card not found: ${id}` });
        }

        return card;
    });
}

/**
 * Default export for convenience
 */
export default createBillingServer;

