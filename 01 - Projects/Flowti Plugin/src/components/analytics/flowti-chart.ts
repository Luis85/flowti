import { LitElement, html, css } from 'lit';
import { tokens } from '../tokens.js';

// ── Layout constants ────────────────────────────────────
const PADDING = { top: 24, right: 16, bottom: 40, left: 48 };
const DOT_RADIUS = 3;
const BAR_GAP_RATIO = 0.2;
const MAX_LABELS = 12;
const PIE_MIN_PERCENT = 3;
const PIE_MAX_SEGMENTS = 12;
const Y_TICKS = 5;

const SERIES_COLORS = [
	'#6366f1', // indigo
	'#10b981', // emerald
	'#ef4444', // red
	'#f59e0b', // amber
	'#8b5cf6', // violet
	'#06b6d4', // cyan
	'#f97316', // orange
	'#ec4899', // pink
];

interface ChartDataColumn {
	label: string;
	values: number[];
}

interface ChartSeriesData {
	labels: string[];
	series: ChartDataColumn[];
}

interface PieSegment {
	label: string;
	value: number;
	color: string;
}

export interface FlowtiChartConfig {
	colors?: string[];
	showDots?: boolean;
	showGrid?: boolean;
	showValues?: boolean;
	areaOpacity?: number;
	animationDuration?: number;
}

/**
 * Canvas-based chart component supporting line, bar, area, and pie charts.
 *
 * Renders directly to a <canvas> element using the Canvas 2D API.
 * Responsive via ResizeObserver. No external dependencies.
 *
 * @property chartType - Chart variant: "line", "bar", "area", "pie"
 * @property columns - Column names for table data
 * @property rows - Array of row objects with values keyed by column name
 * @property config - Optional rendering configuration
 */
export class FlowtiChart extends LitElement {
	static properties = {
		chartType: { type: String, attribute: 'chart-type' },
		columns: { type: Array },
		rows: { type: Array },
		config: { type: Object },
	};

	static styles = [
		tokens,
		css`
			:host {
				display: block;
				position: relative;
				min-height: 120px;
			}

			.chart-wrapper {
				position: relative;
				width: 100%;
				height: 100%;
				min-height: 120px;
			}

			canvas {
				display: block;
				width: 100%;
				height: 100%;
			}

			.chart-legend {
				display: flex;
				flex-wrap: wrap;
				gap: 8px 12px;
				padding: var(--flowti-space-xs) 0;
				justify-content: center;
			}

			.legend-item {
				display: flex;
				align-items: center;
				gap: 4px;
				font-size: 0.75em;
				color: var(--flowti-color-muted);
			}

			.legend-dot {
				width: 8px;
				height: 8px;
				border-radius: 50%;
				flex-shrink: 0;
			}

			.chart-empty {
				display: flex;
				align-items: center;
				justify-content: center;
				min-height: 120px;
				color: var(--flowti-color-muted);
				font-size: var(--flowti-font-sm);
			}
		`,
	];

	chartType: 'line' | 'bar' | 'area' | 'pie' = 'line';
	columns: string[] = [];
	rows: Array<Record<string, string | number>> = [];
	config: FlowtiChartConfig = {};

	private _canvas: HTMLCanvasElement | null = null;
	private _resizeObserver: ResizeObserver | null = null;
	private _renderPending = false;

	render() {
		const parsed = this._parseData();
		if (!parsed) {
			return html`<div class="chart-empty">No chart data</div>`;
		}

		const showLegend = this.chartType === 'pie' || (parsed.series && parsed.series.length > 1);

		return html`
			<div class="chart-wrapper">
				<canvas></canvas>
			</div>
			${showLegend ? this._renderLegend(parsed) : ''}
		`;
	}

	updated() {
		this._canvas = this.renderRoot.querySelector('canvas');
		if (this._canvas) {
			this._scheduleRender();
		}
	}

	connectedCallback() {
		super.connectedCallback();
		this._resizeObserver = new ResizeObserver(() => {
			this._scheduleRender();
		});
	}

	disconnectedCallback() {
		super.disconnectedCallback();
		if (this._resizeObserver) {
			this._resizeObserver.disconnect();
			this._resizeObserver = null;
		}
	}

	firstUpdated() {
		const wrapper = this.renderRoot.querySelector('.chart-wrapper');
		if (wrapper && this._resizeObserver) {
			this._resizeObserver.observe(wrapper);
		}
	}

	private _scheduleRender() {
		if (this._renderPending) return;
		this._renderPending = true;
		requestAnimationFrame(() => {
			this._renderPending = false;
			this._drawChart();
		});
	}

