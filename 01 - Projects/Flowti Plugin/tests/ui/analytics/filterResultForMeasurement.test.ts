import { describe, it, expect } from "vitest";
import { filterResultForMeasurement } from "../../../src/ui/analytics/dashboardUtils";
import type { AnalyticsResult, Measurement } from "../../../src/domain/analytics/types";

const baseResult: AnalyticsResult = {
	columns: ["country", "product", "revenue", "cost"],
	rows: [
		{ country: "NL", product: "Widget", revenue: 100, cost: 50 },
		{ country: "DE", product: "Gadget", revenue: 200, cost: 80 },
	],
	groupCount: 2,
	sourceRowCount: 2,
};

const singleMeasurement: Measurement = {
	id: "am_1",
	name: "Revenue",
	queryId: "q1",
	type: "single",
	measureColumn: "revenue",
	createdAt: 0,
	updatedAt: 0,
};

const seriesMeasurement: Measurement = {
	id: "am_2",
	name: "Revenue Over Time",
	queryId: "q1",
	type: "series",
	measureColumn: "revenue",
	createdAt: 0,
	updatedAt: 0,
};

const query = {
	dimensions: [{ column: "country" }],
};

describe("filterResultForMeasurement", () => {
	// ── Single type: aggregates into one row ──────────────

	it("single-type aggregates measure column into one row (grand total)", () => {
		const result = filterResultForMeasurement(baseResult, singleMeasurement, query);
		expect(result!.columns).toEqual(["revenue"]);
		expect(result!.rows).toEqual([{ revenue: 300 }]);
	});

	it("single-type with time bucket still produces one row", () => {
		const tbResult: AnalyticsResult = {
			...baseResult,
			columns: ["date_month", "country", "revenue", "cost"],
			rows: [
				{ date_month: "2026-01", country: "NL", revenue: 100, cost: 50 },
				{ date_month: "2026-02", country: "NL", revenue: 150, cost: 60 },
				{ date_month: "2026-01", country: "DE", revenue: 200, cost: 80 },
			],
		};
		const queryWithTb = {
			dimensions: [{ column: "country" }],
			timeBucket: { column: "date", period: "month", outputColumn: "date_month" },
		};
		const result = filterResultForMeasurement(tbResult, singleMeasurement, queryWithTb);
		expect(result!.columns).toEqual(["revenue"]);
		expect(result!.rows).toEqual([{ revenue: 450 }]);
	});

	it("single-type with no dimensions still aggregates", () => {
		const queryNoDims = { dimensions: [] as Array<{ column: string }> };
		const result = filterResultForMeasurement(baseResult, singleMeasurement, queryNoDims);
		expect(result!.columns).toEqual(["revenue"]);
		expect(result!.rows).toEqual([{ revenue: 300 }]);
	});

	// ── Series type: keeps dims + time bucket + measure ──

	it("series-type keeps dimension + time bucket + measure columns", () => {
		const tbResult: AnalyticsResult = {
			...baseResult,
			columns: ["date_month", "country", "revenue", "cost"],
			rows: [
				{ date_month: "2026-01", country: "NL", revenue: 100, cost: 50 },
				{ date_month: "2026-02", country: "NL", revenue: 150, cost: 60 },
			],
		};
		const queryWithTb = {
			dimensions: [{ column: "country" }],
			timeBucket: { column: "date", period: "month", outputColumn: "date_month" },
		};
		const result = filterResultForMeasurement(tbResult, seriesMeasurement, queryWithTb);
		expect(result!.columns).toEqual(["date_month", "country", "revenue"]);
		expect(result!.rows).toHaveLength(2);
	});

	it("series-type without time bucket keeps dims + measure", () => {
		const result = filterResultForMeasurement(baseResult, seriesMeasurement, query);
		expect(result!.columns).toEqual(["country", "revenue"]);
		expect(result!.rows).toHaveLength(2);
	});

	// ── Pass-through cases ────────────────────────────────

	it("returns full result when measureColumn is not set", () => {
		const m: Measurement = { ...singleMeasurement, measureColumn: undefined };
		const result = filterResultForMeasurement(baseResult, m, query);
		expect(result!.columns).toEqual(baseResult.columns);
	});

	it("returns full result when measureColumn is not in result columns", () => {
		const m: Measurement = { ...singleMeasurement, measureColumn: "profit" };
		const result = filterResultForMeasurement(baseResult, m, query);
		expect(result!.columns).toEqual(baseResult.columns);
	});

	it("returns null when result is null", () => {
		const result = filterResultForMeasurement(null, singleMeasurement, query);
		expect(result).toBeNull();
	});

	it("returns original result when measurement is undefined", () => {
		const result = filterResultForMeasurement(baseResult, undefined, query);
		expect(result).toBe(baseResult);
	});

	// ── Edge cases ────────────────────────────────────────

	it("single-type handles zero values correctly", () => {
		const zeroResult: AnalyticsResult = {
			columns: ["category", "revenue"],
			rows: [
				{ category: "A", revenue: 0 },
				{ category: "B", revenue: 0 },
			],
			groupCount: 2,
			sourceRowCount: 2,
		};
		const result = filterResultForMeasurement(zeroResult, singleMeasurement, query);
		expect(result!.rows).toEqual([{ revenue: 0 }]);
	});

	it("single-type with one row returns that row's value", () => {
		const oneRow: AnalyticsResult = {
			columns: ["country", "revenue"],
			rows: [{ country: "NL", revenue: 42 }],
			groupCount: 1,
			sourceRowCount: 1,
		};
		const result = filterResultForMeasurement(oneRow, singleMeasurement, query);
		expect(result!.rows).toEqual([{ revenue: 42 }]);
	});

	it("series-type uses default time bucket output column when none specified", () => {
		const tbResult: AnalyticsResult = {
			...baseResult,
			columns: ["date_month", "country", "revenue", "cost"],
			rows: [{ date_month: "2026-01", country: "NL", revenue: 100, cost: 50 }],
		};
		const queryDefaultTb = {
			dimensions: [{ column: "country" }],
			timeBucket: { column: "date", period: "month" },
		};
		const result = filterResultForMeasurement(tbResult, seriesMeasurement, queryDefaultTb);
		expect(result!.columns).toEqual(["date_month", "country", "revenue"]);
	});
});
