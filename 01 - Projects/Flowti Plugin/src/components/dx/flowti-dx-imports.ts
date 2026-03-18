import { html, css, nothing } from 'lit';
import { FlowtiElement } from '../flowti-element.js';
import { masterDetailLayout, statusBadge, emptyState } from '../shared-styles.js';

interface ImportConfig {
	id: string;
	name: string;
	sourcePath: string;
	targetFolder: string;
	noteType?: string;
	lastRunAt?: string;
}

/**
 * Data Exchange Imports — CRUD list for import configurations.
 *
 * Master-detail layout: left list of import configs, right detail panel.
 * Actions dispatch CustomEvents for the handler to process.
 *
 * @property imports - Array of saved import config objects
 * @property selectedId - Currently selected config ID
 * @property searchText - External text filter
 *
 * @fires select-import - detail: { importId }
 * @fires run-import - detail: { importId }
 * @fires edit-import - detail: { importId }
 * @fires delete-import - detail: { importId }
 * @fires create-import - When "New import" is clicked
 */
export class FlowtiDxImports extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		imports: { type: Array },
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

			.import-meta {
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

	imports: ImportConfig[] = [];
	selectedId: string | null = null;
	searchText = '';

	private get filteredImports(): ImportConfig[] {
		if (!this.searchText) return this.imports;
		const lower = this.searchText.toLowerCase();
		return this.imports.filter((c) =>
			c.name.toLowerCase().includes(lower) ||
			c.sourcePath.toLowerCase().includes(lower),
		);
	}

	private get selectedConfig(): ImportConfig | undefined {
		return this.imports.find((c) => c.id === this.selectedId);
	}

	private dispatchAction(eventName: string, importId?: string): void {
		this.dispatchEvent(
			new CustomEvent(eventName, {
				detail: importId ? { importId } : undefined,
				bubbles: true,
				composed: true,
			}),
		);
	}

	private onSelectImport(importId: string): void {
		this.selectedId = importId;
		this.dispatchAction('select-import', importId);
	}

	protected renderContent() {
		const filtered = this.filteredImports;

		if (filtered.length === 0 && this.imports.length === 0) {
			return html`
				<div class="empty-state">
					<div class="empty-state__message">No import configurations</div>
					<button class="btn-primary" @click=${() => this.dispatchAction('create-import')}>New import</button>
				</div>
			`;
		}

		return html`
			<div class="toolbar">
				<button class="btn-primary" @click=${() => this.dispatchAction('create-import')}>New import</button>
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

	private renderListItem(cfg: ImportConfig) {
		const isSelected = cfg.id === this.selectedId;
		return html`
			<div
				class="list-item ${isSelected ? 'list-item--selected' : ''}"
				@click=${() => this.onSelectImport(cfg.id)}
			>
				<div>${cfg.name}</div>
				<div class="import-meta">${cfg.sourcePath}</div>
			</div>
		`;
	}

	private renderDetail(cfg: ImportConfig) {
		return html`
			<div class="detail-header">
				<h3>${cfg.name}</h3>
			</div>
			<div class="detail-field">
				<div class="detail-field__label">Source Path</div>
				<div class="detail-field__value">${cfg.sourcePath}</div>
			</div>
			<div class="detail-field">
				<div class="detail-field__label">Target Folder</div>
				<div class="detail-field__value">${cfg.targetFolder}</div>
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
				<button class="btn-primary" @click=${() => this.dispatchAction('run-import', cfg.id)}>Run</button>
				<button @click=${() => this.dispatchAction('edit-import', cfg.id)}>Edit</button>
				<button class="btn-delete" @click=${() => this.dispatchAction('delete-import', cfg.id)}>Delete</button>
			</div>
		`;
	}
}

if (!customElements.get('flowti-dx-imports')) customElements.define('flowti-dx-imports', FlowtiDxImports);
