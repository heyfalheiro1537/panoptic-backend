#!/usr/bin/env node

/**
 * Panoptic Billing CLI
 * 
 * Command-line interface for managing billing statements and calibration.
 */

import { generateCommand, getCurrentPeriod, getPreviousPeriod } from './commands/generate';
import { viewCommand } from './commands/view';
import { listCommand } from './commands/list';
import { calibrateCommand } from './commands/calibrate';

/**
 * Parse command line arguments
 */
function parseArgs(): { command: string; args: Record<string, string | boolean> } {
    const args = process.argv.slice(2);
    const command = args[0] || 'help';
    const parsedArgs: Record<string, string | boolean> = {};

    for (let i = 1; i < args.length; i++) {
        const arg = args[i];

        if (arg.startsWith('--')) {
            const key = arg.slice(2);
            const nextArg = args[i + 1];

            if (nextArg && !nextArg.startsWith('-')) {
                parsedArgs[key] = nextArg;
                i++;
            } else {
                parsedArgs[key] = true;
            }
        } else if (arg.startsWith('-')) {
            const key = arg.slice(1);
            parsedArgs[key] = true;
        } else {
            // Positional argument (period)
            if (!parsedArgs['period']) {
                parsedArgs['period'] = arg;
            }
        }
    }

    return { command, args: parsedArgs };
}

/**
 * Show help message
 */
function showHelp(): void {
    console.log(`
╔══════════════════════════════════════════════════════════╗
║                  Panoptic Billing CLI                    ║
╚══════════════════════════════════════════════════════════╝

USAGE:
  panoptic <command> [period] [options]

COMMANDS:
  generate <period>   Generate a billing statement
  view <period>       View an existing statement
  list               List all statements
  calibrate <period>  Run calibration analysis
  help               Show this help message

OPTIONS:
  --mock             Use mock data (default: true)
  --format <type>    Output format: pretty|json (default: pretty)
  --save             Save generated statement to store
  --calibrate        Run calibration after generating
  --apply            Apply calibrations automatically
  --min-confidence   Minimum confidence for auto-apply (0-1)

EXAMPLES:
  # Generate statement for November 2024 with mock data
  panoptic generate 2024-11 --mock

  # Generate and calibrate
  panoptic generate 2024-11 --calibrate

  # View existing statement
  panoptic view 2024-11

  # List all statements
  panoptic list

  # Run calibration with auto-apply
  panoptic calibrate 2024-11 --apply

  # Output as JSON
  panoptic generate 2024-11 --format json

PERIOD FORMAT:
  YYYY-MM (e.g., 2024-11 for November 2024)

For more information, visit: https://github.com/panoptic/billing
`);
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
    const { command, args } = parseArgs();

    try {
        switch (command) {
            case 'generate':
            case 'gen':
            case 'g':
                await generateCommand({
                    period: (args['period'] as string) || getPreviousPeriod(),
                    mock: args['mock'] !== false && args['mock'] !== 'false',
                    format: (args['format'] as 'pretty' | 'json') || 'pretty',
                    save: Boolean(args['save']),
                    calibrate: Boolean(args['calibrate']),
                    applyCalibration: Boolean(args['apply']),
                    lokiUrl: args['loki-url'] as string,
                });
                break;

            case 'view':
            case 'v':
                if (!args['period']) {
                    console.error('Period is required. Usage: panoptic view <period>');
                    process.exit(1);
                }
                await viewCommand({
                    period: args['period'] as string,
                    format: (args['format'] as 'pretty' | 'json') || 'pretty',
                });
                break;

            case 'list':
            case 'ls':
            case 'l':
                await listCommand({
                    limit: args['limit'] ? parseInt(args['limit'] as string) : 12,
                    format: (args['format'] as 'pretty' | 'json') || 'pretty',
                });
                break;

            case 'calibrate':
            case 'cal':
            case 'c':
                await calibrateCommand({
                    period: (args['period'] as string) || getPreviousPeriod(),
                    apply: Boolean(args['apply']),
                    minConfidence: args['min-confidence']
                        ? parseFloat(args['min-confidence'] as string)
                        : 0.8,
                    format: (args['format'] as 'pretty' | 'json') || 'pretty',
                    mock: args['mock'] !== false && args['mock'] !== 'false',
                });
                break;

            case 'help':
            case '-h':
            case '--help':
            default:
                showHelp();
                break;
        }
    } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : error);
        process.exit(1);
    }
}

// Run CLI
main().catch(console.error);

