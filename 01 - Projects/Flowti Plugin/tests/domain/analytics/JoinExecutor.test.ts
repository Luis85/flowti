import { describe, it, expect, beforeEach } from "vitest";
import { JoinExecutor } from "../../../src/domain/analytics/JoinExecutor";
import type { AnalyticsSource, JoinSpec } from "../../../src/domain/analytics/types";

function makeSource(alias: string, headers: string[], rows: string[][]): AnalyticsSource {
	return {
		alias,
		data: { headers, rows },
	};
}

describe("JoinExecutor", () => {
	let executor: JoinExecutor;

	beforeEach(() => {
		executor = new JoinExecutor();
	});

	describe("buildSourceTables", () => {
		it("converts source data to row maps", () => {
			const sources = [
				makeSource("orders", ["id", "product"], [["1", "Widget"], ["2", "Gadget"]]),
			];

			const tables = executor.buildSourceTables(sources);

			expect(tables.size).toBe(1);
			const rows = tables.get("orders")!;
			expect(rows).toHaveLength(2);
			expect(rows[0]).toEqual({ id: "1", product: "Widget" });
			expect(rows[1]).toEqual({ id: "2", product: "Gadget" });
		});

		it("handles multiple sources", () => {
			const sources = [
				makeSource("a", ["x"], [["1"]]),
				makeSource("b", ["y"], [["2"]]),
			];

			const tables = executor.buildSourceTables(sources);

			expect(tables.size).toBe(2);
			expect(tables.get("a")![0]).toEqual({ x: "1" });
			expect(tables.get("b")![0]).toEqual({ y: "2" });
		});

		it("handles empty sources", () => {
			const sources = [makeSource("empty", ["col"], [])];
			const tables = executor.buildSourceTables(sources);
			expect(tables.get("empty")).toEqual([]);
		});

		it("fills missing columns with empty string", () => {
			const sources = [makeSource("s", ["a", "b", "c"], [["1"]])];
			const tables = executor.buildSourceTables(sources);
			expect(tables.get("s")![0]).toEqual({ a: "1", b: "", c: "" });
		});
	});

	describe("applyJoins", () => {
		it("returns first table when no joins specified", () => {
			const tables = new Map([
				["orders", [{ id: "1", product: "Widget" }]],
				["customers", [{ id: "1", name: "Alice" }]],
			]);

			const result = executor.applyJoins(tables, []);

			expect(result).toEqual([{ id: "1", product: "Widget" }]);
		});

		it("performs inner join on matching keys", () => {
			const tables = new Map([
				["orders", [
					{ orderId: "1", custId: "A", product: "Widget" },
					{ orderId: "2", custId: "B", product: "Gadget" },
					{ orderId: "3", custId: "C", product: "Doohickey" },
				]],
				["customers", [
					{ custId: "A", name: "Alice" },
					{ custId: "B", name: "Bob" },
				]],
			]);

			const joins: JoinSpec[] = [{
				type: "inner",
				leftSource: "orders",
				rightSource: "customers",
				leftColumn: "custId",
				rightColumn: "custId",
			}];

			const result = executor.applyJoins(tables, joins);

			expect(result).toHaveLength(2);
			expect(result[0]).toEqual({ orderId: "1", custId: "A", product: "Widget", name: "Alice" });
			expect(result[1]).toEqual({ orderId: "2", custId: "B", product: "Gadget", name: "Bob" });
		});

		it("performs left join preserving unmatched rows", () => {
			const tables = new Map([
				["orders", [
					{ orderId: "1", custId: "A" },
					{ orderId: "2", custId: "Z" },
				]],
				["customers", [
					{ custId: "A", name: "Alice" },
				]],
			]);

			const joins: JoinSpec[] = [{
				type: "left",
				leftSource: "orders",
				rightSource: "customers",
				leftColumn: "custId",
				rightColumn: "custId",
			}];

			const result = executor.applyJoins(tables, joins);

			expect(result).toHaveLength(2);
			expect(result[0].name).toBe("Alice");
			expect(result[1].name).toBe("Unknown");
		});

		it("handles empty left table", () => {
			const tables = new Map([
				["left", [] as Record<string, string>[]],
				["right", [{ id: "1" }]],
			]);

			const joins: JoinSpec[] = [{
				type: "inner",
				leftSource: "left",
				rightSource: "right",
				leftColumn: "id",
				rightColumn: "id",
			}];

			expect(executor.applyJoins(tables, joins)).toEqual([]);
		});

		it("handles empty right table with inner join", () => {
			const tables = new Map([
				["left", [{ id: "1" }]],
				["right", [] as Record<string, string>[]],
			]);

			const joins: JoinSpec[] = [{
				type: "inner",
				leftSource: "left",
				rightSource: "right",
				leftColumn: "id",
				rightColumn: "id",
			}];

			expect(executor.applyJoins(tables, joins)).toEqual([]);
		});

		it("handles one-to-many join (duplicating left rows)", () => {
			const tables = new Map([
				["orders", [{ orderId: "1", custId: "A" }]],
				["items", [
					{ custId: "A", item: "Widget" },
					{ custId: "A", item: "Gadget" },
				]],
			]);

			const joins: JoinSpec[] = [{
				type: "inner",
				leftSource: "orders",
				rightSource: "items",
				leftColumn: "custId",
				rightColumn: "custId",
			}];

			const result = executor.applyJoins(tables, joins);

			expect(result).toHaveLength(2);
			expect(result[0].item).toBe("Widget");
			expect(result[1].item).toBe("Gadget");
		});

		it("returns empty for missing source alias", () => {
			const tables = new Map<string, Record<string, string>[]>();

			const joins: JoinSpec[] = [{
				type: "inner",
				leftSource: "missing",
				rightSource: "alsoMissing",
				leftColumn: "id",
				rightColumn: "id",
			}];

			expect(executor.applyJoins(tables, joins)).toEqual([]);
		});
	});
});
