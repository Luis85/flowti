/**
 * Multi-series chart rendering extracted from ChartRenderer.
 *
 * Handles line, bar, and area charts with multiple data series,
 * plus the interactive legend.
 */

const CHART_WIDTH = 400;
const CHART_HEIGHT = 225;
const PADDING = { top: 20, right: 10, bottom: 50, left: 32 };
const PLOT_W = CHART_WIDTH - PADDING.left - PADDING.right;
const PLOT_H = CHART_HEIGHT - PADDING.top - PADDING.bottom;
const DOT_RADIUS = 3;
const BAR_GAP_RATIO = 0.2;

import type { MultiSeriesChartData } from "./ChartRenderer";

export const SERIES_COLORS = [
	"var(--interactive-accent)",
	"#10b981",
	"#ef4444",
	"#f59e0b",
	"#8b5cf6",
	"#06b6d4",
	"#f97316",
	"#ec4899",
];

export function buildSvg(container: HTMLElement): SVGSVGElement {
	const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
	svg.setAttribute("viewBox", `0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`);
	svg.classList.add("ft-chart-svg");
	container.appendChild(svg);
	return svg;
}

export function computeYRange(values: number[]): { yMin: number; yMax: number; yRange: number } {
	const rawMin = Math.min(...values);
	const yMin = Math.min(0, rawMin);
	const yMax = Math.max(...values);
	return { yMin, yMax, yRange: yMax - yMin };
}

export function drawYAxis(svg: SVGSVGElement, yMin: number, yMax: number, currencySymbol?: string): void {
	const yRange = yMax - yMin;
	const ticks = 5;
	for (let i = 0; i <= ticks; i++) {
		const ratio = i / ticks;
		const y = PADDING.top + PLOT_H - ratio * PLOT_H;
		const val = yRange === 0 ? yMin : yMin + ratio * yRange;
		const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
		line.setAttribute("x1", String(PADDING.left));
		line.setAttribute("x2", String(PADDING.left + PLOT_W));
		line.setAttribute("y1", y.toFixed(1));
		line.setAttribute("y2", y.toFixed(1));
		line.setAttribute("stroke", "var(--background-modifier-border)");
		line.setAttribute("stroke-width", "0.5");
		svg.appendChild(line);
		const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
		label.setAttribute("x", String(PADDING.left - 8));
		label.setAttribute("y", (y + 3).toFixed(1));
		label.setAttribute("text-anchor", "end");
		label.setAttribute("fill", "var(--text-muted)");
		label.setAttribute("font-size", "10");
		label.textContent = formatValue(val, currencySymbol);
		svg.appendChild(label);
	}
}

const MAX_LABELS = 12;

export function drawXAxis(svg: SVGSVGElement, labels: string[]): void {
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

export function formatValue(v: number, currencySymbol?: string): string {
	const prefix = currencySymbol ?? "";
	if (Math.abs(v) >= 1_000_000) return prefix + (v / 1_000_000).toFixed(1) + "M";
	if (Math.abs(v) >= 1_000) return prefix + (v / 1_000).toFixed(1) + "K";
	return prefix + (Number.isInteger(v) ? String(v) : v.toFixed(1));
}

export function filterVisible(
	series: Array<{ name: string; values: number[] }>,
	hiddenSeries?: string[],
): Array<{ name: string; values: number[] }> {
	if (!hiddenSeries || hiddenSeries.length === 0) return series;
	return series.filter((s) => !hiddenSeries.includes(s.name));
}

function toPoint(n: number, values: number[], yMin: number, yRange: number, i: number): { x: number; y: number } {
	return {
		x: PADDING.left + (n === 1 ? PLOT_W / 2 : (i / (n - 1)) * PLOT_W),
		y: yRange === 0 ? PADDING.top + PLOT_H / 2 : PADDING.top + PLOT_H - ((values[i] - yMin) / yRange) * PLOT_H,
	};
}

export function renderMultiSeriesLine(container: HTMLElement, data: MultiSeriesChartData, hiddenSeries?: string[], onToggleSeries?: (name: string) => void): void {
	const visible = filterVisible(data.series, hiddenSeries);
	const svg = buildSvg(container);
	const allValues = visible.flatMap((s) => s.values);
	const { yMin, yRange } = computeYRange(allValues.length > 0 ? allValues : [0]);
	drawYAxis(svg, yMin, Math.max(...(allValues.length > 0 ? allValues : [0])));
	drawXAxis(svg, data.labels);
	const n = data.labels.length;
	for (const series of visible) {
		const si = data.series.indexOf(series);
		const color = SERIES_COLORS[si % SERIES_COLORS.length];
		const points = series.values.map((_, i) => toPoint(n, series.values, yMin, yRange, i));
		if (points.length > 1) {
			const pathData = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
			const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
			path.setAttribute("d", pathData); path.setAttribute("fill", "none"); path.setAttribute("stroke", color); path.setAttribute("stroke-width", "2");
			svg.appendChild(path);
		}
		for (const p of points) {
			const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
			circle.setAttribute("cx", p.x.toFixed(1)); circle.setAttribute("cy", p.y.toFixed(1)); circle.setAttribute("r", String(DOT_RADIUS)); circle.setAttribute("fill", color);
			svg.appendChild(circle);
		}
	}
	drawLegend(container, data.series.map((s, i) => ({ name: s.name, color: SERIES_COLORS[i % SERIES_COLORS.length] })), hiddenSeries, onToggleSeries);
}

export function renderMultiSeriesBar(container: HTMLElement, data: MultiSeriesChartData, hiddenSeries?: string[], onToggleSeries?: (name: string) => void): void {
	const visible = filterVisible(data.series, hiddenSeries);
	const svg = buildSvg(container);
	const allValues = visible.flatMap((s) => s.values);
	const { yMin, yMax, yRange } = computeYRange(allValues.length > 0 ? allValues : [0]);
	drawYAxis(svg, yMin, yMax);
	drawXAxis(svg, data.labels);
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
			rect.setAttribute("x", x.toFixed(1)); rect.setAttribute("y", y.toFixed(1));
			rect.setAttribute("width", Math.max(barWidth - 1, 1).toFixed(1)); rect.setAttribute("height", Math.max(barHeight, 1).toFixed(1));
			rect.setAttribute("fill", color); rect.setAttribute("rx", "2");
			svg.appendChild(rect);
		}
	}
	drawLegend(container, data.series.map((s, i) => ({ name: s.name, color: SERIES_COLORS[i % SERIES_COLORS.length] })), hiddenSeries, onToggleSeries);
}

