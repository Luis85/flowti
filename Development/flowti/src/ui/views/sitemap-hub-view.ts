import type { WorkspaceLeaf } from "obsidian";
import { BaseHubView } from "../BaseHubView";
import type { TabDef } from "../BaseHubView";
import type { IEventBus } from "../../infrastructure/events/types";
import type { ViewDef } from "../../domain/sitemap/plugin-sitemap-types";
import type { PluginHandlerRegistry, TabContext } from "../../infrastructure/handlers/plugin-handler-registry";

/**
 * Generic hub view driven by a ViewDef from plugin-sitemap.json.
 *
 * Provides two tab rendering paths:
 * - **handler**: looks up a TabHandler in the registry and calls it
 * - **component**: creates a custom element (Lit) and binds data-source props
 */
export class SitemapHubView extends BaseHubView<string> {
	private viewDef: ViewDef;
	private handlerRegistry: PluginHandlerRegistry;

	constructor(
		leaf: WorkspaceLeaf,
		eventBus: IEventBus,
		viewDef: ViewDef,
		handlerRegistry: PluginHandlerRegistry,
	) {
		super(leaf, eventBus);
		this.viewDef = viewDef;
		this.handlerRegistry = handlerRegistry;
	}

	// ── ItemView overrides ──────────────────────────────────

	getViewType(): string {
		return this.viewDef.type;
	}

	getDisplayText(): string {
		return this.viewDef.label;
	}

	getIcon(): string {
		return this.viewDef.icon;
	}

	// ── Hub metadata (abstract contract) ────────────────────

	getHubId(): string {
		return this.viewDef.type;
	}

	getHubType(): "system" | "domain" | "user" {
		return "domain";
	}

	getHubDisplayName(): string {
		return this.viewDef.label;
	}

	getHubIcon(): string {
		return this.viewDef.icon;
	}

	// ── Tab definitions ─────────────────────────────────────

	getTabDefinitions(): TabDef[] {
		return (this.viewDef.tabs ?? []).map((tab) => ({
			id: tab.id,
			label: tab.label,
			icon: tab.icon,
			searchPlaceholder: tab.searchPlaceholder ?? `Search ${tab.label.toLowerCase()}...`,
		}));
	}

	// ── Rendering ───────────────────────────────────────────

	renderTopBarActions(_bar: HTMLElement): void {
		// No default top-bar actions for generic sitemap hubs
	}

	onDashboardRender(): void {
		if (!this.dashboardEl) return;
		this.dashboardEl.empty();
		const handlerId = `${this.viewDef.type.replace("flowti-", "").replace("-hub", "")}:dashboard`;
		const handler = this.handlerRegistry.getTabHandler(handlerId);
		if (handler) {
			void handler(this.dashboardEl, {
				tabId: "dashboard",
				viewId: this.viewDef.type,
				eventBus: this.eventBus,
			});
		} else {
			this.dashboardEl.createEl("h2", { text: this.viewDef.label });
		}
	}

	onTabRender(tabId: string): void {
		const container = this.detailPanelEl ?? this.splitEl;
		if (container) {
			void this.renderTab(tabId, container);
		}
	}

	/**
	 * Render a tab into the given container element.
	 *
	 * Public for testability — at runtime this is called by `onTabRender()`
	 * via the BaseHubView lifecycle, but tests can call it directly without
	 * going through the full open/navigate cycle.
	 */
	async renderTab(tabId: string, container: HTMLElement): Promise<void> {
		const tabDef = this.viewDef.tabs?.find((t) => t.id === tabId);
		if (!tabDef) return;

		// Path 1: handler-based tab
		if (tabDef.handler) {
			const handler = this.handlerRegistry.getTabHandler(tabDef.handler);
			if (handler) {
				const ctx: TabContext = {
					tabId,
					viewId: this.viewDef.type,
					eventBus: this.eventBus,
					searchText: this.filterText,
				};
				await handler(container, ctx);
			}
			return;
		}

		// Path 2: component-based tab (Lit custom element)
		if (tabDef.component) {
			const el = document.createElement(tabDef.component);
			if (tabDef.dataSource) {
				const dsHandler = this.handlerRegistry.getDataSource(tabDef.dataSource);
				if (dsHandler) {
					const data = await dsHandler({ eventBus: this.eventBus });
					if (data && typeof data === "object") {
						for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
							(el as unknown as Record<string, unknown>)[key] = value;
						}
					}
				}
			}
			container.appendChild(el);
		}
	}

	// ── Lifecycle no-ops ────────────────────────────────────

	onHubOpen(): void {
		if (this.viewDef.refreshEvents) {
			for (const event of this.viewDef.refreshEvents) {
				this.addUnsubscribe(
					this.eventBus.on(event as never, () => this.scheduleRender())
				);
			}
		}
	}

	onHubClose(): void {
		// Cleanup handled by BaseHubView
	}
}
