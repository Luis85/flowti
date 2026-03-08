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
 *   node scripts/generate-test-data.ts                          # default: Jan 2025 – today
 *   node scripts/generate-test-data.ts --from 2024-06 --to 2026-06
 *   node scripts/generate-test-data.ts --seed 123               # reproducible output
 *   node scripts/generate-test-data.ts --out ./my-folder        # custom output directory
 *   node scripts/generate-test-data.ts --dry-run                # preview row counts only
 */
import { disk } from "../../infrastructure/filesystem.js";
import { paths } from "../../infrastructure/paths.js";
import { proc } from "../../infrastructure/proc.js";
import { clock } from "../../infrastructure/clock.js";
import type { YearMonth } from "./test-data-generators.js";
import {
	setSeed,
	generateItems,
	generateSuppliers,
	generateCustomers,
	generateBudget,
	generateSales,
	generateCustomerOrders,
	generateInventory,
	generatePurchaseOrders,
} from "./test-data-generators.js";

// ── CLI argument parsing ────────────────────────────────

const args: string[] = proc.argv();

function getArg(name: string, fallback: string | null): string | null {
	const idx: number = args.indexOf(`--${name}`);
	if (idx === -1 || idx + 1 >= args.length) return fallback;
	return args[idx + 1];
}

function hasFlag(name: string): boolean {
	return args.includes(`--${name}`);
}

if (hasFlag("help") || hasFlag("h")) {
	log(`
Supply Chain Analytics Test Data Generator

Usage:
  node scripts/generate-test-data.ts [options]

Options:
  --from YYYY-MM   Start month (default: 2025-01)
  --to   YYYY-MM   End month inclusive (default: current month)
  --seed N          PRNG seed for reproducible output (default: 42)
  --out  PATH       Output directory (default: vault test data folder)
  --dry-run         Print row counts without writing files
  --help            Show this help
`);
	proc.exit(0);
}

const FROM: string = getArg("from", "2025-01") as string;
const TO: string | null = getArg("to", null);
const SEED_INPUT: number = Number(getArg("seed", "42"));
const DRY_RUN: boolean = hasFlag("dry-run");

// Default output: vault test data folder
import { VAULT_ROOT } from "../../infrastructure/config.js";
import { log } from "../../infrastructure/logger.js";
const DEFAULT_OUT: string = paths.join(VAULT_ROOT, "03 - Resources", "Test Data", "Analytics");
const OUT_DIR: string = paths.resolve(getArg("out", DEFAULT_OUT) as string);

// ── Date range resolution ───────────────────────────────

function parseYearMonth(s: string): YearMonth {
	const [y, m] = s.split("-").map(Number);
	return { year: y, month: m };
}

function todayYearMonth(): YearMonth {
	const d = clock.now();
	return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

const rangeFrom: YearMonth = parseYearMonth(FROM);
const rangeTo: YearMonth = TO ? parseYearMonth(TO) : todayYearMonth();

/** Enumerate all { year, month } pairs in the range (inclusive). */
function enumerateMonths(from: YearMonth, to: YearMonth): YearMonth[] {
	const months: YearMonth[] = [];
	let y: number = from.year, m: number = from.month;
	while (y < to.year || (y === to.year && m <= to.month)) {
		months.push({ year: y, month: m });
		m++;
		if (m > 12) { m = 1; y++; }
	}
	return months;
}

const ALL_MONTHS: YearMonth[] = enumerateMonths(rangeFrom, rangeTo);

// ── Main ────────────────────────────────────────────────

interface FileEntry {
	name: string;
	generate: () => string;
}

const files: FileEntry[] = [
	{ name: "Customers.csv",      generate: generateCustomers },
	{ name: "Suppliers.csv",      generate: generateSuppliers },
	{ name: "Items.csv",          generate: generateItems },
	{ name: "Budget.csv",         generate: () => generateBudget(ALL_MONTHS) },
	{ name: "Sales.csv",          generate: () => generateSales(ALL_MONTHS) },
	{ name: "CustomerOrders.csv", generate: () => generateCustomerOrders(ALL_MONTHS) },
	{ name: "Inventory.csv",      generate: () => generateInventory(ALL_MONTHS) },
	{ name: "PurchaseOrders.csv", generate: () => generatePurchaseOrders(ALL_MONTHS) },
];

log(`\nSupply Chain Analytics Test Data Generator`);
log(`──────────────────────────────────────────`);
log(`Range:  ${FROM} to ${rangeTo.year}-${String(rangeTo.month).padStart(2, "0")} (${ALL_MONTHS.length} months)`);
log(`Seed:   ${SEED_INPUT}`);
log(`Output: ${OUT_DIR}`);
log();

if (!DRY_RUN && !disk.existsSync(OUT_DIR)) {
	disk.mkdirSync(OUT_DIR, { recursive: true });
}

let totalRows: number = 0;

for (const { name, generate } of files) {
	// Reset seed for each file so adding months doesn't change earlier files' data
	setSeed(SEED_INPUT + name.charCodeAt(0));

	const content: string = generate();
	const dataRows: number = content.trimEnd().split("\n").length - 1;
	totalRows += dataRows;

	if (DRY_RUN) {
		log(`  ${name.padEnd(22)} ${String(dataRows).padStart(4)} rows`);
	} else {
		disk.writeFileSync(paths.join(OUT_DIR, name), content, "utf-8");
		log(`  ${name.padEnd(22)} ${String(dataRows).padStart(4)} rows  -> written`);
	}
}

log(`${"─".repeat(42)}`);
log(`  Total: ${totalRows} rows across ${files.length} files`);
if (DRY_RUN) log(`\n  (dry run — no files written)`);
log();