export function renderMultiSeriesArea(container: HTMLElement, data: MultiSeriesChartData, hiddenSeries?: string[], onToggleSeries?: (name: string) => void): void {
	const visible = filterVisible(data.series, hiddenSeries);
	const svg = buildSvg(container);
	const allValues = visible.flatMap((s) => s.values);
	const { yMin, yMax, yRange } = computeYRange(allValues.length > 0 ? allValues : [0]);
	drawYAxis(svg, yMin, yMax);
	drawXAxis(svg, data.labels);
	const n = data.labels.length;
	const baseline = PADDING.top + PLOT_H;
	for (const series of visible) {
		const si = data.series.indexOf(series);
		const color = SERIES_COLORS[si % SERIES_COLORS.length];
		const points = series.values.map((_, i) => toPoint(n, series.values, yMin, yRange, i));
		if (points.length > 1) {
			const areaPath = [`M ${points[0].x.toFixed(1)} ${baseline}`, ...points.map((p) => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`), `L ${points[points.length - 1].x.toFixed(1)} ${baseline}`, "Z"].join(" ");
			const area = document.createElementNS("http://www.w3.org/2000/svg", "path");
			area.setAttribute("d", areaPath); area.setAttribute("fill", color); area.setAttribute("opacity", "0.12");
			svg.appendChild(area);
			const lineData = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
			const line = document.createElementNS("http://www.w3.org/2000/svg", "path");
			line.setAttribute("d", lineData); line.setAttribute("fill", "none"); line.setAttribute("stroke", color); line.setAttribute("stroke-width", "2");
			svg.appendChild(line);
		}
		for (const p of points) {
			const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
			circle.setAttribute("cx", p.x.toFixed(1)); circle.setAttribute("cy", p.y.toFixed(1)); circle.setAttribute("r", String(DOT_RADIUS)); circle.setAttribute("fill", color);
			svg.appendChild(circle);
		}
	}
	drawLegend(container, data.series.map((s, i) => ({ name: s.name, color: SERIES_COLORS[i % SERIES_COLORS.length] })), hiddenSeries, onToggleSeries);
}

export function drawLegend(
	container: HTMLElement,
	items: Array<{ name: string; color: string }>,
	hiddenSeries?: string[],
	onToggleSeries?: (name: string) => void,
): void {
	const legend = container.createDiv({ cls: "ft-chart-legend" });
	for (const item of items) {
		const isHidden = hiddenSeries?.includes(item.name) ?? false;
		const entryCls = isHidden ? "ft-chart-legend-entry ft-chart-legend-hidden" : onToggleSeries ? "ft-chart-legend-entry ft-cursor-pointer" : "ft-chart-legend-entry";
		const entry = legend.createDiv({ cls: entryCls });
		const dot = entry.createSpan({ cls: "ft-chart-legend-dot" });
		dot.style.backgroundColor = item.color;
		const labelCls = isHidden ? "ft-text-muted ft-chart-legend-hidden-text" : "ft-text-muted";
		entry.createSpan({ text: item.name, cls: labelCls });
		if (onToggleSeries) entry.addEventListener("click", () => onToggleSeries(item.name));
	}
}
