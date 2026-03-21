/**
 * Pure SVG chart renderer for dashboard tiles.
 *
 * Generates line, bar, area, pie charts, and sparklines from analytics results.
 * No external dependencies — all SVG is hand-crafted.
 * Auto-detects x-axis (first dimension) and y-axis (first measure).
 *
 * Multi-series rendering and shared SVG helpers are in chartMultiSeries.ts.
 */

import type { AnalyticsResult } from "../../domain/analytics/types";
import {
	SERIES_COLORS,
	buildSvg, computeYRange, drawYAxis, drawXAxis, formatValue,
	renderMultiSeriesLine, renderMultiSeriesBar, renderMultiSeriesArea,
} from "./chartMultiSeries";

const DOT_RADIUS = 3;
const BAR_GAP_RATIO = 0.2;
const MAX_SERIES = 8;
const PADDING = { top: 20, right: 10, bottom: 50, left: 32 };
const PLOT_W = 400 - PADDING.left - PADDING.right;
const PLOT_H = 225 - PADDING.top - PADDING.bottom;

export interface ChartData {
	labels: string[];
	values: number[];
}

export interface MultiSeriesChartData {
	labels: string[];
	series: Array<{ name: string; values: number[] }>;
	valueColumn: string;
}

export interface ChartOptions {
	valueColumns?: string[];
	hiddenSeries?: string[];
	onToggleSeries?: (seriesName: string) => void;
}

export class ChartRenderer {

	static extractChartData(result: AnalyticsResult, valueColumn?: string): ChartData {
		if (result.rows.length === 0) return { labels: [], values: [] };
		const firstRow = result.rows[0];
		const labelCol = result.columns.find((c) => typeof firstRow[c] !== "number");
		const valueCol = valueColumn ?? result.columns.find((c) => typeof firstRow[c] === "number");
		if (!valueCol) return { labels: [], values: [] };
		const pairs: Array<{ label: string; value: number }> = [];
		for (const row of result.rows) {
			const label = labelCol ? String(row[labelCol] ?? "") : String(pairs.length + 1);
			const val = row[valueCol];
			pairs.push({ label, value: typeof val === "number" ? val : 0 });
		}
		if (pairs.length > 1 && ChartRenderer.looksLikeDateBuckets(pairs.map((p) => p.label))) {
			pairs.sort((a, b) => a.label.localeCompare(b.label));
		}
		return { labels: pairs.map((p) => p.label), values: pairs.map((p) => p.value) };
	}

	static extractMultiSeriesData(result: AnalyticsResult, valueColumn?: string): MultiSeriesChartData | null {
		if (result.rows.length < 2) return null;
		const firstRow = result.rows[0];
		const numericCols = result.columns.filter((c) => typeof firstRow[c] === "number");
		const nonNumericCols = result.columns.filter((c) => typeof firstRow[c] !== "number");
		if (numericCols.length === 0 || nonNumericCols.length < 2) return null;
		const dateBucketCol = nonNumericCols.find((col) => {
			const sample = result.rows.slice(0, 10).map((r) => String(r[col] ?? ""));
			return ChartRenderer.looksLikeDateBuckets(sample);
		});
		if (!dateBucketCol) return null;
		const dimCols = nonNumericCols.filter((c) => c !== dateBucketCol);
		if (dimCols.length === 0) return null;
		const valueCol = valueColumn ?? numericCols[0];
		const seriesMap = new Map<string, Map<string, number>>();
		for (const row of result.rows) {
			const seriesKey = dimCols.map((c) => String(row[c] ?? "")).join(" \u00B7 ");
			const timeLabel = String(row[dateBucketCol] ?? "");
			const val = row[valueCol];
			if (!seriesMap.has(seriesKey)) seriesMap.set(seriesKey, new Map());
			seriesMap.get(seriesKey)!.set(timeLabel, typeof val === "number" ? val : 0);
		}
		const allLabels = [...new Set(result.rows.map((r) => String(r[dateBucketCol] ?? "")))];
		allLabels.sort((a, b) => a.localeCompare(b));
		const series = [...seriesMap.entries()].map(([name, valMap]) => ({
			name, values: allLabels.map((l) => valMap.get(l) ?? 0),
		}));
		return { labels: allLabels, series: series.slice(0, MAX_SERIES), valueColumn: valueCol };
	}

