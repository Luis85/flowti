import { html, css, nothing } from 'lit';
import { FlowtiElement } from '../flowti-element.js';
import { emptyState } from '../shared-styles.js';
import type { FlowtiChartConfig } from './flowti-chart.js';
import './flowti-chart.js';

interface TileStatData {
	value: string | number;
	label?: string;
	/** Previous period value for trend calculation. */
	previousValue?: number;
	/** Explicit trend direction override. */
	trend?: 'up' | 'down' | 'flat';
	/** Number format: "number", "percent", "currency", "compact". Defaults to "number". */
	format?: 'number' | 'percent' | 'currency' | 'compact';
	/** Currency code used when format is "currency". Defaults to "USD". */
	currencyCode?: string;
	/** Prefix string displayed before the value. */
	prefix?: string;
	/** Suffix string displayed after the value. */
	suffix?: string;
}

interface TileTableData {
	columns: string[];
	rows: Array<Record<string, string | number>>;
}

interface TileChartData {
	columns: string[];
	rows: Array<Record<string, string | number>>;
}

type TileData = TileStatData | TileTableData | TileChartData | null;

interface TileConfig {
	color?: string;
	/** Chart type when tileType is "chart". */
	chartType?: 'line' | 'bar' | 'area' | 'pie';
	/** Chart rendering options forwarded to flowti-chart. */
	chartConfig?: FlowtiChartConfig;
	/** Sort direction for table: "asc", "desc", or undefined (no sort). */
	sortDirection?: 'asc' | 'desc';
	/** Column to sort by in table mode. */
	sortColumn?: string;
}

/**
 * Analytics tile -- renders a single metric tile in one of three variants:
 * stat card (with number formatting and trend indicators),
 * table (sortable headers, row striping, column alignment),
 * or chart (Canvas 2D via flowti-chart for line/bar/area/pie).
 *
 * @property tileType - Variant: "stat", "table", or "chart"
 * @property title - Tile display title
 * @property data - Tile data (shape depends on tileType)
 * @property config - Optional rendering configuration
 */
