import { html, css, nothing } from 'lit';
import { FlowtiElement } from '../flowti-element.js';
import { masterDetailLayout, emptyState, statusBadge } from '../shared-styles.js';

interface MeasurementData {
	id: string;
	name: string;
	description?: string;
	queryId: string;
	type: "single" | "series";
	measureColumn?: string;
	isFavorite?: boolean;
	createdAt: number;
	updatedAt: number;
}

/**
 * Analytics measurements component — master/detail list with CRUD.
 *
 * Displays measurement list (filterable), detail panel for selected item,
 * and action buttons for create/delete.
 *
 * @property measurements - Array of measurement objects
 * @property selectedId - ID of the currently selected measurement
 * @property searchText - External search filter text
 *
 * @fires measurement-selected - detail: { measurementId, name } when an item is clicked
 * @fires create - When the create button is clicked
 * @fires delete - detail: { measurementId } when delete is clicked
 */
export class FlowtiAnalyticsMeasurements extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		measurements: { type: Array },
		selectedId: { type: String },
		searchText: { type: String },
	};

	static styles = [
		...FlowtiElement.styles,
		masterDetailLayout,
		emptyState,
		statusBadge,
		css`
			.measurements-layout {
				display: flex;
				height: 100%;
				gap: var(--flowti-space-md);
			}

			.master-panel {
				flex: 0 0 280px;
				overflow-y: auto;
				display: flex;
				flex-direction: column;
				gap: var(--flowti-space-xs);
			}

			.master-header {
				display: flex;
				align-items: center;
				gap: var(--flowti-space-sm);
				padding: var(--flowti-space-sm) var(--flowti-space-md);
				font-size: var(--flowti-font-sm);
				font-weight: 600;
			}

			.master-count {
				font-size: var(--flowti-font-sm);
				background: var(--background-secondary);
				padding: 0 var(--flowti-space-xs);
				border-radius: var(--flowti-radius);
			}

			.measurement-item {
				display: flex;
				align-items: center;
				gap: var(--flowti-space-sm);
				padding: var(--flowti-space-sm) var(--flowti-space-md);
				border-radius: var(--flowti-radius);
				cursor: pointer;
			}

			.measurement-item:hover {
				background: var(--background-modifier-hover);
			}

			.measurement-item--selected {
				background: var(--background-modifier-active-hover);
			}

			.measurement-name {
				flex: 1;
				font-size: var(--flowti-font-sm);
			}

			.type-badge {
				font-size: var(--flowti-font-sm);
				padding: 1px var(--flowti-space-xs);
				border-radius: var(--flowti-radius);
				background: var(--background-secondary);
				color: var(--flowti-color-muted);
			}

			.detail-panel {
				flex: 1;
				overflow-y: auto;
				padding: var(--flowti-space-md);
			}

			.detail-header {
				font-size: 1.1em;
				font-weight: 600;
				margin-bottom: var(--flowti-space-sm);
			}

			.detail-section {
				margin-top: var(--flowti-space-md);
				padding: var(--flowti-space-md);
				background: var(--background-secondary);
				border-radius: var(--flowti-radius);
			}

			.detail-label {
				font-size: var(--flowti-font-sm);
				color: var(--flowti-color-muted);
				margin-bottom: var(--flowti-space-xs);
			}

			.detail-value {
				font-size: var(--flowti-font-sm);
			}

			.detail-meta {
				display: flex;
				gap: var(--flowti-space-md);
				font-size: var(--flowti-font-sm);
				color: var(--flowti-color-muted);
				margin-top: var(--flowti-space-md);
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

			.delete-btn {
				color: var(--flowti-color-error);
			}

			.star {
				cursor: pointer;
				opacity: 0.3;
			}

			.star--active {
				opacity: 1;
				color: var(--flowti-color-warning, gold);
			}
		`,
	];

	measurements: MeasurementData[] = [];
	selectedId: string | null = null;
	searchText = "";

	private get filteredMeasurements(): MeasurementData[] {
		if (!this.searchText) return this.measurements;
		const lower = this.searchText.toLowerCase();
		return this.measurements.filter(
			(m) =>
				m.name.toLowerCase().includes(lower) ||
				(m.description ?? "").toLowerCase().includes(lower),
		);
	}

	private get selectedMeasurement(): MeasurementData | undefined {
		return this.measurements.find((m) => m.id === this.selectedId);
	}

	private onItemClick(m: MeasurementData): void {
		this.selectedId = m.id;
		this.dispatchEvent(
			new CustomEvent("measurement-selected", {
				detail: { measurementId: m.id, name: m.name },
				bubbles: true,
				composed: true,
			}),
		);
	}

	private dispatchCreate(): void {
		this.dispatchEvent(
			new CustomEvent("create", { bubbles: true, composed: true }),
		);
	}

	private dispatchDelete(id: string): void {
		this.dispatchEvent(
			new CustomEvent("delete", {
				detail: { measurementId: id },
				bubbles: true,
				composed: true,
			}),
		);
	}

	protected renderContent() {
		const filtered = this.filteredMeasurements;

		if (this.measurements.length === 0) {
			return html`
				<div class="empty-state">
					<div class="empty-state__message">No measurements yet</div>
					<button data-action="create" @click=${this.dispatchCreate}>Create Measurement</button>
				</div>
			`;
		}

		return html`
			<div class="measurements-layout">
				<div class="master-panel">
					<div class="master-header">
						Measurements
						<span class="master-count">${filtered.length}</span>
						<button data-action="create" @click=${this.dispatchCreate} style="margin-left: auto">+</button>
					</div>
					${filtered.length === 0
						? html`<div class="empty-state"><div class="empty-state__message">No matching measurements</div></div>`
						: filtered.map((m) => this.renderItem(m))}
				</div>
				<div class="detail-panel">
					${this.selectedMeasurement
						? this.renderDetail(this.selectedMeasurement)
						: html`<div class="empty-state"><div class="empty-state__message">Select a measurement</div></div>`}
				</div>
			</div>
		`;
	}

	private renderItem(m: MeasurementData) {
		const isSelected = m.id === this.selectedId;
		return html`
			<div
				class="measurement-item ${isSelected ? "measurement-item--selected" : ""}"
				@click=${() => this.onItemClick(m)}
			>
				<span class="star ${m.isFavorite ? "star--active" : ""}">*</span>
				<span class="measurement-name">${m.name}</span>
				<span class="type-badge">${m.type}</span>
			</div>
		`;
	}

	private renderDetail(m: MeasurementData) {
		return html`
			<div class="detail-header">${m.name}</div>
			${m.description ? html`<div class="detail-value">${m.description}</div>` : nothing}
			<div class="detail-section">
				<div class="detail-label">Type</div>
				<div class="detail-value">${m.type === "single" ? "Single Value" : "Time Series"}</div>
			</div>
			${m.measureColumn ? html`
				<div class="detail-section">
					<div class="detail-label">Measure Column</div>
					<div class="detail-value">${m.measureColumn}</div>
				</div>
			` : nothing}
			<div class="detail-section">
				<div class="detail-label">Source Query</div>
				<div class="detail-value">${m.queryId}</div>
			</div>
			<div class="detail-meta">
				<span>Created: ${new Date(m.createdAt).toLocaleDateString()}</span>
				<span>Updated: ${new Date(m.updatedAt).toLocaleDateString()}</span>
			</div>
			<div class="detail-actions">
				<button class="delete-btn" data-action="delete" @click=${() => this.dispatchDelete(m.id)}>Delete</button>
			</div>
		`;
	}
}

if (!customElements.get('flowti-analytics-measurements')) customElements.define('flowti-analytics-measurements', FlowtiAnalyticsMeasurements);
