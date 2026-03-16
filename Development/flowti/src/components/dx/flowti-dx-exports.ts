import { html, css, nothing } from 'lit';
import { FlowtiElement } from '../flowti-element.js';
import { masterDetailLayout, statusBadge, emptyState } from '../shared-styles.js';

interface ExportConfig {
	id: string;
	name: string;
	sourcePath: string;
	sourceType: string;
	outputPath: string;
	format: string;
	noteType?: string;
	lastRunAt?: string;
}

/**
 * Data Exchange Exports — CRUD list for export configurations.
 *
 * Master-detail layout: left list of export configs, right detail panel.
 *
 * @property exports - Array of saved export config objects
 * @property selectedId - Currently selected config ID
 * @property searchText - External text filter
 *
 * @fires select-export - detail: { exportId }
 * @fires run-export - detail: { exportId }
 * @fires edit-export - detail: { exportId }
 * @fires delete-export - detail: { exportId }
 * @fires create-export - When "New export" is clicked
 */
export class FlowtiDxExports extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		exports: { type: Array },
		selectedId: { type: String },
		searchText: { type: String },
	};

	static styles = [
		...FlowtiElement.styles,
		masterDetailLayout,
		statusBadge,
		emptyState,
		css`
			.toolbar {
				display: flex;
				justify-content: flex-end;
				margin-bottom: var(--flowti-space-md);
			}

			.export-meta {
				font-size: var(--flowti-font-sm);
				color: var(--flowti-color-muted);
			}

			.detail-header {
				display: flex;
				align-items: center;
				gap: var(--flowti-space-sm);
				margin-bottom: var(--flowti-space-md);
			}

			.detail-header h3 {
				margin: 0;
				font-size: 1rem;
			}

			.detail-field {
				margin-bottom: var(--flowti-space-sm);
			}

			.detail-field__label {
				font-size: var(--flowti-font-sm);
				color: var(--flowti-color-muted);
				margin-bottom: 2px;
			}

			.detail-field__value {
				font-size: var(--flowti-font-sm);
			}

			.detail-actions {
				display: flex;
				gap: var(--flowti-space-sm);
				margin-top: var(--flowti-space-md);
			}

			.format-badge {
				display: inline-flex;
				padding: 2px var(--flowti-space-xs);
				border-radius: var(--flowti-radius);
				background: var(--background-secondary);
				font-size: var(--flowti-font-sm);
				color: var(--flowti-color-muted);
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

			.btn-delete {
				color: var(--flowti-color-error);
			}
		`,
	];

	exports: ExportConfig[] = [];
	selectedId: string | null = null;
	searchText = '';

	private get filteredExports(): ExportConfig[] {
		if (!this.searchText) return this.exports;
		const lower = this.searchText.toLowerCase();
		return this.exports.filter((c) =>
			c.name.toLowerCase().includes(lower) ||
			c.outputPath.toLowerCase().includes(lower),
		);
	}

	private get selectedConfig(): ExportConfig | undefined {
		return this.exports.find((c) => c.id === this.selectedId);
	}

	private dispatchAction(eventName: string, exportId?: string): void {
		this.dispatchEvent(
			new CustomEvent(eventName, {
				detail: exportId ? { exportId } : undefined,
				bubbles: true,
				composed: true,
			}),
		);
	}

	private onSelectExport(exportId: string): void {
		this.selectedId = exportId;
		this.dispatchAction('select-export', exportId);
	}

	protected renderContent() {
		const filtered = this.filteredExports;

		if (filtered.length === 0 && this.exports.length === 0) {
			return html`
				<div class="empty-state">
					<div class="empty-state__message">No export configurations</div>
					<button class="btn-primary" @click=${() => this.dispatchAction('create-export')}>New export</button>
				</div>
			`;
		}

		return html`
			<div class="toolbar">
				<button class="btn-primary" @click=${() => this.dispatchAction('create-export')}>New export</button>
			</div>
			<div class="master-detail">
				<div class="master-list">
					${filtered.length === 0
						? html`<div class="empty-state"><div class="empty-state__message">No matches</div></div>`
						: filtered.map((cfg) => this.renderListItem(cfg))}
				</div>
				<div class="detail-panel">
					${this.selectedConfig ? this.renderDetail(this.selectedConfig) : nothing}
				</div>
			</div>
		`;
	}

	private renderListItem(cfg: ExportConfig) {
		const isSelected = cfg.id === this.selectedId;
		return html`
			<div
				class="list-item ${isSelected ? 'list-item--selected' : ''}"
				@click=${() => this.onSelectExport(cfg.id)}
			>
				<div>${cfg.name}</div>
				<div class="export-meta">
					<span class="format-badge">${cfg.format}</span>
					${cfg.outputPath}
				</div>
			</div>
		`;
	}

	private renderDetail(cfg: ExportConfig) {
		return html`
			<div class="detail-header">
				<h3>${cfg.name}</h3>
				<span class="format-badge">${cfg.format}</span>
			</div>
			<div class="detail-field">
				<div class="detail-field__label">Source Path</div>
				<div class="detail-field__value">${cfg.sourcePath}</div>
			</div>
			<div class="detail-field">
				<div class="detail-field__label">Source Type</div>
				<div class="detail-field__value">${cfg.sourceType}</div>
			</div>
			<div class="detail-field">
				<div class="detail-field__label">Output Path</div>
				<div class="detail-field__value">${cfg.outputPath}</div>
			</div>
			${cfg.noteType ? html`
				<div class="detail-field">
					<div class="detail-field__label">Note Type</div>
					<div class="detail-field__value">${cfg.noteType}</div>
				</div>
			` : nothing}
			${cfg.lastRunAt ? html`
				<div class="detail-field">
					<div class="detail-field__label">Last Run</div>
					<div class="detail-field__value">${cfg.lastRunAt}</div>
				</div>
			` : nothing}
			<div class="detail-actions">
				<button class="btn-primary" @click=${() => this.dispatchAction('run-export', cfg.id)}>Run</button>
				<button @click=${() => this.dispatchAction('edit-export', cfg.id)}>Edit</button>
				<button class="btn-delete" @click=${() => this.dispatchAction('delete-export', cfg.id)}>Delete</button>
			</div>
		`;
	}
}

customElements.define('flowti-dx-exports', FlowtiDxExports);
