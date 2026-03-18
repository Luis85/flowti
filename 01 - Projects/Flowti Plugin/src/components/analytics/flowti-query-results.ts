import { html, css, nothing } from 'lit';
import { FlowtiElement } from '../flowti-element.js';

interface QueryResult {
	columns: string[];
	rows: Array<Record<string, string | number>>;
	groupCount: number;
	sourceRowCount: number;
}

/**
 * Query results display component — shows tabular results with
 * chart mode toggle and summary statistics.
 *
 * @property results - Query execution results
 * @property chartMode - Current chart display mode ('line' | 'bar' | 'none')
 * @property errorMessage - Error message from query execution (or empty)
 * @property durationMs - Query execution duration in milliseconds
 * @property maxDisplayRows - Maximum rows to show in the table (default 50)
 *
 * @fires toggle-chart-mode - detail: { mode } when chart toggle is clicked
 * @fires export-csv - no detail, when export button is clicked
 */
export class FlowtiQueryResults extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		results: { type: Object },
		chartMode: { type: String, attribute: 'chart-mode' },
		errorMessage: { type: String, attribute: 'error-message' },
		durationMs: { type: Number, attribute: 'duration-ms' },
		maxDisplayRows: { type: Number, attribute: 'max-display-rows' },
	};

	static styles = [
		...FlowtiElement.styles,
		css`
			.results-layout {
				display: flex;
				flex-direction: column;
				gap: var(--flowti-space-md);
			}

			.results-header {
				display: flex;
				align-items: center;
				gap: var(--flowti-space-sm);
				font-size: var(--flowti-font-sm);
			}

			.results-title {
				font-weight: 600;
			}

			.results-meta {
				color: var(--flowti-color-muted);
			}

			.results-actions {
				margin-left: auto;
				display: flex;
				gap: var(--flowti-space-sm);
			}

			.chart-toggle {
				font-size: var(--flowti-font-sm);
				cursor: pointer;
				padding: 2px var(--flowti-space-xs);
				border-radius: var(--flowti-radius);
				background: none;
				border: 1px solid var(--flowti-border);
				color: var(--flowti-color-muted);
			}

			.chart-toggle--active {
				color: var(--text-accent, #5a7);
				border-color: var(--text-accent, #5a7);
			}

			.error-card {
				padding: var(--flowti-space-md);
				border-radius: var(--flowti-radius);
				background: color-mix(in srgb, var(--flowti-color-error, red) 10%, var(--background-secondary));
				color: var(--flowti-color-error);
				font-size: var(--flowti-font-sm);
			}

			.stat-row {
				display: flex;
				gap: var(--flowti-space-md);
				font-size: var(--flowti-font-sm);
			}

			.stat-item {
				display: flex;
				align-items: center;
				gap: var(--flowti-space-xs);
			}

			.stat-value {
				font-weight: 600;
			}

			.stat-label {
				color: var(--flowti-color-muted);
			}

			.chart-placeholder {
				background: var(--background-secondary);
				border-radius: var(--flowti-radius);
				padding: var(--flowti-space-lg);
				text-align: center;
				color: var(--flowti-color-muted);
				font-size: var(--flowti-font-sm);
				min-height: 120px;
				display: flex;
				align-items: center;
				justify-content: center;
			}

			.results-table-wrapper {
				overflow-x: auto;
			}

			.results-table {
				width: 100%;
				border-collapse: collapse;
				font-size: var(--flowti-font-sm);
			}

			.results-table th {
				text-align: left;
				padding: var(--flowti-space-xs) var(--flowti-space-sm);
				border-bottom: 2px solid var(--flowti-border);
				font-weight: 600;
				color: var(--flowti-color-muted);
				white-space: nowrap;
			}

			.results-table td {
				padding: var(--flowti-space-xs) var(--flowti-space-sm);
				border-bottom: 1px solid var(--flowti-border);
			}

			.results-table tr:hover td {
				background: var(--background-modifier-hover);
			}

			.numeric-cell {
				text-align: right;
				font-family: var(--flowti-font-mono);
			}

			.truncated-notice {
				font-size: var(--flowti-font-sm);
				color: var(--flowti-color-muted);
				text-align: center;
				padding: var(--flowti-space-sm);
			}

			.export-btn {
				font-size: var(--flowti-font-sm);
				cursor: pointer;
				padding: 2px var(--flowti-space-sm);
				border-radius: var(--flowti-radius);
				background: none;
				border: 1px solid var(--flowti-border);
				color: var(--text-normal, inherit);
			}

			.export-btn:hover {
				background: var(--background-modifier-hover);
			}

			.duration {
				font-size: var(--flowti-font-sm);
				color: var(--flowti-color-muted);
				font-style: italic;
			}
		`,
	];

	results: QueryResult | null = null;
	chartMode: 'line' | 'bar' | 'none' = 'none';
	errorMessage = '';
	durationMs = 0;
	maxDisplayRows = 50;

	private emit(name: string, detail?: unknown): void {
		this.dispatchEvent(
			new CustomEvent(name, {
				detail: detail ?? {},
				bubbles: true,
				composed: true,
			}),
		);
	}

	protected renderContent() {
		if (!this.results && !this.errorMessage) {
			return html``;
		}

		return html`
			<div class="results-layout">
				${this.errorMessage ? html`<div class="error-card">${this.errorMessage}</div>` : nothing}
				${this.results ? this.renderResultsContent() : nothing}
			</div>
		`;
	}

	private renderResultsContent() {
		const r = this.results!;
		const numericColumns = this.detectNumericColumns(r);
		const displayRows = r.rows.slice(0, this.maxDisplayRows);
		const truncated = r.rows.length > this.maxDisplayRows;

		return html`
			${this.renderHeader(r)}
			${this.renderStats(r)}
			${r.rows.length > 1 ? this.renderChartSection(r) : nothing}
			${r.columns.length > 0 ? html`
				<div class="results-table-wrapper">
					<table class="results-table">
						<thead>
							<tr>${r.columns.map((c) => html`<th>${c}</th>`)}</tr>
						</thead>
						<tbody>
							${displayRows.map((row) => html`
								<tr>${r.columns.map((c) => html`
									<td class="${numericColumns.has(c) ? 'numeric-cell' : ''}">${row[c] ?? ''}</td>
								`)}</tr>
							`)}
						</tbody>
					</table>
				</div>
				${truncated ? html`
					<div class="truncated-notice">
						Showing ${this.maxDisplayRows} of ${r.rows.length} rows
					</div>
				` : nothing}
			` : nothing}
		`;
	}

	private renderHeader(r: QueryResult) {
		return html`
			<div class="results-header">
				<span class="results-title">Results</span>
				<span class="results-meta">
					${r.rows.length} row${r.rows.length !== 1 ? 's' : ''}
					/ ${r.groupCount} group${r.groupCount !== 1 ? 's' : ''}
					/ ${r.sourceRowCount} source rows
				</span>
				${this.durationMs > 0 ? html`<span class="duration">${this.durationMs}ms</span>` : nothing}
				<div class="results-actions">
					${r.rows.length > 0 ? html`
						<button class="export-btn" data-action="export-csv" @click=${() => this.emit('export-csv')}>Export CSV</button>
					` : nothing}
				</div>
			</div>
		`;
	}

	private renderStats(r: QueryResult) {
		return html`
			<div class="stat-row">
				<div class="stat-item">
					<span class="stat-value">${r.columns.length}</span>
					<span class="stat-label">columns</span>
				</div>
				<div class="stat-item">
					<span class="stat-value">${r.rows.length}</span>
					<span class="stat-label">rows</span>
				</div>
				<div class="stat-item">
					<span class="stat-value">${r.groupCount}</span>
					<span class="stat-label">groups</span>
				</div>
			</div>
		`;
	}

	private renderChartSection(r: QueryResult) {
		const numericCols = r.columns.filter((c) => typeof r.rows[0]?.[c] === 'number');
		if (numericCols.length === 0) return nothing;

		return html`
			<div>
				<div class="results-header">
					<span class="results-meta">Chart</span>
					<div class="results-actions">
						<button
							class="chart-toggle ${this.chartMode === 'line' ? 'chart-toggle--active' : ''}"
							@click=${() => this.emit('toggle-chart-mode', { mode: 'line' })}
						>Line</button>
						<button
							class="chart-toggle ${this.chartMode === 'bar' ? 'chart-toggle--active' : ''}"
							@click=${() => this.emit('toggle-chart-mode', { mode: 'bar' })}
						>Bar</button>
						${this.chartMode !== 'none' ? html`
							<button
								class="chart-toggle"
								@click=${() => this.emit('toggle-chart-mode', { mode: 'none' })}
							>Hide</button>
						` : nothing}
					</div>
				</div>
				${this.chartMode !== 'none' ? html`
					<div class="chart-placeholder">
						${this.chartMode === 'line' ? 'Line' : 'Bar'} chart:
						${numericCols.join(', ')} across ${r.rows.length} rows
					</div>
				` : nothing}
			</div>
		`;
	}

	private detectNumericColumns(r: QueryResult): Set<string> {
		const set = new Set<string>();
		if (r.rows.length === 0) return set;
		const firstRow = r.rows[0];
		for (const col of r.columns) {
			if (typeof firstRow[col] === 'number') set.add(col);
		}
		return set;
	}
}

if (!customElements.get('flowti-query-results')) customElements.define('flowti-query-results', FlowtiQueryResults);
