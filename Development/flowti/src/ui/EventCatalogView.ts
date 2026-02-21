import { setIcon } from "obsidian";
import type { WorkspaceLeaf } from "obsidian";
import type { IEventBus } from "../infrastructure/events/types";
import { createVaultQueryService, createWorkspaceService } from "../infrastructure/services/ObsidianAdapters";
import type { DiscoveredEvent } from "../domain/discovery/types";
import { type CatalogCategoryConfig, DEFAULT_CATALOG_CATEGORIES, type EntityPaths, DEFAULT_ENTITY_PATHS } from "../domain/settings/settings";
import type { ViewStateProvider } from "../infrastructure/views/registry";
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
	HealthTab,
} from "./catalog";
import { BaseHubView, type TabDef } from "./BaseHubView";
import { VIEW_TYPE_EVENT_CATALOG } from "../domain/hub/types";
export { VIEW_TYPE_EVENT_CATALOG };

export type CatalogTab = "events" | "domains" | "services" | "flows" | "systems" | "actors" | "products" | "health";

/**
 * Master-Detail view for browsing and managing all events.
 *
 * Left panel: compact, searchable category tree with filter chips.
 * Right panel: full detail for the selected event, including metadata,
 * quick actions, watchers, and transforms.
 */
export class EventCatalogView extends BaseHubView<CatalogTab> {
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

	// Master-detail state
	private flowEntries: FlowEntry[] = [];
	private systemEntries: SystemEntry[] = [];
	private actorEntries: ActorEntry[] = [];
	private productEntries: ProductEntry[] = [];

	// Catalog-specific DOM
	private gearBtn!: HTMLElement;
	private settingsPanel!: HTMLElement;
	private dotLegendEl!: HTMLElement;

	// Tab components
	private dashboard: CatalogDashboard | null = null;
	private domainsTab: DomainsTab | null = null;
	private servicesTab: ServicesTab | null = null;
	private flowsTab: FlowsTab | null = null;
	private systemsTab: SystemsTab | null = null;
	private actorsTab: ActorsTab | null = null;
	private productsTab: ProductsTab | null = null;
	private eventsTab: EventsTab | null = null;
	private healthTab: HealthTab | null = null;

	constructor(leaf: WorkspaceLeaf, eventBus: IEventBus, state: ViewStateProvider) {
		super(leaf, eventBus);
		this.state = state;
	}

	// ─────────────────────────────────────────────────────────────
	// BaseHubView contract
	// ─────────────────────────────────────────────────────────────

	getViewType(): string {
		return VIEW_TYPE_EVENT_CATALOG;
	}

	getHubId(): string {
		return "event-catalog";
	}

	getHubType(): "system" | "domain" | "user" {
		return "system";
	}

	getHubDisplayName(): string {
		return "Event Catalog";
	}

	getHubIcon(): string {
		return "list";
	}

	getTabDefinitions(): TabDef[] {
		return [
			{ id: "domains", label: "Domains", icon: "boxes", searchPlaceholder: "Search domains..." },
			{ id: "services", label: "Services", icon: "server", searchPlaceholder: "Search services..." },
			{ id: "events", label: "Events", icon: "list", searchPlaceholder: "Search events..." },
			{ id: "flows", label: "Flows", icon: "git-branch", searchPlaceholder: "Search flows..." },
			{ id: "systems", label: "Systems", icon: "layout-grid", searchPlaceholder: "Search systems..." },
			{ id: "actors", label: "Actors", icon: "users", searchPlaceholder: "Search actors..." },
			{ id: "products", label: "Products", icon: "package", searchPlaceholder: "Search products..." },
			{ id: "health", label: "Health", icon: "heart-pulse", searchPlaceholder: "Search checks..." },
		];
	}

