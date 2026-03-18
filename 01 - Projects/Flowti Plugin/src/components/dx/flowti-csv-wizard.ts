import { html, css, nothing } from 'lit';
import { FlowtiElement } from '../flowti-element.js';
import { statusBadge, emptyState, statCardGrid } from '../shared-styles.js';
import type { WizardStep } from './flowti-wizard.js';
import './flowti-wizard.js';

export interface CsvColumnMapping {
	csvColumn: string;
	frontmatterKey: string;
	included: boolean;
}

export interface CsvParsedData {
	headers: string[];
	rows: string[][];
	rowCount: number;
}

export interface CsvImportResult {
	totalRows: number;
	created: number;
	updated: number;
	skipped: number;
	failed: number;
	errors: { row: number; filename: string; error: string }[];
}

export interface CsvSavedConfig {
	id: string;
	name: string;
}

type CsvWizardPage = 'landing' | 'config' | 'preview' | 'result';

const STEPS: WizardStep[] = [
	{ id: 'landing', label: 'CSV Detail' },
	{ id: 'config', label: 'Configure' },
	{ id: 'preview', label: 'Preview' },
	{ id: 'result', label: 'Result' },
];

/**
 * CSV import wizard — 4 steps: landing, config, preview, result.
 *
 * @property filePath - Path to the CSV file
 * @property fileName - Display name for the CSV file
 * @property fileSize - File size in KB
 * @property delimiter - Detected delimiter
 * @property parsedCsv - Parsed CSV data (headers + rows)
 * @property columnMappings - Column mapping configuration
 * @property targetFolder - Target import folder
 * @property nameColumn - Column used for filenames
 * @property namePrefix - Filename prefix
 * @property nameSuffix - Filename suffix
 * @property conflictStrategy - How to handle existing notes
 * @property customProperties - Extra frontmatter key-value pairs
 * @property createBase - Whether to create a .base view
 * @property importResult - Import result data (null if not done)
 * @property importError - Import error message (null if none)
 * @property importProgress - Current import progress { current, total }
 * @property parseError - Parse error message (null if none)
 * @property savedConfigs - Array of saved import configurations
 * @property lastImportedAt - Timestamp of last import
 *
 * @fires navigate-page - detail: { page } when internal page changes
 * @fires run-import - When the import action is triggered
 * @fires start-wizard - When user clicks import from landing page
 * @fires update-config - detail: { field, value } when a config field changes
 * @fires close - When the wizard should be closed
 * @fires open-external - When open with default app is clicked
 */
