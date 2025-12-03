/**
 * CLI Calibrate Command
 * 
 * Run calibration analysis on rate cards.
 */

import { RateCardRegistry } from '../../pricing/registry/rateCardRegistry';
import { registerAllPrebuiltCards } from '../../pricing/prebuilt';
import { CalibrationService, createCalibrationService } from '../../pricing/calibration/calibrationService';
import { createStatementGenerator } from '../../billing/statementGenerator';
import { createFormatter } from '../formatters/statementFormatter';

/**
 * Calibrate command options
 */
export interface CalibrateOptions {
    /** Period to analyze (YYYY-MM) */
    period: string;
    /** Apply calibrations automatically */
    apply?: boolean;
    /** Minimum confidence threshold (0-1) */
    minConfidence?: number;
    /** Output format */
    format?: 'pretty' | 'json';
    /** Use mock data */
    mock?: boolean;
}

/**
 * Calibrate command handler
 */
export async function calibrateCommand(options: CalibrateOptions): Promise<void> {
    const {
        period,
        apply = false,
        minConfidence = 0.8,
        format = 'pretty',
        mock = true,
    } = options;

    // Validate period format
    if (!/^\d{4}-\d{2}$/.test(period)) {
        console.error('Invalid period format. Use YYYY-MM (e.g., 2024-11)');
        process.exit(1);
    }

    console.log(`\nRunning calibration analysis for ${period}...`);
    console.log(`Mode: ${mock ? 'Mock Data' : 'Live Data'}`);
    console.log(`Auto-apply: ${apply}`);
    console.log(`Min confidence: ${(minConfidence * 100).toFixed(0)}%\n`);

    try {
        // Setup registry
        const registry = new RateCardRegistry();
        registerAllPrebuiltCards(registry);

        // Generate statement first (needed for calibration)
        const generator = createStatementGenerator(registry, { useMockData: mock });
        const statement = await generator.generateStatement({
            period,
            includeEstimates: true,
            includeReal: true,
            useMockData: mock,
        });

        // Run calibration
        const calibrationService = createCalibrationService(registry);
        let report = calibrationService.analyzeStatement(statement);

        // Apply if requested
        if (apply) {
            console.log('Applying calibrations...\n');
            report.results = calibrationService.applyCalibrations(report.results, {
                minConfidence,
            });
        }

        // Output results
        if (format === 'json') {
            console.log(JSON.stringify(report, null, 2));
        } else {
            const formatter = createFormatter();
            console.log(formatter.formatCalibrationReport(report));
        }

        // Summary
        console.log('\n' + '─'.repeat(58));
        if (apply) {
            const applied = report.results.filter(r => r.applied).length;
            console.log(`✓ Applied ${applied} calibrations`);
        } else {
            const needsCalibration = report.summary.cardsNeedingCalibration;
            if (needsCalibration > 0) {
                console.log(`${needsCalibration} rate cards need calibration.`);
                console.log('Run with --apply to apply calibrations.');
            } else {
                console.log('All rate cards are within acceptable variance thresholds.');
            }
        }

    } catch (error) {
        console.error('Error running calibration:', error);
        process.exit(1);
    }
}

/**
 * Show calibration history for a rate card
 */
export async function showCalibrationHistory(rateCardId: string): Promise<void> {
    const registry = new RateCardRegistry();
    registerAllPrebuiltCards(registry);

    const calibrationService = createCalibrationService(registry);
    const history = calibrationService.getCalibrationHistory(rateCardId);

    if (history.length === 0) {
        console.log(`No calibration history found for ${rateCardId}`);
        return;
    }

    console.log(`\nCalibration History for ${rateCardId}:`);
    console.log('─'.repeat(60));

    for (const data of history) {
        console.log(`Period: ${data.period}`);
        console.log(`  Estimated: $${data.estimatedTotal.toFixed(2)}`);
        console.log(`  Real: $${data.realTotal.toFixed(2)}`);
        console.log(`  Variance: ${data.variancePercent.toFixed(1)}%`);
        console.log(`  Suggested Multiplier: ${data.suggestedMultiplier.toFixed(4)}`);
        console.log(`  Confidence: ${(data.confidence * 100).toFixed(0)}%`);
        console.log('');
    }

    // Analyze trend
    const trend = calibrationService.analyzeVarianceTrend(rateCardId);
    if (trend) {
        console.log('Trend Analysis:');
        console.log(`  Direction: ${trend.trend}`);
        console.log(`  Average Variance: ${trend.averageVariance.toFixed(1)}%`);
        console.log(`  Data Points: ${trend.dataPoints}`);
    }
}