	renderTopBarActions(bar: HTMLElement): void {
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

	onHubOpen(): void {
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

		// Dashboard component
		this.dashboard = new CatalogDashboard(this.dashboardEl, this.buildComponentDeps());

		// Catalog-specific: gear icon in search header
		this.gearBtn = this.searchHeaderEl.createSpan({ cls: "ft-visibility-toggle ft-hidden" });
		this.gearBtn.setAttribute("aria-label", "Category settings");
		setIcon(this.gearBtn, "settings");
		this.gearBtn.addEventListener("click", () => {
			this.settingsPanel.classList.toggle("ft-hidden");
			if (!this.settingsPanel.classList.contains("ft-hidden")) {
				this.eventsTab!.renderSettingsPanel();
			}
		});

		// Catalog-specific: settings panel + dot legend (before master tree)
		this.settingsPanel = this.masterEl.createDiv({ cls: "ft-settings-panel ft-hidden" });
		this.masterEl.insertBefore(this.settingsPanel, this.masterTreeEl);

		this.dotLegendEl = this.masterEl.createDiv({ cls: "ft-catalog-dot-legend" });
		this.masterEl.insertBefore(this.dotLegendEl, this.masterTreeEl);

		const hiddenLegend = this.dotLegendEl.createDiv({ cls: "ft-catalog-dot-legend-item" });
		hiddenLegend.createDiv({ cls: "ft-master-status-dot ft-master-dot-hidden" });
		hiddenLegend.createSpan({ text: "hidden" });
		const confLegend = this.dotLegendEl.createDiv({ cls: "ft-catalog-dot-legend-item" });
		confLegend.createDiv({ cls: "ft-master-status-dot ft-master-dot-configured" });
		confLegend.createSpan({ text: "configured" });
		const followLegend = this.dotLegendEl.createDiv({ cls: "ft-catalog-dot-legend-item" });
		followLegend.createDiv({ cls: "ft-master-status-dot ft-master-dot-followed" });
		followLegend.createSpan({ text: "followed" });

		const legendSpacer = this.dotLegendEl.createDiv();
		legendSpacer.addClass("ft-flex-1");

		const expandAllBtn = this.dotLegendEl.createSpan({ cls: "ft-tree-toggle" });
		expandAllBtn.setAttribute("aria-label", "Expand all categories");
		setIcon(expandAllBtn, "chevrons-up-down");
		expandAllBtn.addEventListener("click", () => {
			this.collapsedCategories.clear();
			this.scheduleRender();
		});

		const collapseAllBtn = this.dotLegendEl.createSpan({ cls: "ft-tree-toggle" });
		collapseAllBtn.setAttribute("aria-label", "Collapse all categories");
		setIcon(collapseAllBtn, "chevrons-down-up");
		collapseAllBtn.addEventListener("click", () => {
			const orderedCategories = getOrderedCategories(this.catalogCategories);
			const visibleCategories = orderedCategories.filter((c) => c.visible).map((c) => c.name);
			const eventsFolder = this.getEntityFolder("events");
			const discoveredEntries = discoveredToCatalogEntries(this.discoveredEvents, createVaultQueryService(this.app), eventsFolder);
			const userCategories = [...new Set(discoveredEntries.map((e) => e.category))];
			for (const cat of [...userCategories, ...visibleCategories]) {
				this.collapsedCategories.add(cat);
			}
			this.scheduleRender();
		});

		// Component tabs
		const deps = this.buildComponentDeps();
		this.domainsTab = new DomainsTab(this.masterTreeEl, this.detailPanelEl, deps);
		this.servicesTab = new ServicesTab(this.masterTreeEl, this.detailPanelEl, deps);
		this.flowsTab = new FlowsTab(this.masterTreeEl, this.detailPanelEl, deps);
		this.systemsTab = new SystemsTab(this.masterTreeEl, this.detailPanelEl, deps);
		this.actorsTab = new ActorsTab(this.masterTreeEl, this.detailPanelEl, deps);
		this.productsTab = new ProductsTab(this.masterTreeEl, this.detailPanelEl, deps);
		this.healthTab = new HealthTab(this.masterTreeEl, this.detailPanelEl, deps);
		this.eventsTab = new EventsTab(
			this.masterTreeEl, this.detailPanelEl,
			this.settingsPanel, this.countBadge, deps,
		);

		// Subscribe to events
		this.subscribeToEvents();

		// Request current subscription and definition state
		void this.eventBus.emit("subscription.refresh", {});
		void this.eventBus.emit("eventDefinition.refresh", {});
	}

	onHubClose(): void {
		// No extra cleanup needed beyond base class unsubscribes
	}

	onDashboardRender(): void {
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
		this.updateCountBadge();
	}

	onTabRender(tabId: CatalogTab): void {
		switch (tabId) {
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
			case "health":
				// Scan all entities for fresh data (same as dashboard)
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
				this.healthTab!.render();
				break;
		}
		this.updateCountBadge();
	}

	protected onTabChanged(): void {
		// Catalog-specific: toggle gear button + dot legend + settings panel
		this.gearBtn.classList.toggle("ft-hidden", this.activePage !== "events");
		this.dotLegendEl.classList.toggle("ft-hidden", this.activePage !== "events");
		this.settingsPanel.classList.add("ft-hidden");
	}

	protected onNavigateToEntity(tabId: string, entityId: string): void {
		switch (tabId) {
			case "events": this.navigateToEvent(entityId); break;
			case "domains": this.navigateToDomain(entityId); break;
			case "services": this.navigateToService(entityId); break;
			case "flows": this.navigateToFlow(entityId); break;
			case "systems": this.navigateToSystem(entityId); break;
			case "actors": this.navigateToActor(entityId); break;
			case "products": this.navigateToProduct(entityId); break;
		}
	}

	// ─────────────────────────────────────────────────────────────
	// Helpers
	// ─────────────────────────────────────────────────────────────

	/** Resolves the vault folder path for a given entity type. */
	private getEntityFolder(entity: EntityType): string {
		return resolveEntityPath(this.docsRootPath, this.entityPaths[entity]);
	}

	// ─────────────────────────────────────────────────────────────
	// Event subscriptions
	// ─────────────────────────────────────────────────────────────

	private subscribeToEvents(): void {
		this.addUnsubscribe(
			this.eventBus.on("discovery.loaded", (event) => {
				this.discoveredEvents = event.payload.discoveredEvents;
				this.scheduleRender();
			})
		);

		this.addUnsubscribe(
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

		this.addUnsubscribe(
			this.eventBus.on("discovery.removed", (event) => {
				this.discoveredEvents = this.discoveredEvents.filter(
					(e) => e.eventName !== event.payload.eventName
				);
				this.scheduleRender();
			})
		);

		this.addUnsubscribe(
			this.eventBus.on("eventFilter.loaded", (event) => {
				this.excludedTypes = new Set(event.payload.excludedTypes);
				this.scheduleRender();
			})
		);

		this.addUnsubscribe(
			this.eventBus.on("eventFilter.changed", (event) => {
				this.excludedTypes = new Set(event.payload.excludedTypes);
				this.scheduleRender();
			})
		);

		this.addUnsubscribe(
			this.eventBus.on("eventNotify.loaded", (event) => {
				this.notifiedTypes = new Set(event.payload.notifiedTypes);
				this.scheduleRender();
			})
		);

		this.addUnsubscribe(
			this.eventBus.on("eventNotify.changed", (event) => {
				this.notifiedTypes = new Set(event.payload.notifiedTypes);
				this.scheduleRender();
			})
		);

		this.addUnsubscribe(
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
		this.addUnsubscribe(
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

		this.addUnsubscribe(
			this.eventBus.on("subscription.loaded", (event) => {
				this.subscriptions = event.payload.subscriptions;
				this.scheduleRender();
			})
		);
		this.addUnsubscribe(
			this.eventBus.on("subscription.created", (event) => {
				this.subscriptions = [
					...this.subscriptions.filter((s) => s.id !== event.payload.subscription.id),
					event.payload.subscription,
				];
				this.scheduleRender();
			})
		);
		this.addUnsubscribe(
			this.eventBus.on("subscription.updated", (event) => {
				this.subscriptions = this.subscriptions.map((s) =>
					s.id === event.payload.subscription.id ? event.payload.subscription : s
				);
				this.scheduleRender();
			})
		);
		this.addUnsubscribe(
			this.eventBus.on("subscription.deleted", (event) => {
				this.subscriptions = this.subscriptions.filter(
					(s) => s.id !== event.payload.subscriptionId
				);
				this.scheduleRender();
			})
		);

		this.addUnsubscribe(
			this.eventBus.on("eventDefinition.loaded", (event) => {
				this.definitions = event.payload.definitions;
				this.scheduleRender();
			})
		);
		this.addUnsubscribe(
			this.eventBus.on("eventDefinition.created", (event) => {
				this.definitions = [
					...this.definitions.filter((d) => d.id !== event.payload.definition.id),
					event.payload.definition,
				];
				this.scheduleRender();
			})
		);
		this.addUnsubscribe(
			this.eventBus.on("eventDefinition.updated", (event) => {
				this.definitions = this.definitions.map((d) =>
					d.id === event.payload.definition.id ? event.payload.definition : d
				);
				this.scheduleRender();
			})
		);
		this.addUnsubscribe(
			this.eventBus.on("eventDefinition.deleted", (event) => {
				this.definitions = this.definitions.filter(
					(d) => d.id !== event.payload.definitionId
				);
				this.scheduleRender();
			})
		);

		// Doc lifecycle — re-render after create/delete so scanned tabs pick up changes
		this.addUnsubscribe(
			this.eventBus.on("doc.created", () => {
				setTimeout(() => this.scheduleRender(), 500);
			})
		);
		this.addUnsubscribe(
			this.eventBus.on("doc.deleted", () => {
				this.scheduleRender();
			})
		);
	}

	// ─────────────────────────────────────────────────────────────
	// Count badge
	// ─────────────────────────────────────────────────────────────

	private updateCountBadge(): void {
		this.countBadge.classList.remove("ft-hidden");
		switch (this.activePage) {
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
			case "health": {
				const report = this.healthTab!.getReport();
				const passing = report.checks.filter((c) => c.severity === "pass").length;
				this.countBadge.textContent = `${passing} / ${report.checks.length} passing`;
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
			vaultQuery: createVaultQueryService(this.app),
			workspace: createWorkspaceService(this.app),
			eventBus: this.eventBus,
			getState: () => this.getCatalogState(),
			navigation: {
				navigateToTab: (tab) => {
					this.navigateTo(tab as CatalogTab);
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
		this.navigateTo("events");
	}

	private navigateToDomain(domain: string): void {
		this.domainsTab!.setSelectedDomain(domain);
		this.navigateTo("domains");
	}

	private navigateToService(service: string): void {
		this.servicesTab!.setSelectedService(service);
		this.navigateTo("services");
	}

	private navigateToFlow(flow: string): void {
		this.flowsTab!.setSelectedFlow(flow);
		this.navigateTo("flows");
	}

	private navigateToSystem(system: string): void {
		this.systemsTab!.setSelectedSystem(system);
		this.navigateTo("systems");
	}

	private navigateToActor(actor: string): void {
		this.actorsTab!.setSelectedActor(actor);
		this.navigateTo("actors");
	}

	private navigateToProduct(product: string): void {
		this.productsTab!.setSelectedProduct(product);
		this.navigateTo("products");
	}

	private openActivityLog(): void {
		const { workspace } = this.app;
		const existing = workspace.getLeavesOfType(VIEW_TYPE_EVENT_LOG);
		if (existing.length > 0) {
			void workspace.revealLeaf(existing[0]);
			return;
		}
		const leaf = workspace.getRightLeaf(false);
		if (leaf) {
			void leaf.setViewState({ type: VIEW_TYPE_EVENT_LOG, active: true });
			void workspace.revealLeaf(leaf);
		}
	}
}
