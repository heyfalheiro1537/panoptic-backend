/**
 * Statement Formatter for CLI
 * 
 * Pretty prints CostStatement to terminal with colors and tables.
 */

import { CostStatement, ProviderCostSummary, TenantCostSummary, FeatureCostSummary } from '../../billing/types/statement';
import { CalibrationReport, CalibrationResult } from '../../pricing/calibration/calibrationService';

/**
 * ANSI color codes for terminal output
 */
const colors = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    bgBlue: '\x1b[44m',
    bgGreen: '\x1b[42m',
    bgRed: '\x1b[41m',
};

/**
 * Statement Formatter
 */
export class StatementFormatter {
    private useColors: boolean;

    constructor(options?: { useColors?: boolean }) {
        this.useColors = options?.useColors ?? true;
    }

    /**
     * Format a cost statement for terminal display
     */
    formatStatement(statement: CostStatement): string {
        const lines: string[] = [];

        // Header
        lines.push(this.formatHeader(statement));
        lines.push('');

        // Summary
        lines.push(this.formatSummary(statement));
        lines.push('');

        // By Provider
        if (statement.byProvider.length > 0) {
            lines.push(this.formatProviderBreakdown(statement.byProvider));
            lines.push('');
        }

        // By Tenant
        if (statement.byTenant.length > 0) {
            lines.push(this.formatTenantBreakdown(statement.byTenant));
            lines.push('');
        }

        // By Feature
        if (statement.byFeature.length > 0) {
            lines.push(this.formatFeatureBreakdown(statement.byFeature));
            lines.push('');
        }

        // Warnings
        if (statement.warnings.length > 0) {
            lines.push(this.formatWarnings(statement.warnings));
            lines.push('');
        }

        // Footer
        lines.push(this.formatFooter(statement));

        return lines.join('\n');
    }

    /**
     * Format header
     */
    private formatHeader(statement: CostStatement): string {
        const title = `Cost Statement: ${this.formatPeriod(statement.period)}`;
        const border = '═'.repeat(60);

        return [
            this.color(`╔${border}╗`, 'cyan'),
            this.color(`║ ${this.color(title, 'bold').padEnd(67)} ║`, 'cyan'),
            this.color(`╚${border}╝`, 'cyan'),
        ].join('\n');
    }

    /**
     * Format summary section
     */
    private formatSummary(statement: CostStatement): string {
        const varianceColor = statement.variance >= 0 ? 'red' : 'green';
        const varianceSign = statement.variance >= 0 ? '+' : '';

        return [
            this.color('┌─ Summary ─────────────────────────────────────────────┐', 'blue'),
            `│ Estimated Total:  ${this.formatCurrency(statement.estimatedTotal).padStart(12)}                   │`,
            `│ Real Total:       ${this.formatCurrency(statement.realTotal).padStart(12)}                   │`,
            `│ Variance:         ${this.color(`${varianceSign}${this.formatCurrency(statement.variance)} (${varianceSign}${statement.variancePercent.toFixed(1)}%)`.padStart(20), varianceColor)}       │`,
            this.color('└────────────────────────────────────────────────────────┘', 'blue'),
        ].join('\n');
    }

    /**
     * Format provider breakdown
     */
    private formatProviderBreakdown(providers: ProviderCostSummary[]): string {
        const lines: string[] = [
            this.color('┌─ By Provider ──────────────────────────────────────────┐', 'magenta'),
            `│ ${'Provider'.padEnd(15)} ${'Estimated'.padStart(12)} ${'Real'.padStart(12)} ${'Variance'.padStart(12)} │`,
            '│ ' + '─'.repeat(53) + ' │',
        ];

        for (const provider of providers) {
            const varianceStr = this.formatVariance(provider.variance, provider.variancePercent);
            lines.push(
                `│ ${provider.provider.padEnd(15)} ${this.formatCurrency(provider.estimatedTotal).padStart(12)} ${this.formatCurrency(provider.realTotal).padStart(12)} ${varianceStr.padStart(12)} │`
            );

            // Show services breakdown
            for (const service of provider.byService) {
                const svcVariance = this.formatVariance(service.variance, service.variancePercent);
                lines.push(
                    `│   ${this.color('└─', 'dim')} ${service.service.padEnd(11)} ${this.formatCurrency(service.estimatedTotal).padStart(12)} ${this.formatCurrency(service.realTotal).padStart(12)} ${svcVariance.padStart(12)} │`
                );
            }
        }

        lines.push(this.color('└────────────────────────────────────────────────────────┘', 'magenta'));
        return lines.join('\n');
    }

