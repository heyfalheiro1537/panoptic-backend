/**
 * Statement Generator Tests
 */

import { StatementGenerator, createStatementGenerator } from '../../../analytics/billing/statementGenerator';
import { RateCardRegistry } from '../../../analytics/pricing/registry/rateCardRegistry';
import { registerAllPrebuiltCards } from '../../../analytics/pricing/prebuilt';

describe('StatementGenerator', () => {
    let registry: RateCardRegistry;
    let generator: StatementGenerator;

    beforeEach(() => {
        registry = new RateCardRegistry();
        registerAllPrebuiltCards(registry);
        generator = createStatementGenerator(registry, { useMockData: true });
    });

    describe('generateStatement', () => {
        it('should generate a statement with mock data', async () => {
            const statement = await generator.generateStatement({
                period: '2024-11',
                includeEstimates: true,
                includeReal: true,
                useMockData: true,
            });

            expect(statement).toBeDefined();
            expect(statement.period).toBe('2024-11');
            expect(statement.currency).toBe('USD');
            expect(statement.generatedAt).toBeDefined();
        });

        it('should include estimated line items', async () => {
            const statement = await generator.generateStatement({
                period: '2024-11',
                includeEstimates: true,
                includeReal: false,
                useMockData: true,
            });

            expect(statement.estimatedLineItems.length).toBeGreaterThanOrEqual(0);
            expect(statement.realLineItems).toHaveLength(0);
        });

        it('should include real line items', async () => {
            const statement = await generator.generateStatement({
                period: '2024-11',
                includeEstimates: false,
                includeReal: true,
                useMockData: true,
            });

            expect(statement.estimatedLineItems).toHaveLength(0);
            expect(statement.realLineItems.length).toBeGreaterThan(0);
        });

        it('should calculate totals correctly', async () => {
            const statement = await generator.generateStatement({
                period: '2024-11',
                includeEstimates: true,
                includeReal: true,
                useMockData: true,
            });

            // Verify totals match sum of line items
            const estimatedSum = statement.estimatedLineItems.reduce(
                (sum, item) => sum + item.totalCost,
                0
            );
            const realSum = statement.realLineItems.reduce(
                (sum, item) => sum + item.totalCost,
                0
            );

            expect(statement.estimatedTotal).toBeCloseTo(estimatedSum, 2);
            expect(statement.realTotal).toBeCloseTo(realSum, 2);
        });

        it('should calculate variance', async () => {
            const statement = await generator.generateStatement({
                period: '2024-11',
                includeEstimates: true,
                includeReal: true,
                useMockData: true,
            });

            const expectedVariance = statement.realTotal - statement.estimatedTotal;
            expect(statement.variance).toBeCloseTo(expectedVariance, 2);
        });

        it('should aggregate by provider', async () => {
            const statement = await generator.generateStatement({
                period: '2024-11',
                includeEstimates: true,
                includeReal: true,
                useMockData: true,
            });

            expect(statement.byProvider.length).toBeGreaterThan(0);

            for (const provider of statement.byProvider) {
                expect(provider.provider).toBeDefined();
                expect(provider.estimatedTotal).toBeGreaterThanOrEqual(0);
                expect(provider.realTotal).toBeGreaterThanOrEqual(0);
                expect(provider.byService).toBeDefined();
            }
        });

        it('should aggregate by tenant', async () => {
            const statement = await generator.generateStatement({
                period: '2024-11',
                includeEstimates: true,
                includeReal: true,
                useMockData: true,
            });

            expect(statement.byTenant.length).toBeGreaterThan(0);

            for (const tenant of statement.byTenant) {
                expect(tenant.tenantId).toBeDefined();
                expect(tenant.estimatedTotal).toBeGreaterThanOrEqual(0);
                expect(tenant.realTotal).toBeGreaterThanOrEqual(0);
            }
        });

        it('should aggregate by feature', async () => {
            const statement = await generator.generateStatement({
                period: '2024-11',
                includeEstimates: true,
                includeReal: true,
                useMockData: true,
            });

            expect(statement.byFeature.length).toBeGreaterThan(0);

            for (const feature of statement.byFeature) {
                expect(feature.feature).toBeDefined();
                expect(feature.estimatedTotal).toBeGreaterThanOrEqual(0);
                expect(feature.realTotal).toBeGreaterThanOrEqual(0);
            }
        });

        it('should include data sources', async () => {
            const statement = await generator.generateStatement({
                period: '2024-11',
                includeEstimates: true,
                includeReal: true,
                useMockData: true,
            });

            expect(statement.dataSources.length).toBe(2);
            expect(statement.dataSources.some(s => s.type === 'mock')).toBe(true);
        });

        it('should track rate cards used', async () => {
            const statement = await generator.generateStatement({
                period: '2024-11',
                includeEstimates: true,
                includeReal: false,
                useMockData: true,
            });

            // Should have rate cards used if there were estimates
            if (statement.estimatedLineItems.length > 0) {
                expect(statement.rateCardsUsed.length).toBeGreaterThan(0);
            }
        });
    });
});

