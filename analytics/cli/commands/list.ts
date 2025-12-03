/**
 * CLI List Command
 * 
 * List all available billing statements.
 */

import { createMemoryStatementStore } from '../../storage/memory/memoryStatementStore';
import { StatementFormatter, createFormatter } from '../formatters/statementFormatter';

/**
 * List command options
 */
export interface ListOptions {
    /** Maximum number of statements to show */
    limit?: number;
    /** Output format */
    format?: 'pretty' | 'json';
}

/**
 * List command handler
 */
export async function listCommand(options: ListOptions = {}): Promise<void> {
    const {
        limit = 12,
        format = 'pretty',
    } = options;

    try {
        const store = createMemoryStatementStore();
        const statements = await store.list({ limit });

        if (statements.length === 0) {
            console.log('No statements found.');
            console.log('Run "panoptic generate <period>" to generate a statement.');
            return;
        }

        if (format === 'json') {
            const summary = statements.map(s => ({
                period: s.period,
                estimatedTotal: s.estimatedTotal,
                realTotal: s.realTotal,
                variance: s.variance,
                variancePercent: s.variancePercent,
                generatedAt: s.generatedAt,
            }));
            console.log(JSON.stringify(summary, null, 2));
        } else {
            const formatter = createFormatter();
            console.log(formatter.formatStatementList(statements));
        }

    } catch (error) {
        console.error('Error listing statements:', error);
        process.exit(1);
    }
}

