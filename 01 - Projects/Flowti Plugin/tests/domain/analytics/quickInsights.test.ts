/**
 * Tests for the Quick Insights suggestion engine.
 *
 * Validates all 6 insight rules and edge cases:
 *   1. "Total [numeric] by [text]" — SUM
 *   2. "Count by [text]" — COUNT
 *   3. "[numeric] over time" — SUM + time bucket
 *   4. "Average [numeric] by [text]" — AVG
 *   5. "Top 5 [text] by [numeric]" — SUM + sort desc + limit 5
 *   6. "Distribution of [text1] × [text2]" — COUNT grouped by 2 text cols
 */

import { describe, it, expect } from "vitest";
import { generateQuickInsights } from "../../../src/domain/analytics/quickInsights";
import type { ColumnTypeHint } from "../../../src/domain/analytics/types";

const textCol = (column: string): ColumnTypeHint => ({ column, type: "string" });
const numCol = (column: string): ColumnTypeHint => ({ column, type: "number" });
const dateCol = (column: string): ColumnTypeHint => ({ column, type: "date" });

describe("generateQuickInsights", () => {
	it("returns empty array when fewer than 2 columns", () => {
		expect(generateQuickInsights([textCol("Name")], ["Name"])).toEqual([]);
	});

	it("returns empty array for empty hints", () => {
		expect(generateQuickInsights([], [])).toEqual([]);
	});

	describe("Rule 1: Total by", () => {
		it("generates SUM insight for text + numeric", () => {
			const hints = [textCol("Category"), numCol("Revenue")];
			const result = generateQuickInsights(hints, ["Category", "Revenue"]);
			const rule1 = result[0];
			expect(rule1.title).toBe("Total Revenue by Category");
			expect(rule1.dimensions).toEqual([{ column: "Category" }]);
			expect(rule1.measures).toEqual([{ column: "Revenue", function: "SUM" }]);
		});
	});

	describe("Rule 2: Count by", () => {
		it("generates COUNT insight for text + numeric", () => {
			const hints = [textCol("Category"), numCol("Revenue")];
			const result = generateQuickInsights(hints, ["Category", "Revenue"]);
			const rule2 = result[1];
			expect(rule2.title).toBe("Count by Category");
			expect(rule2.measures[0].function).toBe("COUNT");
		});

		it("generates COUNT using text column when no numeric available", () => {
			const hints = [textCol("Name"), dateCol("Date")];
			const result = generateQuickInsights(hints, ["Name", "Date"]);
			const countInsight = result.find((r) => r.title.startsWith("Count"));
			expect(countInsight).toBeDefined();
			expect(countInsight!.measures[0].column).toBe("Name");
		});
	});

	describe("Rule 3: Over time", () => {
		it("generates time-bucket insight for date + numeric", () => {
			const hints = [dateCol("Date"), numCol("Sales")];
			const result = generateQuickInsights(hints, ["Date", "Sales"]);
			const timeInsight = result.find((r) => r.title.includes("over time"));
			expect(timeInsight).toBeDefined();
			expect(timeInsight!.timeBucket).toEqual({ column: "Date", period: "month" });
			expect(timeInsight!.measures[0]).toEqual({ column: "Sales", function: "SUM" });
		});
	});

	describe("Rule 4: Average by", () => {
		it("generates AVG insight for text + numeric", () => {
			const hints = [textCol("Region"), numCol("Price")];
			const result = generateQuickInsights(hints, ["Region", "Price"]);
			const avgInsight = result.find((r) => r.title.startsWith("Average"));
			expect(avgInsight).toBeDefined();
			expect(avgInsight!.title).toBe("Average Price by Region");
			expect(avgInsight!.measures[0]).toEqual({ column: "Price", function: "AVG" });
		});
	});

	describe("Rule 5: Top 5", () => {
		it("generates Top 5 insight with sort desc and limit", () => {
			const hints = [textCol("Product"), numCol("Revenue")];
			const result = generateQuickInsights(hints, ["Product", "Revenue"]);
			const topInsight = result.find((r) => r.title.startsWith("Top 5"));
			expect(topInsight).toBeDefined();
			expect(topInsight!.title).toBe("Top 5 Product by Revenue");
			expect(topInsight!.sort).toEqual([{ column: "SUM(Revenue)", direction: "desc" }]);
			expect(topInsight!.limit).toBe(5);
			expect(topInsight!.measures[0]).toEqual({ column: "Revenue", function: "SUM" });
		});
	});

	describe("Rule 6: Distribution", () => {
		it("generates distribution insight for 2+ text columns", () => {
			const hints = [textCol("Category"), textCol("Region"), numCol("Amount")];
			const result = generateQuickInsights(hints, ["Category", "Region", "Amount"]);
			const distInsight = result.find((r) => r.title.includes("Distribution"));
			expect(distInsight).toBeDefined();
			expect(distInsight!.title).toBe("Distribution of Category × Region");
			expect(distInsight!.dimensions).toEqual([
				{ column: "Category" },
				{ column: "Region" },
			]);
			expect(distInsight!.measures[0].function).toBe("COUNT");
		});

		it("skips distribution when only 1 text column", () => {
			const hints = [textCol("Name"), numCol("Value")];
			const result = generateQuickInsights(hints, ["Name", "Value"]);
			const distInsight = result.find((r) => r.title.includes("Distribution"));
			expect(distInsight).toBeUndefined();
		});
	});

	describe("combined scenarios", () => {
		it("generates up to 6 insights for rich schema", () => {
			const hints = [
				textCol("Category"), textCol("Region"),
				numCol("Revenue"), dateCol("Date"),
			];
			const result = generateQuickInsights(hints, ["Category", "Region", "Revenue", "Date"]);
			expect(result.length).toBe(6);
		});

		it("caps at 6 suggestions max", () => {
			const hints = [
				textCol("A"), textCol("B"), textCol("C"),
				numCol("X"), numCol("Y"),
				dateCol("D1"), dateCol("D2"),
			];
			const result = generateQuickInsights(hints, ["A", "B", "C", "X", "Y", "D1", "D2"]);
			expect(result.length).toBeLessThanOrEqual(6);
		});

		it("returns only applicable rules for numeric-only columns", () => {
			const hints = [numCol("A"), numCol("B")];
			const result = generateQuickInsights(hints, ["A", "B"]);
			// No text columns → no dimension-based insights
			expect(result.length).toBe(0);
		});

		it("returns insights for date + text without numeric", () => {
			const hints = [textCol("Name"), dateCol("Created")];
			const result = generateQuickInsights(hints, ["Name", "Created"]);
			// Should get Count by (uses text col as count column)
			expect(result.length).toBeGreaterThan(0);
			expect(result[0].title).toBe("Count by Name");
		});
	});
});
