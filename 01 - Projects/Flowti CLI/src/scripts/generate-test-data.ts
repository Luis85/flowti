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
 *
 * The pure generation logic is exported as generateTestData() for
 * programmatic use and testing. The CLI entry point is at the bottom.
 */
import type { CliDeps } from "../infrastructure/deps.js";
import { createDefaultDeps } from "../infrastructure/deps.js";
import { VAULT_ROOT } from "../infrastructure/config.js";
import type { YearMonth } from "../domain/devtools/test-data-generators.js";
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
} from "../domain/devtools/test-data-generators.js";

// ── Public interfaces ───────────────────────────────────

export interface TestDataOpts {
	from: string;       // "YYYY-MM"
	to: string | null;  // "YYYY-MM" or null (defaults to current month)
	seed: number;
	outDir: string;
	dryRun: boolean;
}

export interface TestDataResult {
	totalRows: number;
	filesWritten: number;
	files: Array<{ name: string; rows: number }>;
}

// ── Pure generation function ────────────────────────────

export function generateTestData(
	opts: TestDataOpts,
	deps: Pick<CliDeps, "disk" | "paths" | "clock" | "log">,
): TestDataResult {
	// ── Date range resolution ───────────────────────────

	function parseYearMonth(s: string): YearMonth {
		const [y, m] = s.split("-").map(Number);
		return { year: y, month: m };
	}

	function todayYearMonth(): YearMonth {
		const d = deps.clock.now();
		return { year: d.getFullYear(), month: d.getMonth() + 1 };
	}

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

	const rangeFrom: YearMonth = parseYearMonth(opts.from);
	const rangeTo: YearMonth = opts.to ? parseYearMonth(opts.to) : todayYearMonth();
	const allMonths: YearMonth[] = enumerateMonths(rangeFrom, rangeTo);

	// ── File definitions ────────────────────────────────

	interface FileEntry {
		name: string;
		generate: () => string;
	}

	const files: FileEntry[] = [
		{ name: "Customers.csv",      generate: generateCustomers },
		{ name: "Suppliers.csv",      generate: generateSuppliers },
		{ name: "Items.csv",          generate: generateItems },
		{ name: "Budget.csv",         generate: () => generateBudget(allMonths) },
		{ name: "Sales.csv",          generate: () => generateSales(allMonths) },
		{ name: "CustomerOrders.csv", generate: () => generateCustomerOrders(allMonths) },
		{ name: "Inventory.csv",      generate: () => generateInventory(allMonths) },
		{ name: "PurchaseOrders.csv", generate: () => generatePurchaseOrders(allMonths) },
	];

	// ── Log header ──────────────────────────────────────

	const toLabel = `${rangeTo.year}-${String(rangeTo.month).padStart(2, "0")}`;
	deps.log(`\nSupply Chain Analytics Test Data Generator`);
	deps.log(`──────────────────────────────────────────`);
	deps.log(`Range:  ${opts.from} to ${toLabel} (${allMonths.length} months)`);
	deps.log(`Seed:   ${opts.seed}`);
	deps.log(`Output: ${opts.outDir}`);
	deps.log("");

	// ── Ensure output directory ─────────────────────────

	if (!opts.dryRun && !deps.disk.existsSync(opts.outDir)) {
		deps.disk.mkdirSync(opts.outDir, { recursive: true });
	}

	// ── Generate files ──────────────────────────────────

	let totalRows: number = 0;
	const resultFiles: Array<{ name: string; rows: number }> = [];
	let filesWritten: number = 0;

	for (const { name, generate } of files) {
		// Reset seed for each file so adding months doesn't change earlier files' data
		setSeed(opts.seed + name.charCodeAt(0));

		const content: string = generate();
		const dataRows: number = content.trimEnd().split("\n").length - 1;
		totalRows += dataRows;
		resultFiles.push({ name, rows: dataRows });

		if (opts.dryRun) {
			deps.log(`  ${name.padEnd(22)} ${String(dataRows).padStart(4)} rows`);
		} else {
			deps.disk.writeFileSync(deps.paths.join(opts.outDir, name), content, "utf-8");
			deps.log(`  ${name.padEnd(22)} ${String(dataRows).padStart(4)} rows  -> written`);
			filesWritten++;
		}
	}

	deps.log(`${"─".repeat(42)}`);
	deps.log(`  Total: ${totalRows} rows across ${files.length} files`);
	if (opts.dryRun) deps.log(`\n  (dry run — no files written)`);
	deps.log("");

	return { totalRows, filesWritten, files: resultFiles };
}

// ── CLI entry point ─────────────────────────────────────

if (process.argv[1]?.endsWith("generate-test-data.ts") || process.argv[1]?.endsWith("generate-test-data.js")) {
	const args: string[] = process.argv.slice(2);

	const getArg = (name: string, fallback: string | null): string | null => {
		const idx: number = args.indexOf(`--${name}`);
		if (idx === -1 || idx + 1 >= args.length) return fallback;
		return args[idx + 1];
	};

	const hasFlag = (name: string): boolean => {
		return args.includes(`--${name}`);
	};

	if (hasFlag("help") || hasFlag("h")) {
		console.log(`
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
		process.exit(0);
	}

	const deps = createDefaultDeps();
	const defaultOut: string = deps.paths.join(VAULT_ROOT, "03 - Resources", "Test Data", "Analytics");

	const opts: TestDataOpts = {
		from: getArg("from", "2025-01") as string,
		to: getArg("to", null),
		seed: Number(getArg("seed", "42")),
		outDir: deps.paths.resolve(getArg("out", defaultOut) as string),
		dryRun: hasFlag("dry-run"),
	};

	const result = generateTestData(opts, deps);
	process.exit(result.totalRows > 0 ? 0 : 1);
}