	static extractMultiColumnData(result: AnalyticsResult, valueColumns: string[]): MultiSeriesChartData | null {
		if (valueColumns.length < 2 || result.rows.length === 0) return null;
		const firstRow = result.rows[0];
		const labelCol = result.columns.find((c) => typeof firstRow[c] !== "number");
		const pairs: Array<{ label: string; values: number[] }> = [];
		for (const row of result.rows) {
			const label = labelCol ? String(row[labelCol] ?? "") : String(pairs.length + 1);
			pairs.push({ label, values: valueColumns.map((col) => { const v = row[col]; return typeof v === "number" ? v : 0; }) });
		}
		if (pairs.length > 1 && ChartRenderer.looksLikeDateBuckets(pairs.map((p) => p.label))) {
			pairs.sort((a, b) => a.label.localeCompare(b.label));
		}
		return {
			labels: pairs.map((p) => p.label),
			series: valueColumns.map((col, ci) => ({ name: col, values: pairs.map((p) => p.values[ci]) })),
			valueColumn: valueColumns[0],
		};
	}

	private static looksLikeDateBuckets(labels: string[]): boolean {
		const sample = labels.slice(0, 5);
		return sample.every((l) => /^\d{4}$/.test(l) || /^\d{4}-\d{2}$/.test(l) || /^\d{4}-Q[1-4]$/.test(l));
	}

	static renderLineChart(container: HTMLElement, result: AnalyticsResult, valueColumn?: string, opts?: ChartOptions): void {
		if (opts?.valueColumns && opts.valueColumns.length > 1) {
			const d = ChartRenderer.extractMultiColumnData(result, opts.valueColumns);
			if (d) { renderMultiSeriesLine(container, d, opts.hiddenSeries, opts.onToggleSeries); return; }
		}
		const multiData = ChartRenderer.extractMultiSeriesData(result, valueColumn);
		if (multiData && multiData.series.length > 1) { renderMultiSeriesLine(container, multiData, opts?.hiddenSeries, opts?.onToggleSeries); return; }
		const data = ChartRenderer.extractChartData(result, valueColumn);
		if (data.values.length === 0) { container.createDiv({ text: "No data", cls: "ft-text-muted ft-text-sm ft-text-center" }); return; }
		const svg = buildSvg(container);
		const { yMin, yMax, yRange } = computeYRange(data.values);
		const sym = ChartRenderer.getColumnSymbol(result, valueColumn ?? result.columns.find((c) => typeof result.rows[0]?.[c] === "number"));
		drawYAxis(svg, yMin, yMax, sym);
		drawXAxis(svg, data.labels);
		const points = ChartRenderer.computePoints(data.values, yMin, yRange);
		if (points.length > 1) {
			const pathData = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
			const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
			path.setAttribute("d", pathData); path.setAttribute("fill", "none"); path.setAttribute("stroke", "var(--interactive-accent)"); path.setAttribute("stroke-width", "2");
			svg.appendChild(path);
		}
		ChartRenderer.drawDots(svg, points);
	}

