// @vitest-environment happy-dom
/**
 * Unit tests for the visual filter builder panel.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import "../../mocks/obsidian-stub";
import { FilterBuilderPanel } from "../../../src/ui/analytics/queries/FilterBuilderPanel";
import type { QueriesSubDeps, QuerySource } from "../../../src/ui/analytics/queries/types";

function createMockDeps(overrides: Partial<QueriesSubDeps> = {}): QueriesSubDeps {
	return {
		hubDeps: {} as any,
		getLoadedHeaders: () => ["name", "cost", "date"],
		renderDetail: vi.fn(),
		renderMaster: vi.fn(),
		sources: () => [],
		columnTypeHints: () => [
			{ column: "name", type: "string" },
			{ column: "cost", type: "number" },
			{ column: "date", type: "date" },
		],
		setColumnTypeHints: vi.fn(),
		joins: () => [],
		setJoins: vi.fn(),
		dimensions: () => [],
		setDimensions: vi.fn(),
		measures: () => [],
		setMeasures: vi.fn(),
		timeBucket: () => null,
		setTimeBucket: vi.fn(),
		filters: () => [],
		setFilters: vi.fn(),
		sort: () => [],
		setSort: vi.fn(),
		limit: () => null,
		setLimit: vi.fn(),
		computedColumns: () => [],
		setComputedColumns: vi.fn(),
		excludedColumns: () => [],
		setExcludedColumns: vi.fn(),
		lastResult: () => null,
		lastDurationMs: () => undefined,
		lastError: () => null,
		running: () => false,
		executeQuery: vi.fn(),
		handleExportCsv: vi.fn(),
		applyQuickInsight: vi.fn(),
		loadSavedQuery: vi.fn(),
		newQuery: vi.fn(),
		showPreview: () => false,
		togglePreview: vi.fn(),
		chartMode: () => "line" as const,
		setChartMode: vi.fn(),
		chartValueColumn: () => null,
		setChartValueColumn: vi.fn(),
		...overrides,
	};
}

describe("FilterBuilderPanel", () => {
	let container: HTMLElement;

	beforeEach(() => {
		container = document.createElement("div");
	});

	it("should render empty state when no filters", () => {
		const panel = new FilterBuilderPanel(container, createMockDeps());
		panel.render();

		expect(container.textContent).toContain("No filters");
		expect(container.textContent).toContain("Filters");
	});

	it("should render filter rows for existing filters", () => {
		const deps = createMockDeps({
			filters: () => [
				{ column: "name", operator: "=", value: "Alice" },
				{ column: "cost", operator: ">", value: "100" },
			],
		});

		const panel = new FilterBuilderPanel(container, deps);
		panel.render();

		// Should have 2 filter rows (each with select + input + remove)
		const selects = container.querySelectorAll("select");
		// Each row: column picker + operator = 2 selects per row = 4 total
		expect(selects.length).toBeGreaterThanOrEqual(4);
	});

	it("should show string operators for string columns", () => {
		const deps = createMockDeps({
			filters: () => [{ column: "name", operator: "=", value: "" }],
		});

		const panel = new FilterBuilderPanel(container, deps);
		panel.render();

		// Find the operator select (second select in the first row)
		const operatorOptions = container.querySelectorAll("select");
		// The second select should be the operator select
		let operatorSelect: HTMLSelectElement | null = null;
		for (const sel of Array.from(operatorOptions)) {
			const options = Array.from(sel.querySelectorAll("option"));
			const hasContains = options.some((o) => (o as HTMLOptionElement).value === "contains");
			if (hasContains) {
				operatorSelect = sel as HTMLSelectElement;
				break;
			}
		}

		expect(operatorSelect).not.toBeNull();
		const opts = Array.from(operatorSelect!.options).map((o) => o.value);
		expect(opts).toContain("contains");
		expect(opts).toContain("startsWith");
		expect(opts).not.toContain(">");
		expect(opts).not.toContain("<");
	});

	it("should show numeric operators for number columns", () => {
		const deps = createMockDeps({
			filters: () => [{ column: "cost", operator: "=", value: "" }],
		});

		const panel = new FilterBuilderPanel(container, deps);
		panel.render();

		// Find operator select with > option
		let operatorSelect: HTMLSelectElement | null = null;
		const selects = container.querySelectorAll("select");
		for (const sel of Array.from(selects)) {
			const options = Array.from(sel.querySelectorAll("option"));
			const hasGt = options.some((o) => (o as HTMLOptionElement).value === ">");
			if (hasGt) {
				operatorSelect = sel as HTMLSelectElement;
				break;
			}
		}

		expect(operatorSelect).not.toBeNull();
		const opts = Array.from(operatorSelect!.options).map((o) => o.value);
		expect(opts).toContain(">");
		expect(opts).toContain("<");
		expect(opts).toContain(">=");
		expect(opts).toContain("<=");
		expect(opts).not.toContain("contains");
		expect(opts).not.toContain("startsWith");
	});

	it("should show numeric operators for date columns", () => {
		const deps = createMockDeps({
			filters: () => [{ column: "date", operator: "=", value: "" }],
		});

		const panel = new FilterBuilderPanel(container, deps);
		panel.render();

		// Date columns should use NUMERIC_OPERATORS (same as number)
		let operatorSelect: HTMLSelectElement | null = null;
		const selects = container.querySelectorAll("select");
		for (const sel of Array.from(selects)) {
			const options = Array.from(sel.querySelectorAll("option"));
			const hasGt = options.some((o) => (o as HTMLOptionElement).value === ">");
			if (hasGt) {
				operatorSelect = sel as HTMLSelectElement;
				break;
			}
		}

		expect(operatorSelect).not.toBeNull();
		const opts = Array.from(operatorSelect!.options).map((o) => o.value);
		expect(opts).not.toContain("contains");
	});

	it("should render datalist with distinct values for string columns", () => {
		const deps = createMockDeps({
			filters: () => [{ column: "name", operator: "=", value: "" }],
			getDistinctValues: (col: string) => {
				if (col === "name") return ["Alice", "Bob", "Charlie"];
				return [];
			},
		});

		const panel = new FilterBuilderPanel(container, deps);
		panel.render();

		const datalist = container.querySelector("datalist");
		expect(datalist).not.toBeNull();
		const opts = datalist!.querySelectorAll("option");
		expect(opts.length).toBe(3);
		expect(opts[0].value).toBe("Alice");
	});

	it("should not render datalist for number columns", () => {
		const deps = createMockDeps({
			filters: () => [{ column: "cost", operator: "=", value: "" }],
			getDistinctValues: () => ["100", "200", "300"],
		});

		const panel = new FilterBuilderPanel(container, deps);
		panel.render();

		const datalist = container.querySelector("datalist");
		expect(datalist).toBeNull();
	});

	it("should not render datalist when getDistinctValues is not provided", () => {
		const deps = createMockDeps({
			filters: () => [{ column: "name", operator: "=", value: "" }],
			getDistinctValues: undefined,
		});

		const panel = new FilterBuilderPanel(container, deps);
		panel.render();

		const datalist = container.querySelector("datalist");
		expect(datalist).toBeNull();
	});

	it("should call setFilters and renderDetail when Add is clicked", () => {
		const setFilters = vi.fn();
		const renderDetail = vi.fn();
		const deps = createMockDeps({ setFilters, renderDetail });

		const panel = new FilterBuilderPanel(container, deps);
		panel.render();

		// Find the Add button
		const addBtn = container.querySelector("[aria-label]") ??
			Array.from(container.querySelectorAll("span")).find((s) => s.textContent?.includes("Add"));
		expect(addBtn).not.toBeNull();
		addBtn!.dispatchEvent(new Event("click"));

		expect(setFilters).toHaveBeenCalled();
		expect(renderDetail).toHaveBeenCalled();
	});

	it("should remove filter when X is clicked", () => {
		const setFilters = vi.fn();
		const renderDetail = vi.fn();
		const deps = createMockDeps({
			filters: () => [{ column: "name", operator: "=" as const, value: "test" }],
			setFilters,
			renderDetail,
		});

		const panel = new FilterBuilderPanel(container, deps);
		panel.render();

		// Find nav-link spans inside filter rows (the remove buttons)
		const navLinks = Array.from(container.querySelectorAll(".ft-nav-link"));
		// Filter out the "Add" button (first one); the remove button is the second
		const removeBtn = navLinks.find((el) => !el.textContent?.includes("Add"));
		expect(removeBtn).toBeDefined();
		removeBtn!.dispatchEvent(new Event("click"));

		expect(setFilters).toHaveBeenCalled();
		expect(renderDetail).toHaveBeenCalled();
	});

	it("should handle column with no type hint as string", () => {
		const deps = createMockDeps({
			getLoadedHeaders: () => ["unknown_col"],
			columnTypeHints: () => [], // No hints at all
			filters: () => [{ column: "unknown_col", operator: "=", value: "" }],
		});

		const panel = new FilterBuilderPanel(container, deps);
		panel.render();

		// Should have contains/startsWith operators (string default)
		let operatorSelect: HTMLSelectElement | null = null;
		const selects = container.querySelectorAll("select");
		for (const sel of Array.from(selects)) {
			const options = Array.from(sel.querySelectorAll("option"));
			const hasContains = options.some((o) => (o as HTMLOptionElement).value === "contains");
			if (hasContains) {
				operatorSelect = sel as HTMLSelectElement;
				break;
			}
		}

		expect(operatorSelect).not.toBeNull();
	});

	it("should render Add button", () => {
		const panel = new FilterBuilderPanel(container, createMockDeps());
		panel.render();

		expect(container.textContent).toContain("Add");
	});

	it("should render value input with correct value", () => {
		const deps = createMockDeps({
			filters: () => [{ column: "name", operator: "=", value: "test-value" }],
		});

		const panel = new FilterBuilderPanel(container, deps);
		panel.render();

		const input = container.querySelector("input[type='text']") as HTMLInputElement;
		expect(input).not.toBeNull();
		expect(input.value).toBe("test-value");
	});

	it("should handle multiple filters", () => {
		const deps = createMockDeps({
			filters: () => [
				{ column: "name", operator: "=", value: "Alice" },
				{ column: "cost", operator: ">", value: "100" },
				{ column: "date", operator: ">=", value: "2025-01-01" },
			],
		});

		const panel = new FilterBuilderPanel(container, deps);
		panel.render();

		const inputs = container.querySelectorAll("input[type='text']");
		expect(inputs.length).toBe(3);
	});
});
