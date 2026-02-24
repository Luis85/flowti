// @vitest-environment happy-dom
/**
 * ChartRenderer unit tests.
 *
 * Tests SVG generation for line charts and bar charts,
 * axis auto-detection, and edge cases.
 */

import { describe, it, expect, beforeEach } from "vitest";
import "../../mocks/obsidian-stub";
import { ChartRenderer } from "../../../src/ui/analytics/ChartRenderer";
import type { AnalyticsResult } from "../../../src/domain/analytics/types";

// ── Helpers ─────────────────────────────────────────────────

function createResult(columns: string[], rows: Array<Record<string, string | number>>): AnalyticsResult {
	return { columns, rows, groupCount: rows.length, sourceRowCount: rows.length };
}

function createContainer(): HTMLElement {
	return document.createElement("div");
}

// ── extractChartData ────────────────────────────────────────

describe("ChartRenderer.extractChartData", () => {
	it("extracts labels from first non-numeric column and values from first numeric column", () => {
		const result = createResult(["Category", "Total"], [
			{ Category: "A", Total: 100 },
			{ Category: "B", Total: 200 },
			{ Category: "C", Total: 300 },
		]);
		const data = ChartRenderer.extractChartData(result);
		expect(data.labels).toEqual(["A", "B", "C"]);
		expect(data.values).toEqual([100, 200, 300]);
	});

	it("returns empty data for empty results", () => {
		const result = createResult(["Category", "Total"], []);
		const data = ChartRenderer.extractChartData(result);
		expect(data.labels).toEqual([]);
		expect(data.values).toEqual([]);
	});

	it("returns empty data when no numeric column exists", () => {
		const result = createResult(["Name", "Status"], [
			{ Name: "X", Status: "OK" },
		]);
		const data = ChartRenderer.extractChartData(result);
		expect(data.labels).toEqual([]);
		expect(data.values).toEqual([]);
	});

	it("uses index-based labels when all columns are numeric", () => {
		const result = createResult(["Count", "Total"], [
			{ Count: 5, Total: 100 },
			{ Count: 10, Total: 200 },
		]);
		const data = ChartRenderer.extractChartData(result);
		// All columns numeric — no label column; first numeric column ("Count") used as values
		expect(data.labels).toEqual(["1", "2"]);
		expect(data.values).toEqual([5, 10]);
	});

	it("handles single row", () => {
		const result = createResult(["Month", "Sales"], [
			{ Month: "Jan", Sales: 42 },
		]);
		const data = ChartRenderer.extractChartData(result);
		expect(data.labels).toEqual(["Jan"]);
		expect(data.values).toEqual([42]);
	});
});

// ── renderLineChart ─────────────────────────────────────────

