
import { IEventBus } from "src/eventsystem";
import { PanelConfig, PanelElements } from "..";
import { BasePanel } from "./BasePanel";

export interface ListPanelConfig extends PanelConfig {
	/** Empty state message */
	emptyTitle?: string;
	/** Empty state subtitle */
	emptySubtitle?: string;
	/** Empty state icon */
	emptyIcon?: string;
	/** Max visible items before scroll */
	maxVisibleItems?: number;
}

export interface ListItem {
	id: string;
	[key: string]: unknown;
}

export abstract class ListPanel<
	TItem extends ListItem,
	TConfig extends ListPanelConfig = ListPanelConfig
> extends BasePanel<TConfig> {
	protected listEl?: HTMLElement;
	protected emptyStateEl?: HTMLElement;
	protected itemElements = new Map<string, HTMLElement>();

	constructor(events: IEventBus, config: TConfig) {
		super(events, config);
	}

	protected buildContent(elements: PanelElements): void {
		// List container
		this.listEl = elements.body.createDiv({ cls: "mm-panel__list" });

		// Empty state
		this.emptyStateEl = elements.body.createDiv({ cls: "mm-panel__empty" });
		this.emptyStateEl.createDiv({
			cls: "mm-panel__empty-icon",
			text: this.config.emptyIcon ?? "📭",
		});
		this.emptyStateEl.createDiv({
			cls: "mm-panel__empty-title",
			text: this.config.emptyTitle ?? "No items",
		});
		if (this.config.emptySubtitle) {
			this.emptyStateEl.createDiv({
				cls: "mm-panel__empty-subtitle",
				text: this.config.emptySubtitle,
			});
		}

		// Build any additional content
		this.buildListContent(elements);
	}

	/**
	 * Override to add additional content (filters, headers, etc.)
	 */
	protected buildListContent(_elements: PanelElements): void {
		// Override in subclass
	}

	/**
	 * Update the list with new items
	 */
	protected updateList(items: TItem[]): void {
		if (!this.listEl || !this.emptyStateEl) return;

		const isEmpty = items.length === 0;

		// Toggle empty state
		this.emptyStateEl.style.display = isEmpty ? "flex" : "none";
		this.listEl.style.display = isEmpty ? "none" : "flex";

		if (isEmpty) return;

		// Reconcile items
		const currentIds = new Set(items.map((i) => i.id));

		// Remove old items
		for (const [id, el] of this.itemElements) {
			if (!currentIds.has(id)) {
				el.remove();
				this.itemElements.delete(id);
			}
		}

		// Add/update items
		for (const item of items) {
			let el = this.itemElements.get(item.id);

			if (el) {
				this.updateItemElement(el, item);
			} else {
				el = this.createItemElement(item);
				this.itemElements.set(item.id, el);
				this.listEl.appendChild(el);
			}
		}

		// Reorder if necessary
		this.reorderItems(items);
	}

	/**
	 * Create a DOM element for a list item
	 */
	protected abstract createItemElement(item: TItem): HTMLElement;

	/**
	 * Update an existing item element
	 */
	protected abstract updateItemElement(el: HTMLElement, item: TItem): void;

	/**
	 * Reorder items in DOM to match data order
	 */
	private reorderItems(items: TItem[]): void {
		if (!this.listEl) return;

		let prevEl: HTMLElement | null = null;

		for (const item of items) {
			const el = this.itemElements.get(item.id);
			if (!el) continue;

			if (prevEl) {
				if (el.previousElementSibling !== prevEl) {
					prevEl.after(el);
				}
			} else {
				if (this.listEl.firstChild !== el) {
					this.listEl.insertBefore(el, this.listEl.firstChild);
				}
			}

			prevEl = el;
		}
	}

	/**
	 * Remove an item with animation
	 */
	protected removeItem(id: string): void {
		const el = this.itemElements.get(id);
		if (!el) return;

		el.classList.add("is-leaving");

		setTimeout(() => {
			el.remove();
			this.itemElements.delete(id);

			if (this.itemElements.size === 0 && this.emptyStateEl) {
				this.emptyStateEl.style.display = "flex";
				if (this.listEl) this.listEl.style.display = "none";
			}
		}, 200);
	}

	protected onDestroy(): void {
		this.itemElements.clear();
	}
}

// ═══════════════════════════════════════════════════════════════════════════════
// STATS PANEL - For panels showing statistics/metrics
// ═══════════════════════════════════════════════════════════════════════════════

export interface Stat {
	key: string;
	label: string;
	icon?: string;
	format?: (value: number) => string;
}

export interface StatsPanelConfig extends PanelConfig {
	/** Stats to display */
	stats: Stat[];
	/** Number of columns */
	columns?: number;
}

