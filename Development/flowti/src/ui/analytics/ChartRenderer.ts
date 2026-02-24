/**
 * Pure SVG chart renderer for dashboard tiles.
 *
 * Generates line charts and bar charts from analytics results.
 * No external dependencies — all SVG is hand-crafted.
 * Auto-detects x-axis (first dimension) and y-axis (first measure).
 */

import type { AnalyticsResult } from "../../domain/analytics/types";

// ── Layout constants ────────────────────────────────────

const CHART_WIDTH = 400;
const CHART_HEIGHT = 225;
const PADDING = { top: 20, right: 20, bottom: 50, left: 60 };
const PLOT_W = CHART_WIDTH - PADDING.left - PADDING.right;
const PLOT_H = CHART_HEIGHT - PADDING.top - PADDING.bottom;
const DOT_RADIUS = 3;
const BAR_GAP_RATIO = 0.2;
const MAX_LABELS = 12;

export interface ChartData {
	labels: string[];
	values: number[];
}

export class ChartRenderer {

	/**
	 * Extract chart data from an analytics result.
	 * Uses the first non-numeric column as labels (x-axis)
	 * and the first numeric column as values (y-axis).
	 */
	static extractChartData(result: AnalyticsResult): ChartData {
		if (result.rows.length === 0) return { labels: [], values: [] };

		const firstRow = result.rows[0];
		const labelCol = result.columns.find((c) => typeof firstRow[c] !== "number");
		const valueCol = result.columns.find((c) => typeof firstRow[c] === "number");

		if (!valueCol) return { labels: [], values: [] };

		const labels: string[] = [];
		const values: number[] = [];
		for (const row of result.rows) {
			labels.push(labelCol ? String(row[labelCol] ?? "") : String(labels.length + 1));
			const val = row[valueCol];
			values.push(typeof val === "number" ? val : 0);
		}
		return { labels, values };
	}

	/**
	 * Render an SVG line chart into the container.
	 */
	static renderLineChart(container: HTMLElement, result: AnalyticsResult): void {
		const data = ChartRenderer.extractChartData(result);
		if (data.values.length === 0) {
			container.createDiv({ text: "No data", cls: "ft-text-muted ft-text-sm ft-text-center" });
			return;
		}

		const svg = ChartRenderer.buildSvg(container);
		const { yMin, yMax, yRange } = ChartRenderer.computeYRange(data.values);

		// Y-axis labels + grid lines
		ChartRenderer.drawYAxis(svg, yMin, yMax);

		// X-axis labels
		ChartRenderer.drawXAxis(svg, data.labels);

		// Data points and lines
		const points = data.values.map((v, i) => ({
			x: PADDING.left + (data.values.length === 1 ? PLOT_W / 2 : (i / (data.values.length - 1)) * PLOT_W),
			y: yRange === 0 ? PADDING.top + PLOT_H / 2 : PADDING.top + PLOT_H - ((v - yMin) / yRange) * PLOT_H,
		}));

		// Line path
		if (points.length > 1) {
			const pathData = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
			const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
			path.setAttribute("d", pathData);
			path.setAttribute("fill", "none");
			path.setAttribute("stroke", "var(--interactive-accent)");
			path.setAttribute("stroke-width", "2");
			svg.appendChild(path);
		}

		// Dot markers
		for (const p of points) {
			const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
			circle.setAttribute("cx", p.x.toFixed(1));
			circle.setAttribute("cy", p.y.toFixed(1));
			circle.setAttribute("r", String(DOT_RADIUS));
			circle.setAttribute("fill", "var(--interactive-accent)");
			svg.appendChild(circle);
		}
	}

	/**
	 * Render an SVG bar chart into the container.
	 */
	static renderBarChart(container: HTMLElement, result: AnalyticsResult): void {
		const data = ChartRenderer.extractChartData(result);
		if (data.values.length === 0) {
			container.createDiv({ text: "No data", cls: "ft-text-muted ft-text-sm ft-text-center" });
			return;
		}

		const svg = ChartRenderer.buildSvg(container);
		const { yMin, yMax, yRange } = ChartRenderer.computeYRange(data.values);

		// Y-axis labels + grid lines
		ChartRenderer.drawYAxis(svg, yMin, yMax);

		// X-axis labels
		ChartRenderer.drawXAxis(svg, data.labels);

		// Bars
		const n = data.values.length;
		const totalBarWidth = PLOT_W / n;
		const barWidth = totalBarWidth * (1 - BAR_GAP_RATIO);
		const gap = totalBarWidth * BAR_GAP_RATIO;

		const baseline = PADDING.top + PLOT_H;

		for (let i = 0; i < n; i++) {
			const v = data.values[i];
			const barHeight = yRange === 0 ? PLOT_H / 2 : ((v - yMin) / yRange) * PLOT_H;
			const x = PADDING.left + i * totalBarWidth + gap / 2;
			const y = baseline - barHeight;

			const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
			rect.setAttribute("x", x.toFixed(1));
			rect.setAttribute("y", y.toFixed(1));
			rect.setAttribute("width", barWidth.toFixed(1));
			rect.setAttribute("height", Math.max(barHeight, 1).toFixed(1));
			rect.setAttribute("fill", "var(--interactive-accent)");
			rect.setAttribute("rx", "2");
			svg.appendChild(rect);

			// Value label above bar
			const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
			label.setAttribute("x", (x + barWidth / 2).toFixed(1));
			label.setAttribute("y", (y - 4).toFixed(1));
			label.setAttribute("text-anchor", "middle");
			label.setAttribute("fill", "var(--text-muted)");
			label.setAttribute("font-size", "10");
			label.textContent = ChartRenderer.formatValue(v);
			svg.appendChild(label);
		}
	}

