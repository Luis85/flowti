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
import type { OnboardingService } from "../domain/onboarding/OnboardingService";
import { buildSplitLayout, type SplitLayout } from "./catalog/helpers";
import { WorkspaceShell } from "./shell/WorkspaceShell";

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

	private shell: WorkspaceShell | null = null;
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
		this.containerEl.addClass("ft-hide-header");
		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();

		const wrapper = container.createDiv({ cls: "flowti-container ft-view-root" });

		// Chrome — delegated to WorkspaceShell
		this.shell = new WorkspaceShell({
			hubName: this.getHubDisplayName(),
			onNavigateDashboard: () => {
				this.navigateTo("dashboard");
				this.renderTabBar();
			},
			renderTopBarActions: (bar) => this.renderTopBarActions(bar),
		});
		const shellEls = this.shell.mount(wrapper);
		this.topBarEl = shellEls.topBarEl;
		this.topBarTitleEl = shellEls.topBarTitleEl;
		this.countBadge = shellEls.countBadge;
		this.tabBarEl = shellEls.tabBarEl;
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

		// Listen for cross-hub navigation
		this.addUnsubscribe(
			this.eventBus.on("hub.navigate", (event) => {
				if (event.payload.hubId !== this.getHubId()) return;
				const tabId = event.payload.tabId;
				if (tabId) {
					this.navigateTo(tabId as TPage);
				}
				// entityId handling is subclass-specific via onNavigateToEntity()
				if (event.payload.entityId) {
					this.onNavigateToEntity(event.payload.tabId ?? "", event.payload.entityId);
				}
			}),
		);

		// Emit hub.opened
		void this.eventBus.emit("hub.opened", {
			hubId: this.getHubId(),
			hubType: this.getHubType(),
		});

		// Dashboard is the default landing page
		try {
			this.onDashboardRender();
		} catch (err) {
			this.renderError(err);
		}
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

		if (this.shell) {
			this.shell.dispose();
			this.shell = null;
		}

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

	/**
	 * Called when a hub.navigate event targets a specific entity within a tab.
	 * Override in subclasses to select the entity in the appropriate tab component.
	 */
	protected onNavigateToEntity(_tabId: string, _entityId: string): void {
		// Default: no-op. Override in subclass.
	}

	/**
	 * Render a first-visit onboarding callout banner at the top of a container.
	 * Shows only on the first visit and if the callout hasn't been dismissed.
	 */
	protected renderOnboardingCallout(
		container: HTMLElement,
		onboardingService: OnboardingService,
		callout: { id: string; icon: string; title: string; description: string; suggestion: string },
	): void {
		const viewType = this.getHubId();

		// Don't show if already visited or callout already dismissed
		if (onboardingService.hasVisited(viewType) || onboardingService.isCalloutDismissed(callout.id)) {
			// Always record the visit (idempotent)
			void onboardingService.recordFirstVisit(viewType);
			return;
		}

		// Record first visit
		void onboardingService.recordFirstVisit(viewType);

		const banner = container.createDiv({ cls: "ft-card ft-p-3 ft-mb-3 ft-onboarding-banner" });

		// Dismiss button (top-right)
		const dismissBtn = banner.createEl("span", { cls: "ft-nav-link ft-text-xs ft-onboarding-dismiss" });
		dismissBtn.textContent = "\u2715";
		dismissBtn.title = "Dismiss";
		dismissBtn.addEventListener("click", () => {
			void onboardingService.markCalloutDismissed(callout.id);
			banner.remove();
		});

		// Icon + title
		const titleRow = banner.createDiv({ cls: "ft-flex ft-gap-2 ft-items-center ft-mb-1" });
		const iconEl = titleRow.createSpan({ cls: "ft-onboarding-icon" });
		setIcon(iconEl, callout.icon);
		titleRow.createSpan({ text: callout.title, cls: "ft-font-medium ft-text-sm" });

		// Description
		banner.createDiv({ text: callout.description, cls: "ft-text-sm ft-text-muted ft-mb-1" });

		// Suggestion
		const suggestEl = banner.createDiv({ cls: "ft-text-xs ft-text-muted ft-font-italic" });
		suggestEl.textContent = `\u2192 ${callout.suggestion}`;
	}

	/** Debounced render — dispatches to onDashboardRender() or onTabRender(). */
	protected scheduleRender(): void {
		if (this.renderTimer !== null) clearTimeout(this.renderTimer);
		this.renderTimer = setTimeout(() => {
			this.renderTimer = null;
			try {
				if (this.activePage === "dashboard") {
					this.onDashboardRender();
				} else {
					this.onTabRender(this.activePage as TPage);
				}
			} catch (err) {
				this.renderError(err);
			}
		}, 16);
	}

	/** Render an error banner when a tab/dashboard render throws. */
	private renderError(err: unknown): void {
		const target = this.activePage === "dashboard" ? this.dashboardEl : this.detailPanelEl;
		if (this.activePage !== "dashboard") this.masterTreeEl.empty();
		target.empty();
		const banner = target.createDiv({ cls: "ft-error-boundary ft-p-4 ft-text-center" });
		const iconEl = banner.createDiv({ cls: "ft-mb-2 ft-opacity-50" });
		setIcon(iconEl, "alert-triangle");
		banner.createDiv({ text: "Something went wrong", cls: "ft-heading ft-heading-sm ft-mb-1" });
		banner.createDiv({
			text: err instanceof Error ? err.message : String(err),
			cls: "ft-text-muted ft-text-sm ft-mb-3",
		});
		const retryBtn = banner.createEl("button", { text: "Retry", cls: "mod-cta" });
		retryBtn.addEventListener("click", () => this.scheduleRender());
	}

	/** Re-render the tab bar (e.g. after active tab changes). Delegates to WorkspaceShell. */
	protected renderTabBar(): void {
		if (this.shell) {
			this.shell.renderTabBar(this.getTabDefinitions(), String(this.activePage), (tabId) => {
				this.navigateTo(tabId as TPage);
				this.renderTabBar();
			});
		}
	}
}
