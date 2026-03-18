import { html, css, nothing } from 'lit';
import { FlowtiElement } from '../flowti-element.js';
import { statusBadge, emptyState, statCardGrid } from '../shared-styles.js';
import type { WizardStep } from './flowti-wizard.js';
import './flowti-wizard.js';

export interface BaseView {
	name: string;
	type: string;
	columnCount: number;
	hasFilters: boolean;
}

export interface ExportColumn {
	key: string;
	label: string;
	selected: boolean;
	source: 'frontmatter' | 'file';
}

export interface ExportResultData {
	totalRows: number;
	totalColumns: number;
	outputPath: string;
	skipped?: boolean;
}

export interface SavedExportConfig {
	id: string;
	name: string;
}

type ExportWizardPage = 'view-select' | 'configure' | 'preview' | 'result';

const BASE_STEPS: WizardStep[] = [
	{ id: 'view-select', label: 'Select View' },
	{ id: 'configure', label: 'Configure' },
	{ id: 'preview', label: 'Preview' },
	{ id: 'result', label: 'Result' },
];

const FOLDER_STEPS: WizardStep[] = [
	{ id: 'configure', label: 'Configure' },
	{ id: 'preview', label: 'Preview' },
	{ id: 'result', label: 'Result' },
];

/**
 * Export wizard — 3-4 steps depending on source type.
 * Base source: view-select -> configure -> preview -> result
 * Folder source: configure -> preview -> result
 *
 * @property sourcePath - Path to the source folder or .base file
 * @property sourceType - Source type: 'folder' or 'base'
 * @property format - Export format: 'csv' or 'tab'
 * @property outputPath - Output file path
 * @property isExternal - Whether output path is external to vault
 * @property baseViews - Available base views (for base source)
 * @property selectedViewIndex - Currently selected view index
 * @property columns - Array of available export columns
 * @property conflictStrategy - How to handle existing output file
 * @property previewFileCount - Number of files to export
 * @property previewRows - Preview data rows
 * @property previewHeaders - Preview column headers
 * @property exportResult - Export result data (null if not done)
 * @property exportError - Export error message (null if none)
 * @property savedConfigs - Saved export configurations
 * @property loadedConfigName - Name of the loaded config (null if none)
 *
 * @fires navigate-page - detail: { page } when internal page changes
 * @fires run-export - When the export action is triggered
 * @fires select-view - detail: { viewIndex } when a base view is selected
 * @fires update-config - detail: { field, value } when a config field changes
 * @fires toggle-column - detail: { key, selected } when column selection changes
 * @fires close - When the wizard should be closed
 * @fires save-config - When save config is requested
 * @fires load-config - detail: { configId } when a config is loaded
 */