describe("ChartRenderer.renderLineChart", () => {
	let container: HTMLElement;

	beforeEach(() => {
		container = createContainer();
	});

	it("renders an SVG element with path and circles for multi-point data", () => {
		const result = createResult(["Month", "Revenue"], [
			{ Month: "Jan", Revenue: 100 },
			{ Month: "Feb", Revenue: 200 },
			{ Month: "Mar", Revenue: 150 },
		]);
		ChartRenderer.renderLineChart(container, result);

		const svg = container.querySelector("svg");
		expect(svg).not.toBeNull();
		expect(svg!.getAttribute("viewBox")).toBe("0 0 400 225");

		// Should have a path element (line connecting points)
		const paths = svg!.querySelectorAll("path");
		expect(paths.length).toBe(1);

		// Should have 3 circle elements (dot markers)
		const circles = svg!.querySelectorAll("circle");
		expect(circles.length).toBe(3);
	});

	it("renders a single dot for single data point (no path)", () => {
		const result = createResult(["Month", "Revenue"], [
			{ Month: "Jan", Revenue: 100 },
		]);
		ChartRenderer.renderLineChart(container, result);

		const svg = container.querySelector("svg");
		expect(svg).not.toBeNull();

		// Single point = no path, just a circle
		const paths = svg!.querySelectorAll("path");
		expect(paths.length).toBe(0);

		const circles = svg!.querySelectorAll("circle");
		expect(circles.length).toBe(1);
	});

	it("shows 'No data' for empty results", () => {
		const result = createResult(["Month", "Revenue"], []);
		ChartRenderer.renderLineChart(container, result);

		expect(container.textContent).toContain("No data");
		expect(container.querySelector("svg")).toBeNull();
	});

	it("includes y-axis labels (text elements)", () => {
		const result = createResult(["X", "Y"], [
			{ X: "A", Y: 0 },
			{ X: "B", Y: 100 },
		]);
		ChartRenderer.renderLineChart(container, result);

		const svg = container.querySelector("svg");
		const textElements = svg!.querySelectorAll("text");
		// Y-axis (6 ticks: 0-5) + X-axis labels (2) = 8
		expect(textElements.length).toBeGreaterThanOrEqual(6);
	});

	it("includes x-axis labels", () => {
		const result = createResult(["Category", "Value"], [
			{ Category: "Alpha", Value: 10 },
			{ Category: "Beta", Value: 20 },
			{ Category: "Gamma", Value: 30 },
		]);
		ChartRenderer.renderLineChart(container, result);

		const svg = container.querySelector("svg");
		const texts = Array.from(svg!.querySelectorAll("text")).map((t) => t.textContent);
		expect(texts).toContain("Alpha");
		expect(texts).toContain("Beta");
		expect(texts).toContain("Gamma");
	});
});

// ── renderBarChart ──────────────────────────────────────────

describe("ChartRenderer.renderBarChart", () => {
	let container: HTMLElement;

	beforeEach(() => {
		container = createContainer();
	});

	it("renders rect elements for each data point", () => {
		const result = createResult(["Product", "Sales"], [
			{ Product: "Widget", Sales: 50 },
			{ Product: "Gadget", Sales: 80 },
			{ Product: "Doohickey", Sales: 30 },
		]);
		ChartRenderer.renderBarChart(container, result);

		const svg = container.querySelector("svg");
		expect(svg).not.toBeNull();

		const rects = svg!.querySelectorAll("rect");
		expect(rects.length).toBe(3);
	});

	it("renders bars with rounded corners (rx attribute)", () => {
		const result = createResult(["X", "Y"], [
			{ X: "A", Y: 100 },
		]);
		ChartRenderer.renderBarChart(container, result);

		const svg = container.querySelector("svg");
		const rect = svg!.querySelector("rect");
		expect(rect!.getAttribute("rx")).toBe("2");
	});

	it("renders value labels above bars", () => {
		const result = createResult(["X", "Y"], [
			{ X: "A", Y: 42 },
			{ X: "B", Y: 99 },
		]);
		ChartRenderer.renderBarChart(container, result);

		const svg = container.querySelector("svg");
		const texts = Array.from(svg!.querySelectorAll("text")).map((t) => t.textContent);
		expect(texts).toContain("42");
		expect(texts).toContain("99");
	});

	it("shows 'No data' for empty results", () => {
		const result = createResult(["X", "Y"], []);
		ChartRenderer.renderBarChart(container, result);

		expect(container.textContent).toContain("No data");
		expect(container.querySelector("svg")).toBeNull();
	});

	it("renders single bar for single data point", () => {
		const result = createResult(["X", "Y"], [
			{ X: "Only", Y: 123 },
		]);
		ChartRenderer.renderBarChart(container, result);

		const svg = container.querySelector("svg");
		const rects = svg!.querySelectorAll("rect");
		expect(rects.length).toBe(1);
	});
});

// ── Edge cases ──────────────────────────────────────────────

