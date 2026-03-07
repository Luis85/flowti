/**
 * Test Management Hub — central quality cockpit for journey-based testing.
 *
 * Dashboard shows KPI stat cards, mini pyramid, recent runs, and attention items.
 * Tabs: Journeys, Pyramid, Coverage, Compliance, Feature Quality, Features, Processes, Products.
 *
 * Shell lifecycle (wrapper, top bar, tab bar, split layout) is handled by BaseHubView.
 */

import type { WorkspaceLeaf } from "obsidian";
import type { IEventBus } from "../../infrastructure/events/types";
import type { TestManagementService } from "../../domain/testManagement/TestManagementService";
import type { OnboardingService } from "../../domain/onboarding/OnboardingService";
import type { JourneyStatus, JourneyType } from "../../domain/testManagement/types";
import type { FeatureLifecycleService } from "../../domain/featureLifecycle/FeatureLifecycleService";
import type { ProcessService } from "../../domain/process/ProcessService";
import type { HubRegistry } from "../../domain/hub/HubRegistry";
import type { FlowtiSettings, EntityPaths } from "../../domain/settings/settings";
import { DEFAULT_ENTITY_PATHS } from "../../domain/settings/settings";
import { createVaultQueryService, createWorkspaceService } from "../../infrastructure/services/ObsidianAdapters";
import { resolveEntityPath } from "../eventDocTemplate";
import type { CatalogComponentDeps, CatalogState } from "../catalog/types";
import { computeProcessCompliance } from "../../domain/process/complianceCalculator";
import { BaseHubView, type TabDef } from "../BaseHubView";
import { VIEW_TYPE_TEST_MANAGEMENT_HUB } from "../../domain/hub/types";
import { TestManagementDashboard } from "./TestManagementDashboard";
import { JourneysTab } from "./JourneysTab";
import { PyramidTab } from "./PyramidTab";
import { CoverageTab } from "./CoverageTab";
import { ComplianceTab } from "./ComplianceTab";
import { FeatureQualityTab } from "./FeatureQualityTab";
import { FeaturesTab } from "../catalog/FeaturesTab";
import { ProcessesTab } from "../catalog/ProcessesTab";
import { ProductsTab } from "../catalog/ProductsTab";
import { FlowsTab } from "../catalog/FlowsTab";
import { SystemsTab } from "../catalog/SystemsTab";
import { ActorsTab } from "../catalog/ActorsTab";
import type { FlowEntry, SystemEntry, ActorEntry, ProductEntry } from "../catalog/types";
export { VIEW_TYPE_TEST_MANAGEMENT_HUB };

export type TestMgmtPage = "journeys" | "pyramid" | "coverage" | "compliance" | "feature-quality" | "features" | "processes" | "products";

const JOURNEY_TYPES: JourneyType[] = ["functional", "regression", "smoke", "exploratory", "blueprint"];
const JOURNEY_STATUSES: JourneyStatus[] = ["passing", "failing", "never-run", "stale"];

export class TestManagementHubView extends BaseHubView<TestMgmtPage> {
	private testManagementService: TestManagementService;
	private onboardingService: OnboardingService;
	private dashboard: TestManagementDashboard;
	private journeysTab!: JourneysTab;
	private pyramidTab!: PyramidTab;
	private coverageTab!: CoverageTab;
	private complianceTab!: ComplianceTab;
	private featureQualityTab!: FeatureQualityTab;
	private featuresTab: FeaturesTab | null = null;
	private processesTab: ProcessesTab | null = null;
	private productsTab: ProductsTab | null = null;

	// Scanner instances for populating related sections in Products tab
	private flowScanner: FlowsTab | null = null;
	private systemScanner: SystemsTab | null = null;
	private actorScanner: ActorsTab | null = null;

	// Cached entity entries for CatalogState
	private flowEntries: FlowEntry[] = [];
	private systemEntries: SystemEntry[] = [];
	private actorEntries: ActorEntry[] = [];
	private productEntries: ProductEntry[] = [];

	// Optional services for Features + Processes tabs
	private featureLifecycleService: FeatureLifecycleService | null;
	private processService: ProcessService | null;
	private hubRegistry: HubRegistry | null;

	// Settings state for entity folder resolution
	private docsRootPath = "03 - Resources/Documentation/Reference";
	private entityPaths: EntityPaths = DEFAULT_ENTITY_PATHS;