export class FlowtiAnalyticsTile extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		tileType: { type: String },
		title: { type: String },
		data: { type: Object },
		config: { type: Object },
		_sortColumn: { state: true },
		_sortAscending: { state: true },
	};

	static styles = [
		...FlowtiElement.styles,
		emptyState,
		css`
			.tile {
				padding: var(--flowti-space-md);
				border-radius: var(--flowti-radius);
				background: var(--background-secondary);
				height: 100%;
				display: flex;
				flex-direction: column;
			}

			.tile--success {
				border-left: 3px solid var(--flowti-color-success, #4caf50);
			}

			.tile--warning {
				border-left: 3px solid var(--flowti-color-warning, #ff9800);
			}

			.tile--error {
				border-left: 3px solid var(--flowti-color-error, #f44336);
			}

			.tile-header {
				font-size: var(--flowti-font-sm);
				font-weight: 600;
				margin-bottom: var(--flowti-space-sm);
				color: var(--flowti-color-muted);
			}

			/* ── Stat Mode ─────────────────────────────────── */

			.tile-stat {
				display: flex;
				flex-direction: column;
				align-items: flex-start;
				gap: 2px;
			}

			.tile-stat-value {
				font-size: 1.8em;
				font-weight: 700;
				line-height: 1.2;
				display: flex;
				align-items: baseline;
				gap: 4px;
			}

			.tile-stat-prefix,
			.tile-stat-suffix {
				font-size: 0.55em;
				font-weight: 500;
				color: var(--flowti-color-muted);
			}

			.tile-stat-label {
				font-size: var(--flowti-font-sm);
				color: var(--flowti-color-muted);
				margin-top: var(--flowti-space-xs);
			}

			.tile-stat-trend {
				display: inline-flex;
				align-items: center;
				gap: 2px;
				font-size: 0.75em;
				font-weight: 600;
				margin-top: 2px;
				padding: 1px 6px;
				border-radius: 4px;
			}

			.tile-stat-trend--up {
				color: var(--flowti-color-success, #4caf50);
				background: rgba(76, 175, 80, 0.1);
			}

			.tile-stat-trend--down {
				color: var(--flowti-color-error, #f44336);
				background: rgba(244, 67, 54, 0.1);
			}

			.tile-stat-trend--flat {
				color: var(--flowti-color-muted);
				background: var(--background-primary);
			}

			.tile-stat-trend-arrow {
				font-size: 0.9em;
			}

			/* ── Table Mode ────────────────────────────────── */

			.tile-table-wrapper {
				flex: 1;
				overflow: auto;
			}

			.tile-table {
				width: 100%;
				border-collapse: collapse;
				font-size: var(--flowti-font-sm);
			}

			.tile-table th {
				text-align: left;
				padding: var(--flowti-space-xs) var(--flowti-space-sm);
				border-bottom: 2px solid var(--flowti-border);
				font-weight: 600;
				color: var(--flowti-color-muted);
				cursor: pointer;
				user-select: none;
				white-space: nowrap;
				transition: color 0.15s;
			}

			.tile-table th:hover {
				color: var(--flowti-text, inherit);
			}

			.tile-table th .sort-arrow {
				font-size: 0.8em;
				margin-left: 2px;
				opacity: 0.7;
			}

			.tile-table td {
				padding: var(--flowti-space-xs) var(--flowti-space-sm);
				border-bottom: 1px solid var(--flowti-border);
			}

			.tile-table td.cell-number {
				text-align: right;
				font-variant-numeric: tabular-nums;
			}

			.tile-table tbody tr:nth-child(even) {
				background: color-mix(in srgb, var(--background-primary) 50%, transparent);
			}

			.tile-table tbody tr:hover {
				background: var(--background-modifier-hover, rgba(0, 0, 0, 0.04));
			}

			/* ── Chart Mode ────────────────────────────────── */

			.tile-chart {
				flex: 1;
				display: flex;
				flex-direction: column;
				min-height: 120px;
			}

			.tile-empty {
				display: flex;
				align-items: center;
				justify-content: center;
				flex: 1;
				color: var(--flowti-color-muted);
				font-size: var(--flowti-font-sm);
			}
		`,
	];

	tileType: 'stat' | 'table' | 'chart' = 'stat';
	title = '';
	data: TileData = null;
	config: TileConfig = {};

	// Ephemeral table sort state
	_sortColumn: string | null = null;
	_sortAscending = true;

	protected renderContent() {
		const colorClass = this.config?.color ? `tile--${this.config.color}` : '';
		return html`
			<div class="tile ${colorClass}">
				${this.title ? html`<div class="tile-header">${this.title}</div>` : nothing}
				${this.data ? this.renderVariant() : html`<div class="tile-empty">No data</div>`}
			</div>
		`;
	}

	private renderVariant() {
		switch (this.tileType) {
			case 'stat':
				return this.renderStat();
			case 'table':
				return this.renderTable();
			case 'chart':
				return this.renderChart();
			default:
				return html`<div class="tile-empty">Unknown tile type</div>`;
		}
	}

	// ── Stat Rendering ────────────────────────────────────

	private renderStat() {
		const d = this.data as TileStatData;
		const formatted = this.formatStatValue(d);
		const trend = this.computeTrend(d);

		return html`
			<div class="tile-stat">
				<div class="tile-stat-value">
					${d.prefix ? html`<span class="tile-stat-prefix">${d.prefix}</span>` : nothing}
					${formatted}
					${d.suffix ? html`<span class="tile-stat-suffix">${d.suffix}</span>` : nothing}
				</div>
				${d.label ? html`<div class="tile-stat-label">${d.label}</div>` : nothing}
				${trend ? html`
					<div class="tile-stat-trend tile-stat-trend--${trend.direction}">
						<span class="tile-stat-trend-arrow">${trend.arrow}</span>
						${trend.text}
					</div>
				` : nothing}
			</div>
		`;
	}

	private formatStatValue(d: TileStatData): string {
		if (typeof d.value === 'string') return d.value;

		const v = d.value;
		const fmt = d.format ?? 'number';

		switch (fmt) {
			case 'percent':
				return `${v.toFixed(1)}%`;
			case 'currency': {
				const code = d.currencyCode ?? 'USD';
				try {
					return new Intl.NumberFormat(undefined, {
						style: 'currency',
						currency: code,
						minimumFractionDigits: 0,
						maximumFractionDigits: 2,
					}).format(v);
				} catch {
					return `${v.toFixed(2)}`;
				}
			}
			case 'compact':
				if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
				if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
				return Number.isInteger(v) ? String(v) : v.toFixed(1);
			default:
				return typeof v === 'number'
					? v.toLocaleString(undefined, { maximumFractionDigits: 2 })
					: String(v);
		}
	}

	private computeTrend(d: TileStatData): { direction: string; arrow: string; text: string } | null {
		// Explicit trend override
		if (d.trend) {
			const arrows: Record<string, string> = { up: '\u25B2', down: '\u25BC', flat: '\u25CF' };
			return {
				direction: d.trend,
				arrow: arrows[d.trend] ?? '',
				text: d.trend,
			};
		}

		// Auto-compute from previousValue
		if (d.previousValue !== undefined && typeof d.value === 'number') {
			const diff = d.value - d.previousValue;
			if (d.previousValue === 0) {
				return diff > 0
					? { direction: 'up', arrow: '\u25B2', text: 'New' }
					: { direction: 'flat', arrow: '\u25CF', text: 'No change' };
			}
			const pct = ((diff / Math.abs(d.previousValue)) * 100).toFixed(1);
			if (diff > 0) return { direction: 'up', arrow: '\u25B2', text: `+${pct}%` };
			if (diff < 0) return { direction: 'down', arrow: '\u25BC', text: `${pct}%` };
			return { direction: 'flat', arrow: '\u25CF', text: '0%' };
		}

		return null;
	}

	// ── Table Rendering ───────────────────────────────────

	private renderTable() {
		const d = this.data as TileTableData;
		if (!d.columns || d.columns.length === 0) {
			return html`<div class="tile-empty">No columns</div>`;
		}

		// Apply sorting
		const rows = this.sortedRows(d);

		return html`
			<div class="tile-table-wrapper">
				<table class="tile-table">
					<thead>
						<tr>
							${d.columns.map((c) => html`
								<th @click=${() => this.handleSort(c)}>
									${c}${this.sortIndicator(c)}
								</th>
							`)}
						</tr>
					</thead>
					<tbody>
						${rows.map((row) => html`
							<tr>
								${d.columns.map((c) => {
									const val = row[c] ?? '';
									const isNum = typeof val === 'number';
									return html`<td class="${isNum ? 'cell-number' : ''}">${isNum ? val.toLocaleString(undefined, { maximumFractionDigits: 2 }) : val}</td>`;
								})}
							</tr>
						`)}
					</tbody>
				</table>
			</div>
		`;
	}

	private handleSort(column: string) {
		if (this._sortColumn === column) {
			if (this._sortAscending) {
				this._sortAscending = false;
			} else {
				// Third click clears sort
				this._sortColumn = null;
				this._sortAscending = true;
			}
		} else {
			this._sortColumn = column;
			this._sortAscending = true;
		}
		this.requestUpdate();
	}

	private sortIndicator(column: string) {
		if (this._sortColumn !== column) return nothing;
		return html`<span class="sort-arrow">${this._sortAscending ? '\u25B2' : '\u25BC'}</span>`;
	}

	private sortedRows(d: TileTableData): Array<Record<string, string | number>> {
		const rows = d.rows ?? [];
		if (!this._sortColumn || !d.columns.includes(this._sortColumn)) {
			return rows;
		}

		const col = this._sortColumn;
		const asc = this._sortAscending;

		return [...rows].sort((a, b) => {
			const va = a[col];
			const vb = b[col];
			if (va == null && vb == null) return 0;
			if (va == null) return asc ? -1 : 1;
			if (vb == null) return asc ? 1 : -1;
			if (typeof va === 'number' && typeof vb === 'number') {
				return asc ? va - vb : vb - va;
			}
			return asc
				? String(va).localeCompare(String(vb))
				: String(vb).localeCompare(String(va));
		});
	}

	// ── Chart Rendering ───────────────────────────────────

	private renderChart() {
		const d = this.data as TileChartData;
		if (!d?.columns || d.columns.length === 0 || !d?.rows || d.rows.length === 0) {
			return html`<div class="tile-empty">No chart data</div>`;
		}

		const chartType = this.config?.chartType ?? 'line';
		const chartConfig = this.config?.chartConfig ?? {};

		return html`
			<div class="tile-chart">
				<flowti-chart
					chart-type="${chartType}"
					.columns=${d.columns}
					.rows=${d.rows}
					.config=${chartConfig}
				></flowti-chart>
			</div>
		`;
	}
}

if (!customElements.get('flowti-analytics-tile')) customElements.define('flowti-analytics-tile', FlowtiAnalyticsTile);
