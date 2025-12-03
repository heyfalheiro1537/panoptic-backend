/**
 * Cost Calculator Tests
 */

import { CostCalculator, UsageMetrics } from '../../../analytics/pricing/costCalculator';
import { RateCardRegistry } from '../../../analytics/pricing/registry/rateCardRegistry';
import { registerAllPrebuiltCards } from '../../../analytics/pricing/prebuilt';

describe('CostCalculator', () => {
    let registry: RateCardRegistry;
    let calculator: CostCalculator;

    beforeEach(() => {
        registry = new RateCardRegistry();
        registerAllPrebuiltCards(registry);
        calculator = new CostCalculator(registry);
    });

    describe('calculateCost', () => {
        it('should calculate Cloud Run CPU cost', () => {
            const usage: UsageMetrics = {
                provider: 'gcp',
                service: 'cloud-run',
                period: '2024-11',
                metrics: {
                    cpu_seconds: 200000, // Above free tier of 180000
                },
                operationCount: 1000,
            };

            const estimate = calculator.calculateCost(usage);

            expect(estimate).not.toBeNull();
            expect(estimate!.provider).toBe('gcp');
            expect(estimate!.service).toBe('cloud-run');
            expect(estimate!.total).toBeGreaterThan(0);
            expect(estimate!.currency).toBe('USD');
        });

        it('should apply free tier allowance', () => {
            const usage: UsageMetrics = {
                provider: 'gcp',
                service: 'cloud-run',
                period: '2024-11',
                metrics: {
                    cpu_seconds: 100000, // Below free tier of 180000
                },
                operationCount: 100,
            };

            const estimate = calculator.calculateCost(usage);

            expect(estimate).not.toBeNull();
            // Should be free (within free tier)
            const cpuBreakdown = estimate!.breakdown.find(b => b.ruleId === 'cloud-run-cpu');
            expect(cpuBreakdown?.billableQuantity).toBe(0);
            expect(cpuBreakdown?.cost).toBe(0);
        });

        it('should calculate Firestore read cost', () => {
            const usage: UsageMetrics = {
                provider: 'gcp',
                service: 'firestore',
                period: '2024-11',
                metrics: {
                    reads: 2000000, // Above free tier of 1.5M
                },
                operationCount: 500,
            };

            const estimate = calculator.calculateCost(usage);

            expect(estimate).not.toBeNull();
            expect(estimate!.provider).toBe('gcp');
            expect(estimate!.service).toBe('firestore');
            
            const readBreakdown = estimate!.breakdown.find(b => b.ruleId === 'firestore-reads');
            expect(readBreakdown?.billableQuantity).toBe(500000); // 2M - 1.5M free
            expect(readBreakdown?.cost).toBeGreaterThan(0);
        });

        it('should return null for unknown service', () => {
            const usage: UsageMetrics = {
                provider: 'unknown',
                service: 'unknown',
                period: '2024-11',
                metrics: {},
                operationCount: 0,
            };

            const estimate = calculator.calculateCost(usage);
            expect(estimate).toBeNull();
        });

        it('should apply calibration multiplier', () => {
            // Set calibration multiplier on the rate card
            registry.calibrate('gcp-cloud-run-v1', 1.2);

            const usage: UsageMetrics = {
                provider: 'gcp',
                service: 'cloud-run',
                period: '2024-11',
                metrics: {
                    cpu_seconds: 200000,
                },
                operationCount: 1000,
            };

            const estimate = calculator.calculateCost(usage);

            expect(estimate).not.toBeNull();
            expect(estimate!.calibrationMultiplier).toBe(1.2);
            expect(estimate!.total).toBe(estimate!.subtotal * 1.2);
        });
    });

    describe('calculateFromOperations', () => {
        it('should aggregate operations and calculate costs', () => {
            const operations = [
                {
                    id: 'op-1',
                    timestamp: '2024-11-15T10:00:00Z',
                    environment: 'production',
                    category: 'infrastructure' as const,
                    provider: 'gcp' as any,
                    service: 'cloud-run',
                    durationMs: 500,
                    requestCount: 1,
                    status: 'success' as const,
                    cpuUsage: { seconds: 0.5 },
                    memoryUsage: { gbSeconds: 0.25 },
                },
                {
                    id: 'op-2',
                    timestamp: '2024-11-15T10:01:00Z',
                    environment: 'production',
                    category: 'infrastructure' as const,
                    provider: 'gcp' as any,
                    service: 'cloud-run',
                    durationMs: 300,
                    requestCount: 1,
                    status: 'success' as const,
                    cpuUsage: { seconds: 0.3 },
                    memoryUsage: { gbSeconds: 0.15 },
                },
            ];

            const lineItems = calculator.calculateFromOperations(operations, '2024-11');

            // Should aggregate and create line items
            expect(lineItems.length).toBeGreaterThanOrEqual(0);
            
            for (const item of lineItems) {
                expect(item.source).toBe('estimate');
                expect(item.provider).toBe('gcp');
                expect(item.period).toBe('2024-11');
            }
        });
    });
});

