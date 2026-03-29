import { describe, it, expect } from 'vitest';
import { generateDailyReport } from '../../../src/domain/systems/daily-report.js';
import type { DailyReportInput } from '../../../src/domain/systems/daily-report.js';
import type { LedgerEntry } from '../../../src/domain/core/component-data.js';

function makeInput(overrides: Partial<DailyReportInput> = {}): DailyReportInput {
	return {
		dayCount: 1,
		summary: { totalWages: 10, totalTax: 3, totalSales: 20, totalConsumption: 5 },
		treasury: 100,
		facilities: [
			{
				name: 'Bakery',
				produced: [{ item: 'bread', qty: 4 }],
				workerName: 'Alice',
				status: 'producing',
			},
		],
		transactions: [
			{
				tick: 10,
				type: 'wage',
				from: 'treasury',
				to: 'Alice',
				itemId: null,
				quantity: 0,
				gold: 5,
			} satisfies LedgerEntry,
		],
		agents: [{ name: 'Alice', gold: 50, goldChange: 5 }],
		...overrides,
	};
}

describe('generateDailyReport', () => {
	it('generates frontmatter with Dataview-queryable fields', () => {
		const { frontmatter } = generateDailyReport(makeInput());
		expect(frontmatter).toContain('day: 1');
		expect(frontmatter).toContain('total_wages: 10');
		expect(frontmatter).toContain('total_tax: 3');
		expect(frontmatter).toContain('total_sales: 20');
		expect(frontmatter).toContain('total_consumption: 5');
		expect(frontmatter).toContain('treasury_balance: 100');
	});

	it('generates body with Production section', () => {
		const { body } = generateDailyReport(makeInput());
		expect(body).toContain('## Production');
		expect(body).toContain('| Bakery | Alice | 4x bread | producing |');
	});

	it('generates body with Transactions section', () => {
		const { body } = generateDailyReport(makeInput());
		expect(body).toContain('## Transactions');
		expect(body).toContain('| 10 | wage | treasury | Alice | - | 5 |');
	});

	it('generates body with Agent Balances section', () => {
		const { body } = generateDailyReport(makeInput());
		expect(body).toContain('## Agent Balances');
		expect(body).toContain('| Alice | 50 | +5 |');
	});

	it('wraps frontmatter in YAML delimiters', () => {
		const { frontmatter } = generateDailyReport(makeInput());
		expect(frontmatter.startsWith('---')).toBe(true);
		expect(frontmatter.endsWith('---')).toBe(true);
	});

	it('includes facility count in frontmatter', () => {
		const input = makeInput({
			facilities: [
				{ name: 'Bakery', produced: [{ item: 'bread', qty: 4 }], workerName: 'Alice', status: 'producing' },
				{ name: 'Mill', produced: [], workerName: null, status: 'idle' },
			],
		});
		const { frontmatter } = generateDailyReport(input);
		expect(frontmatter).toContain('active_facilities: 1');
		expect(frontmatter).toContain('idle_facilities: 1');
	});

	it('handles empty transactions', () => {
		const { body } = generateDailyReport(makeInput({ transactions: [] }));
		expect(body).toContain('No transactions this day.');
		expect(body).not.toContain('| Tick |');
	});
});
