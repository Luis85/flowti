/**
 * test-data-generators.ts — CSV generator functions for supply chain analytics test data.
 */
import type { Item, Supplier, Customer } from "./test-data-defs.js";
import { ITEMS, SUPPLIERS, CUSTOMERS, CATEGORIES, qtyRange, seasonal } from "./test-data-defs.js";

// ── Types ────────────────────────────────────────────────

export interface YearMonth {
	year: number;
	month: number;
}

// ── Seeded PRNG (Lehmer / Park-Miller) ──────────────────

let seed: number = 42;

export function setSeed(s: number): void { seed = s; }

function rand(): number {
	seed = (seed * 16807 + 0) % 2147483647;
	return (seed - 1) / 2147483646;
}
function pick<T>(arr: T[]): T { return arr[Math.floor(rand() * arr.length)]; }
function randInt(min: number, max: number): number { return min + Math.floor(rand() * (max - min + 1)); }
function randFloat(min: number, max: number, dec: number = 2): number { return +(min + rand() * (max - min)).toFixed(dec); }
function shuffle<T>(arr: T[]): T[] {
	const a: T[] = [...arr];
	for (let i = a.length - 1; i > 0; i--) {
		const j: number = Math.floor(rand() * (i + 1));
		[a[i], a[j]] = [a[j], a[i]];
	}
	return a;
}

// ── Formatting helpers ──────────────────────────────────

function fmt(m: number, d: number, y: number): string {
	return `${String(m).padStart(2, "0")}/${String(d).padStart(2, "0")}/${y}`;
}

function money(n: number): string {
	const s: string = n.toFixed(2);
	const [whole, dec] = s.split(".");
	const withCommas: string = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
	return Number(n) >= 1000 ? `"${withCommas}.${dec}"` : `${whole}.${dec}`;
}

function padId(prefix: string, n: number, width: number = 3): string {
	return `${prefix}${String(n).padStart(width, "0")}`;
}

function lastDay(m: number, y: number): number {
	return new Date(y, m, 0).getDate();
}

function addDays(m: number, d: number, y: number, days: number): { month: number; day: number; year: number } {
	const dt = new Date(y, m - 1, d + days);
	return { month: dt.getMonth() + 1, day: dt.getDate(), year: dt.getFullYear() };
}

// ── File generators ─────────────────────────────────────

export function generateItems(): string {
	const header = "item_id,item_name,category,unit_price";
	const rows: string[] = ITEMS.map((i: Item) =>
		`${i.id},${i.name},${i.category},"${i.price.toFixed(2)}"`
	);
	return [header, ...rows].join("\n") + "\n";
}

export function generateSuppliers(): string {
	const header = "supplier_id,supplier_name,region,country";
	const rows: string[] = SUPPLIERS.map((s: Supplier) => `${s.id},${s.name},${s.region},${s.country}`);
	return [header, ...rows].join("\n") + "\n";
}

export function generateCustomers(): string {
	const header = "customer_id,customer_name,segment,region,credit_limit";
	const rows: string[] = CUSTOMERS.map((c: Customer) => `${c.id},${c.name},${c.segment},${c.region},${c.credit}`);
	return [header, ...rows].join("\n") + "\n";
}

export function generateBudget(allMonths: YearMonth[]): string {
	const header = "budget_month,category,revenue_target,cost_budget,margin_target_pct";
	const rows: string[] = [];

	// Base targets ramp up over time
	const baseBudgets: Record<string, { rev: number; cost: number; margin: number }> = {
		Electronics:       { rev: 18000, cost: 14000, margin: 22 },
		Furniture:         { rev: 4000,  cost: 3000,  margin: 25 },
		"Office Supplies": { rev: 4500,  cost: 3200,  margin: 29 },
	};

	for (let idx = 0; idx < allMonths.length; idx++) {
		const { year, month } = allMonths[idx];
		const yearProgress: number = idx / Math.max(allMonths.length - 1, 1);
		const mult: number = seasonal(month);

		for (const cat of CATEGORIES) {
			const b = baseBudgets[cat];
			const growth: number = 1 + yearProgress * 0.25; // 25% growth across full range
			const rev: number = Math.round(b.rev * mult * growth / 100) * 100;
			const cost: number = Math.round(b.cost * mult * growth / 100) * 100;
			const margin: number = b.margin + Math.round(yearProgress * 6);
			rows.push(`${fmt(month, 1, year)},${cat},${rev},${cost},${margin}`);
		}
	}

	return [header, ...rows].join("\n") + "\n";
}

