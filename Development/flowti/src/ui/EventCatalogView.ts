import { ItemView, WorkspaceLeaf, setIcon, TFile, TFolder } from "obsidian";
import {
	EVENT_CATALOG,
	EVENT_CATEGORIES,
	type EventCatalogEntry,
} from "../infrastructure/events/catalog";
import type { IEventBus } from "../infrastructure/events/types";
import type { DiscoveredEvent } from "../domain/discovery/types";
import { type CatalogCategoryConfig, DEFAULT_CATALOG_CATEGORIES } from "../domain/settings/settings";
import type { ViewStateProvider } from "../infrastructure/views/registry";
import { FileSystemClient } from "../infrastructure/filesystem/FileSystemClient";
import {
	getEventDocPath,
	generateEventDocContent,
	getDomainDocPath,
	getDomainsFolderPath,
	generateDomainDocContent,
	getArchitectureDocPath,
	generateArchitectureDocContent,
	getServiceDocPath,
	getServicesFolderPath,
	generateServiceDocContent,
	getServiceBlueprintPath,
	generateServiceBlueprintContent,
	getCategoryDocPath,
	getCategoriesFolderPath,
	generateCategoryDocContent,
	getSystemDocPath,
	getSystemsFolderPath,
	generateSystemDocContent,
	getFlowDocPath,
	getFlowsFolderPath,
	generateFlowDocContent,
	getActorDocPath,
	getActorsFolderPath,
	generateActorDocContent,
} from "./eventDocTemplate";
import { ConfirmModal, InputModal } from "./modals";
import { EventConfigModal } from "./EventConfigModal";
import { SubscriptionManagerModal } from "./SubscriptionManagerModal";
import { VIEW_TYPE_EVENT_LOG } from "./EventLogView";
import type { Subscription } from "../domain/subscription/types";
import type { EventDefinition } from "../domain/eventDefinition/types";

export const VIEW_TYPE_EVENT_CATALOG = "flowti-event-catalog";

/** Category label for user-defined discovered events */
const CUSTOM_EVENTS_CATEGORY = "Custom Events";

interface SystemEntry {
	name: string;
	description: string;
	domains: string[];
	services: string[];
	filePath: string;
	events: EventCatalogEntry[];
}

interface FlowEntry {
	name: string;
	description: string;
	events: string[];
	domains: string[];
	services: string[];
	filePath: string;
	resolvedEvents: EventCatalogEntry[];
}

interface ActorEntry {
	name: string;
	description: string;
	events: string[];
	domains: string[];
	services: string[];
	filePath: string;
	resolvedEvents: EventCatalogEntry[];
}

interface DomainEntry {
	name: string;
	description: string;
	services: string[];
	categories: string[];
	events: EventCatalogEntry[];
	filePath: string | null;
	configuredCount: number;
	visibleCount: number;
	visible: boolean;
}

interface ServiceEntry {
	name: string;
	description: string;
	domains: string[];
	events: EventCatalogEntry[];
	filePath: string | null;
	configuredCount: number;
	visible: boolean;
}

