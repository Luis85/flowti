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
const PADDING = { top: 20, right: 10, bottom: 50, left: 32 };
const PLOT_W = CHART_WIDTH - PADDING.left - PADDING.right;
const PLOT_H = CHART_HEIGHT - PADDING.top - PADDING.bottom;
const DOT_RADIUS = 3;
const BAR_GAP_RATIO = 0.2;
const MAX_LABELS = 12;
const MAX_SERIES = 8;

const SERIES_COLORS = [
	"var(--interactive-accent)",
	"#10b981",
	"#ef4444",
	"#f59e0b",
	"#8b5cf6",
	"#06b6d4",
	"#f97316",
	"#ec4899",
];

export interface ChartData {
	labels: string[];
	values: number[];
}

export interface MultiSeriesChartData {
	labels: string[];
	series: Array<{ name: string; values: number[] }>;
	valueColumn: string;
}

/** Options for multi-series chart rendering. */
export interface ChartOptions {
	/** Multiple numeric columns to render as separate series. */
	valueColumns?: string[];
	/** Series names to hide from the chart. */
	hiddenSeries?: string[];
	/** Called when user toggles a series on/off via the legend. */
	onToggleSeries?: (seriesName: string) => void;
}

export class ChartRenderer {

	/**
	 * Extract chart data from an analytics result.
	 * Uses the first non-numeric column as labels (x-axis)
	 * and the first numeric column as values (y-axis).
	 * Sorts by label when values look like date buckets (YYYY, YYYY-MM, YYYY-QN).
	 */
	static extractChartData(result: AnalyticsResult, valueColumn?: string): ChartData {
		if (result.rows.length === 0) return { labels: [], values: [] };

		const firstRow = result.rows[0];
		const labelCol = result.columns.find((c) => typeof firstRow[c] !== "number");
		const valueCol = valueColumn ?? result.columns.find((c) => typeof firstRow[c] === "number");

		if (!valueCol) return { labels: [], values: [] };

		// Build paired data so we can sort together
		const pairs: Array<{ label: string; value: number }> = [];
		for (const row of result.rows) {
			const label = labelCol ? String(row[labelCol] ?? "") : String(pairs.length + 1);
			const val = row[valueCol];
			pairs.push({ label, value: typeof val === "number" ? val : 0 });
		}

		// Sort chronologically when labels look like date buckets
		if (pairs.length > 1 && ChartRenderer.looksLikeDateBuckets(pairs.map((p) => p.label))) {
			pairs.sort((a, b) => a.label.localeCompare(b.label));
		}

		return {
			labels: pairs.map((p) => p.label),
			values: pairs.map((p) => p.value),
		};
	}

	/**
	 * Extract multi-series chart data when result has a date bucket column + dimension columns.
	 * Time bucket becomes x-axis, each dimension group becomes a separate series.
	 * Returns null when multi-series layout is not applicable.
	 */
	static extractMultiSeriesData(result: AnalyticsResult, valueColumn?: string): MultiSeriesChartData | null {
		if (result.rows.length < 2) return null;

		const firstRow = result.rows[0];
		const numericCols = result.columns.filter((c) => typeof firstRow[c] === "number");
		const nonNumericCols = result.columns.filter((c) => typeof firstRow[c] !== "number");

		// Need at least 1 numeric + 2 non-numeric (1 date bucket + 1 dimension)
		if (numericCols.length === 0 || nonNumericCols.length < 2) return null;

		// Find the date bucket column by checking values
		const dateBucketCol = nonNumericCols.find((col) => {
			const sample = result.rows.slice(0, 10).map((r) => String(r[col] ?? ""));
			return ChartRenderer.looksLikeDateBuckets(sample);
		});

		if (!dateBucketCol) return null;

		const dimCols = nonNumericCols.filter((c) => c !== dateBucketCol);
		if (dimCols.length === 0) return null;

		const valueCol = valueColumn ?? numericCols[0];

		// Group rows by dimension key
		const seriesMap = new Map<string, Map<string, number>>();
		for (const row of result.rows) {
			const seriesKey = dimCols.map((c) => String(row[c] ?? "")).join(" · ");
			const timeLabel = String(row[dateBucketCol] ?? "");
			const val = row[valueCol];

			if (!seriesMap.has(seriesKey)) seriesMap.set(seriesKey, new Map());
			seriesMap.get(seriesKey)!.set(timeLabel, typeof val === "number" ? val : 0);
		}

		// Sorted time labels (chronological — date bucket format is lexicographically sortable)
		const allLabels = [...new Set(result.rows.map((r) => String(r[dateBucketCol] ?? "")))];
		allLabels.sort((a, b) => a.localeCompare(b));

		const series = [...seriesMap.entries()].map(([name, valMap]) => ({
			name,
			values: allLabels.map((l) => valMap.get(l) ?? 0),
		}));

		return { labels: allLabels, series: series.slice(0, MAX_SERIES), valueColumn: valueCol };
	}

