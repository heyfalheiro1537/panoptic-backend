/**
 * Rate Card Registry Tests
 */

import { RateCardRegistry } from '../../../analytics/pricing/registry/rateCardRegistry';
import { RateCard } from '../../../analytics/pricing/types/rateCard';
import { createCloudRunRateCard, createFirestoreRateCard } from '../../../analytics/pricing/prebuilt/gcp';

describe('RateCardRegistry', () => {
    let registry: RateCardRegistry;

    beforeEach(() => {
        registry = new RateCardRegistry();
    });

    describe('register', () => {
        it('should register a rate card', () => {
            const card = createCloudRunRateCard();
            registry.register(card);

            expect(registry.findById(card.id)).toBe(card);
        });

        it('should throw error for duplicate ID', () => {
            const card = createCloudRunRateCard();
            registry.register(card);

            expect(() => registry.register(card)).toThrow('already exists');
        });

        it('should throw error for invalid card', () => {
            const invalidCard = { name: 'test' } as RateCard;

            expect(() => registry.register(invalidCard)).toThrow('must have id');
        });
    });

    describe('find', () => {
        it('should find card by provider and service', () => {
            const card = createCloudRunRateCard();
            registry.register(card);

            const found = registry.find('gcp', 'cloud-run');
            expect(found).toBe(card);
        });

        it('should find card case-insensitively', () => {
            const card = createCloudRunRateCard();
            registry.register(card);

            const found = registry.find('GCP', 'CLOUD-RUN');
            expect(found).toBe(card);
        });

        it('should return undefined for unknown card', () => {
            const found = registry.find('unknown', 'service');
            expect(found).toBeUndefined();
        });
    });

    describe('findById', () => {
        it('should find card by ID', () => {
            const card = createFirestoreRateCard();
            registry.register(card);

            const found = registry.findById('gcp-firestore-v1');
            expect(found).toBe(card);
        });

        it('should return undefined for unknown ID', () => {
            const found = registry.findById('unknown-id');
            expect(found).toBeUndefined();
        });
    });

    describe('list', () => {
        it('should list all registered cards', () => {
            const cloudRun = createCloudRunRateCard();
            const firestore = createFirestoreRateCard();

            registry.register(cloudRun);
            registry.register(firestore);

            const cards = registry.list();
            expect(cards).toHaveLength(2);
            expect(cards).toContain(cloudRun);
            expect(cards).toContain(firestore);
        });

        it('should return empty array when no cards registered', () => {
            expect(registry.list()).toHaveLength(0);
        });
    });

    describe('listFor', () => {
        it('should list cards for a provider', () => {
            const cloudRun = createCloudRunRateCard();
            const firestore = createFirestoreRateCard();

            registry.register(cloudRun);
            registry.register(firestore);

            const gcpCards = registry.listFor('gcp');
            expect(gcpCards).toHaveLength(2);
        });

        it('should return empty array for unknown provider', () => {
            const cards = registry.listFor('unknown');
            expect(cards).toHaveLength(0);
        });
    });

    describe('remove', () => {
        it('should remove a card', () => {
            const card = createCloudRunRateCard();
            registry.register(card);

            const removed = registry.remove(card.id);
            expect(removed).toBe(true);
            expect(registry.findById(card.id)).toBeUndefined();
        });

        it('should return false for unknown card', () => {
            const removed = registry.remove('unknown-id');
            expect(removed).toBe(false);
        });
    });

    describe('calibrate', () => {
        it('should update calibration multiplier', () => {
            const card = createCloudRunRateCard();
            registry.register(card);

            const success = registry.calibrate(card.id, 1.1);
            expect(success).toBe(true);

            const updated = registry.findById(card.id);
            expect(updated?.calibrationMultiplier).toBe(1.1);
        });

        it('should clamp multiplier to max change', () => {
            const card = createCloudRunRateCard();
            registry.register(card);

            // Try to set multiplier way outside allowed range
            registry.calibrate(card.id, 2.0);

            const updated = registry.findById(card.id);
            // Should be clamped to 1.0 + maxChange (0.2) = 1.2
            expect(updated?.calibrationMultiplier).toBeLessThanOrEqual(1.2);
        });

        it('should return false for unknown card', () => {
            const success = registry.calibrate('unknown-id', 1.1);
            expect(success).toBe(false);
        });
    });

    describe('clear', () => {
        it('should remove all cards', () => {
            registry.register(createCloudRunRateCard());
            registry.register(createFirestoreRateCard());

            registry.clear();

            expect(registry.list()).toHaveLength(0);
        });
    });
});

