#!/usr/bin/env node
/**
 * Generate supply chain analytics test data CSV files.
 *
 * Produces 8 CSV files for the Analytics Hub test dashboard:
 *   Customers.csv, Suppliers.csv, Items.csv       (static reference data)
 *   Budget.csv, Sales.csv, CustomerOrders.csv,     (date-based transactional)
 *   Inventory.csv, PurchaseOrders.csv
 *
 * Usage:
 *   node scripts/generate-test-data.mjs                          # default: Jan 2025 – today
 *   node scripts/generate-test-data.mjs --from 2024-06 --to 2026-06
 *   node scripts/generate-test-data.mjs --seed 123               # reproducible output
 *   node scripts/generate-test-data.mjs --out ./my-folder        # custom output directory
 *   node scripts/generate-test-data.mjs --dry-run                # preview row counts only
 */
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { resolve, join } from "path";

// ── CLI argument parsing ────────────────────────────────

const args = process.argv.slice(2);

function getArg(name, fallback) {
	const idx = args.indexOf(`--${name}`);
	if (idx === -1 || idx + 1 >= args.length) return fallback;
	return args[idx + 1];
}

function hasFlag(name) {
	return args.includes(`--${name}`);
}

if (hasFlag("help") || hasFlag("h")) {
	console.log(`
Supply Chain Analytics Test Data Generator

Usage:
  node scripts/generate-test-data.mjs [options]

Options:
  --from YYYY-MM   Start month (default: 2025-01)
  --to   YYYY-MM   End month inclusive (default: current month)
  --seed N          PRNG seed for reproducible output (default: 42)
  --out  PATH       Output directory (default: vault test data folder)
  --dry-run         Print row counts without writing files
  --help            Show this help
`);
	process.exit(0);
}

const FROM = getArg("from", "2025-01");
const TO = getArg("to", null);
const SEED_INPUT = Number(getArg("seed", "42"));
const DRY_RUN = hasFlag("dry-run");

// Default output: vault test data folder
import { VAULT_ROOT } from "../src/infrastructure/config.mjs";
const DEFAULT_OUT = join(VAULT_ROOT, "03 - Resources", "Test Data", "Analytics");
const OUT_DIR = resolve(getArg("out", DEFAULT_OUT));

// ── Date range resolution ───────────────────────────────

function parseYearMonth(s) {
	const [y, m] = s.split("-").map(Number);
	return { year: y, month: m };
}

function todayYearMonth() {
	const d = new Date();
	return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

const rangeFrom = parseYearMonth(FROM);
const rangeTo = TO ? parseYearMonth(TO) : todayYearMonth();

/** Enumerate all { year, month } pairs in the range (inclusive). */
function enumerateMonths(from, to) {
	const months = [];
	let y = from.year, m = from.month;
	while (y < to.year || (y === to.year && m <= to.month)) {
		months.push({ year: y, month: m });
		m++;
		if (m > 12) { m = 1; y++; }
	}
	return months;
}

const ALL_MONTHS = enumerateMonths(rangeFrom, rangeTo);

// ── Seeded PRNG (Lehmer / Park-Miller) ──────────────────

let seed = SEED_INPUT;
function rand() {
	seed = (seed * 16807 + 0) % 2147483647;
	return (seed - 1) / 2147483646;
}
function pick(arr) { return arr[Math.floor(rand() * arr.length)]; }
function randInt(min, max) { return min + Math.floor(rand() * (max - min + 1)); }
function randFloat(min, max, dec = 2) { return +(min + rand() * (max - min)).toFixed(dec); }
function shuffle(arr) {
	const a = [...arr];
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(rand() * (i + 1));
		[a[i], a[j]] = [a[j], a[i]];
	}
	return a;
}

// ── Formatting helpers ──────────────────────────────────

function fmt(m, d, y) {
	return `${String(m).padStart(2, "0")}/${String(d).padStart(2, "0")}/${y}`;
}

function money(n) {
	const s = n.toFixed(2);
	const [whole, dec] = s.split(".");
	const withCommas = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
	return Number(n) >= 1000 ? `"${withCommas}.${dec}"` : `${whole}.${dec}`;
}

function padId(prefix, n, width = 3) {
	return `${prefix}${String(n).padStart(width, "0")}`;
}

function lastDay(m, y) {
	return new Date(y, m, 0).getDate();
}

function addDays(m, d, y, days) {
	const dt = new Date(y, m - 1, d + days);
	return { month: dt.getMonth() + 1, day: dt.getDate(), year: dt.getFullYear() };
}

// ── Reference data (static) ─────────────────────────────

