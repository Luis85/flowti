import { html, css, nothing } from 'lit';
import { FlowtiElement } from '../flowti-element.js';
import { masterDetailLayout, emptyState } from '../shared-styles.js';

interface QuerySource {
	path: string;
	alias: string;
	displayName: string;
}

interface SavedQuery {
	id: string;
	name: string;
	description?: string;
	sources: Array<{ csvPath: string; alias: string }>;
	joins: unknown[];
	columnTypeHints: unknown[];
	dimensions: Array<{ column: string }>;
	measures: Array<{ column: string; function: string; label?: string }>;
	createdAt: number;
	isFavorite?: boolean;
}

interface QueryResult {
	columns: string[];
	rows: Array<Record<string, string | number>>;
	groupCount: number;
	sourceRowCount: number;
}

/**
 * Analytics queries component — query builder with source panel,
 * saved queries list, configuration, and results preview.
 *
 * @property sources - Available CSV/base data sources
 * @property savedQueries - Array of saved query objects
 * @property activeQuery - Currently active query (or null)
 * @property results - Query execution results (or null)
 *
 * @fires run-query - When the run button is clicked
 * @fires save-query - detail: { queryId } when save is clicked
 * @fires delete-query - detail: { queryId } when delete is clicked
 */
export class FlowtiAnalyticsQueries extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		sources: { type: Array },
		savedQueries: { type: Array },
		activeQuery: { type: Object },
		results: { type: Object },
	};

	static styles = [
		...FlowtiElement.styles,
		masterDetailLayout,
		emptyState,
		css`
			.queries-layout {
				display: flex;
				flex-direction: column;
				gap: var(--flowti-space-md);
			}

			.queries-master {
				display: flex;
				flex-direction: column;
				gap: var(--flowti-space-sm);
			}

			.section-header {
				display: flex;
				align-items: center;
				gap: var(--flowti-space-sm);
				font-size: var(--flowti-font-sm);
				font-weight: 600;
				color: var(--flowti-color-muted);
			}

			.section-count {
				font-size: var(--flowti-font-sm);
				background: var(--background-secondary);
				padding: 0 var(--flowti-space-xs);
				border-radius: var(--flowti-radius);
			}

			.query-item {
				display: flex;
				align-items: center;
				gap: var(--flowti-space-sm);
				padding: var(--flowti-space-sm) var(--flowti-space-md);
				border-radius: var(--flowti-radius);
				cursor: pointer;
			}

			.query-item:hover {
				background: var(--background-modifier-hover);
			}

			.query-item--active {
				background: var(--background-modifier-active-hover);
			}

			.query-name {
				flex: 1;
				font-size: var(--flowti-font-sm);
			}

			.query-meta {
				font-size: var(--flowti-font-sm);
				color: var(--flowti-color-muted);
			}

			.source-panel {
				padding: var(--flowti-space-md);
				background: var(--background-secondary);
				border-radius: var(--flowti-radius);
			}

			.source-item {
				padding: var(--flowti-space-xs) var(--flowti-space-sm);
				font-size: var(--flowti-font-sm);
			}

			.config-section {
				padding: var(--flowti-space-md);
				background: var(--background-secondary);
				border-radius: var(--flowti-radius);
			}

			.config-badges {
				display: flex;
				gap: var(--flowti-space-xs);
				flex-wrap: wrap;
			}

			.config-badge {
				font-size: var(--flowti-font-sm);
				padding: 2px var(--flowti-space-sm);
				border-radius: var(--flowti-radius);
				background: var(--background-primary);
				color: var(--flowti-color-muted);
			}

			.results-panel {
				padding: var(--flowti-space-md);
				background: var(--background-secondary);
				border-radius: var(--flowti-radius);
			}

			.results-header {
				display: flex;
				align-items: center;
				gap: var(--flowti-space-sm);
				font-size: var(--flowti-font-sm);
				font-weight: 600;
				margin-bottom: var(--flowti-space-sm);
			}

			.results-table {
				width: 100%;
				border-collapse: collapse;
				font-size: var(--flowti-font-sm);
			}

			.results-table th {
				text-align: left;
				padding: var(--flowti-space-xs) var(--flowti-space-sm);
				border-bottom: 1px solid var(--flowti-border);
				font-weight: 600;
				color: var(--flowti-color-muted);
			}

			.results-table td {
				padding: var(--flowti-space-xs) var(--flowti-space-sm);
				border-bottom: 1px solid var(--flowti-border);
			}

			.actions-bar {
				display: flex;
				gap: var(--flowti-space-sm);
			}

			button {
				padding: var(--flowti-space-xs) var(--flowti-space-sm);
				border-radius: var(--flowti-radius);
				border: 1px solid var(--flowti-border);
				background: var(--background-secondary);
				color: var(--flowti-text, inherit);
				font-size: var(--flowti-font-sm);
				cursor: pointer;
			}

			button:hover {
				background: var(--background-modifier-hover);
			}

			button.primary {
				background: var(--interactive-accent, #5a7);
				color: white;
				border-color: transparent;
			}

			.delete-btn {
				color: var(--flowti-color-error);
				border: none;
				background: none;
				cursor: pointer;
				font-size: var(--flowti-font-sm);
				padding: 2px var(--flowti-space-xs);
			}
		`,
	];

	sources: QuerySource[] = [];
	savedQueries: SavedQuery[] = [];
	activeQuery: SavedQuery | null = null;
	results: QueryResult | null = null;

	private dispatchRunQuery(): void {
		this.dispatchEvent(
			new CustomEvent("run-query", { bubbles: true, composed: true }),
		);
	}

	private dispatchSaveQuery(queryId: string): void {
		this.dispatchEvent(
			new CustomEvent("save-query", {
				detail: { queryId },
				bubbles: true,
				composed: true,
			}),
		);
	}

	private dispatchDeleteQuery(queryId: string): void {
		this.dispatchEvent(
			new CustomEvent("delete-query", {
				detail: { queryId },
				bubbles: true,
				composed: true,
			}),
		);
	}

	protected renderContent() {
		if (this.sources.length === 0 && this.savedQueries.length === 0) {
			return html`
				<div class="empty-state">
					<div class="empty-state__message">Add a CSV source to build a query</div>
				</div>
			`;
		}

		return html`
			<div class="queries-layout">
				${this.savedQueries.length > 0 ? this.renderSavedQueries() : nothing}
				${this.sources.length > 0 ? this.renderSourcePanel() : nothing}
				${this.activeQuery ? this.renderQueryConfig() : nothing}
				${this.results ? this.renderResults() : nothing}
			</div>
		`;
	}

	private renderSavedQueries() {
		return html`
			<div class="queries-master">
				<div class="section-header">
					Saved Queries
					<span class="section-count">${this.savedQueries.length}</span>
				</div>
				${this.savedQueries.map((q) => this.renderQueryItem(q))}
			</div>
		`;
	}

	private renderQueryItem(q: SavedQuery) {
		const isActive = this.activeQuery?.id === q.id;
		return html`
			<div class="query-item ${isActive ? "query-item--active" : ""}">
				<span class="query-name">${q.name}</span>
				<span class="query-meta">${q.sources.length} source${q.sources.length !== 1 ? "s" : ""}</span>
				<button
					class="delete-btn"
					data-action="delete-query"
					@click=${(e: Event) => { e.stopPropagation(); this.dispatchDeleteQuery(q.id); }}
				>x</button>
			</div>
		`;
	}

	private renderSourcePanel() {
		return html`
			<div class="source-panel">
				<div class="section-header">
					Sources
					<span class="section-count">${this.sources.length}</span>
				</div>
				${this.sources.map((s) => html`
					<div class="source-item">${s.displayName} (${s.alias})</div>
				`)}
			</div>
		`;
	}

	private renderQueryConfig() {
		const q = this.activeQuery!;
		const dimCount = q.dimensions?.length ?? 0;
		const measureCount = q.measures?.length ?? 0;

		return html`
			<div class="config-section">
				<div class="section-header">${q.name}</div>
				<div class="config-badges">
					${dimCount > 0 ? html`<span class="config-badge">${dimCount} dimension${dimCount !== 1 ? "s" : ""}</span>` : nothing}
					${measureCount > 0 ? html`<span class="config-badge">${measureCount} measure${measureCount !== 1 ? "s" : ""}</span>` : nothing}
					${q.sources.length > 0 ? html`<span class="config-badge">${q.sources.length} source${q.sources.length !== 1 ? "s" : ""}</span>` : nothing}
				</div>
				<div class="actions-bar" style="margin-top: var(--flowti-space-sm)">
					<button class="primary" data-action="run-query" @click=${this.dispatchRunQuery}>Run</button>
					<button data-action="save-query" @click=${() => this.dispatchSaveQuery(q.id)}>Save</button>
				</div>
			</div>
		`;
	}

	private renderResults() {
		const r = this.results!;
		const displayRows = r.rows.slice(0, 50);

		return html`
			<div class="results-panel">
				<div class="results-header">
					Results
					<span class="query-meta">${r.rows.length} rows / ${r.groupCount} groups / ${r.sourceRowCount} source rows</span>
				</div>
				${r.columns.length > 0 ? html`
					<table class="results-table">
						<thead>
							<tr>${r.columns.map((c) => html`<th>${c}</th>`)}</tr>
						</thead>
						<tbody>
							${displayRows.map((row) => html`
								<tr>${r.columns.map((c) => html`<td>${row[c] ?? ""}</td>`)}</tr>
							`)}
						</tbody>
					</table>
				` : nothing}
			</div>
		`;
	}
}

if (!customElements.get('flowti-analytics-queries')) customElements.define('flowti-analytics-queries', FlowtiAnalyticsQueries);
