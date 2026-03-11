/**
 * generate-test-data.ts — Generate supply chain analytics test data CSV files.
 *
 * Produces 8 CSV files for the Analytics Hub test dashboard.
 * Pure function — all I/O injected via deps.
 */
import type { CliDeps } from "../../infrastructure/deps.js";
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

// ── Public interfaces ───────────────────────────────

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

// ── Pure generation function ────────────────────────

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
