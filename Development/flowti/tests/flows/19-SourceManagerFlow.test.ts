/**
 * Flow 19: Source Manager Flow
 *
 * Tests the source management lifecycle extracted from QueriesTab:
 * Add source → load data → detect types → get headers →
 * build saved sources → restore from saved → reset.
 *
 * Verifies callback-driven integration pattern (SourceManagerDeps).
 */

import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";
import { SourceManager } from "../../src/domain/analytics/SourceManager";
import type { SourceManagerDeps } from "../../src/domain/analytics/SourceManager";
import type { ColumnTypeHint, ParsedSourceData } from "../../src/domain/analytics/types";

const SAMPLE_DATA: ParsedSourceData = {
	headers: ["Region", "Product", "Revenue", "Date"],
	rows: [
		["US", "Widget A", "100", "2025-01-01"],
		["EU", "Widget A", "200", "2025-02-01"],
		["US", "Widget B", "150.50", "2025-03-01"],
		["EU", "Widget B", "250", "2025-04-01"],
	],
};

const SECOND_DATA: ParsedSourceData = {
	headers: ["Supplier", "Cost"],
	rows: [
		["Acme", "50"],
		["Globex", "75"],
	],
};

function createMockDeps(): SourceManagerDeps & {
	sourcesChangedCount: number;
	sourceRemovedCount: number;
	lastDetectedHints: ColumnTypeHint[];
	allSourcesLoadedCount: number;
	loadCsv: Mock;
} {
	const mock = {
		loadCsv: vi.fn(async (path: string) => {
			if (path.includes("second")) return SECOND_DATA;
			return SAMPLE_DATA;
		}) as Mock,
		loadBase: vi.fn(async () => SAMPLE_DATA),
		loadCsvFolder: vi.fn(async () => SAMPLE_DATA),
		onSourcesChanged: vi.fn(),
		onSourceRemoved: vi.fn(),
		onTypeHintsDetected: vi.fn((hints: ColumnTypeHint[]) => {
			mock.lastDetectedHints = hints;
		}),
		onAllSourcesLoaded: vi.fn(),
		sourcesChangedCount: 0,
		sourceRemovedCount: 0,
		lastDetectedHints: [] as ColumnTypeHint[],
		allSourcesLoadedCount: 0,
	};
	mock.onSourcesChanged.mockImplementation(() => { mock.sourcesChangedCount++; });
	mock.onSourceRemoved.mockImplementation(() => { mock.sourceRemovedCount++; });
	mock.onAllSourcesLoaded.mockImplementation(() => { mock.allSourcesLoadedCount++; });
	return mock;
}

