/**
 * CLI View Command
 * 
 * View an existing billing statement.
 */

import { createMemoryStatementStore } from '../../storage/memory/memoryStatementStore';
import { StatementFormatter, createFormatter } from '../formatters/statementFormatter';
import { CostStatement } from '../../billing/types/statement';

/**
 * View command options
 */
export interface ViewOptions {
    /** Period to view (YYYY-MM) */
    period: string;
    /** Output format */
    format?: 'pretty' | 'json';
    /** Section to view */
    section?: 'summary' | 'provider' | 'tenant' | 'feature' | 'all';
}

/**
 * View command handler
 */
export async function viewCommand(options: ViewOptions): Promise<void> {
    const {
        period,
        format = 'pretty',
        section = 'all',
    } = options;

    // Validate period format
    if (!/^\d{4}-\d{2}$/.test(period)) {
        console.error('Invalid period format. Use YYYY-MM (e.g., 2024-11)');
        process.exit(1);
    }

    try {
        const store = createMemoryStatementStore();
        const statement = await store.get(period);

        if (!statement) {
            console.error(`No statement found for period ${period}`);
            console.error('Run "panoptic generate <period>" first to generate a statement.');
            process.exit(1);
        }

        if (format === 'json') {
            outputJson(statement, section);
        } else {
            outputPretty(statement, section);
        }

    } catch (error) {
        console.error('Error viewing statement:', error);
        process.exit(1);
    }
}

/**
 * Output statement as JSON
 */
function outputJson(statement: CostStatement, section: string): void {
    let output: object;

    switch (section) {
        case 'summary':
            output = {
                period: statement.period,
                estimatedTotal: statement.estimatedTotal,
                realTotal: statement.realTotal,
                variance: statement.variance,
                variancePercent: statement.variancePercent,
            };
            break;
        case 'provider':
            output = statement.byProvider;
            break;
        case 'tenant':
            output = statement.byTenant;
            break;
        case 'feature':
            output = statement.byFeature;
            break;
        default:
            output = statement;
    }

    console.log(JSON.stringify(output, null, 2));
}

/**
 * Output statement in pretty format
 */
function outputPretty(statement: CostStatement, section: string): void {
    const formatter = createFormatter();

    if (section === 'all') {
        console.log(formatter.formatStatement(statement));
    } else {
        // For specific sections, we still use the full formatter
        // but could be extended to show only specific sections
        console.log(formatter.formatStatement(statement));
    }
}

