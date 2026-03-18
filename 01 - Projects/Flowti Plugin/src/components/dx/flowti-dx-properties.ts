import { html, css, nothing } from 'lit';
import { FlowtiElement } from '../flowti-element.js';
import { masterDetailLayout, emptyState } from '../shared-styles.js';

interface PropertyEntry {
	propertyName: string;
	noteCount: number;
	uniqueValues: number;
	hasDoc: boolean;
	sampleValues?: string[];
}

/**
 * Data Exchange Properties — master/detail of exchange properties.
 *
 * @property properties - Array of property entries from the data dictionary
 * @property selectedId - Currently selected property name
 * @property searchText - External text filter
 *
 * @fires select-property - detail: { propertyName }
 * @fires open-property-doc - detail: { propertyName }
 * @fires create-property-doc - detail: { propertyName }
 */
export class FlowtiDxProperties extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		properties: { type: Array },
		selectedId: { type: String },
		searchText: { type: String },
	};

	static styles = [
		...FlowtiElement.styles,
		masterDetailLayout,
		emptyState,
		css`
			.prop-meta {
				font-size: var(--flowti-font-sm);
				color: var(--flowti-color-muted);
			}

			.prop-doc-badge {
				display: inline-flex;
				padding: 2px var(--flowti-space-xs);
				border-radius: var(--flowti-radius);
				font-size: var(--flowti-font-sm);
			}

			.prop-doc-badge--yes {
				color: var(--flowti-color-success);
				background: rgba(var(--color-green-rgb), 0.15);
			}

			.prop-doc-badge--no {
				color: var(--flowti-color-muted);
				background: var(--background-secondary);
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

			.sample-values {
				display: flex;
				flex-wrap: wrap;
				gap: var(--flowti-space-xs);
			}

			.sample-tag {
				padding: 2px var(--flowti-space-sm);
				border-radius: var(--flowti-radius);
				background: var(--background-secondary);
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
		`,
	];

	properties: PropertyEntry[] = [];
	selectedId: string | null = null;
	searchText = '';

	private get filteredProperties(): PropertyEntry[] {
		if (!this.searchText) return this.properties;
		const lower = this.searchText.toLowerCase();
		return this.properties.filter((p) => p.propertyName.toLowerCase().includes(lower));
	}

	private get selectedProperty(): PropertyEntry | undefined {
		return this.properties.find((p) => p.propertyName === this.selectedId);
	}

	private onSelectProperty(propertyName: string): void {
		this.selectedId = propertyName;
		this.dispatchEvent(
			new CustomEvent('select-property', {
				detail: { propertyName },
				bubbles: true,
				composed: true,
			}),
		);
	}

	private onOpenDoc(propertyName: string): void {
		this.dispatchEvent(
			new CustomEvent('open-property-doc', {
				detail: { propertyName },
				bubbles: true,
				composed: true,
			}),
		);
	}

	private onCreateDoc(propertyName: string): void {
		this.dispatchEvent(
			new CustomEvent('create-property-doc', {
				detail: { propertyName },
				bubbles: true,
				composed: true,
			}),
		);
	}

	protected renderContent() {
		const filtered = this.filteredProperties;

		if (filtered.length === 0 && this.properties.length === 0) {
			return html`
				<div class="empty-state">
					<div class="empty-state__message">No properties found in the data dictionary</div>
				</div>
			`;
		}

		return html`
			<div class="master-detail">
				<div class="master-list">
					${filtered.length === 0
						? html`<div class="empty-state"><div class="empty-state__message">No matches</div></div>`
						: filtered.map((p) => this.renderListItem(p))}
				</div>
				<div class="detail-panel">
					${this.selectedProperty ? this.renderDetail(this.selectedProperty) : nothing}
				</div>
			</div>
		`;
	}

	private renderListItem(entry: PropertyEntry) {
		const isSelected = entry.propertyName === this.selectedId;
		return html`
			<div
				class="list-item ${isSelected ? 'list-item--selected' : ''}"
				@click=${() => this.onSelectProperty(entry.propertyName)}
			>
				<div>${entry.propertyName}</div>
				<div class="prop-meta">${entry.noteCount} notes</div>
			</div>
		`;
	}

	private renderDetail(entry: PropertyEntry) {
		return html`
			<div class="detail-header">
				<h3>${entry.propertyName}</h3>
				<span class="prop-doc-badge ${entry.hasDoc ? 'prop-doc-badge--yes' : 'prop-doc-badge--no'}">
					${entry.hasDoc ? 'Documented' : 'Undocumented'}
				</span>
			</div>
			<div class="detail-field">
				<div class="detail-field__label">Used in</div>
				<div class="detail-field__value">${entry.noteCount} notes</div>
			</div>
			<div class="detail-field">
				<div class="detail-field__label">Unique values</div>
				<div class="detail-field__value">${entry.uniqueValues}</div>
			</div>
			${entry.sampleValues && entry.sampleValues.length > 0 ? html`
				<div class="detail-field">
					<div class="detail-field__label">Sample values</div>
					<div class="sample-values">
						${entry.sampleValues.map((v) => html`<span class="sample-tag">${v}</span>`)}
					</div>
				</div>
			` : nothing}
			<div class="detail-actions">
				${entry.hasDoc
					? html`<button @click=${() => this.onOpenDoc(entry.propertyName)}>Open doc</button>`
					: html`<button @click=${() => this.onCreateDoc(entry.propertyName)}>Create doc</button>`}
			</div>
		`;
	}
}

if (!customElements.get('flowti-dx-properties')) customElements.define('flowti-dx-properties', FlowtiDxProperties);
