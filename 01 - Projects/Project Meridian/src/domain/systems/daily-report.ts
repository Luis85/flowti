import type { LedgerEntry, DailySummary } from '../core/component-data.js';

export interface DailyReportInput {
	dayCount: number;
	summary: DailySummary;
	treasury: number;
	facilities: {
		name: string;
		produced: { item: string; qty: number }[];
		workerName: string | null;
		status: string;
	}[];
	transactions: LedgerEntry[];
	agents: { name: string; gold: number; goldChange: number }[];
}

export interface DailyReportOutput {
	frontmatter: string;
	body: string;
}

export function generateDailyReport(input: DailyReportInput): DailyReportOutput {
	const activeFacilities = input.facilities.filter(f => f.status === 'producing').length;
	const idleFacilities = input.facilities.length - activeFacilities;
	const itemsProduced = input.facilities.reduce((sum, f) => sum + f.produced.reduce((s, p) => s + p.qty, 0), 0);
	const itemsConsumed = input.transactions.filter(t => t.type === 'consumption').reduce((sum, t) => sum + t.quantity, 0);

	const frontmatter = [
		'---',
		`day: ${String(input.dayCount)}`,
		`total_wages: ${String(input.summary.totalWages)}`,
		`total_tax: ${String(input.summary.totalTax)}`,
		`total_sales: ${String(input.summary.totalSales)}`,
		`total_consumption: ${String(input.summary.totalConsumption)}`,
		`treasury_balance: ${String(input.treasury)}`,
		`active_facilities: ${String(activeFacilities)}`,
		`idle_facilities: ${String(idleFacilities)}`,
		`items_produced: ${String(itemsProduced)}`,
		`items_consumed: ${String(itemsConsumed)}`,
		'---',
	].join('\n');

	const productionRows = input.facilities.map(f => {
		const produced = f.produced.map(p => `${String(p.qty)}x ${p.item}`).join(', ') || 'none';
		return `| ${f.name} | ${f.workerName ?? 'none'} | ${produced} | ${f.status} |`;
	}).join('\n');

	const transactionRows = input.transactions.length > 0
		? input.transactions.map(t =>
			`| ${String(t.tick)} | ${t.type} | ${t.from} | ${t.to} | ${t.itemId ?? '-'} | ${String(t.gold)} |`,
		).join('\n')
		: 'No transactions this day.';

	const agentRows = input.agents.map(a => {
		const changeStr = a.goldChange >= 0 ? `+${String(a.goldChange)}` : String(a.goldChange);
		return `| ${a.name} | ${String(a.gold)} | ${changeStr} |`;
	}).join('\n');

	const body = [
		`# Day ${String(input.dayCount)} Economy Report`,
		'',
		'## Production',
		'| Facility | Worker | Items Produced | Status |',
		'|----------|--------|----------------|--------|',
		productionRows,
		'',
		'## Transactions',
		input.transactions.length > 0
			? [
				'| Tick | Type | From | To | Item | Gold |',
				'|------|------|------|----|------|------|',
				transactionRows,
			].join('\n')
			: 'No transactions this day.',
		'',
		'## Agent Balances',
		'| Agent | Gold | Change |',
		'|-------|------|--------|',
		agentRows,
	].join('\n');

	return { frontmatter, body };
}
