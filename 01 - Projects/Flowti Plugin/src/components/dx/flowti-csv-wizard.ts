import { html, nothing } from 'lit';
import { FlowtiElement } from '../flowti-element.js';
import { statusBadge, emptyState, statCardGrid } from '../shared-styles.js';
import { csvWizardStyles } from './flowti-csv-wizard-styles.js';
import { renderImportResult, renderImportError } from './flowti-csv-wizard-helpers.js';
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
		csvWizardStyles,
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
			return this.renderCsvImportResult();
		}
		if (this.importError) {
			return this.renderCsvImportError();
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

	private renderCsvImportResult() {
		return renderImportResult(
			this.importResult!,
			this.targetFolder,
			() => this.emit('run-import', {}),
			() => this.goToPage('config'),
			() => this.goToPage('landing'),
		);
	}

	private renderCsvImportError() {
		return renderImportError(
			this.importError,
			() => this.emit('run-import', {}),
			() => this.goToPage('config'),
			() => this.goToPage('landing'),
		);
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
