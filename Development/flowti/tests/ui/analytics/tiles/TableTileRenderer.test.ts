// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest";
import "../../../mocks/obsidian-stub";
import { TableTileRenderer } from "../../../../src/ui/analytics/tiles/TableTileRenderer";
import type { AnalyticsResult, DashboardTile, ResultRow } from "../../../../src/domain/analytics/types";
import type { TileRenderContext } from "../../../../src/ui/analytics/tiles/types";

function makeTile(overrides?: Partial<DashboardTile>): DashboardTile {
	return {
		id: "tile-1",
		queryId: "q1",
		displayMode: "table",
		title: "Test Tile",
		...overrides,
	} as DashboardTile;
}

function makeResult(columns: string[], rows: ResultRow[]): AnalyticsResult {
	return { columns, rows, columnTypeHints: [], groupCount: rows.length, sourceRowCount: rows.length };
}

function makeCtx(result: AnalyticsResult, tile?: Partial<DashboardTile>, extras?: Partial<TileRenderContext>): TileRenderContext {
	return {
		tile: makeTile(tile),
		query: { id: "q1", name: "Test Query" } as any,
		result,
		error: null,
		onRemove: () => {},
		...extras,
	};
}

describe("TableTileRenderer", () => {
	let container: HTMLElement;
	let renderer: TableTileRenderer;

	beforeEach(() => {
		container = document.createElement("div");
		renderer = new TableTileRenderer();
	});

	it("renders 'No data' for empty result", () => {
		const result = makeResult(["a"], []);
		renderer.render(container, result, makeCtx(result));
		expect(container.textContent).toContain("No data");
	});

	it("renders table with data rows", () => {
		const result = makeResult(["name", "amount"], [
			{ name: "Alpha", amount: 100 },
			{ name: "Beta", amount: 200 },
		]);
		renderer.render(container, result, makeCtx(result));
		const table = container.querySelector("table");
		expect(table).not.toBeNull();
		const rows = table!.querySelectorAll("tbody tr");
		expect(rows.length).toBe(2);
	});

	it("renders KPI stat cards with Items count + numeric columns", () => {
		const result = makeResult(["name", "amount", "count"], [
			{ name: "A", amount: 100, count: 10 },
			{ name: "B", amount: 200, count: 20 },
		]);
		renderer.render(container, result, makeCtx(result));
		const statValues = container.querySelectorAll(".ft-catalog-stat-value");
		expect(statValues.length).toBe(3); // Items + amount + count
		expect(statValues[0].textContent).toBe("2"); // Items count
		const labels = container.querySelectorAll(".ft-catalog-stat-label");
		expect(labels[0].textContent).toBe("Items");
	});

	it("hides KPI cards when showTableKpis is false", () => {
		const result = makeResult(["name", "amount"], [
			{ name: "A", amount: 100 },
			{ name: "B", amount: 200 },
		]);
		renderer.render(container, result, makeCtx(result, { showTableKpis: false }));
		const statValues = container.querySelectorAll(".ft-catalog-stat-value");
		expect(statValues.length).toBe(0);
	});

	it("renders search input", () => {
		const result = makeResult(["name"], [{ name: "Alpha" }]);
		renderer.render(container, result, makeCtx(result));
		const searchInput = container.querySelector("input[type='text']");
		expect(searchInput).not.toBeNull();
	});

	it("renders table headers for all columns", () => {
		const result = makeResult(["name", "amount", "status"], [
			{ name: "A", amount: 100, status: "ok" },
		]);
		renderer.render(container, result, makeCtx(result));
		const headers = container.querySelectorAll("th");
		expect(headers.length).toBe(3);
	});

	it("applies column order from tile config", () => {
		const result = makeResult(["a", "b", "c"], [{ a: 1, b: 2, c: 3 }]);
		renderer.render(container, result, makeCtx(result, { columnOrder: ["c", "a", "b"] }));
		const headers = Array.from(container.querySelectorAll("th")).map((th) => th.textContent?.trim());
		expect(headers[0]).toContain("c");
		expect(headers[1]).toContain("a");
		expect(headers[2]).toContain("b");
	});

	it("applies conditional formatting to numeric cells", () => {
		const result = makeResult(["amount"], [{ amount: 150 }]);
		const ctx = makeCtx(result, {
			conditionalRules: [
				{ column: "amount", operator: ">", threshold: 100, color: "#00ff00" },
			],
		});
		renderer.render(container, ctx.result!, ctx);
		const td = container.querySelector("td");
		expect(td?.style.backgroundColor).toBe("#00ff00");
	});

	it("renders drill-down styling for string values when onDrillDown is provided", () => {
		const result = makeResult(["name", "amount"], [{ name: "Alpha", amount: 100 }]);
		const drillDownCalls: [string, string][] = [];
		const ctx = makeCtx(result, undefined, {
			onDrillDown: (col, val) => drillDownCalls.push([col, val]),
		});
		renderer.render(container, result, ctx);
		const tds = container.querySelectorAll("td");
		const nameTd = tds[0];
		expect(nameTd.classList.contains("ft-table-cell-clickable")).toBe(true);
	});

	// ── Pagination ─────────────────────────────────────────────

	describe("pagination", () => {
		/** Build a result with N sequential rows. */
		function manyRows(n: number): AnalyticsResult {
			const rows: ResultRow[] = [];
			for (let i = 1; i <= n; i++) rows.push({ name: `Row${i}`, amount: i * 10 });
			return makeResult(["name", "amount"], rows);
		}

		it("defaults to 15 rows per page when rowLimit is unset", () => {
			const result = manyRows(20);
			renderer.render(container, result, makeCtx(result));
			const rows = container.querySelectorAll("tbody tr");
			expect(rows.length).toBe(15);
			expect(container.textContent).toContain("1\u201315 of 20");
		});

		it("shows all rows when rowLimit is 0 (All preset)", () => {
			const result = manyRows(20);
			renderer.render(container, result, makeCtx(result, { rowLimit: 0 }));
			const rows = container.querySelectorAll("tbody tr");
			expect(rows.length).toBe(20);
			const buttons = container.querySelectorAll("button");
			expect(buttons.length).toBe(0);
		});

		it("renders only pageSize rows when rowLimit is set", () => {
			const result = manyRows(10);
			renderer.render(container, result, makeCtx(result, { rowLimit: 3 }));
			const rows = container.querySelectorAll("tbody tr");
			expect(rows.length).toBe(3);
		});

		it("renders pagination bar with correct row range indicator", () => {
			const result = manyRows(10);
			renderer.render(container, result, makeCtx(result, { rowLimit: 3 }));
			expect(container.textContent).toContain("1\u20133 of 10");
		});

		it("renders page 2 when currentPage is 2", () => {
			const result = manyRows(10);
			renderer.render(container, result, makeCtx(result, { rowLimit: 3 }, { currentPage: 2 }));
			const rows = container.querySelectorAll("tbody tr");
			expect(rows.length).toBe(3);
			expect(rows[0].textContent).toContain("Row4");
			expect(container.textContent).toContain("4\u20136 of 10");
		});

		it("renders last page with remaining rows", () => {
			const result = manyRows(10);
			renderer.render(container, result, makeCtx(result, { rowLimit: 3 }, { currentPage: 4 }));
			const rows = container.querySelectorAll("tbody tr");
			expect(rows.length).toBe(1);
			expect(rows[0].textContent).toContain("Row10");
			expect(container.textContent).toContain("10\u201310 of 10");
		});

		it("clamps currentPage to totalPages when page exceeds range", () => {
			const result = manyRows(5);
			renderer.render(container, result, makeCtx(result, { rowLimit: 3 }, { currentPage: 99 }));
			const rows = container.querySelectorAll("tbody tr");
			expect(rows.length).toBe(2);
			expect(rows[0].textContent).toContain("Row4");
		});

		it("Prev button calls onPageChange with page - 1", () => {
			const pageCalls: [string, number][] = [];
			const result = manyRows(10);
			renderer.render(container, result, makeCtx(result, { rowLimit: 3 }, {
				currentPage: 2,
				onPageChange: (tileId, page) => pageCalls.push([tileId, page]),
			}));
			const prevBtn = Array.from(container.querySelectorAll("button")).find((b) => b.textContent?.includes("prev"));
			expect(prevBtn).toBeDefined();
			prevBtn!.click();
			expect(pageCalls).toEqual([["tile-1", 1]]);
		});

		it("Next button calls onPageChange with page + 1", () => {
			const pageCalls: [string, number][] = [];
			const result = manyRows(10);
			renderer.render(container, result, makeCtx(result, { rowLimit: 3 }, {
				currentPage: 1,
				onPageChange: (tileId, page) => pageCalls.push([tileId, page]),
			}));
			const nextBtn = Array.from(container.querySelectorAll("button")).find((b) => b.textContent?.includes("Next"));
			expect(nextBtn).toBeDefined();
			nextBtn!.click();
			expect(pageCalls).toEqual([["tile-1", 2]]);
		});

		it("Prev button is disabled on page 1", () => {
			const result = manyRows(10);
			renderer.render(container, result, makeCtx(result, { rowLimit: 3 }, { currentPage: 1 }));
			const prevBtn = Array.from(container.querySelectorAll("button")).find((b) => b.textContent?.includes("prev"));
			expect(prevBtn).toBeDefined();
			expect(prevBtn!.disabled).toBe(true);
		});

		it("Next button is disabled on last page", () => {
			const result = manyRows(10);
			renderer.render(container, result, makeCtx(result, { rowLimit: 3 }, { currentPage: 4 }));
			const nextBtn = Array.from(container.querySelectorAll("button")).find((b) => b.textContent?.includes("Next"));
			expect(nextBtn).toBeDefined();
			expect(nextBtn!.disabled).toBe(true);
		});

		it("KPI cards reflect full dataset, not just current page", () => {
			const result = manyRows(10);
			renderer.render(container, result, makeCtx(result, { rowLimit: 3 }, { currentPage: 1 }));
			const statValues = container.querySelectorAll(".ft-catalog-stat-value");
			expect(statValues.length).toBe(2); // Items + amount
			expect(statValues[0].textContent).toBe("10"); // Items count (full dataset)
			expect(statValues[1].textContent).toContain("550"); // amount sum (full dataset)
		});

		it("no pagination bar when all rows fit in one page", () => {
			const result = manyRows(3);
			renderer.render(container, result, makeCtx(result, { rowLimit: 5 }));
			const rows = container.querySelectorAll("tbody tr");
			expect(rows.length).toBe(3);
			const buttons = container.querySelectorAll("button");
			expect(buttons.length).toBe(0);
		});
	});
});