	/**
	 * Extract multi-column chart data — each selected column becomes a separate series.
	 * Uses the first non-numeric column as labels (x-axis).
	 * Returns null when fewer than 2 columns are selected.
	 */
	static extractMultiColumnData(result: AnalyticsResult, valueColumns: string[]): MultiSeriesChartData | null {
		if (valueColumns.length < 2 || result.rows.length === 0) return null;

		const firstRow = result.rows[0];
		const labelCol = result.columns.find((c) => typeof firstRow[c] !== "number");

		// Build paired data
		const pairs: Array<{ label: string; values: number[] }> = [];
		for (const row of result.rows) {
			const label = labelCol ? String(row[labelCol] ?? "") : String(pairs.length + 1);
			const values = valueColumns.map((col) => {
				const v = row[col];
				return typeof v === "number" ? v : 0;
			});
			pairs.push({ label, values });
		}

		// Sort chronologically when labels look like date buckets
		if (pairs.length > 1 && ChartRenderer.looksLikeDateBuckets(pairs.map((p) => p.label))) {
			pairs.sort((a, b) => a.label.localeCompare(b.label));
		}

		return {
			labels: pairs.map((p) => p.label),
			series: valueColumns.map((col, ci) => ({
				name: col,
				values: pairs.map((p) => p.values[ci]),
			})),
			valueColumn: valueColumns[0],
		};
	}

	/** Check whether labels look like time bucket output (YYYY, YYYY-MM, YYYY-QN). */
	private static looksLikeDateBuckets(labels: string[]): boolean {
		const sample = labels.slice(0, 5);
		return sample.every((l) =>
			/^\d{4}$/.test(l) ||           // year: "2026"
			/^\d{4}-\d{2}$/.test(l) ||      // month: "2026-02"
			/^\d{4}-Q[1-4]$/.test(l),       // quarter: "2026-Q1"
		);
	}

