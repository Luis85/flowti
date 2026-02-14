import { ItemView, WorkspaceLeaf, setIcon } from "obsidian";
import type { IEventBus } from "../infrastructure/events/types";
import type { DiscoveredEvent } from "../domain/discovery/types";
import { type CatalogCategoryConfig, DEFAULT_CATALOG_CATEGORIES, type EntityPaths, DEFAULT_ENTITY_PATHS } from "../domain/settings/settings";
import type { ViewStateProvider } from "../infrastructure/views/registry";
import { FileSystemClient } from "../infrastructure/filesystem/FileSystemClient";
import {
	resolveEntityPath,
	type EntityType,
} from "./eventDocTemplate";
import { SubscriptionManagerModal } from "./SubscriptionManagerModal";
import { VIEW_TYPE_EVENT_LOG } from "./EventLogView";
import type { Subscription } from "../domain/subscription/types";
import type { EventDefinition } from "../domain/eventDefinition/types";
import type {
	SystemEntry,
	FlowEntry,
	ActorEntry,
	ProductEntry,
	DomainEntry,
	ServiceEntry,
	CategoryEntry,
	CatalogComponentDeps,
	CatalogState,
} from "./catalog/types";
import {
	getOrderedCategories,
	discoveredToCatalogEntries,
} from "./catalog/helpers";
import {
	CatalogDashboard,
	DomainsTab,
	ServicesTab,
	FlowsTab,
	SystemsTab,
	ActorsTab,
	ProductsTab,
	EventsTab,
} from "./catalog";

export const VIEW_TYPE_EVENT_CATALOG = "flowti-event-catalog";


/**
 * Master-Detail view for browsing and managing all events.
 *
 * Left panel: compact, searchable category tree with filter chips.
 * Right panel: full detail for the selected event, including metadata,
 * quick actions, watchers, and transforms.
 */
export class EventCatalogView extends ItemView {
	private eventBus: IEventBus;
	private fileSystemClient: FileSystemClient;
	private state: ViewStateProvider;

	// State
	private discoveredEvents: DiscoveredEvent[] = [];
	private excludedTypes: Set<string> = new Set();
	private notifiedTypes: Set<string> = new Set();
	private catalogCategories: CatalogCategoryConfig[] = DEFAULT_CATALOG_CATEGORIES;
	private collapsedCategories: Set<string> = new Set();
	private docsRootPath = "03 - Resources/Documentation/Reference";
	private entityPaths: EntityPaths = DEFAULT_ENTITY_PATHS;
	private subscriptions: Subscription[] = [];
	private definitions: EventDefinition[] = [];
	private domainEntries: DomainEntry[] = [];
	private serviceEntries: ServiceEntry[] = [];
	private categoryEntries: CategoryEntry[] = [];
	private showSystemEvents = false;
	private catalogDomains: CatalogCategoryConfig[] = [];
	private catalogServices: CatalogCategoryConfig[] = [];
	private unsubscribes: (() => void)[] = [];
	private renderTimer: ReturnType<typeof setTimeout> | null = null;

	// Master-detail state
	private activeTab: "dashboard" | "events" | "domains" | "services" | "flows" | "systems" | "actors" | "products" = "dashboard";
	private flowEntries: FlowEntry[] = [];
	private systemEntries: SystemEntry[] = [];
	private actorEntries: ActorEntry[] = [];
	private productEntries: ProductEntry[] = [];
	private filterText = "";

	// DOM references
	private topBarEl: HTMLElement;
	private topBarTitleEl: HTMLElement;
	private masterTreeEl: HTMLElement;
	private detailPanelEl: HTMLElement;
	private gearBtn: HTMLElement;
	private settingsPanel: HTMLElement;
	private countBadge: HTMLElement;
	private tabBarEl: HTMLElement;
	private searchInput: HTMLInputElement;
	private dotLegendEl: HTMLElement;
	private splitEl: HTMLElement;
	private dashboardEl: HTMLElement;
	private dashboard: CatalogDashboard | null = null;
	private domainsTab: DomainsTab | null = null;
	private servicesTab: ServicesTab | null = null;
	private flowsTab: FlowsTab | null = null;
	private systemsTab: SystemsTab | null = null;
	private actorsTab: ActorsTab | null = null;
	private productsTab: ProductsTab | null = null;
	private eventsTab: EventsTab | null = null;

