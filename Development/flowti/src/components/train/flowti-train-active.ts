import { html, css, nothing } from 'lit';
import { FlowtiElement } from '../flowti-element.js';
import { masterDetailLayout, statusBadge, emptyState } from '../shared-styles.js';

type SortBy = 'recent' | 'most-thoughts' | 'longest';

interface TrainItem {
	id: string;
	title: string;
	status: string;
	thoughts: unknown[];
	createdAt: string;
	pausedAt: string | null;
	durationMinutes: number;
	trainType?: string;
}

const TRAIN_TYPES = [
	{ id: 'brainstorm', label: 'Brainstorm' },
	{ id: 'research', label: 'Research' },
	{ id: 'decision', label: 'Decision' },
	{ id: 'free-form', label: 'Free-form' },
];

/**
 * Active trains list with master-detail layout, filtering, and sorting.
 *
 * Renders running/paused trains with type filter, sort dropdown,
 * and a detail panel showing train info and action buttons.
 *
 * @property trains - Array of active/paused train objects
 * @property searchText - External text filter
 * @property selectedTrainId - ID of the selected train for detail view
 *
 * @fires open-train - detail: { trainId }
 * @fires resume-train - detail: { trainId }
 * @fires pause-train - detail: { trainId }
 * @fires delete-train - detail: { trainId }
 */
export class FlowtiTrainActive extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		trains: { type: Array },
		searchText: { type: String },
		selectedTrainId: { type: String },
		typeFilter: { type: String, state: true },
		sortBy: { type: String, state: true },
	};

	static styles = [
		...FlowtiElement.styles,
		masterDetailLayout,
		statusBadge,
		emptyState,
		css`
			.toolbar {
				display: flex;
				gap: var(--flowti-space-sm);
				margin-bottom: var(--flowti-space-md);
			}

			select {
				padding: var(--flowti-space-xs) var(--flowti-space-sm);
				border-radius: var(--flowti-radius);
				border: 1px solid var(--flowti-border);
				background: var(--background-primary);
				color: var(--text-normal);
				font-size: var(--flowti-font-sm);
				cursor: pointer;
			}

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

			.type-badge {
				font-size: var(--flowti-font-sm);
				padding: 2px var(--flowti-space-xs);
				border-radius: var(--flowti-radius);
				background: var(--background-secondary);
				color: var(--flowti-color-muted);
			}
		`,
	];

	trains: TrainItem[] = [];
	searchText = '';
	selectedTrainId: string | null = null;
	typeFilter = 'all';
	sortBy: SortBy = 'recent';

	private get filteredTrains(): TrainItem[] {
		let result = [...this.trains];

		if (this.typeFilter !== 'all') {
			result = result.filter((t) => (t.trainType ?? 'free-form') === this.typeFilter);
		}

		if (this.searchText) {
			const lower = this.searchText.toLowerCase();
			result = result.filter((t) => t.title.toLowerCase().includes(lower));
		}

		result.sort((a, b) => {
			switch (this.sortBy) {
				case 'most-thoughts':
					return b.thoughts.length - a.thoughts.length;
				case 'longest':
					return b.durationMinutes - a.durationMinutes;
				case 'recent':
				default:
					return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
			}
		});

		return result;
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

	private onTypeFilterChange(e: Event): void {
		this.typeFilter = (e.target as HTMLSelectElement).value;
	}

	private onSortChange(e: Event): void {
		this.sortBy = (e.target as HTMLSelectElement).value as SortBy;
	}

	private onSelectTrain(trainId: string): void {
		this.selectedTrainId = trainId;
	}

	private getStatusVariant(status: string): string {
		switch (status) {
			case 'running': return 'success';
			case 'paused': return 'warning';
			default: return 'muted';
		}
	}

	protected renderContent() {
		const filtered = this.filteredTrains;

		if (filtered.length === 0 && this.trains.length === 0) {
			return html`
				<div class="empty-state">
					<div class="empty-state__message">No active trains</div>
				</div>
			`;
		}

		if (filtered.length === 0) {
			return html`
				${this.renderToolbar()}
				<div class="empty-state">
					<div class="empty-state__message">No trains match the current filters</div>
				</div>
			`;
		}

		return html`
			${this.renderToolbar()}
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

	private renderToolbar() {
		return html`
			<div class="toolbar">
				<select class="type-filter" @change=${this.onTypeFilterChange} .value=${this.typeFilter}>
					<option value="all">All types</option>
					${TRAIN_TYPES.map((t) => html`<option value=${t.id}>${t.label}</option>`)}
				</select>
				<select class="sort-select" @change=${this.onSortChange} .value=${this.sortBy}>
					<option value="recent">Most recent</option>
					<option value="most-thoughts">Most thoughts</option>
					<option value="longest">Longest duration</option>
				</select>
			</div>
		`;
	}

	private renderListItem(train: TrainItem) {
		const isSelected = train.id === this.selectedTrainId;
		const variant = this.getStatusVariant(train.status);
		const typeConfig = TRAIN_TYPES.find((t) => t.id === train.trainType);

		return html`
			<div
				class="list-item ${isSelected ? 'list-item--selected' : ''}"
				@click=${() => this.onSelectTrain(train.id)}
			>
				<span class="status-badge status-badge--${variant}">${train.status}</span>
				<span class="train-title">${train.title}</span>
				${typeConfig ? html`<span class="type-badge">${typeConfig.label}</span>` : nothing}
				<span class="train-meta">${train.thoughts.length} thoughts</span>
			</div>
		`;
	}

	private renderDetail(train: TrainItem) {
		const variant = this.getStatusVariant(train.status);

		return html`
			<div class="detail-header">
				<h3>${train.title}</h3>
				<span class="status-badge status-badge--${variant}">${train.status}</span>
			</div>
			<div class="detail-info">
				<div>Thoughts: ${train.thoughts.length}</div>
				<div class="detail-info-muted">Started: ${new Date(train.createdAt).toLocaleString()}</div>
				${train.durationMinutes > 0
					? html`<div class="detail-info-muted">Duration: ${train.durationMinutes} min</div>`
					: nothing}
			</div>
			<div class="detail-actions">
				<button class="btn-open" @click=${() => this.dispatchTrainEvent('open-train', train.id)}>Open</button>
				${train.status === 'paused'
					? html`<button class="btn-resume" @click=${() => this.dispatchTrainEvent('resume-train', train.id)}>Resume</button>`
					: nothing}
				${train.status === 'running'
					? html`<button class="btn-pause" @click=${() => this.dispatchTrainEvent('pause-train', train.id)}>Pause</button>`
					: nothing}
				<button class="btn-delete" @click=${() => this.dispatchTrainEvent('delete-train', train.id)}>Delete</button>
			</div>
		`;
	}
}

customElements.define('flowti-train-active', FlowtiTrainActive);