export function generateSales(allMonths: YearMonth[]): string {
	const header = "sale_date,item_id,supplier_id,quantity,unit_cost,total_cost";
	const rows: string[] = [];

	for (const { year, month } of allMonths) {
		const ld: number = lastDay(month, year);
		const numSales: number = randInt(8, 11);
		const items: Item[] = shuffle(ITEMS).slice(0, numSales);

		for (let i = 0; i < numSales; i++) {
			const day: number = Math.min(2 + Math.floor(i * ld / numSales) + randInt(0, 2), ld);
			const item: Item = items[i];
			const supplier: string = pick(SUPPLIERS).id;
			const cost: number = randFloat(item.cost * 0.95, item.cost * 1.05);
			const [qMin, qMax] = qtyRange(item);
			const qty: number = randInt(qMin, qMax);
			const total: number = +(qty * cost).toFixed(2);
			rows.push(`${fmt(month, day, year)},${item.id},${supplier},${qty},${money(cost)},${money(total)}`);
		}
	}

	return [header, ...rows].join("\n") + "\n";
}

export function generateCustomerOrders(allMonths: YearMonth[]): string {
	const header = "order_id,order_date,customer_id,item_id,quantity,unit_price,discount_pct,total_amount";
	const rows: string[] = [];
	let ordNum: number = 1;

	const discounts: number[] = [0, 0, 0, 5, 5, 8, 10, 12, 15];

	for (const { year, month } of allMonths) {
		const ld: number = lastDay(month, year);
		const numOrders: number = randInt(8, 12);

		for (let i = 0; i < numOrders; i++) {
			const day: number = Math.min(2 + Math.floor(i * ld / numOrders) + randInt(0, 2), ld);
			const customer: Customer = pick(CUSTOMERS);
			const item: Item = pick(ITEMS);
			const [qMin, qMax] = qtyRange(item);
			const qty: number = randInt(Math.ceil(qMin * 0.3), Math.ceil(qMax * 0.7));
			const price: number = item.price;
			const discPct: number = pick(discounts);
			const total: number = +(qty * price * (1 - discPct / 100)).toFixed(2);
			const ordId: string = padId("ORD-", ordNum++);
			rows.push(`${ordId},${fmt(month, day, year)},${customer.id},${item.id},${qty},${price.toFixed(2)},${discPct},${money(total)}`);
		}
	}

	return [header, ...rows].join("\n") + "\n";
}

