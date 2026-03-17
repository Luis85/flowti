import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryPersistenceManager, type QueryPersistenceDeps, type QueryStateSnapshot } from "../../../src/ui/analytics/queries/QueryPersistenceManager";
import type { SavedAnalyticsQuery } from "../../../src/domain/analytics/types";

function emptySnapshot(): QueryStateSnapshot {
	return {
		columnTypeHints: [],
		joins: [],
		dimensions: [],
		measures: [],
		timeBucket: null,
		filters: [],
		sort: [],
		limit: null,
		computedColumns: [],
		excludedColumns: [],
	};
}

function createSavedQuery(id = "q-1", name = "Test Query"): SavedAnalyticsQuery {
	return {
		id,
		name,
		createdAt: Date.now(),
		sources: [{ csvPath: "data.csv", alias: "data", sourceType: "csv" as const }],
		columnTypeHints: [{ column: "amount", type: "number" as const }],
		joins: [],
		dimensions: [{ column: "region" }],
		measures: [{ column: "amount", function: "SUM" as const }],
		timeBucket: undefined,
		filters: undefined,
		sort: [{ column: "amount", direction: "desc" as const }],
		limit: 10,
		computedColumns: undefined,
		excludedColumns: undefined,
	};
}

function createDeps(overrides?: Partial<QueryPersistenceDeps>): QueryPersistenceDeps {
	return {
		sourceManager: {
			buildSavedSources: vi.fn().mockReturnValue([{ csvPath: "data.csv", alias: "data", sourceType: "csv" }]),
			loadFromSaved: vi.fn(),
			reset: vi.fn(),
		} as any,
		getQueryConfig: () => ({
			joins: [],
			columnTypeHints: [],
			dimensions: [{ column: "region" }],
			measures: [{ column: "amount", function: "SUM" }],
		}),
		setQueryState: vi.fn(),
		getSelectedQueryId: vi.fn().mockReturnValue(null),
		setSelectedQueryId: vi.fn(),
		scheduleRender: vi.fn(),
		saveQuery: vi.fn().mockResolvedValue({ id: "new-q-1", name: "Test" }),
		updateQuery: vi.fn().mockResolvedValue(undefined),
		getQuery: vi.fn().mockReturnValue(undefined),
		syncMeasurementsFromQuery: vi.fn().mockResolvedValue(undefined),
		...overrides,
	};
}