describe("ChartRenderer edge cases", () => {
	it("handles many data points (axis label auto-scaling)", () => {
		const rows = Array.from({ length: 20 }, (_, i) => ({
			Month: `M${i + 1}`,
			Value: (i + 1) * 10,
		}));
		const result = createResult(["Month", "Value"], rows);
		const container = createContainer();
		ChartRenderer.renderLineChart(container, result);

		const svg = container.querySelector("svg");
		expect(svg).not.toBeNull();

		// With 20 points and MAX_LABELS=12, x-axis should skip some labels
		const xAxisTexts = Array.from(svg!.querySelectorAll("text"))
			.filter((t) => t.textContent?.startsWith("M"));
		expect(xAxisTexts.length).toBeLessThan(20);
	});

	it("handles zero range (all same values)", () => {
		const result = createResult(["X", "Y"], [
			{ X: "A", Y: 50 },
			{ X: "B", Y: 50 },
			{ X: "C", Y: 50 },
		]);
		const container = createContainer();
		ChartRenderer.renderLineChart(container, result);

		const svg = container.querySelector("svg");
		expect(svg).not.toBeNull();
		// Should not crash — points rendered at midpoint
		const circles = svg!.querySelectorAll("circle");
		expect(circles.length).toBe(3);
	});

	it("formats large values with K/M suffixes", () => {
		const result = createResult(["X", "Y"], [
			{ X: "A", Y: 1500000 },
			{ X: "B", Y: 2500000 },
		]);
		const container = createContainer();
		ChartRenderer.renderBarChart(container, result);

		const svg = container.querySelector("svg");
		const texts = Array.from(svg!.querySelectorAll("text")).map((t) => t.textContent);
		expect(texts.some((t) => t?.includes("M"))).toBe(true);
	});
});

// ── extractMultiSeriesData ──────────────────────────────────