	/**
	 * Render a compact sparkline SVG (80x24px) — pure trend line, no axes.
	 * Requires at least 3 values; returns false if not enough data.
	 */
	static renderSparkline(container: HTMLElement, values: number[]): boolean {
		if (values.length < 3) return false;

		const W = 80;
		const H = 24;
		const PAD = 2;
		const plotW = W - PAD * 2;
		const plotH = H - PAD * 2;

		const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
		svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
		svg.style.width = "80px";
		svg.style.height = "24px";
		svg.style.display = "block";

		const min = Math.min(...values);
		const max = Math.max(...values);
		const range = max - min;

		const points = values.map((v, i) => {
			const x = PAD + (i / (values.length - 1)) * plotW;
			const y = range === 0 ? PAD + plotH / 2 : PAD + plotH - ((v - min) / range) * plotH;
			return `${x.toFixed(1)},${y.toFixed(1)}`;
		});

		const polyline = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
		polyline.setAttribute("points", points.join(" "));
		polyline.setAttribute("fill", "none");
		polyline.setAttribute("stroke", "var(--interactive-accent)");
		polyline.setAttribute("stroke-width", "1.5");
		svg.appendChild(polyline);

		container.appendChild(svg);
		return true;
	}

	// ── Private helpers ─────────────────────────────────────

	private static buildSvg(container: HTMLElement): SVGSVGElement {
		const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
		svg.setAttribute("viewBox", `0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`);
		svg.style.width = "100%";
		svg.style.maxHeight = "225px";
		container.appendChild(svg);
		return svg;
	}

	private static computeYRange(values: number[]): { yMin: number; yMax: number; yRange: number } {
		const yMin = Math.min(...values);
		const yMax = Math.max(...values);
		const yRange = yMax - yMin;
		return { yMin, yMax, yRange };
	}

	private static drawYAxis(svg: SVGSVGElement, yMin: number, yMax: number): void {
		const yRange = yMax - yMin;
		const ticks = 5;

		for (let i = 0; i <= ticks; i++) {
			const ratio = i / ticks;
			const y = PADDING.top + PLOT_H - ratio * PLOT_H;
			const val = yRange === 0 ? yMin : yMin + ratio * yRange;

			// Grid line
			const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
			line.setAttribute("x1", String(PADDING.left));
			line.setAttribute("x2", String(PADDING.left + PLOT_W));
			line.setAttribute("y1", y.toFixed(1));
			line.setAttribute("y2", y.toFixed(1));
			line.setAttribute("stroke", "var(--background-modifier-border)");
			line.setAttribute("stroke-width", "0.5");
			svg.appendChild(line);

			// Label
			const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
			label.setAttribute("x", String(PADDING.left - 8));
			label.setAttribute("y", (y + 3).toFixed(1));
			label.setAttribute("text-anchor", "end");
			label.setAttribute("fill", "var(--text-muted)");
			label.setAttribute("font-size", "10");
			label.textContent = ChartRenderer.formatValue(val);
			svg.appendChild(label);
		}
	}

	private static drawXAxis(svg: SVGSVGElement, labels: string[]): void {
		const n = labels.length;
		const step = n <= MAX_LABELS ? 1 : Math.ceil(n / MAX_LABELS);
		const y = PADDING.top + PLOT_H + 16;

		for (let i = 0; i < n; i += step) {
			const x = PADDING.left + (n === 1 ? PLOT_W / 2 : (i / (n - 1)) * PLOT_W);
			const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
			label.setAttribute("x", x.toFixed(1));
			label.setAttribute("y", String(y));
			label.setAttribute("text-anchor", "middle");
			label.setAttribute("fill", "var(--text-muted)");
			label.setAttribute("font-size", "10");
			const text = labels[i].length > 10 ? labels[i].slice(0, 9) + "\u2026" : labels[i];
			label.textContent = text;
			svg.appendChild(label);
		}
	}

	private static formatValue(v: number): string {
		if (Math.abs(v) >= 1_000_000) return (v / 1_000_000).toFixed(1) + "M";
		if (Math.abs(v) >= 1_000) return (v / 1_000).toFixed(1) + "K";
		return Number.isInteger(v) ? String(v) : v.toFixed(1);
	}
}