	constructor(
		leaf: WorkspaceLeaf,
		eventBus: IEventBus,
		testManagementService: TestManagementService,
		onboardingService: OnboardingService,
		featureLifecycleService?: FeatureLifecycleService,
		processService?: ProcessService,
		hubRegistry?: HubRegistry,
		getSettings?: () => FlowtiSettings,
	) {
		super(leaf, eventBus);
		this.testManagementService = testManagementService;
		this.onboardingService = onboardingService;
		this.featureLifecycleService = featureLifecycleService ?? null;
		this.processService = processService ?? null;
		this.hubRegistry = hubRegistry ?? null;
		if (getSettings) {
			const s = getSettings();
			this.docsRootPath = s.docsRootPath;
			this.entityPaths = s.entityPaths ?? DEFAULT_ENTITY_PATHS;
		}
		this.dashboard = new TestManagementDashboard({
			testManagementService,
			navigateTo: (page) => this.navigateTo(page as TestMgmtPage),
		});
	}

	// ── Identity ────────────────────────────────────────────

	getViewType(): string { return VIEW_TYPE_TEST_MANAGEMENT_HUB; }
	getHubId(): string { return "test-management"; }
	getHubType(): "system" | "domain" | "user" { return "domain"; }
	getHubDisplayName(): string { return "Test Management"; }
	getHubIcon(): string { return "shield-check"; }

	// ── Tabs ────────────────────────────────────────────────

	getTabDefinitions(): TabDef[] {
		return [
			{ id: "journeys", label: "Journeys", icon: "route", searchPlaceholder: "Search journeys..." },
			{ id: "pyramid", label: "Pyramid", icon: "triangle", searchPlaceholder: "Search layers..." },
			{ id: "coverage", label: "Coverage", icon: "check-circle", searchPlaceholder: "Search PRDs..." },
			{ id: "compliance", label: "Compliance", icon: "shield", searchPlaceholder: "Search standards..." },
			{ id: "feature-quality", label: "Feature Quality", icon: "star", searchPlaceholder: "Search features..." },
			{ id: "features", label: "Features", icon: "sparkles", searchPlaceholder: "Search features..." },
			{ id: "processes", label: "Processes", icon: "waypoints", searchPlaceholder: "Search processes..." },
			{ id: "products", label: "Products", icon: "package", searchPlaceholder: "Search products..." },
		];
	}

	// ── Top bar actions ─────────────────────────────────────

	renderTopBarActions(bar: HTMLElement): void {
		if (this.getActivePage() !== "journeys") return;

		// Type filter
		const typeSelect = bar.createEl("select", { cls: "dropdown" });
		const typeAll = typeSelect.createEl("option", { text: "All types" });
		typeAll.value = "all";
		for (const t of JOURNEY_TYPES) {
			const opt = typeSelect.createEl("option", { text: t });
			opt.value = t;
		}
		typeSelect.addEventListener("change", () => {
			this.journeysTab.setFilters({ typeFilter: typeSelect.value as JourneyType | "all" });
			this.scheduleRender();
		});

		// Status filter
		const statusSelect = bar.createEl("select", { cls: "dropdown" });
		const statusAll = statusSelect.createEl("option", { text: "All statuses" });
		statusAll.value = "all";
		for (const s of JOURNEY_STATUSES) {
			const opt = statusSelect.createEl("option", { text: s });
			opt.value = s;
		}
		statusSelect.addEventListener("change", () => {
			this.journeysTab.setFilters({ statusFilter: statusSelect.value as JourneyStatus | "all" });
			this.scheduleRender();
		});
	}

	// ── Rendering ───────────────────────────────────────────

	onDashboardRender(): void {
		this.dashboard.render(this.dashboardEl);
	}

	onTabRender(tabId: TestMgmtPage): void {
		if (tabId === "journeys") {
			this.journeysTab.render(this.filterText);
			return;
		}
		if (tabId === "pyramid") {
			this.pyramidTab.render(this.filterText);
			return;
		}
		if (tabId === "coverage") {
			this.coverageTab.render(this.filterText);
			return;
		}
		if (tabId === "compliance") {
			this.complianceTab.render(this.filterText);
			return;
		}
		if (tabId === "feature-quality") {
			this.featureQualityTab.render(this.filterText);
			return;
		}
		if (tabId === "features") {
			this.featuresTab?.render();
			return;
		}
		if (tabId === "processes") {
			this.processesTab?.render();
			return;
		}
		if (tabId === "products") {
			// Scan related entities for "Related Flows/Systems/Actors" sections
			this.flowScanner?.scan();
			this.flowEntries = this.flowScanner?.getEntries() ?? [];
			this.systemScanner?.scan();
			this.systemEntries = this.systemScanner?.getEntries() ?? [];
			this.actorScanner?.scan();
			this.actorEntries = this.actorScanner?.getEntries() ?? [];
			this.productsTab?.render();
			this.productEntries = this.productsTab?.getEntries() ?? [];
			return;
		}
	}

