import { describe, expect, it, vi, beforeEach } from "vitest";
import { SourceManager, type SourceManagerDeps } from "../../../src/domain/analytics/SourceManager";
import type { ParsedSourceData } from "../../../src/domain/analytics/types";

function createMockDeps(overrides?: Partial<SourceManagerDeps>): SourceManagerDeps {
	return {
		loadCsv: vi.fn().mockResolvedValue(null),
		loadBase: vi.fn().mockResolvedValue(null),
		loadCsvFolder: vi.fn().mockResolvedValue(null),
		onSourcesChanged: vi.fn(),
		onSourceRemoved: vi.fn(),
		onTypeHintsDetected: vi.fn(),
		onAllSourcesLoaded: vi.fn(),
		...overrides,
	};
}

const SAMPLE_DATA: ParsedSourceData = {
	headers: ["Name", "Amount", "Date"],
	rows: [
		["Alice", "100", "2024-01-01"],
		["Bob", "200", "2024-02-01"],
		["Charlie", "300", "2024-03-01"],
	],
};

describe("SourceManager", () => {
	let deps: SourceManagerDeps;
	let mgr: SourceManager;

	beforeEach(() => {
		deps = createMockDeps();
		mgr = new SourceManager(deps);
	});

	// ── Accessors ────────────────────────────────────────────

	describe("accessors", () => {
		it("starts with no sources", () => {
			expect(mgr.getSources()).toHaveLength(0);
			expect(mgr.hasSources).toBe(false);
			expect(mgr.hasLoadedData).toBe(false);
			expect(mgr.allLoaded).toBe(true);
		});
	});

	// ── addSource ────────────────────────────────────────────

	describe("addSource", () => {
		it("adds a source and calls onSourcesChanged", () => {
			mgr.addSource("/data/sales.csv", "sales");

			expect(mgr.getSources()).toHaveLength(1);
			expect(mgr.hasSources).toBe(true);
			const src = mgr.getSources()[0];
			expect(src.csvPath).toBe("/data/sales.csv");
			expect(src.alias).toBe("sales");
			expect(src.locale).toBe("auto");
			expect(src.sourceType).toBe("csv");
			expect(src.loading).toBe(true);
			expect(deps.onSourcesChanged).toHaveBeenCalledOnce();
		});

		it("generates unique alias when duplicate exists", () => {
			mgr.addSource("/data/a.csv", "data");
			mgr.addSource("/data/b.csv", "data");
			mgr.addSource("/data/c.csv", "data");

			const aliases = mgr.getSources().map((s) => s.alias);
			expect(aliases).toEqual(["data", "data_2", "data_3"]);
		});

		it("passes sourceType and viewIndex to created source", () => {
			mgr.addSource("/vault/db.base", "db", "base", 2);

			const src = mgr.getSources()[0];
			expect(src.sourceType).toBe("base");
			expect(src.viewIndex).toBe(2);
		});

		it("loads CSV data via deps.loadCsv for csv source type", async () => {
			const csvData = { headers: ["A"], rows: [["1"]] };
			(deps.loadCsv as ReturnType<typeof vi.fn>).mockResolvedValue(csvData);

			mgr.addSource("/data/test.csv", "test");
			await vi.waitFor(() => expect(mgr.allLoaded).toBe(true));

			expect(deps.loadCsv).toHaveBeenCalledWith("/data/test.csv");
			expect(mgr.getSources()[0].data).toEqual({ headers: ["A"], rows: [["1"]] });
		});

		it("loads base data via deps.loadBase for base source type", async () => {
			(deps.loadBase as ReturnType<typeof vi.fn>).mockResolvedValue(SAMPLE_DATA);

			mgr.addSource("/vault/db.base", "db", "base", 1);
			await vi.waitFor(() => expect(mgr.allLoaded).toBe(true));

			expect(deps.loadBase).toHaveBeenCalledWith("/vault/db.base", 1);
			expect(mgr.getSources()[0].data).toBe(SAMPLE_DATA);
		});

		it("loads folder data via deps.loadCsvFolder for csv-folder type", async () => {
			(deps.loadCsvFolder as ReturnType<typeof vi.fn>).mockResolvedValue(SAMPLE_DATA);

			mgr.addSource("/vault/folder", "folder", "csv-folder");
			await vi.waitFor(() => expect(mgr.allLoaded).toBe(true));

			expect(deps.loadCsvFolder).toHaveBeenCalledWith("/vault/folder");
		});

		it("sets error on load failure", async () => {
			(deps.loadCsv as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("File not found"));

			mgr.addSource("/data/missing.csv", "missing");
			await vi.waitFor(() => expect(mgr.allLoaded).toBe(true));

			const src = mgr.getSources()[0];
			expect(src.loading).toBe(false);
			expect(src.error).toBe("File not found");
			expect(src.data).toBeNull();
		});

		it("detects type hints after successful load", async () => {
			(deps.loadCsv as ReturnType<typeof vi.fn>).mockResolvedValue({
				headers: SAMPLE_DATA.headers,
				rows: SAMPLE_DATA.rows,
			});

			mgr.addSource("/data/test.csv", "test");
			await vi.waitFor(() => expect(mgr.allLoaded).toBe(true));

			expect(deps.onTypeHintsDetected).toHaveBeenCalled();
			const hints = (deps.onTypeHintsDetected as ReturnType<typeof vi.fn>).mock.calls[0][0];
			expect(hints.length).toBeGreaterThan(0);
			expect(hints[0]).toHaveProperty("column");
			expect(hints[0]).toHaveProperty("type");
		});
	});

	// ── removeSource ─────────────────────────────────────────

	describe("removeSource", () => {
		it("removes source by csvPath and calls onSourceRemoved", () => {
			mgr.addSource("/data/a.csv", "a");
			mgr.addSource("/data/b.csv", "b");

			mgr.removeSource("/data/a.csv");

			expect(mgr.getSources()).toHaveLength(1);
			expect(mgr.getSources()[0].alias).toBe("b");
			expect(deps.onSourceRemoved).toHaveBeenCalledOnce();
		});

		it("does nothing if csvPath not found", () => {
			mgr.addSource("/data/a.csv", "a");
			mgr.removeSource("/data/nonexistent.csv");

			expect(mgr.getSources()).toHaveLength(1);
			expect(deps.onSourceRemoved).toHaveBeenCalledOnce();
		});
	});

	// ── getLoadedHeaders ─────────────────────────────────────

	describe("getLoadedHeaders", () => {
		it("returns empty array when no sources have data", () => {
			expect(mgr.getLoadedHeaders()).toEqual([]);
		});

		it("returns headers from loaded sources", async () => {
			(deps.loadCsv as ReturnType<typeof vi.fn>).mockResolvedValue({
				headers: ["A", "B"],
				rows: [["1", "2"]],
			});

			mgr.addSource("/data/test.csv", "test");
			await vi.waitFor(() => expect(mgr.allLoaded).toBe(true));

			expect(mgr.getLoadedHeaders()).toEqual(["A", "B"]);
		});

		it("deduplicates headers across multiple sources", async () => {
			const loadCsv = deps.loadCsv as ReturnType<typeof vi.fn>;
			loadCsv
				.mockResolvedValueOnce({ headers: ["A", "B"], rows: [["1", "2"]] })
				.mockResolvedValueOnce({ headers: ["B", "C"], rows: [["3", "4"]] });

			mgr.addSource("/data/one.csv", "one");
			mgr.addSource("/data/two.csv", "two");
			await vi.waitFor(() => expect(mgr.allLoaded).toBe(true));

			expect(mgr.getLoadedHeaders()).toEqual(["A", "B", "C"]);
		});
	});

	// ── getDistinctValues ────────────────────────────────────

	describe("getDistinctValues", () => {
		it("returns distinct values for a column", async () => {
			(deps.loadCsv as ReturnType<typeof vi.fn>).mockResolvedValue({
				headers: ["Name"],
				rows: [["Alice"], ["Bob"], ["Alice"], ["Charlie"]],
			});

			mgr.addSource("/data/test.csv", "test");
			await vi.waitFor(() => expect(mgr.allLoaded).toBe(true));

			const values = mgr.getDistinctValues("Name");
			expect(values).toEqual(["Alice", "Bob", "Charlie"]);
		});

		it("respects maxValues limit", async () => {
			const rows = Array.from({ length: 50 }, (_, i) => [`Item${i}`]);
			(deps.loadCsv as ReturnType<typeof vi.fn>).mockResolvedValue({
				headers: ["Item"],
				rows,
			});

			mgr.addSource("/data/test.csv", "test");
			await vi.waitFor(() => expect(mgr.allLoaded).toBe(true));

			const values = mgr.getDistinctValues("Item", 1000, 5);
			expect(values).toHaveLength(5);
		});

		it("skips empty values", async () => {
			(deps.loadCsv as ReturnType<typeof vi.fn>).mockResolvedValue({
				headers: ["Name"],
				rows: [["Alice"], [""], ["Bob"]],
			});

			mgr.addSource("/data/test.csv", "test");
			await vi.waitFor(() => expect(mgr.allLoaded).toBe(true));

			expect(mgr.getDistinctValues("Name")).toEqual(["Alice", "Bob"]);
		});
	});

	// ── getRemainingAliases ──────────────────────────────────

	describe("getRemainingAliases", () => {
		it("returns set of all source aliases", () => {
			mgr.addSource("/data/a.csv", "alpha");
			mgr.addSource("/data/b.csv", "beta");

			const aliases = mgr.getRemainingAliases();
			expect(aliases).toEqual(new Set(["alpha", "beta"]));
		});
	});

	// ── buildSavedSources ────────────────────────────────────

	describe("buildSavedSources", () => {
		it("builds saved format omitting default values", () => {
			mgr.addSource("/data/sales.csv", "sales");
			const saved = mgr.buildSavedSources();

			expect(saved).toEqual([
				{
					alias: "sales",
					csvPath: "/data/sales.csv",
					sourceType: undefined,
					viewIndex: undefined,
					locale: undefined,
				},
			]);
		});

		it("includes non-default sourceType and locale", () => {
			mgr.addSource("/vault/db.base", "db", "base", 3);
			// Manually set locale to non-auto for persistence test
			mgr.getSources()[0].locale = "de-DE";

			const saved = mgr.buildSavedSources();
			expect(saved[0].sourceType).toBe("base");
			expect(saved[0].viewIndex).toBe(3);
			expect(saved[0].locale).toBe("de-DE");
		});
	});

	// ── loadFromSaved ────────────────────────────────────────

	describe("loadFromSaved", () => {
		it("clears existing sources and loads from saved format", () => {
			mgr.addSource("/data/old.csv", "old");

			mgr.loadFromSaved([
				{ alias: "a", csvPath: "/data/a.csv" },
				{ alias: "b", csvPath: "/data/b.csv" },
			]);

			expect(mgr.getSources()).toHaveLength(2);
			expect(mgr.getSources()[0].alias).toBe("a");
			expect(mgr.getSources()[1].alias).toBe("b");
		});

		it("defaults sourceType to csv and locale to auto", () => {
			mgr.loadFromSaved([{ alias: "test", csvPath: "/data/test.csv" }]);

			const src = mgr.getSources()[0];
			expect(src.sourceType).toBe("csv");
			expect(src.locale).toBe("auto");
		});

		it("calls onAllSourcesLoaded when pendingExecute and all loaded", async () => {
			(deps.loadCsv as ReturnType<typeof vi.fn>).mockResolvedValue({
				headers: ["A"],
				rows: [["1"]],
			});

			mgr.loadFromSaved(
				[{ alias: "test", csvPath: "/data/test.csv" }],
				true,
			);

			await vi.waitFor(() => expect(deps.onAllSourcesLoaded).toHaveBeenCalled());
		});
	});

	// ── reset ────────────────────────────────────────────────

	describe("reset", () => {
		it("clears all sources", () => {
			mgr.addSource("/data/a.csv", "a");
			mgr.addSource("/data/b.csv", "b");

			mgr.reset();

			expect(mgr.getSources()).toHaveLength(0);
			expect(mgr.hasSources).toBe(false);
		});
	});
});