describe("QueryPersistenceManager", () => {
	let deps: QueryPersistenceDeps;
	let manager: QueryPersistenceManager;

	beforeEach(() => {
		deps = createDeps();
		manager = new QueryPersistenceManager(deps);
	});

	describe("initial state", () => {
		it("starts with empty query name", () => {
			expect(manager.queryName).toBe("");
		});

		it("starts with null lastLoadedQueryId", () => {
			expect(manager.lastLoadedQueryId).toBeNull();
		});
	});

	describe("dirty tracking", () => {
		it("reports dirty when measures exist and no snapshot", () => {
			expect(manager.isDirty(true)).toBe(true);
		});

		it("reports clean when no measures and no snapshot", () => {
			expect(manager.isDirty(false)).toBe(false);
		});

		it("reports clean after taking snapshot with same config", () => {
			manager.updateSnapshot();
			expect(manager.isDirty(true)).toBe(false);
		});

		it("reports dirty when config changes after snapshot", () => {
			manager.updateSnapshot();
			// Simulate config change by switching getQueryConfig
			let callCount = 0;
			(deps as any).getQueryConfig = () => {
				callCount++;
				return callCount <= 1
					? { joins: [], columnTypeHints: [], dimensions: [{ column: "region" }], measures: [{ column: "amount", function: "SUM" }] }
					: { joins: [], columnTypeHints: [], dimensions: [{ column: "country" }], measures: [{ column: "amount", function: "SUM" }] };
			};
			manager.updateSnapshot(); // snapshot with first config
			expect(manager.isDirty(true)).toBe(true); // second call returns different config
		});
	});

	describe("save", () => {
		it("saves query with configured name", async () => {
			manager.queryName = "My Analysis";
			await manager.save();

			expect(deps.saveQuery).toHaveBeenCalledWith(
				"My Analysis",
				expect.any(Array),
				expect.any(Object),
			);
		});

		it("generates name when queryName is empty", async () => {
			manager.queryName = "";
			await manager.save();

			const name = (deps.saveQuery as any).mock.calls[0][0] as string;
			expect(name).toMatch(/^Query \d{4}-\d{2}-\d{2}/);
		});

		it("sets selected query ID after save", async () => {
			await manager.save();

			expect(deps.setSelectedQueryId).toHaveBeenCalledWith("new-q-1");
		});

		it("syncs measurements after save", async () => {
			await manager.save();

			expect(deps.syncMeasurementsFromQuery).toHaveBeenCalledWith("new-q-1");
		});

		it("schedules master render after save", async () => {
			await manager.save();

			expect(deps.scheduleRender).toHaveBeenCalledWith(true, false);
		});
	});

	describe("update", () => {
		it("updates existing query by selectedQueryId", async () => {
			deps = createDeps({
				getSelectedQueryId: vi.fn().mockReturnValue("existing-q"),
			});
			manager = new QueryPersistenceManager(deps);

			await manager.update();

			expect(deps.updateQuery).toHaveBeenCalledWith(
				"existing-q",
				expect.any(Array),
				expect.any(Object),
			);
		});

		it("does nothing when no selectedQueryId", async () => {
			await manager.update();

			expect(deps.updateQuery).not.toHaveBeenCalled();
		});

		it("syncs measurements after update", async () => {
			deps = createDeps({
				getSelectedQueryId: vi.fn().mockReturnValue("existing-q"),
			});
			manager = new QueryPersistenceManager(deps);

			await manager.update();

			expect(deps.syncMeasurementsFromQuery).toHaveBeenCalledWith("existing-q");
		});
	});

	describe("load", () => {
		it("loads saved query state into setQueryState", () => {
			const saved = createSavedQuery("q-1", "Revenue by Region");
			deps = createDeps({
				getQuery: vi.fn().mockReturnValue(saved),
			});
			manager = new QueryPersistenceManager(deps);

			manager.load("q-1");

			expect(deps.setQueryState).toHaveBeenCalledWith(expect.objectContaining({
				dimensions: [{ column: "region" }],
				measures: [{ column: "amount", function: "SUM" }],
				limit: 10,
			}));
		});

		it("sets lastLoadedQueryId", () => {
			deps = createDeps({
				getQuery: vi.fn().mockReturnValue(createSavedQuery("q-1")),
			});
			manager = new QueryPersistenceManager(deps);

			manager.load("q-1");

			expect(manager.lastLoadedQueryId).toBe("q-1");
		});

		it("calls sourceManager.loadFromSaved with pendingExecute", () => {
			const saved = createSavedQuery();
			deps = createDeps({
				getQuery: vi.fn().mockReturnValue(saved),
			});
			manager = new QueryPersistenceManager(deps);

			manager.load("q-1");

			expect(deps.sourceManager.loadFromSaved).toHaveBeenCalledWith(saved.sources, true);
		});

		it("schedules both master and detail render", () => {
			deps = createDeps({
				getQuery: vi.fn().mockReturnValue(createSavedQuery()),
			});
			manager = new QueryPersistenceManager(deps);

			manager.load("q-1");

			expect(deps.scheduleRender).toHaveBeenCalledWith(true, true);
		});

		it("does nothing for unknown queryId", () => {
			manager.load("nonexistent");

			expect(deps.setQueryState).not.toHaveBeenCalled();
			expect(manager.lastLoadedQueryId).toBeNull();
		});

		it("deep-copies arrays and objects from saved query", () => {
			const saved = createSavedQuery();
			deps = createDeps({
				getQuery: vi.fn().mockReturnValue(saved),
			});
			manager = new QueryPersistenceManager(deps);

			manager.load("q-1");

			const stateArg = (deps.setQueryState as any).mock.calls[0][0] as QueryStateSnapshot;
			// Verify deep copies (not same references)
			expect(stateArg.dimensions).not.toBe(saved.dimensions);
			expect(stateArg.measures).not.toBe(saved.measures);
			expect(stateArg.sort).not.toBe(saved.sort);
		});
	});

	describe("newQuery", () => {
		it("resets source manager", () => {
			manager.newQuery();

			expect(deps.sourceManager.reset).toHaveBeenCalled();
		});

		it("sets empty query state", () => {
			manager.newQuery();

			expect(deps.setQueryState).toHaveBeenCalledWith(emptySnapshot());
		});

		it("clears selectedQueryId", () => {
			manager.newQuery();

			expect(deps.setSelectedQueryId).toHaveBeenCalledWith(null);
		});

		it("clears internal state", () => {
			manager.queryName = "Test";
			manager.lastLoadedQueryId = "q-1";
			manager.updateSnapshot();

			manager.newQuery();

			expect(manager.queryName).toBe("");
			expect(manager.lastLoadedQueryId).toBeNull();
		});

		it("schedules both master and detail render", () => {
			manager.newQuery();

			expect(deps.scheduleRender).toHaveBeenCalledWith(true, true);
		});
	});

	describe("reset", () => {
		it("clears internal tracking without touching sourceManager", () => {
			manager.queryName = "Test";
			manager.lastLoadedQueryId = "q-1";

			manager.reset();

			expect(manager.queryName).toBe("");
			expect(manager.lastLoadedQueryId).toBeNull();
			expect(deps.sourceManager.reset).not.toHaveBeenCalled();
		});
	});
});
