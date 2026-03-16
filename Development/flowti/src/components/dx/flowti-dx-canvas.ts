import { html, css, nothing } from 'lit';
import { FlowtiElement } from '../flowti-element.js';
import { masterDetailLayout, statusBadge, emptyState } from '../shared-styles.js';

interface CanvasConfig {
	id: string;
	name: string;
	canvasPath: string;
	targetFolder?: string;
	lastRunAt?: string;
	nodeCount?: number;
}

/**
 * Data Exchange Canvas — canvas import management.
 *
 * @property canvases - Array of canvas import configuration objects
 * @property selectedId - Currently selected canvas config ID
 * @property searchText - External text filter
 *
 * @fires select-canvas - detail: { canvasId }
 * @fires run-canvas - detail: { canvasId }
 * @fires open-canvas - detail: { canvasPath }
 */
export class FlowtiDxCanvas extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		canvases: { type: Array },
		selectedId: { type: String },
		searchText: { type: String },
	};

	static styles = [
		...FlowtiElement.styles,
		masterDetailLayout,
		statusBadge,
		emptyState,
		css`
			.canvas-meta {
				font-size: var(--flowti-font-sm);
				color: var(--flowti-color-muted);
			}

			.detail-header {
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
		`,
	];

	canvases: CanvasConfig[] = [];
	selectedId: string | null = null;
	searchText = '';

	private get filteredCanvases(): CanvasConfig[] {
		if (!this.searchText) return this.canvases;
		const lower = this.searchText.toLowerCase();
		return this.canvases.filter((c) =>
			c.name.toLowerCase().includes(lower) ||
			c.canvasPath.toLowerCase().includes(lower),
		);
	}

	private get selectedCanvas(): CanvasConfig | undefined {
		return this.canvases.find((c) => c.id === this.selectedId);
	}

	private onSelectCanvas(canvasId: string): void {
		this.selectedId = canvasId;
		this.dispatchEvent(
			new CustomEvent('select-canvas', {
				detail: { canvasId },
				bubbles: true,
				composed: true,
			}),
		);
	}

	private onRunCanvas(canvasId: string): void {
		this.dispatchEvent(
			new CustomEvent('run-canvas', {
				detail: { canvasId },
				bubbles: true,
				composed: true,
			}),
		);
	}

	private onOpenCanvas(canvasPath: string): void {
		this.dispatchEvent(
			new CustomEvent('open-canvas', {
				detail: { canvasPath },
				bubbles: true,
				composed: true,
			}),
		);
	}

	protected renderContent() {
		const filtered = this.filteredCanvases;

		if (filtered.length === 0 && this.canvases.length === 0) {
			return html`
				<div class="empty-state">
					<div class="empty-state__message">No canvas import configurations</div>
				</div>
			`;
		}

		return html`
			<div class="master-detail">
				<div class="master-list">
					${filtered.length === 0
						? html`<div class="empty-state"><div class="empty-state__message">No matches</div></div>`
						: filtered.map((c) => this.renderListItem(c))}
				</div>
				<div class="detail-panel">
					${this.selectedCanvas ? this.renderDetail(this.selectedCanvas) : nothing}
				</div>
			</div>
		`;
	}

	private renderListItem(config: CanvasConfig) {
		const isSelected = config.id === this.selectedId;
		return html`
			<div
				class="list-item ${isSelected ? 'list-item--selected' : ''}"
				@click=${() => this.onSelectCanvas(config.id)}
			>
				<div>${config.name}</div>
				<div class="canvas-meta">${config.canvasPath}</div>
			</div>
		`;
	}

	private renderDetail(config: CanvasConfig) {
		return html`
			<div class="detail-header">
				<h3>${config.name}</h3>
			</div>
			<div class="detail-field">
				<div class="detail-field__label">Canvas Path</div>
				<div class="detail-field__value">${config.canvasPath}</div>
			</div>
			${config.targetFolder ? html`
				<div class="detail-field">
					<div class="detail-field__label">Target Folder</div>
					<div class="detail-field__value">${config.targetFolder}</div>
				</div>
			` : nothing}
			${config.nodeCount !== undefined ? html`
				<div class="detail-field">
					<div class="detail-field__label">Nodes</div>
					<div class="detail-field__value">${config.nodeCount}</div>
				</div>
			` : nothing}
			${config.lastRunAt ? html`
				<div class="detail-field">
					<div class="detail-field__label">Last Run</div>
					<div class="detail-field__value">${config.lastRunAt}</div>
				</div>
			` : nothing}
			<div class="detail-actions">
				<button class="btn-primary" @click=${() => this.onRunCanvas(config.id)}>Run import</button>
				<button @click=${() => this.onOpenCanvas(config.canvasPath)}>Open canvas</button>
			</div>
		`;
	}
}

customElements.define('flowti-dx-canvas', FlowtiDxCanvas);
