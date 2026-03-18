import { html, css, nothing } from 'lit';
import { FlowtiElement } from '../flowti-element.js';
import { masterDetailLayout, statusBadge, emptyState } from '../shared-styles.js';

interface TrainItem {
	id: string;
	title: string;
	status: string;
	thoughts: unknown[];
	createdAt: string;
	completedAt: string | null;
	trainType?: string;
}

/**
 * Completed trains list with master-detail layout.
 *
 * Renders a searchable list of completed trains with a detail panel
 * showing train info, completion date, and action buttons.
 *
 * @property trains - Array of completed train objects
 * @property searchText - External text filter
 * @property selectedTrainId - ID of the selected train for detail view
 *
 * @fires open-train - detail: { trainId }
 * @fires delete-train - detail: { trainId }
 */
export class FlowtiTrainHistory extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		trains: { type: Array },
		searchText: { type: String },
		selectedTrainId: { type: String },
	};

	static styles = [
		...FlowtiElement.styles,
		masterDetailLayout,
		statusBadge,
		emptyState,
		css`
			.train-title {
				flex: 1;
				font-size: var(--flowti-font-sm);
			}

			.train-meta {
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

			.detail-info {
				display: flex;
				flex-direction: column;
				gap: var(--flowti-space-xs);
				font-size: var(--flowti-font-sm);
				margin-bottom: var(--flowti-space-md);
			}

			.detail-info-muted {
				color: var(--flowti-color-muted);
			}

			.detail-actions {
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

			.btn-delete {
				color: var(--flowti-color-error);
			}
		`,
	];

	trains: TrainItem[] = [];
	searchText = '';
	selectedTrainId: string | null = null;

	private get filteredTrains(): TrainItem[] {
		if (!this.searchText) return this.trains;
		const lower = this.searchText.toLowerCase();
		return this.trains.filter((t) => t.title.toLowerCase().includes(lower));
	}

	private get selectedTrain(): TrainItem | undefined {
		return this.trains.find((t) => t.id === this.selectedTrainId);
	}

	private dispatchTrainEvent(eventName: string, trainId: string): void {
		this.dispatchEvent(
			new CustomEvent(eventName, {
				detail: { trainId },
				bubbles: true,
				composed: true,
			}),
		);
	}

	private onSelectTrain(trainId: string): void {
		this.selectedTrainId = trainId;
	}

	protected renderContent() {
		const filtered = this.filteredTrains;

		if (filtered.length === 0 && this.trains.length === 0) {
			return html`
				<div class="empty-state">
					<div class="empty-state__message">No completed trains</div>
				</div>
			`;
		}

		if (filtered.length === 0) {
			return html`
				<div class="empty-state">
					<div class="empty-state__message">No trains match the current filters</div>
				</div>
			`;
		}

		return html`
			<div class="master-detail">
				<div class="master-list">
					${filtered.map((train) => this.renderListItem(train))}
				</div>
				<div class="detail-panel">
					${this.selectedTrain ? this.renderDetail(this.selectedTrain) : nothing}
				</div>
			</div>
		`;
	}

	private renderListItem(train: TrainItem) {
		const isSelected = train.id === this.selectedTrainId;

		return html`
			<div
				class="list-item ${isSelected ? 'list-item--selected' : ''}"
				@click=${() => this.onSelectTrain(train.id)}
			>
				<span class="status-badge status-badge--muted">completed</span>
				<span class="train-title">${train.title}</span>
				<span class="train-meta">${train.thoughts.length} thoughts</span>
			</div>
		`;
	}

	private renderDetail(train: TrainItem) {
		return html`
			<div class="detail-header">
				<h3>${train.title}</h3>
				<span class="status-badge status-badge--muted">completed</span>
			</div>
			<div class="detail-info">
				<div>Thoughts: ${train.thoughts.length}</div>
				<div class="detail-info-muted">Started: ${new Date(train.createdAt).toLocaleString()}</div>
				${train.completedAt
					? html`<div class="detail-info-muted">Completed: ${new Date(train.completedAt).toLocaleString()}</div>`
					: nothing}
			</div>
			<div class="detail-actions">
				<button class="btn-open" @click=${() => this.dispatchTrainEvent('open-train', train.id)}>Open</button>
				<button class="btn-delete" @click=${() => this.dispatchTrainEvent('delete-train', train.id)}>Delete</button>
			</div>
		`;
	}
}

if (!customElements.get('flowti-train-history')) customElements.define('flowti-train-history', FlowtiTrainHistory);
