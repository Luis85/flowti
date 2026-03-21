import { html, nothing } from 'lit';
import { FlowtiElement } from '../flowti-element.js';
import { masterDetailLayout, emptyState } from '../shared-styles.js';
import { analyticsQueriesStyles } from './flowti-analytics-queries-styles.js';
import { handleEditorScalar, handleEditorCollection } from './flowti-analytics-queries-handlers.js';

// Side-effect imports: register sub-components
import './flowti-query-editor.js';
import './flowti-query-results.js';

interface QuerySource {
	path: string;
	alias: string;
	displayName: string;
	headers?: string[];
}

interface SavedQuery {
	id: string;
	name: string;
	description?: string;
	sources: Array<{ csvPath: string; alias: string }>;
	joins: unknown[];
	columnTypeHints: Array<{ column: string; type: string; currencySymbol?: string; alias?: string }>;
	dimensions: Array<{ column: string }>;
	measures: Array<{ column: string; function: string; label?: string }>;
	filters?: Array<{ column: string; operator: string; value: string }>;
	sorts?: Array<{ column: string; direction: 'asc' | 'desc' }>;
	limit?: number | null;
	timeBucket?: { column: string; period: string } | null;
	createdAt: number;
	isFavorite?: boolean;
}

interface QueryResult {
	columns: string[];
	rows: Array<Record<string, string | number>>;
	groupCount: number;
	sourceRowCount: number;
}

type EditorMode = 'list' | 'edit' | 'new';

/**
 * Analytics queries component — query builder with source panel,
 * saved queries list, editor, and results preview.
 *
 * @fires select-query - detail: { queryId } when a query item is clicked
 * @fires run-query - detail: { queryId, config? } when the run button is clicked
 * @fires save-query - detail: { queryId, config? } when save is clicked
 * @fires delete-query - detail: { queryId } when delete is clicked
 * @fires new-query - detail: { config } when creating a new query
 * @fires export-csv - detail: { queryId } when export is requested
 */
