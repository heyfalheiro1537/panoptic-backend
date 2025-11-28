export const config = {
    env: process.env.NODE_ENV || 'development',
    mongodb: {
        uri: process.env.MONGODB_URL as string,
        database: `panoptic-${process.env.NODE_ENV || 'development'}`,
    },
    logging: {
        level: process.env.PINO_LOG_LEVEL || 'info',
    }
};