export abstract class StatsPanel<
	TConfig extends StatsPanelConfig = StatsPanelConfig
> extends BasePanel<TConfig> {
	protected statElements = new Map<string, HTMLElement>();

	protected buildContent(elements: PanelElements): void {
		const grid = elements.body.createDiv({ cls: "mm-panel__stats" });

		if (this.config.columns) {
			grid.style.gridTemplateColumns = `repeat(${this.config.columns}, 1fr)`;
		}

		for (const stat of this.config.stats) {
			const statEl = grid.createDiv({ cls: "mm-panel__stat" });
			statEl.dataset.key = stat.key;

			if (stat.icon) {
				statEl.createDiv({ cls: "mm-panel__stat-icon", text: stat.icon });
			}

			const valueEl = statEl.createDiv({ cls: "mm-panel__stat-value" });
			valueEl.textContent = "0";
			this.statElements.set(stat.key, valueEl);

			statEl.createDiv({ cls: "mm-panel__stat-label", text: stat.label });
		}
	}

	/**
	 * Update stat values
	 */
	protected updateStats(values: Record<string, number>): void {
		for (const stat of this.config.stats) {
			const value = values[stat.key] ?? 0;
			const el = this.statElements.get(stat.key);

			if (el && this.hasChanged(`stat_${stat.key}`, value)) {
				const formatted = stat.format ? stat.format(value) : String(value);
				el.textContent = formatted;
			}
		}
	}

	protected onDestroy(): void {
		this.statElements.clear();
	}
}

// ═══════════════════════════════════════════════════════════════════════════════
// TABBED PANEL - For panels with tab navigation
// ═══════════════════════════════════════════════════════════════════════════════

export interface Tab {
	key: string;
	label: string;
	icon?: string;
	disabled?: boolean;
}

export interface TabbedPanelConfig extends PanelConfig {
	/** Tabs to display */
	tabs: Tab[];
	/** Initial active tab */
	defaultTab?: string;
}

export abstract class TabbedPanel<
	TConfig extends TabbedPanelConfig = TabbedPanelConfig
> extends BasePanel<TConfig> {
	protected activeTab: string;
	protected tabElements = new Map<string, HTMLElement>();
	protected contentElements = new Map<string, HTMLElement>();

	constructor(events: IEventBus, config: TConfig) {
		super(events, config);
		this.activeTab = config.defaultTab ?? config.tabs[0]?.key ?? "";
	}

	protected buildContent(elements: PanelElements): void {
		// Tabs container (in header actions if header exists, otherwise in body)
		const tabsContainer = elements.headerActions ?? elements.body;
		const tabs = tabsContainer.createDiv({ cls: "mm-panel__tabs" });

		for (const tab of this.config.tabs) {
			const tabEl = tabs.createDiv({
				cls: `mm-panel__tab ${tab.disabled ? "mm-panel__tab--disabled" : ""} ${
					tab.key === this.activeTab ? "mm-panel__tab--active" : ""
				}`,
				text: tab.icon ? `${tab.icon} ${tab.label}` : tab.label,
			});
			tabEl.dataset.key = tab.key;

			if (!tab.disabled) {
				tabEl.addEventListener("click", () => this.setActiveTab(tab.key));
			}

			this.tabElements.set(tab.key, tabEl);
		}

		// Content containers
		for (const tab of this.config.tabs) {
			const content = elements.body.createDiv({
				cls: "mm-panel__tab-content",
			});
			content.style.display = tab.key === this.activeTab ? "block" : "none";
			this.contentElements.set(tab.key, content);

			// Let subclass build tab content
			this.buildTabContent(tab.key, content);
		}
	}

	/**
	 * Build content for a specific tab
	 */
	protected abstract buildTabContent(tabKey: string, container: HTMLElement): void;

	/**
	 * Switch to a different tab
	 */
	protected setActiveTab(key: string): void {
		if (key === this.activeTab) return;

		const oldTab = this.activeTab;
		this.activeTab = key;

		// Update tab styles
		for (const [tabKey, el] of this.tabElements) {
			el.classList.toggle("mm-panel__tab--active", tabKey === key);
		}

		// Show/hide content
		for (const [tabKey, el] of this.contentElements) {
			el.style.display = tabKey === key ? "block" : "none";
		}

		// Notify subclass
		this.onTabChange(key, oldTab);
	}

	/**
	 * Called when tab changes
	 */
	protected onTabChange(_newTab: string, _oldTab: string): void {
		// Override in subclass
	}

	/**
	 * Get content container for a tab
	 */
	protected getTabContent(key: string): HTMLElement | undefined {
		return this.contentElements.get(key);
	}

	protected onDestroy(): void {
		this.tabElements.clear();
		this.contentElements.clear();
	}
}