	constructor(leaf: WorkspaceLeaf, eventBus: IEventBus, state: ViewStateProvider) {
		super(leaf);
		this.eventBus = eventBus;
		this.state = state;
		this.fileSystemClient = new FileSystemClient({ eventBus });
	}

	getViewType(): string {
		return VIEW_TYPE_EVENT_CATALOG;
	}

	getDisplayText(): string {
		return "Event Catalog";
	}

	getIcon(): string {
		return "list";
	}

	async onOpen(): Promise<void> {
		// Initialize state from live providers
		const settings = this.state.getSettings();
		this.catalogCategories = settings.catalogCategories;
		this.docsRootPath = settings.docsRootPath;
		this.entityPaths = settings.entityPaths ?? DEFAULT_ENTITY_PATHS;
		this.showSystemEvents = settings.showSystemEvents;
		this.catalogDomains = settings.catalogDomains ?? [];
		this.catalogServices = settings.catalogServices ?? [];
		this.excludedTypes = new Set(this.state.getExcludedTypes());
		this.notifiedTypes = new Set(this.state.getNotifiedTypes());
		this.discoveredEvents = this.state.getDiscoveredEvents();
		this.collapsedCategories = this.state.collapsedCategories;

		const container = this.containerEl.children[1];
		container.empty();

		const wrapper = (container as HTMLElement).createDiv({ cls: "flowti-container" });
		wrapper.style.height = "100%";
		wrapper.style.display = "flex";
		wrapper.style.flexDirection = "column";

		// Top bar
		this.renderTopBar(wrapper);

		// Tab bar (hidden on dashboard)
		this.tabBarEl = wrapper.createDiv({ cls: "ft-catalog-tab-bar ft-hidden" });
		this.renderTabBar();

		// Dashboard panel (shown by default)
		this.dashboardEl = wrapper.createDiv({ cls: "ft-catalog-dashboard" });
		this.dashboardEl.style.flex = "1";
		this.dashboardEl.style.minHeight = "0";
		this.dashboardEl.style.overflowY = "auto";
		this.dashboardEl.style.padding = "1.5rem";
		this.dashboard = new CatalogDashboard(this.dashboardEl, this.buildComponentDeps());

		// Split container (hidden when dashboard is active)
		this.splitEl = wrapper.createDiv({ cls: "ft-catalog-split ft-hidden" });
		this.splitEl.style.flex = "1";
		this.splitEl.style.minHeight = "0";

		// Master panel (left)
		const master = this.splitEl.createDiv({ cls: "ft-catalog-master" });

		// Search
		const searchHeader = master.createDiv({ cls: "ft-catalog-master-header" });
		this.searchInput = searchHeader.createEl("input", { cls: "ft-catalog-master-search" });
		this.searchInput.type = "text";
		this.searchInput.placeholder = "Search events...";
		this.searchInput.addEventListener("input", () => {
			this.filterText = this.searchInput.value.toLowerCase();
			this.scheduleRender();
		});

		// Gear icon for events settings (inside search header)
		this.gearBtn = searchHeader.createSpan({ cls: "ft-visibility-toggle ft-hidden" });
		this.gearBtn.setAttribute("aria-label", "Category settings");
		setIcon(this.gearBtn, "settings");
		this.gearBtn.addEventListener("click", () => {
			this.settingsPanel.classList.toggle("ft-hidden");
			if (!this.settingsPanel.classList.contains("ft-hidden")) {
				this.eventsTab!.renderSettingsPanel();
			}
		});

		// Settings panel (hidden by default, inside master)
		this.settingsPanel = master.createDiv({ cls: "ft-settings-panel ft-hidden" });

		// Dot legend + expand/collapse controls
		this.dotLegendEl = master.createDiv({ cls: "ft-catalog-dot-legend" });
		const hiddenLegend = this.dotLegendEl.createDiv({ cls: "ft-catalog-dot-legend-item" });
		hiddenLegend.createDiv({ cls: "ft-master-status-dot ft-master-dot-hidden" });
		hiddenLegend.createSpan({ text: "hidden" });
		const confLegend = this.dotLegendEl.createDiv({ cls: "ft-catalog-dot-legend-item" });
		confLegend.createDiv({ cls: "ft-master-status-dot ft-master-dot-configured" });
		confLegend.createSpan({ text: "configured" });
		const followLegend = this.dotLegendEl.createDiv({ cls: "ft-catalog-dot-legend-item" });
		followLegend.createDiv({ cls: "ft-master-status-dot ft-master-dot-followed" });
		followLegend.createSpan({ text: "followed" });

		// Spacer pushes expand/collapse to the right
		const legendSpacer = this.dotLegendEl.createDiv();
		legendSpacer.style.flex = "1";

		// Expand all
		const expandAllBtn = this.dotLegendEl.createSpan({ cls: "ft-tree-toggle" });
		expandAllBtn.setAttribute("aria-label", "Expand all categories");
		setIcon(expandAllBtn, "chevrons-up-down");
		expandAllBtn.addEventListener("click", () => {
			this.collapsedCategories.clear();
			this.scheduleRender();
		});

		// Collapse all
		const collapseAllBtn = this.dotLegendEl.createSpan({ cls: "ft-tree-toggle" });
		collapseAllBtn.setAttribute("aria-label", "Collapse all categories");
		setIcon(collapseAllBtn, "chevrons-down-up");
		collapseAllBtn.addEventListener("click", () => {
			const orderedCategories = getOrderedCategories(this.catalogCategories);
			const visibleCategories = orderedCategories.filter((c) => c.visible).map((c) => c.name);
			// Include user categories from discovered events
			const eventsFolder = this.getEntityFolder("events");
			const discoveredEntries = discoveredToCatalogEntries(this.discoveredEvents, this.app, eventsFolder);
			const userCategories = [...new Set(discoveredEntries.map((e) => e.category))];
			for (const cat of [...userCategories, ...visibleCategories]) {
				this.collapsedCategories.add(cat);
			}
			this.scheduleRender();
		});

		// Master tree
		this.masterTreeEl = master.createDiv({ cls: "ft-catalog-master-tree" });

		// Detail panel (right)
		this.detailPanelEl = this.splitEl.createDiv({ cls: "ft-catalog-detail" });

		// Component tabs
		const deps = this.buildComponentDeps();
		this.domainsTab = new DomainsTab(this.masterTreeEl, this.detailPanelEl, deps);
		this.servicesTab = new ServicesTab(this.masterTreeEl, this.detailPanelEl, deps);
		this.flowsTab = new FlowsTab(this.masterTreeEl, this.detailPanelEl, deps);
		this.systemsTab = new SystemsTab(this.masterTreeEl, this.detailPanelEl, deps);
		this.actorsTab = new ActorsTab(this.masterTreeEl, this.detailPanelEl, deps);
		this.productsTab = new ProductsTab(this.masterTreeEl, this.detailPanelEl, deps);
		this.eventsTab = new EventsTab(
			this.masterTreeEl, this.detailPanelEl,
			this.settingsPanel, this.countBadge, deps,
		);

		// Subscribe to all events (same 14 subscriptions as before)
		this.subscribeToEvents();

		// Request current subscription and definition state
		void this.eventBus.emit("subscription.refresh", {});
		void this.eventBus.emit("eventDefinition.refresh", {});

		// Initial render — dashboard is the default landing page
		this.renderDashboard();
	}

