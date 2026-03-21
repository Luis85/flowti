import { html } from 'lit';
import type { FlowtiChartConfig } from './flowti-chart.js';

// ── Layout constants ────────────────────────────────────
export const PADDING = { top: 24, right: 16, bottom: 40, left: 48 };
export const DOT_RADIUS = 3;
export const BAR_GAP_RATIO = 0.2;
export const MAX_LABELS = 12;
export const PIE_MIN_PERCENT = 3;
export const PIE_MAX_SEGMENTS = 12;
export const Y_TICKS = 5;

export const SERIES_COLORS = [
	'#6366f1', // indigo
	'#10b981', // emerald
	'#ef4444', // red
	'#f59e0b', // amber
	'#8b5cf6', // violet
	'#06b6d4', // cyan
	'#f97316', // orange
	'#ec4899', // pink
];

export interface ChartDataColumn {
	label: string;
	values: number[];
}

export interface ChartSeriesData {
	labels: string[];
	series: ChartDataColumn[];
}

export interface PieSegment {
	label: string;
	value: number;
	color: string;
}

export function formatValue(v: number): string {
	if (Math.abs(v) >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'M';
	if (Math.abs(v) >= 1_000) return (v / 1_000).toFixed(1) + 'K';
	return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

export function roundRect(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	w: number,
	h: number,
	r: number,
): void {
	r = Math.min(r, w / 2, h / 2);
	ctx.beginPath();
	ctx.moveTo(x + r, y);
	ctx.lineTo(x + w - r, y);
	ctx.quadraticCurveTo(x + w, y, x + w, y + r);
	ctx.lineTo(x + w, y + h - r);
	ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
	ctx.lineTo(x + r, y + h);
	ctx.quadraticCurveTo(x, y + h, x, y + h - r);
	ctx.lineTo(x, y + r);
	ctx.quadraticCurveTo(x, y, x + r, y);
	ctx.closePath();
}

export function computeYRange(allValues: number[]): { yMin: number; yMax: number; yRange: number } {
	const rawMin = Math.min(...allValues);
	const yMin = Math.min(0, rawMin);
	const yMax = Math.max(...allValues);
	const yRange = yMax - yMin || 1;
	return { yMin, yMax, yRange };
}

export function drawGrid(
	ctx: CanvasRenderingContext2D,
	width: number,
	height: number,
	yMin: number,
	yMax: number,
	resolveColor: (cssVar: string, fallback: string) => string,
): void {
	const plotLeft = PADDING.left;
	const plotRight = width - PADDING.right;
	const plotTop = PADDING.top;
	const plotBottom = height - PADDING.bottom;
	const yRange = yMax - yMin || 1;

	ctx.save();
	ctx.strokeStyle = resolveColor('--background-modifier-border', '#e5e7eb');
	ctx.lineWidth = 0.5;
	ctx.fillStyle = resolveColor('--text-muted', '#9ca3af');
	ctx.font = '10px system-ui, sans-serif';
	ctx.textAlign = 'right';
	ctx.textBaseline = 'middle';

	for (let i = 0; i <= Y_TICKS; i++) {
		const ratio = i / Y_TICKS;
		const y = plotBottom - ratio * (plotBottom - plotTop);
		const val = yMin + ratio * yRange;

		ctx.beginPath();
		ctx.moveTo(plotLeft, y);
		ctx.lineTo(plotRight, y);
		ctx.stroke();

		ctx.fillText(formatValue(val), plotLeft - 6, y);
	}
	ctx.restore();
}

export function drawXLabels(
	ctx: CanvasRenderingContext2D,
	width: number,
	height: number,
	labels: string[],
	resolveColor: (cssVar: string, fallback: string) => string,
): void {
	const plotLeft = PADDING.left;
	const plotRight = width - PADDING.right;
	const plotW = plotRight - plotLeft;
	const plotBottom = height - PADDING.bottom;
	const n = labels.length;
	const step = n <= MAX_LABELS ? 1 : Math.ceil(n / MAX_LABELS);

	ctx.save();
	ctx.fillStyle = resolveColor('--text-muted', '#9ca3af');
	ctx.font = '10px system-ui, sans-serif';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'top';

	for (let i = 0; i < n; i += step) {
		const x = n === 1
			? plotLeft + plotW / 2
			: plotLeft + (i / (n - 1)) * plotW;
		const text = labels[i].length > 10 ? labels[i].slice(0, 9) + '\u2026' : labels[i];
		ctx.fillText(text, x, plotBottom + 6);
	}
	ctx.restore();
}

export function extractPieSegments(data: ChartSeriesData, config: FlowtiChartConfig): PieSegment[] {
	if (!data.series || data.series.length === 0) return [];

	const values = data.series[0].values;
	const colors = config.colors ?? SERIES_COLORS;

	const raw: PieSegment[] = [];
	for (let i = 0; i < data.labels.length; i++) {
		const v = values[i];
		if (v > 0) {
			raw.push({
				label: data.labels[i],
				value: v,
				color: colors[i % colors.length],
			});
		}
	}
	if (raw.length === 0) return [];

	raw.sort((a, b) => b.value - a.value);

	const total = raw.reduce((s, d) => s + d.value, 0);
	const threshold = total * (PIE_MIN_PERCENT / 100);

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
		significant.push({
			label: 'Other',
			value: otherValue,
			color: colors[significant.length % colors.length],
		});
	}

	return significant;
}

export function renderLegend(
	chartType: string,
	data: ChartSeriesData,
	config: FlowtiChartConfig,
) {
	if (chartType === 'pie') {
		const segments = extractPieSegments(data, config);
		return html`
			<div class="chart-legend">
				${segments.map((seg) => html`
					<span class="legend-item">
						<span class="legend-dot" style="background:${seg.color}"></span>
						${seg.label}
					</span>
				`)}
			</div>
		`;
	}

	const colors = config.colors ?? SERIES_COLORS;
	return html`
		<div class="chart-legend">
			${data.series.map((s, i) => html`
				<span class="legend-item">
					<span class="legend-dot" style="background:${colors[i % colors.length]}"></span>
					${s.label}
				</span>
			`)}
		</div>
	`;
}
