import { describe, expect, it, vi, beforeEach } from "vitest";
import { AnalyticsService, type ReadCsvCallback } from "../../../src/domain/analytics/AnalyticsService";
import type { AnalyticsState } from "../../../src/domain/analytics/types";
import type { ParsedCsv } from "../../../src/domain/dataExchange/types";
import type { ITypedStorage } from "../../../src/utils/TypedStorage";
import type { IEventBus } from "../../../src/infrastructure/events/types";

// ── Test helpers ──────────────────────────────────────────

function createMockStorage(): ITypedStorage<AnalyticsState> {
	let data: AnalyticsState = {
		savedAnalyticsQueries: [],
		dashboards: [],
	};
	return {
		load: vi.fn(async () => data),
		save: vi.fn(async (state: AnalyticsState) => { data = state; }),
		safeLoad: vi.fn(async () => data),
		safeSave: vi.fn(async (state: AnalyticsState) => { data = state; return true; }),
	} as unknown as ITypedStorage<AnalyticsState>;
}

function createMockEventBus(): IEventBus {
	const emitted: Array<{ type: string; payload: unknown }> = [];
	return {
		emit: vi.fn(async (type: string, payload: unknown) => {
			emitted.push({ type, payload });
		}),
		on: vi.fn(() => () => {}),
		_emitted: emitted,
	} as unknown as IEventBus & { _emitted: typeof emitted };
}

const testCsv: ParsedCsv = {
	headers: ["item_id", "name", "cost"],
	rows: [
		["I001", "Widget A", "10.50"],
		["I002", "Widget B", "25.00"],
		["I003", "Widget C", "7.75"],
	],
	rowCount: 3,
	detectedDelimiter: ",",
};

const mockReadCsv: ReadCsvCallback = vi.fn(async (path: string) => {
	if (path === "data/items.csv") return testCsv;
	return null;
});

// ── Tests ─────────────────────────────────────────────────

