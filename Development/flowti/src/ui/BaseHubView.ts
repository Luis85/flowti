/**
 * Abstract base class for Hub views.
 *
 * Provides the shared shell lifecycle: wrapper → top bar → tab bar →
 * dashboard/split layout → render scheduling → event cleanup.
 *
 * Subclasses implement domain-specific rendering, state, and subscriptions.
 */

import { ItemView, setIcon } from "obsidian";
import type { WorkspaceLeaf } from "obsidian";
import type { IEventBus } from "../infrastructure/events/types";
import { buildSplitLayout, type SplitLayout } from "./catalog/helpers";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

/**
 * Defines a tab in the hub's tab bar.
 */
export interface TabDef {
	id: string;
	label: string;
	icon: string;
	searchPlaceholder: string;
}

// ─────────────────────────────────────────────────────────────
// Abstract base
// ─────────────────────────────────────────────────────────────

export abstract class BaseHubView<TPage extends string = string> extends ItemView {
	// ── Abstract contract ────────────────────────────────────

	/** Unique identifier for this hub (e.g. "event-catalog", "data-exchange"). */
	abstract getHubId(): string;
	/** Hub type for event payloads. */
	abstract getHubType(): "system" | "domain" | "user";
	/** Display name shown in the top bar breadcrumb. */
	abstract getHubDisplayName(): string;
	/** Icon identifier for the view. */
	abstract getHubIcon(): string;
	/** Tab definitions for the tab bar (excluding the implicit "dashboard" tab). */
	abstract getTabDefinitions(): TabDef[];
	/** Render extra buttons in the top bar (Activity Log, Watchers, etc.). */
	abstract renderTopBarActions(bar: HTMLElement): void;
	/** Render the dashboard tab. */
	abstract onDashboardRender(): void;
	/** Render a specific non-dashboard tab. */
	abstract onTabRender(tabId: TPage): void;
	/** Subclass-specific initialization (component creation, event subscriptions). Called after shell is built. */
	abstract onHubOpen(): void;
	/** Subclass-specific cleanup. Called before base cleanup. */
	abstract onHubClose(): void;

	// ── Protected state (available to subclasses) ────────────

	protected eventBus: IEventBus;
	protected activePage: TPage | "dashboard" = "dashboard";
	protected topBarEl!: HTMLElement;
	protected topBarTitleEl!: HTMLElement;
	protected countBadge!: HTMLElement;
	protected tabBarEl!: HTMLElement;
	protected dashboardEl!: HTMLElement;
	protected splitEl!: HTMLElement;
	protected masterTreeEl!: HTMLElement;
	protected detailPanelEl!: HTMLElement;
	protected searchInput!: HTMLInputElement;
	/** The search header element (parent of searchInput), for subclasses to append elements. */
	protected searchHeaderEl!: HTMLElement;
	/** The master panel element (parent of searchHeaderEl + masterTreeEl). */
	protected masterEl!: HTMLElement;
	protected filterText = "";

	// ── Private state ────────────────────────────────────────

	private renderTimer: ReturnType<typeof setTimeout> | null = null;
	private unsubscribes: (() => void)[] = [];

	constructor(leaf: WorkspaceLeaf, eventBus: IEventBus) {
		super(leaf);
		this.eventBus = eventBus;
	}

	// ── ItemView overrides ───────────────────────────────────

	// getViewType() is NOT implemented here — subclasses MUST override it
	// because the Obsidian view type (e.g. "flowti-event-catalog") differs
	// from the hub ID used in events (e.g. "event-catalog").

	getDisplayText(): string {
		return this.getHubDisplayName();
	}

	getIcon(): string {
		return this.getHubIcon();
	}

	async onOpen(): Promise<void> {
		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();

		const wrapper = container.createDiv({ cls: "flowti-container ft-view-root" });

		// Top bar (hidden on dashboard)
		this.buildTopBar(wrapper);

		// Tab bar (hidden on dashboard)
		this.tabBarEl = wrapper.createDiv({ cls: "ft-catalog-tab-bar ft-hidden" });
		this.renderTabBar();

		// Shared split layout (dashboard + master/detail)
		const layout: SplitLayout = buildSplitLayout(wrapper, {
			searchPlaceholder: "Search...",
			onSearch: (text) => {
				this.filterText = text;
				this.scheduleRender();
			},
		});
		this.dashboardEl = layout.dashboardEl;
		this.splitEl = layout.splitEl;
		this.masterEl = layout.masterEl;
		this.searchHeaderEl = layout.searchHeaderEl;
		this.searchInput = layout.searchInput;
		this.masterTreeEl = layout.masterTreeEl;
		this.detailPanelEl = layout.detailEl;

		// Subclass-specific init
		this.onHubOpen();

		// Emit hub.opened
		void this.eventBus.emit("hub.opened", {
			hubId: this.getHubId(),
			hubType: this.getHubType(),
		});

		// Dashboard is the default landing page
		this.onDashboardRender();
	}

