export const config = {
    appName: process.env.APP_NAME || 'panoptic',
    env: process.env.NODE_ENV || 'development',
    
    loki: {
        host: process.env.LOKI_HOST || '',
        user: process.env.LOKI_USER || '',
        apiKey: process.env.LOKI_API_KEY || '',
        basicAuth: process.env.LOKI_USER && process.env.LOKI_API_KEY 
            ? `${process.env.LOKI_USER}:${process.env.LOKI_API_KEY}`
            : '',
    },
    
    logging: {
        level: process.env.WINSTON_LOG_LEVEL || 'invoice',
        console: process.env.NODE_ENV !== 'production',
    },
};

