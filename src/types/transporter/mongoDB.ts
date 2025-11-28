import build from 'pino-abstract-transport';
import { MongoClient, Db, Collection } from 'mongodb';
import { config } from '../../config/env';

// Cache for collections that have been initialized with indexes
const collectionsCache = new Set<string>();

/**
 * Sanitize collection name: lowercase, replace non-alphanumeric with underscore
 */
function sanitizeCollectionName(provider: string, username: string): string {
    const providerPart = provider
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');

    const userPart = username
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');

    return `${providerPart}_${userPart}`;
}

/**
 * Get database name based on environment
 */
function getDatabaseName(env: string): string {
    return `panoptic-${env || 'development'}`;
}

/**
 * Ensure collection exists with proper indexes (only creates indexes once per collection)
 */
async function ensureCollection(db: Db, collectionName: string): Promise<Collection> {
    const collection = db.collection(collectionName);

    if (!collectionsCache.has(collectionName)) {
        try {
            await collection.createIndex({ ts: -1 });
            await collection.createIndex({ service: 1 });
            await collection.createIndex({ env: 1 });
            await collection.createIndex({ ts: -1, service: 1 });

            collectionsCache.add(collectionName);
        } catch (error) {
            // Indexes might already exist, that's fine
            console.warn(`Index creation warning for ${collectionName}:`, error);
            collectionsCache.add(collectionName);
        }
    }

    return collection;
}

/**
 * Custom Pino transport for MongoDB with dynamic collection routing
 * Routes logs to collections based on provider and username from child logger context
 */
export default async function (opts: any) {
    const mongoUri = opts?.uri || config.mongodb.uri;

    const client = new MongoClient(mongoUri);

    try {
        await client.connect();
        console.log('MongoDB transport connected');
    } catch (error) {
        console.error('Failed to connect to MongoDB:', error);
        throw error;
    }

    return build(async function (source) {
        for await (const obj of source) {
            try {
                // Read context from child logger bindings
                const provider = obj.provider || 'custom';
                const username = obj.username || 'unknown';
                const env = obj.env || 'development';

                // Determine database and collection names
                const dbName = getDatabaseName(env);
                const collectionName = sanitizeCollectionName(provider, username);

                // Get database and collection
                const db = client.db(dbName);
                const collection = await ensureCollection(db, collectionName);

                // Remove _id if present to let MongoDB generate one
                const { _id, ...document } = obj;

                // Insert the log document
                await collection.insertOne(document);
            } catch (error) {
                // Log error but don't break the transport
                console.error('MongoDB transport error:', error);
            }
        }
    }, {
        async close() {
            try {
                await client.close();
                console.log('MongoDB transport disconnected');
            } catch (error) {
                console.error('Error closing MongoDB connection:', error);
            }
        }
    });
}

// Export transport configuration for pino
export const transport = {
    target: './mongoDB',
    level: 'info',
    options: {
        uri: config.mongodb.uri,
    }
};