export class FlowtiCsvWizard extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		filePath: { type: String, attribute: 'file-path' },
		fileName: { type: String, attribute: 'file-name' },
		fileSize: { type: String, attribute: 'file-size' },
		delimiter: { type: String },
		parsedCsv: { type: Object },
		columnMappings: { type: Array },
		targetFolder: { type: String },
		nameColumn: { type: String },
		namePrefix: { type: String },
		nameSuffix: { type: String },
		conflictStrategy: { type: String },
		customProperties: { type: Object },
		createBase: { type: Boolean },
		importResult: { type: Object },
		importError: { type: String },
		importProgress: { type: Object },
		parseError: { type: String },
		savedConfigs: { type: Array },
		lastImportedAt: { type: String },
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

			.progress-bar {
				height: 6px;
				background: var(--background-modifier-border);
				border-radius: 3px;
				overflow: hidden;
				margin-top: var(--flowti-space-sm);
			}

			.progress-bar-fill {
				height: 100%;
				background: var(--flowti-color-info);
				transition: width 0.3s ease;
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

			.mapping-row {
				display: flex;
				align-items: center;
				gap: var(--flowti-space-sm);
				padding: var(--flowti-space-xs) 0;
				font-size: var(--flowti-font-sm);
			}

			.mapping-col {
				flex: 1;
			}

			.mapping-arrow {
				color: var(--flowti-color-muted);
			}
		`,
	];

	filePath = '';
	fileName = '';
	fileSize = '';
	delimiter = ',';
	parsedCsv: CsvParsedData | null = null;
	columnMappings: CsvColumnMapping[] = [];
	targetFolder = '';
	nameColumn = '';
	namePrefix = '';
	nameSuffix = '';
	conflictStrategy = 'skip';
	customProperties: Record<string, string> = {};
	createBase = false;
	importResult: CsvImportResult | null = null;
	importError: string | null = null;
	importProgress = { current: 0, total: 0 };
	parseError: string | null = null;
	savedConfigs: CsvSavedConfig[] = [];
	lastImportedAt: string | null = null;
	private _currentPage: CsvWizardPage = 'landing';

	private onStepChange(e: CustomEvent): void {
		this._currentPage = e.detail.stepId as CsvWizardPage;
		this.emit('navigate-page', { page: this._currentPage });
	}

	protected renderContent() {
		return html`
			<flowti-wizard
				.steps=${STEPS}
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
			case 'landing': return this.renderLanding();
			case 'config': return this.renderConfig();
			case 'preview': return this.renderPreview();
			case 'result': return this.renderResult();
			default: return nothing;
		}
	}

	// ── Landing ────────────────────────────────────────────

	private renderLanding() {
		const delimLabel = this.delimiter === ',' ? 'Comma'
			: this.delimiter === ';' ? 'Semicolon'
			: this.delimiter === '\t' ? 'Tab'
			: this.delimiter === '|' ? 'Pipe'
			: `"${this.delimiter}"`;
		const rowCount = this.parsedCsv?.rowCount ?? 0;
		const colCount = this.parsedCsv?.headers.length ?? 0;

		return html`
			<div class="page-content">
				<h3>${this.fileName || 'CSV File'}</h3>
				<div class="text-muted" style="margin-bottom: var(--flowti-space-md)">${this.filePath}</div>

				<div class="stat-grid" style="margin-bottom: var(--flowti-space-md)">
					<div class="stat-card">
						<div class="stat-card__value">${rowCount}</div>
						<div class="stat-card__label">Rows</div>
					</div>
					<div class="stat-card">
						<div class="stat-card__value">${colCount}</div>
						<div class="stat-card__label">Columns</div>
					</div>
					<div class="stat-card">
						<div class="stat-card__value">${delimLabel}</div>
						<div class="stat-card__label">Delimiter</div>
					</div>
					${this.fileSize ? html`
						<div class="stat-card">
							<div class="stat-card__value">${this.fileSize}</div>
							<div class="stat-card__label">Size</div>
						</div>
					` : nothing}
					<div class="stat-card">
						<div class="stat-card__value">${this.lastImportedAt ?? 'Never'}</div>
						<div class="stat-card__label">Last Import</div>
					</div>
				</div>

				<div class="actions-row" style="margin-bottom: var(--flowti-space-md)">
					<button class="btn-primary" @click=${() => this.emit('start-wizard', {})}>Import as Notes</button>
					<button @click=${() => this.emit('open-external', {})}>Open with Default App</button>
				</div>
			</div>
		`;
	}

	// ── Config ─────────────────────────────────────────────

	private renderConfig() {
		if (this.parseError) {
			return html`
				<div class="page-content">
					<div class="card" style="border-left: 3px solid var(--flowti-color-error)">
						<strong>Parse error: </strong>${this.parseError}
					</div>
					<span class="nav-link" @click=${() => this.goToPage('landing')}>Back to CSV</span>
				</div>
			`;
		}

		const includedCount = this.columnMappings.filter((m) => m.included).length;
		const customCount = Object.keys(this.customProperties).length;

		return html`
			<div class="page-content">
				<div class="actions-row" style="margin-bottom: var(--flowti-space-md)">
					<span class="nav-link" @click=${() => this.goToPage('landing')}>CSV Detail</span>
					<div style="flex: 1"></div>
					<button class="btn-primary" @click=${() => this.goToPage('preview')}>Preview</button>
				</div>

				<div class="card">
					<div class="card-title">Configure Import</div>
					<div class="info-grid">
						<span class="info-label">Target folder</span>
						<span>${this.targetFolder || '(not set)'}</span>
						<span class="info-label">Name column</span>
						<span>${this.nameColumn}</span>
						<span class="info-label">Filename pattern</span>
						<span>${this.namePrefix || ''}[${this.nameColumn}]${this.nameSuffix || ''}.md</span>
						<span class="info-label">Conflict strategy</span>
						<span>${this.conflictStrategy}</span>
						<span class="info-label">Create .base view</span>
						<span>${this.createBase ? 'Yes' : 'No'}</span>
					</div>
				</div>

				<div class="card">
					<div class="card-title">Column Mapping (${includedCount} of ${this.columnMappings.length})</div>
					${this.columnMappings.map((m) => html`
						<div class="mapping-row">
							<input type="checkbox" .checked=${m.included}
								@change=${(e: Event) => this.emit('update-config', { field: 'column-toggle', csvColumn: m.csvColumn, included: (e.target as HTMLInputElement).checked })}>
							<span class="mapping-col">${m.csvColumn}${m.csvColumn === this.nameColumn ? html` <span class="badge badge-accent">filename</span>` : nothing}</span>
							<span class="mapping-arrow">\u2192</span>
							<span class="mapping-col">${m.frontmatterKey}</span>
						</div>
					`)}
				</div>

				${customCount > 0 ? html`
					<div class="card">
						<div class="card-title">Custom Properties (${customCount})</div>
						${Object.entries(this.customProperties).map(([key, value]) => html`
							<div class="mapping-row">
								<span class="mapping-col">${key}</span>
								<span class="mapping-arrow">\u2192</span>
								<span class="mapping-col">${value}</span>
							</div>
						`)}
					</div>
				` : nothing}
			</div>
		`;
	}

	// ── Preview ────────────────────────────────────────────

	private renderPreview() {
		if (!this.parsedCsv) return nothing;

		const includedMappings = this.columnMappings.filter((m) => m.included);
		const customProps = Object.entries(this.customProperties);
		const strategyLabels: Record<string, string> = {
			skip: 'Skip existing notes',
			update: 'Update frontmatter',
			overwrite: 'Overwrite entirely',
		};

		const issues: string[] = [];
		if (!this.targetFolder.trim()) issues.push('Target folder is required');
		if (!this.nameColumn) issues.push('Name column is required');

		return html`
			<div class="page-content">
				<div class="actions-row" style="margin-bottom: var(--flowti-space-md)">
					<span class="nav-link" @click=${() => this.goToPage('config')}>Edit Config</span>
					<div style="flex: 1"></div>
					${issues.length === 0 ? html`
						<button class="btn-primary" @click=${() => { this.goToPage('result'); this.emit('run-import', {}); }}>
							Run Import
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
						<span class="info-label">Target folder</span>
						<span>${this.targetFolder || '(not set)'}</span>
						<span class="info-label">Notes to create</span>
						<span>${this.parsedCsv.rowCount}</span>
						<span class="info-label">Filename pattern</span>
						<span>${this.namePrefix || ''}[${this.nameColumn}]${this.nameSuffix || ''}.md</span>
						<span class="info-label">Frontmatter keys</span>
						<span>${includedMappings.length} mapped</span>
						${customProps.length > 0 ? html`
							<span class="info-label">Custom properties</span>
							<span>${customProps.length} extra</span>
						` : nothing}
						<span class="info-label">Conflict strategy</span>
						<span>${strategyLabels[this.conflictStrategy] ?? this.conflictStrategy}</span>
					</div>
				</div>

				<div class="actions-row" style="margin-bottom: var(--flowti-space-sm)">
					<span class="badge">${this.parsedCsv.rowCount} rows</span>
					<span class="badge">${1 + includedMappings.length + customProps.length} columns</span>
					${this.parsedCsv.rowCount > 25 ? html`<span class="text-muted">Showing first 25 rows</span>` : nothing}
				</div>

				<div class="table-scroll">
					<table class="preview-table">
						<thead>
							<tr>
								<th>Filename</th>
								${includedMappings.map((m) => html`<th>${m.frontmatterKey}</th>`)}
								${customProps.map(([key]) => html`<th>${key}</th>`)}
							</tr>
						</thead>
						<tbody>
							${this.parsedCsv.rows.slice(0, 25).map((row) => {
								const nameIdx = this.parsedCsv!.headers.indexOf(this.nameColumn);
								const filename = `${this.namePrefix}${row[nameIdx] ?? ''}${this.nameSuffix}`;
								return html`
									<tr>
										<td>${filename || '(empty)'}</td>
										${includedMappings.map((m) => {
											const colIdx = this.parsedCsv!.headers.indexOf(m.csvColumn);
											return html`<td>${row[colIdx] ?? ''}</td>`;
										})}
										${customProps.map(([, value]) => html`<td>${value}</td>`)}
									</tr>
								`;
							})}
						</tbody>
					</table>
				</div>
			</div>
		`;
	}

	// ── Result ─────────────────────────────────────────────

	private renderResult() {
		if (this.importResult) {
			return this.renderImportResult();
		}
		if (this.importError) {
			return this.renderImportError();
		}
		return this.renderProgress();
	}

	private renderProgress() {
		const pct = this.importProgress.total > 0
			? Math.round((this.importProgress.current / this.importProgress.total) * 100)
			: 0;
		return html`
			<div class="page-content">
				<h3>Importing...</h3>
				<p class="text-muted">Processing row ${this.importProgress.current} of ${this.importProgress.total}...</p>
				<div class="progress-bar">
					<div class="progress-bar-fill" style="width: ${pct}%"></div>
				</div>
			</div>
		`;
	}

	private renderImportResult() {
		const r = this.importResult!;
		const hasErrors = r.failed > 0;
		const allSkipped = r.skipped === r.totalRows;
		const statusText = hasErrors
			? `Import completed with ${r.failed} error${r.failed !== 1 ? 's' : ''}`
			: allSkipped
				? 'All rows skipped \u2014 notes already exist'
				: `Successfully imported ${r.created + r.updated} note${(r.created + r.updated) !== 1 ? 's' : ''}`;

		return html`
			<div class="page-content">
				<div class="header-row">
					<span class="status-icon ${hasErrors ? 'text-error' : allSkipped ? 'text-muted' : 'text-success'}">
						${hasErrors ? '\u26A0' : allSkipped ? '\u2296' : '\u2713'}
					</span>
					<h3>${statusText}</h3>
				</div>

				<div class="card">
					<div class="card-title">What happened</div>
					<div class="info-grid">
						<span class="info-label">CSV rows processed</span><span>${r.totalRows}</span>
						${r.created > 0 ? html`<span class="info-label">Notes created</span><span>${r.created}</span>` : nothing}
						${r.updated > 0 ? html`<span class="info-label">Notes updated</span><span>${r.updated}</span>` : nothing}
						${r.skipped > 0 ? html`<span class="info-label">Notes skipped</span><span>${r.skipped} (already exist)</span>` : nothing}
						${r.failed > 0 ? html`<span class="info-label text-error">Failed</span><span class="text-error">${r.failed}</span>` : nothing}
						<span class="info-label">Target folder</span><span>${this.targetFolder}</span>
					</div>
				</div>

				${r.errors.length > 0 ? html`
					<div class="card" style="border-left: 3px solid var(--flowti-color-error)">
						<div class="card-title">Errors (${r.errors.length})</div>
						${r.errors.slice(0, 20).map((err) => html`
							<div style="display: flex; gap: var(--flowti-space-sm); font-size: var(--flowti-font-sm); margin-bottom: 2px">
								<span class="text-muted">Row ${err.row}</span>
								<span>${err.filename}</span>
								<span class="text-error">${err.error}</span>
							</div>
						`)}
						${r.errors.length > 20 ? html`<div class="text-muted">...and ${r.errors.length - 20} more</div>` : nothing}
					</div>
				` : nothing}

				<div class="card">
					<div class="card-title">What's next</div>
					<div class="actions-row">
						<button @click=${() => this.emit('run-import', {})}>Run Again</button>
						<button @click=${() => this.goToPage('config')}>Edit Config</button>
						<button @click=${() => this.goToPage('landing')}>CSV Detail</button>
					</div>
				</div>
			</div>
		`;
	}

	private renderImportError() {
		return html`
			<div class="page-content">
				<div class="header-row">
					<span class="status-icon text-error">\u2717</span>
					<h3>Import failed</h3>
				</div>
				<div class="card" style="border-left: 3px solid var(--flowti-color-error)">
					<div class="card-title">Error</div>
					<div style="font-size: var(--flowti-font-sm)">${this.importError}</div>
				</div>
				<div class="card">
					<div class="card-title">What's next</div>
					<div class="actions-row">
						<button class="btn-primary" @click=${() => this.emit('run-import', {})}>Retry</button>
						<button @click=${() => this.goToPage('config')}>Edit Config</button>
						<button @click=${() => this.goToPage('landing')}>CSV Detail</button>
					</div>
				</div>
			</div>
		`;
	}

	// ── Helpers ─────────────────────────────────────────────

	private goToPage(page: CsvWizardPage): void {
		this._currentPage = page;
		this.emit('navigate-page', { page });
	}

	private emit(name: string, detail: Record<string, unknown>): void {
		this.dispatchEvent(
			new CustomEvent(name, { detail, bubbles: true, composed: true }),
		);
	}
}

if (!customElements.get('flowti-csv-wizard')) customElements.define('flowti-csv-wizard', FlowtiCsvWizard);
