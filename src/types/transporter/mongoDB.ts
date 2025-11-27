const pino = require('pino')

export const transport = pino.transport({
    target: 'pino-mongodb',
    level: 'info',
    options: {
        uri: 'mongodb://localhost:27017/',
        database: 'logs',
        collection: 'log-collection',
        mongoOptions: {
            auth: {
                username: 'one',
                password: 'two'
            }
        }
    }
})