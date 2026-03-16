import { html, css, nothing } from 'lit';
import { FlowtiElement } from '../flowti-element.js';
import { emptyState } from '../shared-styles.js';

interface TileStatData {
	value: string | number;
	label?: string;
}

interface TileTableData {
	columns: string[];
	rows: Array<Record<string, string | number>>;
}

type TileData = TileStatData | TileTableData | null;

interface TileConfig {
	color?: string;
}

/**
 * Analytics tile — renders a single metric tile in one of three variants:
 * stat card, table, or chart placeholder.
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

			.tile-stat-value {
				font-size: 1.8em;
				font-weight: 700;
				line-height: 1.2;
			}

			.tile-stat-label {
				font-size: var(--flowti-font-sm);
				color: var(--flowti-color-muted);
				margin-top: var(--flowti-space-xs);
			}

			.tile-table {
				width: 100%;
				border-collapse: collapse;
				font-size: var(--flowti-font-sm);
				flex: 1;
				overflow: auto;
			}

			.tile-table th {
				text-align: left;
				padding: var(--flowti-space-xs) var(--flowti-space-sm);
				border-bottom: 1px solid var(--flowti-border);
				font-weight: 600;
				color: var(--flowti-color-muted);
			}

			.tile-table td {
				padding: var(--flowti-space-xs) var(--flowti-space-sm);
				border-bottom: 1px solid var(--flowti-border);
			}

			.tile-chart {
				flex: 1;
				display: flex;
				align-items: center;
				justify-content: center;
				min-height: 80px;
				border-radius: var(--flowti-radius);
				background: var(--background-primary);
				color: var(--flowti-color-muted);
				font-size: var(--flowti-font-sm);
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

	tileType: "stat" | "table" | "chart" = "stat";
	title = "";
	data: TileData = null;
	config: TileConfig = {};

	protected renderContent() {
		const colorClass = this.config?.color ? `tile--${this.config.color}` : "";
		return html`
			<div class="tile ${colorClass}">
				${this.title ? html`<div class="tile-header">${this.title}</div>` : nothing}
				${this.data ? this.renderVariant() : html`<div class="tile-empty">No data</div>`}
			</div>
		`;
	}

	private renderVariant() {
		switch (this.tileType) {
			case "stat":
				return this.renderStat();
			case "table":
				return this.renderTable();
			case "chart":
				return this.renderChart();
			default:
				return html`<div class="tile-empty">Unknown tile type</div>`;
		}
	}

	private renderStat() {
		const d = this.data as TileStatData;
		return html`
			<div class="tile-stat-value">${d.value}</div>
			${d.label ? html`<div class="tile-stat-label">${d.label}</div>` : nothing}
		`;
	}

	private renderTable() {
		const d = this.data as TileTableData;
		if (!d.columns || d.columns.length === 0) {
			return html`<div class="tile-empty">No columns</div>`;
		}
		return html`
			<table class="tile-table">
				<thead>
					<tr>${d.columns.map((c) => html`<th>${c}</th>`)}</tr>
				</thead>
				<tbody>
					${(d.rows ?? []).map((row) => html`
						<tr>${d.columns.map((c) => html`<td>${row[c] ?? ""}</td>`)}</tr>
					`)}
				</tbody>
			</table>
		`;
	}

	private renderChart() {
		const d = this.data as TileTableData;
		const rowCount = d?.rows?.length ?? 0;
		return html`
			<div class="tile-chart">
				Chart (${rowCount} data points)
			</div>
		`;
	}
}

customElements.define('flowti-analytics-tile', FlowtiAnalyticsTile);