	// ── Lifecycle ───────────────────────────────────────────

	onHubOpen(): void {
		// Create tab components now that shell elements are available
		this.journeysTab = new JourneysTab(this.masterTreeEl, this.detailPanelEl, {
			testManagementService: this.testManagementService,
			eventBus: this.eventBus,
		});
		this.pyramidTab = new PyramidTab(this.masterTreeEl, this.detailPanelEl, {
			testManagementService: this.testManagementService,
			eventBus: this.eventBus,
		});
		this.coverageTab = new CoverageTab(this.masterTreeEl, this.detailPanelEl, {
			testManagementService: this.testManagementService,
			eventBus: this.eventBus,
		});
		this.complianceTab = new ComplianceTab(this.masterTreeEl, this.detailPanelEl, {
			testManagementService: this.testManagementService,
			eventBus: this.eventBus,
		});
		this.featureQualityTab = new FeatureQualityTab(this.masterTreeEl, this.detailPanelEl, {
			testManagementService: this.testManagementService,
			eventBus: this.eventBus,
		});

		// Features + Processes tabs (from Event Catalog)
		const catalogDeps = this.buildCatalogDeps();
		this.featuresTab = new FeaturesTab(this.masterTreeEl, this.detailPanelEl, catalogDeps, {
			getFeatures: () => this.featureLifecycleService?.getFeatures() ?? [],
			getFeaturesByStage: () => this.featureLifecycleService?.getFeaturesByStage() ?? {
				idea: [], draft: [], approved: [], "in-progress": [], review: [], done: [],
			},
			onFeatureSelect: (name) => {
				this.featuresTab!.setSelectedFeature(name);
			},
			getProcessCompliance: (featureName) => {
				const feature = this.featureLifecycleService?.getFeatures().find((f) => f.name === featureName);
				if (!feature) return undefined;
				return computeProcessCompliance(feature);
			},
		});
		this.processesTab = new ProcessesTab(this.masterTreeEl, this.detailPanelEl, catalogDeps, {
			getProcesses: () => this.processService?.getProcesses() ?? [],
			validateProcess: (def) => this.processService?.validateProcess(def) ?? { findings: [], errorCount: 0, warningCount: 0, infoCount: 0, valid: true },
		});
		this.productsTab = new ProductsTab(this.masterTreeEl, this.detailPanelEl, catalogDeps);

		// Scanner instances for populating related sections in Products tab
		this.flowScanner = new FlowsTab(this.masterTreeEl, this.detailPanelEl, catalogDeps);
		this.systemScanner = new SystemsTab(this.masterTreeEl, this.detailPanelEl, catalogDeps);
		this.actorScanner = new ActorsTab(this.masterTreeEl, this.detailPanelEl, catalogDeps);

		this.renderOnboardingCallout(this.dashboardEl, this.onboardingService, {
			id: "test-management-welcome",
			icon: "shield-check",
			title: "Welcome to Test Management",
			description: "This hub tracks your journey-based testing: pass rates, coverage, compliance, and the test pyramid.",
			suggestion: "Register journeys from the Journey Builder to get started.",
		});

		// Re-render on domain events
		const events = [
			"test-mgmt.journey.registered",
			"test-mgmt.journey.deregistered",
			"test-mgmt.journey.run-completed",
			"test-mgmt.journey.status-changed",
		] as const;

		for (const event of events) {
			this.addUnsubscribe(
				this.eventBus.on(event, () => this.scheduleRender()),
			);
		}

		// Settings state for entity folder resolution
		this.addUnsubscribe(
			this.eventBus.on("settings.loaded", (event) => {
				this.docsRootPath = event.payload.settings.docsRootPath;
				this.entityPaths = event.payload.settings.entityPaths ?? DEFAULT_ENTITY_PATHS;
			}),
		);
		this.addUnsubscribe(
			this.eventBus.on("settings.changed", (event) => {
				this.docsRootPath = event.payload.settings.docsRootPath;
				this.entityPaths = event.payload.settings.entityPaths ?? DEFAULT_ENTITY_PATHS;
			}),
		);

		// Doc lifecycle — re-render after create/delete so scanned tabs pick up changes
		this.addUnsubscribe(
			this.eventBus.on("doc.created", () => {
				setTimeout(() => this.scheduleRender(), 500);
			}),
		);
		this.addUnsubscribe(
			this.eventBus.on("doc.deleted", () => {
				this.scheduleRender();
			}),
		);
	}

