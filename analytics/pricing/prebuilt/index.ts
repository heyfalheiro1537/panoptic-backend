/**
 * Prebuilt Rate Cards - Index
 * 
 * Export all prebuilt rate cards for easy registration.
 */

// GCP Rate Cards
export {
    createCloudRunRateCard,
    createFirestoreRateCard,
    createCloudStorageRateCard,
    createBigQueryRateCard,
    getAllGCPRateCards,
    GCP_SERVICE_MAPPING,
    getGCPRateCardId,
} from './gcp';

import { RateCard } from '../types/rateCard';
import { getAllGCPRateCards } from './gcp';
import { RateCardRegistry } from '../registry/rateCardRegistry';

/**
 * Get all prebuilt rate cards
 */
export function getAllPrebuiltRateCards(): RateCard[] {
    return [
        ...getAllGCPRateCards(),
        // Add other providers here in the future
    ];
}

/**
 * Register all prebuilt rate cards in a registry
 */
export function registerAllPrebuiltCards(registry: RateCardRegistry): void {
    const cards = getAllPrebuiltRateCards();
    for (const card of cards) {
        registry.register(card);
    }
}

/**
 * Create a registry pre-populated with all GCP rate cards
 */
export function createGCPRegistry(): RateCardRegistry {
    const registry = new RateCardRegistry();
    const gcpCards = getAllGCPRateCards();
    for (const card of gcpCards) {
        registry.register(card);
    }
    return registry;
}

