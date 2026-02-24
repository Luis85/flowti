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
