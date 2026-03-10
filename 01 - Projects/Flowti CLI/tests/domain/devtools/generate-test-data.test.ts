import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockFs } from "../../mocks/mock-fs.js";
import { createMockProc, MockExitError } from "../../mocks/mock-proc.js";
import { createMockClock } from "../../mocks/mock-clock.js";

// Mocks must be set up before the module is imported (module-level execution)
vi.mock("../../../src/infrastructure/filesystem.js", () => ({
	disk: {},
}));

vi.mock("../../../src/infrastructure/paths.js", () => ({
	paths: {
		join: (...parts: string[]) => parts.join("/"),
		resolve: (...parts: string[]) => parts.join("/"),
		dirname: (p: string) => p.split("/").slice(0, -1).join("/"),
	},
}));

vi.mock("../../../src/infrastructure/proc.js", () => ({
	proc: {},
}));

vi.mock("../../../src/infrastructure/clock.js", () => ({
	clock: {},
}));

vi.mock("../../../src/infrastructure/config.js", () => ({
	VAULT_ROOT: "/mock/vault",
}));

vi.mock("../../../src/infrastructure/logger.js", () => ({
	log: vi.fn(),
}));

import * as filesystemMod from "../../../src/infrastructure/filesystem.js";
import * as procMod from "../../../src/infrastructure/proc.js";
import * as clockMod from "../../../src/infrastructure/clock.js";
import { log } from "../../../src/infrastructure/logger.js";

const mockLog = log as ReturnType<typeof vi.fn>;

beforeEach(() => {
	vi.clearAllMocks();
	vi.resetModules();
});

function setupMocks(opts: { argv?: string[]; dryRun?: boolean } = {}) {
	const fs = createMockFs();
	Object.assign(filesystemMod, { disk: fs });

	const argv = opts.argv ?? [];
	if (opts.dryRun) argv.push("--dry-run");
	const p = createMockProc({ argv });
	Object.assign(procMod, { proc: p });

	const c = createMockClock("2025-06-15T10:30:00.000Z");
	Object.assign(clockMod, { clock: c });

	return { fs, proc: p, clock: c };
}

