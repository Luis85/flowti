import { describe, expect, it } from "vitest";
import { AnalyticsEngine } from "../../../src/domain/analytics/AnalyticsEngine";
import type {
	AnalyticsQuery,
	AnalyticsSource,
	ParsedSourceData,
} from "../../../src/domain/analytics/types";

// ── Test data factories ─────────────────────────────────

function makeSource(
	alias: string,
	headers: string[],
	rows: string[][],
	locale?: AnalyticsSource["locale"],
): AnalyticsSource {
	return { alias, data: { headers, rows }, locale };
}

const items: AnalyticsSource = makeSource(
	"items",
	["item_id", "item_name", "unit_cost"],
	[
		["I001", "Widget A", "10.50"],
		["I002", "Widget B", "25.00"],
		["I003", "Widget C", "7.75"],
	],
	"en-US",
);

const suppliers: AnalyticsSource = makeSource(
	"suppliers",
	["supplier_id", "supplier_name", "country"],
	[
		["S01", "Acme Corp", "US"],
		["S02", "EuroSupply", "DE"],
	],
);

const sales: AnalyticsSource = makeSource(
	"sales",
	["sale_id", "item_id", "supplier_id", "quantity", "sale_date", "total"],
	[
		["1", "I001", "S01", "10", "02/15/2026", "105.00"],
		["2", "I001", "S02", "5", "03/20/2026", "52.50"],
		["3", "I002", "S01", "3", "02/28/2026", "75.00"],
		["4", "I002", "S01", "7", "04/10/2026", "175.00"],
		["5", "I003", "S02", "20", "01/05/2026", "155.00"],
		["6", "I001", "S01", "8", "04/22/2026", "84.00"],
	],
	"en-US",
);

// ── Engine tests ────────────────────────────────────────