export class FlowtiAnalyticsQueries extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		sources: { type: Array },
		savedQueries: { type: Array },
		activeQuery: { type: Object },
		results: { type: Object },
		editorMode: { state: true },
		editorConfig: { state: true },
		chartMode: { state: true },
		errorMessage: { state: true },
		durationMs: { state: true },
	};

	static styles = [
		...FlowtiElement.styles,
		masterDetailLayout,
		emptyState,
		analyticsQueriesStyles,
	];

	sources: QuerySource[] = [];
	savedQueries: SavedQuery[] = [];
	activeQuery: SavedQuery | null = null;
	results: QueryResult | null = null;
	editorMode: EditorMode = 'list';
	editorConfig: Partial<SavedQuery> = {};
	chartMode: 'line' | 'bar' | 'none' = 'none';
	errorMessage = '';
	durationMs = 0;

	private dispatchSelectQuery(queryId: string): void {
		this.activeQuery = this.savedQueries.find((q) => q.id === queryId) ?? null;
		this.editorMode = 'list';
		this.results = null;
		this.errorMessage = '';
		this.dispatchEvent(
			new CustomEvent('select-query', {
				detail: { queryId },
				bubbles: true,
				composed: true,
			}),
		);
	}

	private dispatchRunQuery(): void {
		const queryId = this.activeQuery?.id ?? '';
		this.dispatchEvent(
			new CustomEvent('run-query', {
				detail: { queryId },
				bubbles: true,
				composed: true,
			}),
		);
	}

	private dispatchSaveQuery(queryId: string): void {
		this.dispatchEvent(
			new CustomEvent('save-query', {
				detail: { queryId },
				bubbles: true,
				composed: true,
			}),
		);
	}

	private dispatchDeleteQuery(queryId: string): void {
		this.dispatchEvent(
			new CustomEvent('delete-query', {
				detail: { queryId },
				bubbles: true,
				composed: true,
			}),
		);
	}

	private openEditor(query: SavedQuery): void {
		this.activeQuery = query;
		this.editorMode = 'edit';
		this.editorConfig = { ...query };
		this.results = null;
		this.errorMessage = '';
	}

	private openNewQuery(): void {
		this.editorMode = 'new';
		this.activeQuery = null;
		this.results = null;
		this.errorMessage = '';
		this.editorConfig = {
			name: 'New Query',
			sources: [],
			joins: [],
			columnTypeHints: [],
			dimensions: [],
			measures: [],
			filters: [],
			sorts: [],
			limit: null,
			timeBucket: null,
		};
		this.dispatchEvent(
			new CustomEvent('new-query', {
				detail: { config: this.editorConfig },
				bubbles: true,
				composed: true,
			}),
		);
	}

	private closeEditor(): void {
		this.editorMode = 'list';
		this.editorConfig = {};
	}

	get editorHeaders(): string[] {
		const selectedAliases = new Set(
			(this.editorConfig.sources ?? []).map((s) => s.alias),
		);
		const allHeaders: string[] = [];
		for (const src of this.sources) {
			if (selectedAliases.has(src.alias) && src.headers) {
				for (const h of src.headers) {
					if (!allHeaders.includes(h)) allHeaders.push(h);
				}
			}
		}
		return allHeaders;
	}

	private get selectedSourceAliases(): string[] {
		return (this.editorConfig.sources ?? []).map((s) => s.alias);
	}

	private handleEditorEvent(e: CustomEvent): void {
		const type = e.type;
		const detail = e.detail as Record<string, unknown>;
		if (handleEditorScalar(this, type, detail)) return;
		if (handleEditorCollection(this, type, detail)) return;
		if (type === 'run-query') this.dispatchRunQuery();
		else if (type === 'save-query') this.dispatchSaveQuery(this.activeQuery?.id ?? '');
		else if (type === 'reset-query' && this.activeQuery) this.editorConfig = { ...this.activeQuery };
		else if (type === 'cancel-edit') this.closeEditor();
	}

	private handleResultsEvent(e: CustomEvent): void {
		const type = e.type;
		const detail = e.detail as Record<string, unknown>;
		switch (type) {
			case 'toggle-chart-mode':
				this.chartMode = detail.mode as 'line' | 'bar' | 'none';
				break;
			case 'export-csv':
				this.dispatchEvent(
					new CustomEvent('export-csv', {
						detail: { queryId: this.activeQuery?.id ?? '' },
						bubbles: true,
						composed: true,
					}),
				);
				break;
		}
	}

	protected renderContent() {
		if (this.sources.length === 0 && this.savedQueries.length === 0) {
			return html`
				<div class="empty-state">
					<div class="empty-state__message">Add a CSV source to build a query</div>
				</div>
			`;
		}
		if (this.editorMode === 'edit' || this.editorMode === 'new') {
			return html`
				<div class="queries-layout">
					${this.renderEditorPanel()}
					${this.results ? this.renderResultsPanel() : nothing}
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
					<button class="new-query-btn" data-action="new-query" @click=${() => this.openNewQuery()}>New Query</button>
				</div>
				${this.savedQueries.map((q) => this.renderQueryItem(q))}
			</div>
		`;
	}

	private renderQueryItem(q: SavedQuery) {
		const isActive = this.activeQuery?.id === q.id;
		return html`
			<div
				class="query-item ${isActive ? 'query-item--active' : ''}"
				data-query-id=${q.id}
				@click=${() => this.dispatchSelectQuery(q.id)}
			>
				<span class="query-name">${q.name}</span>
				<span class="query-meta">${q.sources.length} source${q.sources.length !== 1 ? 's' : ''}</span>
				<button
					class="edit-btn"
					data-action="edit-query"
					@click=${(e: Event) => { e.stopPropagation(); this.openEditor(q); }}
				>Edit</button>
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
				${this.savedQueries.length === 0 ? html`
					<div style="margin-top: var(--flowti-space-sm)">
						<button class="primary" data-action="new-query" @click=${() => this.openNewQuery()}>New Query</button>
					</div>
				` : nothing}
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
					${dimCount > 0 ? html`<span class="config-badge">${dimCount} dimension${dimCount !== 1 ? 's' : ''}</span>` : nothing}
					${measureCount > 0 ? html`<span class="config-badge">${measureCount} measure${measureCount !== 1 ? 's' : ''}</span>` : nothing}
					${q.sources.length > 0 ? html`<span class="config-badge">${q.sources.length} source${q.sources.length !== 1 ? 's' : ''}</span>` : nothing}
				</div>
				<div class="actions-bar" style="margin-top: var(--flowti-space-sm)">
					<button class="primary" data-action="run-query" @click=${this.dispatchRunQuery}>Run</button>
					<button data-action="save-query" @click=${() => this.dispatchSaveQuery(q.id)}>Save</button>
					<button data-action="edit-query" @click=${() => this.openEditor(q)}>Edit</button>
				</div>
			</div>
		`;
	}

	private renderEditorPanel() {
		return html`
			<flowti-query-editor
				query-name=${this.editorConfig.name ?? 'New Query'}
				.sources=${this.sources}
				.selectedSources=${this.selectedSourceAliases}
				.headers=${this.editorHeaders}
				.columnTypeHints=${this.editorConfig.columnTypeHints ?? []}
				.filters=${this.editorConfig.filters ?? []}
				.dimensions=${this.editorConfig.dimensions ?? []}
				.measures=${this.editorConfig.measures ?? []}
				.timeBucket=${this.editorConfig.timeBucket ?? null}
				.sorts=${this.editorConfig.sorts ?? []}
				.limit=${this.editorConfig.limit ?? null}
				.running=${false}
				.hasChanges=${true}
				.isNewQuery=${this.editorMode === 'new'}
				@update-query-name=${this.handleEditorEvent}
				@toggle-source=${this.handleEditorEvent}
				@add-filter=${this.handleEditorEvent}
				@update-filter=${this.handleEditorEvent}
				@remove-filter=${this.handleEditorEvent}
				@toggle-dimension=${this.handleEditorEvent}
				@add-measure=${this.handleEditorEvent}
				@update-measure=${this.handleEditorEvent}
				@remove-measure=${this.handleEditorEvent}
				@update-time-bucket=${this.handleEditorEvent}
				@add-sort=${this.handleEditorEvent}
				@update-sort=${this.handleEditorEvent}
				@remove-sort=${this.handleEditorEvent}
				@update-limit=${this.handleEditorEvent}
				@run-query=${this.handleEditorEvent}
				@save-query=${this.handleEditorEvent}
				@reset-query=${this.handleEditorEvent}
				@cancel-edit=${this.handleEditorEvent}
			></flowti-query-editor>
		`;
	}

	private renderResultsPanel() {
		return html`
			<flowti-query-results
				.results=${this.results}
				chart-mode=${this.chartMode}
				error-message=${this.errorMessage}
				duration-ms=${this.durationMs}
				@toggle-chart-mode=${this.handleResultsEvent}
				@export-csv=${this.handleResultsEvent}
			></flowti-query-results>
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
								<tr>${r.columns.map((c) => html`<td>${row[c] ?? ''}</td>`)}</tr>
							`)}
						</tbody>
					</table>
				` : nothing}
			</div>
		`;
	}
}

if (!customElements.get('flowti-analytics-queries')) customElements.define('flowti-analytics-queries', FlowtiAnalyticsQueries);