interface CategoryEntry {
	name: string;
	description: string;
	domains: string[];
	services: string[];
	events: EventCatalogEntry[];
	filePath: string | null;
	visible: boolean;
}

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
	private activeTab: "dashboard" | "events" | "domains" | "services" | "flows" | "systems" | "actors" = "dashboard";
	private selectedEventType: string | null = null;
	private selectedDomain: string | null = null;
	private selectedService: string | null = null;
	private selectedFlow: string | null = null;
	private flowEntries: FlowEntry[] = [];
	private selectedSystem: string | null = null;
	private systemEntries: SystemEntry[] = [];
	private selectedActor: string | null = null;
	private actorEntries: ActorEntry[] = [];
	private filterChipConfigured = false;
	private filterChipFollowed = false;
	private filterText = "";

	// DOM references
	private masterTreeEl: HTMLElement;
	private detailPanelEl: HTMLElement;
	private filterChipsEl: HTMLElement;
	private settingsPanel: HTMLElement;
	private settingsPanelVisible = false;
	private countBadge: HTMLElement;
	private tabBarEl: HTMLElement;
	private searchInput: HTMLInputElement;
	private dotLegendEl: HTMLElement;
	private splitEl: HTMLElement;
	private dashboardEl: HTMLElement;

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

		// Filter chips
		this.filterChipsEl = master.createDiv({ cls: "ft-catalog-filter-chips" });
		this.renderFilterChips();

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
			this.renderMasterTree();
		});

		// Collapse all
		const collapseAllBtn = this.dotLegendEl.createSpan({ cls: "ft-tree-toggle" });
		collapseAllBtn.setAttribute("aria-label", "Collapse all categories");
		setIcon(collapseAllBtn, "chevrons-down-up");
		collapseAllBtn.addEventListener("click", () => {
			const orderedCategories = this.getOrderedCategories();
			const visibleCategories = orderedCategories.filter((c) => c.visible).map((c) => c.name);
			for (const cat of [CUSTOM_EVENTS_CATEGORY, ...visibleCategories]) {
				this.collapsedCategories.add(cat);
			}
			this.renderMasterTree();
		});

		// Master tree
		this.masterTreeEl = master.createDiv({ cls: "ft-catalog-master-tree" });

		// Detail panel (right)
		this.detailPanelEl = this.splitEl.createDiv({ cls: "ft-catalog-detail" });

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
				this.catalogCategories = event.payload.settings.catalogCategories;
				this.catalogDomains = event.payload.settings.catalogDomains ?? [];
				this.catalogServices = event.payload.settings.catalogServices ?? [];
				this.showSystemEvents = event.payload.settings.showSystemEvents;
				this.scheduleRender();
				if (this.settingsPanelVisible) this.renderSettingsPanel();
			})
		);
		this.unsubscribes.push(
			this.eventBus.on("settings.changed", (event) => {
				this.docsRootPath = event.payload.settings.docsRootPath;
				this.catalogCategories = event.payload.settings.catalogCategories;
				this.catalogDomains = event.payload.settings.catalogDomains ?? [];
				this.catalogServices = event.payload.settings.catalogServices ?? [];
				this.showSystemEvents = event.payload.settings.showSystemEvents;
				this.scheduleRender();
				if (this.settingsPanelVisible) this.renderSettingsPanel();
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
		const bar = container.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-px-3 ft-py-2" });
		bar.style.borderBottom = "1px solid var(--background-modifier-border)";
		bar.style.flexShrink = "0";

		const title = bar.createSpan({
			text: "Event Catalog",
			cls: "ft-heading ft-heading-sm",
		});
		title.style.cursor = "pointer";
		title.addEventListener("click", () => {
			this.activeTab = "dashboard";
			this.renderTabBar();
			this.onTabChanged();
		});

		this.countBadge = bar.createSpan({
			text: `${EVENT_CATALOG.length} events`,
			cls: "ft-badge ft-badge-muted",
		});

		// Spacer
		const spacer = bar.createDiv();
		spacer.style.flex = "1";

		// Activity Log button
		const logBtn = bar.createEl("span", { cls: "ft-nav-link" });
		const logIcon = logBtn.createSpan();
		setIcon(logIcon, "activity");
		logBtn.appendText(" Activity Log");
		logBtn.addEventListener("click", () => {
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
		});

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

		// Toggle dashboard vs split layout + tab bar
		this.dashboardEl.classList.toggle("ft-hidden", !isDashboard);
		this.splitEl.classList.toggle("ft-hidden", isDashboard);
		this.tabBarEl.classList.toggle("ft-hidden", isDashboard);

		// Hide search, filters, legend on dashboard
		this.searchInput.parentElement!.classList.toggle("ft-hidden", isDashboard);
		this.filterChipsEl.classList.toggle("ft-hidden", this.activeTab !== "events");
		this.dotLegendEl.classList.toggle("ft-hidden", this.activeTab !== "events");

		if (!isDashboard) {
			const placeholders: Record<string, string> = {
				domains: "Search domains...",
				services: "Search services...",
				events: "Search events...",
				flows: "Search flows...",
				systems: "Search systems...",
				actors: "Search actors...",
			};
			this.searchInput.placeholder = placeholders[this.activeTab] ?? "";
		}

		// Hide settings panel when switching tabs
		this.settingsPanel.classList.add("ft-hidden");
		this.settingsPanelVisible = false;

		this.scheduleRender();
	}

	// ─────────────────────────────────────────────────────────────
	// Dashboard
	// ─────────────────────────────────────────────────────────────

	private renderDashboard(): void {
		this.dashboardEl.empty();

		// Scan all entities to get fresh counts
		this.scanDomains();
		this.scanServices();
		this.scanFlows();
		this.scanSystems();
		this.scanActors();

		// Hero
		const hero = this.dashboardEl.createDiv({ cls: "ft-dashboard-hero" });
		hero.style.textAlign = "center";
		hero.style.marginBottom = "1.5rem";
		hero.createEl("h2", { text: "Event Catalog", cls: "ft-heading" });
		hero.createEl("p", {
			text: "Overview of your event-driven architecture",
			cls: "ft-text-muted ft-text-sm",
		});

		// Stats grid
		const grid = this.dashboardEl.createDiv({ cls: "ft-dashboard-grid" });
		grid.style.display = "grid";
		grid.style.gridTemplateColumns = "repeat(3, 1fr)";
		grid.style.gap = "0.75rem";
		grid.style.marginBottom = "1.5rem";

		const visibleDomains = this.domainEntries.filter((d) => d.visible);
		const visibleServices = this.serviceEntries.filter((s) => s.visible);
		const visibleEvents = this.getVisibleEntries();

		const cards: Array<{ icon: string; count: number; label: string; tab: typeof this.activeTab }> = [
			{ icon: "boxes", count: visibleDomains.length, label: "Domains", tab: "domains" },
			{ icon: "server", count: visibleServices.length, label: "Services", tab: "services" },
			{ icon: "list", count: visibleEvents.length, label: "Events", tab: "events" },
			{ icon: "git-branch", count: this.flowEntries.length, label: "Flows", tab: "flows" },
			{ icon: "layout-grid", count: this.systemEntries.length, label: "Systems", tab: "systems" },
			{ icon: "users", count: this.actorEntries.length, label: "Actors", tab: "actors" },
		];

		for (const card of cards) {
			const el = grid.createDiv({ cls: "ft-dashboard-card" });
			el.style.border = "1px solid var(--background-modifier-border)";
			el.style.borderRadius = "8px";
			el.style.padding = "1rem";
			el.style.cursor = "pointer";
			el.style.display = "flex";
			el.style.alignItems = "center";
			el.style.gap = "0.75rem";
			el.style.transition = "border-color 0.15s";
			el.addEventListener("mouseenter", () => {
				el.style.borderColor = "var(--interactive-accent)";
			});
			el.addEventListener("mouseleave", () => {
				el.style.borderColor = "var(--background-modifier-border)";
			});
			el.addEventListener("click", () => {
				this.activeTab = card.tab;
				this.renderTabBar();
				this.onTabChanged();
			});

			const iconEl = el.createDiv();
			iconEl.style.opacity = "0.6";
			setIcon(iconEl, card.icon);

			const text = el.createDiv();
			text.createDiv({ text: String(card.count), cls: "ft-catalog-stat-value" });
			text.createDiv({ text: card.label, cls: "ft-catalog-stat-label" });
		}

		// Documentation coverage
		const coverageSection = this.dashboardEl.createDiv();
		coverageSection.style.marginBottom = "1.5rem";
		coverageSection.createEl("h3", { text: "Documentation Coverage", cls: "ft-heading ft-heading-sm" });
		coverageSection.style.marginBottom = "0.75rem";

		const coverageGrid = coverageSection.createDiv();
		coverageGrid.style.display = "grid";
		coverageGrid.style.gridTemplateColumns = "repeat(2, 1fr)";
		coverageGrid.style.gap = "0.5rem";

		const totalDomains = this.domainEntries.length;
		const docDomains = this.domainEntries.filter((d) => d.filePath !== null).length;
		const totalServices = this.serviceEntries.length;
		const docServices = this.serviceEntries.filter((s) => s.filePath !== null).length;

		// Count architecture docs and blueprints via vault folder scan
		let archDocCount = 0;
		let blueprintCount = 0;
		const domainsFolder = this.app.vault.getAbstractFileByPath(getDomainsFolderPath(this.docsRootPath));
		if (domainsFolder instanceof TFolder) {
			archDocCount = domainsFolder.children.filter(
				(f) => f instanceof TFile && f.extension === "md" && f.name.endsWith(".architecture.md")
			).length;
		}
		const servicesFolder = this.app.vault.getAbstractFileByPath(getServicesFolderPath(this.docsRootPath));
		if (servicesFolder instanceof TFolder) {
			blueprintCount = servicesFolder.children.filter(
				(f) => f instanceof TFile && f.extension === "md" && f.name.endsWith(".blueprint.md")
			).length;
		}

		const coverageItems = [
			{ label: "Domain Docs", value: `${docDomains} / ${totalDomains}` },
			{ label: "Service Docs", value: `${docServices} / ${totalServices}` },
			{ label: "Architecture Docs", value: String(archDocCount) },
			{ label: "Service Blueprints", value: String(blueprintCount) },
		];

		for (const item of coverageItems) {
			const row = coverageGrid.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
			row.style.padding = "0.4rem 0.5rem";
			row.style.borderRadius = "4px";
			row.style.border = "1px solid var(--background-modifier-border)";
			row.createSpan({ text: item.value, cls: "ft-badge ft-badge-muted" });
			row.createSpan({ text: item.label, cls: "ft-text-sm" });
		}

		// Quick actions — create new building blocks
		const actionsSection = this.dashboardEl.createDiv();
		actionsSection.createEl("h3", { text: "Quick Actions", cls: "ft-heading ft-heading-sm" });
		actionsSection.style.marginBottom = "0.75rem";

		const actionsGrid = actionsSection.createDiv({ cls: "ft-flex ft-gap-2" });
		actionsGrid.style.flexWrap = "wrap";

		const createActions: Array<{ icon: string; label: string; action: () => void }> = [
			{
				icon: "boxes",
				label: "New Domain",
				action: () => {
					new InputModal(this.app, {
						title: "Create New Domain",
						placeholder: "my-domain",
						submitLabel: "Create",
						inputName: "Domain name",
						inputDesc: "A short identifier for this domain",
						onSubmit: (name) => { void this.createDomainDoc(name); },
					}).open();
				},
			},
			{
				icon: "server",
				label: "New Service",
				action: () => {
					new InputModal(this.app, {
						title: "Create New Service",
						placeholder: "MyService",
						submitLabel: "Create",
						inputName: "Service name",
						inputDesc: "A short identifier for this service",
						onSubmit: (name) => { void this.createServiceDoc(name); },
					}).open();
				},
			},
			{
				icon: "git-branch",
				label: "New Flow",
				action: () => {
					new InputModal(this.app, {
						title: "Create New Flow",
						placeholder: "My Flow",
						submitLabel: "Create",
						inputName: "Flow name",
						inputDesc: "A name for this flow",
						onSubmit: (name) => { void this.createFlowDoc(name); },
					}).open();
				},
			},
			{
				icon: "layout-grid",
				label: "New System",
				action: () => {
					new InputModal(this.app, {
						title: "Create New System",
						placeholder: "My System",
						submitLabel: "Create",
						inputName: "System name",
						inputDesc: "A name for this system",
						onSubmit: (name) => { void this.createSystemDoc(name); },
					}).open();
				},
			},
			{
				icon: "users",
				label: "New Actor",
				action: () => {
					new InputModal(this.app, {
						title: "Create New Actor",
						placeholder: "My Actor",
						submitLabel: "Create",
						inputName: "Actor name",
						inputDesc: "A name for this actor",
						onSubmit: (name) => { void this.createActorDoc(name); },
					}).open();
				},
			},
		];

		for (const act of createActions) {
			const btn = actionsGrid.createEl("span", { cls: "ft-nav-link" });
			const icon = btn.createSpan();
			setIcon(icon, act.icon);
			btn.appendText(` ${act.label}`);
			btn.addEventListener("click", act.action);
		}
	}

	// ─────────────────────────────────────────────────────────────
	// Filter chips
	// ─────────────────────────────────────────────────────────────

	private renderFilterChips(): void {
		this.filterChipsEl.empty();

		const configuredCount = this.getConfiguredCount();
		const followedCount = this.getFollowedCount();

		const configuredChip = this.filterChipsEl.createEl("span", {
			cls: `ft-catalog-chip${this.filterChipConfigured ? " ft-catalog-chip-active" : ""}`,
		});
		configuredChip.textContent = `Configured (${configuredCount})`;
		configuredChip.addEventListener("click", () => {
			this.filterChipConfigured = !this.filterChipConfigured;
			this.renderMasterTree();
			this.renderFilterChips();
		});

		const followedChip = this.filterChipsEl.createEl("span", {
			cls: `ft-catalog-chip${this.filterChipFollowed ? " ft-catalog-chip-active" : ""}`,
		});
		followedChip.textContent = `Followed (${followedCount})`;
		followedChip.addEventListener("click", () => {
			this.filterChipFollowed = !this.filterChipFollowed;
			this.renderMasterTree();
			this.renderFilterChips();
		});

		const systemChip = this.filterChipsEl.createEl("span", {
			cls: `ft-catalog-chip${this.showSystemEvents ? " ft-catalog-chip-active" : ""}`,
		});
		systemChip.textContent = "System";
		systemChip.setAttribute("aria-label", "Show internal plugin events tagged 'system'");
		systemChip.title = "Show internal plugin events tagged 'system'";
		systemChip.addEventListener("click", () => {
			this.showSystemEvents = !this.showSystemEvents;
			void this.eventBus.emit("settings.updateShowSystemEvents", {
				showSystemEvents: this.showSystemEvents,
			});
			this.renderMasterTree();
			this.renderFilterChips();
		});

		// Spacer pushes gear icon to the right
		const spacer = this.filterChipsEl.createDiv();
		spacer.style.flex = "1";

		// Gear icon for category settings
		const gearBtn = this.filterChipsEl.createSpan({ cls: "ft-visibility-toggle" });
		gearBtn.setAttribute("aria-label", "Category settings");
		setIcon(gearBtn, "settings");
		gearBtn.addEventListener("click", () => {
			this.settingsPanelVisible = !this.settingsPanelVisible;
			this.settingsPanel.classList.toggle("ft-hidden");
			if (this.settingsPanelVisible) {
				this.renderSettingsPanel();
			}
		});
	}

	// ─────────────────────────────────────────────────────────────
	// Master tree
	// ─────────────────────────────────────────────────────────────

	private renderMasterTree(): void {
		this.scanCategories();
		this.masterTreeEl.empty();

		const discoveredEntries = this.discoveredToCatalogEntries();
		const allEntries = [...EVENT_CATALOG, ...discoveredEntries];

		const orderedCategories = this.getOrderedCategories();
		const visibleCategories = orderedCategories
			.filter((c) => c.visible)
			.map((c) => c.name);

		const allCategories = [CUSTOM_EVENTS_CATEGORY, ...visibleCategories];

		let visibleCount = 0;

		for (const category of allCategories) {
			let entries = allEntries.filter((e) => e.category === category);

			// Text filter
			if (this.filterText) {
				entries = entries.filter(
					(e) =>
						e.type.toLowerCase().includes(this.filterText) ||
						e.description.toLowerCase().includes(this.filterText) ||
						e.domain.toLowerCase().includes(this.filterText) ||
						e.services.toLowerCase().includes(this.filterText)
				);
			}

			// System tag filter
			if (!this.showSystemEvents) {
				entries = entries.filter((e) => !e.tags.includes("system"));
			}

			// Chip filters
			if (this.filterChipConfigured) {
				entries = entries.filter((e) => this.isConfigured(e.type));
			}
			if (this.filterChipFollowed) {
				entries = entries.filter((e) => this.notifiedTypes.has(e.type));
			}

			if (entries.length === 0 && category !== CUSTOM_EVENTS_CATEGORY) continue;

			visibleCount += entries.length;
			this.renderMasterCategory(this.masterTreeEl, category, entries);
		}

		const totalVisible = this.getVisibleEntries().length;
		this.countBadge.textContent = this.filterText || this.filterChipConfigured || this.filterChipFollowed
			? `${visibleCount} / ${totalVisible} events`
			: `${totalVisible} events`;

		// Validate selection still exists
		this.validateSelection(allEntries);
	}

	private renderMasterCategory(
		container: HTMLElement,
		category: string,
		entries: EventCatalogEntry[]
	): void {
		const isCollapsed = this.collapsedCategories.has(category);
		const group = container.createDiv({ cls: "ft-master-category" });

		const header = group.createDiv({ cls: "ft-master-category-header" });

		const chevron = header.createSpan({
			text: isCollapsed ? "\u25B6" : "\u25BC",
		});
		chevron.style.fontSize = "0.6rem";

		const catLabel = header.createSpan({ text: category });

		// Show description from category doc as tooltip
		const catEntry = this.categoryEntries.find((c) => c.name === category);
		if (catEntry?.description) {
			catLabel.title = catEntry.description;
		}

		// Count badge with enhanced info
		if (entries.length > 0) {
			const visibleInLog = entries.filter((e) => !this.excludedTypes.has(e.type)).length;
			const configuredInCat = entries.filter((e) => this.isConfigured(e.type)).length;

			const parts: string[] = [String(entries.length)];
			if (visibleInLog < entries.length) parts.push(`${visibleInLog} vis`);
			if (configuredInCat > 0) parts.push(`${configuredInCat} conf`);

			header.createSpan({
				text: parts.join(" \u00B7 "),
				cls: "ft-master-category-count",
			});
		}

		// Category doc button
		if (category !== CUSTOM_EVENTS_CATEGORY) {
			const catDocBtn = header.createSpan({ cls: "ft-visibility-toggle" });
			catDocBtn.setAttribute("aria-label", catEntry?.filePath ? "Open category doc" : "Create category doc");
			setIcon(catDocBtn, "file-text");
			catDocBtn.addEventListener("click", (e) => {
				e.stopPropagation();
				if (catEntry?.filePath) {
					void this.openFile(catEntry.filePath);
				} else {
					void this.openOrCreateCategoryDoc(category, entries);
				}
			});
		}

		// Category visibility toggle (hide all events from Activity Log)
		if (category !== CUSTOM_EVENTS_CATEGORY) {
			const catEntries = entries.length > 0 ? entries : [];
			const excludedCount = catEntries.filter((e) => this.excludedTypes.has(e.type)).length;
			const vis = excludedCount === 0 ? "all" : excludedCount === catEntries.length ? "none" : "partial";

			const catToggle = header.createSpan({ cls: "ft-visibility-toggle" });
			catToggle.setAttribute("aria-label", vis === "none" ? "Show all in Activity Log" : "Hide all from Activity Log");
			setIcon(catToggle, vis === "none" ? "eye-off" : "eye");
			if (vis === "partial") catToggle.classList.add("ft-visibility-partial");
			if (vis === "none") catToggle.classList.add("ft-visibility-off");

			catToggle.addEventListener("click", (e) => {
				e.stopPropagation();
				void this.eventBus.emit("eventFilter.toggleCategory", { category });
			});
		}

		// Add button for custom events
		if (category === CUSTOM_EVENTS_CATEGORY) {
			const addBtn = header.createSpan({ cls: "ft-visibility-toggle" });
			addBtn.style.marginLeft = "auto";
			setIcon(addBtn, "plus");
			addBtn.setAttribute("aria-label", "Create custom event");
			addBtn.addEventListener("click", (e) => {
				e.stopPropagation();
				new InputModal(this.app, {
					title: "Create Custom Event",
					placeholder: "my.custom.event",
					submitLabel: "Create",
					onSubmit: (name) => {
						void this.eventBus.emit("discovery.create", { eventName: name });
					},
				}).open();
			});
		}

		const list = group.createDiv();
		if (isCollapsed) list.classList.add("ft-hidden");

		for (const entry of entries) {
			this.renderMasterEventItem(list, entry);
		}

		header.addEventListener("click", () => {
			if (this.collapsedCategories.has(category)) {
				this.collapsedCategories.delete(category);
			} else {
				this.collapsedCategories.add(category);
			}
			list.classList.toggle("ft-hidden");
			chevron.textContent = this.collapsedCategories.has(category) ? "\u25B6" : "\u25BC";
			void this.eventBus.emit("settings.updateCollapsedCategories", {
				collapsed: [...this.collapsedCategories],
			});
		});
	}

	private renderMasterEventItem(container: HTMLElement, entry: EventCatalogEntry): void {
		const isSelected = this.selectedEventType === entry.type;
		const isExcluded = this.excludedTypes.has(entry.type);
		const cls = `ft-master-event-item${isSelected ? " ft-master-event-selected" : ""}${isExcluded ? " ft-master-event-excluded" : ""}`;
		const item = container.createDiv({ cls });

		item.createSpan({ text: entry.type, cls: "ft-master-event-name" });

		// Tag badges
		if (entry.tags.length > 0) {
			const tagContainer = item.createDiv({ cls: "ft-master-tags" });
			for (const tag of entry.tags) {
				tagContainer.createSpan({ text: tag, cls: "ft-badge ft-badge-tag" });
			}
		}

		// Status dots
		const configured = this.isConfigured(entry.type);
		const followed = this.notifiedTypes.has(entry.type);

		if (configured || followed || isExcluded) {
			const dots = item.createDiv({ cls: "ft-master-status-dots" });
			if (isExcluded) {
				const dot = dots.createDiv({ cls: "ft-master-status-dot ft-master-dot-hidden" });
				dot.setAttribute("aria-label", "Hidden from Activity Log");
				dot.title = "Hidden from Activity Log";
			}
			if (configured) {
				const dot = dots.createDiv({ cls: "ft-master-status-dot ft-master-dot-configured" });
				dot.setAttribute("aria-label", "Has watchers or transforms");
				dot.title = "Has watchers or transforms";
			}
			if (followed) {
				const dot = dots.createDiv({ cls: "ft-master-status-dot ft-master-dot-followed" });
				dot.setAttribute("aria-label", "Followed \u2014 triggers Notice popup");
				dot.title = "Followed \u2014 triggers Notice popup";
			}
		}

		item.addEventListener("click", () => {
			this.selectedEventType = entry.type;
			this.renderMasterTree();
			this.renderDetail();
		});
	}

	// ─────────────────────────────────────────────────────────────
	// Detail panel
	// ─────────────────────────────────────────────────────────────

	private renderDetail(): void {
		this.detailPanelEl.empty();

		if (!this.selectedEventType) {
			this.renderDetailEmpty();
			return;
		}

		const entry = this.resolveEntry(this.selectedEventType);
		if (!entry) {
			this.renderDetailEmpty();
			return;
		}

		this.renderDetailContent(entry);
	}

	private renderDetailEmpty(): void {
		const empty = this.detailPanelEl.createDiv({ cls: "ft-catalog-detail-empty" });

		const icon = empty.createDiv();
		setIcon(icon, "list");
		icon.style.opacity = "0.3";

		empty.createEl("p", { text: "Select an event to view details" });

		// Quick stats
		const allEntries = [...EVENT_CATALOG, ...this.discoveredToCatalogEntries()];
		const configuredCount = this.getConfiguredCount();
		const followedCount = this.getFollowedCount();

		const stats = empty.createDiv({ cls: "ft-catalog-quick-stats" });
		this.renderStat(stats, `${allEntries.length}`, "events");
		this.renderStat(stats, `${configuredCount}`, "configured");
		this.renderStat(stats, `${followedCount}`, "followed");
	}

	private renderDetailContent(entry: EventCatalogEntry): void {
		const isCustom = entry.category === CUSTOM_EVENTS_CATEGORY;

		// Header: event type + badges
		this.renderDetailHeader(entry);

		// Info card
		this.renderDetailInfoCard(entry);

		// Actions
		this.renderDetailActions(entry, isCustom);

		// Watchers section
		this.renderDetailWatchers(entry);

		// Transforms section
		this.renderDetailTransforms(entry);

		// Related entities
		const criteria = { events: [entry.type] };
		this.renderRelatedSection(this.detailPanelEl, "Related Flows",
			this.findRelatedFlows(criteria).map((f) => ({ name: f.name, onClick: () => this.navigateToFlow(f.name) })));
		this.renderRelatedSection(this.detailPanelEl, "Related Systems",
			this.findRelatedSystems(criteria).map((s) => ({ name: s.name, onClick: () => this.navigateToSystem(s.name) })));
		this.renderRelatedSection(this.detailPanelEl, "Related Actors",
			this.findRelatedActors(criteria).map((a) => ({ name: a.name, onClick: () => this.navigateToActor(a.name) })));
	}

	private renderDetailHeader(entry: EventCatalogEntry): void {
		const header = this.detailPanelEl.createDiv({ cls: "ft-detail-header" });

		const left = header.createDiv();
		left.createDiv({ text: entry.type, cls: "ft-detail-event-type" });

		const badges = left.createDiv({ cls: "ft-flex ft-gap-1 ft-mt-1" });
		badges.createSpan({ text: entry.category, cls: "ft-badge ft-badge-muted" });
		if (entry.stability) {
			badges.createSpan({ text: entry.stability, cls: "ft-badge ft-badge-muted" });
		}
		for (const tag of entry.tags) {
			badges.createSpan({ text: tag, cls: "ft-badge ft-badge-tag" });
		}
	}

	private renderDetailInfoCard(entry: EventCatalogEntry): void {
		const card = this.detailPanelEl.createDiv({ cls: "ft-card ft-mt-2" });

		if (entry.description) {
			card.createEl("p", {
				text: entry.description,
				cls: "ft-text-muted ft-text-sm ft-mb-2",
			});
		}

		const grid = card.createDiv({ cls: "ft-detail-info-grid" });

		const addRow = (label: string, value: string) => {
			grid.createDiv({ text: label, cls: "ft-detail-info-label" });
			grid.createDiv({ text: value, cls: "ft-detail-info-value" });
		};

		addRow("Direction", entry.direction);

		// Domain — clickable, navigates to Domains tab
		grid.createDiv({ text: "Domain", cls: "ft-detail-info-label" });
		const domainVal = grid.createDiv({ cls: "ft-detail-info-value" });
		const domainLink = domainVal.createEl("span", { text: entry.domain, cls: "ft-nav-link" });
		domainLink.addEventListener("click", () => this.navigateToDomain(entry.domain));

		// Services — clickable, navigates to Services tab
		grid.createDiv({ text: "Services", cls: "ft-detail-info-label" });
		const serviceVal = grid.createDiv({ cls: "ft-detail-info-value" });
		const serviceLink = serviceVal.createEl("span", { text: entry.services, cls: "ft-nav-link" });
		serviceLink.addEventListener("click", () => this.navigateToService(entry.services));

		if (entry.stability) addRow("Stability", entry.stability);
		if (entry.visibility) addRow("Visibility", entry.visibility);
	}

	private renderDetailActions(entry: EventCatalogEntry, isCustom: boolean): void {
		const actions = this.detailPanelEl.createDiv({ cls: "ft-detail-actions" });

		// Event Doc
		const docBtn = actions.createEl("span", { cls: "ft-nav-link" });
		const docIcon = docBtn.createSpan();
		setIcon(docIcon, "file-text");
		docBtn.appendText(" Event Doc");
		docBtn.addEventListener("click", () => {
			void this.openOrCreateEventDoc(entry);
		});

		// Follow toggle — triggers Notice popup when event fires
		const isFollowed = this.notifiedTypes.has(entry.type);
		const followBtn = actions.createEl("button", {
			cls: `ft-btn ft-text-sm ${isFollowed ? "ft-btn-primary" : "ft-btn-secondary"}`,
		});
		followBtn.title = isFollowed
			? "Currently following \u2014 a Notice popup will appear when this event fires"
			: "Follow this event to get a Notice popup when it fires";
		const followIcon = followBtn.createSpan();
		setIcon(followIcon, isFollowed ? "bell" : "bell-off");
		followBtn.appendText(isFollowed ? " Following" : " Follow");
		followBtn.addEventListener("click", () => {
			void this.eventBus.emit("eventNotify.toggle", { eventType: entry.type });
		});

		// Activity Log visibility — show/hide from the Activity Log
		const isExcluded = this.excludedTypes.has(entry.type);
		const visBtn = actions.createEl("button", {
			cls: `ft-btn ft-text-sm ${isExcluded ? "ft-btn-ghost" : "ft-btn-secondary"}`,
		});
		visBtn.title = isExcluded
			? "Hidden from the Activity Log \u2014 click to show"
			: "Visible in the Activity Log \u2014 click to hide";
		const visIcon = visBtn.createSpan();
		setIcon(visIcon, isExcluded ? "eye-off" : "eye");
		visBtn.appendText(isExcluded ? " Hidden from Log" : " In Activity Log");
		visBtn.addEventListener("click", () => {
			void this.eventBus.emit("eventFilter.toggle", { eventType: entry.type });
		});

		// Source file (custom events)
		if (isCustom) {
			const sourcePath = this.getSourcePath(entry.type);
			if (sourcePath) {
				const srcBtn = actions.createEl("span", { cls: "ft-nav-link" });
				const srcIcon = srcBtn.createSpan();
				setIcon(srcIcon, "file-input");
				srcBtn.appendText(" Source");
				srcBtn.addEventListener("click", () => {
					void this.openFile(sourcePath);
				});
			}
		}

		// Delete (custom events)
		if (isCustom) {
			const delBtn = actions.createEl("button", { cls: "ft-btn ft-btn-ghost ft-text-sm" });
			delBtn.style.color = "var(--text-error)";
			const delIcon = delBtn.createSpan();
			setIcon(delIcon, "trash-2");
			delBtn.appendText(" Delete");
			delBtn.addEventListener("click", () => {
				new ConfirmModal(this.app, {
					message: `Remove "${entry.type}" from the catalog?`,
					confirmLabel: "Remove",
					onConfirm: () => {
						void this.eventBus.emit("discovery.remove", { eventName: entry.type });
						this.selectedEventType = null;
						this.renderMasterTree();
						this.renderDetail();
					},
				}).open();
			});
		}
	}

	private renderDetailWatchers(entry: EventCatalogEntry): void {
		const subs = this.subscriptions.filter((s) => s.eventType === entry.type);

		const section = this.detailPanelEl.createDiv({ cls: "ft-detail-section" });
		const header = section.createDiv({ cls: "ft-detail-section-header" });

		header.createSpan({
			text: `Watchers (${subs.length})`,
			cls: "ft-heading ft-heading-sm",
		});

		const addBtn = header.createEl("button", {
			text: "Add watcher",
			cls: "ft-btn ft-btn-secondary ft-text-sm",
		});
		addBtn.addEventListener("click", () => {
			const tempEntry = this.resolveEntry(entry.type);
			if (tempEntry) {
				new EventConfigModal(this.app, this.eventBus, tempEntry, this.docsRootPath).open();
			}
		});

		if (subs.length === 0) {
			section.createDiv({
				text: "No watchers configured for this event.",
				cls: "ft-text-muted ft-text-sm ft-p-2",
			});
			return;
		}

		for (const sub of subs) {
			this.renderDetailSubscriptionRow(section, sub);
		}
	}

	private renderDetailSubscriptionRow(container: HTMLElement, sub: Subscription): void {
		const row = container.createDiv({ cls: "ft-catalog-row" });

		// Label
		row.createSpan({
			text: sub.label || sub.eventType,
			cls: "ft-font-medium ft-text-sm",
		});

		// Filters
		const filterParts: string[] = [];
		if (sub.filters.pathPattern) filterParts.push(`path: ${sub.filters.pathPattern}`);
		if (sub.filters.extension) filterParts.push(`ext: ${sub.filters.extension}`);
		if (sub.filters.namePattern) filterParts.push(`name: ${sub.filters.namePattern}`);

		if (filterParts.length > 0) {
			row.createSpan({ text: filterParts.join(", "), cls: "ft-text-muted ft-text-sm ft-truncate" });
		}

		const spacer = row.createDiv();
		spacer.style.flex = "1";

		const actions = row.createDiv({ cls: "ft-flex ft-items-center ft-gap-1" });

		// Enable toggle
		const toggleBtn = actions.createSpan({
			cls: `ft-visibility-toggle${sub.enabled ? "" : " ft-visibility-off"}`,
		});
		setIcon(toggleBtn, sub.enabled ? "check-circle" : "circle");
		toggleBtn.setAttribute("aria-label", sub.enabled ? "Disable" : "Enable");
		toggleBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			void this.eventBus.emit("subscription.update", {
				subscriptionId: sub.id,
				enabled: !sub.enabled,
			});
		});

		// Edit
		const editBtn = actions.createSpan({ cls: "ft-visibility-toggle" });
		setIcon(editBtn, "pencil");
		editBtn.setAttribute("aria-label", "Edit watcher");
		editBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			const entry = this.resolveEntry(sub.eventType);
			if (entry) {
				new EventConfigModal(this.app, this.eventBus, entry, this.docsRootPath).open();
			}
		});

		// Delete
		const deleteBtn = actions.createSpan({ cls: "ft-visibility-toggle" });
		setIcon(deleteBtn, "trash-2");
		deleteBtn.setAttribute("aria-label", "Delete watcher");
		deleteBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			void this.eventBus.emit("subscription.remove", { subscriptionId: sub.id });
		});
	}

	private renderDetailTransforms(entry: EventCatalogEntry): void {
		const defs = this.definitions.filter((d) => d.sourceEventType === entry.type);

		const section = this.detailPanelEl.createDiv({ cls: "ft-detail-section" });
		const header = section.createDiv({ cls: "ft-detail-section-header" });

		header.createSpan({
			text: `Transforms (${defs.length})`,
			cls: "ft-heading ft-heading-sm",
		});

		const addBtn = header.createEl("button", {
			text: "Add transform",
			cls: "ft-btn ft-btn-secondary ft-text-sm",
		});
		addBtn.addEventListener("click", () => {
			const tempEntry = this.resolveEntry(entry.type);
			if (tempEntry) {
				new EventConfigModal(this.app, this.eventBus, tempEntry, this.docsRootPath).open();
			}
		});

		if (defs.length === 0) {
			section.createDiv({
				text: "No transforms configured for this event.",
				cls: "ft-text-muted ft-text-sm ft-p-2",
			});
			return;
		}

		for (const def of defs) {
			this.renderDetailDefinitionRow(section, def);
		}
	}

	private renderDetailDefinitionRow(container: HTMLElement, def: EventDefinition): void {
		const row = container.createDiv({ cls: "ft-catalog-row" });

		// Arrow + output event name
		const nameEl = row.createSpan({ cls: "ft-flex ft-items-center ft-gap-1" });
		nameEl.createSpan({ text: "\u2192" });
		nameEl.createSpan({ text: def.domainEventName, cls: "ft-event-type" });

		// Pattern + policy
		const meta: string[] = [];
		if (def.filePattern) meta.push(def.filePattern);
		meta.push(def.emissionPolicy === "once" ? "once" : "always");

		row.createSpan({ text: meta.join(" \u00B7 "), cls: "ft-text-muted ft-text-sm" });

		const spacer = row.createDiv();
		spacer.style.flex = "1";

		const actions = row.createDiv({ cls: "ft-flex ft-items-center ft-gap-1" });

		// Enable toggle
		const toggleBtn = actions.createSpan({
			cls: `ft-visibility-toggle${def.enabled ? "" : " ft-visibility-off"}`,
		});
		setIcon(toggleBtn, def.enabled ? "check-circle" : "circle");
		toggleBtn.setAttribute("aria-label", def.enabled ? "Disable" : "Enable");
		toggleBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			void this.eventBus.emit("eventDefinition.update", {
				definitionId: def.id,
				enabled: !def.enabled,
			});
		});

		// Edit
		const editBtn = actions.createSpan({ cls: "ft-visibility-toggle" });
		setIcon(editBtn, "pencil");
		editBtn.setAttribute("aria-label", "Edit transform");
		editBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			const entry = this.resolveEntry(def.sourceEventType);
			if (entry) {
				new EventConfigModal(this.app, this.eventBus, entry, this.docsRootPath).open();
			}
		});

		// Delete
		const deleteBtn = actions.createSpan({ cls: "ft-visibility-toggle" });
		setIcon(deleteBtn, "trash-2");
		deleteBtn.setAttribute("aria-label", "Delete transform");
		deleteBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			void this.eventBus.emit("eventDefinition.remove", { definitionId: def.id });
		});
	}

	// ─────────────────────────────────────────────────────────────
	// Settings panel (reused from old implementation)
	// ─────────────────────────────────────────────────────────────

	private renderSettingsPanel(): void {
		this.settingsPanel.empty();

		const categories = this.getOrderedCategories();

		for (let i = 0; i < categories.length; i++) {
			const cat = categories[i];

			const row = this.settingsPanel.createDiv({ cls: "ft-settings-row" });

			// Visibility toggle
			const toggle = row.createSpan({
				cls: `ft-visibility-toggle${cat.visible ? "" : " ft-visibility-off"}`,
			});
			toggle.setAttribute("aria-label", cat.visible ? "Hide category" : "Show category");
			setIcon(toggle, cat.visible ? "eye" : "eye-off");
			toggle.addEventListener("click", () => {
				categories[i] = { ...categories[i], visible: !categories[i].visible };
				void this.eventBus.emit("settings.updateCatalogCategories", { categories: [...categories] });
			});

			// Category name
			row.createSpan({ text: cat.name, cls: "ft-settings-row-name" });

			// Arrow controls
			const arrows = row.createDiv({ cls: "ft-flex ft-items-center ft-gap-1" });

			const upBtn = arrows.createSpan({
				cls: `ft-visibility-toggle${i === 0 ? " ft-btn-disabled" : ""}`,
			});
			upBtn.setAttribute("aria-label", "Move up");
			setIcon(upBtn, "chevron-up");
			if (i > 0) {
				upBtn.addEventListener("click", () => {
					[categories[i - 1], categories[i]] = [categories[i], categories[i - 1]];
					void this.eventBus.emit("settings.updateCatalogCategories", { categories: [...categories] });
				});
			}

			const downBtn = arrows.createSpan({
				cls: `ft-visibility-toggle${i === categories.length - 1 ? " ft-btn-disabled" : ""}`,
			});
			downBtn.setAttribute("aria-label", "Move down");
			setIcon(downBtn, "chevron-down");
			if (i < categories.length - 1) {
				downBtn.addEventListener("click", () => {
					[categories[i], categories[i + 1]] = [categories[i + 1], categories[i]];
					void this.eventBus.emit("settings.updateCatalogCategories", { categories: [...categories] });
				});
			}
		}

		// Reset button
		const resetRow = this.settingsPanel.createDiv({ cls: "ft-settings-reset" });
		const resetBtn = resetRow.createEl("button", {
			text: "Reset to defaults",
			cls: "ft-btn ft-btn-secondary",
		});
		resetBtn.addEventListener("click", () => {
			void this.eventBus.emit("settings.updateCatalogCategories", {
				categories: [...DEFAULT_CATALOG_CATEGORIES],
			});
		});
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
					this.renderMasterTree();
					this.renderFilterChips();
					this.renderDetail();
					break;
				case "domains":
					this.renderDomainMaster();
					this.renderDomainDetail();
					break;
				case "services":
					this.renderServiceMaster();
					this.renderServiceDetail();
					break;
				case "flows":
					this.renderFlowMaster();
					this.renderFlowDetail();
					break;
				case "systems":
					this.renderSystemMaster();
					this.renderSystemDetail();
					break;
				case "actors":
					this.renderActorMaster();
					this.renderActorDetail();
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
			case "events": {
				const visible = this.getVisibleEntries();
				const total = visible.length;
				const hasFilter = this.filterText || this.filterChipConfigured || this.filterChipFollowed;
				if (hasFilter) {
					let filtered = visible;
					if (this.filterText) {
						filtered = filtered.filter(
							(e) =>
								e.type.toLowerCase().includes(this.filterText) ||
								e.description.toLowerCase().includes(this.filterText) ||
								e.domain.toLowerCase().includes(this.filterText) ||
								e.services.toLowerCase().includes(this.filterText)
						);
					}
					if (this.filterChipConfigured) filtered = filtered.filter((e) => this.isConfigured(e.type));
					if (this.filterChipFollowed) filtered = filtered.filter((e) => this.notifiedTypes.has(e.type));
					this.countBadge.textContent = `${filtered.length} / ${total} events`;
				} else {
					this.countBadge.textContent = `${total} events`;
				}
				break;
			}
			case "domains": {
				const domains = this.domainEntries;
				const filtered = this.filterText
					? domains.filter((d) => d.name.toLowerCase().includes(this.filterText))
					: domains;
				this.countBadge.textContent = this.filterText
					? `${filtered.length} / ${domains.length} domains`
					: `${domains.length} domains`;
				break;
			}
			case "services": {
				const services = this.serviceEntries;
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
		}
	}

	private isConfigured(eventType: string): boolean {
		return (
			this.subscriptions.some((s) => s.eventType === eventType) ||
			this.definitions.some((d) => d.sourceEventType === eventType)
		);
	}

	/** Returns only entries whose category is currently visible (or custom). */
	private getVisibleEntries(): EventCatalogEntry[] {
		const allEntries = [...EVENT_CATALOG, ...this.discoveredToCatalogEntries()];
		const visibleCats = new Set(
			this.getOrderedCategories().filter((c) => c.visible).map((c) => c.name)
		);
		visibleCats.add(CUSTOM_EVENTS_CATEGORY);
		return allEntries.filter((e) => {
			if (!visibleCats.has(e.category)) return false;
			if (!this.showSystemEvents && e.tags.includes("system")) return false;
			return true;
		});
	}

	/** Returns true if ALL events in the array have the "system" tag. */
	private isSystemOnly(events: EventCatalogEntry[]): boolean {
		return events.length > 0 && events.every((e) => e.tags.includes("system"));
	}

	private getConfiguredCount(): number {
		return this.getVisibleEntries().filter((e) => this.isConfigured(e.type)).length;
	}

	private getFollowedCount(): number {
		return this.getVisibleEntries().filter((e) => this.notifiedTypes.has(e.type)).length;
	}

	private resolveEntry(eventType: string): EventCatalogEntry | undefined {
		// Check system catalog first
		const system = EVENT_CATALOG.find((e) => e.type === eventType);
		if (system) return system;

		// Check discovered
		const discovered = this.discoveredToCatalogEntries().find((e) => e.type === eventType);
		return discovered;
	}

	private validateSelection(allEntries: EventCatalogEntry[]): void {
		if (this.selectedEventType && !allEntries.some((e) => e.type === this.selectedEventType)) {
			this.selectedEventType = null;
			this.renderDetail();
		}
	}

	private renderStat(container: HTMLElement, value: string, label: string): void {
		const stat = container.createDiv({ cls: "ft-catalog-stat" });
		stat.createDiv({ text: value, cls: "ft-catalog-stat-value" });
		stat.createDiv({ text: label, cls: "ft-catalog-stat-label" });
	}

	/**
	 * Converts discovered events to catalog entries, enriching each entry
	 * with metadata from its EventDoc (if present) and event source file.
	 */
	private discoveredToCatalogEntries(): EventCatalogEntry[] {
		return this.discoveredEvents.map((d) => {
			const sourceFm = this.readFrontmatter(d.sourcePath);
			const docPath = getEventDocPath(this.docsRootPath, d.eventName);
			const docFm = this.readFrontmatter(docPath);

			return {
				type: d.eventName,
				category: CUSTOM_EVENTS_CATEGORY,
				description:
					this.fmString(docFm, "description") ??
					this.fmString(sourceFm, "description") ??
					`Custom event (triggered ${d.triggerCount}x)`,
				direction:
					this.fmString(docFm, "direction") ?? "User \u2192 EventBus",
				domain:
					this.fmString(docFm, "domain") ?? "custom",
				services:
					this.fmString(docFm, "services") ?? "Discovery",
				stability: (this.fmString(docFm, "stability") as EventCatalogEntry["stability"]) ?? "experimental",
				visibility: (this.fmString(docFm, "visibility") as EventCatalogEntry["visibility"]) ?? "user-facing",
				tags: [],
			};
		});
	}

	private readFrontmatter(path: string): Record<string, unknown> | undefined {
		const file = this.app.vault.getAbstractFileByPath(path);
		if (!(file instanceof TFile)) return undefined;
		return this.app.metadataCache.getFileCache(file)?.frontmatter as
			| Record<string, unknown>
			| undefined;
	}

	private fmString(fm: Record<string, unknown> | undefined, key: string): string | undefined {
		const val = fm?.[key];
		return typeof val === "string" && val.trim() ? val.trim() : undefined;
	}

	private fmStringArray(fm: Record<string, unknown> | undefined, key: string): string[] {
		if (!fm) return [];
		const val = fm[key];
		if (!Array.isArray(val)) return [];
		return val.filter((v: unknown) => typeof v === "string") as string[];
	}

	private normalizeDocFrontmatter(
		file: TFile,
		docType: string,
		nameField: string,
		name: string,
		metadata: { description: string; events?: string[]; domains: string[]; services: string[] },
	): void {
		void this.app.fileManager.processFrontMatter(file, (fm) => {
			fm.type = docType;
			fm[nameField] = name;
			if (!fm.description) fm.description = metadata.description;
			fm.domains = metadata.domains;
			fm.services = metadata.services;
			if (metadata.events !== undefined) {
				fm.events = metadata.events;
			}
			if (!fm.created) fm.created = new Date().toISOString();
		});
	}

	private getOrderedCategories(): CatalogCategoryConfig[] {
		const knownNames = new Set<string>(EVENT_CATEGORIES as readonly string[]);

		const result = this.catalogCategories.filter((c) => knownNames.has(c.name));

		const settingsNames = new Set(result.map((c) => c.name));
		for (const cat of EVENT_CATEGORIES) {
			if (!settingsNames.has(cat)) {
				result.push({ name: cat, visible: true });
			}
		}

		return result;
	}

	private getSourcePath(eventName: string): string | undefined {
		return this.discoveredEvents.find((d) => d.eventName === eventName)?.sourcePath;
	}

	private async openFile(path: string): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(path);
		if (file && file instanceof TFile) {
			const leaf = this.app.workspace.getLeaf(false);
			await leaf.openFile(file);
		}
	}

	private async openOrCreateEventDoc(entry: EventCatalogEntry): Promise<void> {
		const docPath = getEventDocPath(this.docsRootPath, entry.type);

		let file = this.app.vault.getAbstractFileByPath(docPath);

		if (!file) {
			const content = generateEventDocContent(entry);
			try {
				await this.fileSystemClient.createFile(docPath, content, {
					createFolders: true,
				});
			} catch (err) {
				console.error(`[Flowti] Failed to create event doc: ${docPath}`, err);
				return;
			}
			file = this.app.vault.getAbstractFileByPath(docPath);
		}

		if (file && file instanceof TFile) {
			const leaf = this.app.workspace.getLeaf(false);
			await leaf.openFile(file);
		}
	}

	// ─────────────────────────────────────────────────────────────
	// Domain tab
	// ─────────────────────────────────────────────────────────────

	private scanDomains(): void {
		const allEntries = [...EVENT_CATALOG, ...this.discoveredToCatalogEntries()];
		const domainMap = new Map<string, EventCatalogEntry[]>();

		for (const entry of allEntries) {
			const list = domainMap.get(entry.domain) ?? [];
			list.push(entry);
			domainMap.set(entry.domain, list);
		}

		// Scan folder for documented domains
		const domainsFolder = getDomainsFolderPath(this.docsRootPath);
		const folder = this.app.vault.getAbstractFileByPath(domainsFolder);
		const fileMap = new Map<string, { filePath: string; description: string; services: string[]; categories: string[] }>();

		if (folder && folder instanceof TFolder) {
			for (const child of folder.children) {
				if (!(child instanceof TFile) || child.extension !== "md") continue;

				const fm = this.readFrontmatter(child.path);
				const name = (fm && (this.fmString(fm, "domain")
					?? this.fmString(fm, "name"))) ?? child.basename;
				const description = (fm && this.fmString(fm, "description")) ?? "";
				const services = this.fmStringArray(fm, "services");
				const categories = this.fmStringArray(fm, "categories");

				fileMap.set(name, { filePath: child.path, description, services, categories });

				// Ensure this domain exists in the map even if catalog has no events for it
				if (!domainMap.has(name)) domainMap.set(name, []);

				if (!fm || fm.type !== "DomainDoc") {
					this.normalizeDocFrontmatter(child, "DomainDoc", "domain", name, { description, domains: [], services });
				}
			}
		}

		this.domainEntries = Array.from(domainMap.entries())
			.map(([name, events]) => {
				const fileData = fileMap.get(name);
				return {
					name,
					description: fileData?.description ?? "",
					events,
					services: fileData?.services.length
						? fileData.services
						: [...new Set(events.map((e) => e.services))].sort(),
					categories: fileData?.categories.length
						? fileData.categories
						: [...new Set(events.map((e) => e.category))].sort(),
					filePath: fileData?.filePath ?? null,
					configuredCount: events.filter((e) => this.isConfigured(e.type)).length,
					visibleCount: events.filter((e) => !this.excludedTypes.has(e.type)).length,
					visible: (() => {
						const setting = this.catalogDomains.find((d) => d.name === name);
						return setting ? setting.visible : !this.isSystemOnly(events);
					})(),
				};
			})
			.sort((a, b) => a.name.localeCompare(b.name));
	}

	private renderDomainMaster(): void {
		this.scanDomains();
		this.masterTreeEl.empty();

		let domains = this.domainEntries;

		if (this.filterText) {
			domains = domains.filter(
				(d) =>
					d.name.toLowerCase().includes(this.filterText) ||
					d.description.toLowerCase().includes(this.filterText) ||
					d.events.some((e) => e.type.toLowerCase().includes(this.filterText))
			);
		}

		// Header with add button
		const header = this.masterTreeEl.createDiv({ cls: "ft-master-category-header" });
		header.createSpan({ text: "Domains" });
		const addDomainBtn = header.createSpan({ cls: "ft-visibility-toggle" });
		addDomainBtn.style.marginLeft = "auto";
		setIcon(addDomainBtn, "plus");
		addDomainBtn.setAttribute("aria-label", "Create new domain");
		addDomainBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			new InputModal(this.app, {
				title: "Create New Domain",
				placeholder: "my-domain",
				submitLabel: "Create",
				inputName: "Domain name",
				inputDesc: "A short identifier for this domain",
				onSubmit: (name) => {
					void this.createDomainDoc(name);
				},
			}).open();
		});

		const visibleDomains = domains.filter((d) => d.visible);
		const hiddenDomains = domains.filter((d) => !d.visible);

		for (const d of visibleDomains) {
			this.renderDomainItem(d, this.masterTreeEl);
		}

		if (hiddenDomains.length > 0) {
			const hiddenHeader = this.masterTreeEl.createDiv({ cls: "ft-master-category-header" });
			hiddenHeader.style.marginTop = "8px";
			hiddenHeader.style.opacity = "0.6";
			hiddenHeader.style.cursor = "pointer";
			hiddenHeader.createSpan({ text: `${hiddenDomains.length} hidden` });
			const expandIcon = hiddenHeader.createSpan({ cls: "ft-visibility-toggle" });
			expandIcon.style.marginLeft = "auto";
			setIcon(expandIcon, "chevron-down");

			const hiddenContainer = this.masterTreeEl.createDiv();
			hiddenContainer.style.display = "none";

			hiddenHeader.addEventListener("click", () => {
				const expanded = hiddenContainer.style.display !== "none";
				hiddenContainer.style.display = expanded ? "none" : "block";
				setIcon(expandIcon, expanded ? "chevron-down" : "chevron-up");
			});

			for (const d of hiddenDomains) {
				this.renderDomainItem(d, hiddenContainer);
			}
		}
	}

	private renderDomainItem(d: DomainEntry, container: HTMLElement): void {
		const isSelected = this.selectedDomain === d.name;
		const item = container.createDiv({
			cls: `ft-master-event-item${isSelected ? " ft-master-event-selected" : ""}`,
		});

		if (!d.visible) item.style.opacity = "0.6";

		// Eye icon for visibility toggle
		const eyeBtn = item.createSpan({ cls: "ft-visibility-toggle" });
		eyeBtn.style.flexShrink = "0";
		eyeBtn.style.cursor = "pointer";
		setIcon(eyeBtn, d.visible ? "eye" : "eye-off");
		eyeBtn.setAttribute("aria-label", d.visible ? "Hide domain" : "Show domain");
		eyeBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			this.toggleDomainVisibility(d.name);
		});

		const iconEl = item.createSpan();
		setIcon(iconEl, "box");
		iconEl.style.opacity = "0.5";
		iconEl.style.flexShrink = "0";

		item.createSpan({ text: d.name, cls: "ft-master-event-name" });

		item.createSpan({
			text: `${d.events.length}`,
			cls: "ft-master-category-count",
		});

		if (d.filePath === null) {
			item.createSpan({ text: "undocumented", cls: "ft-badge ft-badge-muted" });
		}

		if (d.configuredCount > 0) {
			const dots = item.createDiv({ cls: "ft-master-status-dots" });
			const dot = dots.createDiv({ cls: "ft-master-status-dot ft-master-dot-configured" });
			dot.title = `${d.configuredCount} configured`;
		}

		item.addEventListener("click", () => {
			this.selectedDomain = d.name;
			this.renderDomainMaster();
			this.renderDomainDetail();
		});
	}

	private toggleDomainVisibility(name: string): void {
		const entry = this.domainEntries.find((d) => d.name === name);
		const currentVisible = entry?.visible ?? true;
		const updated = this.catalogDomains.filter((d) => d.name !== name);
		updated.push({ name, visible: !currentVisible });
		this.catalogDomains = updated;
		void this.eventBus.emit("settings.updateCatalogDomains", { domains: updated });
		this.renderDomainMaster();
		this.renderDomainDetail();
	}

	private renderDomainDetail(): void {
		this.detailPanelEl.empty();

		if (!this.selectedDomain) {
			this.renderDomainDetailEmpty();
			return;
		}

		const domainData = this.domainEntries.find((d) => d.name === this.selectedDomain);
		if (!domainData) {
			this.renderDomainDetailEmpty();
			return;
		}

		// Header
		const header = this.detailPanelEl.createDiv({ cls: "ft-detail-header" });
		const left = header.createDiv();
		left.createDiv({ text: domainData.name, cls: "ft-detail-event-type" });
		const badges = left.createDiv({ cls: "ft-flex ft-gap-1 ft-mt-1" });
		badges.createSpan({ text: `${domainData.events.length} events`, cls: "ft-badge ft-badge-muted" });
		if (domainData.filePath === null) {
			badges.createSpan({ text: "undocumented", cls: "ft-badge ft-badge-muted" });
		}

		// Description
		if (domainData.description) {
			const descCard = this.detailPanelEl.createDiv({ cls: "ft-card ft-mt-2" });
			descCard.createEl("p", {
				text: domainData.description,
				cls: "ft-text-muted ft-text-sm",
			});
		}

		// Info card
		const card = this.detailPanelEl.createDiv({ cls: "ft-card ft-mt-2" });
		const grid = card.createDiv({ cls: "ft-detail-info-grid" });

		const addRow = (label: string, value: string) => {
			grid.createDiv({ text: label, cls: "ft-detail-info-label" });
			grid.createDiv({ text: value, cls: "ft-detail-info-value" });
		};

		addRow("Total Events", String(domainData.events.length));
		addRow("Configured", String(domainData.configuredCount));
		addRow("Visible in Log", `${domainData.visibleCount} / ${domainData.events.length}`);
		addRow("Categories", domainData.categories.join(", "));

		// Services — each clickable, navigates to Services tab
		grid.createDiv({ text: "Services", cls: "ft-detail-info-label" });
		const svcVal = grid.createDiv({ cls: "ft-detail-info-value ft-flex ft-gap-1" });
		if (domainData.services.length > 0) {
			for (const svc of domainData.services) {
				const svcLink = svcVal.createEl("span", { text: svc, cls: "ft-nav-link" });
				svcLink.addEventListener("click", () => this.navigateToService(svc));
			}
		} else {
			svcVal.createSpan({ text: "(none)", cls: "ft-text-muted" });
		}

		// Actions
		const actions = this.detailPanelEl.createDiv({ cls: "ft-detail-actions" });

		// Open / create doc
		const docBtn = actions.createEl("span", { cls: "ft-nav-link" });
		const docIcon = docBtn.createSpan();
		setIcon(docIcon, "file-text");
		docBtn.appendText(domainData.filePath ? " Open Doc" : " Create Doc");
		docBtn.addEventListener("click", () => {
			if (domainData.filePath) {
				void this.openFile(domainData.filePath);
			} else {
				void this.createDomainDoc(domainData.name);
			}
		});

		// Architecture Doc button
		const archBtn = actions.createEl("span", { cls: "ft-nav-link" });
		const archIcon = archBtn.createSpan();
		setIcon(archIcon, "layout");
		const archDocPath = getArchitectureDocPath(this.docsRootPath, domainData.name);
		const archExists = !!this.app.vault.getAbstractFileByPath(archDocPath);
		archBtn.appendText(archExists ? " Architecture Doc" : " Create Architecture Doc");
		archBtn.addEventListener("click", () => {
			void this.createArchitectureDoc(domainData.name);
		});

		// Delete button for documented domains (file-based only)
		if (domainData.filePath) {
			const delBtn = actions.createEl("button", { cls: "ft-btn ft-btn-ghost ft-text-sm" });
			delBtn.style.color = "var(--text-error)";
			const delIcon = delBtn.createSpan();
			setIcon(delIcon, "trash-2");
			delBtn.appendText(" Delete");
			delBtn.addEventListener("click", () => {
				new ConfirmModal(this.app, {
					message: `Delete domain doc "${domainData.name}"?`,
					confirmLabel: "Delete",
					onConfirm: () => {
						void this.deleteDomainDoc(domainData.filePath!);
					},
				}).open();
			});
		}

		// Events list
		const section = this.detailPanelEl.createDiv({ cls: "ft-detail-section" });
		const sectionHeader = section.createDiv({ cls: "ft-detail-section-header" });
		sectionHeader.createSpan({
			text: `Events (${domainData.events.length})`,
			cls: "ft-heading ft-heading-sm",
		});

		for (const entry of domainData.events) {
			const row = section.createDiv({ cls: "ft-catalog-row" });
			row.style.cursor = "pointer";

			row.createSpan({ text: entry.type, cls: "ft-event-type" });
			row.createSpan({ text: entry.category, cls: "ft-catalog-meta" });

			row.addEventListener("click", () => {
				this.navigateToEvent(entry.type);
			});
		}

		// Related entities
		const criteria = { domains: [domainData.name] };
		this.renderRelatedSection(this.detailPanelEl, "Related Flows",
			this.findRelatedFlows(criteria).map((f) => ({ name: f.name, onClick: () => this.navigateToFlow(f.name) })));
		this.renderRelatedSection(this.detailPanelEl, "Related Systems",
			this.findRelatedSystems(criteria).map((s) => ({ name: s.name, onClick: () => this.navigateToSystem(s.name) })));
		this.renderRelatedSection(this.detailPanelEl, "Related Actors",
			this.findRelatedActors(criteria).map((a) => ({ name: a.name, onClick: () => this.navigateToActor(a.name) })));
	}

	private renderDomainDetailEmpty(): void {
		const empty = this.detailPanelEl.createDiv({ cls: "ft-catalog-detail-empty" });

		const icon = empty.createDiv();
		setIcon(icon, "boxes");
		icon.style.opacity = "0.3";

		empty.createEl("p", { text: "Select a domain to view details" });

		const stats = empty.createDiv({ cls: "ft-catalog-quick-stats" });
		this.renderStat(stats, `${this.domainEntries.length}`, "domains");
		const totalEvents = this.domainEntries.reduce((sum, d) => sum + d.events.length, 0);
		this.renderStat(stats, `${totalEvents}`, "events");
		const totalConfigured = this.domainEntries.reduce((sum, d) => sum + d.configuredCount, 0);
		this.renderStat(stats, `${totalConfigured}`, "configured");
	}

	// ─────────────────────────────────────────────────────────────
	// Service tab
	// ─────────────────────────────────────────────────────────────

	private scanServices(): void {
		const allEntries = [...EVENT_CATALOG, ...this.discoveredToCatalogEntries()];
		const serviceMap = new Map<string, EventCatalogEntry[]>();

		for (const entry of allEntries) {
			const svc = entry.services.trim();
			const list = serviceMap.get(svc) ?? [];
			list.push(entry);
			serviceMap.set(svc, list);
		}

		// Scan folder for documented services
		const servicesFolder = getServicesFolderPath(this.docsRootPath);
		const folder = this.app.vault.getAbstractFileByPath(servicesFolder);
		const fileMap = new Map<string, { filePath: string; description: string; domains: string[] }>();

		if (folder && folder instanceof TFolder) {
			for (const child of folder.children) {
				if (!(child instanceof TFile) || child.extension !== "md") continue;

				const fm = this.readFrontmatter(child.path);
				const name = (fm && (this.fmString(fm, "service")
					?? this.fmString(fm, "name"))) ?? child.basename;
				const description = (fm && this.fmString(fm, "description")) ?? "";
				const domains = this.fmStringArray(fm, "domains");

				fileMap.set(name, { filePath: child.path, description, domains });

				if (!serviceMap.has(name)) serviceMap.set(name, []);

				if (!fm || fm.type !== "ServiceDoc") {
					this.normalizeDocFrontmatter(child, "ServiceDoc", "service", name, { description, domains, services: [] });
				}
			}
		}

		this.serviceEntries = Array.from(serviceMap.entries())
			.map(([name, events]) => {
				const fileData = fileMap.get(name);
				return {
					name,
					description: fileData?.description ?? "",
					events,
					domains: fileData?.domains.length
						? fileData.domains
						: [...new Set(events.map((e) => e.domain))].sort(),
					filePath: fileData?.filePath ?? null,
					configuredCount: events.filter((e) => this.isConfigured(e.type)).length,
					visible: (() => {
						const setting = this.catalogServices.find((s) => s.name === name);
						return setting ? setting.visible : !this.isSystemOnly(events);
					})(),
				};
			})
			.sort((a, b) => a.name.localeCompare(b.name));
	}

	private renderServiceMaster(): void {
		this.scanServices();
		this.masterTreeEl.empty();

		let services = this.serviceEntries;

		if (this.filterText) {
			services = services.filter(
				(s) =>
					s.name.toLowerCase().includes(this.filterText) ||
					s.description.toLowerCase().includes(this.filterText) ||
					s.events.some((e) => e.type.toLowerCase().includes(this.filterText))
			);
		}

		// Header with add button
		const header = this.masterTreeEl.createDiv({ cls: "ft-master-category-header" });
		header.createSpan({ text: "Services" });
		const addServiceBtn = header.createSpan({ cls: "ft-visibility-toggle" });
		addServiceBtn.style.marginLeft = "auto";
		setIcon(addServiceBtn, "plus");
		addServiceBtn.setAttribute("aria-label", "Create new service");
		addServiceBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			new InputModal(this.app, {
				title: "Create New Service",
				placeholder: "MyService",
				submitLabel: "Create",
				inputName: "Service name",
				inputDesc: "A short identifier for this service",
				onSubmit: (name) => {
					void this.createServiceDoc(name);
				},
			}).open();
		});

		const visibleServices = services.filter((s) => s.visible);
		const hiddenServices = services.filter((s) => !s.visible);

		for (const s of visibleServices) {
			this.renderServiceItem(s, this.masterTreeEl);
		}

		if (hiddenServices.length > 0) {
			const hiddenHeader = this.masterTreeEl.createDiv({ cls: "ft-master-category-header" });
			hiddenHeader.style.marginTop = "8px";
			hiddenHeader.style.opacity = "0.6";
			hiddenHeader.style.cursor = "pointer";
			hiddenHeader.createSpan({ text: `${hiddenServices.length} hidden` });
			const expandIcon = hiddenHeader.createSpan({ cls: "ft-visibility-toggle" });
			expandIcon.style.marginLeft = "auto";
			setIcon(expandIcon, "chevron-down");

			const hiddenContainer = this.masterTreeEl.createDiv();
			hiddenContainer.style.display = "none";

			hiddenHeader.addEventListener("click", () => {
				const expanded = hiddenContainer.style.display !== "none";
				hiddenContainer.style.display = expanded ? "none" : "block";
				setIcon(expandIcon, expanded ? "chevron-down" : "chevron-up");
			});

			for (const s of hiddenServices) {
				this.renderServiceItem(s, hiddenContainer);
			}
		}
	}

	private renderServiceItem(s: ServiceEntry, container: HTMLElement): void {
		const isSelected = this.selectedService === s.name;
		const item = container.createDiv({
			cls: `ft-master-event-item${isSelected ? " ft-master-event-selected" : ""}`,
		});

		if (!s.visible) item.style.opacity = "0.6";

		// Eye icon for visibility toggle
		const eyeBtn = item.createSpan({ cls: "ft-visibility-toggle" });
		eyeBtn.style.flexShrink = "0";
		eyeBtn.style.cursor = "pointer";
		setIcon(eyeBtn, s.visible ? "eye" : "eye-off");
		eyeBtn.setAttribute("aria-label", s.visible ? "Hide service" : "Show service");
		eyeBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			this.toggleServiceVisibility(s.name);
		});

		const iconEl = item.createSpan();
		setIcon(iconEl, "server");
		iconEl.style.opacity = "0.5";
		iconEl.style.flexShrink = "0";

		item.createSpan({ text: s.name, cls: "ft-master-event-name" });

		item.createSpan({
			text: `${s.events.length}`,
			cls: "ft-master-category-count",
		});

		if (s.filePath === null) {
			item.createSpan({ text: "undocumented", cls: "ft-badge ft-badge-muted" });
		}

		if (s.configuredCount > 0) {
			const dots = item.createDiv({ cls: "ft-master-status-dots" });
			const dot = dots.createDiv({ cls: "ft-master-status-dot ft-master-dot-configured" });
			dot.title = `${s.configuredCount} configured`;
		}

		item.addEventListener("click", () => {
			this.selectedService = s.name;
			this.renderServiceMaster();
			this.renderServiceDetail();
		});
	}

	private toggleServiceVisibility(name: string): void {
		const entry = this.serviceEntries.find((s) => s.name === name);
		const currentVisible = entry?.visible ?? true;
		const updated = this.catalogServices.filter((s) => s.name !== name);
		updated.push({ name, visible: !currentVisible });
		this.catalogServices = updated;
		void this.eventBus.emit("settings.updateCatalogServices", { services: updated });
		this.renderServiceMaster();
		this.renderServiceDetail();
	}

	private renderServiceDetail(): void {
		this.detailPanelEl.empty();

		if (!this.selectedService) {
			this.renderServiceDetailEmpty();
			return;
		}

		const serviceData = this.serviceEntries.find((s) => s.name === this.selectedService);
		if (!serviceData) {
			this.renderServiceDetailEmpty();
			return;
		}

		// Header
		const header = this.detailPanelEl.createDiv({ cls: "ft-detail-header" });
		const left = header.createDiv();
		left.createDiv({ text: serviceData.name, cls: "ft-detail-event-type" });
		const badges = left.createDiv({ cls: "ft-flex ft-gap-1 ft-mt-1" });
		badges.createSpan({ text: `${serviceData.events.length} events`, cls: "ft-badge ft-badge-muted" });
		if (serviceData.filePath === null) {
			badges.createSpan({ text: "undocumented", cls: "ft-badge ft-badge-muted" });
		}

		// Description
		if (serviceData.description) {
			const descCard = this.detailPanelEl.createDiv({ cls: "ft-card ft-mt-2" });
			descCard.createEl("p", {
				text: serviceData.description,
				cls: "ft-text-muted ft-text-sm",
			});
		}

		// Info card
		const card = this.detailPanelEl.createDiv({ cls: "ft-card ft-mt-2" });
		const grid = card.createDiv({ cls: "ft-detail-info-grid" });

		const addRow = (label: string, value: string) => {
			grid.createDiv({ text: label, cls: "ft-detail-info-label" });
			grid.createDiv({ text: value, cls: "ft-detail-info-value" });
		};

		addRow("Total Events", String(serviceData.events.length));
		addRow("Configured", String(serviceData.configuredCount));

		// Domains — each clickable, navigates to Domains tab
		grid.createDiv({ text: "Domains", cls: "ft-detail-info-label" });
		const domVal = grid.createDiv({ cls: "ft-detail-info-value ft-flex ft-gap-1" });
		if (serviceData.domains.length > 0) {
			for (const dom of serviceData.domains) {
				const domLink = domVal.createEl("span", { text: dom, cls: "ft-nav-link" });
				domLink.addEventListener("click", () => this.navigateToDomain(dom));
			}
		} else {
			domVal.createSpan({ text: "(none)", cls: "ft-text-muted" });
		}

		// Actions
		const actions = this.detailPanelEl.createDiv({ cls: "ft-detail-actions" });

		// Open / create doc
		const docBtn = actions.createEl("span", { cls: "ft-nav-link" });
		const docIcon = docBtn.createSpan();
		setIcon(docIcon, "file-text");
		docBtn.appendText(serviceData.filePath ? " Open Doc" : " Create Doc");
		docBtn.addEventListener("click", () => {
			if (serviceData.filePath) {
				void this.openFile(serviceData.filePath);
			} else {
				void this.createServiceDoc(serviceData.name);
			}
		});

		// Blueprint button
		const bpBtn = actions.createEl("span", { cls: "ft-nav-link" });
		const bpIcon = bpBtn.createSpan();
		setIcon(bpIcon, "clipboard-list");
		const bpDocPath = getServiceBlueprintPath(this.docsRootPath, serviceData.name);
		const bpExists = !!this.app.vault.getAbstractFileByPath(bpDocPath);
		bpBtn.appendText(bpExists ? " Blueprint" : " Create Blueprint");
		bpBtn.addEventListener("click", () => {
			void this.createServiceBlueprint(serviceData.name);
		});

		// Delete button for documented services (file-based only)
		if (serviceData.filePath) {
			const delBtn = actions.createEl("button", { cls: "ft-btn ft-btn-ghost ft-text-sm" });
			delBtn.style.color = "var(--text-error)";
			const delIcon = delBtn.createSpan();
			setIcon(delIcon, "trash-2");
			delBtn.appendText(" Delete");
			delBtn.addEventListener("click", () => {
				new ConfirmModal(this.app, {
					message: `Delete service doc "${serviceData.name}"?`,
					confirmLabel: "Delete",
					onConfirm: () => {
						void this.deleteServiceDoc(serviceData.filePath!);
					},
				}).open();
			});
		}

		// Events list
		const section = this.detailPanelEl.createDiv({ cls: "ft-detail-section" });
		const sectionHeader = section.createDiv({ cls: "ft-detail-section-header" });
		sectionHeader.createSpan({
			text: `Events (${serviceData.events.length})`,
			cls: "ft-heading ft-heading-sm",
		});

		for (const entry of serviceData.events) {
			const row = section.createDiv({ cls: "ft-catalog-row" });
			row.style.cursor = "pointer";

			row.createSpan({ text: entry.type, cls: "ft-event-type" });
			row.createSpan({ text: entry.category, cls: "ft-catalog-meta" });

			row.addEventListener("click", () => {
				this.navigateToEvent(entry.type);
			});
		}

		// Related entities
		const criteria = { services: [serviceData.name] };
		this.renderRelatedSection(this.detailPanelEl, "Related Flows",
			this.findRelatedFlows(criteria).map((f) => ({ name: f.name, onClick: () => this.navigateToFlow(f.name) })));
		this.renderRelatedSection(this.detailPanelEl, "Related Systems",
			this.findRelatedSystems(criteria).map((s) => ({ name: s.name, onClick: () => this.navigateToSystem(s.name) })));
		this.renderRelatedSection(this.detailPanelEl, "Related Actors",
			this.findRelatedActors(criteria).map((a) => ({ name: a.name, onClick: () => this.navigateToActor(a.name) })));
	}

	private renderServiceDetailEmpty(): void {
		const empty = this.detailPanelEl.createDiv({ cls: "ft-catalog-detail-empty" });

		const icon = empty.createDiv();
		setIcon(icon, "server");
		icon.style.opacity = "0.3";

		empty.createEl("p", { text: "Select a service to view details" });

		const stats = empty.createDiv({ cls: "ft-catalog-quick-stats" });
		this.renderStat(stats, `${this.serviceEntries.length}`, "services");
		const totalEvents = this.serviceEntries.reduce((sum, s) => sum + s.events.length, 0);
		this.renderStat(stats, `${totalEvents}`, "events");
		const totalConfigured = this.serviceEntries.reduce((sum, s) => sum + s.configuredCount, 0);
		this.renderStat(stats, `${totalConfigured}`, "configured");
	}

	// ─────────────────────────────────────────────────────────────
	// Category scan (enriches Events tab)
	// ─────────────────────────────────────────────────────────────

	private scanCategories(): void {
		const allEntries = [...EVENT_CATALOG, ...this.discoveredToCatalogEntries()];
		const categoryMap = new Map<string, EventCatalogEntry[]>();

		for (const entry of allEntries) {
			const list = categoryMap.get(entry.category) ?? [];
			list.push(entry);
			categoryMap.set(entry.category, list);
		}

		// Scan folder for documented categories
		const categoriesFolder = getCategoriesFolderPath(this.docsRootPath);
		const folder = this.app.vault.getAbstractFileByPath(categoriesFolder);
		const fileMap = new Map<string, { filePath: string; description: string; domains: string[]; services: string[] }>();

		if (folder && folder instanceof TFolder) {
			for (const child of folder.children) {
				if (!(child instanceof TFile) || child.extension !== "md") continue;

				const fm = this.readFrontmatter(child.path);
				const name = (fm && (this.fmString(fm, "category")
					?? this.fmString(fm, "name"))) ?? child.basename;
				const description = (fm && this.fmString(fm, "description")) ?? "";
				const domains = this.fmStringArray(fm, "domains");
				const services = this.fmStringArray(fm, "services");

				fileMap.set(name, { filePath: child.path, description, domains, services });

				if (!categoryMap.has(name)) categoryMap.set(name, []);

				if (!fm || fm.type !== "CategoryDoc") {
					this.normalizeDocFrontmatter(child, "CategoryDoc", "category", name, { description, domains, services });
				}
			}
		}

		// Merge with catalogCategories settings for visibility/order
		const orderedCategories = this.getOrderedCategories();
		const visibilityMap = new Map(orderedCategories.map((c) => [c.name, c.visible]));

		this.categoryEntries = Array.from(categoryMap.entries())
			.map(([name, events]) => {
				const fileData = fileMap.get(name);
				return {
					name,
					description: fileData?.description ?? "",
					events,
					domains: fileData?.domains.length
						? fileData.domains
						: [...new Set(events.map((e) => e.domain))].sort(),
					services: fileData?.services.length
						? fileData.services
						: [...new Set(events.map((e) => e.services))].sort(),
					filePath: fileData?.filePath ?? null,
					visible: visibilityMap.get(name) ?? true,
				};
			})
			.sort((a, b) => {
				// Sort by settings order first (those in orderedCategories), then alphabetically
				const aIdx = orderedCategories.findIndex((c) => c.name === a.name);
				const bIdx = orderedCategories.findIndex((c) => c.name === b.name);
				if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
				if (aIdx !== -1) return -1;
				if (bIdx !== -1) return 1;
				return a.name.localeCompare(b.name);
			});
	}

	// ─────────────────────────────────────────────────────────────
	// Flows tab
	// ─────────────────────────────────────────────────────────────

	private scanFlows(): void {
		const flowsFolder = getFlowsFolderPath(this.docsRootPath);
		const folder = this.app.vault.getAbstractFileByPath(flowsFolder);

		if (!folder || !(folder instanceof TFolder)) {
			this.flowEntries = [];
			return;
		}

		const allEntries = [...EVENT_CATALOG, ...this.discoveredToCatalogEntries()];
		const entryMap = new Map(allEntries.map((e) => [e.type, e]));
		const entries: FlowEntry[] = [];

		for (const child of folder.children) {
			if (!(child instanceof TFile) || child.extension !== "md") continue;

			const fm = this.readFrontmatter(child.path);

			const name = (fm && (this.fmString(fm, "flow")
				?? this.fmString(fm, "trigger")
				?? this.fmString(fm, "name"))) ?? child.basename;
			const description = (fm && this.fmString(fm, "description")) ?? "";
			const events = this.fmStringArray(fm, "events");
			const domains = this.fmStringArray(fm, "domains");
			const services = [
				...this.fmStringArray(fm, "services"),
				...this.fmStringArray(fm, "Systems"),
			];

			const resolvedEvents = events
				.map((t) => entryMap.get(t))
				.filter((e): e is EventCatalogEntry => e !== undefined);

			entries.push({ name, description, events, domains, services, filePath: child.path, resolvedEvents });

			if (!fm || fm.type !== "FlowDoc") {
				this.normalizeDocFrontmatter(child, "FlowDoc", "flow", name, { description, events, domains, services });
			}
		}

		this.flowEntries = entries.sort((a, b) => a.name.localeCompare(b.name));
	}

	private renderFlowMaster(): void {
		this.scanFlows();
		this.masterTreeEl.empty();

		let flows = this.flowEntries;

		if (this.filterText) {
			flows = flows.filter(
				(f) =>
					f.name.toLowerCase().includes(this.filterText) ||
					f.description.toLowerCase().includes(this.filterText) ||
					f.events.some((e) => e.toLowerCase().includes(this.filterText)) ||
					f.domains.some((d) => d.toLowerCase().includes(this.filterText)) ||
					f.services.some((svc) => svc.toLowerCase().includes(this.filterText))
			);
		}

		// Header with add button
		const header = this.masterTreeEl.createDiv({ cls: "ft-master-category-header" });
		header.createSpan({ text: "Flows" });
		const addBtn = header.createSpan({ cls: "ft-visibility-toggle" });
		addBtn.style.marginLeft = "auto";
		setIcon(addBtn, "plus");
		addBtn.setAttribute("aria-label", "Create new flow");
		addBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			new InputModal(this.app, {
				title: "Create New Flow",
				placeholder: "My Flow",
				submitLabel: "Create",
				inputName: "Flow name",
				inputDesc: "A name for this flow",
				onSubmit: (name) => {
					void this.createFlowDoc(name);
				},
			}).open();
		});

		for (const f of flows) {
			const isSelected = this.selectedFlow === f.name;
			const item = this.masterTreeEl.createDiv({
				cls: `ft-master-event-item${isSelected ? " ft-master-event-selected" : ""}`,
			});

			const iconEl = item.createSpan();
			setIcon(iconEl, "git-branch");
			iconEl.style.opacity = "0.5";
			iconEl.style.flexShrink = "0";

			item.createSpan({ text: f.name, cls: "ft-master-event-name" });

			item.createSpan({
				text: `${f.resolvedEvents.length}`,
				cls: "ft-master-category-count",
			});

			item.addEventListener("click", () => {
				this.selectedFlow = f.name;
				this.renderFlowMaster();
				this.renderFlowDetail();
			});
		}
	}

	private renderFlowDetail(): void {
		this.detailPanelEl.empty();

		if (!this.selectedFlow) {
			this.renderFlowDetailEmpty();
			return;
		}

		const flowData = this.flowEntries.find((f) => f.name === this.selectedFlow);
		if (!flowData) {
			this.renderFlowDetailEmpty();
			return;
		}

		// Header
		const header = this.detailPanelEl.createDiv({ cls: "ft-detail-header" });
		const left = header.createDiv();
		left.createDiv({ text: flowData.name, cls: "ft-detail-event-type" });
		const badges = left.createDiv({ cls: "ft-flex ft-gap-1 ft-mt-1" });
		badges.createSpan({ text: `${flowData.events.length} events`, cls: "ft-badge ft-badge-muted" });
		badges.createSpan({ text: `${flowData.domains.length} domains`, cls: "ft-badge ft-badge-muted" });
		badges.createSpan({ text: `${flowData.services.length} services`, cls: "ft-badge ft-badge-muted" });

		// Description
		if (flowData.description) {
			const descCard = this.detailPanelEl.createDiv({ cls: "ft-card ft-mt-2" });
			descCard.createEl("p", {
				text: flowData.description,
				cls: "ft-text-muted ft-text-sm",
			});
		}

		// Info card
		const card = this.detailPanelEl.createDiv({ cls: "ft-card ft-mt-2" });
		const grid = card.createDiv({ cls: "ft-detail-info-grid" });

		// Domains — clickable
		grid.createDiv({ text: "Domains", cls: "ft-detail-info-label" });
		const domVal = grid.createDiv({ cls: "ft-detail-info-value ft-flex ft-gap-1" });
		if (flowData.domains.length > 0) {
			for (const dom of flowData.domains) {
				const domLink = domVal.createEl("span", { text: dom, cls: "ft-nav-link" });
				domLink.addEventListener("click", () => this.navigateToDomain(dom));
			}
		} else {
			domVal.createSpan({ text: "(none)", cls: "ft-text-muted" });
		}

		// Services — clickable
		grid.createDiv({ text: "Services", cls: "ft-detail-info-label" });
		const svcVal = grid.createDiv({ cls: "ft-detail-info-value ft-flex ft-gap-1" });
		if (flowData.services.length > 0) {
			for (const svc of flowData.services) {
				const svcLink = svcVal.createEl("span", { text: svc, cls: "ft-nav-link" });
				svcLink.addEventListener("click", () => this.navigateToService(svc));
			}
		} else {
			svcVal.createSpan({ text: "(none)", cls: "ft-text-muted" });
		}

		// Actions
		const actions = this.detailPanelEl.createDiv({ cls: "ft-detail-actions" });

		// Open doc file
		const docBtn = actions.createEl("span", { cls: "ft-nav-link" });
		const docIcon = docBtn.createSpan();
		setIcon(docIcon, "file-text");
		docBtn.appendText(" Open Doc");
		docBtn.addEventListener("click", () => {
			void this.openFile(flowData.filePath);
		});

		// Delete flow
		const delBtn = actions.createEl("button", { cls: "ft-btn ft-btn-ghost ft-text-sm" });
		delBtn.style.color = "var(--text-error)";
		const delIcon = delBtn.createSpan();
		setIcon(delIcon, "trash-2");
		delBtn.appendText(" Delete");
		delBtn.addEventListener("click", () => {
			new ConfirmModal(this.app, {
				message: `Delete flow "${flowData.name}" and its doc file?`,
				confirmLabel: "Delete",
				onConfirm: () => {
					void this.deleteFlowDoc(flowData.filePath);
				},
			}).open();
		});

		// Events list
		const section = this.detailPanelEl.createDiv({ cls: "ft-detail-section" });
		const sectionHeader = section.createDiv({ cls: "ft-detail-section-header" });
		sectionHeader.createSpan({
			text: `Events (${flowData.events.length})`,
			cls: "ft-heading ft-heading-sm",
		});

		for (const eventType of flowData.events) {
			const resolved = flowData.resolvedEvents.find((e) => e.type === eventType);
			const row = section.createDiv({ cls: "ft-catalog-row" });
			row.createSpan({ text: eventType, cls: "ft-event-type" });
			if (resolved) {
				row.style.cursor = "pointer";
				row.createSpan({ text: resolved.category, cls: "ft-catalog-meta" });
				row.addEventListener("click", () => {
					this.navigateToEvent(eventType);
				});
			} else {
				row.createSpan({ text: "unresolved", cls: "ft-catalog-meta ft-text-muted" });
			}
		}

		// Related entities
		const flowCriteria = { events: flowData.events, domains: flowData.domains, services: flowData.services };
		this.renderRelatedSection(this.detailPanelEl, "Related Systems",
			this.findRelatedSystems(flowCriteria).map((s) => ({ name: s.name, onClick: () => this.navigateToSystem(s.name) })));
		this.renderRelatedSection(this.detailPanelEl, "Related Actors",
			this.findRelatedActors(flowCriteria).map((a) => ({ name: a.name, onClick: () => this.navigateToActor(a.name) })));
	}

	private renderFlowDetailEmpty(): void {
		const empty = this.detailPanelEl.createDiv({ cls: "ft-catalog-detail-empty" });

		const icon = empty.createDiv();
		setIcon(icon, "git-branch");
		icon.style.opacity = "0.3";

		empty.createEl("p", { text: "Select a flow to view details" });

		const stats = empty.createDiv({ cls: "ft-catalog-quick-stats" });
		this.renderStat(stats, `${this.flowEntries.length}`, "flows");
		const totalEvents = this.flowEntries.reduce((sum, f) => sum + f.events.length, 0);
		this.renderStat(stats, `${totalEvents}`, "events");
		const totalDomains = new Set(this.flowEntries.flatMap((f) => f.domains)).size;
		this.renderStat(stats, `${totalDomains}`, "domains");
	}

	private async createFlowDoc(name: string): Promise<void> {
		const docPath = getFlowDocPath(this.docsRootPath, name);

		const existing = this.app.vault.getAbstractFileByPath(docPath);
		if (existing) {
			if (existing instanceof TFile) {
				const leaf = this.app.workspace.getLeaf(false);
				await leaf.openFile(existing);
			}
			return;
		}

		const content = generateFlowDocContent(name);
		try {
			await this.fileSystemClient.createFile(docPath, content, { createFolders: true });
		} catch (err) {
			console.error(`[Flowti] Failed to create flow doc: ${docPath}`, err);
			return;
		}

		this.selectedFlow = name;
		// Delay render to let metadataCache index the new file's frontmatter
		setTimeout(() => this.scheduleRender(), 500);
	}

	private async deleteFlowDoc(filePath: string): Promise<void> {
		try {
			await this.fileSystemClient.deleteFile(filePath);
		} catch (err) {
			console.error(`[Flowti] Failed to delete flow doc: ${filePath}`, err);
			return;
		}

		this.selectedFlow = null;
		this.scheduleRender();
	}

	// ─────────────────────────────────────────────────────────────
	// Systems tab
	// ─────────────────────────────────────────────────────────────

	private scanSystems(): void {
		const systemsFolder = getSystemsFolderPath(this.docsRootPath);
		const folder = this.app.vault.getAbstractFileByPath(systemsFolder);

		if (!folder || !(folder instanceof TFolder)) {
			this.systemEntries = [];
			return;
		}

		const allEntries = [...EVENT_CATALOG, ...this.discoveredToCatalogEntries()];
		const entries: SystemEntry[] = [];

		for (const child of folder.children) {
			if (!(child instanceof TFile) || child.extension !== "md") continue;

			const fm = this.readFrontmatter(child.path);

			const name = (fm && (this.fmString(fm, "system")
				?? this.fmString(fm, "name"))) ?? child.basename;
			const description = (fm && this.fmString(fm, "description")) ?? "";
			const domains = [
				...this.fmStringArray(fm, "domains"),
				...this.fmStringArray(fm, "Domains"),
			];
			const services = [
				...this.fmStringArray(fm, "services"),
				...this.fmStringArray(fm, "Systems"),
			];

			const domainSet = new Set(domains);
			const serviceSet = new Set(services);
			const events = allEntries.filter(
				(e) => domainSet.has(e.domain) || serviceSet.has(e.services)
			);

			entries.push({ name, description, domains, services, filePath: child.path, events });

			if (!fm || fm.type !== "SystemDoc") {
				this.normalizeDocFrontmatter(child, "SystemDoc", "system", name, { description, domains, services });
			}
		}

		this.systemEntries = entries.sort((a, b) => a.name.localeCompare(b.name));
	}

	private renderSystemMaster(): void {
		this.scanSystems();
		this.masterTreeEl.empty();

		let systems = this.systemEntries;

		if (this.filterText) {
			systems = systems.filter(
				(s) =>
					s.name.toLowerCase().includes(this.filterText) ||
					s.description.toLowerCase().includes(this.filterText) ||
					s.domains.some((d) => d.toLowerCase().includes(this.filterText)) ||
					s.services.some((svc) => svc.toLowerCase().includes(this.filterText))
			);
		}

		// Header with add button
		const header = this.masterTreeEl.createDiv({ cls: "ft-master-category-header" });
		header.createSpan({ text: "Systems" });
		const addBtn = header.createSpan({ cls: "ft-visibility-toggle" });
		addBtn.style.marginLeft = "auto";
		setIcon(addBtn, "plus");
		addBtn.setAttribute("aria-label", "Create new system");
		addBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			new InputModal(this.app, {
				title: "Create New System",
				placeholder: "My System",
				submitLabel: "Create",
				inputName: "System name",
				inputDesc: "A name for this system",
				onSubmit: (name) => {
					void this.createSystemDoc(name);
				},
			}).open();
		});

		for (const s of systems) {
			const isSelected = this.selectedSystem === s.name;
			const item = this.masterTreeEl.createDiv({
				cls: `ft-master-event-item${isSelected ? " ft-master-event-selected" : ""}`,
			});

			const iconEl = item.createSpan();
			setIcon(iconEl, "layout-grid");
			iconEl.style.opacity = "0.5";
			iconEl.style.flexShrink = "0";

			item.createSpan({ text: s.name, cls: "ft-master-event-name" });

			item.createSpan({
				text: `${s.events.length}`,
				cls: "ft-master-category-count",
			});

			item.addEventListener("click", () => {
				this.selectedSystem = s.name;
				this.renderSystemMaster();
				this.renderSystemDetail();
			});
		}
	}

	private renderSystemDetail(): void {
		this.detailPanelEl.empty();

		if (!this.selectedSystem) {
			this.renderSystemDetailEmpty();
			return;
		}

		const systemData = this.systemEntries.find((s) => s.name === this.selectedSystem);
		if (!systemData) {
			this.renderSystemDetailEmpty();
			return;
		}

		// Header
		const header = this.detailPanelEl.createDiv({ cls: "ft-detail-header" });
		const left = header.createDiv();
		left.createDiv({ text: systemData.name, cls: "ft-detail-event-type" });
		const badges = left.createDiv({ cls: "ft-flex ft-gap-1 ft-mt-1" });
		badges.createSpan({ text: `${systemData.events.length} events`, cls: "ft-badge ft-badge-muted" });
		badges.createSpan({ text: `${systemData.domains.length} domains`, cls: "ft-badge ft-badge-muted" });
		badges.createSpan({ text: `${systemData.services.length} services`, cls: "ft-badge ft-badge-muted" });

		// Description
		if (systemData.description) {
			const descCard = this.detailPanelEl.createDiv({ cls: "ft-card ft-mt-2" });
			descCard.createEl("p", {
				text: systemData.description,
				cls: "ft-text-muted ft-text-sm",
			});
		}

		// Info card
		const card = this.detailPanelEl.createDiv({ cls: "ft-card ft-mt-2" });
		const grid = card.createDiv({ cls: "ft-detail-info-grid" });

		// Domains — clickable
		grid.createDiv({ text: "Domains", cls: "ft-detail-info-label" });
		const domVal = grid.createDiv({ cls: "ft-detail-info-value ft-flex ft-gap-1" });
		if (systemData.domains.length > 0) {
			for (const dom of systemData.domains) {
				const domLink = domVal.createEl("span", { text: dom, cls: "ft-nav-link" });
				domLink.addEventListener("click", () => this.navigateToDomain(dom));
			}
		} else {
			domVal.createSpan({ text: "(none)", cls: "ft-text-muted" });
		}

		// Services — clickable
		grid.createDiv({ text: "Services", cls: "ft-detail-info-label" });
		const svcVal = grid.createDiv({ cls: "ft-detail-info-value ft-flex ft-gap-1" });
		if (systemData.services.length > 0) {
			for (const svc of systemData.services) {
				const svcLink = svcVal.createEl("span", { text: svc, cls: "ft-nav-link" });
				svcLink.addEventListener("click", () => this.navigateToService(svc));
			}
		} else {
			svcVal.createSpan({ text: "(none)", cls: "ft-text-muted" });
		}

		// Actions
		const actions = this.detailPanelEl.createDiv({ cls: "ft-detail-actions" });

		// Open doc file
		const docBtn = actions.createEl("span", { cls: "ft-nav-link" });
		const docIcon = docBtn.createSpan();
		setIcon(docIcon, "file-text");
		docBtn.appendText(" Open Doc");
		docBtn.addEventListener("click", () => {
			void this.openFile(systemData.filePath);
		});

		// Delete system
		const delBtn = actions.createEl("button", { cls: "ft-btn ft-btn-ghost ft-text-sm" });
		delBtn.style.color = "var(--text-error)";
		const delIcon = delBtn.createSpan();
		setIcon(delIcon, "trash-2");
		delBtn.appendText(" Delete");
		delBtn.addEventListener("click", () => {
			new ConfirmModal(this.app, {
				message: `Delete system "${systemData.name}" and its doc file?`,
				confirmLabel: "Delete",
				onConfirm: () => {
					void this.deleteSystemDoc(systemData.filePath);
				},
			}).open();
		});

		// Events list
		const section = this.detailPanelEl.createDiv({ cls: "ft-detail-section" });
		const sectionHeader = section.createDiv({ cls: "ft-detail-section-header" });
		sectionHeader.createSpan({
			text: `Events (${systemData.events.length})`,
			cls: "ft-heading ft-heading-sm",
		});

		for (const entry of systemData.events) {
			const row = section.createDiv({ cls: "ft-catalog-row" });
			row.style.cursor = "pointer";
			row.createSpan({ text: entry.type, cls: "ft-event-type" });
			row.createSpan({ text: entry.category, cls: "ft-catalog-meta" });
			row.addEventListener("click", () => {
				this.navigateToEvent(entry.type);
			});
		}

		// Related entities
		const sysCriteria = { domains: systemData.domains, services: systemData.services };
		this.renderRelatedSection(this.detailPanelEl, "Related Flows",
			this.findRelatedFlows(sysCriteria).map((f) => ({ name: f.name, onClick: () => this.navigateToFlow(f.name) })));
		this.renderRelatedSection(this.detailPanelEl, "Related Actors",
			this.findRelatedActors(sysCriteria).map((a) => ({ name: a.name, onClick: () => this.navigateToActor(a.name) })));
	}

	private renderSystemDetailEmpty(): void {
		const empty = this.detailPanelEl.createDiv({ cls: "ft-catalog-detail-empty" });

		const icon = empty.createDiv();
		setIcon(icon, "layout-grid");
		icon.style.opacity = "0.3";

		empty.createEl("p", { text: "Select a system to view details" });

		const stats = empty.createDiv({ cls: "ft-catalog-quick-stats" });
		this.renderStat(stats, `${this.systemEntries.length}`, "systems");
		const totalEvents = this.systemEntries.reduce((sum, s) => sum + s.events.length, 0);
		this.renderStat(stats, `${totalEvents}`, "events");
		const totalDomains = new Set(this.systemEntries.flatMap((s) => s.domains)).size;
		this.renderStat(stats, `${totalDomains}`, "domains");
	}

	private async createSystemDoc(name: string): Promise<void> {
		const docPath = getSystemDocPath(this.docsRootPath, name);

		const existing = this.app.vault.getAbstractFileByPath(docPath);
		if (existing) {
			if (existing instanceof TFile) {
				const leaf = this.app.workspace.getLeaf(false);
				await leaf.openFile(existing);
			}
			return;
		}

		const content = generateSystemDocContent(name);
		try {
			await this.fileSystemClient.createFile(docPath, content, { createFolders: true });
		} catch (err) {
			console.error(`[Flowti] Failed to create system doc: ${docPath}`, err);
			return;
		}

		this.selectedSystem = name;
		// Delay render to let metadataCache index the new file's frontmatter
		setTimeout(() => this.scheduleRender(), 500);
	}

	private async deleteSystemDoc(filePath: string): Promise<void> {
		try {
			await this.fileSystemClient.deleteFile(filePath);
		} catch (err) {
			console.error(`[Flowti] Failed to delete system doc: ${filePath}`, err);
			return;
		}

		this.selectedSystem = null;
		this.scheduleRender();
	}

	// ─────────────────────────────────────────────────────────────
	// Actors tab
	// ─────────────────────────────────────────────────────────────

	private scanActors(): void {
		const actorsFolder = getActorsFolderPath(this.docsRootPath);
		const folder = this.app.vault.getAbstractFileByPath(actorsFolder);

		if (!folder || !(folder instanceof TFolder)) {
			this.actorEntries = [];
			return;
		}

		const allEntries = [...EVENT_CATALOG, ...this.discoveredToCatalogEntries()];
		const entryMap = new Map(allEntries.map((e) => [e.type, e]));
		const entries: ActorEntry[] = [];

		for (const child of folder.children) {
			if (!(child instanceof TFile) || child.extension !== "md") continue;

			const fm = this.readFrontmatter(child.path);

			const name = (fm && (this.fmString(fm, "actor")
				?? this.fmString(fm, "name"))) ?? child.basename;
			const description = (fm && this.fmString(fm, "description")) ?? "";
			const events = this.fmStringArray(fm, "events");
			const domains = this.fmStringArray(fm, "domains");
			const services = [
				...this.fmStringArray(fm, "services"),
				...this.fmStringArray(fm, "Systems"),
			];

			const resolvedEvents = events
				.map((t) => entryMap.get(t))
				.filter((e): e is EventCatalogEntry => e !== undefined);

			entries.push({ name, description, events, domains, services, filePath: child.path, resolvedEvents });

			if (!fm || fm.type !== "ActorDoc") {
				this.normalizeDocFrontmatter(child, "ActorDoc", "actor", name, { description, events, domains, services });
			}
		}

		this.actorEntries = entries.sort((a, b) => a.name.localeCompare(b.name));
	}

	private renderActorMaster(): void {
		this.scanActors();
		this.masterTreeEl.empty();

		let actors = this.actorEntries;

		if (this.filterText) {
			actors = actors.filter(
				(p) =>
					p.name.toLowerCase().includes(this.filterText) ||
					p.description.toLowerCase().includes(this.filterText) ||
					p.events.some((e) => e.toLowerCase().includes(this.filterText)) ||
					p.domains.some((d) => d.toLowerCase().includes(this.filterText)) ||
					p.services.some((svc) => svc.toLowerCase().includes(this.filterText))
			);
		}

		// Header with add button
		const header = this.masterTreeEl.createDiv({ cls: "ft-master-category-header" });
		header.createSpan({ text: "Actors" });
		const addBtn = header.createSpan({ cls: "ft-visibility-toggle" });
		addBtn.style.marginLeft = "auto";
		setIcon(addBtn, "plus");
		addBtn.setAttribute("aria-label", "Create new actor");
		addBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			new InputModal(this.app, {
				title: "Create New Actor",
				placeholder: "My Actor",
				submitLabel: "Create",
				inputName: "Actor name",
				inputDesc: "A name for this actor",
				onSubmit: (name) => {
					void this.createActorDoc(name);
				},
			}).open();
		});

		for (const p of actors) {
			const isSelected = this.selectedActor === p.name;
			const item = this.masterTreeEl.createDiv({
				cls: `ft-master-event-item${isSelected ? " ft-master-event-selected" : ""}`,
			});

			const iconEl = item.createSpan();
			setIcon(iconEl, "users");
			iconEl.style.opacity = "0.5";
			iconEl.style.flexShrink = "0";

			item.createSpan({ text: p.name, cls: "ft-master-event-name" });

			item.createSpan({
				text: `${p.resolvedEvents.length}`,
				cls: "ft-master-category-count",
			});

			item.addEventListener("click", () => {
				this.selectedActor = p.name;
				this.renderActorMaster();
				this.renderActorDetail();
			});
		}
	}

	private renderActorDetail(): void {
		this.detailPanelEl.empty();

		if (!this.selectedActor) {
			this.renderActorDetailEmpty();
			return;
		}

		const actorData = this.actorEntries.find((p) => p.name === this.selectedActor);
		if (!actorData) {
			this.renderActorDetailEmpty();
			return;
		}

		// Header
		const header = this.detailPanelEl.createDiv({ cls: "ft-detail-header" });
		const left = header.createDiv();
		left.createDiv({ text: actorData.name, cls: "ft-detail-event-type" });
		const badges = left.createDiv({ cls: "ft-flex ft-gap-1 ft-mt-1" });
		badges.createSpan({ text: `${actorData.events.length} events`, cls: "ft-badge ft-badge-muted" });
		badges.createSpan({ text: `${actorData.domains.length} domains`, cls: "ft-badge ft-badge-muted" });
		badges.createSpan({ text: `${actorData.services.length} services`, cls: "ft-badge ft-badge-muted" });

		// Description
		if (actorData.description) {
			const descCard = this.detailPanelEl.createDiv({ cls: "ft-card ft-mt-2" });
			descCard.createEl("p", {
				text: actorData.description,
				cls: "ft-text-muted ft-text-sm",
			});
		}

		// Info card
		const card = this.detailPanelEl.createDiv({ cls: "ft-card ft-mt-2" });
		const grid = card.createDiv({ cls: "ft-detail-info-grid" });

		// Domains — clickable
		grid.createDiv({ text: "Domains", cls: "ft-detail-info-label" });
		const domVal = grid.createDiv({ cls: "ft-detail-info-value ft-flex ft-gap-1" });
		if (actorData.domains.length > 0) {
			for (const dom of actorData.domains) {
				const domLink = domVal.createEl("span", { text: dom, cls: "ft-nav-link" });
				domLink.addEventListener("click", () => this.navigateToDomain(dom));
			}
		} else {
			domVal.createSpan({ text: "(none)", cls: "ft-text-muted" });
		}

		// Services — clickable
		grid.createDiv({ text: "Services", cls: "ft-detail-info-label" });
		const svcVal = grid.createDiv({ cls: "ft-detail-info-value ft-flex ft-gap-1" });
		if (actorData.services.length > 0) {
			for (const svc of actorData.services) {
				const svcLink = svcVal.createEl("span", { text: svc, cls: "ft-nav-link" });
				svcLink.addEventListener("click", () => this.navigateToService(svc));
			}
		} else {
			svcVal.createSpan({ text: "(none)", cls: "ft-text-muted" });
		}

		// Actions
		const actions = this.detailPanelEl.createDiv({ cls: "ft-detail-actions" });

		// Open doc file
		const docBtn = actions.createEl("span", { cls: "ft-nav-link" });
		const docIcon = docBtn.createSpan();
		setIcon(docIcon, "file-text");
		docBtn.appendText(" Open Doc");
		docBtn.addEventListener("click", () => {
			void this.openFile(actorData.filePath);
		});

		// Delete actor
		const delBtn = actions.createEl("button", { cls: "ft-btn ft-btn-ghost ft-text-sm" });
		delBtn.style.color = "var(--text-error)";
		const delIcon = delBtn.createSpan();
		setIcon(delIcon, "trash-2");
		delBtn.appendText(" Delete");
		delBtn.addEventListener("click", () => {
			new ConfirmModal(this.app, {
				message: `Delete actor "${actorData.name}" and its doc file?`,
				confirmLabel: "Delete",
				onConfirm: () => {
					void this.deleteActorDoc(actorData.filePath);
				},
			}).open();
		});

		// Events list
		const section = this.detailPanelEl.createDiv({ cls: "ft-detail-section" });
		const sectionHeader = section.createDiv({ cls: "ft-detail-section-header" });
		sectionHeader.createSpan({
			text: `Events (${actorData.events.length})`,
			cls: "ft-heading ft-heading-sm",
		});

		for (const eventType of actorData.events) {
			const resolved = actorData.resolvedEvents.find((e) => e.type === eventType);
			const row = section.createDiv({ cls: "ft-catalog-row" });
			row.createSpan({ text: eventType, cls: "ft-event-type" });
			if (resolved) {
				row.style.cursor = "pointer";
				row.createSpan({ text: resolved.category, cls: "ft-catalog-meta" });
				row.addEventListener("click", () => {
					this.navigateToEvent(eventType);
				});
			} else {
				row.createSpan({ text: "unresolved", cls: "ft-catalog-meta ft-text-muted" });
			}
		}

		// Related entities
		const actorCriteria = { events: actorData.events, domains: actorData.domains, services: actorData.services };
		this.renderRelatedSection(this.detailPanelEl, "Related Flows",
			this.findRelatedFlows(actorCriteria).map((f) => ({ name: f.name, onClick: () => this.navigateToFlow(f.name) })));
		this.renderRelatedSection(this.detailPanelEl, "Related Systems",
			this.findRelatedSystems(actorCriteria).map((s) => ({ name: s.name, onClick: () => this.navigateToSystem(s.name) })));
	}

	private renderActorDetailEmpty(): void {
		const empty = this.detailPanelEl.createDiv({ cls: "ft-catalog-detail-empty" });

		const icon = empty.createDiv();
		setIcon(icon, "users");
		icon.style.opacity = "0.3";

		empty.createEl("p", { text: "Select an actor to view details" });

		const stats = empty.createDiv({ cls: "ft-catalog-quick-stats" });
		this.renderStat(stats, `${this.actorEntries.length}`, "actors");
		const totalEvents = this.actorEntries.reduce((sum, p) => sum + p.events.length, 0);
		this.renderStat(stats, `${totalEvents}`, "events");
		const totalDomains = new Set(this.actorEntries.flatMap((p) => p.domains)).size;
		this.renderStat(stats, `${totalDomains}`, "domains");
	}

	private async createActorDoc(name: string): Promise<void> {
		const docPath = getActorDocPath(this.docsRootPath, name);

		const existing = this.app.vault.getAbstractFileByPath(docPath);
		if (existing) {
			if (existing instanceof TFile) {
				const leaf = this.app.workspace.getLeaf(false);
				await leaf.openFile(existing);
			}
			return;
		}

		const content = generateActorDocContent(name);
		try {
			await this.fileSystemClient.createFile(docPath, content, { createFolders: true });
		} catch (err) {
			console.error(`[Flowti] Failed to create actor doc: ${docPath}`, err);
			return;
		}

		this.selectedActor = name;
		// Delay render to let metadataCache index the new file's frontmatter
		setTimeout(() => this.scheduleRender(), 500);
	}

	private async deleteActorDoc(filePath: string): Promise<void> {
		try {
			await this.fileSystemClient.deleteFile(filePath);
		} catch (err) {
			console.error(`[Flowti] Failed to delete actor doc: ${filePath}`, err);
			return;
		}

		this.selectedActor = null;
		this.scheduleRender();
	}

	// ─────────────────────────────────────────────────────────────
	// Cross-reference helpers
	// ─────────────────────────────────────────────────────────────

	private findRelatedFlows(criteria: {
		events?: string[];
		domains?: string[];
		services?: string[];
	}): FlowEntry[] {
		return this.flowEntries.filter((f) => {
			if (criteria.events?.length && f.events.some((e) => criteria.events!.includes(e))) return true;
			if (criteria.domains?.length && f.domains.some((d) => criteria.domains!.includes(d))) return true;
			if (criteria.services?.length && f.services.some((s) => criteria.services!.includes(s))) return true;
			return false;
		});
	}

	private findRelatedSystems(criteria: {
		events?: string[];
		domains?: string[];
		services?: string[];
	}): SystemEntry[] {
		return this.systemEntries.filter((s) => {
			if (criteria.events?.length && s.events.some((e) => criteria.events!.includes(e.type))) return true;
			if (criteria.domains?.length && s.domains.some((d) => criteria.domains!.includes(d))) return true;
			if (criteria.services?.length && s.services.some((sv) => criteria.services!.includes(sv))) return true;
			return false;
		});
	}

	private findRelatedActors(criteria: {
		events?: string[];
		domains?: string[];
		services?: string[];
	}): ActorEntry[] {
		return this.actorEntries.filter((a) => {
			if (criteria.events?.length && a.events.some((e) => criteria.events!.includes(e))) return true;
			if (criteria.domains?.length && a.domains.some((d) => criteria.domains!.includes(d))) return true;
			if (criteria.services?.length && a.services.some((s) => criteria.services!.includes(s))) return true;
			return false;
		});
	}

	private renderRelatedSection(
		container: HTMLElement,
		heading: string,
		items: { name: string; onClick: () => void }[],
	): void {
		if (items.length === 0) return;
		const section = container.createDiv({ cls: "ft-detail-section" });
		const sectionHeader = section.createDiv({ cls: "ft-detail-section-header" });
		sectionHeader.createSpan({
			text: `${heading} (${items.length})`,
			cls: "ft-heading ft-heading-sm",
		});
		for (const item of items) {
			const row = section.createDiv({ cls: "ft-catalog-row" });
			row.style.cursor = "pointer";
			const link = row.createSpan({ text: item.name, cls: "ft-event-type" });
			link.addEventListener("click", item.onClick);
		}
	}

	// ─────────────────────────────────────────────────────────────
	// Cross-tab navigation
	// ─────────────────────────────────────────────────────────────

	private navigateToEvent(eventType: string): void {
		this.selectedEventType = eventType;
		this.activeTab = "events";
		// Ensure the event's category is expanded
		const entry = this.resolveEntry(eventType);
		if (entry && this.collapsedCategories.has(entry.category)) {
			this.collapsedCategories.delete(entry.category);
		}
		this.renderTabBar();
		this.onTabChanged();
	}

	private navigateToDomain(domain: string): void {
		this.selectedDomain = domain;
		this.activeTab = "domains";
		this.renderTabBar();
		this.onTabChanged();
	}

	private navigateToService(service: string): void {
		this.selectedService = service;
		this.activeTab = "services";
		this.renderTabBar();
		this.onTabChanged();
	}

	private navigateToFlow(flow: string): void {
		this.selectedFlow = flow;
		this.activeTab = "flows";
		this.renderTabBar();
		this.onTabChanged();
	}

	private navigateToSystem(system: string): void {
		this.selectedSystem = system;
		this.activeTab = "systems";
		this.renderTabBar();
		this.onTabChanged();
	}

	private navigateToActor(actor: string): void {
		this.selectedActor = actor;
		this.activeTab = "actors";
		this.renderTabBar();
		this.onTabChanged();
	}

	// ─────────────────────────────────────────────────────────────
	// Domain CRUD
	// ─────────────────────────────────────────────────────────────

	private async createDomainDoc(name: string): Promise<void> {
		const docPath = getDomainDocPath(this.docsRootPath, name);

		const existing = this.app.vault.getAbstractFileByPath(docPath);
		if (existing) {
			if (existing instanceof TFile) {
				const leaf = this.app.workspace.getLeaf(false);
				await leaf.openFile(existing);
			}
			return;
		}

		const domainEvents = this.domainEntries.find((d) => d.name === name)?.events ?? [];
		const content = generateDomainDocContent(name, domainEvents);
		try {
			await this.fileSystemClient.createFile(docPath, content, { createFolders: true });
		} catch (err) {
			console.error(`[Flowti] Failed to create domain doc: ${docPath}`, err);
			return;
		}

		this.selectedDomain = name;
		setTimeout(() => this.scheduleRender(), 500);
	}

	private async deleteDomainDoc(filePath: string): Promise<void> {
		try {
			await this.fileSystemClient.deleteFile(filePath);
		} catch (err) {
			console.error(`[Flowti] Failed to delete domain doc: ${filePath}`, err);
			return;
		}

		this.selectedDomain = null;
		this.scheduleRender();
	}

	private async createArchitectureDoc(name: string): Promise<void> {
		const docPath = getArchitectureDocPath(this.docsRootPath, name);

		const existing = this.app.vault.getAbstractFileByPath(docPath);
		if (existing) {
			if (existing instanceof TFile) {
				const leaf = this.app.workspace.getLeaf(false);
				await leaf.openFile(existing);
			}
			return;
		}

		const domainEvents = this.domainEntries.find((d) => d.name === name)?.events ?? [];
		const content = generateArchitectureDocContent(name, domainEvents);
		try {
			await this.fileSystemClient.createFile(docPath, content, { createFolders: true });
		} catch (err) {
			console.error(`[Flowti] Failed to create architecture doc: ${docPath}`, err);
			return;
		}

		this.selectedDomain = name;
		setTimeout(() => this.scheduleRender(), 500);
	}

	// ─────────────────────────────────────────────────────────────
	// Service CRUD
	// ─────────────────────────────────────────────────────────────

	private async createServiceDoc(name: string): Promise<void> {
		const docPath = getServiceDocPath(this.docsRootPath, name);

		const existing = this.app.vault.getAbstractFileByPath(docPath);
		if (existing) {
			if (existing instanceof TFile) {
				const leaf = this.app.workspace.getLeaf(false);
				await leaf.openFile(existing);
			}
			return;
		}

		const serviceEvents = this.serviceEntries.find((s) => s.name === name)?.events ?? [];
		const content = generateServiceDocContent(name, serviceEvents);
		try {
			await this.fileSystemClient.createFile(docPath, content, { createFolders: true });
		} catch (err) {
			console.error(`[Flowti] Failed to create service doc: ${docPath}`, err);
			return;
		}

		this.selectedService = name;
		setTimeout(() => this.scheduleRender(), 500);
	}

	private async deleteServiceDoc(filePath: string): Promise<void> {
		try {
			await this.fileSystemClient.deleteFile(filePath);
		} catch (err) {
			console.error(`[Flowti] Failed to delete service doc: ${filePath}`, err);
			return;
		}

		this.selectedService = null;
		this.scheduleRender();
	}

	private async createServiceBlueprint(name: string): Promise<void> {
		const docPath = getServiceBlueprintPath(this.docsRootPath, name);

		const existing = this.app.vault.getAbstractFileByPath(docPath);
		if (existing) {
			if (existing instanceof TFile) {
				const leaf = this.app.workspace.getLeaf(false);
				await leaf.openFile(existing);
			}
			return;
		}

		const serviceEvents = this.serviceEntries.find((s) => s.name === name)?.events ?? [];
		const content = generateServiceBlueprintContent(name, serviceEvents);
		try {
			await this.fileSystemClient.createFile(docPath, content, { createFolders: true });
		} catch (err) {
			console.error(`[Flowti] Failed to create service blueprint: ${docPath}`, err);
			return;
		}

		this.selectedService = name;
		setTimeout(() => this.scheduleRender(), 500);
	}

	// ─────────────────────────────────────────────────────────────
	// Category doc helpers
	// ─────────────────────────────────────────────────────────────

	private async openOrCreateCategoryDoc(category: string, events: EventCatalogEntry[]): Promise<void> {
		const docPath = getCategoryDocPath(this.docsRootPath, category);

		let file = this.app.vault.getAbstractFileByPath(docPath);

		if (!file) {
			const content = generateCategoryDocContent(category, events);
			try {
				await this.fileSystemClient.createFile(docPath, content, { createFolders: true });
			} catch (err) {
				console.error(`[Flowti] Failed to create category doc: ${docPath}`, err);
				return;
			}
			file = this.app.vault.getAbstractFileByPath(docPath);
		}

		if (file && file instanceof TFile) {
			const leaf = this.app.workspace.getLeaf(false);
			await leaf.openFile(file);
		}
	}
}
