import { html, css, nothing } from 'lit';
import { FlowtiElement } from '../flowti-element.js';
import { masterDetailLayout, emptyState } from '../shared-styles.js';

interface TypeEntry {
	name: string;
	description: string;
	properties: string[];
	filePath: string;
	pipelineCount: number;
}

/**
 * Data Exchange Types — master/detail list of data exchange type definitions.
 *
 * @property types - Array of type doc entries
 * @property selectedId - Currently selected type name
 * @property searchText - External text filter
 *
 * @fires select-type - detail: { typeName }
 * @fires open-type - detail: { typeName, filePath }
 */
export class FlowtiDxTypes extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		types: { type: Array },
		selectedId: { type: String },
		searchText: { type: String },
	};

	static styles = [
		...FlowtiElement.styles,
		masterDetailLayout,
		emptyState,
		css`
			.type-meta {
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

			.detail-description {
				font-size: var(--flowti-font-sm);
				color: var(--flowti-color-muted);
				margin-bottom: var(--flowti-space-md);
			}

			.detail-section {
				margin-bottom: var(--flowti-space-md);
			}

			.detail-section__label {
				font-size: var(--flowti-font-sm);
				font-weight: 600;
				margin-bottom: var(--flowti-space-xs);
			}

			.property-list {
				display: flex;
				flex-wrap: wrap;
				gap: var(--flowti-space-xs);
			}

			.property-tag {
				padding: 2px var(--flowti-space-sm);
				border-radius: var(--flowti-radius);
				background: var(--background-secondary);
				font-size: var(--flowti-font-sm);
			}

			.pipeline-count {
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

			.empty-state__hint {
				font-size: var(--flowti-font-sm);
				color: var(--flowti-color-muted);
				margin-top: var(--flowti-space-xs);
			}
		`,
	];

	types: TypeEntry[] = [];
	selectedId: string | null = null;
	searchText = '';

	private get filteredTypes(): TypeEntry[] {
		if (!this.searchText) return this.types;
		const lower = this.searchText.toLowerCase();
		return this.types.filter((t) =>
			t.name.toLowerCase().includes(lower) ||
			t.description.toLowerCase().includes(lower),
		);
	}

	private get selectedType(): TypeEntry | undefined {
		return this.types.find((t) => t.name === this.selectedId);
	}

	private onSelectType(typeName: string): void {
		this.selectedId = typeName;
		this.dispatchEvent(
			new CustomEvent('select-type', {
				detail: { typeName },
				bubbles: true,
				composed: true,
			}),
		);
	}

	private onOpenType(typeName: string, filePath: string): void {
		this.dispatchEvent(
			new CustomEvent('open-type', {
				detail: { typeName, filePath },
				bubbles: true,
				composed: true,
			}),
		);
	}

	protected renderContent() {
		const filtered = this.filteredTypes;

		if (filtered.length === 0 && this.types.length === 0) {
			return html`
				<div class="empty-state">
					<div class="empty-state__message">No note types defined yet</div>
					<div class="empty-state__hint">
						Types appear here when import or export configs specify a noteType.
					</div>
				</div>
			`;
		}

		return html`
			<div class="master-detail">
				<div class="master-list">
					${filtered.length === 0
						? html`<div class="empty-state"><div class="empty-state__message">No matches</div></div>`
						: filtered.map((t) => this.renderListItem(t))}
				</div>
				<div class="detail-panel">
					${this.selectedType ? this.renderDetail(this.selectedType) : nothing}
				</div>
			</div>
		`;
	}

	private renderListItem(entry: TypeEntry) {
		const isSelected = entry.name === this.selectedId;
		return html`
			<div
				class="list-item ${isSelected ? 'list-item--selected' : ''}"
				@click=${() => this.onSelectType(entry.name)}
			>
				<div>${entry.name}</div>
				<div class="type-meta">${entry.properties.length} properties</div>
			</div>
		`;
	}

	private renderDetail(entry: TypeEntry) {
		return html`
			<div class="detail-header">
				<h3>${entry.name}</h3>
			</div>
			${entry.description ? html`
				<div class="detail-description">${entry.description}</div>
			` : nothing}
			<div class="detail-section">
				<div class="detail-section__label">Properties (${entry.properties.length})</div>
				<div class="property-list">
					${entry.properties.map((p) => html`<span class="property-tag">${p}</span>`)}
				</div>
			</div>
			<div class="pipeline-count">Used in ${entry.pipelineCount} pipeline(s)</div>
			<button @click=${() => this.onOpenType(entry.name, entry.filePath)}>Open definition</button>
		`;
	}
}

if (!customElements.get('flowti-dx-types')) customElements.define('flowti-dx-types', FlowtiDxTypes);
