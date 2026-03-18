import { html, css, nothing } from 'lit';
import { FlowtiElement } from '../flowti-element.js';
import { masterDetailLayout, emptyState } from '../shared-styles.js';

interface HealthItem {
	id: string;
	name: string;
	description: string;
	count: number;
	status?: string;
}

/**
 * User Health — health scanner dashboard.
 * Reuses the entity-scanner display pattern from Chunk 2.
 *
 * @property healthItems - Array of health check items
 * @property searchText - External search filter text
 * @property selectedId - ID of the currently selected item
 *
 * @fires item-selected - detail: { id, name } when an item is clicked
 */
export class FlowtiUserHealth extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		healthItems: { type: Array },
		searchText: { type: String },
		selectedId: { type: String },
	};

	static styles = [
		...FlowtiElement.styles,
		masterDetailLayout,
		emptyState,
		css`
			.health-layout {
				display: flex;
				gap: var(--flowti-space-md);
				min-height: 200px;
			}

			.health-list {
				flex: 0 0 280px;
				display: flex;
				flex-direction: column;
				gap: var(--flowti-space-xs);
				overflow-y: auto;
			}

			.health-item {
				padding: var(--flowti-space-sm) var(--flowti-space-md);
				border-radius: var(--flowti-radius);
				cursor: pointer;
				display: flex;
				align-items: center;
				gap: var(--flowti-space-sm);
			}

			.health-item:hover {
				background: var(--background-modifier-hover);
			}

			.health-item--selected {
				background: var(--background-modifier-active-hover);
			}

			.item-name {
				flex: 1;
				font-size: var(--flowti-font-sm);
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

			.detail-section {
				flex: 1;
				padding: var(--flowti-space-md);
				background: var(--background-secondary);
				border-radius: var(--flowti-radius);
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

			.empty-state__hint {
				font-size: var(--flowti-font-sm);
				color: var(--flowti-color-muted);
				margin-top: var(--flowti-space-xs);
			}
		`,
	];

	healthItems: HealthItem[] = [];
	searchText = '';
	selectedId: string | null = null;

	private get filteredItems(): HealthItem[] {
		if (!this.searchText) return this.healthItems;
		const lower = this.searchText.toLowerCase();
		return this.healthItems.filter(
			(item) =>
				item.name.toLowerCase().includes(lower) ||
				item.description.toLowerCase().includes(lower),
		);
	}

	private get selectedItem(): HealthItem | undefined {
		return this.healthItems.find((item) => item.id === this.selectedId);
	}

	private onItemClick(item: HealthItem): void {
		this.selectedId = item.id;
		this.dispatchEvent(
			new CustomEvent('item-selected', {
				detail: { id: item.id, name: item.name },
				bubbles: true,
				composed: true,
			}),
		);
	}

	protected renderContent() {
		const filtered = this.filteredItems;

		if (filtered.length === 0 && this.healthItems.length === 0) {
			return html`
				<div class="empty-state">
					<div class="empty-state__message">No health checks available</div>
					<div class="empty-state__hint">
						Health checks will appear here once a health scanning service is configured.
					</div>
				</div>
			`;
		}

		if (filtered.length === 0) {
			return html`
				<div class="empty-state">
					<div class="empty-state__message">No health checks match the search</div>
				</div>
			`;
		}

		return html`
			<div class="health-layout">
				<div class="health-list">
					${filtered.map((item) => this.renderListItem(item))}
				</div>
				${this.selectedItem ? this.renderDetail(this.selectedItem) : nothing}
			</div>
		`;
	}

	private renderListItem(item: HealthItem) {
		const isSelected = item.id === this.selectedId;
		return html`
			<div
				class="health-item ${isSelected ? 'health-item--selected' : ''}"
				@click=${() => this.onItemClick(item)}
			>
				<span class="item-name">${item.name}</span>
				<span class="count-badge">${item.count}</span>
			</div>
		`;
	}

	private renderDetail(item: HealthItem) {
		return html`
			<div class="detail-section">
				<div class="detail-title">${item.name}</div>
				${item.description
					? html`<div class="detail-description">${item.description}</div>`
					: nothing}
				<div class="detail-count">${item.count} items</div>
			</div>
		`;
	}
}

if (!customElements.get('flowti-user-health')) customElements.define('flowti-user-health', FlowtiUserHealth);
