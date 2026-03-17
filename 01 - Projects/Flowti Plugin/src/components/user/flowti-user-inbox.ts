import { html, css, nothing } from 'lit';
import { FlowtiElement } from '../flowti-element.js';
import { masterDetailLayout, statusBadge, emptyState } from '../shared-styles.js';

interface InboxItemData {
	id: string;
	title: string;
	type: string;
	read: boolean;
	sourceEvent: string;
	timestamp: string;
	description?: string;
	filePath?: string;
}

/**
 * User Inbox — inbox master/detail with read/unread and actions.
 *
 * @property items - Array of inbox item objects
 * @property selectedId - ID of the currently selected item
 * @property searchText - Filter text for item titles
 *
 * @fires item-selected - detail: { itemId } when an item is clicked
 * @fires mark-read - detail: { itemId } when mark-read action is clicked
 * @fires dismiss - detail: { itemId } when dismiss action is clicked
 * @fires action - detail: { itemId, action } for other actions
 */
export class FlowtiUserInbox extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		items: { type: Array },
		selectedId: { type: String },
		searchText: { type: String },
	};

	static styles = [
		...FlowtiElement.styles,
		masterDetailLayout,
		statusBadge,
		emptyState,
		css`
			.inbox-layout {
				display: flex;
				flex-direction: column;
				gap: var(--flowti-space-md);
			}

			.inbox-list {
				display: flex;
				flex-direction: column;
				gap: var(--flowti-space-xs);
			}

			.inbox-item {
				padding: var(--flowti-space-sm) var(--flowti-space-md);
				border-radius: var(--flowti-radius);
				cursor: pointer;
				display: flex;
				align-items: center;
				gap: var(--flowti-space-sm);
			}

			.inbox-item:hover {
				background: var(--background-modifier-hover);
			}

			.inbox-item--selected {
				background: var(--background-modifier-active-hover);
			}

			.inbox-item--unread {
				font-weight: 600;
			}

			.inbox-item--unread::before {
				content: '';
				display: inline-block;
				width: 6px;
				height: 6px;
				border-radius: 50%;
				background: var(--flowti-color-info);
				flex-shrink: 0;
			}

			.item-title {
				flex: 1;
				font-size: var(--flowti-font-sm);
			}

			.item-source {
				font-size: var(--flowti-font-sm);
				color: var(--flowti-color-muted);
			}

			.item-time {
				font-size: var(--flowti-font-sm);
				color: var(--flowti-color-muted);
			}

			.detail-panel {
				padding: var(--flowti-space-md);
				background: var(--background-secondary);
				border-radius: var(--flowti-radius);
			}

			.detail-title {
				font-weight: 600;
				font-size: 1.1em;
				margin-bottom: var(--flowti-space-sm);
			}

			.detail-meta {
				display: flex;
				gap: var(--flowti-space-sm);
				font-size: var(--flowti-font-sm);
				color: var(--flowti-color-muted);
				margin-bottom: var(--flowti-space-md);
			}

			.detail-description {
				font-size: var(--flowti-font-sm);
				margin-bottom: var(--flowti-space-md);
			}

			.action-bar {
				display: flex;
				gap: var(--flowti-space-sm);
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
		`,
	];

	items: InboxItemData[] = [];
	selectedId: string | null = null;
	searchText = '';

	private get filteredItems(): InboxItemData[] {
		if (!this.searchText) return this.items;
		const lower = this.searchText.toLowerCase();
		return this.items.filter((i) => i.title.toLowerCase().includes(lower));
	}

	private get selectedItem(): InboxItemData | undefined {
		return this.items.find((i) => i.id === this.selectedId);
	}

	private dispatchItemSelected(itemId: string): void {
		this.dispatchEvent(
			new CustomEvent('item-selected', {
				detail: { itemId },
				bubbles: true,
				composed: true,
			}),
		);
	}

	private dispatchMarkRead(itemId: string): void {
		this.dispatchEvent(
			new CustomEvent('mark-read', {
				detail: { itemId },
				bubbles: true,
				composed: true,
			}),
		);
	}

	private dispatchDismiss(itemId: string): void {
		this.dispatchEvent(
			new CustomEvent('dismiss', {
				detail: { itemId },
				bubbles: true,
				composed: true,
			}),
		);
	}

	protected renderContent() {
		return html`
			<div class="inbox-layout">
				${this.renderList()}
				${this.renderDetail()}
			</div>
		`;
	}

	private renderList() {
		const filtered = this.filteredItems;

		if (filtered.length === 0) {
			return html`
				<div class="empty-state">
					<div class="empty-state__message">No inbox items</div>
				</div>
			`;
		}

		return html`
			<div class="inbox-list">
				${filtered.map((item) => this.renderItem(item))}
			</div>
		`;
	}

	private renderItem(item: InboxItemData) {
		const isSelected = item.id === this.selectedId;
		const classes = [
			'inbox-item',
			isSelected ? 'inbox-item--selected' : '',
			!item.read ? 'inbox-item--unread' : '',
		].filter(Boolean).join(' ');

		return html`
			<div
				class="${classes}"
				@click=${() => this.dispatchItemSelected(item.id)}
			>
				<span class="item-title">${item.title}</span>
				<span class="item-source">${item.sourceEvent}</span>
			</div>
		`;
	}

	private renderDetail() {
		const item = this.selectedItem;
		if (!item) return nothing;

		return html`
			<div class="detail-panel">
				<div class="detail-title">${item.title}</div>
				<div class="detail-meta">
					<span class="status-badge status-badge--${item.type === 'action' ? 'warning' : 'info'}">
						${item.type === 'action' ? 'Action Required' : 'Information'}
					</span>
					<span>${item.sourceEvent}</span>
				</div>
				${item.description ? html`<div class="detail-description">${item.description}</div>` : nothing}
				<div class="action-bar">
					${!item.read ? html`
						<button class="action-mark-read" @click=${(e: Event) => { e.stopPropagation(); this.dispatchMarkRead(item.id); }}>
							Mark read
						</button>
					` : nothing}
					<button class="action-dismiss" @click=${(e: Event) => { e.stopPropagation(); this.dispatchDismiss(item.id); }}>
						Dismiss
					</button>
				</div>
			</div>
		`;
	}
}

customElements.define('flowti-user-inbox', FlowtiUserInbox);