	/**
	 * Render an SVG line chart into the container.
	 * Auto-detects multi-series when result has time bucket + dimension columns.
	 */
	static renderLineChart(container: HTMLElement, result: AnalyticsResult, valueColumn?: string, opts?: ChartOptions): void {
		// Multi-column selection (user picked multiple numeric columns)
		if (opts?.valueColumns && opts.valueColumns.length > 1) {
			const multiColData = ChartRenderer.extractMultiColumnData(result, opts.valueColumns);
			if (multiColData) { ChartRenderer.renderMultiSeriesLine(container, multiColData, opts.hiddenSeries, opts.onToggleSeries); return; }
		}

		const multiData = ChartRenderer.extractMultiSeriesData(result, valueColumn);
		if (multiData && multiData.series.length > 1) {
			ChartRenderer.renderMultiSeriesLine(container, multiData, opts?.hiddenSeries, opts?.onToggleSeries);
			return;
		}

		const data = ChartRenderer.extractChartData(result, valueColumn);
		if (data.values.length === 0) {
			container.createDiv({ text: "No data", cls: "ft-text-muted ft-text-sm ft-text-center" });
			return;
		}

		const svg = ChartRenderer.buildSvg(container);
		const { yMin, yMax, yRange } = ChartRenderer.computeYRange(data.values);
		const sym = ChartRenderer.getColumnSymbol(result, valueColumn ?? result.columns.find((c) => typeof result.rows[0]?.[c] === "number"));

		// Y-axis labels + grid lines
		ChartRenderer.drawYAxis(svg, yMin, yMax, sym);

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
	 * Auto-detects multi-series when result has time bucket + dimension columns.
	 */
	static renderBarChart(container: HTMLElement, result: AnalyticsResult, valueColumn?: string, opts?: ChartOptions): void {
		// Multi-column selection (user picked multiple numeric columns)
		if (opts?.valueColumns && opts.valueColumns.length > 1) {
			const multiColData = ChartRenderer.extractMultiColumnData(result, opts.valueColumns);
			if (multiColData) { ChartRenderer.renderMultiSeriesBar(container, multiColData, opts.hiddenSeries, opts.onToggleSeries); return; }
		}

		const multiData = ChartRenderer.extractMultiSeriesData(result, valueColumn);
		if (multiData && multiData.series.length > 1) {
			ChartRenderer.renderMultiSeriesBar(container, multiData, opts?.hiddenSeries, opts?.onToggleSeries);
			return;
		}

		const data = ChartRenderer.extractChartData(result, valueColumn);
		if (data.values.length === 0) {
			container.createDiv({ text: "No data", cls: "ft-text-muted ft-text-sm ft-text-center" });
			return;
		}

		const svg = ChartRenderer.buildSvg(container);
		const { yMin, yMax, yRange } = ChartRenderer.computeYRange(data.values);

		const effectiveCol = valueColumn ?? result.columns.find((c) => typeof result.rows[0]?.[c] === "number");
		const sym = ChartRenderer.getColumnSymbol(result, effectiveCol);

		// Y-axis labels + grid lines
		ChartRenderer.drawYAxis(svg, yMin, yMax, sym);

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
			label.textContent = ChartRenderer.formatValue(v, sym);
			svg.appendChild(label);
		}
	}

