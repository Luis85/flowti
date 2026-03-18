import { html, css, nothing } from 'lit';
import { FlowtiElement } from '../flowti-element.js';

/** Aggregation function options for measures. */
const AGG_FUNCTIONS = ['SUM', 'COUNT', 'AVG', 'MIN', 'MAX', 'COUNT_DISTINCT'] as const;

/** Time bucket period options. */
const TIME_PERIODS = ['day', 'week', 'month', 'quarter', 'year'] as const;

/** Operators for string columns. */
const STRING_OPERATORS = [
	{ id: '=', label: '=' },
	{ id: '!=', label: '!=' },
	{ id: 'contains', label: 'contains' },
	{ id: 'startsWith', label: 'starts with' },
] as const;

/** Operators for numeric and date columns. */
const NUMERIC_OPERATORS = [
	{ id: '=', label: '=' },
	{ id: '!=', label: '!=' },
	{ id: '>', label: '>' },
	{ id: '<', label: '<' },
	{ id: '>=', label: '>=' },
	{ id: '<=', label: '<=' },
] as const;

interface SourceItem {
	path: string;
	alias: string;
	displayName: string;
	headers?: string[];
}

interface FilterSpec {
	column: string;
	operator: string;
	value: string;
}

interface DimensionSpec {
	column: string;
}

interface MeasureSpec {
	column: string;
	function: string;
	label?: string;
}

interface SortSpec {
	column: string;
	direction: 'asc' | 'desc';
}

interface TimeBucketSpec {
	column: string;
	period: string;
}

interface ColumnTypeHint {
	column: string;
	type: string;
	currencySymbol?: string;
	alias?: string;
}

/**
 * Query editor component — form for building/editing analytics queries.
 *
 * Renders source selection, filter builder, dimension/measure configuration,
 * time bucket settings, sort/limit controls, and action buttons.
 *
 * @property queryName - Name for the query being edited
 * @property sources - Available data sources with headers
 * @property selectedSources - Source aliases currently included in the query
 * @property headers - All available column headers from selected sources
 * @property columnTypeHints - Type hints for columns
 * @property filters - Current filter specifications
 * @property dimensions - Current dimension (group by) columns
 * @property measures - Current measure/aggregation specifications
 * @property timeBucket - Current time bucket configuration (or null)
 * @property sorts - Current sort specifications
 * @property limit - Row limit (or null for unlimited)
 * @property running - Whether a query is currently executing
 * @property hasChanges - Whether the query has unsaved changes
 * @property isNewQuery - Whether this is a new unsaved query
 *
 * @fires update-query-name - detail: { name }
 * @fires toggle-source - detail: { alias }
 * @fires add-filter - no detail
 * @fires update-filter - detail: { index, filter }
 * @fires remove-filter - detail: { index }
 * @fires toggle-dimension - detail: { column }
 * @fires add-measure - no detail
 * @fires update-measure - detail: { index, measure }
 * @fires remove-measure - detail: { index }
 * @fires update-time-bucket - detail: { timeBucket } (null to disable)
 * @fires add-sort - no detail
 * @fires update-sort - detail: { index, sort }
 * @fires remove-sort - detail: { index }
 * @fires update-limit - detail: { limit } (null to disable)
 * @fires run-query - no detail
 * @fires save-query - no detail
 * @fires reset-query - no detail
 * @fires cancel-edit - no detail
 */
