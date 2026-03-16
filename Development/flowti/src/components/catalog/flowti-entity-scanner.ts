import { html, css, nothing } from 'lit';
import { FlowtiElement } from '../flowti-element.js';
import { masterDetailLayout, emptyState } from '../shared-styles.js';

export interface ScannerEntity {
	id: string;
	name: string;
	description: string;
	count: number;
}

/**
 * Shared base component for entity-scanning catalog tabs
 * (Domains, Services, Flows, Systems, Actors).
 *
 * Renders a master/detail list of scanned entities with count badge.
 * Filtering by searchText is applied to name and description.
 *
 * @property entities - Array of scanned entity objects
 * @property searchText - External search filter text
 * @property selectedId - ID of the currently selected entity
 * @property entityType - Type label for empty state messaging
 *
 * @fires entity-selected - detail: { id, name } when an entity is clicked
 */
export class FlowtiEntityScanner extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		entities: { type: Array },
		searchText: { type: String },
		selectedId: { type: String },
		entityType: { type: String },
	};

	static styles = [
		...FlowtiElement.styles,
		masterDetailLayout,
		emptyState,
		css`
			.scanner-layout {
				display: flex;
				height: 100%;
				gap: var(--flowti-space-md);
			}

			.count-badge {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				min-width: 1.5em;
				padding: 2px var(--flowti-space-xs);
				border-radius: var(--flowti-radius);
				background: var(--background-secondary);
				font-size: var(--flowti-font-sm);
				color: var(--flowti-color-muted);
			}

			.entity-name {
				flex: 1;
				font-size: var(--flowti-font-sm);
			}

			.detail-title {
				font-size: 1.1em;
				font-weight: 600;
				margin-bottom: var(--flowti-space-sm);
			}

			.detail-description {
				font-size: var(--flowti-font-sm);
				color: var(--flowti-color-muted);
			}

			.detail-count {
				font-size: var(--flowti-font-sm);
				color: var(--flowti-color-muted);
				margin-top: var(--flowti-space-sm);
			}
		`,
	];

	entities: ScannerEntity[] = [];
	searchText = '';
	selectedId: string | null = null;
	entityType = '';

	private get filteredEntities(): ScannerEntity[] {
		if (!this.searchText) return this.entities;
		const lower = this.searchText.toLowerCase();
		return this.entities.filter(
			(e) =>
				e.name.toLowerCase().includes(lower) ||
				e.description.toLowerCase().includes(lower),
		);
	}

	private get selectedEntity(): ScannerEntity | undefined {
		return this.entities.find((e) => e.id === this.selectedId);
	}

	private onEntityClick(entity: ScannerEntity): void {
		this.selectedId = entity.id;
		this.dispatchEvent(
			new CustomEvent('entity-selected', {
				detail: { id: entity.id, name: entity.name },
				bubbles: true,
				composed: true,
			}),
		);
	}

	protected renderContent() {
		const filtered = this.filteredEntities;

		if (filtered.length === 0 && this.entities.length === 0) {
			return html`
				<div class="empty-state">
					<div class="empty-state__message">No ${this.entityType || 'entities'} found</div>
				</div>
			`;
		}

		if (filtered.length === 0) {
			return html`
				<div class="empty-state">
					<div class="empty-state__message">No ${this.entityType || 'entities'} match the search</div>
				</div>
			`;
		}

		return html`
			<div class="master-detail">
				<div class="master-list">
					${filtered.map((entity) => this.renderListItem(entity))}
				</div>
				<div class="detail-panel">
					${this.selectedEntity ? this.renderDetail(this.selectedEntity) : nothing}
				</div>
			</div>
		`;
	}

	private renderListItem(entity: ScannerEntity) {
		const isSelected = entity.id === this.selectedId;
		return html`
			<div
				class="list-item ${isSelected ? 'list-item--selected' : ''}"
				@click=${() => this.onEntityClick(entity)}
			>
				<span class="entity-name">${entity.name}</span>
				<span class="count-badge">${entity.count}</span>
			</div>
		`;
	}

	private renderDetail(entity: ScannerEntity) {
		return html`
			<div class="detail-title">${entity.name}</div>
			${entity.description
				? html`<div class="detail-description">${entity.description}</div>`
				: nothing}
			<div class="detail-count">${entity.count} events</div>
		`;
	}
}

customElements.define('flowti-entity-scanner', FlowtiEntityScanner);