	private _drawChart() {
		const canvas = this._canvas;
		if (!canvas) return;

		const wrapper = canvas.parentElement;
		if (!wrapper) return;

		const rect = wrapper.getBoundingClientRect();
		const dpr = window.devicePixelRatio || 1;
		const width = Math.max(rect.width, 100);
		const height = Math.max(rect.height, 100);

		canvas.width = width * dpr;
		canvas.height = height * dpr;
		canvas.style.width = `${width}px`;
		canvas.style.height = `${height}px`;

		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		ctx.scale(dpr, dpr);
		ctx.clearRect(0, 0, width, height);

		const parsed = this._parseData();
		if (!parsed) return;

		switch (this.chartType) {
			case 'line':
				this._drawLineChart(ctx, width, height, parsed);
				break;
			case 'bar':
				this._drawBarChart(ctx, width, height, parsed);
				break;
			case 'area':
				this._drawAreaChart(ctx, width, height, parsed);
				break;
			case 'pie':
				this._drawPieChart(ctx, width, height, parsed);
				break;
		}
	}

	// ── Data Parsing ──────────────────────────────────────

	private _parseData(): ChartSeriesData | null {
		if (!this.rows || this.rows.length === 0 || !this.columns || this.columns.length === 0) {
			return null;
		}

		const firstRow = this.rows[0];
		const labelCol = this.columns.find((c) => typeof firstRow[c] !== 'number');
		const numericCols = this.columns.filter((c) => typeof firstRow[c] === 'number');

		if (numericCols.length === 0) return null;

		const labels = this.rows.map((row, i) =>
			labelCol ? String(row[labelCol] ?? '') : String(i + 1)
		);

		const series: ChartDataColumn[] = numericCols.map((col) => ({
			label: col,
			values: this.rows.map((row) => {
				const v = row[col];
				return typeof v === 'number' ? v : 0;
			}),
		}));

		return { labels, series };
	}

	// ── Axis Drawing ──────────────────────────────────────

	private _computeYRange(allValues: number[]): { yMin: number; yMax: number; yRange: number } {
		const rawMin = Math.min(...allValues);
		const yMin = Math.min(0, rawMin);
		const yMax = Math.max(...allValues);
		const yRange = yMax - yMin || 1;
		return { yMin, yMax, yRange };
	}

	private _drawGrid(
		ctx: CanvasRenderingContext2D,
		width: number,
		height: number,
		yMin: number,
		yMax: number,
	) {
		const plotLeft = PADDING.left;
		const plotRight = width - PADDING.right;
		const plotTop = PADDING.top;
		const plotBottom = height - PADDING.bottom;
		const yRange = yMax - yMin || 1;

		ctx.save();
		ctx.strokeStyle = this._resolveColor('--background-modifier-border', '#e5e7eb');
		ctx.lineWidth = 0.5;
		ctx.fillStyle = this._resolveColor('--text-muted', '#9ca3af');
		ctx.font = '10px system-ui, sans-serif';
		ctx.textAlign = 'right';
		ctx.textBaseline = 'middle';

		for (let i = 0; i <= Y_TICKS; i++) {
			const ratio = i / Y_TICKS;
			const y = plotBottom - ratio * (plotBottom - plotTop);
			const val = yMin + ratio * yRange;

			// Grid line
			ctx.beginPath();
			ctx.moveTo(plotLeft, y);
			ctx.lineTo(plotRight, y);
			ctx.stroke();

			// Y-axis label
			ctx.fillText(this._formatValue(val), plotLeft - 6, y);
		}
		ctx.restore();
	}

