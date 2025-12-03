#!/usr/bin/env node

/**
 * Billing Server Entry Point
 * 
 * Starts the Panoptic Billing Server.
 */

import { createBillingServer } from './billingServer';

async function start(): Promise<void> {
    const port = parseInt(process.env.PORT || '3000');
    const host = process.env.HOST || '0.0.0.0';
    const enableMock = process.env.ENABLE_MOCK !== 'false';

    console.log(`
╔══════════════════════════════════════════════════════════╗
║              Panoptic Billing Server                     ║
╚══════════════════════════════════════════════════════════╝
`);

    try {
        const server = await createBillingServer({
            port,
            host,
            enableMockEndpoints: enableMock,
            logger: {
                level: process.env.LOG_LEVEL || 'info',
            },
        });

        console.log(`Server started successfully!`);
        console.log(`
Endpoints:
  - Health:     http://${host}:${port}/health
  - Generate:   POST http://${host}:${port}/billing/generate/:period
  - View:       GET  http://${host}:${port}/billing/statements/:period
  - List:       GET  http://${host}:${port}/billing/statements
  - Summary:    GET  http://${host}:${port}/billing/summary/:period
  - Calibrate:  POST http://${host}:${port}/billing/calibrate/:period
${enableMock ? `
Mock Endpoints:
  - BigQuery:   GET  http://${host}:${port}/mock/bigquery/:period
  - Operations: GET  http://${host}:${port}/mock/operations/:period
  - Rate Cards: GET  http://${host}:${port}/mock/rate-cards
` : ''}
Press Ctrl+C to stop.
`);

        // Handle graceful shutdown
        const shutdown = async () => {
            console.log('\nShutting down server...');
            await server.close();
            console.log('Server stopped.');
            process.exit(0);
        };

        process.on('SIGINT', shutdown);
        process.on('SIGTERM', shutdown);

    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

// Run
start();