	async onClose(): Promise<void> {
		if (this.renderTimer !== null) {
			clearTimeout(this.renderTimer);
			this.renderTimer = null;
		}
		for (const unsub of this.unsubscribes) {
			unsub();
		}
		this.unsubscribes = [];
	}

	/** Resolves the vault folder path for a given entity type. */
	private getEntityFolder(entity: EntityType): string {
		return resolveEntityPath(this.docsRootPath, this.entityPaths[entity]);
	}

	// ─────────────────────────────────────────────────────────────
	// Event subscriptions
	// ─────────────────────────────────────────────────────────────

	private subscribeToEvents(): void {
		this.unsubscribes.push(
			this.eventBus.on("discovery.loaded", (event) => {
				this.discoveredEvents = event.payload.discoveredEvents;
				this.scheduleRender();
			})
		);

		this.unsubscribes.push(
			this.eventBus.on("discovery.updated", (event) => {
				const idx = this.discoveredEvents.findIndex(
					(e) => e.eventName === event.payload.event.eventName
				);
				if (idx >= 0) {
					this.discoveredEvents[idx] = event.payload.event;
				} else {
					this.discoveredEvents.push(event.payload.event);
				}
				this.scheduleRender();
			})
		);

		this.unsubscribes.push(
			this.eventBus.on("discovery.removed", (event) => {
				this.discoveredEvents = this.discoveredEvents.filter(
					(e) => e.eventName !== event.payload.eventName
				);
				this.scheduleRender();
			})
		);

		this.unsubscribes.push(
			this.eventBus.on("eventFilter.loaded", (event) => {
				this.excludedTypes = new Set(event.payload.excludedTypes);
				this.scheduleRender();
			})
		);

		this.unsubscribes.push(
			this.eventBus.on("eventFilter.changed", (event) => {
				this.excludedTypes = new Set(event.payload.excludedTypes);
				this.scheduleRender();
			})
		);

		this.unsubscribes.push(
			this.eventBus.on("eventNotify.loaded", (event) => {
				this.notifiedTypes = new Set(event.payload.notifiedTypes);
				this.scheduleRender();
			})
		);

		this.unsubscribes.push(
			this.eventBus.on("eventNotify.changed", (event) => {
				this.notifiedTypes = new Set(event.payload.notifiedTypes);
				this.scheduleRender();
			})
		);

		this.unsubscribes.push(
			this.eventBus.on("settings.loaded", (event) => {
				this.docsRootPath = event.payload.settings.docsRootPath;
				this.entityPaths = event.payload.settings.entityPaths ?? DEFAULT_ENTITY_PATHS;
				this.catalogCategories = event.payload.settings.catalogCategories;
				this.catalogDomains = event.payload.settings.catalogDomains ?? [];
				this.catalogServices = event.payload.settings.catalogServices ?? [];
				this.showSystemEvents = event.payload.settings.showSystemEvents;
				this.scheduleRender();
				if (!this.settingsPanel.classList.contains("ft-hidden")) this.eventsTab!.renderSettingsPanel();
			})
		);
		this.unsubscribes.push(
			this.eventBus.on("settings.changed", (event) => {
				this.docsRootPath = event.payload.settings.docsRootPath;
				this.entityPaths = event.payload.settings.entityPaths ?? DEFAULT_ENTITY_PATHS;
				this.catalogCategories = event.payload.settings.catalogCategories;
				this.catalogDomains = event.payload.settings.catalogDomains ?? [];
				this.catalogServices = event.payload.settings.catalogServices ?? [];
				this.showSystemEvents = event.payload.settings.showSystemEvents;
				this.scheduleRender();
				if (!this.settingsPanel.classList.contains("ft-hidden")) this.eventsTab!.renderSettingsPanel();
			})
		);

		this.unsubscribes.push(
			this.eventBus.on("subscription.loaded", (event) => {
				this.subscriptions = event.payload.subscriptions;
				this.scheduleRender();
			})
		);
		this.unsubscribes.push(
			this.eventBus.on("subscription.created", (event) => {
				this.subscriptions = [
					...this.subscriptions.filter((s) => s.id !== event.payload.subscription.id),
					event.payload.subscription,
				];
				this.scheduleRender();
			})
		);
		this.unsubscribes.push(
			this.eventBus.on("subscription.updated", (event) => {
				this.subscriptions = this.subscriptions.map((s) =>
					s.id === event.payload.subscription.id ? event.payload.subscription : s
				);
				this.scheduleRender();
			})
		);
		this.unsubscribes.push(
			this.eventBus.on("subscription.deleted", (event) => {
				this.subscriptions = this.subscriptions.filter(
					(s) => s.id !== event.payload.subscriptionId
				);
				this.scheduleRender();
			})
		);

		this.unsubscribes.push(
			this.eventBus.on("eventDefinition.loaded", (event) => {
				this.definitions = event.payload.definitions;
				this.scheduleRender();
			})
		);
		this.unsubscribes.push(
			this.eventBus.on("eventDefinition.created", (event) => {
				this.definitions = [
					...this.definitions.filter((d) => d.id !== event.payload.definition.id),
					event.payload.definition,
				];
				this.scheduleRender();
			})
		);
		this.unsubscribes.push(
			this.eventBus.on("eventDefinition.updated", (event) => {
				this.definitions = this.definitions.map((d) =>
					d.id === event.payload.definition.id ? event.payload.definition : d
				);
				this.scheduleRender();
			})
		);
		this.unsubscribes.push(
			this.eventBus.on("eventDefinition.deleted", (event) => {
				this.definitions = this.definitions.filter(
					(d) => d.id !== event.payload.definitionId
				);
				this.scheduleRender();
			})
		);
	}