const ITEMS = [
	{ id: "ITM-001", name: "Wireless Mouse",          category: "Electronics",      price: 29.99,  cost: 24.50, supplier: "SUP-A" },
	{ id: "ITM-002", name: "Mechanical Keyboard",      category: "Electronics",      price: 89.99,  cost: 72.00, supplier: "SUP-A" },
	{ id: "ITM-003", name: "USB-C Hub",                category: "Electronics",      price: 45.50,  cost: 36.00, supplier: "SUP-C" },
	{ id: "ITM-004", name: "Monitor Stand",            category: "Furniture",         price: 64.00,  cost: 48.00, supplier: "SUP-D" },
	{ id: "ITM-005", name: "Desk Lamp",                category: "Furniture",         price: 38.50,  cost: 29.00, supplier: "SUP-D" },
	{ id: "ITM-006", name: "Notebook A5",              category: "Office Supplies",   price: 4.99,   cost: 3.20,  supplier: "SUP-B" },
	{ id: "ITM-007", name: "Ballpoint Pen (50pk)",     category: "Office Supplies",   price: 12.50,  cost: 8.50,  supplier: "SUP-B" },
	{ id: "ITM-008", name: "Whiteboard Markers (12pk)",category: "Office Supplies",   price: 8.99,   cost: 6.00,  supplier: "SUP-B" },
	{ id: "ITM-009", name: "Standing Desk Mat",        category: "Furniture",         price: 49.99,  cost: 38.00, supplier: "SUP-D" },
	{ id: "ITM-010", name: "Webcam HD",                category: "Electronics",      price: 59.00,  cost: 47.00, supplier: "SUP-A" },
	{ id: "ITM-011", name: "Cable Management Kit",     category: "Electronics",      price: 15.99,  cost: 11.00, supplier: "SUP-E" },
	{ id: "ITM-012", name: "Filing Cabinet",           category: "Furniture",         price: 124.00, cost: 95.00, supplier: "SUP-D" },
];

const SUPPLIERS = [
	{ id: "SUP-A", name: "TechDirect Inc.",           region: "East Coast",  country: "USA" },
	{ id: "SUP-B", name: "OfficePro Supply",          region: "Midwest",     country: "USA" },
	{ id: "SUP-C", name: "GlobalTech Distribution",   region: "West Coast",  country: "USA" },
	{ id: "SUP-D", name: "WorkSpace Solutions",       region: "Southeast",   country: "USA" },
	{ id: "SUP-E", name: "Digital Wholesale Corp.",    region: "Northeast",   country: "USA" },
];

const CUSTOMERS = [
	{ id: "CUST-001", name: "Acme Corp",          segment: "Enterprise",  region: "Northeast",  credit: 50000 },
	{ id: "CUST-002", name: "Beta Industries",    segment: "Mid-Market",  region: "Southeast",  credit: 25000 },
	{ id: "CUST-003", name: "Cascade Solutions",  segment: "SMB",         region: "West Coast", credit: 10000 },
	{ id: "CUST-004", name: "Delta Group",        segment: "Enterprise",  region: "Midwest",    credit: 75000 },
	{ id: "CUST-005", name: "Echo Partners",      segment: "Mid-Market",  region: "Northeast",  credit: 30000 },
	{ id: "CUST-006", name: "Frontier Labs",      segment: "SMB",         region: "West Coast", credit: 12000 },
	{ id: "CUST-007", name: "GlobalEdge Inc.",    segment: "Enterprise",  region: "East Coast", credit: 60000 },
	{ id: "CUST-008", name: "Horizon Systems",    segment: "Mid-Market",  region: "Southeast",  credit: 20000 },
	{ id: "CUST-009", name: "Infinity Tech",      segment: "SMB",         region: "Midwest",    credit: 8000 },
	{ id: "CUST-010", name: "Jupiter Dynamics",   segment: "Enterprise",  region: "Northeast",  credit: 90000 },
];

const CATEGORIES = ["Electronics", "Furniture", "Office Supplies"];

// Quantity profiles per item (for realistic volumes)
function qtyRange(item) {
	switch (item.id) {
		case "ITM-006": return [100, 700];   // cheap office supply, high volume
		case "ITM-007": case "ITM-008": return [50, 350];
		case "ITM-011": return [40, 250];
		case "ITM-012": return [3, 25];       // expensive, low volume
		default: return [15, 160];
	}
}

// Seasonal multiplier per month (1-indexed). Summer ramp, holiday peak, Jan dip.
function seasonal(month) {
	return [0, 0.90, 0.95, 1.00, 1.05, 1.08, 1.10, 1.14, 1.17, 1.12, 1.05, 1.20, 1.28][month];
}

// ── File generators ─────────────────────────────────────