/** Wait for async loading to complete. */
function waitForLoad(ms = 50): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("Flow 19: Source Manager", () => {
	let deps: ReturnType<typeof createMockDeps>;
	let manager: SourceManager;

	beforeEach(() => {
		deps = createMockDeps();
		manager = new SourceManager(deps);
	});

	it("starts with no sources", () => {
		expect(manager.getSources()).toEqual([]);
		expect(manager.hasSources).toBe(false);
		expect(manager.hasLoadedData).toBe(false);
	});

	it("adds a CSV source and loads data asynchronously", async () => {
		manager.addSource("/data/sales.csv", "sales");

		expect(manager.hasSources).toBe(true);
		expect(manager.getSources().length).toBe(1);
		expect(manager.getSources()[0].loading).toBe(true);

		await waitForLoad();

		expect(manager.getSources()[0].loading).toBe(false);
		expect(manager.getSources()[0].data).toBeTruthy();
		expect(manager.getSources()[0].data!.headers).toEqual(SAMPLE_DATA.headers);
		expect(deps.loadCsv).toHaveBeenCalledWith("/data/sales.csv");
	});

	it("adds a .base source and loads via adapter", async () => {
		manager.addSource("/data/inventory.base", "inventory", "base", 0);

		await waitForLoad();

		expect(deps.loadBase).toHaveBeenCalledWith("/data/inventory.base", 0);
		expect(manager.getSources()[0].data).toBeTruthy();
		expect(manager.getSources()[0].sourceType).toBe("base");
	});

	it("adds a csv-folder source", async () => {
		manager.addSource("/data/reports/", "reports", "csv-folder");

		await waitForLoad();

		expect(deps.loadCsvFolder).toHaveBeenCalledWith("/data/reports/");
		expect(manager.getSources()[0].sourceType).toBe("csv-folder");
	});

	it("deduplicates aliases by appending counter", () => {
		manager.addSource("/data/a.csv", "sales");
		manager.addSource("/data/b.csv", "sales");

		const aliases = manager.getSources().map((s) => s.alias);
		expect(aliases).toContain("sales");
		expect(aliases).toContain("sales_2");
	});

	it("removes a source by path", async () => {
		manager.addSource("/data/a.csv", "sales");
		await waitForLoad();

		manager.removeSource("/data/a.csv");

		expect(manager.getSources().length).toBe(0);
		expect(deps.sourceRemovedCount).toBe(1);
	});

	it("detects column type hints after loading", async () => {
		manager.addSource("/data/sales.csv", "sales");
		await waitForLoad();

		expect(deps.onTypeHintsDetected).toHaveBeenCalled();
		expect(deps.lastDetectedHints.length).toBeGreaterThan(0);
	});

	it("gets loaded headers from all sources (deduped)", async () => {
		manager.addSource("/data/sales.csv", "sales");
		await waitForLoad();

		const headers = manager.getLoadedHeaders();
		expect(headers).toContain("Region");
		expect(headers).toContain("Product");
		expect(headers).toContain("Revenue");
		// No duplicates
		expect(new Set(headers).size).toBe(headers.length);
	});

	it("merges headers from multiple sources", async () => {
		manager.addSource("/data/sales.csv", "sales");
		manager.addSource("/data/second.csv", "costs");
		await waitForLoad();

		const headers = manager.getLoadedHeaders();
		expect(headers).toContain("Region");
		expect(headers).toContain("Supplier");
		expect(headers).toContain("Cost");
	});

	it("gets distinct values for a column", async () => {
		manager.addSource("/data/sales.csv", "sales");
		await waitForLoad();

		const regions = manager.getDistinctValues("Region");
		expect(regions).toContain("US");
		expect(regions).toContain("EU");
		expect(regions.length).toBe(2);
	});

	it("returns remaining aliases as a Set", () => {
		manager.addSource("/data/a.csv", "alpha");
		manager.addSource("/data/b.csv", "beta");

		const aliases = manager.getRemainingAliases();
		expect(aliases.has("alpha")).toBe(true);
		expect(aliases.has("beta")).toBe(true);
		expect(aliases.size).toBe(2);
	});

	it("builds saved source descriptors (strips defaults)", async () => {
		manager.addSource("/data/sales.csv", "sales");
		await waitForLoad();

		const savedSources = manager.buildSavedSources();
		expect(savedSources.length).toBe(1);
		expect(savedSources[0].alias).toBe("sales");
		expect(savedSources[0].csvPath).toBe("/data/sales.csv");
		// Default sourceType "csv" is stripped to undefined
		expect(savedSources[0].sourceType).toBeUndefined();
		// Default locale "auto" is stripped to undefined
		expect(savedSources[0].locale).toBeUndefined();
	});

	it("loads from saved sources and fires callbacks", async () => {
		manager.loadFromSaved([
			{ alias: "sales", csvPath: "/data/sales.csv" },
			{ alias: "costs", csvPath: "/data/second.csv" },
		]);

		await waitForLoad();

		expect(manager.getSources().length).toBe(2);
		expect(manager.allLoaded).toBe(true);
		expect(manager.hasLoadedData).toBe(true);
		expect(deps.loadCsv).toHaveBeenCalledTimes(2);
	});

	it("triggers onAllSourcesLoaded when pendingExecute is set", async () => {
		manager.loadFromSaved(
			[{ alias: "sales", csvPath: "/data/sales.csv" }],
			true, // pendingExecute
		);

		await waitForLoad();

		expect(deps.allSourcesLoadedCount).toBe(1);
	});

	it("resets all state", async () => {
		manager.addSource("/data/sales.csv", "sales");
		await waitForLoad();

		manager.reset();

		expect(manager.getSources()).toEqual([]);
		expect(manager.hasSources).toBe(false);
		expect(manager.hasLoadedData).toBe(false);
	});

	it("handles load errors gracefully", async () => {
		deps.loadCsv.mockRejectedValueOnce(new Error("File not found"));
		manager.addSource("/data/missing.csv", "missing");

		await waitForLoad();

		const source = manager.getSources()[0];
		expect(source.loading).toBe(false);
		expect(source.error).toBe("File not found");
		expect(source.data).toBeNull();
	});

	it("detects source-level locale from numeric samples", async () => {
		manager.addSource("/data/sales.csv", "sales");
		await waitForLoad();

		// detectedLocale should be set (actual value depends on sample data)
		const source = manager.getSources()[0];
		// en-US because samples use plain numbers like "100", "150.50"
		expect(source.detectedLocale).toBeTruthy();
	});
});