export class FlowtiQueryEditor extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		queryName: { type: String, attribute: 'query-name' },
		sources: { type: Array },
		selectedSources: { type: Array },
		headers: { type: Array },
		columnTypeHints: { type: Array },
		filters: { type: Array },
		dimensions: { type: Array },
		measures: { type: Array },
		timeBucket: { type: Object },
		sorts: { type: Array },
		limit: { type: Number },
		running: { type: Boolean },
		hasChanges: { type: Boolean },
		isNewQuery: { type: Boolean },
	};

	static styles = [
		...FlowtiElement.styles,
		css`
			.editor-layout {
				display: flex;
				flex-direction: column;
				gap: var(--flowti-space-md);
			}

			.editor-header {
				display: flex;
				align-items: center;
				gap: var(--flowti-space-sm);
			}

			.editor-header input {
				flex: 1;
				font-size: 1.1em;
				font-weight: 600;
				border: none;
				border-bottom: 2px solid transparent;
				background: transparent;
				color: var(--text-normal, inherit);
				padding: var(--flowti-space-xs) 0;
			}

			.editor-header input:focus {
				outline: none;
				border-bottom-color: var(--interactive-accent, #5a7);
			}

			.card {
				background: var(--background-secondary);
				border-radius: var(--flowti-radius);
				padding: var(--flowti-space-md);
				display: flex;
				flex-direction: column;
				gap: var(--flowti-space-sm);
			}

			.card-title {
				font-size: var(--flowti-font-sm);
				font-weight: 600;
				color: var(--flowti-color-muted);
				display: flex;
				align-items: center;
				gap: var(--flowti-space-sm);
			}

			.card-description {
				font-size: var(--flowti-font-sm);
				color: var(--flowti-color-muted);
				opacity: 0.8;
			}

			.badge {
				font-size: var(--flowti-font-sm);
				background: var(--background-primary);
				padding: 0 var(--flowti-space-xs);
				border-radius: var(--flowti-radius);
				color: var(--flowti-color-muted);
			}

			.row {
				display: flex;
				align-items: center;
				gap: var(--flowti-space-sm);
				flex-wrap: wrap;
			}

			.row-padded {
				padding: var(--flowti-space-xs) 0;
			}

			.row-bordered {
				padding: var(--flowti-space-xs) 0;
				border-bottom: 1px solid var(--flowti-border);
			}

			select, .input-field {
				padding: 2px 6px;
				font-size: var(--flowti-font-sm);
				background: var(--background-primary);
				border: 1px solid var(--flowti-border);
				border-radius: var(--flowti-radius);
				color: var(--text-normal, inherit);
			}

			.input-field {
				width: 80px;
			}

			.input-alias {
				width: 120px;
			}

			.ml-auto {
				margin-left: auto;
			}

			.text-muted {
				font-size: var(--flowti-font-sm);
				color: var(--flowti-color-muted);
			}

			.link-btn {
				font-size: var(--flowti-font-sm);
				cursor: pointer;
				color: var(--text-accent, #5a7);
				background: none;
				border: none;
				padding: 2px var(--flowti-space-xs);
			}

			.link-btn:hover {
				text-decoration: underline;
			}

			.remove-btn {
				font-size: var(--flowti-font-sm);
				color: var(--flowti-color-muted);
				cursor: pointer;
				background: none;
				border: none;
				padding: 2px;
			}

			.remove-btn:hover {
				color: var(--flowti-color-error);
			}

			.source-chip {
				display: inline-flex;
				align-items: center;
				gap: var(--flowti-space-xs);
				padding: var(--flowti-space-xs) var(--flowti-space-sm);
				border-radius: var(--flowti-radius);
				font-size: var(--flowti-font-sm);
				cursor: pointer;
				border: 1px solid var(--flowti-border);
				background: var(--background-primary);
			}

			.source-chip--selected {
				background: var(--interactive-accent, #5a7);
				color: white;
				border-color: transparent;
			}

			.dim-checkbox {
				display: flex;
				align-items: center;
				gap: var(--flowti-space-xs);
				font-size: var(--flowti-font-sm);
			}

			.actions-bar {
				display: flex;
				gap: var(--flowti-space-sm);
				padding-top: var(--flowti-space-sm);
				border-top: 1px solid var(--flowti-border);
			}

			button.primary {
				background: var(--interactive-accent, #5a7);
				color: white;
				border-color: transparent;
			}

			button.primary:disabled {
				opacity: 0.5;
				cursor: not-allowed;
			}

			.divider {
				border-top: 1px solid var(--flowti-border);
				margin: var(--flowti-space-xs) 0;
			}

			.col-grid {
				display: grid;
				grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
				gap: var(--flowti-space-xs);
			}

			.col-item {
				display: flex;
				align-items: center;
				gap: var(--flowti-space-xs);
				padding: 2px var(--flowti-space-xs);
				font-size: var(--flowti-font-sm);
				border-radius: var(--flowti-radius);
			}

			.col-item:hover {
				background: var(--background-modifier-hover);
			}

			.col-type-badge {
				font-size: 0.75em;
				padding: 0 4px;
				border-radius: 3px;
				background: var(--background-primary);
				color: var(--flowti-color-muted);
			}
		`,
	];

	queryName = '';
	sources: SourceItem[] = [];
	selectedSources: string[] = [];
	headers: string[] = [];
	columnTypeHints: ColumnTypeHint[] = [];
	filters: FilterSpec[] = [];
	dimensions: DimensionSpec[] = [];
	measures: MeasureSpec[] = [];
	timeBucket: TimeBucketSpec | null = null;
	sorts: SortSpec[] = [];
	limit: number | null = null;
	running = false;
	hasChanges = false;
	isNewQuery = false;

	private emit(name: string, detail?: unknown): void {
		this.dispatchEvent(
			new CustomEvent(name, {
				detail: detail ?? {},
				bubbles: true,
				composed: true,
			}),
		);
	}

	private getColumnType(column: string): string {
		const hint = this.columnTypeHints.find((h: ColumnTypeHint) => h.column === column);
		return hint?.type ?? 'string';
	}

	private get dateColumns(): string[] {
		return this.columnTypeHints
			.filter((h: ColumnTypeHint) => h.type === 'date')
			.map((h: ColumnTypeHint) => h.column);
	}

	private get hasMeasures(): boolean {
		return this.measures.length > 0;
	}

	protected renderContent() {
		return html`
			<div class="editor-layout">
				${this.renderEditorHeader()}
				${this.renderSourceSelection()}
				${this.headers.length > 0 ? html`
					${this.renderFilterBuilder()}
					${this.renderDimensions()}
					${this.renderMeasures()}
					${this.dateColumns.length > 0 ? this.renderTimeBucket() : nothing}
					${this.renderSortAndLimit()}
				` : nothing}
				${this.renderActionsBar()}
			</div>
		`;
	}

	private renderEditorHeader() {
		return html`
			<div class="editor-header">
				<input
					type="text"
					.value=${this.queryName}
					placeholder="Query name"
					@change=${(e: Event) => this.emit('update-query-name', { name: (e.target as HTMLInputElement).value })}
				/>
				<button class="link-btn" @click=${() => this.emit('cancel-edit')}>Cancel</button>
			</div>
		`;
	}

	private renderSourceSelection() {
		if (this.sources.length === 0) return nothing;
		const selectedSet = new Set(this.selectedSources);

		return html`
			<div class="card">
				<div class="card-title">
					Sources
					<span class="badge">${this.selectedSources.length}/${this.sources.length}</span>
				</div>
				<div class="card-description">Select CSV sources to query against.</div>
				<div class="row" style="flex-wrap: wrap">
					${this.sources.map((s) => html`
						<span
							class="source-chip ${selectedSet.has(s.alias) ? 'source-chip--selected' : ''}"
							data-source="${s.alias}"
							@click=${() => this.emit('toggle-source', { alias: s.alias })}
						>${s.displayName} (${s.alias})</span>
					`)}
				</div>
			</div>
		`;
	}

	private renderFilterBuilder() {
		return html`
			<div class="card">
				<div class="card-title">
					Filters
					${this.filters.length > 0 ? html`<span class="badge">${this.filters.length}</span>` : nothing}
					<button class="link-btn ml-auto" data-action="add-filter" @click=${() => this.emit('add-filter')}>+ Add</button>
				</div>
				${this.filters.length === 0
					? html`<div class="text-muted">No filters — all rows included</div>`
					: this.filters.map((f, i) => this.renderFilterRow(f, i))
				}
			</div>
		`;
	}

	private renderFilterRow(filter: FilterSpec, index: number) {
		const colType = this.getColumnType(filter.column);
		const operators = colType === 'string' ? STRING_OPERATORS : NUMERIC_OPERATORS;

		return html`
			<div class="row row-bordered">
				<select
					.value=${filter.column}
					@change=${(e: Event) => this.emit('update-filter', {
						index,
						filter: { ...filter, column: (e.target as HTMLSelectElement).value, operator: '=' },
					})}
				>
					${this.headers.map((h) => html`<option value=${h} ?selected=${h === filter.column}>${h}</option>`)}
				</select>
				<select
					.value=${filter.operator}
					@change=${(e: Event) => this.emit('update-filter', {
						index,
						filter: { ...filter, operator: (e.target as HTMLSelectElement).value },
					})}
				>
					${operators.map((op) => html`<option value=${op.id} ?selected=${op.id === filter.operator}>${op.label}</option>`)}
				</select>
				<input
					class="input-field"
					type="text"
					.value=${filter.value}
					placeholder="Value"
					@change=${(e: Event) => this.emit('update-filter', {
						index,
						filter: { ...filter, value: (e.target as HTMLInputElement).value },
					})}
				/>
				<button class="remove-btn" @click=${() => this.emit('remove-filter', { index })}>x</button>
			</div>
		`;
	}

	private renderDimensions() {
		const dimSet = new Set(this.dimensions.map((d: DimensionSpec) => d.column));

		return html`
			<div class="card">
				<div class="card-title">
					Dimensions (Group By)
					${this.dimensions.length > 0 ? html`<span class="badge">${this.dimensions.length}</span>` : nothing}
				</div>
				<div class="card-description">Select columns to group results by.</div>
				<div class="col-grid">
					${this.headers.map((col) => {
						const colType = this.getColumnType(col);
						return html`
							<label class="col-item dim-checkbox">
								<input
									type="checkbox"
									?checked=${dimSet.has(col)}
									@change=${() => this.emit('toggle-dimension', { column: col })}
								/>
								${col}
								<span class="col-type-badge">${colType}</span>
							</label>
						`;
					})}
				</div>
			</div>
		`;
	}

	private renderMeasures() {
		return html`
			<div class="card">
				<div class="card-title">
					Measures
					${this.measures.length > 0 ? html`<span class="badge">${this.measures.length}</span>` : nothing}
					<button class="link-btn ml-auto" data-action="add-measure" @click=${() => this.emit('add-measure')}>+ Add</button>
				</div>
				<div class="card-description">Aggregate columns using SUM, COUNT, AVG, etc.</div>
				${this.measures.length === 0
					? html`<div class="text-muted">Add at least one measure to run a query</div>`
					: this.measures.map((m, i) => this.renderMeasureRow(m, i))
				}
			</div>
		`;
	}

	private renderMeasureRow(measure: MeasureSpec, index: number) {
		return html`
			<div class="row row-bordered">
				<select
					.value=${measure.function}
					@change=${(e: Event) => this.emit('update-measure', {
						index,
						measure: { ...measure, function: (e.target as HTMLSelectElement).value },
					})}
				>
					${AGG_FUNCTIONS.map((fn) => html`<option value=${fn} ?selected=${fn === measure.function}>${fn}</option>`)}
				</select>
				<span class="text-muted">(</span>
				<select
					.value=${measure.column}
					@change=${(e: Event) => this.emit('update-measure', {
						index,
						measure: { ...measure, column: (e.target as HTMLSelectElement).value },
					})}
				>
					${this.headers.map((h) => html`<option value=${h} ?selected=${h === measure.column}>${h}</option>`)}
				</select>
				<span class="text-muted">)</span>
				<span class="text-muted">as</span>
				<input
					class="input-field input-alias"
					type="text"
					.value=${measure.label ?? ''}
					placeholder="${measure.function}(${measure.column})"
					@change=${(e: Event) => this.emit('update-measure', {
						index,
						measure: { ...measure, label: (e.target as HTMLInputElement).value || undefined },
					})}
				/>
				<button class="remove-btn" @click=${() => this.emit('remove-measure', { index })}>x</button>
			</div>
		`;
	}

	private renderTimeBucket() {
		const dateCols = this.dateColumns;
		const enabled = this.timeBucket !== null;

		return html`
			<div class="card">
				<div class="card-title">Time Bucket</div>
				<div class="card-description">Group rows by a date column into time periods for trend analysis.</div>
				<div class="row row-padded">
					<input
						type="checkbox"
						?checked=${enabled}
						@change=${(e: Event) => {
							const checked = (e.target as HTMLInputElement).checked;
							this.emit('update-time-bucket', {
								timeBucket: checked ? { column: dateCols[0], period: 'month' } : null,
							});
						}}
					/>
					${enabled && this.timeBucket ? html`
						<select
							.value=${this.timeBucket.column}
							@change=${(e: Event) => this.emit('update-time-bucket', {
								timeBucket: { ...this.timeBucket, column: (e.target as HTMLSelectElement).value },
							})}
						>
							${dateCols.map((c) => html`<option value=${c} ?selected=${c === this.timeBucket?.column}>${c}</option>`)}
						</select>
						<span class="text-muted">by</span>
						<select
							.value=${this.timeBucket.period}
							@change=${(e: Event) => this.emit('update-time-bucket', {
								timeBucket: { ...this.timeBucket, period: (e.target as HTMLSelectElement).value },
							})}
						>
							${TIME_PERIODS.map((p) => html`<option value=${p} ?selected=${p === this.timeBucket?.period}>${p}</option>`)}
						</select>
					` : html`<span class="text-muted">Enable time bucketing</span>`}
				</div>
			</div>
		`;
	}

	private renderSortAndLimit() {
		return html`
			<div class="card">
				<div class="card-title">
					Sort & Limit
					${this.sorts.length > 0 ? html`<span class="badge">${this.sorts.length}</span>` : nothing}
					<button class="link-btn ml-auto" data-action="add-sort" @click=${() => this.emit('add-sort')}>+ Add Sort</button>
				</div>
				${this.sorts.length === 0
					? html`<div class="text-muted">No sort columns</div>`
					: this.sorts.map((s, i) => this.renderSortRow(s, i))
				}
				<div class="divider"></div>
				${this.renderLimitRow()}
			</div>
		`;
	}

	private renderSortRow(sort: SortSpec, index: number) {
		return html`
			<div class="row row-bordered">
				<span class="text-muted">${index === 0 ? 'Sort by' : 'then by'}</span>
				<select
					.value=${sort.column}
					@change=${(e: Event) => this.emit('update-sort', {
						index,
						sort: { ...sort, column: (e.target as HTMLSelectElement).value },
					})}
				>
					${this.headers.map((h) => html`<option value=${h} ?selected=${h === sort.column}>${h}</option>`)}
				</select>
				<select
					.value=${sort.direction}
					@change=${(e: Event) => this.emit('update-sort', {
						index,
						sort: { ...sort, direction: (e.target as HTMLSelectElement).value },
					})}
				>
					<option value="asc" ?selected=${sort.direction === 'asc'}>Ascending</option>
					<option value="desc" ?selected=${sort.direction === 'desc'}>Descending</option>
				</select>
				<button class="remove-btn" @click=${() => this.emit('remove-sort', { index })}>x</button>
			</div>
		`;
	}

	private renderLimitRow() {
		const enabled = this.limit !== null;
		return html`
			<div class="row row-padded">
				<input
					type="checkbox"
					?checked=${enabled}
					@change=${(e: Event) => {
						const checked = (e.target as HTMLInputElement).checked;
						this.emit('update-limit', { limit: checked ? 10 : null });
					}}
				/>
				${enabled ? html`
					<span class="text-muted">Max rows</span>
					<input
						class="input-field"
						type="number"
						min="0"
						.value=${String(this.limit ?? 10)}
						@change=${(e: Event) => {
							const val = parseInt((e.target as HTMLInputElement).value, 10);
							this.emit('update-limit', { limit: isNaN(val) ? null : val });
						}}
					/>
				` : html`<span class="text-muted">Enable row limit</span>`}
			</div>
		`;
	}

	private renderActionsBar() {
		return html`
			<div class="actions-bar">
				<button
					class="primary"
					data-action="run-query"
					?disabled=${this.running || !this.hasMeasures}
					@click=${() => this.emit('run-query')}
				>${this.running ? 'Running...' : 'Run Query'}</button>
				<button data-action="reset-query" @click=${() => this.emit('reset-query')}>Reset</button>
				${this.hasChanges && this.hasMeasures ? html`
					<button data-action="save-query" @click=${() => this.emit('save-query')}>Save</button>
				` : nothing}
				<button @click=${() => this.emit('cancel-edit')}>Cancel</button>
			</div>
		`;
	}
}

if (!customElements.get('flowti-query-editor')) customElements.define('flowti-query-editor', FlowtiQueryEditor);