	// ─────────────────────────────────────────────────────────────
	// Top bar
	// ─────────────────────────────────────────────────────────────

	private renderTopBar(container: HTMLElement): void {
		const bar = container.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-px-3 ft-py-2 ft-hidden" });
		bar.style.borderBottom = "1px solid var(--background-modifier-border)";
		bar.style.flexShrink = "0";
		this.topBarEl = bar;

		this.topBarTitleEl = bar.createSpan({
			text: "Event Catalog",
			cls: "ft-heading ft-heading-sm",
		});
		this.topBarTitleEl.style.cursor = "pointer";
		this.topBarTitleEl.addEventListener("click", () => {
			this.activeTab = "dashboard";
			this.renderTabBar();
			this.onTabChanged();
		});

		this.countBadge = bar.createSpan({ cls: "ft-badge ft-badge-muted ft-hidden" });

		// Spacer
		const spacer = bar.createDiv();
		spacer.style.flex = "1";

		// Activity Log button
		const logBtn = bar.createEl("span", { cls: "ft-nav-link" });
		const logIcon = logBtn.createSpan();
		setIcon(logIcon, "activity");
		logBtn.appendText(" Activity Log");
		logBtn.addEventListener("click", () => this.openActivityLog());

		// Watchers button
		const subBtn = bar.createEl("button", { cls: "ft-btn ft-btn-ghost ft-text-sm" });
		const subIcon = subBtn.createSpan();
		setIcon(subIcon, "bell");
		subBtn.appendText(" Watchers");
		subBtn.addEventListener("click", () => {
			new SubscriptionManagerModal(this.app, this.eventBus).open();
		});
	}

