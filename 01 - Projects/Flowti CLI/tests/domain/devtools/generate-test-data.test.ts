import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTestDeps } from "../../mocks/mock-deps.js";
import { createMockFs } from "../../mocks/mock-fs.js";
import { generateTestData } from "../../../src/domain/devtools/generate-test-data.js";
import type { TestDataOpts } from "../../../src/domain/devtools/generate-test-data.js";

type MockFs = ReturnType<typeof createMockFs>;

function makeDeps() {
	const deps = createTestDeps({ clock: "2025-06-15T10:30:00.000Z" });
	return { fs: deps.disk as MockFs, clock: deps.clock, log: deps.log, deps };
}

function defaultOpts(overrides: Partial<TestDataOpts> = {}): TestDataOpts {
	return {
		from: "2025-01",
		to: "2025-06",
		seed: 42,
		outDir: "/mock/vault/03 - Resources/Test Data/Analytics",
		dryRun: false,
		...overrides,
	};
}

beforeEach(() => {
	vi.clearAllMocks();
});

describe("generate-test-data", () => {
	it("generates 8 CSV files in default output directory", () => {
		const { fs, deps } = makeDeps();

		generateTestData(defaultOpts(), deps);

		const files = [...fs.files.keys()];
		const csvFiles = files.filter(f => f.endsWith(".csv"));
		expect(csvFiles).toHaveLength(8);
	});

	it("generates expected file names", () => {
		const { fs, deps } = makeDeps();

		generateTestData(defaultOpts(), deps);

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

	it("generates CSVs with headers", () => {
		const { fs, deps } = makeDeps();

		generateTestData(defaultOpts(), deps);

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

	it("generates correct number of static reference rows", () => {
		const { fs, deps } = makeDeps();

		generateTestData(defaultOpts(), deps);

		const files = [...fs.files.entries()];
		const customers = files.find(([k]) => k.includes("Customers.csv"));
		const customerRows = customers![1].trimEnd().split("\n").length - 1;
		expect(customerRows).toBe(10);

		const suppliers = files.find(([k]) => k.includes("Suppliers.csv"));
		const supplierRows = suppliers![1].trimEnd().split("\n").length - 1;
		expect(supplierRows).toBe(5);

		const items = files.find(([k]) => k.includes("Items.csv"));
		const itemRows = items![1].trimEnd().split("\n").length - 1;
		expect(itemRows).toBe(12);
	});

	it("dry-run mode does not write files", () => {
		const { fs, deps } = makeDeps();

		generateTestData(defaultOpts({ dryRun: true }), deps);

		const files = [...fs.files.keys()];
		const csvFiles = files.filter(f => f.endsWith(".csv"));
		expect(csvFiles).toHaveLength(0);
	});

	it("dry-run logs row counts without writing", () => {
		const { log, deps } = makeDeps();

		generateTestData(defaultOpts({ dryRun: true }), deps);

		const output = log.mock.calls.flat().join(" ");
		expect(output).toContain("dry run");
		expect(output).toContain("rows");
	});

	it("creates output directory if it does not exist", () => {
		const { fs, deps } = makeDeps();

		generateTestData(defaultOpts(), deps);

		expect(fs.dirs.size).toBeGreaterThan(0);
	});

	it("uses custom output directory via --out flag", () => {
		const { fs, deps } = makeDeps();

		generateTestData(defaultOpts({ outDir: "/custom/output" }), deps);

		const files = [...fs.files.keys()];
		const csvFiles = files.filter(f => f.endsWith(".csv"));
		expect(csvFiles.length).toBeGreaterThan(0);
		expect(csvFiles.every(f => f.includes("/custom/output"))).toBe(true);
	});

	it("uses custom seed for reproducibility", () => {
		const m1 = makeDeps();
		generateTestData(defaultOpts({ seed: 100 }), m1.deps);
		const sales1 = [...m1.fs.files.entries()].find(([k]) => k.includes("Sales.csv"));

		const m2 = makeDeps();
		generateTestData(defaultOpts({ seed: 100 }), m2.deps);
		const sales2 = [...m2.fs.files.entries()].find(([k]) => k.includes("Sales.csv"));

		expect(sales1![1]).toBe(sales2![1]);
	});

	it("different seeds produce different output", () => {
		const m1 = makeDeps();
		generateTestData(defaultOpts({ seed: 100 }), m1.deps);
		const sales1 = [...m1.fs.files.entries()].find(([k]) => k.includes("Sales.csv"));

		const m2 = makeDeps();
		generateTestData(defaultOpts({ seed: 999 }), m2.deps);
		const sales2 = [...m2.fs.files.entries()].find(([k]) => k.includes("Sales.csv"));

		expect(sales1![1]).not.toBe(sales2![1]);
	});

	it("uses custom date range", () => {
		const { fs, deps } = makeDeps();

		generateTestData(defaultOpts({ from: "2025-01", to: "2025-03" }), deps);

		const budget = [...fs.files.entries()].find(([k]) => k.includes("Budget.csv"));
		expect(budget).toBeDefined();
		const budgetRows = budget![1].trimEnd().split("\n").length - 1;
		expect(budgetRows).toBe(9); // 3 months * 3 categories
	});

	it("logs total row count summary", () => {
		const { log, deps } = makeDeps();

		generateTestData(defaultOpts(), deps);

		const output = log.mock.calls.flat().join(" ");
		expect(output).toContain("Total:");
		expect(output).toContain("8 files");
	});

	it("Budget CSV contains category data", () => {
		const { fs, deps } = makeDeps();

		generateTestData(defaultOpts(), deps);

		const budget = [...fs.files.entries()].find(([k]) => k.includes("Budget.csv"));
		expect(budget![1]).toContain("Electronics");
		expect(budget![1]).toContain("Furniture");
		expect(budget![1]).toContain("Office Supplies");
	});

	it("CustomerOrders CSV contains order IDs", () => {
		const { fs, deps } = makeDeps();

		generateTestData(defaultOpts(), deps);

		const orders = [...fs.files.entries()].find(([k]) => k.includes("CustomerOrders.csv"));
		expect(orders![1]).toContain("ORD-");
	});

	it("PurchaseOrders CSV contains PO IDs and statuses", () => {
		const { fs, deps } = makeDeps();

		generateTestData(defaultOpts(), deps);

		const pos = [...fs.files.entries()].find(([k]) => k.includes("PurchaseOrders.csv"));
		expect(pos![1]).toContain("PO-");
		const content = pos![1];
		const hasStatus = content.includes("received") || content.includes("open") || content.includes("partial");
		expect(hasStatus).toBe(true);
	});

	it("Inventory CSV contains item IDs and supplier IDs", () => {
		const { fs, deps } = makeDeps();

		generateTestData(defaultOpts(), deps);

		const inv = [...fs.files.entries()].find(([k]) => k.includes("Inventory.csv"));
		expect(inv![1]).toContain("ITM-");
		expect(inv![1]).toContain("SUP-");
	});

	it("Sales CSV contains item and supplier references", () => {
		const { fs, deps } = makeDeps();

		generateTestData(defaultOpts(), deps);

		const sales = [...fs.files.entries()].find(([k]) => k.includes("Sales.csv"));
		expect(sales![1]).toContain("ITM-");
		expect(sales![1]).toContain("SUP-");
	});

	it("Inventory has one row per item per month", () => {
		const { fs, deps } = makeDeps();

		generateTestData(defaultOpts({ from: "2025-01", to: "2025-02" }), deps);

		const inv = [...fs.files.entries()].find(([k]) => k.includes("Inventory.csv"));
		const rows = inv![1].trimEnd().split("\n").length - 1;
		expect(rows).toBe(24); // 2 months * 12 items
	});

	it("Budget has one row per category per month", () => {
		const { fs, deps } = makeDeps();

		generateTestData(defaultOpts({ from: "2025-06", to: "2025-06" }), deps);

		const budget = [...fs.files.entries()].find(([k]) => k.includes("Budget.csv"));
		const rows = budget![1].trimEnd().split("\n").length - 1;
		expect(rows).toBe(3); // 1 month * 3 categories
	});

	it("returns result with totalRows and file details", () => {
		const { deps } = makeDeps();

		const result = generateTestData(defaultOpts(), deps);

		expect(result.totalRows).toBeGreaterThan(0);
		expect(result.filesWritten).toBe(8);
		expect(result.files).toHaveLength(8);
		expect(result.files[0]).toHaveProperty("name");
		expect(result.files[0]).toHaveProperty("rows");
	});
});