describe("AnalyticsService", () => {
	let service: AnalyticsService;
	let storage: ITypedStorage<AnalyticsState>;
	let eventBus: IEventBus & { _emitted: Array<{ type: string; payload: unknown }> };

	beforeEach(async () => {
		storage = createMockStorage();
		eventBus = createMockEventBus() as IEventBus & { _emitted: Array<{ type: string; payload: unknown }> };
		service = new AnalyticsService({
			storage,
			eventBus,
			readCsv: mockReadCsv,
		});
		await service.load();
	});

	describe("runQuery", () => {
		it("executes a query and returns result", async () => {
			const result = await service.runQuery({
				sources: [
					{
						alias: "items",
						data: { headers: testCsv.headers, rows: testCsv.rows },
						locale: "en-US",
					},
				],
				joins: [],
				columnTypeHints: [{ column: "cost", type: "number" }],
				dimensions: [{ column: "item_id" }],
				measures: [{ column: "cost", function: "SUM", label: "total_cost" }],
			});

			expect(result.rows).toHaveLength(3);
			expect(result.groupCount).toBe(3);
		});

		it("emits started and completed events", async () => {
			await service.runQuery({
				sources: [
					{
						alias: "items",
						data: { headers: testCsv.headers, rows: testCsv.rows },
					},
				],
				joins: [],
				columnTypeHints: [],
				dimensions: [{ column: "item_id" }],
				measures: [{ column: "item_id", function: "COUNT", label: "count" }],
			});

			const types = eventBus._emitted.map((e) => e.type);
			expect(types).toContain("analytics.query.started");
			expect(types).toContain("analytics.query.completed");
		});

		it("emits failed event on engine error", async () => {
			// Pass a source with corrupted data that causes the engine to throw
			const badQuery = {
				sources: [
					{
						alias: "bad",
						data: { headers: ["a"], rows: [["1"]] },
					},
				],
				joins: [],
				columnTypeHints: [],
				dimensions: [{ column: "a" }],
				measures: [{ column: "a", function: "SUM" as const, label: "sum" }],
			};

			// Patch the engine to throw for this test
			const origRun = (service as unknown as { engine: { run: (q: unknown) => unknown } }).engine.run;
			(service as unknown as { engine: { run: (q: unknown) => unknown } }).engine.run = () => {
				throw new Error("Engine exploded");
			};

			await expect(service.runQuery(badQuery)).rejects.toThrow("Engine exploded");

			const types = eventBus._emitted.map((e) => e.type);
			expect(types).toContain("analytics.query.started");
			expect(types).toContain("analytics.query.failed");

			// Restore
			(service as unknown as { engine: { run: typeof origRun } }).engine.run = origRun;
		});

		it("passes queryName to events", async () => {
			await service.runQuery(
				{
					sources: [
						{
							alias: "items",
							data: { headers: testCsv.headers, rows: testCsv.rows },
						},
					],
					joins: [],
					columnTypeHints: [],
					dimensions: [{ column: "item_id" }],
					measures: [{ column: "item_id", function: "COUNT", label: "count" }],
				},
				"Test Query",
			);

			const started = eventBus._emitted.find((e) => e.type === "analytics.query.started");
			expect((started?.payload as Record<string, unknown>).queryName).toBe("Test Query");
		});
	});

	describe("Saved query CRUD", () => {
		it("saves a query and lists it", async () => {
			const saved = await service.saveQuery(
				"My Query",
				[{ alias: "items", csvPath: "data/items.csv", locale: "en-US" }],
				{
					joins: [],
					columnTypeHints: [{ column: "cost", type: "number" }],
					dimensions: [{ column: "item_id" }],
					measures: [{ column: "cost", function: "SUM", label: "total" }],
				},
			);

			expect(saved.id).toMatch(/^aq_/);
			expect(saved.name).toBe("My Query");

			const list = service.listQueries();
			expect(list).toHaveLength(1);
			expect(list[0].name).toBe("My Query");
		});

		it("getQuery returns saved query by ID", async () => {
			const saved = await service.saveQuery(
				"Q1",
				[{ alias: "a", csvPath: "a.csv" }],
				{
					joins: [],
					columnTypeHints: [],
					dimensions: [{ column: "x" }],
					measures: [{ column: "x", function: "COUNT", label: "count" }],
				},
			);

			const found = service.getQuery(saved.id);
			expect(found?.name).toBe("Q1");
		});

		it("getQuery returns undefined for unknown ID", () => {
			expect(service.getQuery("nonexistent")).toBeUndefined();
		});

		it("deletes a saved query", async () => {
			const saved = await service.saveQuery(
				"To Delete",
				[{ alias: "a", csvPath: "a.csv" }],
				{
					joins: [],
					columnTypeHints: [],
					dimensions: [{ column: "x" }],
					measures: [{ column: "x", function: "COUNT", label: "count" }],
				},
			);

			const deleted = await service.deleteQuery(saved.id);
			expect(deleted).toBe(true);
			expect(service.listQueries()).toHaveLength(0);
		});

		it("delete returns false for unknown ID", async () => {
			const result = await service.deleteQuery("nonexistent");
			expect(result).toBe(false);
		});

		it("emits saved event", async () => {
			await service.saveQuery(
				"Q1",
				[{ alias: "a", csvPath: "a.csv" }],
				{
					joins: [],
					columnTypeHints: [],
					dimensions: [{ column: "x" }],
					measures: [{ column: "x", function: "COUNT", label: "count" }],
				},
			);

			const types = eventBus._emitted.map((e) => e.type);
			expect(types).toContain("analytics.query.saved");
		});

		it("emits deleted event", async () => {
			const saved = await service.saveQuery(
				"Q1",
				[{ alias: "a", csvPath: "a.csv" }],
				{
					joins: [],
					columnTypeHints: [],
					dimensions: [{ column: "x" }],
					measures: [{ column: "x", function: "COUNT", label: "count" }],
				},
			);

			await service.deleteQuery(saved.id);
			const types = eventBus._emitted.map((e) => e.type);
			expect(types).toContain("analytics.query.deleted");
		});

		it("persists saved queries to storage", async () => {
			await service.saveQuery(
				"Q1",
				[{ alias: "a", csvPath: "a.csv" }],
				{
					joins: [],
					columnTypeHints: [],
					dimensions: [{ column: "x" }],
					measures: [{ column: "x", function: "COUNT", label: "count" }],
				},
			);

			expect(storage.save).toHaveBeenCalled();
		});
	});

	describe("runSavedQuery", () => {
		it("loads CSV and executes saved query", async () => {
			const saved = await service.saveQuery(
				"Items Summary",
				[{ alias: "items", csvPath: "data/items.csv", locale: "en-US" }],
				{
					joins: [],
					columnTypeHints: [{ column: "cost", type: "number" }],
					dimensions: [{ column: "item_id" }],
					measures: [{ column: "cost", function: "SUM", label: "total_cost" }],
				},
			);

			const result = await service.runSavedQuery(saved.id);
			expect(result.rows).toHaveLength(3);
			expect(result.groupCount).toBe(3);
		});

		it("updates lastRun and lastRowCount after execution", async () => {
			const saved = await service.saveQuery(
				"Items Summary",
				[{ alias: "items", csvPath: "data/items.csv", locale: "en-US" }],
				{
					joins: [],
					columnTypeHints: [{ column: "cost", type: "number" }],
					dimensions: [{ column: "item_id" }],
					measures: [{ column: "cost", function: "SUM", label: "total_cost" }],
				},
			);

			await service.runSavedQuery(saved.id);

			const updated = service.getQuery(saved.id);
			expect(updated?.lastRun).toBeDefined();
			expect(updated?.lastRowCount).toBe(3);
		});

		it("throws for missing CSV file", async () => {
			const saved = await service.saveQuery(
				"Missing CSV",
				[{ alias: "missing", csvPath: "nonexistent.csv" }],
				{
					joins: [],
					columnTypeHints: [],
					dimensions: [{ column: "x" }],
					measures: [{ column: "x", function: "COUNT", label: "count" }],
				},
			);

			await expect(service.runSavedQuery(saved.id)).rejects.toThrow("CSV not found");
		});

		it("throws for nonexistent query ID", async () => {
			await expect(service.runSavedQuery("nonexistent")).rejects.toThrow("Saved query not found");
		});
	});

	describe("setReadCsv", () => {
		it("allows setting CSV reader after construction", async () => {
			const svc = new AnalyticsService({ storage, eventBus });
			svc.setReadCsv(mockReadCsv);

			const saved = await svc.saveQuery(
				"Test",
				[{ alias: "items", csvPath: "data/items.csv", locale: "en-US" }],
				{
					joins: [],
					columnTypeHints: [{ column: "cost", type: "number" }],
					dimensions: [{ column: "item_id" }],
					measures: [{ column: "cost", function: "SUM", label: "total" }],
				},
			);

			const result = await svc.runSavedQuery(saved.id);
			expect(result.rows).toHaveLength(3);
		});
	});

	describe("JSON file persistence", () => {
		function createMockFileSystem() {
			return {
				createFile: vi.fn(async () => undefined),
				deleteFile: vi.fn(async () => undefined),
				fileExists: vi.fn(async () => false),
				readFile: vi.fn(async () => ""),
				updateFile: vi.fn(async () => undefined),
			};
		}

		it("writes JSON file when saving query with fileSystem and queryFolder configured", async () => {
			const fs = createMockFileSystem();
			const svc = new AnalyticsService({ storage, eventBus, fileSystem: fs as never });
			await svc.load();
			svc.setQueryFolder("docs/Queries");

			await svc.saveQuery(
				"My Query",
				[{ alias: "items", csvPath: "data/items.csv" }],
				{
					joins: [],
					columnTypeHints: [],
					dimensions: [{ column: "item_id" }],
					measures: [{ column: "item_id", function: "COUNT" }],
				},
			);

			expect(fs.createFile).toHaveBeenCalledOnce();
			const call = fs.createFile.mock.calls[0] as unknown as [string, string, Record<string, unknown>];
			expect(call[0]).toBe("docs/Queries/My Query.json");
			expect(call[2]).toEqual({ createFolders: true });

			const parsed = JSON.parse(call[1]);
			expect(parsed.name).toBe("My Query");
			expect(parsed.sources).toHaveLength(1);
			expect(parsed.measures).toHaveLength(1);
		});

		it("deletes JSON file when deleting query", async () => {
			const fs = createMockFileSystem();
			const svc = new AnalyticsService({ storage, eventBus, fileSystem: fs as never });
			await svc.load();
			svc.setQueryFolder("docs/Queries");

			const saved = await svc.saveQuery(
				"To Delete",
				[{ alias: "a", csvPath: "a.csv" }],
				{
					joins: [],
					columnTypeHints: [],
					dimensions: [{ column: "x" }],
					measures: [{ column: "x", function: "SUM" }],
				},
			);

			await svc.deleteQuery(saved.id);

			expect(fs.deleteFile).toHaveBeenCalledWith("docs/Queries/To Delete.json");
		});

		it("skips file write when fileSystem is not configured", async () => {
			const svc = new AnalyticsService({ storage, eventBus });
			await svc.load();
			svc.setQueryFolder("docs/Queries");

			// Should not throw — just skips file writing
			const saved = await svc.saveQuery(
				"No FS",
				[{ alias: "a", csvPath: "a.csv" }],
				{
					joins: [],
					columnTypeHints: [],
					dimensions: [{ column: "x" }],
					measures: [{ column: "x", function: "COUNT" }],
				},
			);
			expect(saved.name).toBe("No FS");
		});

		it("skips file write when queryFolder is not set", async () => {
			const fs = createMockFileSystem();
			const svc = new AnalyticsService({ storage, eventBus, fileSystem: fs as never });
			await svc.load();
			// queryFolder NOT set

			await svc.saveQuery(
				"No Folder",
				[{ alias: "a", csvPath: "a.csv" }],
				{
					joins: [],
					columnTypeHints: [],
					dimensions: [{ column: "x" }],
					measures: [{ column: "x", function: "COUNT" }],
				},
			);

			expect(fs.createFile).not.toHaveBeenCalled();
		});

		it("sanitizes special characters in filename", async () => {
			const fs = createMockFileSystem();
			const svc = new AnalyticsService({ storage, eventBus, fileSystem: fs as never });
			await svc.load();
			svc.setQueryFolder("docs/Queries");

			await svc.saveQuery(
				'Cost/Revenue: "Q1" <2025>',
				[{ alias: "a", csvPath: "a.csv" }],
				{
					joins: [],
					columnTypeHints: [],
					dimensions: [{ column: "x" }],
					measures: [{ column: "x", function: "SUM" }],
				},
			);

			const call = fs.createFile.mock.calls[0] as unknown as [string, string, unknown];
			expect(call[0]).toBe("docs/Queries/Cost-Revenue- -Q1- -2025-.json");
			// Verify the filename portion has no special characters
			const fileName = (call[0]).split("/").pop()!;
			expect(fileName).not.toMatch(/[\\/:*?"<>|]/);
		});

		it("does not throw when delete file fails", async () => {
			const fs = createMockFileSystem();
			fs.deleteFile = vi.fn(async () => { throw new Error("not found"); });
			const svc = new AnalyticsService({ storage, eventBus, fileSystem: fs as never });
			await svc.load();
			svc.setQueryFolder("docs/Queries");

			const saved = await svc.saveQuery(
				"Q1",
				[{ alias: "a", csvPath: "a.csv" }],
				{
					joins: [],
					columnTypeHints: [],
					dimensions: [{ column: "x" }],
					measures: [{ column: "x", function: "SUM" }],
				},
			);

			// Should not throw even though deleteFile fails
			await expect(svc.deleteQuery(saved.id)).resolves.toBe(true);
		});
	});

	// ── updateTile whitelist (AI-3 fix) ──────────────────

	describe("updateTile whitelist", () => {
		async function createDashboardWithTile() {
			const dashboard = await service.createDashboard("Test DB");
			const saved = await service.saveQuery(
				"Q1",
				[{ alias: "a", csvPath: "a.csv" }],
				{
					joins: [],
					columnTypeHints: [],
					dimensions: [{ column: "x" }],
					measures: [{ column: "x", function: "COUNT", label: "count" }],
				},
			);
			const tile = await service.addTile(dashboard.id, saved.id, "table", "Tile 1");
			return { dashboardId: dashboard.id, tileId: tile!.id };
		}

		it("persists all whitelisted fields through updateTile", async () => {
			const { dashboardId, tileId } = await createDashboardWithTile();

			const updated = await service.updateTile(dashboardId, tileId, {
				title: "Updated Title",
				displayMode: "stat-card",
				row: 2,
				col: 1,
				width: 3,
				height: 2,
				conditionalRules: [{ column: "x", operator: ">", threshold: 10, color: "red" }],
				showSparkline: false,
				chartValueColumn: "revenue",
			});

			expect(updated).toBeDefined();
			expect(updated!.title).toBe("Updated Title");
			expect(updated!.displayMode).toBe("stat-card");
			expect(updated!.row).toBe(2);
			expect(updated!.col).toBe(1);
			expect(updated!.width).toBe(3);
			expect(updated!.height).toBe(2);
			expect(updated!.conditionalRules).toHaveLength(1);
			expect(updated!.showSparkline).toBe(false);
			expect(updated!.chartValueColumn).toBe("revenue");
		});

		it("only updates fields that are provided", async () => {
			const { dashboardId, tileId } = await createDashboardWithTile();

			// Set chartValueColumn first
			await service.updateTile(dashboardId, tileId, { chartValueColumn: "cost" });

			// Update only title — chartValueColumn should be preserved
			const updated = await service.updateTile(dashboardId, tileId, { title: "New Title" });

			expect(updated!.title).toBe("New Title");
			expect(updated!.chartValueColumn).toBe("cost");
		});

		it("returns undefined for nonexistent dashboard", async () => {
			const result = await service.updateTile("nonexistent", "any", { title: "x" });
			expect(result).toBeUndefined();
		});

		it("returns undefined for nonexistent tile", async () => {
			const dashboard = await service.createDashboard("DB");
			const result = await service.updateTile(dashboard.id, "nonexistent", { title: "x" });
			expect(result).toBeUndefined();
		});

		it("emits tile.updated event", async () => {
			const { dashboardId, tileId } = await createDashboardWithTile();
			eventBus._emitted.length = 0;

			await service.updateTile(dashboardId, tileId, { title: "Updated" });

			const types = eventBus._emitted.map((e) => e.type);
			expect(types).toContain("analytics.dashboard.tile.updated");
		});
	});

	// ── Sort migration (v38 — SortSpec → SortSpec[]) ──────

	describe("sort migration on load", () => {
		it("wraps single SortSpec in array on load", async () => {
			const legacyStorage = {
				load: vi.fn(async () => ({
					savedAnalyticsQueries: [{
						id: "aq_legacy",
						name: "Legacy",
						createdAt: Date.now(),
						sources: [{ alias: "a", csvPath: "a.csv" }],
						joins: [],
						columnTypeHints: [],
						dimensions: [{ column: "x" }],
						measures: [{ column: "x", function: "SUM" }],
						// Legacy single SortSpec (not array)
						sort: { column: "x", direction: "asc" } as unknown,
					}],
					dashboards: [],
				})),
				save: vi.fn(),
				safeLoad: vi.fn(),
				safeSave: vi.fn(),
			} as unknown as ITypedStorage<AnalyticsState>;

			const svc = new AnalyticsService({ storage: legacyStorage, eventBus });
			await svc.load();

			const query = svc.getQuery("aq_legacy");
			expect(query).toBeDefined();
			expect(Array.isArray(query!.sort)).toBe(true);
			expect(query!.sort).toHaveLength(1);
			expect(query!.sort![0].column).toBe("x");
			expect(query!.sort![0].direction).toBe("asc");
		});

		it("leaves array sort untouched on load", async () => {
			const modernStorage = {
				load: vi.fn(async () => ({
					savedAnalyticsQueries: [{
						id: "aq_modern",
						name: "Modern",
						createdAt: Date.now(),
						sources: [{ alias: "a", csvPath: "a.csv" }],
						joins: [],
						columnTypeHints: [],
						dimensions: [{ column: "x" }],
						measures: [{ column: "x", function: "SUM" }],
						sort: [
							{ column: "x", direction: "asc" },
							{ column: "y", direction: "desc" },
						],
					}],
					dashboards: [],
				})),
				save: vi.fn(),
				safeLoad: vi.fn(),
				safeSave: vi.fn(),
			} as unknown as ITypedStorage<AnalyticsState>;

			const svc = new AnalyticsService({ storage: modernStorage, eventBus });
			await svc.load();

			const query = svc.getQuery("aq_modern");
			expect(query!.sort).toHaveLength(2);
			expect(query!.sort![0].column).toBe("x");
			expect(query!.sort![1].column).toBe("y");
		});

		it("handles undefined sort on load", async () => {
			const noSortStorage = {
				load: vi.fn(async () => ({
					savedAnalyticsQueries: [{
						id: "aq_nosort",
						name: "No Sort",
						createdAt: Date.now(),
						sources: [{ alias: "a", csvPath: "a.csv" }],
						joins: [],
						columnTypeHints: [],
						dimensions: [{ column: "x" }],
						measures: [{ column: "x", function: "SUM" }],
					}],
					dashboards: [],
				})),
				save: vi.fn(),
				safeLoad: vi.fn(),
				safeSave: vi.fn(),
			} as unknown as ITypedStorage<AnalyticsState>;

			const svc = new AnalyticsService({ storage: noSortStorage, eventBus });
			await svc.load();

			const query = svc.getQuery("aq_nosort");
			expect(query!.sort).toBeUndefined();
		});
	});

	describe("CSV folder source", () => {
		const jan: ParsedCsv = {
			headers: ["date", "product", "revenue"],
			rows: [
				["2026-01-15", "Widget A", "100"],
				["2026-01-28", "Widget B", "200"],
			],
			rowCount: 2,
			detectedDelimiter: ",",
		};

		const feb: ParsedCsv = {
			headers: ["date", "product", "revenue"],
			rows: [
				["2026-02-10", "Widget A", "150"],
				["2026-02-22", "Widget C", "300"],
			],
			rowCount: 2,
			detectedDelimiter: ",",
		};

		it("merges multiple CSV files from a folder", async () => {
			const folderReader: ReadCsvCallback = vi.fn(async (path: string) => {
				if (path === "sales/2026-01.csv") return jan;
				if (path === "sales/2026-02.csv") return feb;
				return null;
			});

			const svc = new AnalyticsService({ storage, eventBus, readCsv: folderReader });
			svc.setListFolder(async () => ["sales/2026-01.csv", "sales/2026-02.csv", "sales/notes.txt"]);
			await svc.load();

			const saved = await svc.saveQuery(
				"Merged Sales",
				[{ alias: "sales", csvPath: "sales", sourceType: "csv-folder", locale: "en-US" }],
				{
					joins: [],
					columnTypeHints: [{ column: "revenue", type: "number" }],
					dimensions: [{ column: "product" }],
					measures: [{ column: "revenue", function: "SUM", label: "total_revenue" }],
				},
			);

			const result = await svc.runSavedQuery(saved.id);
			expect(result.rows).toHaveLength(3); // Widget A, Widget B, Widget C
			const widgetA = result.rows.find((r) => r.product === "Widget A");
			expect(widgetA?.total_revenue).toBe(250); // 100 + 150
		});

		it("throws on header mismatch across CSV files", async () => {
			const mismatch: ParsedCsv = {
				headers: ["date", "item", "cost"], // different headers
				rows: [["2026-03-01", "X", "50"]],
				rowCount: 1,
				detectedDelimiter: ",",
			};

			const folderReader: ReadCsvCallback = vi.fn(async (path: string) => {
				if (path === "sales/2026-01.csv") return jan;
				if (path === "sales/2026-03.csv") return mismatch;
				return null;
			});

			const svc = new AnalyticsService({ storage, eventBus, readCsv: folderReader });
			svc.setListFolder(async () => ["sales/2026-01.csv", "sales/2026-03.csv"]);
			await svc.load();

			const saved = await svc.saveQuery(
				"Bad Merge",
				[{ alias: "sales", csvPath: "sales", sourceType: "csv-folder" }],
				{
					joins: [],
					columnTypeHints: [],
					dimensions: [],
					measures: [{ column: "revenue", function: "SUM", label: "total" }],
				},
			);

			await expect(svc.runSavedQuery(saved.id)).rejects.toThrow("Header mismatch");
		});

		it("throws when folder has no CSV files", async () => {
			const svc = new AnalyticsService({ storage, eventBus, readCsv: mockReadCsv });
			svc.setListFolder(async () => ["sales/notes.txt", "sales/readme.md"]);
			await svc.load();

			const saved = await svc.saveQuery(
				"Empty Folder",
				[{ alias: "data", csvPath: "sales", sourceType: "csv-folder" }],
				{
					joins: [],
					columnTypeHints: [],
					dimensions: [],
					measures: [{ column: "x", function: "COUNT", label: "n" }],
				},
			);

			await expect(svc.runSavedQuery(saved.id)).rejects.toThrow("No CSV files");
		});

		it("throws when listFolder not configured", async () => {
			const svc = new AnalyticsService({ storage, eventBus, readCsv: mockReadCsv });
			// Not calling setListFolder
			await svc.load();

			const saved = await svc.saveQuery(
				"No Folder",
				[{ alias: "data", csvPath: "sales", sourceType: "csv-folder" }],
				{
					joins: [],
					columnTypeHints: [],
					dimensions: [],
					measures: [{ column: "x", function: "COUNT", label: "n" }],
				},
			);

			await expect(svc.runSavedQuery(saved.id)).rejects.toThrow("Folder listing not configured");
		});
	});
});