	static renderBarChart(container: HTMLElement, result: AnalyticsResult, valueColumn?: string, opts?: ChartOptions): void {
		if (opts?.valueColumns && opts.valueColumns.length > 1) {
			const d = ChartRenderer.extractMultiColumnData(result, opts.valueColumns);
			if (d) { renderMultiSeriesBar(container, d, opts.hiddenSeries, opts.onToggleSeries); return; }
		}
		const multiData = ChartRenderer.extractMultiSeriesData(result, valueColumn);
		if (multiData && multiData.series.length > 1) { renderMultiSeriesBar(container, multiData, opts?.hiddenSeries, opts?.onToggleSeries); return; }
		const data = ChartRenderer.extractChartData(result, valueColumn);
		if (data.values.length === 0) { container.createDiv({ text: "No data", cls: "ft-text-muted ft-text-sm ft-text-center" }); return; }
		const svg = buildSvg(container);
		const { yMin, yMax, yRange } = computeYRange(data.values);
		const effectiveCol = valueColumn ?? result.columns.find((c) => typeof result.rows[0]?.[c] === "number");
		const sym = ChartRenderer.getColumnSymbol(result, effectiveCol);
		drawYAxis(svg, yMin, yMax, sym);
		drawXAxis(svg, data.labels);
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
			rect.setAttribute("x", x.toFixed(1)); rect.setAttribute("y", y.toFixed(1));
			rect.setAttribute("width", barWidth.toFixed(1)); rect.setAttribute("height", Math.max(barHeight, 1).toFixed(1));
			rect.setAttribute("fill", "var(--interactive-accent)"); rect.setAttribute("rx", "2");
			svg.appendChild(rect);
			const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
			label.setAttribute("x", (x + barWidth / 2).toFixed(1)); label.setAttribute("y", (y - 4).toFixed(1));
			label.setAttribute("text-anchor", "middle"); label.setAttribute("fill", "var(--text-muted)"); label.setAttribute("font-size", "10");
			label.textContent = formatValue(v, sym);
			svg.appendChild(label);
		}
	}

	static renderAreaChart(container: HTMLElement, result: AnalyticsResult, valueColumn?: string, opts?: ChartOptions): void {
		if (opts?.valueColumns && opts.valueColumns.length > 1) {
			const d = ChartRenderer.extractMultiColumnData(result, opts.valueColumns);
			if (d) { renderMultiSeriesArea(container, d, opts.hiddenSeries, opts.onToggleSeries); return; }
		}
		const multiData = ChartRenderer.extractMultiSeriesData(result, valueColumn);
		if (multiData && multiData.series.length > 1) { renderMultiSeriesArea(container, multiData, opts?.hiddenSeries, opts?.onToggleSeries); return; }
		const data = ChartRenderer.extractChartData(result, valueColumn);
		if (data.values.length === 0) { container.createDiv({ text: "No data", cls: "ft-text-muted ft-text-sm ft-text-center" }); return; }
		const svg = buildSvg(container);
		const { yMin, yMax, yRange } = computeYRange(data.values);
		const sym = ChartRenderer.getColumnSymbol(result, valueColumn ?? result.columns.find((c) => typeof result.rows[0]?.[c] === "number"));
		drawYAxis(svg, yMin, yMax, sym);
		drawXAxis(svg, data.labels);
		const points = ChartRenderer.computePoints(data.values, yMin, yRange);
		const baseline = PADDING.top + PLOT_H;
		if (points.length > 1) {
			const areaPath = [`M ${points[0].x.toFixed(1)} ${baseline}`, ...points.map((p) => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`), `L ${points[points.length - 1].x.toFixed(1)} ${baseline}`, "Z"].join(" ");
			const area = document.createElementNS("http://www.w3.org/2000/svg", "path");
			area.setAttribute("d", areaPath); area.setAttribute("fill", "var(--interactive-accent)"); area.setAttribute("opacity", "0.15");
			svg.appendChild(area);
			const lineData = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
			const line = document.createElementNS("http://www.w3.org/2000/svg", "path");
			line.setAttribute("d", lineData); line.setAttribute("fill", "none"); line.setAttribute("stroke", "var(--interactive-accent)"); line.setAttribute("stroke-width", "2");
			svg.appendChild(line);
		}
		ChartRenderer.drawDots(svg, points);
	}

	static renderSparkline(container: HTMLElement, values: number[]): boolean {
		if (values.length < 3) return false;
		const W = 80; const H = 24; const PAD = 2;
		const plotW = W - PAD * 2; const plotH = H - PAD * 2;
		const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
		svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
		svg.classList.add("ft-chart-sparkline-svg");
		const min = Math.min(...values); const max = Math.max(...values); const range = max - min;
		const pts = values.map((v, i) => {
			const x = PAD + (i / (values.length - 1)) * plotW;
			const y = range === 0 ? PAD + plotH / 2 : PAD + plotH - ((v - min) / range) * plotH;
			return `${x.toFixed(1)},${y.toFixed(1)}`;
		});
		const polyline = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
		polyline.setAttribute("points", pts.join(" ")); polyline.setAttribute("fill", "none");
		polyline.setAttribute("stroke", "var(--interactive-accent)"); polyline.setAttribute("stroke-width", "1.5");
		svg.appendChild(polyline);
		container.appendChild(svg);
		return true;
	}

	static renderPieChart(container: HTMLElement, result: AnalyticsResult, valueColumn?: string): void {
		const data = extractPieData(result, valueColumn);
		if (data.length === 0) { container.createDiv({ text: "No data", cls: "ft-text-muted ft-text-sm ft-text-center" }); return; }
		const SIZE = 200; const CX = SIZE / 2; const CY = SIZE / 2; const RADIUS = 80;
		const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
		svg.setAttribute("viewBox", `0 0 ${SIZE} ${SIZE}`); svg.setAttribute("width", "100%");
		svg.style.maxWidth = `${SIZE}px`; svg.classList.add("ft-chart-pie-svg");
		const total = data.reduce((s, d) => s + d.value, 0);
		if (total <= 0) { container.createDiv({ text: "No positive values", cls: "ft-text-muted ft-text-sm ft-text-center" }); return; }
		let cumAngle = -Math.PI / 2;
		for (let i = 0; i < data.length; i++) {
			const slice = data[i]; const sliceAngle = (slice.value / total) * 2 * Math.PI;
			const color = SERIES_COLORS[i % SERIES_COLORS.length];
			if (data.length === 1) {
				const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
				circle.setAttribute("cx", String(CX)); circle.setAttribute("cy", String(CY)); circle.setAttribute("r", String(RADIUS)); circle.setAttribute("fill", color);
				svg.appendChild(circle);
			} else {
				const x1 = CX + RADIUS * Math.cos(cumAngle); const y1 = CY + RADIUS * Math.sin(cumAngle);
				const x2 = CX + RADIUS * Math.cos(cumAngle + sliceAngle); const y2 = CY + RADIUS * Math.sin(cumAngle + sliceAngle);
				const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
				path.setAttribute("d", `M ${CX} ${CY} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${RADIUS} ${RADIUS} 0 ${sliceAngle > Math.PI ? 1 : 0} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`);
				path.setAttribute("fill", color); path.setAttribute("stroke", "var(--background-primary)"); path.setAttribute("stroke-width", "1");
				svg.appendChild(path);
			}
			cumAngle += sliceAngle;
		}
		container.appendChild(svg);
		const legend = container.createDiv({ cls: "ft-pie-legend ft-chart-pie-legend" });
		for (let i = 0; i < data.length; i++) {
			const item = legend.createDiv({ cls: "ft-flex ft-items-center ft-gap-1" });
			const swatch = item.createSpan({ cls: "ft-chart-pie-swatch" });
			swatch.style.background = SERIES_COLORS[i % SERIES_COLORS.length];
			const pct = total > 0 ? ((data[i].value / total) * 100).toFixed(1) : "0.0";
			item.createSpan({ text: `${data[i].label}: ${pct}%`, cls: "ft-text-xs" });
		}
	}

	// ── Private helpers ─────────────────────────────────────

	private static computePoints(values: number[], yMin: number, yRange: number): Array<{ x: number; y: number }> {
		return values.map((v, i) => ({
			x: PADDING.left + (values.length === 1 ? PLOT_W / 2 : (i / (values.length - 1)) * PLOT_W),
			y: yRange === 0 ? PADDING.top + PLOT_H / 2 : PADDING.top + PLOT_H - ((v - yMin) / yRange) * PLOT_H,
		}));
	}

	private static drawDots(svg: SVGSVGElement, points: Array<{ x: number; y: number }>): void {
		for (const p of points) {
			const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
			circle.setAttribute("cx", p.x.toFixed(1)); circle.setAttribute("cy", p.y.toFixed(1));
			circle.setAttribute("r", String(DOT_RADIUS)); circle.setAttribute("fill", "var(--interactive-accent)");
			svg.appendChild(circle);
		}
	}

	private static getColumnSymbol(result: AnalyticsResult, valueColumn?: string): string | undefined {
		if (!result.columnTypeHints || !valueColumn) return undefined;
		return result.columnTypeHints.find((h) => h.column === valueColumn)?.currencySymbol;
	}
}

// ── Pie Data Extraction (pure, testable) ─────────────────

const PIE_MIN_PERCENT = 3;
const PIE_MAX_SEGMENTS = 12;

export interface PieSegment { label: string; value: number; }

export function extractPieData(result: AnalyticsResult, valueColumn?: string): PieSegment[] {
	if (result.rows.length === 0) return [];
	const firstRow = result.rows[0];
	const labelCol = result.columns.find((c) => typeof firstRow[c] !== "number");
	const valueCol = valueColumn ?? result.columns.find((c) => typeof firstRow[c] === "number");
	if (!valueCol) return [];
	const raw: PieSegment[] = [];
	for (const row of result.rows) {
		const val = row[valueCol];
		if (typeof val === "number" && val > 0) {
			raw.push({ label: labelCol ? String(row[labelCol] ?? "") : valueCol, value: val });
		}
	}
	if (raw.length === 0) return [];
	raw.sort((a, b) => b.value - a.value);
	const total = raw.reduce((s, d) => s + d.value, 0);
	const threshold = total * (PIE_MIN_PERCENT / 100);
	const significant: PieSegment[] = [];
	let otherValue = 0;
	for (const seg of raw) {
		if (significant.length < PIE_MAX_SEGMENTS && seg.value >= threshold) significant.push(seg);
		else otherValue += seg.value;
	}
	if (otherValue > 0) significant.push({ label: "Other", value: otherValue });
	return significant;
}

// Re-export for consumers that import from ChartRenderer
export { filterVisible, SERIES_COLORS } from "./chartMultiSeries";