	// ─────────────────────────────────────────────────────────────
	// Tab bar
	// ─────────────────────────────────────────────────────────────

	private renderTabBar(): void {
		this.tabBarEl.empty();

		const tabs: Array<{ id: typeof this.activeTab; label: string; icon: string }> = [
			{ id: "domains", label: "Domains", icon: "boxes" },
			{ id: "services", label: "Services", icon: "server" },
			{ id: "events", label: "Events", icon: "list" },
			{ id: "flows", label: "Flows", icon: "git-branch" },
			{ id: "systems", label: "Systems", icon: "layout-grid" },
			{ id: "actors", label: "Actors", icon: "users" },
			{ id: "products", label: "Products", icon: "package" },
		];

		for (const tab of tabs) {
			const btn = this.tabBarEl.createEl("span", {
				cls: `ft-catalog-tab${this.activeTab === tab.id ? " ft-catalog-tab-active" : ""}`,
			});
			const iconEl = btn.createSpan();
			setIcon(iconEl, tab.icon);
			btn.appendText(` ${tab.label}`);
			btn.addEventListener("click", () => {
				if (this.activeTab === tab.id) return;
				this.activeTab = tab.id;
				this.renderTabBar();
				this.onTabChanged();
			});
		}
	}

	private onTabChanged(): void {
		const isDashboard = this.activeTab === "dashboard";

		// Toggle dashboard vs split layout + tab bar + top bar
		this.dashboardEl.classList.toggle("ft-hidden", !isDashboard);
		this.splitEl.classList.toggle("ft-hidden", isDashboard);
		this.tabBarEl.classList.toggle("ft-hidden", isDashboard);
		this.topBarEl.classList.toggle("ft-hidden", isDashboard);

		// Hide search, gear, legend on non-events tabs
		this.searchInput.parentElement!.classList.toggle("ft-hidden", isDashboard);
		this.gearBtn.classList.toggle("ft-hidden", this.activeTab !== "events");
		this.dotLegendEl.classList.toggle("ft-hidden", this.activeTab !== "events");

		if (!isDashboard) {
			const labels: Record<string, string> = {
				domains: "Domains",
				services: "Services",
				events: "Events",
				flows: "Flows",
				systems: "Systems",
				actors: "Actors",
				products: "Products",
			};
			this.topBarTitleEl.textContent = `Event Catalog - ${labels[this.activeTab] ?? this.activeTab}`;

			const placeholders: Record<string, string> = {
				domains: "Search domains...",
				services: "Search services...",
				events: "Search events...",
				flows: "Search flows...",
				systems: "Search systems...",
				actors: "Search actors...",
				products: "Search products...",
			};
			this.searchInput.placeholder = placeholders[this.activeTab] ?? "";
		} else {
			this.topBarTitleEl.textContent = "Event Catalog";
		}

		// Hide settings panel when switching tabs
		this.settingsPanel.classList.add("ft-hidden");

		this.scheduleRender();
	}