describe("AnalyticsEngine", () => {
	const engine = new AnalyticsEngine();

	describe("Single source — GROUP BY + aggregation", () => {
		it("GROUP BY 1 dimension with SUM", () => {
			const query: AnalyticsQuery = {
				sources: [sales],
				joins: [],
				columnTypeHints: [{ column: "total", type: "number" }],
				dimensions: [{ column: "item_id" }],
				measures: [{ column: "total", function: "SUM", label: "total_cost" }],
			};

			const result = engine.run(query);
			expect(result.groupCount).toBe(3);
			expect(result.sourceRowCount).toBe(6);
			expect(result.columnTypeHints).toEqual([{ column: "total", type: "number" }]);

			const i001 = result.rows.find((r) => r.item_id === "I001");
			expect(i001?.total_cost).toBeCloseTo(241.5);

			const i002 = result.rows.find((r) => r.item_id === "I002");
			expect(i002?.total_cost).toBeCloseTo(250);

			const i003 = result.rows.find((r) => r.item_id === "I003");
			expect(i003?.total_cost).toBeCloseTo(155);
		});

		it("GROUP BY 2 dimensions with COUNT", () => {
			const query: AnalyticsQuery = {
				sources: [sales],
				joins: [],
				columnTypeHints: [],
				dimensions: [{ column: "item_id" }, { column: "supplier_id" }],
				measures: [{ column: "sale_id", function: "COUNT", label: "sale_count" }],
			};

			const result = engine.run(query);
			expect(result.groupCount).toBe(4);

			const i001s01 = result.rows.find(
				(r) => r.item_id === "I001" && r.supplier_id === "S01",
			);
			expect(i001s01?.sale_count).toBe(2);

			const i001s02 = result.rows.find(
				(r) => r.item_id === "I001" && r.supplier_id === "S02",
			);
			expect(i001s02?.sale_count).toBe(1);
		});

		it("GROUP BY with AVG", () => {
			const query: AnalyticsQuery = {
				sources: [sales],
				joins: [],
				columnTypeHints: [{ column: "quantity", type: "number" }],
				dimensions: [{ column: "item_id" }],
				measures: [{ column: "quantity", function: "AVG", label: "avg_qty" }],
			};

			const result = engine.run(query);
			const i001 = result.rows.find((r) => r.item_id === "I001");
			// (10 + 5 + 8) / 3 = 7.666...
			expect(i001?.avg_qty).toBeCloseTo(7.667, 2);
		});

		it("GROUP BY with MIN and MAX", () => {
			const query: AnalyticsQuery = {
				sources: [sales],
				joins: [],
				columnTypeHints: [{ column: "total", type: "number" }],
				dimensions: [{ column: "item_id" }],
				measures: [
					{ column: "total", function: "MIN", label: "min_total" },
					{ column: "total", function: "MAX", label: "max_total" },
				],
			};

			const result = engine.run(query);
			const i001 = result.rows.find((r) => r.item_id === "I001");
			expect(i001?.min_total).toBe(52.5);
			expect(i001?.max_total).toBe(105);
		});

		it("COUNT_DISTINCT counts unique values per group", () => {
			const query: AnalyticsQuery = {
				sources: [sales],
				joins: [],
				columnTypeHints: [],
				dimensions: [{ column: "item_id" }],
				measures: [{ column: "supplier_id", function: "COUNT_DISTINCT", label: "unique_suppliers" }],
			};

			const result = engine.run(query);
			// I001 has S01, S02 = 2 unique suppliers
			const i001 = result.rows.find((r) => r.item_id === "I001");
			expect(i001?.unique_suppliers).toBe(2);
			// I002 has only S01 = 1 unique supplier
			const i002 = result.rows.find((r) => r.item_id === "I002");
			expect(i002?.unique_suppliers).toBe(1);
		});

		it("COUNT_DISTINCT on overall (single group)", () => {
			const query: AnalyticsQuery = {
				sources: [sales],
				joins: [],
				columnTypeHints: [],
				dimensions: [],
				measures: [{ column: "supplier_id", function: "COUNT_DISTINCT", label: "unique_suppliers" }],
			};

			const result = engine.run(query);
			expect(result.rows).toHaveLength(1);
			expect(result.rows[0].unique_suppliers).toBe(2); // S01, S02
		});

		it("COUNT_DISTINCT with empty/null values", () => {
			const data = makeSource(
				"sparse",
				["category", "tag"],
				[
					["A", "x"],
					["A", ""],
					["A", "x"],
					["A", "y"],
				],
			);
			const query: AnalyticsQuery = {
				sources: [data],
				joins: [],
				columnTypeHints: [],
				dimensions: [{ column: "category" }],
				measures: [{ column: "tag", function: "COUNT_DISTINCT", label: "unique_tags" }],
			};

			const result = engine.run(query);
			// "x", "", "y" = 3 distinct values (empty string counts as a value)
			expect(result.rows[0].unique_tags).toBe(3);
		});

		it("non-numeric values in SUM are skipped (treated as 0)", () => {
			const badData = makeSource(
				"bad",
				["category", "amount"],
				[
					["A", "100"],
					["A", "N/A"],
					["A", "50"],
				],
				"en-US",
			);

			const query: AnalyticsQuery = {
				sources: [badData],
				joins: [],
				columnTypeHints: [{ column: "amount", type: "number" }],
				dimensions: [{ column: "category" }],
				measures: [{ column: "amount", function: "SUM", label: "total" }],
			};

			const result = engine.run(query);
			expect(result.rows[0].total).toBe(150);
		});
	});

	describe("Joins — inner and left", () => {
		it("inner join 2 CSVs on shared key", () => {
			const query: AnalyticsQuery = {
				sources: [sales, items],
				joins: [
					{
						leftSource: "sales",
						leftColumn: "item_id",
						rightSource: "items",
						rightColumn: "item_id",
						type: "inner",
					},
				],
				columnTypeHints: [{ column: "total", type: "number" }],
				dimensions: [{ column: "item_name" }],
				measures: [{ column: "total", function: "SUM", label: "revenue" }],
			};

			const result = engine.run(query);
			expect(result.groupCount).toBe(3);

			const widgetA = result.rows.find((r) => r.item_name === "Widget A");
			expect(widgetA?.revenue).toBeCloseTo(241.5);
		});

		it("left join preserves rows without match (fills Unknown)", () => {
			const orphanSales = makeSource(
				"sales",
				["sale_id", "item_id", "total"],
				[
					["1", "I001", "100"],
					["2", "I999", "50"],
				],
				"en-US",
			);

			const query: AnalyticsQuery = {
				sources: [orphanSales, items],
				joins: [
					{
						leftSource: "sales",
						leftColumn: "item_id",
						rightSource: "items",
						rightColumn: "item_id",
						type: "left",
					},
				],
				columnTypeHints: [{ column: "total", type: "number" }],
				dimensions: [{ column: "item_name" }],
				measures: [{ column: "total", function: "SUM", label: "revenue" }],
			};

			const result = engine.run(query);
			expect(result.rows).toHaveLength(2);

			const unknown = result.rows.find((r) => r.item_name === "Unknown");
			expect(unknown).toBeDefined();
			expect(unknown?.revenue).toBe(50);
		});

		it("chain 3-way join (sales → items, result → suppliers)", () => {
			const query: AnalyticsQuery = {
				sources: [sales, items, suppliers],
				joins: [
					{
						leftSource: "sales",
						leftColumn: "item_id",
						rightSource: "items",
						rightColumn: "item_id",
						type: "inner",
					},
					{
						leftSource: "sales",
						leftColumn: "supplier_id",
						rightSource: "suppliers",
						rightColumn: "supplier_id",
						type: "inner",
					},
				],
				columnTypeHints: [{ column: "total", type: "number" }],
				dimensions: [{ column: "item_name" }, { column: "supplier_name" }],
				measures: [{ column: "total", function: "SUM", label: "revenue" }],
			};

			const result = engine.run(query);

			// I001 sold by Acme (2 sales: 105 + 84 = 189) and EuroSupply (1 sale: 52.50)
			const widgetAcme = result.rows.find(
				(r) => r.item_name === "Widget A" && r.supplier_name === "Acme Corp",
			);
			expect(widgetAcme?.revenue).toBeCloseTo(189);

			const widgetEuro = result.rows.find(
				(r) => r.item_name === "Widget A" && r.supplier_name === "EuroSupply",
			);
			expect(widgetEuro?.revenue).toBeCloseTo(52.5);
		});

		it("inner join excludes rows with missing join key", () => {
			const sparseData = makeSource(
				"sparse",
				["id", "value"],
				[
					["A", "10"],
					["", "20"],
					["B", "30"],
				],
			);
			const lookup = makeSource(
				"lookup",
				["id", "label"],
				[
					["A", "Alpha"],
					["B", "Beta"],
				],
			);

			const query: AnalyticsQuery = {
				sources: [sparseData, lookup],
				joins: [
					{
						leftSource: "sparse",
						leftColumn: "id",
						rightSource: "lookup",
						rightColumn: "id",
						type: "inner",
					},
				],
				columnTypeHints: [{ column: "value", type: "number" }],
				dimensions: [{ column: "label" }],
				measures: [{ column: "value", function: "SUM", label: "total" }],
			};

			const result = engine.run(query);
			expect(result.groupCount).toBe(2);
			// Row with empty id has no match → excluded by inner join
		});
	});

	describe("Locale-aware number parsing in aggregation", () => {
		it("aggregates EU-formatted numbers (de-DE)", () => {
			const euData = makeSource(
				"eu",
				["category", "amount"],
				[
					["A", "1.234,56"],
					["A", "2.345,67"],
				],
				"de-DE",
			);

			const query: AnalyticsQuery = {
				sources: [euData],
				joins: [],
				columnTypeHints: [{ column: "amount", type: "number" }],
				dimensions: [{ column: "category" }],
				measures: [{ column: "amount", function: "SUM", label: "total" }],
			};

			const result = engine.run(query);
			expect(result.rows[0].total).toBeCloseTo(3580.23);
		});

		it("aggregates FR-formatted numbers (fr-FR)", () => {
			const frData = makeSource(
				"fr",
				["category", "amount"],
				[
					["A", "1 234,56"],
					["A", "2 345,67"],
				],
				"fr-FR",
			);

			const query: AnalyticsQuery = {
				sources: [frData],
				joins: [],
				columnTypeHints: [{ column: "amount", type: "number" }],
				dimensions: [{ column: "category" }],
				measures: [{ column: "amount", function: "SUM", label: "total" }],
			};

			const result = engine.run(query);
			expect(result.rows[0].total).toBeCloseTo(3580.23);
		});
	});

	describe("Time bucketing", () => {
		it("buckets US dates by month", () => {
			const query: AnalyticsQuery = {
				sources: [sales],
				joins: [],
				columnTypeHints: [
					{ column: "total", type: "number" },
					{ column: "sale_date", type: "date" },
				],
				dimensions: [{ column: "item_id" }],
				measures: [{ column: "total", function: "SUM", label: "revenue" }],
				timeBucket: { column: "sale_date", period: "month" },
			};

			const result = engine.run(query);
			// Time bucket adds a column and creates more groups
			expect(result.columns).toContain("sale_date_month");

			// I001 in February (sale_id 1: $105) and March (sale_id 2: $52.50) and April (sale_id 6: $84)
			const i001Feb = result.rows.find(
				(r) => r.item_id === "I001" && r.sale_date_month === "2026-02",
			);
			expect(i001Feb?.revenue).toBeCloseTo(105);
		});

		it("buckets by quarter", () => {
			const query: AnalyticsQuery = {
				sources: [sales],
				joins: [],
				columnTypeHints: [
					{ column: "total", type: "number" },
					{ column: "sale_date", type: "date" },
				],
				dimensions: [{ column: "item_id" }],
				measures: [{ column: "total", function: "SUM", label: "revenue" }],
				timeBucket: { column: "sale_date", period: "quarter" },
			};

			const result = engine.run(query);
			expect(result.columns).toContain("sale_date_quarter");

			// Q1 = Jan+Feb+Mar, Q2 = Apr
			const i001Q1 = result.rows.find(
				(r) => r.item_id === "I001" && r.sale_date_quarter === "2026-Q1",
			);
			// Feb $105 + Mar $52.50 = $157.50
			expect(i001Q1?.revenue).toBeCloseTo(157.5);
		});

		it("buckets by year", () => {
			const query: AnalyticsQuery = {
				sources: [sales],
				joins: [],
				columnTypeHints: [
					{ column: "total", type: "number" },
					{ column: "sale_date", type: "date" },
				],
				dimensions: [{ column: "item_id" }],
				measures: [{ column: "total", function: "SUM", label: "revenue" }],
				timeBucket: { column: "sale_date", period: "year" },
			};

			const result = engine.run(query);
			expect(result.columns).toContain("sale_date_year");

			// All sales are 2026, so each item has one group
			const i001 = result.rows.find(
				(r) => r.item_id === "I001" && r.sale_date_year === "2026",
			);
			expect(i001?.revenue).toBeCloseTo(241.5);
		});

		it("custom output column name", () => {
			const query: AnalyticsQuery = {
				sources: [sales],
				joins: [],
				columnTypeHints: [
					{ column: "total", type: "number" },
					{ column: "sale_date", type: "date" },
				],
				dimensions: [{ column: "item_id" }],
				measures: [{ column: "total", function: "SUM", label: "revenue" }],
				timeBucket: { column: "sale_date", period: "month", outputColumn: "month" },
			};

			const result = engine.run(query);
			expect(result.columns).toContain("month");
			expect(result.rows[0]).toHaveProperty("month");
		});
	});

	describe("Full business question: cost per item per supplier by month", () => {
		it("3-way join + GROUP BY item + supplier + month with SUM", () => {
			const query: AnalyticsQuery = {
				sources: [sales, items, suppliers],
				joins: [
					{
						leftSource: "sales",
						leftColumn: "item_id",
						rightSource: "items",
						rightColumn: "item_id",
						type: "inner",
					},
					{
						leftSource: "sales",
						leftColumn: "supplier_id",
						rightSource: "suppliers",
						rightColumn: "supplier_id",
						type: "inner",
					},
				],
				columnTypeHints: [
					{ column: "total", type: "number" },
					{ column: "sale_date", type: "date" },
				],
				dimensions: [
					{ column: "item_name" },
					{ column: "supplier_name" },
				],
				measures: [
					{ column: "total", function: "SUM", label: "total_cost" },
					{ column: "sale_id", function: "COUNT", label: "sale_count" },
				],
				timeBucket: { column: "sale_date", period: "month", outputColumn: "month" },
			};

			const result = engine.run(query);

			// Verify structure
			expect(result.columns).toEqual([
				"month",
				"item_name",
				"supplier_name",
				"total_cost",
				"sale_count",
			]);

			// Widget A, Acme Corp, Feb 2026: 1 sale, $105
			const waAcmeFeb = result.rows.find(
				(r) =>
					r.item_name === "Widget A" &&
					r.supplier_name === "Acme Corp" &&
					r.month === "2026-02",
			);
			expect(waAcmeFeb?.total_cost).toBeCloseTo(105);
			expect(waAcmeFeb?.sale_count).toBe(1);

			// Widget A, Acme Corp, Apr 2026: 1 sale, $84
			const waAcmeApr = result.rows.find(
				(r) =>
					r.item_name === "Widget A" &&
					r.supplier_name === "Acme Corp" &&
					r.month === "2026-04",
			);
			expect(waAcmeApr?.total_cost).toBeCloseTo(84);
			expect(waAcmeApr?.sale_count).toBe(1);

			// Widget C, EuroSupply, Jan 2026: 1 sale, $155
			const wcEuroJan = result.rows.find(
				(r) =>
					r.item_name === "Widget C" &&
					r.supplier_name === "EuroSupply" &&
					r.month === "2026-01",
			);
			expect(wcEuroJan?.total_cost).toBeCloseTo(155);
		});
	});

	describe("Edge cases", () => {
		it("empty source returns empty result", () => {
			const empty = makeSource("empty", ["col"], []);
			const query: AnalyticsQuery = {
				sources: [empty],
				joins: [],
				columnTypeHints: [],
				dimensions: [{ column: "col" }],
				measures: [{ column: "col", function: "COUNT", label: "count" }],
			};

			const result = engine.run(query);
			expect(result.rows).toHaveLength(0);
			expect(result.groupCount).toBe(0);
			expect(result.sourceRowCount).toBe(0);
		});

		it("default measure label uses FUNCTION(column) format", () => {
			const query: AnalyticsQuery = {
				sources: [sales],
				joins: [],
				columnTypeHints: [{ column: "total", type: "number" }],
				dimensions: [{ column: "item_id" }],
				measures: [{ column: "total", function: "SUM" }],
			};

			const result = engine.run(query);
			expect(result.columns).toContain("SUM(total)");
		});

		it("GROUP BY 3 dimensions", () => {
			const query: AnalyticsQuery = {
				sources: [sales],
				joins: [],
				columnTypeHints: [{ column: "total", type: "number" }],
				dimensions: [
					{ column: "item_id" },
					{ column: "supplier_id" },
					{ column: "sale_date" },
				],
				measures: [{ column: "total", function: "SUM", label: "amount" }],
			};

			const result = engine.run(query);
			// Each sale row is unique across all 3 dims, so 6 groups
			expect(result.groupCount).toBe(6);
		});
	});

	describe("Column type detection", () => {
		it("detects numeric columns", () => {
			const hints = AnalyticsEngine.detectColumnTypes(
				["id", "amount", "name"],
				[
					["1", "100.50", "Alice"],
					["2", "200.75", "Bob"],
					["3", "300.00", "Charlie"],
				],
			);

			expect(hints.find((h) => h.column === "amount")?.type).toBe("number");
			expect(hints.find((h) => h.column === "name")?.type).toBe("string");
		});

		it("detects date columns", () => {
			const hints = AnalyticsEngine.detectColumnTypes(
				["date", "value"],
				[
					["02/15/2026", "100"],
					["03/20/2026", "200"],
					["04/10/2026", "300"],
				],
			);

			expect(hints.find((h) => h.column === "date")?.type).toBe("date");
		});

		it("returns string for empty rows", () => {
			const hints = AnalyticsEngine.detectColumnTypes(["col"], []);
			expect(hints[0].type).toBe("string");
		});

		it("detects currency values as numeric", () => {
			const hints = AnalyticsEngine.detectColumnTypes(
				["product", "revenue"],
				[
					["Widget A", "$22,543.65"],
					["Widget B", "$1,200.00"],
					["Widget C", "$850.50"],
				],
			);
			expect(hints.find((h) => h.column === "revenue")?.type).toBe("number");
		});

		it("detects euro currency values as numeric", () => {
			const hints = AnalyticsEngine.detectColumnTypes(
				["item", "price"],
				[
					["A", "€1.234,56"],
					["B", "€789,00"],
					["C", "€45,99"],
				],
			);
			expect(hints.find((h) => h.column === "price")?.type).toBe("number");
		});

		it("detects slash dates like 2/3/2025", () => {
			const hints = AnalyticsEngine.detectColumnTypes(
				["date", "amount"],
				[
					["2/3/2025", "100"],
					["12/15/2025", "200"],
					["1/1/2026", "300"],
				],
			);
			expect(hints.find((h) => h.column === "date")?.type).toBe("date");
		});

		it("detects dash-separated dates", () => {
			const hints = AnalyticsEngine.detectColumnTypes(
				["date", "value"],
				[
					["02-15-2026", "100"],
					["03-20-2026", "200"],
					["04-10-2026", "300"],
				],
			);
			expect(hints.find((h) => h.column === "date")?.type).toBe("date");
		});

		it("detects year-month dates (YYYY-MM)", () => {
			const hints = AnalyticsEngine.detectColumnTypes(
				["month", "value"],
				[
					["2025-09", "100"],
					["2025-10", "200"],
					["2025-11", "300"],
				],
			);
			expect(hints.find((h) => h.column === "month")?.type).toBe("date");
		});

		it("detects currency symbol $ on numeric columns", () => {
			const hints = AnalyticsEngine.detectColumnTypes(
				["revenue", "name"],
				[
					["$22,543.65", "Alice"],
					["$1,200.00", "Bob"],
					["$500.50", "Charlie"],
				],
			);
			const revenue = hints.find((h) => h.column === "revenue");
			expect(revenue?.type).toBe("number");
			expect(revenue?.currencySymbol).toBe("$");
			expect(hints.find((h) => h.column === "name")?.currencySymbol).toBeUndefined();
		});

		it("detects currency symbol € on numeric columns", () => {
			const hints = AnalyticsEngine.detectColumnTypes(
				["price"],
				[["€1.234,56"], ["€2.345,67"], ["€100,00"]],
			);
			const price = hints.find((h) => h.column === "price");
			expect(price?.type).toBe("number");
			expect(price?.currencySymbol).toBe("€");
		});

		it("does not set currencySymbol on plain numbers", () => {
			const hints = AnalyticsEngine.detectColumnTypes(
				["amount"],
				[["1234"], ["5678"], ["91011"]],
			);
			expect(hints[0].type).toBe("number");
			expect(hints[0].currencySymbol).toBeUndefined();
		});

		it("propagates currencySymbol to measure output columns in result", () => {
			const engine = new AnalyticsEngine();
			const src = makeSource("data", ["category", "price"], [
				["A", "$100"],
				["A", "$200"],
				["B", "$150"],
			], "en-US");
			const result = engine.run({
				sources: [src],
				joins: [],
				dimensions: [{ column: "category" }],
				measures: [{ column: "price", function: "SUM" }],
				columnTypeHints: [
					{ column: "category", type: "string" },
					{ column: "price", type: "number", currencySymbol: "$" },
				],
			});
			// The result should have an augmented hint for "SUM(price)" with the inherited currencySymbol
			const measureHint = result.columnTypeHints?.find((h) => h.column === "SUM(price)");
			expect(measureHint).toBeDefined();
			expect(measureHint?.currencySymbol).toBe("$");
		});

		it("does not propagate currencySymbol when cleared (type changed to number)", () => {
			const engine = new AnalyticsEngine();
			const src = makeSource("data", ["category", "price"], [
				["A", "100"],
				["A", "200"],
			], "en-US");
			const result = engine.run({
				sources: [src],
				joins: [],
				dimensions: [{ column: "category" }],
				measures: [{ column: "price", function: "SUM" }],
				columnTypeHints: [
					{ column: "category", type: "string" },
					{ column: "price", type: "number", currencySymbol: undefined },
				],
			});
			const measureHint = result.columnTypeHints?.find((h) => h.column === "SUM(price)");
			expect(measureHint).toBeUndefined();
		});

		it("detects dates even with some empty cells (50% threshold)", () => {
			const hints = AnalyticsEngine.detectColumnTypes(
				["date", "value"],
				[
					["02/15/2026", "100"],
					["", ""],
					["03/20/2026", "200"],
					["", ""],
					["04/10/2026", "300"],
					["", ""],
				],
			);
			// 3 date samples out of 3 non-empty → 100% → detected as date
			expect(hints.find((h) => h.column === "date")?.type).toBe("date");
		});
	});

	describe("Performance", () => {
		it("handles 10,000 rows join + aggregate in < 2 seconds", () => {
			// Generate 10,000 sales rows
			const bigSalesRows: string[][] = [];
			for (let i = 0; i < 10000; i++) {
				const itemId = `I${String((i % 100) + 1).padStart(3, "0")}`;
				const supplierId = `S${String((i % 10) + 1).padStart(2, "0")}`;
				bigSalesRows.push([
					String(i),
					itemId,
					supplierId,
					String(Math.floor(Math.random() * 100)),
					`${String((i % 12) + 1).padStart(2, "0")}/15/2026`,
					String(Math.floor(Math.random() * 1000)),
				]);
			}
			const bigSales = makeSource(
				"sales",
				["sale_id", "item_id", "supplier_id", "quantity", "sale_date", "total"],
				bigSalesRows,
				"en-US",
			);

			// 100 items
			const bigItems = makeSource(
				"items",
				["item_id", "item_name"],
				Array.from({ length: 100 }, (_, i) => [
					`I${String(i + 1).padStart(3, "0")}`,
					`Item ${i + 1}`,
				]),
			);

			const query: AnalyticsQuery = {
				sources: [bigSales, bigItems],
				joins: [
					{
						leftSource: "sales",
						leftColumn: "item_id",
						rightSource: "items",
						rightColumn: "item_id",
						type: "inner",
					},
				],
				columnTypeHints: [{ column: "total", type: "number" }],
				dimensions: [{ column: "item_name" }],
				measures: [{ column: "total", function: "SUM", label: "revenue" }],
			};

			const start = Date.now();
			const result = engine.run(query);
			const elapsed = Date.now() - start;

			expect(result.rows.length).toBe(100);
			expect(result.sourceRowCount).toBe(10000);
			expect(elapsed).toBeLessThan(2000);
		});
	});

	// ── Multi-column sort ──────────────────────────────────

	describe("Multi-column sort", () => {
		const multiSortSource = makeSource(
			"data",
			["dept", "name", "score"],
			[
				["B", "Alice", "90"],
				["A", "Bob", "80"],
				["A", "Charlie", "90"],
				["B", "Dave", "80"],
				["A", "Eve", "90"],
			],
		);

		it("should sort by single column ascending", () => {
			const result = engine.run({
				sources: [multiSortSource],
				joins: [],
				columnTypeHints: [{ column: "score", type: "number" }],
				dimensions: [{ column: "dept" }, { column: "name" }],
				measures: [{ column: "score", function: "SUM" }],
				sort: [{ column: "name", direction: "asc" }],
			});

			const names = result.rows.map((r) => r.name);
			expect(names).toEqual(["Alice", "Bob", "Charlie", "Dave", "Eve"]);
		});

		it("should sort by two columns (primary + secondary)", () => {
			const result = engine.run({
				sources: [multiSortSource],
				joins: [],
				columnTypeHints: [{ column: "score", type: "number" }],
				dimensions: [{ column: "dept" }, { column: "name" }],
				measures: [{ column: "score", function: "SUM" }],
				sort: [
					{ column: "dept", direction: "asc" },
					{ column: "SUM(score)", direction: "desc" },
				],
			});

			// Dept A first (asc), then within A: highest score first (desc)
			expect(result.rows[0].dept).toBe("A");
			expect(result.rows[0].name).toBe("Charlie"); // 90
			expect(result.rows[1].name).toBe("Eve"); // 90 (same score, stable or locale)
			expect(result.rows[2].name).toBe("Bob"); // 80
			// Dept B
			expect(result.rows[3].dept).toBe("B");
		});

		it("should sort by two columns with mixed directions", () => {
			const result = engine.run({
				sources: [multiSortSource],
				joins: [],
				columnTypeHints: [{ column: "score", type: "number" }],
				dimensions: [{ column: "dept" }, { column: "name" }],
				measures: [{ column: "score", function: "SUM" }],
				sort: [
					{ column: "dept", direction: "desc" },
					{ column: "name", direction: "asc" },
				],
			});

			// Dept B first (desc), then alphabetical within dept
			expect(result.rows[0].dept).toBe("B");
			expect(result.rows[0].name).toBe("Alice");
			expect(result.rows[1].name).toBe("Dave");
			expect(result.rows[2].dept).toBe("A");
			expect(result.rows[2].name).toBe("Bob");
		});

		it("should handle empty sort array (no sorting)", () => {
			const result = engine.run({
				sources: [multiSortSource],
				joins: [],
				columnTypeHints: [{ column: "score", type: "number" }],
				dimensions: [{ column: "dept" }],
				measures: [{ column: "score", function: "SUM" }],
				sort: [],
			});

			// Should still return results (just unsorted)
			expect(result.rows).toHaveLength(2);
		});

		it("should sort numerically for number columns", () => {
			const numSource = makeSource(
				"data",
				["name", "value"],
				[
					["A", "100"],
					["B", "20"],
					["C", "3"],
				],
			);

			const result = engine.run({
				sources: [numSource],
				joins: [],
				columnTypeHints: [{ column: "value", type: "number" }],
				dimensions: [{ column: "name" }],
				measures: [{ column: "value", function: "SUM" }],
				sort: [{ column: "SUM(value)", direction: "asc" }],
			});

			const values = result.rows.map((r) => r["SUM(value)"]);
			expect(values).toEqual([3, 20, 100]);
		});

		it("should apply limit after multi-column sort", () => {
			const result = engine.run({
				sources: [multiSortSource],
				joins: [],
				columnTypeHints: [{ column: "score", type: "number" }],
				dimensions: [{ column: "dept" }, { column: "name" }],
				measures: [{ column: "score", function: "SUM" }],
				sort: [
					{ column: "SUM(score)", direction: "desc" },
					{ column: "name", direction: "asc" },
				],
				limit: 3,
			});

			expect(result.rows).toHaveLength(3);
			// Top 3 by score desc: Alice(90), Charlie(90), Eve(90) — alphabetical tiebreaker
			expect(result.rows[0].name).toBe("Alice");
			expect(result.rows[1].name).toBe("Charlie");
			expect(result.rows[2].name).toBe("Eve");
		});
	});

	// ── Column aliases ──────────────────────────────────

	describe("column aliases", () => {
		it("renames columns in result when alias is set", () => {
			const result = engine.run({
				sources: [items],
				joins: [],
				columnTypeHints: [
					{ column: "item_name", type: "string", alias: "Product" },
					{ column: "unit_cost", type: "number", alias: "Price" },
				],
				dimensions: [{ column: "item_name" }],
				measures: [{ column: "unit_cost", function: "SUM", label: "total_cost" }],
			});

			expect(result.columns).toContain("Product");
			expect(result.columns).not.toContain("item_name");
		});

		it("renames row keys when alias is set", () => {
			const result = engine.run({
				sources: [items],
				joins: [],
				columnTypeHints: [
					{ column: "item_name", type: "string", alias: "Product" },
					{ column: "unit_cost", type: "number" },
				],
				dimensions: [{ column: "item_name" }],
				measures: [{ column: "unit_cost", function: "SUM", label: "total_cost" }],
			});

			expect(result.rows[0]).toHaveProperty("Product");
			expect(result.rows[0]).not.toHaveProperty("item_name");
		});

		it("computed columns still use original names", () => {
			const result = engine.run({
				sources: [items],
				joins: [],
				columnTypeHints: [
					{ column: "unit_cost", type: "number", alias: "Price" },
				],
				dimensions: [{ column: "item_name" }],
				measures: [{ column: "unit_cost", function: "SUM", label: "total_cost" }],
				computedColumns: [{ name: "doubled", expression: "{total_cost} * 2" }],
			});

			expect(result.columns).toContain("doubled");
			// Computed column should calculate correctly (original names used in expression)
			const widgetA = result.rows.find((r) => Object.values(r).includes("Widget A"));
			expect(widgetA?.doubled).toBe(21); // 10.50 * 2
		});

		it("leaves columns without alias unchanged", () => {
			const result = engine.run({
				sources: [items],
				joins: [],
				columnTypeHints: [
					{ column: "unit_cost", type: "number" }, // no alias
				],
				dimensions: [{ column: "item_name" }],
				measures: [{ column: "unit_cost", function: "SUM", label: "total_cost" }],
			});

			expect(result.columns).toContain("item_name");
			expect(result.columns).toContain("total_cost");
		});
	});

	describe("private columns (anonymization)", () => {
		it("should anonymize string columns with consistent pseudonyms", () => {
			const engine = new AnalyticsEngine();
			const result = engine.run({
				sources: [items],
				joins: [],
				columnTypeHints: [
					{ column: "item_name", type: "string", isPrivate: true },
					{ column: "unit_cost", type: "number" },
				],
				dimensions: [{ column: "item_name" }],
				measures: [{ column: "unit_cost", function: "SUM", label: "Cost" }],
			});

			const names = result.rows.map((r) => r["item_name"]);
			expect(names).toContain("Entity-1");
			expect(names).toContain("Entity-2");
			expect(names).toContain("Entity-3");
			expect(names).not.toContain("Widget A");
			expect(names).not.toContain("Widget B");
		});

		it("should anonymize number columns to 0 when used as dimensions", () => {
			const engine = new AnalyticsEngine();
			const source = makeSource("data", ["name", "score"], [
				["Alice", "95"], ["Bob", "82"], ["Carol", "95"],
			]);
			const result = engine.run({
				sources: [source],
				joins: [],
				columnTypeHints: [
					{ column: "score", type: "number", isPrivate: true },
				],
				dimensions: [{ column: "name" }, { column: "score" }],
				measures: [{ column: "score", function: "COUNT", label: "Count" }],
			});

			for (const row of result.rows) {
				expect(row["score"]).toBe(0);
			}
		});

		it("should not affect non-private columns", () => {
			const engine = new AnalyticsEngine();
			const result = engine.run({
				sources: [items],
				joins: [],
				columnTypeHints: [
					{ column: "item_name", type: "string", isPrivate: true },
					{ column: "unit_cost", type: "number" },
				],
				dimensions: [{ column: "item_name" }],
				measures: [{ column: "unit_cost", function: "SUM", label: "Cost" }],
			});

			const costs = result.rows.map((r) => r["Cost"]);
			expect(costs).toContain(10.5);
			expect(costs).toContain(25);
			expect(costs).toContain(7.75);
		});

		it("should produce consistent mapping (same value → same pseudonym)", () => {
			const engine = new AnalyticsEngine();
			const source = makeSource("data", ["name", "val"], [
				["Alice", "10"], ["Bob", "20"], ["Alice", "30"],
			]);
			const result = engine.run({
				sources: [source],
				joins: [],
				columnTypeHints: [{ column: "name", type: "string", isPrivate: true }, { column: "val", type: "number" }],
				dimensions: [{ column: "name" }],
				measures: [{ column: "val", function: "SUM", label: "Total" }],
			});

			// Alice appears in two rows → grouped into one → Entity-1
			// Bob → Entity-2
			expect(result.rows.length).toBe(2);
			const names = result.rows.map((r) => r["name"]);
			expect(new Set(names).size).toBe(2);
		});

		it("should work with aliased private columns", () => {
			const engine = new AnalyticsEngine();
			const result = engine.run({
				sources: [items],
				joins: [],
				columnTypeHints: [
					{ column: "item_name", type: "string", alias: "Product", isPrivate: true },
					{ column: "unit_cost", type: "number" },
				],
				dimensions: [{ column: "item_name" }],
				measures: [{ column: "unit_cost", function: "SUM", label: "Cost" }],
			});

			expect(result.columns).toContain("Product");
			const products = result.rows.map((r) => r["Product"]);
			expect(products).toContain("Entity-1");
			expect(products).not.toContain("Widget A");
		});
	});

	describe("date range filtering", () => {
		const dateSource = makeSource(
			"orders",
			["date", "region", "amount"],
			[
				["2026-01-05", "EMEA", "100"],
				["2026-01-15", "APAC", "200"],
				["2026-02-10", "EMEA", "300"],
				["2026-02-20", "APAC", "400"],
				["2026-03-01", "EMEA", "500"],
			],
		);

		it("filters rows within date range (inclusive)", () => {
			const result = engine.run({
				sources: [dateSource],
				joins: [],
				columnTypeHints: [{ column: "date", type: "date" }],
				dimensions: [{ column: "region" }],
				measures: [{ column: "amount", function: "SUM" }],
				dateRangeFilter: {
					column: "date",
					start: { year: 2026, month: 1, day: 1 },
					end: { year: 2026, month: 1, day: 31 },
				},
			});

			expect(result.rows).toHaveLength(2);
			expect(result.sourceRowCount).toBe(5); // All rows before filtering
		});

		it("excludes rows outside date range", () => {
			const result = engine.run({
				sources: [dateSource],
				joins: [],
				columnTypeHints: [{ column: "date", type: "date" }],
				dimensions: [{ column: "region" }],
				measures: [{ column: "amount", function: "SUM" }],
				dateRangeFilter: {
					column: "date",
					start: { year: 2026, month: 2, day: 1 },
					end: { year: 2026, month: 2, day: 28 },
				},
			});

			expect(result.rows).toHaveLength(2);
			const total = result.rows.reduce((s, r) => s + (r["SUM(amount)"] as number), 0);
			expect(total).toBe(700); // 300 + 400
		});

		it("returns empty when no rows match date range", () => {
			const result = engine.run({
				sources: [dateSource],
				joins: [],
				columnTypeHints: [{ column: "date", type: "date" }],
				dimensions: [{ column: "region" }],
				measures: [{ column: "amount", function: "SUM" }],
				dateRangeFilter: {
					column: "date",
					start: { year: 2025, month: 1, day: 1 },
					end: { year: 2025, month: 12, day: 31 },
				},
			});

			expect(result.rows).toHaveLength(0);
		});

		it("applies date range filter before other filters", () => {
			const result = engine.run({
				sources: [dateSource],
				joins: [],
				columnTypeHints: [{ column: "date", type: "date" }],
				dimensions: [{ column: "region" }],
				measures: [{ column: "amount", function: "SUM" }],
				filters: [{ column: "region", operator: "=", value: "EMEA" }],
				dateRangeFilter: {
					column: "date",
					start: { year: 2026, month: 1, day: 1 },
					end: { year: 2026, month: 2, day: 28 },
				},
			});

			// Only EMEA rows in Jan-Feb: Jan 5 (100) + Feb 10 (300) = 400
			expect(result.rows).toHaveLength(1);
			expect(result.rows[0]["SUM(amount)"]).toBe(400);
		});

		it("works without date range filter (no-op)", () => {
			const result = engine.run({
				sources: [dateSource],
				joins: [],
				columnTypeHints: [{ column: "date", type: "date" }],
				dimensions: [{ column: "region" }],
				measures: [{ column: "amount", function: "SUM" }],
			});

			expect(result.rows).toHaveLength(2); // EMEA and APAC
		});

		it("skips filtering when date column not in source headers", () => {
			// Source has "amount" and "region" but NOT "snapshot_date"
			const noDateSource = makeSource(
				"revenue",
				["region", "amount"],
				[
					["EMEA", "100"],
					["APAC", "200"],
					["AMER", "300"],
				],
			);

			const result = engine.run({
				sources: [noDateSource],
				joins: [],
				columnTypeHints: [],
				dimensions: [{ column: "region" }],
				measures: [{ column: "amount", function: "SUM" }],
				dateRangeFilter: {
					column: "snapshot_date",
					start: { year: 2026, month: 1, day: 1 },
					end: { year: 2026, month: 1, day: 31 },
				},
			});

			// All rows returned — filter skipped because column not in data
			expect(result.rows).toHaveLength(3);
		});

		it("excludes rows with unparseable dates", () => {
			const sourceWithBadDate = makeSource(
				"mixed",
				["date", "amount"],
				[
					["2026-01-15", "100"],
					["not-a-date", "200"],
					["2026-01-20", "300"],
				],
			);

			const result = engine.run({
				sources: [sourceWithBadDate],
				joins: [],
				columnTypeHints: [{ column: "date", type: "date" }],
				dimensions: [],
				measures: [{ column: "amount", function: "SUM" }],
				dateRangeFilter: {
					column: "date",
					start: { year: 2026, month: 1, day: 1 },
					end: { year: 2026, month: 1, day: 31 },
				},
			});

			// Only 2 valid dates in range, bad date excluded
			expect(result.rows[0]["SUM(amount)"]).toBe(400);
		});
	});
});