	onHubClose(): void {
		// Cleanup handled by BaseHubView via addUnsubscribe
	}

	protected onNavigateToEntity(tabId: string, entityId: string): void {
		if (tabId === "journeys" && this.journeysTab) {
			this.journeysTab.selectByName(entityId);
			this.scheduleRender();
		}
	}

	protected onTabChanged(): void {
		// Reset tab state when switching away
		if (this.getActivePage() !== "journeys" && this.journeysTab) {
			this.journeysTab.resetSelection();
		}
		if (this.getActivePage() !== "pyramid" && this.pyramidTab) {
			this.pyramidTab.resetSelection();
		}
		if (this.getActivePage() !== "coverage" && this.coverageTab) {
			this.coverageTab.resetSelection();
		}
		if (this.getActivePage() !== "compliance" && this.complianceTab) {
			this.complianceTab.resetSelection();
		}
		if (this.getActivePage() !== "feature-quality" && this.featureQualityTab) {
			this.featureQualityTab.resetSelection();
		}
		if (this.getActivePage() !== "features" && this.featuresTab) {
			this.featuresTab.setSelectedFeature(null);
		}
		if (this.getActivePage() !== "processes" && this.processesTab) {
			this.processesTab.setSelectedProcess(null);
		}
		if (this.getActivePage() !== "products" && this.productsTab) {
			this.productsTab.setSelectedProduct(null);
		}
	}

	// ── Catalog deps adapter ───────────────────────────────

	private buildCatalogDeps(): CatalogComponentDeps {
		return {
			app: this.app,
			vaultQuery: createVaultQueryService(this.app),
			workspace: createWorkspaceService(this.app),
			eventBus: this.eventBus,
			getState: () => this.buildCatalogState(),
			navigation: {
				navigateToTab: (tab) => this.navigateTo(tab as TestMgmtPage),
				navigateToEvent: (t) => void this.hubRegistry?.openHub("event-catalog", "events", t),
				navigateToDomain: (d) => void this.hubRegistry?.openHub("event-catalog", "domains", d),
				navigateToService: (s) => void this.hubRegistry?.openHub("event-catalog", "services", s),
				navigateToFlow: (f) => void this.hubRegistry?.openHub("event-catalog", "flows", f),
				navigateToSystem: (s) => void this.hubRegistry?.openHub("event-catalog", "systems", s),
				navigateToActor: (a) => void this.hubRegistry?.openHub("event-catalog", "actors", a),
				navigateToProduct: (p) => {
					this.productsTab?.setSelectedProduct(p);
					this.navigateTo("products");
				},
				openActivityLog: () => { /* no-op */ },
				openSubscriptionManager: () => { /* no-op */ },
			},
			scheduleRender: () => this.scheduleRender(),
			getEntityFolder: (entity) => resolveEntityPath(this.docsRootPath, this.entityPaths[entity]),
			createEntity: (entityType, name) => {
				if (entityType === "products" && this.productsTab) {
					void this.productsTab.createDoc(name);
				}
			},
		};
	}

	private buildCatalogState(): CatalogState {
		return {
			discoveredEvents: [],
			excludedTypes: new Set(),
			notifiedTypes: new Set(),
			subscriptions: [],
			definitions: [],
			domainEntries: [],
			serviceEntries: [],
			categoryEntries: [],
			flowEntries: this.flowEntries,
			systemEntries: this.systemEntries,
			actorEntries: this.actorEntries,
			productEntries: this.productEntries,
			catalogCategories: [],
			catalogDomains: [],
			catalogServices: [],
			showSystemEvents: false,
			collapsedCategories: new Set(),
			docsRootPath: this.docsRootPath,
			entityPaths: this.entityPaths,
			filterText: this.filterText,
		};
	}
}