describe("ChartRenderer.extractMultiSeriesData", () => {
	it("extracts multi-series data with time bucket + dimension columns", () => {
		const result = createResult(
			["Supplier", "order_date_month", "SUM(amount)"],
			[
				{ Supplier: "Acme", order_date_month: "2025-01", "SUM(amount)": 1000 },
				{ Supplier: "Acme", order_date_month: "2025-02", "SUM(amount)": 1500 },
				{ Supplier: "Acme", order_date_month: "2025-03", "SUM(amount)": 1200 },
				{ Supplier: "Beta", order_date_month: "2025-01", "SUM(amount)": 800 },
				{ Supplier: "Beta", order_date_month: "2025-02", "SUM(amount)": 1200 },
				{ Supplier: "Beta", order_date_month: "2025-03", "SUM(amount)": 900 },
			],
		);

		const data = ChartRenderer.extractMultiSeriesData(result);
		expect(data).not.toBeNull();
		expect(data!.labels).toEqual(["2025-01", "2025-02", "2025-03"]);
		expect(data!.series).toHaveLength(2);
		expect(data!.series[0].name).toBe("Acme");
		expect(data!.series[0].values).toEqual([1000, 1500, 1200]);
		expect(data!.series[1].name).toBe("Beta");
		expect(data!.series[1].values).toEqual([800, 1200, 900]);
		expect(data!.valueColumn).toBe("SUM(amount)");
	});

	it("returns null for single non-numeric column (no dimension to group by)", () => {
		const result = createResult(
			["order_date_month", "SUM(amount)"],
			[
				{ order_date_month: "2025-01", "SUM(amount)": 1000 },
				{ order_date_month: "2025-02", "SUM(amount)": 1500 },
			],
		);
		expect(ChartRenderer.extractMultiSeriesData(result)).toBeNull();
	});

	it("returns null when no date bucket column is found", () => {
		const result = createResult(
			["Region", "Category", "Total"],
			[
				{ Region: "North", Category: "A", Total: 100 },
				{ Region: "South", Category: "B", Total: 200 },
			],
		);
		expect(ChartRenderer.extractMultiSeriesData(result)).toBeNull();
	});

	it("returns null for empty or single-row results", () => {
		const empty = createResult(["X", "Y", "Z"], []);
		expect(ChartRenderer.extractMultiSeriesData(empty)).toBeNull();

		const single = createResult(
			["Supplier", "order_date_month", "Total"],
			[{ Supplier: "Acme", order_date_month: "2025-01", Total: 100 }],
		);
		expect(ChartRenderer.extractMultiSeriesData(single)).toBeNull();
	});

	it("fills missing time buckets with zero", () => {
		const result = createResult(
			["Supplier", "order_date_month", "Sales"],
			[
				{ Supplier: "Acme", order_date_month: "2025-01", Sales: 100 },
				{ Supplier: "Acme", order_date_month: "2025-03", Sales: 300 },
				{ Supplier: "Beta", order_date_month: "2025-01", Sales: 200 },
				{ Supplier: "Beta", order_date_month: "2025-02", Sales: 250 },
				{ Supplier: "Beta", order_date_month: "2025-03", Sales: 150 },
			],
		);

		const data = ChartRenderer.extractMultiSeriesData(result)!;
		expect(data.labels).toEqual(["2025-01", "2025-02", "2025-03"]);
		expect(data.series[0].name).toBe("Acme");
		expect(data.series[0].values).toEqual([100, 0, 300]); // 2025-02 filled with 0
		expect(data.series[1].name).toBe("Beta");
		expect(data.series[1].values).toEqual([200, 250, 150]);
	});

	it("sorts labels chronologically", () => {
		const result = createResult(
			["Region", "order_date_month", "Amount"],
			[
				{ Region: "East", order_date_month: "2025-03", Amount: 50 },
				{ Region: "East", order_date_month: "2025-01", Amount: 30 },
				{ Region: "West", order_date_month: "2025-02", Amount: 40 },
				{ Region: "West", order_date_month: "2025-03", Amount: 60 },
			],
		);
		const data = ChartRenderer.extractMultiSeriesData(result)!;
		expect(data.labels).toEqual(["2025-01", "2025-02", "2025-03"]);
	});

	it("supports quarter-based time buckets", () => {
		const result = createResult(
			["Category", "quarter", "Revenue"],
			[
				{ Category: "X", quarter: "2025-Q1", Revenue: 100 },
				{ Category: "X", quarter: "2025-Q2", Revenue: 200 },
				{ Category: "Y", quarter: "2025-Q1", Revenue: 150 },
				{ Category: "Y", quarter: "2025-Q2", Revenue: 250 },
			],
		);
		const data = ChartRenderer.extractMultiSeriesData(result)!;
		expect(data.labels).toEqual(["2025-Q1", "2025-Q2"]);
		expect(data.series).toHaveLength(2);
	});

	it("limits series to MAX_SERIES (8)", () => {
		const rows: Array<Record<string, string | number>> = [];
		for (let s = 0; s < 12; s++) {
			for (const month of ["2025-01", "2025-02"]) {
				rows.push({ Supplier: `S${s}`, month, Sales: s * 10 });
			}
		}
		const result = createResult(["Supplier", "month", "Sales"], rows);
		const data = ChartRenderer.extractMultiSeriesData(result)!;
		expect(data.series.length).toBe(8);
	});

	it("combines multiple dimension columns into series name", () => {
		const result = createResult(
			["Region", "Category", "order_date_month", "Total"],
			[
				{ Region: "North", Category: "A", order_date_month: "2025-01", Total: 10 },
				{ Region: "North", Category: "A", order_date_month: "2025-02", Total: 20 },
				{ Region: "South", Category: "B", order_date_month: "2025-01", Total: 30 },
				{ Region: "South", Category: "B", order_date_month: "2025-02", Total: 40 },
			],
		);
		const data = ChartRenderer.extractMultiSeriesData(result)!;
		expect(data.series[0].name).toBe("North · A");
		expect(data.series[1].name).toBe("South · B");
	});
});

// ── Multi-series chart rendering ────────────────────────────