    /**
     * Format tenant breakdown
     */
    private formatTenantBreakdown(tenants: TenantCostSummary[]): string {
        const lines: string[] = [
            this.color('┌─ By Tenant ────────────────────────────────────────────┐', 'green'),
            `│ ${'Tenant'.padEnd(18)} ${'Estimated'.padStart(12)} ${'Real'.padStart(12)} ${'Var %'.padStart(8)} │`,
            '│ ' + '─'.repeat(53) + ' │',
        ];

        // Sort by real cost descending
        const sorted = [...tenants].sort((a, b) => b.realTotal - a.realTotal);

        for (const tenant of sorted) {
            const varPct = `${tenant.variancePercent >= 0 ? '+' : ''}${tenant.variancePercent.toFixed(1)}%`;
            lines.push(
                `│ ${tenant.tenantId.padEnd(18)} ${this.formatCurrency(tenant.estimatedTotal).padStart(12)} ${this.formatCurrency(tenant.realTotal).padStart(12)} ${varPct.padStart(8)} │`
            );
        }

        lines.push(this.color('└────────────────────────────────────────────────────────┘', 'green'));
        return lines.join('\n');
    }

    /**
     * Format feature breakdown
     */
    private formatFeatureBreakdown(features: FeatureCostSummary[]): string {
        const lines: string[] = [
            this.color('┌─ By Feature ───────────────────────────────────────────┐', 'yellow'),
            `│ ${'Feature'.padEnd(18)} ${'Estimated'.padStart(12)} ${'Real'.padStart(12)} ${'Var %'.padStart(8)} │`,
            '│ ' + '─'.repeat(53) + ' │',
        ];

        // Sort by real cost descending
        const sorted = [...features].sort((a, b) => b.realTotal - a.realTotal);

        for (const feature of sorted) {
            const varPct = `${feature.variancePercent >= 0 ? '+' : ''}${feature.variancePercent.toFixed(1)}%`;
            lines.push(
                `│ ${feature.feature.padEnd(18)} ${this.formatCurrency(feature.estimatedTotal).padStart(12)} ${this.formatCurrency(feature.realTotal).padStart(12)} ${varPct.padStart(8)} │`
            );
        }

        lines.push(this.color('└────────────────────────────────────────────────────────┘', 'yellow'));
        return lines.join('\n');
    }

    /**
     * Format warnings
     */
    private formatWarnings(warnings: string[]): string {
        const lines: string[] = [
            this.color('┌─ Warnings ─────────────────────────────────────────────┐', 'red'),
        ];

        for (const warning of warnings) {
            // Word wrap long warnings
            const wrapped = this.wordWrap(warning, 52);
            for (const line of wrapped) {
                lines.push(`│ ${this.color('⚠', 'yellow')} ${line.padEnd(51)} │`);
            }
        }

        lines.push(this.color('└────────────────────────────────────────────────────────┘', 'red'));
        return lines.join('\n');
    }

    /**
     * Format footer
     */
    private formatFooter(statement: CostStatement): string {
        const sources = statement.dataSources.map(s => s.name).join(', ');
        return [
            this.color('─'.repeat(58), 'dim'),
            this.color(`Generated: ${statement.generatedAt}`, 'dim'),
            this.color(`Sources: ${sources}`, 'dim'),
            this.color(`Rate Cards: ${statement.rateCardsUsed.join(', ') || 'None'}`, 'dim'),
        ].join('\n');
    }