	/**
	 * Render an SVG area chart into the container.
	 * Filled area below line with semi-transparent color.
	 * Auto-detects multi-series when result has time bucket + dimension columns.
	 */
	static renderAreaChart(container: HTMLElement, result: AnalyticsResult, valueColumn?: string, opts?: ChartOptions): void {
		// Multi-column selection (user picked multiple numeric columns)
		if (opts?.valueColumns && opts.valueColumns.length > 1) {
			const multiColData = ChartRenderer.extractMultiColumnData(result, opts.valueColumns);
			if (multiColData) { ChartRenderer.renderMultiSeriesArea(container, multiColData, opts.hiddenSeries, opts.onToggleSeries); return; }
		}

		const multiData = ChartRenderer.extractMultiSeriesData(result, valueColumn);
		if (multiData && multiData.series.length > 1) {
			ChartRenderer.renderMultiSeriesArea(container, multiData, opts?.hiddenSeries, opts?.onToggleSeries);
			return;
		}

		const data = ChartRenderer.extractChartData(result, valueColumn);
		if (data.values.length === 0) {
			container.createDiv({ text: "No data", cls: "ft-text-muted ft-text-sm ft-text-center" });
			return;
		}

		const svg = ChartRenderer.buildSvg(container);
		const { yMin, yMax, yRange } = ChartRenderer.computeYRange(data.values);
		const sym = ChartRenderer.getColumnSymbol(result, valueColumn ?? result.columns.find((c) => typeof result.rows[0]?.[c] === "number"));

		ChartRenderer.drawYAxis(svg, yMin, yMax, sym);
		ChartRenderer.drawXAxis(svg, data.labels);

		const points = data.values.map((v, i) => ({
			x: PADDING.left + (data.values.length === 1 ? PLOT_W / 2 : (i / (data.values.length - 1)) * PLOT_W),
			y: yRange === 0 ? PADDING.top + PLOT_H / 2 : PADDING.top + PLOT_H - ((v - yMin) / yRange) * PLOT_H,
		}));

		const baseline = PADDING.top + PLOT_H;

		// Filled area
		if (points.length > 1) {
			const areaPath = [
				`M ${points[0].x.toFixed(1)} ${baseline}`,
				...points.map((p) => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`),
				`L ${points[points.length - 1].x.toFixed(1)} ${baseline}`,
				"Z",
			].join(" ");
			const area = document.createElementNS("http://www.w3.org/2000/svg", "path");
			area.setAttribute("d", areaPath);
			area.setAttribute("fill", "var(--interactive-accent)");
			area.setAttribute("opacity", "0.15");
			svg.appendChild(area);

			// Line overlay
			const lineData = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
			const line = document.createElementNS("http://www.w3.org/2000/svg", "path");
			line.setAttribute("d", lineData);
			line.setAttribute("fill", "none");
			line.setAttribute("stroke", "var(--interactive-accent)");
			line.setAttribute("stroke-width", "2");
			svg.appendChild(line);
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
		svg.classList.add("ft-chart-sparkline-svg");

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

	// ── Multi-series rendering ──────────────────────────────

	private static renderMultiSeriesLine(container: HTMLElement, data: MultiSeriesChartData, hiddenSeries?: string[], onToggleSeries?: (name: string) => void): void {
		const visible = ChartRenderer.filterVisible(data.series, hiddenSeries);
		const svg = ChartRenderer.buildSvg(container);
		const allValues = visible.flatMap((s) => s.values);
		const { yMin, yMax, yRange } = ChartRenderer.computeYRange(allValues.length > 0 ? allValues : [0]);

		ChartRenderer.drawYAxis(svg, yMin, yMax);
		ChartRenderer.drawXAxis(svg, data.labels);

		const n = data.labels.length;

		for (const series of visible) {
			const si = data.series.indexOf(series);
			const color = SERIES_COLORS[si % SERIES_COLORS.length];

			const points = series.values.map((v, i) => ({
				x: PADDING.left + (n === 1 ? PLOT_W / 2 : (i / (n - 1)) * PLOT_W),
				y: yRange === 0
					? PADDING.top + PLOT_H / 2
					: PADDING.top + PLOT_H - ((v - yMin) / yRange) * PLOT_H,
			}));

			if (points.length > 1) {
				const pathData = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
				const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
				path.setAttribute("d", pathData);
				path.setAttribute("fill", "none");
				path.setAttribute("stroke", color);
				path.setAttribute("stroke-width", "2");
				svg.appendChild(path);
			}

			for (const p of points) {
				const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
				circle.setAttribute("cx", p.x.toFixed(1));
				circle.setAttribute("cy", p.y.toFixed(1));
				circle.setAttribute("r", String(DOT_RADIUS));
				circle.setAttribute("fill", color);
				svg.appendChild(circle);
			}
		}

		ChartRenderer.drawLegend(container, data.series.map((s, i) => ({
			name: s.name,
			color: SERIES_COLORS[i % SERIES_COLORS.length],
		})), hiddenSeries, onToggleSeries);
	}

	private static renderMultiSeriesBar(container: HTMLElement, data: MultiSeriesChartData, hiddenSeries?: string[], onToggleSeries?: (name: string) => void): void {
		const visible = ChartRenderer.filterVisible(data.series, hiddenSeries);
		const svg = ChartRenderer.buildSvg(container);
		const allValues = visible.flatMap((s) => s.values);
		const { yMin, yMax, yRange } = ChartRenderer.computeYRange(allValues.length > 0 ? allValues : [0]);

		ChartRenderer.drawYAxis(svg, yMin, yMax);
		ChartRenderer.drawXAxis(svg, data.labels);

		const n = data.labels.length;
		const visibleCount = visible.length;
		const totalGroupWidth = PLOT_W / n;
		const groupGap = totalGroupWidth * BAR_GAP_RATIO;
		const usableWidth = totalGroupWidth - groupGap;
		const barWidth = visibleCount > 0 ? usableWidth / visibleCount : usableWidth;
		const baseline = PADDING.top + PLOT_H;

		for (let i = 0; i < n; i++) {
			const groupX = PADDING.left + i * totalGroupWidth + groupGap / 2;

			for (let vi = 0; vi < visible.length; vi++) {
				const series = visible[vi];
				const si = data.series.indexOf(series);
				const v = series.values[i];
				const barHeight = yRange === 0 ? PLOT_H / 2 : ((v - yMin) / yRange) * PLOT_H;
				const x = groupX + vi * barWidth;
				const y = baseline - barHeight;
				const color = SERIES_COLORS[si % SERIES_COLORS.length];

				const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
				rect.setAttribute("x", x.toFixed(1));
				rect.setAttribute("y", y.toFixed(1));
				rect.setAttribute("width", Math.max(barWidth - 1, 1).toFixed(1));
				rect.setAttribute("height", Math.max(barHeight, 1).toFixed(1));
				rect.setAttribute("fill", color);
				rect.setAttribute("rx", "2");
				svg.appendChild(rect);
			}
		}

		ChartRenderer.drawLegend(container, data.series.map((s, i) => ({
			name: s.name,
			color: SERIES_COLORS[i % SERIES_COLORS.length],
		})), hiddenSeries, onToggleSeries);
	}

	private static renderMultiSeriesArea(container: HTMLElement, data: MultiSeriesChartData, hiddenSeries?: string[], onToggleSeries?: (name: string) => void): void {
		const visible = ChartRenderer.filterVisible(data.series, hiddenSeries);
		const svg = ChartRenderer.buildSvg(container);
		const allValues = visible.flatMap((s) => s.values);
		const { yMin, yMax, yRange } = ChartRenderer.computeYRange(allValues.length > 0 ? allValues : [0]);

		ChartRenderer.drawYAxis(svg, yMin, yMax);
		ChartRenderer.drawXAxis(svg, data.labels);

		const n = data.labels.length;
		const baseline = PADDING.top + PLOT_H;

		for (const series of visible) {
			const si = data.series.indexOf(series);
			const color = SERIES_COLORS[si % SERIES_COLORS.length];

			const points = series.values.map((v, i) => ({
				x: PADDING.left + (n === 1 ? PLOT_W / 2 : (i / (n - 1)) * PLOT_W),
				y: yRange === 0
					? PADDING.top + PLOT_H / 2
					: PADDING.top + PLOT_H - ((v - yMin) / yRange) * PLOT_H,
			}));

			if (points.length > 1) {
				const areaPath = [
					`M ${points[0].x.toFixed(1)} ${baseline}`,
					...points.map((p) => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`),
					`L ${points[points.length - 1].x.toFixed(1)} ${baseline}`,
					"Z",
				].join(" ");
				const area = document.createElementNS("http://www.w3.org/2000/svg", "path");
				area.setAttribute("d", areaPath);
				area.setAttribute("fill", color);
				area.setAttribute("opacity", "0.12");
				svg.appendChild(area);

				const lineData = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
				const line = document.createElementNS("http://www.w3.org/2000/svg", "path");
				line.setAttribute("d", lineData);
				line.setAttribute("fill", "none");
				line.setAttribute("stroke", color);
				line.setAttribute("stroke-width", "2");
				svg.appendChild(line);
			}

			for (const p of points) {
				const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
				circle.setAttribute("cx", p.x.toFixed(1));
				circle.setAttribute("cy", p.y.toFixed(1));
				circle.setAttribute("r", String(DOT_RADIUS));
				circle.setAttribute("fill", color);
				svg.appendChild(circle);
			}
		}

