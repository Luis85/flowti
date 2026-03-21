import { LitElement, html, css } from 'lit';
import { tokens } from '../tokens.js';
import { type ChartSeriesData, renderLegend } from './flowti-chart-helpers.js';
import { drawLineChart, drawBarChart, drawAreaChart, drawPieChart } from './flowti-chart-draw.js';

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
			${showLegend ? renderLegend(this.chartType, parsed, this.config) : ''}
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

		const resolve = this._resolveColor.bind(this);

		switch (this.chartType) {
			case 'line':
				drawLineChart(ctx, width, height, parsed, this.config, resolve);
				break;
			case 'bar':
				drawBarChart(ctx, width, height, parsed, this.config, resolve);
				break;
			case 'area':
				drawAreaChart(ctx, width, height, parsed, this.config, resolve);
				break;
			case 'pie':
				drawPieChart(ctx, width, height, parsed, this.config, resolve);
				break;
		}
	}

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
		const series = numericCols.map((col) => ({
			label: col,
			values: this.rows.map((row) => {
				const v = row[col];
				return typeof v === 'number' ? v : 0;
			}),
		}));
		return { labels, series };
	}

	private _resolveColor(cssVar: string, fallback: string): string {
		const computed = getComputedStyle(this).getPropertyValue(cssVar).trim();
		return computed || fallback;
	}
}

if (!customElements.get('flowti-chart')) customElements.define('flowti-chart', FlowtiChart);
