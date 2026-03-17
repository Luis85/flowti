import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryExecutionManager, type QueryExecutionDeps } from "../../../src/ui/analytics/queries/QueryExecutionManager";
import type { AnalyticsQuery, AnalyticsResult } from "../../../src/domain/analytics/types";

function createMockResult(rowCount = 3): AnalyticsResult {
	return {
		columns: ["region", "total"],
		rows: Array.from({ length: rowCount }, (_, i) => ({ region: `R${i}`, total: (i + 1) * 100 })),
		groupCount: rowCount,
		sourceRowCount: rowCount * 2,
	};
}

function createDeps(overrides?: Partial<QueryExecutionDeps>): QueryExecutionDeps {
	return {
		getSources: () => [
			{
				csvPath: "data.csv",
				alias: "data",
				sourceType: "csv" as const,
				locale: "auto" as const,
				loading: false,
				data: { headers: ["region", "amount"], rows: [["EMEA", "100"]] },
			},
		],
		getQueryConfig: () => ({
			joins: [],
			columnTypeHints: [],
			dimensions: [{ column: "region" }],
			measures: [{ column: "amount", function: "SUM" as const }],
		}),
		runQuery: vi.fn().mockResolvedValue(createMockResult()),
		onStateChanged: vi.fn(),
		...overrides,
	};
}

describe("QueryExecutionManager", () => {
	let deps: QueryExecutionDeps;
	let manager: QueryExecutionManager;

	beforeEach(() => {
		deps = createDeps();
		manager = new QueryExecutionManager(deps);
	});

	it("starts with clean state", () => {
		expect(manager.running).toBe(false);
		expect(manager.result).toBeNull();
		expect(manager.durationMs).toBeUndefined();
		expect(manager.error).toBeNull();
	});

	it("executes a query and stores result", async () => {
		await manager.execute();

		expect(manager.running).toBe(false);
		expect(manager.result).not.toBeNull();
		expect(manager.result!.rows).toHaveLength(3);
		expect(manager.durationMs).toBeGreaterThanOrEqual(0);
		expect(manager.error).toBeNull();
	});

	it("calls onStateChanged at start and end of execution", async () => {
		await manager.execute();

		// Called twice: once at start (running=true), once at end (running=false)
		expect(deps.onStateChanged).toHaveBeenCalledTimes(2);
	});

	it("filters out sources without data", async () => {
		const capturedQuery: AnalyticsQuery[] = [];
		deps = createDeps({
			getSources: () => [
				{ csvPath: "a.csv", alias: "a", sourceType: "csv" as const, locale: "auto" as const, loading: false, data: { headers: ["x"], rows: [["1"]] } },
				{ csvPath: "b.csv", alias: "b", sourceType: "csv" as const, locale: "auto" as const, loading: true, data: null },
			],
			runQuery: vi.fn().mockImplementation((q: AnalyticsQuery) => {
				capturedQuery.push(q);
				return Promise.resolve(createMockResult(1));
			}),
		});
		manager = new QueryExecutionManager(deps);

		await manager.execute();

		expect(capturedQuery[0].sources).toHaveLength(1);
		expect(capturedQuery[0].sources[0].alias).toBe("a");
	});

	it("strips auto locale from sources", async () => {
		const capturedQuery: AnalyticsQuery[] = [];
		deps = createDeps({
			getSources: () => [
				{ csvPath: "a.csv", alias: "a", sourceType: "csv" as const, loading: false, locale: "auto" as const, data: { headers: ["x"], rows: [["1"]] } },
				{ csvPath: "b.csv", alias: "b", sourceType: "csv" as const, loading: false, locale: "de-DE" as const, data: { headers: ["y"], rows: [["2"]] } },
			],
			runQuery: vi.fn().mockImplementation((q: AnalyticsQuery) => {
				capturedQuery.push(q);
				return Promise.resolve(createMockResult(1));
			}),
		});
		manager = new QueryExecutionManager(deps);

		await manager.execute();

		expect(capturedQuery[0].sources[0].locale).toBeUndefined();
		expect(capturedQuery[0].sources[1].locale).toBe("de-DE");
	});

	it("captures error on query failure", async () => {
		deps = createDeps({
			runQuery: vi.fn().mockRejectedValue(new Error("Parse failed")),
		});
		manager = new QueryExecutionManager(deps);

		await manager.execute();

		expect(manager.running).toBe(false);
		expect(manager.result).toBeNull();
		expect(manager.error).toBe("Parse failed");
	});

	it("handles non-Error thrown values", async () => {
		deps = createDeps({
			runQuery: vi.fn().mockRejectedValue("string error"),
		});
		manager = new QueryExecutionManager(deps);

		await manager.execute();

		expect(manager.error).toBe("string error");
	});

	it("reset clears all state", async () => {
		await manager.execute();
		expect(manager.result).not.toBeNull();

		manager.reset();

		expect(manager.running).toBe(false);
		expect(manager.result).toBeNull();
		expect(manager.durationMs).toBeUndefined();
		expect(manager.error).toBeNull();
	});

	it("builds query from deps getSources and getQueryConfig", async () => {
		const runQuery = vi.fn().mockResolvedValue(createMockResult());
		deps = createDeps({ runQuery });
		manager = new QueryExecutionManager(deps);

		await manager.execute();

		const query = runQuery.mock.calls[0][0] as AnalyticsQuery;
		expect(query.sources).toHaveLength(1);
		expect(query.dimensions).toHaveLength(1);
		expect(query.measures).toHaveLength(1);
	});
});