	// ─────────────────────────────────────────────────────────────
	// Dashboard
	// ─────────────────────────────────────────────────────────────

	private renderDashboard(): void {
		// Scan all entities to get fresh counts
		this.domainsTab!.scan();
		this.domainEntries = this.domainsTab!.getEntries();
		this.servicesTab!.scan();
		this.serviceEntries = this.servicesTab!.getEntries();
		this.flowsTab!.scan();
		this.flowEntries = this.flowsTab!.getEntries();
		this.systemsTab!.scan();
		this.systemEntries = this.systemsTab!.getEntries();
		this.actorsTab!.scan();
		this.actorEntries = this.actorsTab!.getEntries();

		this.productsTab!.scan();
		this.productEntries = this.productsTab!.getEntries();

		this.dashboard!.render();
	}

	// ─────────────────────────────────────────────────────────────
	// Helpers
	// ─────────────────────────────────────────────────────────────

	private scheduleRender(): void {
		if (this.renderTimer !== null) clearTimeout(this.renderTimer);
		this.renderTimer = setTimeout(() => {
			this.renderTimer = null;
			switch (this.activeTab) {
				case "dashboard":
					this.renderDashboard();
					break;
				case "events":
					this.eventsTab!.render();
					this.categoryEntries = this.eventsTab!.getEntries();
					break;
				case "domains":
					this.domainsTab!.render();
					this.domainEntries = this.domainsTab!.getEntries();
					break;
				case "services":
					this.servicesTab!.render();
					this.serviceEntries = this.servicesTab!.getEntries();
					break;
				case "flows":
					this.flowsTab!.render();
					this.flowEntries = this.flowsTab!.getEntries();
					break;
				case "systems":
					this.systemsTab!.render();
					this.systemEntries = this.systemsTab!.getEntries();
					break;
				case "actors":
					this.actorsTab!.render();
					this.actorEntries = this.actorsTab!.getEntries();
					break;
				case "products":
					this.productsTab!.render();
					this.productEntries = this.productsTab!.getEntries();
					break;
			}
			this.updateCountBadge();
		}, 16);
	}