describe("ChartRenderer multi-series rendering", () => {
	it("renderLineChart auto-detects multi-series and renders legend + multiple paths", () => {
		const result = createResult(
			["Supplier", "order_date_month", "Sales"],
			[
				{ Supplier: "Acme", order_date_month: "2025-01", Sales: 100 },
				{ Supplier: "Acme", order_date_month: "2025-02", Sales: 200 },
				{ Supplier: "Beta", order_date_month: "2025-01", Sales: 150 },
				{ Supplier: "Beta", order_date_month: "2025-02", Sales: 250 },
			],
		);
		const container = createContainer();
		ChartRenderer.renderLineChart(container, result);

		const svg = container.querySelector("svg");
		expect(svg).not.toBeNull();

		// Two series → two line paths
		const paths = svg!.querySelectorAll("path");
		expect(paths.length).toBe(2);

		// Four dots total (2 series × 2 points)
		const circles = svg!.querySelectorAll("circle");
		expect(circles.length).toBe(4);

		// Legend should be rendered below the SVG
		expect(container.textContent).toContain("Acme");
		expect(container.textContent).toContain("Beta");
	});

	it("renderBarChart auto-detects multi-series and renders grouped bars with legend", () => {
		const result = createResult(
			["Supplier", "order_date_month", "Sales"],
			[
				{ Supplier: "Acme", order_date_month: "2025-01", Sales: 100 },
				{ Supplier: "Acme", order_date_month: "2025-02", Sales: 200 },
				{ Supplier: "Beta", order_date_month: "2025-01", Sales: 150 },
				{ Supplier: "Beta", order_date_month: "2025-02", Sales: 250 },
			],
		);
		const container = createContainer();
		ChartRenderer.renderBarChart(container, result);

		const svg = container.querySelector("svg");
		expect(svg).not.toBeNull();

		// 2 time buckets × 2 series = 4 bars
		const rects = svg!.querySelectorAll("rect");
		expect(rects.length).toBe(4);

		// Legend
		expect(container.textContent).toContain("Acme");
		expect(container.textContent).toContain("Beta");
	});

	it("falls back to single-series for data without date bucket column", () => {
		const result = createResult(["Category", "Total"], [
			{ Category: "A", Total: 100 },
			{ Category: "B", Total: 200 },
		]);
		const container = createContainer();
		ChartRenderer.renderLineChart(container, result);

		const svg = container.querySelector("svg");
		expect(svg).not.toBeNull();

		// Single series → one path, no legend
		const paths = svg!.querySelectorAll("path");
		expect(paths.length).toBe(1);
		expect(container.textContent).not.toContain("·"); // no series legend separators
	});
});

// ── renderSparkline ─────────────────────────────────────────

describe("ChartRenderer.renderSparkline", () => {
	it("renders SVG polyline for 3+ values", () => {
		const container = createContainer();
		const rendered = ChartRenderer.renderSparkline(container, [10, 20, 30, 25, 35]);
		expect(rendered).toBe(true);

		const svg = container.querySelector("svg");
		expect(svg).not.toBeNull();
		expect(svg!.getAttribute("viewBox")).toBe("0 0 80 24");

		const polyline = svg!.querySelector("polyline");
		expect(polyline).not.toBeNull();
		expect(polyline!.getAttribute("fill")).toBe("none");
		expect(polyline!.getAttribute("stroke-width")).toBe("1.5");
	});

	it("returns false for fewer than 3 values", () => {
		const container = createContainer();
		expect(ChartRenderer.renderSparkline(container, [10, 20])).toBe(false);
		expect(container.querySelector("svg")).toBeNull();

		expect(ChartRenderer.renderSparkline(container, [10])).toBe(false);
		expect(ChartRenderer.renderSparkline(container, [])).toBe(false);
	});

	it("renders exactly at threshold (3 values)", () => {
		const container = createContainer();
		const rendered = ChartRenderer.renderSparkline(container, [5, 10, 15]);
		expect(rendered).toBe(true);
		expect(container.querySelector("polyline")).not.toBeNull();
	});

	it("handles constant values (zero range)", () => {
		const container = createContainer();
		const rendered = ChartRenderer.renderSparkline(container, [42, 42, 42, 42]);
		expect(rendered).toBe(true);
		// Should not crash — horizontal line
		expect(container.querySelector("polyline")).not.toBeNull();
	});

	it("has compact dimensions (80x24)", () => {
		const container = createContainer();
		ChartRenderer.renderSparkline(container, [1, 2, 3]);
		const svg = container.querySelector("svg") as SVGSVGElement;
		expect(svg.style.width).toBe("80px");
		expect(svg.style.height).toBe("24px");
	});
});