export class FlowtiExportWizard extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		sourcePath: { type: String, attribute: 'source-path' },
		sourceType: { type: String, attribute: 'source-type' },
		format: { type: String },
		outputPath: { type: String },
		isExternal: { type: Boolean },
		baseViews: { type: Array },
		selectedViewIndex: { type: Number },
		columns: { type: Array },
		conflictStrategy: { type: String },
		previewFileCount: { type: Number },
		previewRows: { type: Array },
		previewHeaders: { type: Array },
		exportResult: { type: Object },
		exportError: { type: String },
		savedConfigs: { type: Array },
		loadedConfigName: { type: String },
		_currentPage: { type: String, state: true },
	};

	static styles = [
		...FlowtiElement.styles,
		statusBadge,
		emptyState,
		statCardGrid,
		css`
			:host {
				display: flex;
				flex-direction: column;
				height: 100%;
			}

			.page-content {
				padding: var(--flowti-space-md);
			}

			.info-grid {
				display: grid;
				grid-template-columns: auto 1fr;
				gap: var(--flowti-space-xs) var(--flowti-space-md);
				font-size: var(--flowti-font-sm);
			}

			.info-label {
				color: var(--flowti-color-muted);
				font-weight: 500;
			}

			.card {
				padding: var(--flowti-space-md);
				border-radius: var(--flowti-radius);
				background: var(--background-secondary);
				margin-bottom: var(--flowti-space-md);
			}

			.card-selected {
				border: 2px solid var(--flowti-color-info);
			}

			.card-title {
				font-weight: 600;
				font-size: var(--flowti-font-sm);
				margin-bottom: var(--flowti-space-sm);
			}

			.nav-link {
				color: var(--flowti-color-info);
				cursor: pointer;
				text-decoration: none;
				font-size: var(--flowti-font-sm);
			}

			.nav-link:hover {
				text-decoration: underline;
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

			.btn-primary {
				background: color-mix(in srgb, var(--flowti-color-info) 15%, transparent);
				border-color: var(--flowti-color-info);
			}

			.actions-row {
				display: flex;
				flex-wrap: wrap;
				gap: var(--flowti-space-sm);
				align-items: center;
			}

			.preview-table {
				width: 100%;
				border-collapse: collapse;
				font-size: var(--flowti-font-sm);
			}

			.preview-table th,
			.preview-table td {
				text-align: left;
				padding: var(--flowti-space-xs) var(--flowti-space-sm);
				border-bottom: 1px solid var(--flowti-border);
			}

			.preview-table th {
				font-weight: 600;
				color: var(--flowti-color-muted);
			}

			.badge {
				display: inline-flex;
				padding: 2px var(--flowti-space-sm);
				border-radius: var(--flowti-radius);
				font-size: var(--flowti-font-sm);
				background: var(--background-secondary);
				color: var(--flowti-color-muted);
			}

			.badge-accent {
				background: color-mix(in srgb, var(--flowti-color-info) 15%, transparent);
				color: var(--flowti-color-info);
			}

			.text-success {
				color: var(--flowti-color-success);
			}

			.text-error {
				color: var(--flowti-color-error);
			}

			.text-muted {
				color: var(--flowti-color-muted);
				font-size: var(--flowti-font-sm);
			}

			.progress-pulse {
				height: 6px;
				background: var(--background-modifier-border);
				border-radius: 3px;
				overflow: hidden;
				margin-top: var(--flowti-space-sm);
			}

			.status-icon {
				font-size: 1.2em;
				margin-right: var(--flowti-space-xs);
			}

			.header-row {
				display: flex;
				align-items: center;
				gap: var(--flowti-space-sm);
				margin-bottom: var(--flowti-space-md);
			}

			.table-scroll {
				overflow-x: auto;
			}

			.view-card {
				display: flex;
				align-items: center;
				gap: var(--flowti-space-md);
				padding: var(--flowti-space-md);
				cursor: pointer;
				border-radius: var(--flowti-radius);
				background: var(--background-secondary);
				margin-bottom: var(--flowti-space-sm);
			}

			.view-card:hover {
				background: var(--background-modifier-hover);
			}

			.view-card--selected {
				border: 2px solid var(--flowti-color-info);
			}

			.view-name {
				font-weight: 600;
			}

			.view-meta {
				font-size: var(--flowti-font-sm);
				color: var(--flowti-color-muted);
			}

			.column-row {
				display: flex;
				align-items: center;
				gap: var(--flowti-space-sm);
				padding: var(--flowti-space-xs) 0;
				font-size: var(--flowti-font-sm);
			}

			.column-label {
				flex: 1;
			}

			.column-source {
				color: var(--flowti-color-muted);
			}
		`,
	];

	sourcePath = '';
	sourceType: 'folder' | 'base' = 'folder';
	format: 'csv' | 'tab' = 'csv';
	outputPath = '';
	isExternal = false;
	baseViews: BaseView[] = [];
	selectedViewIndex = 0;
	columns: ExportColumn[] = [];
	conflictStrategy: 'overwrite' | 'skip' | 'append' = 'overwrite';
	previewFileCount = 0;
	previewRows: string[][] = [];
	previewHeaders: string[] = [];
	exportResult: ExportResultData | null = null;
	exportError: string | null = null;
	savedConfigs: SavedExportConfig[] = [];
	loadedConfigName: string | null = null;
	private _currentPage: ExportWizardPage = 'configure';

	connectedCallback(): void {
		super.connectedCallback();
		if (this.sourceType === 'base' && !this._currentPage) {
			this._currentPage = 'view-select';
		} else if (!this._currentPage) {
			this._currentPage = 'configure';
		}
	}

	private get steps(): WizardStep[] {
		return this.sourceType === 'base' ? BASE_STEPS : FOLDER_STEPS;
	}

	private onStepChange(e: CustomEvent): void {
		this._currentPage = e.detail.stepId as ExportWizardPage;
		this.emit('navigate-page', { page: this._currentPage });
	}

	protected renderContent() {
		return html`
			<flowti-wizard
				.steps=${this.steps}
				.currentStep=${this._currentPage}
				.showNav=${false}
				@step-change=${this.onStepChange}
			>
				${this.renderPage()}
			</flowti-wizard>
		`;
	}

	private renderPage() {
		switch (this._currentPage) {
			case 'view-select': return this.renderViewSelect();
			case 'configure': return this.renderConfigure();
			case 'preview': return this.renderPreview();
			case 'result': return this.renderResult();
			default: return nothing;
		}
	}

	// ── View Select ────────────────────────────────────────

	private renderViewSelect() {
		if (this.baseViews.length === 0) {
			return html`
				<div class="page-content">
					<div class="empty-state">
						<div class="empty-state__message">No views found in this base file.</div>
					</div>
					<button @click=${() => this.emit('close', {})}>Close</button>
				</div>
			`;
		}

		const sourceName = this.sourcePath.split('/').pop() ?? this.sourcePath;
		return html`
			<div class="page-content">
				<div class="actions-row" style="margin-bottom: var(--flowti-space-md)">
					<span class="nav-link" @click=${() => this.emit('close', {})}>Close</span>
					<div style="flex: 1"></div>
					<button class="btn-primary" @click=${() => this.emit('select-view', { viewIndex: this.selectedViewIndex })}>
						Configure
					</button>
				</div>

				<h3>Select a view</h3>
				<div class="text-muted" style="margin-bottom: var(--flowti-space-md)">
					${sourceName} \u2014 ${this.baseViews.length} view${this.baseViews.length !== 1 ? 's' : ''}
				</div>

				${this.baseViews.map((view, i) => {
					const isSelected = i === this.selectedViewIndex;
					const meta = [view.type];
					if (view.columnCount > 0) meta.push(`${view.columnCount} columns`);
					if (view.hasFilters) meta.push('filtered');

					return html`
						<div class="view-card ${isSelected ? 'view-card--selected' : ''}"
							@click=${() => { this.selectedViewIndex = i; this.requestUpdate(); }}>
							<div style="flex: 1">
								<div class="view-name">${view.name}</div>
								<div class="view-meta">${meta.join(' \u00B7 ')}</div>
							</div>
							${isSelected ? html`<span class="text-success">\u2713</span>` : nothing}
						</div>
					`;
				})}
			</div>
		`;
	}

	// ── Configure ──────────────────────────────────────────

	private renderConfigure() {
		const selectedColumns = this.columns.filter((c) => c.selected);
		const frontmatterCols = selectedColumns.filter((c) => c.source === 'frontmatter');
		const fileCols = selectedColumns.filter((c) => c.source === 'file');

		return html`
			<div class="page-content">
				<div class="actions-row" style="margin-bottom: var(--flowti-space-md)">
					${this.sourceType === 'base' ? html`
						<span class="nav-link" @click=${() => this.goToPage('view-select')}>Select View</span>
					` : html`
						<span class="nav-link" @click=${() => this.emit('close', {})}>Close</span>
					`}
					<div style="flex: 1"></div>
					<button class="btn-primary" @click=${() => this.goToPage('preview')}>Preview</button>
				</div>

				<div class="card">
					<div class="card-title">Export Configuration</div>
					<div class="info-grid">
						<span class="info-label">Source</span>
						<span>${this.sourcePath}</span>
						<span class="info-label">Format</span>
						<span>${this.format === 'tab' ? 'Tab-delimited' : 'CSV'}</span>
						<span class="info-label">Output path</span>
						<span>${this.outputPath || '(not set)'}${this.isExternal ? ' (external)' : ''}</span>
						<span class="info-label">Conflict strategy</span>
						<span>${this.conflictStrategy}</span>
						<span class="info-label">Files to export</span>
						<span>${this.previewFileCount} notes</span>
					</div>
				</div>

				<div class="card">
					<div class="card-title">Columns (${selectedColumns.length} of ${this.columns.length})</div>
					<div class="actions-row" style="margin-bottom: var(--flowti-space-sm)">
						<span class="nav-link" @click=${() => this.emitToggleAll(true)}>All</span>
						<span class="nav-link" @click=${() => this.emitToggleAll(false)}>None</span>
						<span class="text-muted">${frontmatterCols.length} frontmatter, ${fileCols.length} file</span>
					</div>
					${this.columns.map((col) => html`
						<div class="column-row">
							<input type="checkbox" .checked=${col.selected}
								@change=${() => this.emit('toggle-column', { key: col.key, selected: !col.selected })}>
							<span class="column-label">${col.label}</span>
							<span class="column-source">${col.source}</span>
						</div>
					`)}
				</div>
			</div>
		`;
	}

	// ── Preview ────────────────────────────────────────────

	private renderPreview() {
		const issues: string[] = [];
		if (!this.outputPath.trim()) issues.push('Output path is required');
		if (this.previewHeaders.length === 0) issues.push('At least one column is required');

		const strategyLabels: Record<string, string> = {
			overwrite: 'Overwrite existing file',
			skip: 'Skip if exists',
			append: 'Append to existing',
		};

		return html`
			<div class="page-content">
				<div class="actions-row" style="margin-bottom: var(--flowti-space-md)">
					<span class="nav-link" @click=${() => this.goToPage('configure')}>Edit Config</span>
					<div style="flex: 1"></div>
					${issues.length === 0 ? html`
						<button class="btn-primary" @click=${() => { this.goToPage('result'); this.emit('run-export', {}); }}>
							Run Export
						</button>
					` : nothing}
				</div>

				${issues.length > 0 ? html`
					<div class="card" style="border-left: 3px solid var(--flowti-color-warning)">
						${issues.map((issue) => html`<div class="text-error" style="font-size: var(--flowti-font-sm)">${issue}</div>`)}
					</div>
				` : nothing}

				<div class="card">
					<div class="card-title">What will happen</div>
					<div class="info-grid">
						<span class="info-label">Source</span>
						<span>${this.sourcePath}</span>
						<span class="info-label">Files to export</span>
						<span>${this.previewFileCount} notes</span>
						<span class="info-label">Output file</span>
						<span>${this.outputPath || '(not set)'}${this.isExternal ? ' (external)' : ''}</span>
						<span class="info-label">Format</span>
						<span>${this.format === 'tab' ? 'Tab-delimited' : 'CSV'}</span>
						<span class="info-label">Columns</span>
						<span>${this.previewHeaders.length}</span>
						<span class="info-label">Conflict strategy</span>
						<span>${strategyLabels[this.conflictStrategy] ?? this.conflictStrategy}</span>
					</div>
				</div>

				<div class="actions-row" style="margin-bottom: var(--flowti-space-sm)">
					<span class="badge">${this.previewFileCount} rows</span>
					<span class="badge">${this.previewHeaders.length} columns</span>
					${this.previewFileCount > 25 ? html`<span class="text-muted">Showing first 25 rows</span>` : nothing}
				</div>

				${this.previewHeaders.length > 0 ? html`
					<div class="table-scroll">
						<table class="preview-table">
							<thead>
								<tr>${this.previewHeaders.map((h) => html`<th>${h}</th>`)}</tr>
							</thead>
							<tbody>
								${this.previewRows.slice(0, 25).map((row) => html`
									<tr>${row.map((cell) => html`<td>${cell}</td>`)}</tr>
								`)}
							</tbody>
						</table>
					</div>
				` : html`
					<div class="text-muted" style="padding: var(--flowti-space-md)">
						No columns selected. Go back and select at least one column.
					</div>
				`}
			</div>
		`;
	}

	// ── Result ─────────────────────────────────────────────

	private renderResult() {
		if (this.exportResult) {
			return this.renderExportResult();
		}
		if (this.exportError) {
			return this.renderExportError();
		}
		return html`
			<div class="page-content">
				<h3>Exporting...</h3>
				<div class="text-muted">Writing export file...</div>
				<div class="progress-pulse"></div>
			</div>
		`;
	}

	private renderExportResult() {
		const r = this.exportResult!;
		const isSkipped = !!r.skipped;
		const statusText = isSkipped
			? 'Export skipped \u2014 file already exists'
			: `Successfully exported ${r.totalRows} row${r.totalRows !== 1 ? 's' : ''}`;

		return html`
			<div class="page-content">
				<div class="header-row">
					<span class="status-icon ${isSkipped ? 'text-muted' : 'text-success'}">
						${isSkipped ? '\u2296' : '\u2713'}
					</span>
					<h3>${statusText}</h3>
				</div>

				<div class="card">
					<div class="card-title">What happened</div>
					<div class="info-grid">
						${isSkipped ? html`
							<span class="info-label">Rows exported</span><span>0 (skipped)</span>
						` : html`
							<span class="info-label">Rows exported</span><span>${r.totalRows}</span>
							<span class="info-label">Columns</span><span>${r.totalColumns}</span>
						`}
						<span class="info-label">Output file</span><span>${r.outputPath}</span>
						<span class="info-label">Format</span>
						<span>${this.format === 'tab' ? 'Tab-delimited' : 'CSV'}</span>
						${this.loadedConfigName ? html`
							<span class="info-label">Config used</span><span>${this.loadedConfigName}</span>
						` : nothing}
					</div>
				</div>

				<div class="card">
					<div class="card-title">What's next</div>
					<div class="actions-row">
						${!this.isExternal && this.outputPath ? html`
							<button @click=${() => this.emit('open-output', {})}>Open Output</button>
						` : nothing}
						<button @click=${() => this.emit('run-export', {})}>Run Again</button>
						<button @click=${() => this.goToPage('configure')}>Edit Config</button>
						<button @click=${() => this.emit('close', {})}>Close</button>
					</div>
				</div>
			</div>
		`;
	}

	private renderExportError() {
		return html`
			<div class="page-content">
				<div class="header-row">
					<span class="status-icon text-error">\u2717</span>
					<h3>Export failed</h3>
				</div>
				<div class="card" style="border-left: 3px solid var(--flowti-color-error)">
					<div class="card-title">Error</div>
					<div style="font-size: var(--flowti-font-sm)">${this.exportError}</div>
				</div>
				<div class="card">
					<div class="card-title">What's next</div>
					<div class="actions-row">
						<button class="btn-primary" @click=${() => this.emit('run-export', {})}>Retry</button>
						<button @click=${() => this.goToPage('configure')}>Edit Config</button>
						<button @click=${() => this.emit('close', {})}>Close</button>
					</div>
				</div>
			</div>
		`;
	}

	// ── Helpers ─────────────────────────────────────────────

	private goToPage(page: ExportWizardPage): void {
		this._currentPage = page;
		this.emit('navigate-page', { page });
	}

	private emitToggleAll(selected: boolean): void {
		for (const col of this.columns) {
			this.emit('toggle-column', { key: col.key, selected });
		}
	}

	private emit(name: string, detail: Record<string, unknown>): void {
		this.dispatchEvent(
			new CustomEvent(name, { detail, bubbles: true, composed: true }),
		);
	}
}

if (!customElements.get('flowti-export-wizard')) customElements.define('flowti-export-wizard', FlowtiExportWizard);