	async onClose(): Promise<void> {
		// Emit hub.closed
		void this.eventBus.emit("hub.closed", { hubId: this.getHubId() });

		if (this.renderTimer !== null) {
			clearTimeout(this.renderTimer);
			this.renderTimer = null;
		}
		for (const unsub of this.unsubscribes) {
			unsub();
		}
		this.unsubscribes = [];

		this.onHubClose();
	}

	// ── Protected helpers ────────────────────────────────────

	/** Register an unsubscribe callback for automatic cleanup on close. */
	protected addUnsubscribe(fn: () => void): void {
		this.unsubscribes.push(fn);
	}

	/** Get the currently active page/tab ID. */
	protected getActivePage(): TPage | "dashboard" {
		return this.activePage;
	}

	/** Navigate to a tab (or "dashboard"). Toggles visibility and triggers render. */
	protected navigateTo(page: TPage | "dashboard"): void {
		const previousTabId = this.activePage;
		this.activePage = page;
		const isDashboard = page === "dashboard";

		// Toggle dashboard vs split + tab bar + top bar
		this.dashboardEl.classList.toggle("ft-hidden", !isDashboard);
		this.splitEl.classList.toggle("ft-hidden", isDashboard);
		this.tabBarEl.classList.toggle("ft-hidden", isDashboard);
		this.topBarEl.classList.toggle("ft-hidden", isDashboard);

		if (!isDashboard) {
			const tabs = this.getTabDefinitions();
			const tab = tabs.find((t) => t.id === page);
			this.topBarTitleEl.textContent = `${this.getHubDisplayName()} - ${tab?.label ?? page}`;
			this.searchInput.placeholder = tab?.searchPlaceholder ?? "Search...";
			// Show search header on non-dashboard tabs
			this.searchInput.parentElement!.classList.remove("ft-hidden");
		} else {
			this.topBarTitleEl.textContent = this.getHubDisplayName();
		}

		// Emit tab change event
		if (previousTabId !== page) {
			void this.eventBus.emit("hub.tab.changed", {
				hubId: this.getHubId(),
				tabId: String(page),
				previousTabId: String(previousTabId),
			});
		}

		// Update tab bar active state
		this.renderTabBar();

		// Let subclass handle tab-specific visibility (gear, legend, etc.)
		this.onTabChanged();

		this.scheduleRender();
	}

	/**
	 * Called after navigateTo() updates visibility.
	 * Override in subclasses for tab-specific DOM toggling (e.g. gear button, legend).
	 */
	protected onTabChanged(): void {
		// Default: no-op. Override in subclass.
	}

	/** Debounced render — dispatches to onDashboardRender() or onTabRender(). */
	protected scheduleRender(): void {
		if (this.renderTimer !== null) clearTimeout(this.renderTimer);
		this.renderTimer = setTimeout(() => {
			this.renderTimer = null;
			if (this.activePage === "dashboard") {
				this.onDashboardRender();
			} else {
				this.onTabRender(this.activePage as TPage);
			}
		}, 16);
	}

	/** Re-render the tab bar (e.g. after active tab changes). */
	protected renderTabBar(): void {
		this.tabBarEl.empty();
		const tabs = this.getTabDefinitions();
		for (const tab of tabs) {
			const btn = this.tabBarEl.createEl("span", {
				cls: `ft-catalog-tab${this.activePage === tab.id ? " ft-catalog-tab-active" : ""}`,
			});
			const iconEl = btn.createSpan();
			setIcon(iconEl, tab.icon);
			btn.appendText(` ${tab.label}`);
			btn.addEventListener("click", () => {
				if (this.activePage === tab.id) return;
				this.navigateTo(tab.id as TPage);
				this.renderTabBar();
			});
		}
	}

	// ── Private shell construction ───────────────────────────

	private buildTopBar(container: HTMLElement): void {
		const bar = container.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-px-3 ft-py-2 ft-hidden" });
		bar.style.borderBottom = "1px solid var(--background-modifier-border)";
		bar.addClass("ft-flex-shrink-0");
		this.topBarEl = bar;

		this.topBarTitleEl = bar.createSpan({
			text: this.getHubDisplayName(),
			cls: "ft-heading ft-heading-sm",
		});
		this.topBarTitleEl.addClass("ft-cursor-pointer");
		this.topBarTitleEl.addEventListener("click", () => {
			this.navigateTo("dashboard");
			this.renderTabBar();
		});

		this.countBadge = bar.createSpan({ cls: "ft-badge ft-badge-muted ft-hidden" });

		// Spacer
		const spacer = bar.createDiv();
		spacer.addClass("ft-flex-1");

		// Subclass-specific action buttons
		this.renderTopBarActions(bar);
	}
}
