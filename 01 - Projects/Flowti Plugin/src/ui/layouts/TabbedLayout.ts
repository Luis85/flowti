import type { ILayout, LayoutConfig, LayoutRegion } from "./types";

export interface TabConfig {
	id: string;
	label: string;
}

export interface TabbedLayoutConfig extends LayoutConfig {
	tabs: TabConfig[];
}

/**
 * Tabbed layout — tab bar with switchable content panels.
 *
 * Regions: "tabs" (the tab bar), "content" (active tab's content panel)
 *
 * Each tab gets its own content panel. Only the active tab's panel is visible.
 * Use `switchTab(tabId)` to change the active tab.
 */
export class TabbedLayout implements ILayout {
	readonly type = "tabbed";

	private root: HTMLElement | null = null;
	private tabBarRegion: LayoutRegion | null = null;
	private activeContentRegion: LayoutRegion | null = null;
	private contentPanels: Map<string, HTMLElement> = new Map();
	private tabButtons: Map<string, HTMLElement> = new Map();
	private activeTabId: string | null = null;
	private readonly tabs: TabConfig[];

	constructor(config?: TabbedLayoutConfig) {
		this.tabs = config?.tabs ?? [];
	}

	mount(container: HTMLElement): void {
		this.dispose();

		this.root = document.createElement("div");
		this.root.className = "ft-layout ft-layout-tabbed";

		// Tab bar
		const tabBar = document.createElement("div");
		tabBar.className = "ft-layout-tab-bar";

		for (const tab of this.tabs) {
			const btn = document.createElement("button");
			btn.className = "ft-layout-tab";
			btn.textContent = tab.label;
			btn.dataset.tabId = tab.id;
			btn.addEventListener("click", () => this.switchTab(tab.id));
			tabBar.appendChild(btn);
			this.tabButtons.set(tab.id, btn);
		}

		this.tabBarRegion = { el: tabBar };
		this.root.appendChild(tabBar);

		// Content panels (one per tab)
		const contentWrapper = document.createElement("div");
		contentWrapper.className = "ft-layout-tab-content";

		for (const tab of this.tabs) {
			const panel = document.createElement("div");
			panel.className = "ft-layout-tab-panel ft-hidden";
			panel.dataset.tabId = tab.id;
			contentWrapper.appendChild(panel);
			this.contentPanels.set(tab.id, panel);
		}

		this.root.appendChild(contentWrapper);
		container.appendChild(this.root);

		// Activate first tab by default
		if (this.tabs.length > 0) {
			this.switchTab(this.tabs[0].id);
		}
	}

	getRegion(name: string): LayoutRegion | null {
		if (name === "tabs") return this.tabBarRegion;
		if (name === "content") return this.activeContentRegion;
		return null;
	}

	/** Switch to a specific tab by ID. */
	switchTab(tabId: string): void {
		const panel = this.contentPanels.get(tabId);
		if (!panel) return;

		// Hide all panels, show target
		for (const [id, el] of this.contentPanels) {
			el.classList.toggle("ft-hidden", id !== tabId);
		}

		// Update active button styling
		for (const [id, btn] of this.tabButtons) {
			btn.classList.toggle("ft-layout-tab-active", id === tabId);
		}

		this.activeTabId = tabId;
		this.activeContentRegion = { el: panel };
	}

	/** Get the currently active tab ID, or null if none. */
	getActiveTabId(): string | null {
		return this.activeTabId;
	}

	/** Get the content panel for a specific tab (regardless of active state). */
	getTabPanel(tabId: string): HTMLElement | null {
		return this.contentPanels.get(tabId) ?? null;
	}

	dispose(): void {
		if (this.root) {
			this.root.remove();
			this.root = null;
		}
		this.tabBarRegion = null;
		this.activeContentRegion = null;
		this.contentPanels.clear();
		this.tabButtons.clear();
		this.activeTabId = null;
	}
}
