import { html, css, nothing } from 'lit';
import { FlowtiElement } from '../flowti-element.js';
import { emptyState } from '../shared-styles.js';

export interface CatalogEventEntry {
	type: string;
	description: string;
	category: string;
	domain: string;
	services: string;
	isExcluded: boolean;
	isNotified: boolean;
}

export interface CatalogCategory {
	name: string;
	visible: boolean;
}

/**
 * Events tab component for the EventCatalog hub.
 *
 * Unique among catalog tabs: renders a hierarchical category tree with
 * dot legend (hidden/notified) and a toggleable settings panel.
 * Categories can be collapsed/expanded independently.
 *
 * @property events - Array of catalog event entries
 * @property categories - Array of category visibility configs
 * @property excludedTypes - Set of event types hidden from the log
 * @property notifiedTypes - Set of event types with notifications enabled
 * @property searchText - External search filter text
 *
 * @fires toggle-category - detail: { category, collapsed } when a category header is clicked
 * @fires toggle-setting - emitted when the settings button is clicked
 * @fires select-event - detail: { type, category, domain } when an event item is clicked
 */
export class FlowtiCatalogEvents extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		events: { type: Array },
		categories: { type: Array },
		excludedTypes: { type: Object },
		notifiedTypes: { type: Object },
		searchText: { type: String },
		_collapsedCategories: { type: Object, state: true },
		_showSettings: { type: Boolean, state: true },
	};

	static styles = [
		...FlowtiElement.styles,
		emptyState,
		css`
			.events-container {
				display: flex;
				flex-direction: column;
				gap: var(--flowti-space-sm);
			}

			.dot-legend {
				display: flex;
				align-items: center;
				gap: var(--flowti-space-md);
				padding: var(--flowti-space-xs) var(--flowti-space-sm);
				font-size: var(--flowti-font-sm);
				color: var(--flowti-color-muted);
			}

			.dot-legend-item {
				display: flex;
				align-items: center;
				gap: var(--flowti-space-xs);
			}

			.dot {
				width: 8px;
				height: 8px;
				border-radius: 50%;
			}

			.dot-hidden {
				background: var(--flowti-color-muted, #888);
			}

			.dot-notified {
				background: var(--flowti-color-info, #4a9eff);
			}

			.toolbar {
				display: flex;
				align-items: center;
				gap: var(--flowti-space-sm);
				padding: var(--flowti-space-xs) 0;
			}

			.settings-toggle {
				margin-left: auto;
				cursor: pointer;
				font-size: var(--flowti-font-sm);
				color: var(--flowti-color-muted);
				padding: var(--flowti-space-xs) var(--flowti-space-sm);
				border-radius: var(--flowti-radius);
				border: 1px solid var(--flowti-border, #ddd);
				background: var(--background-secondary, #f5f5f5);
			}

			.settings-toggle:hover {
				background: var(--background-modifier-hover, #eee);
			}

			.settings-panel {
				padding: var(--flowti-space-sm) var(--flowti-space-md);
				border-radius: var(--flowti-radius);
				background: var(--background-secondary, #f5f5f5);
				margin-bottom: var(--flowti-space-sm);
				font-size: var(--flowti-font-sm);
				color: var(--flowti-color-muted);
			}

			.category-group {
				margin-bottom: var(--flowti-space-xs);
			}

			.category-header {
				display: flex;
				align-items: center;
				gap: var(--flowti-space-sm);
				padding: var(--flowti-space-xs) var(--flowti-space-sm);
				cursor: pointer;
				border-radius: var(--flowti-radius);
				font-weight: 500;
				font-size: var(--flowti-font-sm);
			}

			.category-header:hover {
				background: var(--background-modifier-hover, #eee);
			}

			.category-chevron {
				font-size: 0.75em;
				width: 1em;
				text-align: center;
			}

			.category-name {
				flex: 1;
			}

			.category-count {
				font-size: var(--flowti-font-sm);
				color: var(--flowti-color-muted);
			}

			.event-item {
				display: flex;
				align-items: center;
				gap: var(--flowti-space-sm);
				padding: var(--flowti-space-xs) var(--flowti-space-sm);
				padding-left: var(--flowti-space-lg);
				border-radius: var(--flowti-radius);
				cursor: pointer;
				font-size: var(--flowti-font-sm);
			}

			.event-item:hover {
				background: var(--background-modifier-hover, #eee);
			}

			.event-type {
				flex: 1;
				font-family: var(--flowti-font-mono, monospace);
			}

			.event-dots {
				display: flex;
				gap: 3px;
			}
		`,
	];

	events: CatalogEventEntry[] = [];
	categories: CatalogCategory[] = [];
	excludedTypes: Set<string> = new Set();
	notifiedTypes: Set<string> = new Set();
	searchText = '';
	private _collapsedCategories: Set<string> = new Set();
	private _showSettings = false;

	private get filteredEvents(): CatalogEventEntry[] {
		if (!this.searchText) return this.events;
		const lower = this.searchText.toLowerCase();
		return this.events.filter(
			(e) =>
				e.type.toLowerCase().includes(lower) ||
				e.description.toLowerCase().includes(lower) ||
				e.domain.toLowerCase().includes(lower) ||
				e.services.toLowerCase().includes(lower),
		);
	}

	private get groupedEvents(): Map<string, CatalogEventEntry[]> {
		const filtered = this.filteredEvents;
		const map = new Map<string, CatalogEventEntry[]>();
		for (const event of filtered) {
			const list = map.get(event.category) ?? [];
			list.push(event);
			map.set(event.category, list);
		}
		return map;
	}

	private get orderedCategories(): string[] {
		const grouped = this.groupedEvents;
		// Order: categories from config first (preserving order), then any remaining alphabetically
		const configNames = this.categories.map((c) => c.name);
		const remaining = [...grouped.keys()].filter((k) => !configNames.includes(k)).sort();
		return [...configNames.filter((n) => grouped.has(n)), ...remaining];
	}

	private onCategoryClick(category: string): void {
		const newSet = new Set(this._collapsedCategories);
		const wasCollapsed = newSet.has(category);
		if (wasCollapsed) {
			newSet.delete(category);
		} else {
			newSet.add(category);
		}
		this._collapsedCategories = newSet;

		this.dispatchEvent(
			new CustomEvent('toggle-category', {
				detail: { category, collapsed: !wasCollapsed },
				bubbles: true,
				composed: true,
			}),
		);
	}

	private onEventClick(event: CatalogEventEntry): void {
		this.dispatchEvent(
			new CustomEvent('select-event', {
				detail: { type: event.type, category: event.category, domain: event.domain },
				bubbles: true,
				composed: true,
			}),
		);
	}

	private onSettingsClick(): void {
		this._showSettings = !this._showSettings;
		this.dispatchEvent(
			new CustomEvent('toggle-setting', {
				detail: { showSettings: this._showSettings },
				bubbles: true,
				composed: true,
			}),
		);
	}

	protected renderContent() {
		const grouped = this.groupedEvents;

		if (this.events.length === 0) {
			return html`
				<div class="empty-state">
					<div class="empty-state__message">No events discovered</div>
				</div>
			`;
		}

		if (grouped.size === 0) {
			return html`
				<div class="empty-state">
					<div class="empty-state__message">No events match the search</div>
				</div>
			`;
		}

		return html`
			<div class="events-container">
				${this.renderToolbar()}
				${this.renderDotLegend()}
				${this._showSettings ? this.renderSettingsPanel() : nothing}
				${this.orderedCategories.map((cat) =>
					this.renderCategoryGroup(cat, grouped.get(cat) ?? []))}
			</div>
		`;
	}

	private renderToolbar() {
		return html`
			<div class="toolbar">
				<span class="settings-toggle" @click=${this.onSettingsClick}>Settings</span>
			</div>
		`;
	}

	private renderDotLegend() {
		return html`
			<div class="dot-legend">
				<div class="dot-legend-item">
					<div class="dot dot-hidden"></div>
					<span>hidden</span>
				</div>
				<div class="dot-legend-item">
					<div class="dot dot-notified"></div>
					<span>notified</span>
				</div>
			</div>
		`;
	}

	private renderSettingsPanel() {
		return html`
			<div class="settings-panel">
				<div>Event display settings</div>
			</div>
		`;
	}

	private renderCategoryGroup(category: string, events: CatalogEventEntry[]) {
		const isCollapsed = this._collapsedCategories.has(category);
		return html`
			<div class="category-group">
				<div class="category-header" @click=${() => this.onCategoryClick(category)}>
					<span class="category-chevron">${isCollapsed ? '\u25B6' : '\u25BC'}</span>
					<span class="category-name">${category}</span>
					<span class="category-count">${events.length}</span>
				</div>
				${isCollapsed
					? nothing
					: events.map((event) => this.renderEventItem(event))}
			</div>
		`;
	}

	private renderEventItem(event: CatalogEventEntry) {
		const isExcluded = this.excludedTypes.has(event.type);
		const isNotified = this.notifiedTypes.has(event.type);

		return html`
			<div class="event-item" @click=${() => this.onEventClick(event)}>
				<span class="event-type">${event.type}</span>
				<div class="event-dots">
					${isExcluded ? html`<div class="dot dot-hidden" title="Hidden from log"></div>` : nothing}
					${isNotified ? html`<div class="dot dot-notified" title="Notifications enabled"></div>` : nothing}
				</div>
			</div>
		`;
	}
}

if (!customElements.get('flowti-catalog-events')) customElements.define('flowti-catalog-events', FlowtiCatalogEvents);