function generateItems() {
	const header = "item_id,item_name,category,unit_price";
	const rows = ITEMS.map(i =>
		`${i.id},${i.name},${i.category},"${i.price.toFixed(2)}"`
	);
	return [header, ...rows].join("\n") + "\n";
}

function generateSuppliers() {
	const header = "supplier_id,supplier_name,region,country";
	const rows = SUPPLIERS.map(s => `${s.id},${s.name},${s.region},${s.country}`);
	return [header, ...rows].join("\n") + "\n";
}

function generateCustomers() {
	const header = "customer_id,customer_name,segment,region,credit_limit";
	const rows = CUSTOMERS.map(c => `${c.id},${c.name},${c.segment},${c.region},${c.credit}`);
	return [header, ...rows].join("\n") + "\n";
}

function generateBudget() {
	const header = "budget_month,category,revenue_target,cost_budget,margin_target_pct";
	const rows = [];

	// Base targets ramp up over time
	const baseBudgets = {
		Electronics:       { rev: 18000, cost: 14000, margin: 22 },
		Furniture:         { rev: 4000,  cost: 3000,  margin: 25 },
		"Office Supplies": { rev: 4500,  cost: 3200,  margin: 29 },
	};

	for (let idx = 0; idx < ALL_MONTHS.length; idx++) {
		const { year, month } = ALL_MONTHS[idx];
		const yearProgress = idx / Math.max(ALL_MONTHS.length - 1, 1);
		const mult = seasonal(month);

		for (const cat of CATEGORIES) {
			const b = baseBudgets[cat];
			const growth = 1 + yearProgress * 0.25; // 25% growth across full range
			const rev = Math.round(b.rev * mult * growth / 100) * 100;
			const cost = Math.round(b.cost * mult * growth / 100) * 100;
			const margin = b.margin + Math.round(yearProgress * 6);
			rows.push(`${fmt(month, 1, year)},${cat},${rev},${cost},${margin}`);
		}
	}

	return [header, ...rows].join("\n") + "\n";
}

function generateSales() {
	const header = "sale_date,item_id,supplier_id,quantity,unit_cost,total_cost";
	const rows = [];

	for (const { year, month } of ALL_MONTHS) {
		const ld = lastDay(month, year);
		const numSales = randInt(8, 11);
		const items = shuffle(ITEMS).slice(0, numSales);

		for (let i = 0; i < numSales; i++) {
			const day = Math.min(2 + Math.floor(i * ld / numSales) + randInt(0, 2), ld);
			const item = items[i];
			const supplier = pick(SUPPLIERS).id;
			const cost = randFloat(item.cost * 0.95, item.cost * 1.05);
			const [qMin, qMax] = qtyRange(item);
			const qty = randInt(qMin, qMax);
			const total = +(qty * cost).toFixed(2);
			rows.push(`${fmt(month, day, year)},${item.id},${supplier},${qty},${money(cost)},${money(total)}`);
		}
	}

	return [header, ...rows].join("\n") + "\n";
}

function generateCustomerOrders() {
	const header = "order_id,order_date,customer_id,item_id,quantity,unit_price,discount_pct,total_amount";
	const rows = [];
	let ordNum = 1;

	const discounts = [0, 0, 0, 5, 5, 8, 10, 12, 15];

	for (const { year, month } of ALL_MONTHS) {
		const ld = lastDay(month, year);
		const numOrders = randInt(8, 12);

		for (let i = 0; i < numOrders; i++) {
			const day = Math.min(2 + Math.floor(i * ld / numOrders) + randInt(0, 2), ld);
			const customer = pick(CUSTOMERS);
			const item = pick(ITEMS);
			const [qMin, qMax] = qtyRange(item);
			const qty = randInt(Math.ceil(qMin * 0.3), Math.ceil(qMax * 0.7));
			const price = item.price;
			const discPct = pick(discounts);
			const total = +(qty * price * (1 - discPct / 100)).toFixed(2);
			const ordId = padId("ORD-", ordNum++);
			rows.push(`${ordId},${fmt(month, day, year)},${customer.id},${item.id},${qty},${price.toFixed(2)},${discPct},${money(total)}`);
		}
	}

	return [header, ...rows].join("\n") + "\n";
}

