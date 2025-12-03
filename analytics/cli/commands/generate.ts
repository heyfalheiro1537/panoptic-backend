/**
 * CLI Generate Command
 * 
 * Generates a billing statement for a period.
 */

import { StatementGenerator, createStatementGenerator } from '../../billing/statementGenerator';
import { RateCardRegistry } from '../../pricing/registry/rateCardRegistry';
import { registerAllPrebuiltCards } from '../../pricing/prebuilt';
import { createMemoryStatementStore } from '../../storage/memory/memoryStatementStore';
import { StatementFormatter, createFormatter } from '../formatters/statementFormatter';
import { CalibrationService } from '../../pricing/calibration/calibrationService';

/**
 * Generate command options
 */
export interface GenerateOptions {
    /** Period to generate (YYYY-MM) */
    period: string;
    /** Use mock data for development */
    mock?: boolean;
    /** Output format */
    format?: 'pretty' | 'json';
    /** Save statement to store */
    save?: boolean;
    /** Run calibration analysis */
    calibrate?: boolean;
    /** Apply calibration automatically */
    applyCalibration?: boolean;
    /** Loki URL (if not using mock) */
    lokiUrl?: string;
}

/**
 * Generate command handler
 */
export async function generateCommand(options: GenerateOptions): Promise<void> {
    const {
        period,
        mock = true,
        format = 'pretty',
        save = false,
        calibrate = false,
        applyCalibration = false,
        lokiUrl,
    } = options;

    // Validate period format
    if (!/^\d{4}-\d{2}$/.test(period)) {
        console.error('Invalid period format. Use YYYY-MM (e.g., 2024-11)');
        process.exit(1);
    }

    console.log(`\nGenerating billing statement for ${period}...`);
    console.log(`Mode: ${mock ? 'Mock Data' : 'Live Data'}\n`);

    try {
        // Setup registry with prebuilt rate cards
        const registry = new RateCardRegistry();
        registerAllPrebuiltCards(registry);

        console.log(`Loaded ${registry.list().length} rate cards`);

        // Create statement generator
        const generator = createStatementGenerator(registry, {
            useMockData: mock,
            lokiUrl,
        });

        // Generate statement
        console.log('Fetching operations from Loki...');
        console.log('Fetching billing data from BigQuery...');

        const statement = await generator.generateStatement({
            period,
            includeEstimates: true,
            includeReal: true,
            useMockData: mock,
        });

        console.log('Statement generated successfully!\n');

        // Save if requested
        if (save) {
            const store = createMemoryStatementStore();
            await store.save(statement);
            console.log('Statement saved to store.\n');
        }

        // Output statement
        if (format === 'json') {
            console.log(JSON.stringify(statement, null, 2));
        } else {
            const formatter = createFormatter();
            console.log(formatter.formatStatement(statement));
        }

        // Run calibration if requested
        if (calibrate) {
            console.log('\n\nRunning calibration analysis...\n');

            const calibrationService = new CalibrationService(registry);
            const report = calibrationService.analyzeStatement(statement);

            if (applyCalibration) {
                const results = calibrationService.applyCalibrations(report.results);
                report.results = results;
            }

            if (format === 'json') {
                console.log(JSON.stringify(report, null, 2));
            } else {
                const formatter = createFormatter();
                console.log(formatter.formatCalibrationReport(report));
            }
        }

    } catch (error) {
        console.error('Error generating statement:', error);
        process.exit(1);
    }
}

/**
 * Get current period (YYYY-MM)
 */
export function getCurrentPeriod(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
}

/**
 * Get previous period
 */
export function getPreviousPeriod(period?: string): string {
    const [year, month] = (period || getCurrentPeriod()).split('-').map(Number);
    
    if (month === 1) {
        return `${year - 1}-12`;
    }
    
    return `${year}-${String(month - 1).padStart(2, '0')}`;
}

