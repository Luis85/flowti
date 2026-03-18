import { html, css, nothing } from 'lit';
import { FlowtiElement } from '../flowti-element.js';
import { statusBadge, emptyState, statCardGrid } from '../shared-styles.js';
import type { WizardStep } from './flowti-wizard.js';
import './flowti-wizard.js';

export interface CanvasConfig {
	id: string;
	name: string;
	targetFolder: string;
	conflictStrategy: string;
	hierarchyMode: string;
	lastUsed?: string;
}

export interface CanvasPreviewItem {
	id: string;
	title: string;
	type: string;
	originalType: string;
	parentId: string | null;
	isEmpty: boolean;
}

export interface CanvasImportResult {
	totalNodes: number;
	imported: number;
	skipped: number;
	errors: { nodeId: string; title: string; error: string }[];
	duration: number;
	targetFolder: string;
	importedPaths: Record<string, string>;
}

type CanvasWizardPage = 'landing' | 'config' | 'preview' | 'result';

const STEPS: WizardStep[] = [
	{ id: 'landing', label: 'Canvas' },
	{ id: 'config', label: 'Configure' },
	{ id: 'preview', label: 'Preview' },
	{ id: 'result', label: 'Result' },
];

/**
 * Canvas import wizard — 4 steps: landing, config, preview, result.
 *
 * @property canvasPath - Path to the canvas file
 * @property savedConfigs - Array of saved import configurations
 * @property previewItems - Parsed canvas nodes for preview
 * @property importResult - Import result data (null if not done)
 * @property importProgress - Current import progress { current, total, title }
 * @property importDone - Whether import has completed
 * @property importSuccess - Whether import was successful
 * @property importMessage - Import status/error message
 * @property parseError - Parse error message (null if none)
 * @property configName - Current config name
 * @property targetFolder - Target folder path
 * @property conflictStrategy - Conflict handling strategy
 * @property hierarchyMode - Folder hierarchy mode
 * @property excludedTypes - Types excluded from import
 *
 * @fires navigate-page - detail: { page } when internal page changes
 * @fires run-import - When the import action is triggered
 * @fires save-config - When config should be saved
 * @fires load-config - detail: { configId } when a saved config is selected
 * @fires update-config - detail: { field, value } when a config field changes
 * @fires close - When the wizard should be closed
 */
