import { describe, expect, it, vi, beforeEach } from "vitest";
import { AnalyticsService, type ReadCsvCallback } from "../../../src/domain/analytics/AnalyticsService";
import type { DataExchangeState, ParsedCsv } from "../../../src/domain/dataExchange/types";
import type { ITypedStorage } from "../../../src/utils/TypedStorage";
import type { IEventBus } from "../../../src/infrastructure/events/types";

// ── Test helpers ──────────────────────────────────────────

function createMockStorage(): ITypedStorage<DataExchangeState> {
	let data: DataExchangeState = {
		savedImportConfigs: [],
		savedExportConfigs: [],
	};
	return {
		load: vi.fn(async () => data),
		save: vi.fn(async (state: DataExchangeState) => { data = state; }),
		safeLoad: vi.fn(async () => data),
		safeSave: vi.fn(async (state: DataExchangeState) => { data = state; return true; }),
	} as unknown as ITypedStorage<DataExchangeState>;
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
	let storage: ITypedStorage<DataExchangeState>;
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
});