function generateInventory() {
	const header = "snapshot_date,item_id,supplier_id,qty_on_hand,reorder_point,safety_stock,avg_daily_sales,unit_cost";
	const rows = [];

	// Base inventory levels and parameters
	const params = {
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

	const currentQty = {};
	for (const item of ITEMS) currentQty[item.id] = params[item.id].qty;

	for (const { year, month } of ALL_MONTHS) {
		const ld = lastDay(month, year);

		for (const item of ITEMS) {
			const p = params[item.id];
			let qty = currentQty[item.id];

			// Simulate monthly consumption and restocking
			const sold = Math.round(p.avgSales * ld * randFloat(0.7, 1.3, 1));
			qty -= sold;
			if (qty < p.reorder) {
				qty += Math.round(p.reorder * randFloat(1.5, 3.0, 1));
			}
			qty = Math.max(qty, Math.round(p.safety * 0.5));
			currentQty[item.id] = qty;

			const cost = randFloat(item.cost * 0.96, item.cost * 1.04);
			const avgSales = randFloat(p.avgSales * 0.8, p.avgSales * 1.2, 1);

			rows.push(`${fmt(month, ld, year)},${item.id},${item.supplier},${qty},${p.reorder},${p.safety},${avgSales},${cost.toFixed(2)}`);
		}
	}

	return [header, ...rows].join("\n") + "\n";
}

function generatePurchaseOrders() {
	const header = "po_id,po_date,item_id,supplier_id,qty_ordered,unit_cost,total_cost,expected_delivery_date,status";
	const rows = [];
	let poNum = 1;

	// Cutoff dates for status assignment
	const lastMonth = ALL_MONTHS[ALL_MONTHS.length - 1];
	const cutoffReceived = { year: lastMonth.year, month: lastMonth.month - 3 };
	const cutoffPartial = { year: lastMonth.year, month: lastMonth.month - 1 };

	for (const { year, month } of ALL_MONTHS) {
		const ld = lastDay(month, year);
		const numPOs = randInt(8, 12);

		for (let i = 0; i < numPOs; i++) {
			const day = Math.min(2 + Math.floor(i * ld / numPOs) + randInt(0, 2), ld);
			const item = pick(ITEMS);
			const supplier = item.supplier;
			const cost = randFloat(item.cost * 0.95, item.cost * 1.05);
			const [qMin, qMax] = qtyRange(item);
			const qty = randInt(qMin, qMax);
			const total = +(qty * cost).toFixed(2);

			// Delivery: 10-25 days after PO date
			const deliv = addDays(month, day, year, randInt(10, 25));
			const delivFmt = fmt(deliv.month, deliv.day, deliv.year);

			// Status based on age relative to end of range
			let status;
			const ym = year * 100 + month;
			const cutR = cutoffReceived.year * 100 + cutoffReceived.month;
			const cutP = cutoffPartial.year * 100 + cutoffPartial.month;

			if (ym <= cutR) status = "received";
			else if (ym <= cutP) status = pick(["received", "received", "partial"]);
			else status = pick(["partial", "open", "open"]);

			const poId = padId("PO-", poNum++);
			rows.push(`${poId},${fmt(month, day, year)},${item.id},${supplier},${qty},${cost.toFixed(2)},${money(total)},${delivFmt},${status}`);
		}
	}

	return [header, ...rows].join("\n") + "\n";
}

// ── Main ────────────────────────────────────────────────

const files = [
	{ name: "Customers.csv",      generate: generateCustomers },
	{ name: "Suppliers.csv",      generate: generateSuppliers },
	{ name: "Items.csv",          generate: generateItems },
	{ name: "Budget.csv",         generate: generateBudget },
	{ name: "Sales.csv",          generate: generateSales },
	{ name: "CustomerOrders.csv", generate: generateCustomerOrders },
	{ name: "Inventory.csv",      generate: generateInventory },
	{ name: "PurchaseOrders.csv", generate: generatePurchaseOrders },
];

console.log(`\nSupply Chain Analytics Test Data Generator`);
console.log(`──────────────────────────────────────────`);
console.log(`Range:  ${FROM} to ${rangeTo.year}-${String(rangeTo.month).padStart(2, "0")} (${ALL_MONTHS.length} months)`);
console.log(`Seed:   ${SEED_INPUT}`);
console.log(`Output: ${OUT_DIR}`);
console.log();

if (!DRY_RUN && !existsSync(OUT_DIR)) {
	mkdirSync(OUT_DIR, { recursive: true });
}

let totalRows = 0;

for (const { name, generate } of files) {
	// Reset seed for each file so adding months doesn't change earlier files' data
	seed = SEED_INPUT + name.charCodeAt(0);

	const content = generate();
	const dataRows = content.trimEnd().split("\n").length - 1;
	totalRows += dataRows;

	if (DRY_RUN) {
		console.log(`  ${name.padEnd(22)} ${String(dataRows).padStart(4)} rows`);
	} else {
		writeFileSync(join(OUT_DIR, name), content);
		console.log(`  ${name.padEnd(22)} ${String(dataRows).padStart(4)} rows  -> written`);
	}
}

console.log(`${"─".repeat(42)}`);
console.log(`  Total: ${totalRows} rows across ${files.length} files`);
if (DRY_RUN) console.log(`\n  (dry run — no files written)`);
console.log();