export function generateInventory(allMonths: YearMonth[]): string {
	const header = "snapshot_date,item_id,supplier_id,qty_on_hand,reorder_point,safety_stock,avg_daily_sales,unit_cost";
	const rows: string[] = [];

	// Base inventory levels and parameters
	const params: Record<string, { qty: number; reorder: number; safety: number; avgSales: number }> = {
		"ITM-001": { qty: 450, reorder: 200, safety: 100, avgSales: 4.7 },
		"ITM-002": { qty: 140, reorder: 80,  safety: 40,  avgSales: 1.7 },
		"ITM-003": { qty: 280, reorder: 120, safety: 60,  avgSales: 3.2 },
		"ITM-004": { qty: 65,  reorder: 30,  safety: 15,  avgSales: 1.2 },
		"ITM-005": { qty: 85,  reorder: 40,  safety: 20,  avgSales: 1.5 },
		"ITM-006": { qty: 2200,reorder: 500, safety: 250, avgSales: 17.5 },
		"ITM-007": { qty: 480, reorder: 300, safety: 150, avgSales: 6.7 },
		"ITM-008": { qty: 300, reorder: 200, safety: 100, avgSales: 10.3 },
		"ITM-009": { qty: 55,  reorder: 25,  safety: 12,  avgSales: 1.0 },
		"ITM-010": { qty: 220, reorder: 100, safety: 50,  avgSales: 2.3 },
		"ITM-011": { qty: 380, reorder: 150, safety: 75,  avgSales: 7.0 },
		"ITM-012": { qty: 35,  reorder: 20,  safety: 10,  avgSales: 0.6 },
	};

	const currentQty: Record<string, number> = {};
	for (const item of ITEMS) currentQty[item.id] = params[item.id].qty;

	for (const { year, month } of allMonths) {
		const ld: number = lastDay(month, year);

		for (const item of ITEMS) {
			const p = params[item.id];
			let qty: number = currentQty[item.id];

			// Simulate monthly consumption and restocking
			const sold: number = Math.round(p.avgSales * ld * randFloat(0.7, 1.3, 1));
			qty -= sold;
			if (qty < p.reorder) {
				qty += Math.round(p.reorder * randFloat(1.5, 3.0, 1));
			}
			qty = Math.max(qty, Math.round(p.safety * 0.5));
			currentQty[item.id] = qty;

			const cost: number = randFloat(item.cost * 0.96, item.cost * 1.04);
			const avgSales: number = randFloat(p.avgSales * 0.8, p.avgSales * 1.2, 1);

			rows.push(`${fmt(month, ld, year)},${item.id},${item.supplier},${qty},${p.reorder},${p.safety},${avgSales},${cost.toFixed(2)}`);
		}
	}

	return [header, ...rows].join("\n") + "\n";
}

export function generatePurchaseOrders(allMonths: YearMonth[]): string {
	const header = "po_id,po_date,item_id,supplier_id,qty_ordered,unit_cost,total_cost,expected_delivery_date,status";
	const rows: string[] = [];
	let poNum: number = 1;

	// Cutoff dates for status assignment
	const lastMonth: YearMonth = allMonths[allMonths.length - 1];
	const cutoffReceived: YearMonth = { year: lastMonth.year, month: lastMonth.month - 3 };
	const cutoffPartial: YearMonth = { year: lastMonth.year, month: lastMonth.month - 1 };

	for (const { year, month } of allMonths) {
		const ld: number = lastDay(month, year);
		const numPOs: number = randInt(8, 12);

		for (let i = 0; i < numPOs; i++) {
			const day: number = Math.min(2 + Math.floor(i * ld / numPOs) + randInt(0, 2), ld);
			const item: Item = pick(ITEMS);
			const supplier: string = item.supplier;
			const cost: number = randFloat(item.cost * 0.95, item.cost * 1.05);
			const [qMin, qMax] = qtyRange(item);
			const qty: number = randInt(qMin, qMax);
			const total: number = +(qty * cost).toFixed(2);

			// Delivery: 10-25 days after PO date
			const deliv = addDays(month, day, year, randInt(10, 25));
			const delivFmt: string = fmt(deliv.month, deliv.day, deliv.year);

			// Status based on age relative to end of range
			let status: string;
			const ym: number = year * 100 + month;
			const cutR: number = cutoffReceived.year * 100 + cutoffReceived.month;
			const cutP: number = cutoffPartial.year * 100 + cutoffPartial.month;

			if (ym <= cutR) status = "received";
			else if (ym <= cutP) status = pick(["received", "received", "partial"]);
			else status = pick(["partial", "open", "open"]);

			const poId: string = padId("PO-", poNum++);
			rows.push(`${poId},${fmt(month, day, year)},${item.id},${supplier},${qty},${cost.toFixed(2)},${money(total)},${delivFmt},${status}`);
		}
	}

	return [header, ...rows].join("\n") + "\n";
}