	private _drawXLabels(
		ctx: CanvasRenderingContext2D,
		width: number,
		height: number,
		labels: string[],
	) {
		const plotLeft = PADDING.left;
		const plotRight = width - PADDING.right;
		const plotW = plotRight - plotLeft;
		const plotBottom = height - PADDING.bottom;
		const n = labels.length;
		const step = n <= MAX_LABELS ? 1 : Math.ceil(n / MAX_LABELS);

		ctx.save();
		ctx.fillStyle = this._resolveColor('--text-muted', '#9ca3af');
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

	// ── Line Chart ────────────────────────────────────────

	private _drawLineChart(
		ctx: CanvasRenderingContext2D,
		width: number,
		height: number,
		data: ChartSeriesData,
	) {
		const allValues = data.series.flatMap((s) => s.values);
		const { yMin, yMax, yRange } = this._computeYRange(allValues);
		const colors = this.config.colors ?? SERIES_COLORS;
		const showDots = this.config.showDots !== false;

		this._drawGrid(ctx, width, height, yMin, yMax);
		this._drawXLabels(ctx, width, height, data.labels);

		const plotLeft = PADDING.left;
		const plotRight = width - PADDING.right;
		const plotTop = PADDING.top;
		const plotBottom = height - PADDING.bottom;
		const plotW = plotRight - plotLeft;
		const plotH = plotBottom - plotTop;
		const n = data.labels.length;

		for (let si = 0; si < data.series.length; si++) {
			const series = data.series[si];
			const color = colors[si % colors.length];

			const points = series.values.map((v, i) => ({
				x: plotLeft + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW),
				y: plotBottom - ((v - yMin) / yRange) * plotH,
			}));

			// Line path
			if (points.length > 1) {
				ctx.save();
				ctx.strokeStyle = color;
				ctx.lineWidth = 2;
				ctx.lineJoin = 'round';
				ctx.lineCap = 'round';
				ctx.beginPath();
				ctx.moveTo(points[0].x, points[0].y);
				for (let i = 1; i < points.length; i++) {
					ctx.lineTo(points[i].x, points[i].y);
				}
				ctx.stroke();
				ctx.restore();
			}

			// Dot markers
			if (showDots) {
				ctx.save();
				ctx.fillStyle = color;
				for (const p of points) {
					ctx.beginPath();
					ctx.arc(p.x, p.y, DOT_RADIUS, 0, Math.PI * 2);
					ctx.fill();
				}
				ctx.restore();
			}
		}
	}

	// ── Bar Chart ─────────────────────────────────────────

	private _drawBarChart(
		ctx: CanvasRenderingContext2D,
		width: number,
		height: number,
		data: ChartSeriesData,
	) {
		const allValues = data.series.flatMap((s) => s.values);
		const { yMin, yMax, yRange } = this._computeYRange(allValues);
		const colors = this.config.colors ?? SERIES_COLORS;
		const showValues = this.config.showValues !== false;

		this._drawGrid(ctx, width, height, yMin, yMax);
		this._drawXLabels(ctx, width, height, data.labels);

		const plotLeft = PADDING.left;
		const plotRight = width - PADDING.right;
		const plotTop = PADDING.top;
		const plotBottom = height - PADDING.bottom;
		const plotW = plotRight - plotLeft;
		const plotH = plotBottom - plotTop;
		const n = data.labels.length;
		const seriesCount = data.series.length;

		const totalGroupWidth = plotW / n;
		const groupGap = totalGroupWidth * BAR_GAP_RATIO;
		const usableWidth = totalGroupWidth - groupGap;
		const barWidth = seriesCount > 0 ? usableWidth / seriesCount : usableWidth;

		for (let i = 0; i < n; i++) {
			const groupX = plotLeft + i * totalGroupWidth + groupGap / 2;

			for (let si = 0; si < seriesCount; si++) {
				const v = data.series[si].values[i];
				const barHeight = ((v - yMin) / yRange) * plotH;
				const x = groupX + si * barWidth;
				const y = plotBottom - barHeight;
				const color = colors[si % colors.length];

				ctx.save();
				ctx.fillStyle = color;
				this._roundRect(ctx, x, y, Math.max(barWidth - 1, 1), Math.max(barHeight, 1), 2);
				ctx.fill();
				ctx.restore();

				// Value label above bar
				if (showValues && barHeight > 14) {
					ctx.save();
					ctx.fillStyle = this._resolveColor('--text-muted', '#9ca3af');
					ctx.font = '10px system-ui, sans-serif';
					ctx.textAlign = 'center';
					ctx.textBaseline = 'bottom';
					ctx.fillText(this._formatValue(v), x + barWidth / 2, y - 2);
					ctx.restore();
				}
			}
		}
	}

	// ── Area Chart ────────────────────────────────────────