		ChartRenderer.drawLegend(container, data.series.map((s, i) => ({
			name: s.name,
			color: SERIES_COLORS[i % SERIES_COLORS.length],
		})), hiddenSeries, onToggleSeries);
	}

	private static drawLegend(
		container: HTMLElement,
		items: Array<{ name: string; color: string }>,
		hiddenSeries?: string[],
		onToggleSeries?: (name: string) => void,
	): void {
		const legend = container.createDiv({ cls: "ft-chart-legend" });

		for (const item of items) {
			const isHidden = hiddenSeries?.includes(item.name) ?? false;

			const entryCls = isHidden
				? "ft-chart-legend-entry ft-chart-legend-hidden"
				: onToggleSeries
					? "ft-chart-legend-entry ft-cursor-pointer"
					: "ft-chart-legend-entry";
			const entry = legend.createDiv({ cls: entryCls });

			const dot = entry.createSpan({ cls: "ft-chart-legend-dot" });
			dot.style.backgroundColor = item.color;

			const labelCls = isHidden ? "ft-text-muted ft-chart-legend-hidden-text" : "ft-text-muted";
			entry.createSpan({ text: item.name, cls: labelCls });

			if (onToggleSeries) {
				entry.addEventListener("click", () => onToggleSeries(item.name));
			}
		}
	}

	/** Filter series to only visible ones (not in hiddenSeries list). */
	private static filterVisible(
		series: Array<{ name: string; values: number[] }>,
		hiddenSeries?: string[],
	): Array<{ name: string; values: number[] }> {
		if (!hiddenSeries || hiddenSeries.length === 0) return series;
		return series.filter((s) => !hiddenSeries.includes(s.name));
	}

	// ── Private helpers ─────────────────────────────────────

	private static buildSvg(container: HTMLElement): SVGSVGElement {
		const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
		svg.setAttribute("viewBox", `0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`);
		svg.classList.add("ft-chart-svg");
		container.appendChild(svg);
		return svg;
	}

	private static computeYRange(values: number[]): { yMin: number; yMax: number; yRange: number } {
		const rawMin = Math.min(...values);
		const yMin = Math.min(0, rawMin); // Always include 0 in range
		const yMax = Math.max(...values);
		const yRange = yMax - yMin;
		return { yMin, yMax, yRange };
	}

	private static drawYAxis(svg: SVGSVGElement, yMin: number, yMax: number, currencySymbol?: string): void {
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
			label.textContent = ChartRenderer.formatValue(val, currencySymbol);
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

	private static formatValue(v: number, currencySymbol?: string): string {
		const prefix = currencySymbol ?? "";
		if (Math.abs(v) >= 1_000_000) return prefix + (v / 1_000_000).toFixed(1) + "M";
		if (Math.abs(v) >= 1_000) return prefix + (v / 1_000).toFixed(1) + "K";
		return prefix + (Number.isInteger(v) ? String(v) : v.toFixed(1));
	}

	/** Extract detected currency symbol for a value column from result hints. */
	private static getColumnSymbol(result: AnalyticsResult, valueColumn?: string): string | undefined {
		if (!result.columnTypeHints || !valueColumn) return undefined;
		return result.columnTypeHints.find((h) => h.column === valueColumn)?.currencySymbol;
	}

	// ── Pie Chart ────────────────────────────────────────────

	/**
	 * Render a pie chart from analytics result.
	 * Segments sized proportionally by the value column (first numeric if not specified).
	 * Segments below 3% grouped into "Other". Maximum 12 segments.
	 */
	static renderPieChart(container: HTMLElement, result: AnalyticsResult, valueColumn?: string): void {
		const data = extractPieData(result, valueColumn);
		if (data.length === 0) {
			container.createDiv({ text: "No data", cls: "ft-text-muted ft-text-sm ft-text-center" });
			return;
		}

		const SIZE = 200;
		const CX = SIZE / 2;
		const CY = SIZE / 2;
		const RADIUS = 80;

		const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
		svg.setAttribute("viewBox", `0 0 ${SIZE} ${SIZE}`);
		svg.setAttribute("width", "100%");
		svg.style.maxWidth = `${SIZE}px`;
		svg.classList.add("ft-chart-pie-svg");

		const total = data.reduce((s, d) => s + d.value, 0);
		if (total <= 0) {
			container.createDiv({ text: "No positive values", cls: "ft-text-muted ft-text-sm ft-text-center" });
			return;
		}

		let cumAngle = -Math.PI / 2; // Start at top

		for (let i = 0; i < data.length; i++) {
			const slice = data[i];
			const sliceAngle = (slice.value / total) * 2 * Math.PI;
			const color = SERIES_COLORS[i % SERIES_COLORS.length];

			if (data.length === 1) {
				// Full circle
				const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
				circle.setAttribute("cx", String(CX));
				circle.setAttribute("cy", String(CY));
				circle.setAttribute("r", String(RADIUS));
				circle.setAttribute("fill", color);
				svg.appendChild(circle);
			} else {
				const x1 = CX + RADIUS * Math.cos(cumAngle);
				const y1 = CY + RADIUS * Math.sin(cumAngle);
				const x2 = CX + RADIUS * Math.cos(cumAngle + sliceAngle);
				const y2 = CY + RADIUS * Math.sin(cumAngle + sliceAngle);
				const largeArc = sliceAngle > Math.PI ? 1 : 0;

				const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
				path.setAttribute("d", `M ${CX} ${CY} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${RADIUS} ${RADIUS} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`);
				path.setAttribute("fill", color);
				path.setAttribute("stroke", "var(--background-primary)");
				path.setAttribute("stroke-width", "1");
				svg.appendChild(path);
			}

			cumAngle += sliceAngle;
		}

		container.appendChild(svg);

		// Legend
		const legend = container.createDiv({ cls: "ft-pie-legend ft-chart-pie-legend" });

		for (let i = 0; i < data.length; i++) {
			const item = legend.createDiv({ cls: "ft-flex ft-items-center ft-gap-1" });

			const swatch = item.createSpan({ cls: "ft-chart-pie-swatch" });
			swatch.style.background = SERIES_COLORS[i % SERIES_COLORS.length];

			const pct = total > 0 ? ((data[i].value / total) * 100).toFixed(1) : "0.0";
			item.createSpan({ text: `${data[i].label}: ${pct}%`, cls: "ft-text-xs" });
		}
	}
}