export class FlowtiCanvasWizard extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		canvasPath: { type: String, attribute: 'canvas-path' },
		savedConfigs: { type: Array },
		previewItems: { type: Array },
		importResult: { type: Object },
		importProgress: { type: Object },
		importDone: { type: Boolean },
		importSuccess: { type: Boolean },
		importMessage: { type: String },
		parseError: { type: String },
		configName: { type: String },
		targetFolder: { type: String },
		conflictStrategy: { type: String },
		hierarchyMode: { type: String },
		excludedTypes: { type: Array },
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

			.config-row {
				display: flex;
				align-items: center;
				gap: var(--flowti-space-sm);
				padding: var(--flowti-space-sm);
				border-radius: var(--flowti-radius);
				cursor: pointer;
			}

			.config-row:hover {
				background: var(--background-modifier-hover);
			}

			.config-info {
				flex: 1;
			}

			.config-name {
				font-weight: 500;
				font-size: var(--flowti-font-sm);
			}

			.config-meta {
				font-size: var(--flowti-font-sm);
				color: var(--flowti-color-muted);
			}

			.actions-row {
				display: flex;
				flex-wrap: wrap;
				gap: var(--flowti-space-sm);
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

			.excluded-row {
				opacity: 0.5;
			}

			.text-success {
				color: var(--flowti-color-success);
			}

			.text-error {
				color: var(--flowti-color-error);
			}

			.text-muted {
				color: var(--flowti-color-muted);
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
		`,
	];

	canvasPath = '';
	savedConfigs: CanvasConfig[] = [];
	previewItems: CanvasPreviewItem[] = [];
	importResult: CanvasImportResult | null = null;
	importProgress = { current: 0, total: 0, title: '' };
	importDone = false;
	importSuccess = false;
	importMessage = '';
	parseError: string | null = null;
	configName = '';
	targetFolder = '';
	conflictStrategy = 'skip';
	hierarchyMode = 'flat';
	excludedTypes: string[] = [];
	private _currentPage: CanvasWizardPage = 'landing';

	private onStepChange(e: CustomEvent): void {
		this._currentPage = e.detail.stepId as CanvasWizardPage;
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
		const filename = this.canvasPath.split('/').pop() ?? 'Canvas File';
		return html`
			<div class="page-content">
				<h3>${filename}</h3>
				<div class="text-muted" style="margin-bottom: var(--flowti-space-md)">${this.canvasPath}</div>

				<div class="stat-grid" style="margin-bottom: var(--flowti-space-md)">
					<div class="stat-card">
						<div class="stat-card__value">${this.savedConfigs.length}</div>
						<div class="stat-card__label">saved configs</div>
					</div>
				</div>

				<div class="actions-row" style="margin-bottom: var(--flowti-space-lg)">
					<button class="btn-primary" @click=${() => this.goToPage('config')}>Import as Notes</button>
				</div>

				${this.savedConfigs.length > 0 ? html`
					<div class="card-title">Saved Configurations</div>
					${this.savedConfigs.map((cfg) => html`
						<div class="config-row" @click=${() => this.onLoadConfig(cfg.id)}>
							<div class="config-info">
								<div class="config-name">${cfg.name}</div>
								<div class="config-meta">${cfg.targetFolder} | ${cfg.conflictStrategy} | ${cfg.hierarchyMode}</div>
							</div>
							<span class="nav-link" @click=${(e: Event) => { e.stopPropagation(); this.emit('run-import', { configId: cfg.id }); }}>
								Run
							</span>
						</div>
					`)}
				` : nothing}
			</div>
		`;
	}

	// ── Config ─────────────────────────────────────────────

	private renderConfig() {
		return html`
			<div class="page-content">
				<div class="actions-row" style="margin-bottom: var(--flowti-space-md)">
					<span class="nav-link" @click=${() => this.goToPage('landing')}>Canvas Detail</span>
					<div style="flex: 1"></div>
					<button class="btn-primary" @click=${() => this.emit('parse-and-preview', {})}>Preview</button>
				</div>

				<div class="card">
					<div class="card-title">Configure Import</div>
					<div class="info-grid">
						<span class="info-label">Canvas file</span>
						<span>${this.canvasPath}</span>
						<span class="info-label">Config name</span>
						<span>${this.configName || '(unnamed)'}</span>
						<span class="info-label">Target folder</span>
						<span>${this.targetFolder || '(not set)'}</span>
						<span class="info-label">Conflict strategy</span>
						<span>${this.conflictStrategy}</span>
						<span class="info-label">Hierarchy mode</span>
						<span>${this.hierarchyMode}</span>
					</div>
				</div>
			</div>
		`;
	}

	// ── Preview ────────────────────────────────────────────

	private renderPreview() {
		if (this.parseError) {
			return html`
				<div class="page-content">
					<div class="card" style="border-left: 3px solid var(--flowti-color-error)">
						<strong>Parse error: </strong>${this.parseError}
					</div>
					<span class="nav-link" @click=${() => this.goToPage('config')}>Back to Config</span>
				</div>
			`;
		}

		const allImportable = this.previewItems.filter(
			(i) => i.originalType !== 'group' && !i.isEmpty,
		);
		const importable = allImportable.filter(
			(i) => !this.excludedTypes.includes(i.type),
		);

		const typeCounts = new Map<string, number>();
		for (const item of allImportable) {
			typeCounts.set(item.type, (typeCounts.get(item.type) ?? 0) + 1);
		}

		return html`
			<div class="page-content">
				<div class="actions-row" style="margin-bottom: var(--flowti-space-md)">
					<span class="nav-link" @click=${() => this.goToPage('config')}>Edit Config</span>
					<div style="flex: 1"></div>
					<button class="btn-primary" @click=${() => this.emit('run-import', {})}>
						Import ${importable.length} Notes
					</button>
				</div>

				<div class="card">
					<div class="card-title">What will happen</div>
					<div class="info-grid">
						<span class="info-label">Notes to create</span>
						<span>${importable.length}${allImportable.length !== importable.length ? ` (${allImportable.length - importable.length} excluded)` : ''}</span>
						<span class="info-label">Target folder</span>
						<span>${this.targetFolder}</span>
						<span class="info-label">Conflict strategy</span>
						<span>${this.conflictStrategy}</span>
					</div>
				</div>

				${typeCounts.size > 0 ? html`
					<div class="card">
						<div class="card-title">Type Distribution</div>
						<table class="preview-table">
							<tr><th>Type</th><th>Count</th><th>Status</th></tr>
							${[...typeCounts.entries()].map(([type, count]) => {
								const excluded = this.excludedTypes.includes(type);
								return html`
									<tr class="${excluded ? 'excluded-row' : ''}">
										<td>${type}</td>
										<td>${count}</td>
										<td class="${excluded ? 'text-error' : 'text-success'}">${excluded ? 'Excluded' : 'Included'}</td>
									</tr>
								`;
							})}
						</table>
					</div>
				` : nothing}
			</div>
		`;
	}

	// ── Result ─────────────────────────────────────────────

	private renderResult() {
		if (!this.importDone) {
			return this.renderProgress();
		}
		if (this.importSuccess && this.importResult) {
			return this.renderSuccess();
		}
		return this.renderError();
	}

	private renderProgress() {
		const pct = this.importProgress.total > 0
			? Math.round((this.importProgress.current / this.importProgress.total) * 100)
			: 0;
		return html`
			<div class="page-content">
				<h3>Importing...</h3>
				<p class="text-muted">Processing canvas nodes as vault notes.</p>
				<p>${this.importProgress.total > 0
					? `Node ${this.importProgress.current} of ${this.importProgress.total} (${pct}%)${this.importProgress.title ? ` \u2014 ${this.importProgress.title}` : ''}`
					: 'Starting...'}</p>
				<div class="progress-bar">
					<div class="progress-bar-fill" style="width: ${pct}%"></div>
				</div>
			</div>
		`;
	}

	private renderSuccess() {
		const r = this.importResult!;
		const hasErrors = r.errors.length > 0;
		return html`
			<div class="page-content">
				<div class="header-row">
					<span class="status-icon ${hasErrors ? 'text-error' : 'text-success'}">
						${hasErrors ? '\u26A0' : '\u2713'}
					</span>
					<h3>${hasErrors ? `Import completed with ${r.errors.length} error${r.errors.length !== 1 ? 's' : ''}` : 'Import Complete'}</h3>
				</div>

				<div class="card">
					<div class="card-title">What happened</div>
					<div class="info-grid">
						<span class="info-label">Nodes processed</span><span>${r.totalNodes}</span>
						${r.imported > 0 ? html`<span class="info-label">Notes created</span><span>${r.imported}</span>` : nothing}
						${r.skipped > 0 ? html`<span class="info-label">Notes skipped</span><span>${r.skipped} (already exist)</span>` : nothing}
						${r.errors.length > 0 ? html`<span class="info-label text-error">Errors</span><span class="text-error">${r.errors.length}</span>` : nothing}
						<span class="info-label">Duration</span><span>${r.duration}ms</span>
						<span class="info-label">Target folder</span><span>${r.targetFolder}</span>
					</div>
				</div>

				${r.errors.length > 0 ? html`
					<div class="card" style="border-left: 3px solid var(--flowti-color-error)">
						<div class="card-title">Errors (${r.errors.length})</div>
						${r.errors.slice(0, 20).map((err) => html`
							<div style="display: flex; gap: var(--flowti-space-sm); font-size: var(--flowti-font-sm); margin-bottom: 2px">
								<span style="font-weight: 500">${err.title || err.nodeId}</span>
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
						<button @click=${() => this.emit('close', {})}>Close</button>
					</div>
				</div>
			</div>
		`;
	}

	private renderError() {
		return html`
			<div class="page-content">
				<div class="header-row">
					<span class="status-icon text-error">\u2717</span>
					<h3>Import failed</h3>
				</div>
				<div class="card" style="border-left: 3px solid var(--flowti-color-error)">
					<div class="card-title">Error</div>
					<div style="font-size: var(--flowti-font-sm)">${this.importMessage}</div>
				</div>
				<div class="card">
					<div class="card-title">What's next</div>
					<div class="actions-row">
						<button class="btn-primary" @click=${() => this.emit('run-import', {})}>Retry</button>
						<button @click=${() => this.goToPage('config')}>Edit Config</button>
						<button @click=${() => this.emit('close', {})}>Close</button>
					</div>
				</div>
			</div>
		`;
	}

	// ── Helpers ─────────────────────────────────────────────

	private goToPage(page: CanvasWizardPage): void {
		this._currentPage = page;
		this.emit('navigate-page', { page });
	}

	private onLoadConfig(configId: string): void {
		this.emit('load-config', { configId });
		this.goToPage('config');
	}

	private emit(name: string, detail: Record<string, unknown>): void {
		this.dispatchEvent(
			new CustomEvent(name, { detail, bubbles: true, composed: true }),
		);
	}
}

if (!customElements.get('flowti-canvas-wizard')) customElements.define('flowti-canvas-wizard', FlowtiCanvasWizard);