describe("generate-test-data", () => {
	it("generates 8 CSV files in default output directory", async () => {
		const { fs } = setupMocks();

		await import("../../../src/scripts/generate-test-data.js");

		const files = [...fs.files.keys()];
		const csvFiles = files.filter(f => f.endsWith(".csv"));
		expect(csvFiles).toHaveLength(8);
	});

	it("generates expected file names", async () => {
		const { fs } = setupMocks();

		await import("../../../src/scripts/generate-test-data.js");

		const files = [...fs.files.keys()];
		const basenames = files.filter(f => f.endsWith(".csv")).map(f => f.split("/").pop());
		expect(basenames).toContain("Customers.csv");
		expect(basenames).toContain("Suppliers.csv");
		expect(basenames).toContain("Items.csv");
		expect(basenames).toContain("Budget.csv");
		expect(basenames).toContain("Sales.csv");
		expect(basenames).toContain("CustomerOrders.csv");
		expect(basenames).toContain("Inventory.csv");
		expect(basenames).toContain("PurchaseOrders.csv");
	});

	it("generates CSVs with headers", async () => {
		const { fs } = setupMocks();

		await import("../../../src/scripts/generate-test-data.js");

		const files = [...fs.files.entries()];
		const customers = files.find(([k]) => k.includes("Customers.csv"));
		expect(customers).toBeDefined();
		expect(customers![1]).toContain("customer_id,customer_name,segment,region,credit_limit");

		const items = files.find(([k]) => k.includes("Items.csv"));
		expect(items).toBeDefined();
		expect(items![1]).toContain("item_id,item_name,category,unit_price");

		const suppliers = files.find(([k]) => k.includes("Suppliers.csv"));
		expect(suppliers).toBeDefined();
		expect(suppliers![1]).toContain("supplier_id,supplier_name,region,country");
	});

	it("generates correct number of static reference rows", async () => {
		const { fs } = setupMocks();

		await import("../../../src/scripts/generate-test-data.js");

		const files = [...fs.files.entries()];
		const customers = files.find(([k]) => k.includes("Customers.csv"));
		const customerRows = customers![1].trimEnd().split("\n").length - 1; // minus header
		expect(customerRows).toBe(10); // 10 customers

		const suppliers = files.find(([k]) => k.includes("Suppliers.csv"));
		const supplierRows = suppliers![1].trimEnd().split("\n").length - 1;
		expect(supplierRows).toBe(5); // 5 suppliers

		const items = files.find(([k]) => k.includes("Items.csv"));
		const itemRows = items![1].trimEnd().split("\n").length - 1;
		expect(itemRows).toBe(12); // 12 items
	});

	it("dry-run mode does not write files", async () => {
		const { fs } = setupMocks({ dryRun: true });

		await import("../../../src/scripts/generate-test-data.js");

		const files = [...fs.files.keys()];
		const csvFiles = files.filter(f => f.endsWith(".csv"));
		expect(csvFiles).toHaveLength(0);
	});

	it("dry-run logs row counts without writing", async () => {
		setupMocks({ dryRun: true });

		await import("../../../src/scripts/generate-test-data.js");

		const output = mockLog.mock.calls.flat().join(" ");
		expect(output).toContain("dry run");
		expect(output).toContain("rows");
	});

	it("creates output directory if it does not exist", async () => {
		const { fs } = setupMocks();

		await import("../../../src/scripts/generate-test-data.js");

		// The default output dir should have been created
		expect(fs.dirs.size).toBeGreaterThan(0);
	});

	it("uses custom output directory via --out flag", async () => {
		const { fs } = setupMocks({ argv: ["--out", "/custom/output"] });

		await import("../../../src/scripts/generate-test-data.js");

		const files = [...fs.files.keys()];
		const csvFiles = files.filter(f => f.endsWith(".csv"));
		expect(csvFiles.length).toBeGreaterThan(0);
		expect(csvFiles.every(f => f.includes("/custom/output"))).toBe(true);
	});

	it("uses custom seed via --seed flag for reproducibility", async () => {
		const { fs: fs1 } = setupMocks({ argv: ["--seed", "100"] });
		await import("../../../src/scripts/generate-test-data.js");
		const sales1 = [...fs1.files.entries()].find(([k]) => k.includes("Sales.csv"));

		vi.resetModules();

		const { fs: fs2 } = setupMocks({ argv: ["--seed", "100"] });
		await import("../../../src/scripts/generate-test-data.js");
		const sales2 = [...fs2.files.entries()].find(([k]) => k.includes("Sales.csv"));

		expect(sales1![1]).toBe(sales2![1]);
	});

	it("different seeds produce different output", async () => {
		const { fs: fs1 } = setupMocks({ argv: ["--seed", "100"] });
		await import("../../../src/scripts/generate-test-data.js");
		const sales1 = [...fs1.files.entries()].find(([k]) => k.includes("Sales.csv"));

		vi.resetModules();

		const { fs: fs2 } = setupMocks({ argv: ["--seed", "999"] });
		await import("../../../src/scripts/generate-test-data.js");
		const sales2 = [...fs2.files.entries()].find(([k]) => k.includes("Sales.csv"));

		expect(sales1![1]).not.toBe(sales2![1]);
	});

	it("uses custom date range via --from and --to flags", async () => {
		const { fs } = setupMocks({ argv: ["--from", "2025-01", "--to", "2025-03"] });

		await import("../../../src/scripts/generate-test-data.js");

		// Budget should have exactly 3 months * 3 categories = 9 rows
		const budget = [...fs.files.entries()].find(([k]) => k.includes("Budget.csv"));
		expect(budget).toBeDefined();
		const budgetRows = budget![1].trimEnd().split("\n").length - 1;
		expect(budgetRows).toBe(9); // 3 months * 3 categories
	});

	it("shows --help message and exits", async () => {
		const { proc: p } = setupMocks({ argv: ["--help"] });

		try {
			await import("../../../src/scripts/generate-test-data.js");
		} catch (e) {
			// MockExitError is expected
			expect(e).toBeInstanceOf(MockExitError);
			expect((e as MockExitError).code).toBe(0);
		}

		const output = mockLog.mock.calls.flat().join(" ");
		expect(output).toContain("Supply Chain Analytics Test Data Generator");
		expect(output).toContain("--from");
		expect(output).toContain("--seed");
	});

	it("logs total row count summary", async () => {
		setupMocks();

		await import("../../../src/scripts/generate-test-data.js");

		const output = mockLog.mock.calls.flat().join(" ");
		expect(output).toContain("Total:");
		expect(output).toContain("8 files");
	});

	it("Budget CSV contains category data", async () => {
		const { fs } = setupMocks();

		await import("../../../src/scripts/generate-test-data.js");

		const budget = [...fs.files.entries()].find(([k]) => k.includes("Budget.csv"));
		expect(budget![1]).toContain("Electronics");
		expect(budget![1]).toContain("Furniture");
		expect(budget![1]).toContain("Office Supplies");
	});

	it("CustomerOrders CSV contains order IDs", async () => {
		const { fs } = setupMocks();

		await import("../../../src/scripts/generate-test-data.js");

		const orders = [...fs.files.entries()].find(([k]) => k.includes("CustomerOrders.csv"));
		expect(orders![1]).toContain("ORD-");
	});

	it("PurchaseOrders CSV contains PO IDs and statuses", async () => {
		const { fs } = setupMocks();

		await import("../../../src/scripts/generate-test-data.js");

		const pos = [...fs.files.entries()].find(([k]) => k.includes("PurchaseOrders.csv"));
		expect(pos![1]).toContain("PO-");
		// Should contain at least one status type
		const content = pos![1];
		const hasStatus = content.includes("received") || content.includes("open") || content.includes("partial");
		expect(hasStatus).toBe(true);
	});

	it("Inventory CSV contains item IDs and supplier IDs", async () => {
		const { fs } = setupMocks();

		await import("../../../src/scripts/generate-test-data.js");

		const inv = [...fs.files.entries()].find(([k]) => k.includes("Inventory.csv"));
		expect(inv![1]).toContain("ITM-");
		expect(inv![1]).toContain("SUP-");
	});

	it("Sales CSV contains item and supplier references", async () => {
		const { fs } = setupMocks();

		await import("../../../src/scripts/generate-test-data.js");

		const sales = [...fs.files.entries()].find(([k]) => k.includes("Sales.csv"));
		expect(sales![1]).toContain("ITM-");
		expect(sales![1]).toContain("SUP-");
	});

	it("Inventory has one row per item per month", async () => {
		const { fs } = setupMocks({ argv: ["--from", "2025-01", "--to", "2025-02"] });

		await import("../../../src/scripts/generate-test-data.js");

		const inv = [...fs.files.entries()].find(([k]) => k.includes("Inventory.csv"));
		const rows = inv![1].trimEnd().split("\n").length - 1;
		// 2 months * 12 items = 24 rows
		expect(rows).toBe(24);
	});

	it("Budget has one row per category per month", async () => {
		const { fs } = setupMocks({ argv: ["--from", "2025-06", "--to", "2025-06"] });

		await import("../../../src/scripts/generate-test-data.js");

		const budget = [...fs.files.entries()].find(([k]) => k.includes("Budget.csv"));
		const rows = budget![1].trimEnd().split("\n").length - 1;
		// 1 month * 3 categories = 3 rows
		expect(rows).toBe(3);
	});
});