    /**
     * Format calibration report
     */
    formatCalibrationReport(report: CalibrationReport): string {
        const lines: string[] = [];

        // Header
        lines.push(this.color(`\n╔════════════════════════════════════════════════════════╗`, 'cyan'));
        lines.push(this.color(`║ Calibration Report: ${report.period.padEnd(35)} ║`, 'cyan'));
        lines.push(this.color(`╚════════════════════════════════════════════════════════╝`, 'cyan'));
        lines.push('');

        // Summary
        lines.push(this.color('Summary:', 'bold'));
        lines.push(`  Cards Analyzed: ${report.summary.totalCardsAnalyzed}`);
        lines.push(`  Needing Calibration: ${report.summary.cardsNeedingCalibration}`);
        lines.push(`  Calibrated: ${report.summary.cardsCalibrated}`);
        lines.push(`  Average Variance: ${report.summary.averageVariance.toFixed(1)}%`);
        lines.push('');

        // Results
        if (report.results.length > 0) {
            lines.push(this.color('Rate Card Results:', 'bold'));
            for (const result of report.results) {
                lines.push(this.formatCalibrationResult(result));
            }
            lines.push('');
        }

        // Recommendations
        if (report.recommendations.length > 0) {
            lines.push(this.color('Recommendations:', 'bold'));
            for (const rec of report.recommendations) {
                lines.push(`  • ${rec}`);
            }
        }

        return lines.join('\n');
    }

    /**
     * Format single calibration result
     */
    private formatCalibrationResult(result: CalibrationResult): string {
        const status = result.applied
            ? this.color('✓ Applied', 'green')
            : this.color('○ Pending', 'yellow');

        const variance = `${result.varianceData.variancePercent >= 0 ? '+' : ''}${result.varianceData.variancePercent.toFixed(1)}%`;
        const varianceColor = Math.abs(result.varianceData.variancePercent) > 10 ? 'red' : 'green';

        return [
            `  ${result.rateCardId}`,
            `    Status: ${status}`,
            `    Variance: ${this.color(variance, varianceColor)}`,
            `    Multiplier: ${result.currentMultiplier.toFixed(4)} → ${result.suggestedMultiplier.toFixed(4)}`,
            `    Confidence: ${(result.confidence * 100).toFixed(0)}%`,
            `    Reason: ${result.reason}`,
        ].join('\n');
    }

    /**
     * Format statement list for terminal
     */
    formatStatementList(statements: CostStatement[]): string {
        if (statements.length === 0) {
            return this.color('No statements found.', 'dim');
        }

        const lines: string[] = [
            this.color('┌─ Available Statements ─────────────────────────────────┐', 'blue'),
            `│ ${'Period'.padEnd(10)} ${'Estimated'.padStart(12)} ${'Real'.padStart(12)} ${'Variance'.padStart(12)} │`,
            '│ ' + '─'.repeat(53) + ' │',
        ];

        for (const stmt of statements) {
            const varStr = this.formatVariance(stmt.variance, stmt.variancePercent);
            lines.push(
                `│ ${stmt.period.padEnd(10)} ${this.formatCurrency(stmt.estimatedTotal).padStart(12)} ${this.formatCurrency(stmt.realTotal).padStart(12)} ${varStr.padStart(12)} │`
            );
        }

        lines.push(this.color('└────────────────────────────────────────────────────────┘', 'blue'));
        return lines.join('\n');
    }

    // ─────────────────────────────────────────────────────────
    // Helper Methods
    // ─────────────────────────────────────────────────────────

    /**
     * Apply color to text
     */
    private color(text: string, colorName: keyof typeof colors): string {
        if (!this.useColors) {
            return text;
        }
        return `${colors[colorName]}${text}${colors.reset}`;
    }

    /**
     * Format currency
     */
    private formatCurrency(amount: number): string {
        return `$${amount.toFixed(2)}`;
    }

    /**
     * Format variance with sign
     */
    private formatVariance(variance: number, percent: number): string {
        const sign = variance >= 0 ? '+' : '';
        return `${sign}${percent.toFixed(1)}%`;
    }

    /**
     * Format period for display
     */
    private formatPeriod(period: string): string {
        const [year, month] = period.split('-');
        const months = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
        return `${months[parseInt(month) - 1]} ${year}`;
    }

    /**
     * Word wrap text
     */
    private wordWrap(text: string, maxWidth: number): string[] {
        const words = text.split(' ');
        const lines: string[] = [];
        let currentLine = '';

        for (const word of words) {
            if ((currentLine + ' ' + word).trim().length <= maxWidth) {
                currentLine = (currentLine + ' ' + word).trim();
            } else {
                if (currentLine) {
                    lines.push(currentLine);
                }
                currentLine = word;
            }
        }

        if (currentLine) {
            lines.push(currentLine);
        }

        return lines;
    }
}

/**
 * Create a statement formatter
 */
export function createFormatter(useColors = true): StatementFormatter {
    return new StatementFormatter({ useColors });
}