	private updateCountBadge(): void {
		this.countBadge.classList.remove("ft-hidden");
		switch (this.activeTab) {
			case "dashboard":
				this.countBadge.textContent = "";
				this.countBadge.classList.add("ft-hidden");
				break;
			case "events":
				this.countBadge.textContent = this.eventsTab!.getCountText();
				break;
			case "domains": {
				const domains = this.domainEntries.filter((d) =>
					d.visible && (this.showSystemEvents || !d.isSystem));
				const filtered = this.filterText
					? domains.filter((d) => d.name.toLowerCase().includes(this.filterText))
					: domains;
				this.countBadge.textContent = this.filterText
					? `${filtered.length} / ${domains.length} domains`
					: `${domains.length} domains`;
				break;
			}
			case "services": {
				const services = this.serviceEntries.filter((s) =>
					s.visible && (this.showSystemEvents || !s.isSystem));
				const filtered = this.filterText
					? services.filter((s) => s.name.toLowerCase().includes(this.filterText))
					: services;
				this.countBadge.textContent = this.filterText
					? `${filtered.length} / ${services.length} services`
					: `${services.length} services`;
				break;
			}
			case "flows": {
				const flows = this.flowEntries;
				const filteredFlows = this.filterText
					? flows.filter((f) =>
						f.name.toLowerCase().includes(this.filterText) ||
						f.description.toLowerCase().includes(this.filterText))
					: flows;
				this.countBadge.textContent = this.filterText
					? `${filteredFlows.length} / ${flows.length} flows`
					: `${flows.length} flows`;
				break;
			}
			case "systems": {
				const systems = this.systemEntries;
				const filtered = this.filterText
					? systems.filter((s) =>
						s.name.toLowerCase().includes(this.filterText) ||
						s.description.toLowerCase().includes(this.filterText))
					: systems;
				this.countBadge.textContent = this.filterText
					? `${filtered.length} / ${systems.length} systems`
					: `${systems.length} systems`;
				break;
			}
			case "actors": {
				const actors = this.actorEntries;
				const filteredActors = this.filterText
					? actors.filter((p) =>
						p.name.toLowerCase().includes(this.filterText) ||
						p.description.toLowerCase().includes(this.filterText))
					: actors;
				this.countBadge.textContent = this.filterText
					? `${filteredActors.length} / ${actors.length} actors`
					: `${actors.length} actors`;
				break;
			}
			case "products": {
				const products = this.productEntries;
				const filteredProducts = this.filterText
					? products.filter((p) =>
						p.name.toLowerCase().includes(this.filterText) ||
						p.description.toLowerCase().includes(this.filterText))
					: products;
				this.countBadge.textContent = this.filterText
					? `${filteredProducts.length} / ${products.length} products`
					: `${products.length} products`;
				break;
			}
		}
	}

	// ─────────────────────────────────────────────────────────────
	// Component deps
	// ─────────────────────────────────────────────────────────────

	private buildComponentDeps(): CatalogComponentDeps {
		return {
			app: this.app,
			eventBus: this.eventBus,
			fileSystemClient: this.fileSystemClient,
			getState: () => this.getCatalogState(),
			navigation: {
				navigateToTab: (tab) => {
					this.activeTab = tab as typeof this.activeTab;
					this.renderTabBar();
					this.onTabChanged();
				},
				navigateToEvent: (t) => this.navigateToEvent(t),
				navigateToDomain: (d) => this.navigateToDomain(d),
				navigateToService: (s) => this.navigateToService(s),
				navigateToFlow: (f) => this.navigateToFlow(f),
				navigateToSystem: (s) => this.navigateToSystem(s),
				navigateToActor: (a) => this.navigateToActor(a),
				navigateToProduct: (p) => this.navigateToProduct(p),
				openActivityLog: () => this.openActivityLog(),
				openSubscriptionManager: () => {
					new SubscriptionManagerModal(this.app, this.eventBus).open();
				},
			},
			scheduleRender: () => this.scheduleRender(),
			getEntityFolder: (entity) => this.getEntityFolder(entity),
			createEntity: (entityType, name, options) => this.handleCreateEntity(entityType, name, options),
		};
	}