	private _drawAreaChart(
		ctx: CanvasRenderingContext2D,
		width: number,
		height: number,
		data: ChartSeriesData,
	) {
		const allValues = data.series.flatMap((s) => s.values);
		const { yMin, yMax, yRange } = this._computeYRange(allValues);
		const colors = this.config.colors ?? SERIES_COLORS;
		const showDots = this.config.showDots !== false;
		const areaOpacity = this.config.areaOpacity ?? 0.15;

		this._drawGrid(ctx, width, height, yMin, yMax);
		this._drawXLabels(ctx, width, height, data.labels);

		const plotLeft = PADDING.left;
		const plotRight = width - PADDING.right;
		const plotTop = PADDING.top;
		const plotBottom = height - PADDING.bottom;
		const plotW = plotRight - plotLeft;
		const plotH = plotBottom - plotTop;
		const n = data.labels.length;

		for (let si = 0; si < data.series.length; si++) {
			const series = data.series[si];
			const color = colors[si % colors.length];

			const points = series.values.map((v, i) => ({
				x: plotLeft + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW),
				y: plotBottom - ((v - yMin) / yRange) * plotH,
			}));

			// Filled area
			if (points.length > 1) {
				ctx.save();
				ctx.globalAlpha = areaOpacity;
				ctx.fillStyle = color;
				ctx.beginPath();
				ctx.moveTo(points[0].x, plotBottom);
				for (const p of points) {
					ctx.lineTo(p.x, p.y);
				}
				ctx.lineTo(points[points.length - 1].x, plotBottom);
				ctx.closePath();
				ctx.fill();
				ctx.restore();

				// Line overlay
				ctx.save();
				ctx.strokeStyle = color;
				ctx.lineWidth = 2;
				ctx.lineJoin = 'round';
				ctx.lineCap = 'round';
				ctx.beginPath();
				ctx.moveTo(points[0].x, points[0].y);
				for (let i = 1; i < points.length; i++) {
					ctx.lineTo(points[i].x, points[i].y);
				}
				ctx.stroke();
				ctx.restore();
			}

			// Dot markers
			if (showDots) {
				ctx.save();
				ctx.fillStyle = color;
				for (const p of points) {
					ctx.beginPath();
					ctx.arc(p.x, p.y, DOT_RADIUS, 0, Math.PI * 2);
					ctx.fill();
				}
				ctx.restore();
			}
		}
	}

	// ── Pie Chart ─────────────────────────────────────────

	private _drawPieChart(
		ctx: CanvasRenderingContext2D,
		width: number,
		height: number,
		data: ChartSeriesData,
	) {
		const segments = this._extractPieSegments(data);
		if (segments.length === 0) return;

		const total = segments.reduce((s, seg) => s + seg.value, 0);
		if (total <= 0) return;

		const cx = width / 2;
		const cy = height / 2;
		const radius = Math.min(width, height) / 2 - 20;

		let cumAngle = -Math.PI / 2;

		for (const seg of segments) {
			const sliceAngle = (seg.value / total) * 2 * Math.PI;

			ctx.save();
			ctx.fillStyle = seg.color;

			if (segments.length === 1) {
				// Full circle
				ctx.beginPath();
				ctx.arc(cx, cy, radius, 0, Math.PI * 2);
				ctx.fill();
			} else {
				ctx.beginPath();
				ctx.moveTo(cx, cy);
				ctx.arc(cx, cy, radius, cumAngle, cumAngle + sliceAngle);
				ctx.closePath();
				ctx.fill();

				// Segment border
				ctx.strokeStyle = this._resolveColor('--background-primary', '#ffffff');
				ctx.lineWidth = 1.5;
				ctx.stroke();
			}

			// Percentage label on large slices
			const pct = (seg.value / total) * 100;
			if (pct >= 8) {
				const midAngle = cumAngle + sliceAngle / 2;
				const labelR = radius * 0.65;
				const lx = cx + labelR * Math.cos(midAngle);
				const ly = cy + labelR * Math.sin(midAngle);

				ctx.fillStyle = '#ffffff';
				ctx.font = 'bold 11px system-ui, sans-serif';
				ctx.textAlign = 'center';
				ctx.textBaseline = 'middle';
				ctx.fillText(`${pct.toFixed(0)}%`, lx, ly);
			}

			ctx.restore();
			cumAngle += sliceAngle;
		}
	}

	private _extractPieSegments(data: ChartSeriesData): PieSegment[] {
		if (!data.series || data.series.length === 0) return [];

		// For pie chart, use first series values mapped to labels
		const values = data.series[0].values;
		const colors = this.config.colors ?? SERIES_COLORS;

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

	// ── Legend Rendering ───────────────────────────────────

	private _renderLegend(data: ChartSeriesData) {
		if (this.chartType === 'pie') {
			const segments = this._extractPieSegments(data);
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

		const colors = this.config.colors ?? SERIES_COLORS;
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

	// ── Helpers ────────────────────────────────────────────

	private _formatValue(v: number): string {
		if (Math.abs(v) >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'M';
		if (Math.abs(v) >= 1_000) return (v / 1_000).toFixed(1) + 'K';
		return Number.isInteger(v) ? String(v) : v.toFixed(1);
	}

	private _roundRect(
		ctx: CanvasRenderingContext2D,
		x: number,
		y: number,
		w: number,
		h: number,
		r: number,
	) {
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

	private _resolveColor(cssVar: string, fallback: string): string {
		const computed = getComputedStyle(this).getPropertyValue(cssVar).trim();
		return computed || fallback;
	}
}

if (!customElements.get('flowti-chart')) customElements.define('flowti-chart', FlowtiChart);
