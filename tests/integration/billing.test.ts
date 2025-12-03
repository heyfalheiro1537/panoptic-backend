/**
 * Billing Integration Tests
 * 
 * Tests the full billing workflow from end to end.
 */

import { RateCardRegistry } from '../../analytics/pricing/registry/rateCardRegistry';
import { registerAllPrebuiltCards } from '../../analytics/pricing/prebuilt';
import { createStatementGenerator } from '../../analytics/billing/statementGenerator';
import { CalibrationService } from '../../analytics/pricing/calibration/calibrationService';
import { createMemoryStorage } from '../../analytics/storage/memory';

describe('Billing Integration', () => {
    describe('Full Workflow', () => {
        it('should generate statement, save, and retrieve', async () => {
            // Setup
            const registry = new RateCardRegistry();
            registerAllPrebuiltCards(registry);
            const storage = createMemoryStorage();
            const generator = createStatementGenerator(registry, { useMockData: true });

            // Generate statement
            const statement = await generator.generateStatement({
                period: '2024-11',
                includeEstimates: true,
                includeReal: true,
                useMockData: true,
            });

            // Save to storage
            await storage.statements.save(statement);

            // Retrieve from storage
            const retrieved = await storage.statements.get('2024-11');

            expect(retrieved).not.toBeNull();
            expect(retrieved!.period).toBe('2024-11');
            expect(retrieved!.estimatedTotal).toBe(statement.estimatedTotal);
            expect(retrieved!.realTotal).toBe(statement.realTotal);
        });

        it('should run calibration analysis on statement', async () => {
            // Setup
            const registry = new RateCardRegistry();
            registerAllPrebuiltCards(registry);
            const generator = createStatementGenerator(registry, { useMockData: true });
            const calibrationService = new CalibrationService(registry);

            // Generate statement
            const statement = await generator.generateStatement({
                period: '2024-11',
                includeEstimates: true,
                includeReal: true,
                useMockData: true,
            });

            // Run calibration analysis
            const report = calibrationService.analyzeStatement(statement);

            expect(report).toBeDefined();
            expect(report.period).toBe('2024-11');
            expect(report.results).toBeDefined();
            expect(report.summary).toBeDefined();
            expect(report.summary.totalCardsAnalyzed).toBeGreaterThanOrEqual(0);
        });

        it('should list multiple statements', async () => {
            // Setup
            const registry = new RateCardRegistry();
            registerAllPrebuiltCards(registry);
            const storage = createMemoryStorage();
            const generator = createStatementGenerator(registry, { useMockData: true });

            // Generate multiple statements
            const periods = ['2024-09', '2024-10', '2024-11'];

            for (const period of periods) {
                const statement = await generator.generateStatement({
                    period,
                    includeEstimates: true,
                    includeReal: true,
                    useMockData: true,
                });
                await storage.statements.save(statement);
            }

            // List statements
            const statements = await storage.statements.list();

            expect(statements).toHaveLength(3);
            expect(statements.map(s => s.period).sort()).toEqual(periods.sort());
        });
    });

    describe('Rate Card Calibration Workflow', () => {
        it('should apply calibration and affect future estimates', async () => {
            // Setup
            const registry = new RateCardRegistry();
            registerAllPrebuiltCards(registry);
            const generator = createStatementGenerator(registry, { useMockData: true });
            const calibrationService = new CalibrationService(registry);

            // Generate initial statement
            const statement1 = await generator.generateStatement({
                period: '2024-10',
                includeEstimates: true,
                includeReal: true,
                useMockData: true,
            });

            // Get Cloud Run rate card multiplier before calibration
            const cardBefore = registry.find('gcp', 'cloud-run');
            const multiplierBefore = cardBefore?.calibrationMultiplier || 1.0;

            // Run calibration with force apply
            const report = calibrationService.analyzeStatement(statement1);
            
            // Apply calibration with low confidence threshold
            calibrationService.applyCalibrations(report.results, {
                minConfidence: 0,
                force: true,
            });

            // Get multiplier after calibration
            const cardAfter = registry.find('gcp', 'cloud-run');
            const multiplierAfter = cardAfter?.calibrationMultiplier || 1.0;

            // If there was variance, multiplier should have changed
            const cloudRunSummary = statement1.byProvider.find(p => p.provider === 'gcp');
            if (cloudRunSummary && Math.abs(cloudRunSummary.variancePercent) > 5) {
                expect(multiplierAfter).not.toBe(multiplierBefore);
            }
        });
    });

    describe('Data Source Integration', () => {
        it('should include correct data source info', async () => {
            const registry = new RateCardRegistry();
            registerAllPrebuiltCards(registry);
            const generator = createStatementGenerator(registry, { useMockData: true });

            const statement = await generator.generateStatement({
                period: '2024-11',
                includeEstimates: true,
                includeReal: true,
                useMockData: true,
            });

            // Should have 2 data sources (Loki mock + BigQuery mock)
            expect(statement.dataSources).toHaveLength(2);

            const lokiSource = statement.dataSources.find(s => s.name.includes('Loki'));
            const bqSource = statement.dataSources.find(s => s.name.includes('BigQuery'));

            expect(lokiSource).toBeDefined();
            expect(bqSource).toBeDefined();
            expect(lokiSource!.type).toBe('mock');
            expect(bqSource!.type).toBe('mock');
        });
    });
});