// ── Pie Data Extraction (pure, testable) ─────────────────

const PIE_MIN_PERCENT = 3;
const PIE_MAX_SEGMENTS = 12;

export interface PieSegment {
	label: string;
	value: number;
}

/**
 * Extract pie chart segments from an analytics result.
 * Groups segments below 3% and beyond 12 segments into "Other".
 */
export function extractPieData(result: AnalyticsResult, valueColumn?: string): PieSegment[] {
	if (result.rows.length === 0) return [];

	const firstRow = result.rows[0];
	const labelCol = result.columns.find((c) => typeof firstRow[c] !== "number");
	const valueCol = valueColumn ?? result.columns.find((c) => typeof firstRow[c] === "number");
	if (!valueCol) return [];

	// Build raw segments (only positive values)
	const raw: PieSegment[] = [];
	for (const row of result.rows) {
		const val = row[valueCol];
		if (typeof val === "number" && val > 0) {
			raw.push({ label: labelCol ? String(row[labelCol] ?? "") : valueCol, value: val });
		}
	}
	if (raw.length === 0) return [];

	// Sort descending by value
	raw.sort((a, b) => b.value - a.value);

	const total = raw.reduce((s, d) => s + d.value, 0);
	const threshold = total * (PIE_MIN_PERCENT / 100);

	// Split into significant and small segments
	const significant: PieSegment[] = [];
	let otherValue = 0;

	for (const seg of raw) {
		if (significant.length < PIE_MAX_SEGMENTS && seg.value >= threshold) {
			significant.push(seg);
		} else {
			otherValue += seg.value;
		}
	}

	if (otherValue > 0) {
		significant.push({ label: "Other", value: otherValue });
	}

	return significant;
}