	private getCatalogState(): CatalogState {
		return {
			discoveredEvents: this.discoveredEvents,
			excludedTypes: this.excludedTypes,
			notifiedTypes: this.notifiedTypes,
			subscriptions: this.subscriptions,
			definitions: this.definitions,
			domainEntries: this.domainEntries,
			serviceEntries: this.serviceEntries,
			categoryEntries: this.categoryEntries,
			flowEntries: this.flowEntries,
			systemEntries: this.systemEntries,
			actorEntries: this.actorEntries,
			productEntries: this.productEntries,
			catalogCategories: this.catalogCategories,
			catalogDomains: this.catalogDomains,
			catalogServices: this.catalogServices,
			showSystemEvents: this.showSystemEvents,
			collapsedCategories: this.collapsedCategories,
			docsRootPath: this.docsRootPath,
			entityPaths: this.entityPaths,
			filterText: this.filterText,
		};
	}

	private handleCreateEntity(entityType: string, name: string, options?: { category?: string }): void {
		switch (entityType) {
			case "domains": void this.domainsTab!.createDoc(name); break;
			case "services": void this.servicesTab!.createDoc(name); break;
			case "events": void this.eventBus.emit("discovery.create", {
				eventName: name,
				...(options?.category ? { category: options.category } : {}),
			}); break;
			case "flows": void this.flowsTab!.createDoc(name); break;
			case "systems": void this.systemsTab!.createDoc(name); break;
			case "actors": void this.actorsTab!.createDoc(name); break;
			case "products": void this.productsTab!.createDoc(name); break;
		}
	}

	// ─────────────────────────────────────────────────────────────
	// Cross-tab navigation
	// ─────────────────────────────────────────────────────────────

	navigateToEvent(eventType: string): void {
		this.eventsTab!.setSelectedEventType(eventType);
		this.eventsTab!.ensureCategoryExpanded(eventType);
		this.activeTab = "events";
		this.renderTabBar();
		this.onTabChanged();
	}

	private navigateToDomain(domain: string): void {
		this.domainsTab!.setSelectedDomain(domain);
		this.activeTab = "domains";
		this.renderTabBar();
		this.onTabChanged();
	}

	private navigateToService(service: string): void {
		this.servicesTab!.setSelectedService(service);
		this.activeTab = "services";
		this.renderTabBar();
		this.onTabChanged();
	}

	private navigateToFlow(flow: string): void {
		this.flowsTab!.setSelectedFlow(flow);
		this.activeTab = "flows";
		this.renderTabBar();
		this.onTabChanged();
	}

	private navigateToSystem(system: string): void {
		this.systemsTab!.setSelectedSystem(system);
		this.activeTab = "systems";
		this.renderTabBar();
		this.onTabChanged();
	}

	private navigateToActor(actor: string): void {
		this.actorsTab!.setSelectedActor(actor);
		this.activeTab = "actors";
		this.renderTabBar();
		this.onTabChanged();
	}

	private navigateToProduct(product: string): void {
		this.productsTab!.setSelectedProduct(product);
		this.activeTab = "products";
		this.renderTabBar();
		this.onTabChanged();
	}

	private openActivityLog(): void {
		const { workspace } = this.app;
		const existing = workspace.getLeavesOfType(VIEW_TYPE_EVENT_LOG);
		if (existing.length > 0) {
			workspace.revealLeaf(existing[0]);
			return;
		}
		const leaf = workspace.getRightLeaf(false);
		if (leaf) {
			void leaf.setViewState({ type: VIEW_TYPE_EVENT_LOG, active: true });
			workspace.revealLeaf(leaf);
		}
	}
}
