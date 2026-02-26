/**
 * Analytics Hub — dedicated view for analytics queries and dashboards.
 *
 * This is the orchestrator: it owns state, CSV scanning, and tab rendering.
 * Shell lifecycle (wrapper, top bar, tab bar, split layout) is handled by BaseHubView.
 */

import { type WorkspaceLeaf, setIcon } from "obsidian";
import type { IEventBus } from "../infrastructure/events/types";
import type { AnalyticsService } from "../domain/analytics/AnalyticsService";
import type { OnboardingService } from "../domain/onboarding/OnboardingService";
import { VIEW_TYPE_ANALYTICS_HUB } from "../domain/hub/types";
import { BaseHubView, type TabDef } from "./BaseHubView";
import { QueriesTab } from "./analytics/QueriesTab";
import { DashboardsTab } from "./analytics/DashboardsTab";
import { MeasurementsTab } from "./analytics/MeasurementsTab";
import { AnalyticsDashboardPage } from "./analytics/AnalyticsDashboardPage";
import { TileResultCache } from "./analytics/TileResultCache";
import { DashboardNameModal } from "./analytics/DashboardNameModal";
import { NewQueryModal } from "./analytics/NewQueryModal";
import type { AnalyticsHubPage, AnalyticsHubState, AnalyticsCsvEntry, AnalyticsBaseEntry, AnalyticsFolderEntry, AnalyticsHubDeps, AnalyticsNavigationCallbacks } from "./analytics/types";
export { VIEW_TYPE_ANALYTICS_HUB };

export class AnalyticsHubView extends BaseHubView<AnalyticsHubPage> {
	private analyticsService: AnalyticsService;
	private onboardingService: OnboardingService;

	// ── State ────────────────────────────────────────────────
	private queries: AnalyticsHubState["queries"] = [];
	private dashboards: AnalyticsHubState["dashboards"] = [];
	private csvFiles: AnalyticsCsvEntry[] = [];
	private baseFiles: AnalyticsBaseEntry[] = [];
	private csvFolders: AnalyticsFolderEntry[] = [];
	private measurements: AnalyticsHubState["measurements"] = [];
	private selectedQueryId: string | null = null;
	private selectedDashboardId: string | null = null;
	private selectedMeasurementId: string | null = null;
	private homepageDashboardId: string | null = null;
	private dashboardFilters: import("./analytics/types").DashboardFilter[] = [];
	private dateRangeFilter: import("../domain/analytics/types").DateRangeFilter | null = null;
	private crossTileFilter: import("../domain/analytics/types").CrossTileFilter | null = null;
	private pendingSourcePath: string | null = null;
	private pendingEntityId: string | null = null;
	private pendingNewQuery: AnalyticsHubState["pendingNewQuery"] = undefined;

	// ── Tab components ───────────────────────────────────────
	private tileResultCache = new TileResultCache();
	private dashboardPage!: AnalyticsDashboardPage;
	private queriesTab!: QueriesTab;
	private dashboardsTab!: DashboardsTab;
	private measurementsTab!: MeasurementsTab;

	constructor(
		leaf: WorkspaceLeaf,
		eventBus: IEventBus,
		analyticsService: AnalyticsService,
		onboardingService: OnboardingService,
	) {
		super(leaf, eventBus);
		this.analyticsService = analyticsService;
		this.onboardingService = onboardingService;
	}

	// ── BaseHubView abstract implementations ─────────────────

	getViewType(): string { return VIEW_TYPE_ANALYTICS_HUB; }
	getHubId(): string { return "analytics"; }
	getHubType(): "system" | "domain" | "user" { return "domain"; }
	getHubDisplayName(): string { return "Analytics Hub"; }
	getHubIcon(): string { return "bar-chart-2"; }

	getTabDefinitions(): TabDef[] {
		return [
			{ id: "dashboards", label: "Dashboards", icon: "layout-grid", searchPlaceholder: "Search dashboards..." },
			{ id: "measurements", label: "Measurements", icon: "ruler", searchPlaceholder: "Search measurements..." },
			{ id: "queries", label: "Queries", icon: "search", searchPlaceholder: "Search CSV sources..." },
		];
	}

	renderTopBarActions(bar: HTMLElement): void {
		const newQueryBtn = bar.createEl("span", { cls: "ft-nav-link ft-text-sm" });
		newQueryBtn.setAttribute("aria-label", "New Query");
		const qIcon = newQueryBtn.createSpan();
		setIcon(qIcon, "search");
		newQueryBtn.appendText(" New Query");
		newQueryBtn.addEventListener("click", () => {
			new NewQueryModal(this.app, {
				csvFiles: this.csvFiles,
				baseFiles: this.baseFiles,
				csvFolders: this.csvFolders,
				onConfirm: (name, sources) => {
					this.pendingNewQuery = { name, sources };
					this.navigateTo("queries");
					this.scheduleRender();
				},
			}).open();
		});

		const newDashBtn = bar.createEl("span", { cls: "ft-nav-link ft-text-sm" });
		newDashBtn.setAttribute("aria-label", "New Dashboard");
		const dIcon = newDashBtn.createSpan();
		setIcon(dIcon, "layout-grid");
		newDashBtn.appendText(" New Dashboard");
		newDashBtn.addEventListener("click", () => {
			new DashboardNameModal(this.app, {
				onConfirm: (name) => {
					void this.analyticsService.createDashboard(name).then((dashboard) => {
						this.selectedDashboardId = dashboard.id;
						this.navigateTo("dashboards");
						this.scheduleRender();
					});
				},
			}).open();
		});
	}

	onHubOpen(): void {
		this.refreshData();

		const deps = this.buildDeps();
		this.dashboardPage = new AnalyticsDashboardPage(this.dashboardEl, deps);
		this.queriesTab = new QueriesTab(this.masterTreeEl, this.detailPanelEl, deps);
		this.dashboardsTab = new DashboardsTab(this.masterTreeEl, this.detailPanelEl, deps);
		this.measurementsTab = new MeasurementsTab(this.masterTreeEl, this.detailPanelEl, deps);

		// Re-render when queries change
		this.addUnsubscribe(
			this.eventBus.on("analytics.query.saved", () => {
				this.refreshData();
				this.scheduleRender();
			}),
		);
		this.addUnsubscribe(
			this.eventBus.on("analytics.query.deleted", () => {
				this.refreshData();
				this.scheduleRender();
			}),
		);

		// Re-render when dashboards change
		this.addUnsubscribe(
			this.eventBus.on("analytics.dashboard.created", () => {
				this.refreshData();
				this.scheduleRender();
			}),
		);
		this.addUnsubscribe(
			this.eventBus.on("analytics.dashboard.deleted", () => {
				this.refreshData();
				this.scheduleRender();
			}),
		);
		this.addUnsubscribe(
			this.eventBus.on("analytics.dashboard.updated", () => {
				this.refreshData();
				this.scheduleRender();
			}),
		);
		this.addUnsubscribe(
			this.eventBus.on("analytics.dashboard.tile.added", () => {
				this.refreshData();
				this.tileResultCache.clear();
				this.scheduleRender();
			}),
		);
		this.addUnsubscribe(
			this.eventBus.on("analytics.dashboard.tile.removed", () => {
				this.refreshData();
				this.tileResultCache.clear();
				this.scheduleRender();
			}),
		);

		// Re-render when favorites or default change
		this.addUnsubscribe(
			this.eventBus.on("analytics.query.favorited", () => {
				this.refreshData();
				this.scheduleRender();
			}),
		);
		this.addUnsubscribe(
			this.eventBus.on("analytics.dashboard.favorited", () => {
				this.refreshData();
				this.scheduleRender();
			}),
		);
		this.addUnsubscribe(
			this.eventBus.on("analytics.dashboard.defaultChanged", () => {
				this.refreshData();
				this.tileResultCache.clear();
				this.scheduleRender();
			}),
		);

		// Re-render when tiles are reordered
		this.addUnsubscribe(
			this.eventBus.on("analytics.dashboard.tile.reordered", () => {
				this.refreshData();
				this.scheduleRender();
			}),
		);

		// Re-render when queries are renamed or duplicated
		this.addUnsubscribe(
			this.eventBus.on("analytics.query.renamed", () => {
				this.refreshData();
				this.scheduleRender();
			}),
		);
		this.addUnsubscribe(
			this.eventBus.on("analytics.query.duplicated", () => {
				this.refreshData();
				this.scheduleRender();
			}),
		);

		// Re-render when measurements change
		for (const evt of [
			"analytics.measurement.created",
			"analytics.measurement.updated",
			"analytics.measurement.deleted",
			"analytics.measurement.favorited",
		] as const) {
			this.addUnsubscribe(
				this.eventBus.on(evt, () => {
					this.refreshData();
					this.scheduleRender();
				}),
			);
		}
	}

	onHubClose(): void {
		this.dashboardsTab?.dispose();
	}

	protected onNavigateToEntity(tabId: string, entityId: string): void {
		if (tabId === "queries") {
			// If entityId looks like a file path (contains "/" or ends with ".csv"/".base"), treat as source path
			if (entityId.includes("/") || entityId.endsWith(".csv") || entityId.endsWith(".base")) {
				this.pendingSourcePath = entityId;
			} else {
				// Treat as a saved query ID
				this.selectedQueryId = entityId;
			}
			this.scheduleRender();
		} else if (tabId === "dashboards") {
			this.selectedDashboardId = entityId;
			this.scheduleRender();
		} else if (tabId === "measurements") {
			this.selectedMeasurementId = entityId;
			this.scheduleRender();
		}
	}

	protected onTabChanged(): void {
		this.filterText = "";
		this.searchInput.value = "";
		this.dashboardsTab.clearNavigation();
		this.dashboardsTab.dispose();
	}

	onDashboardRender(): void {
		this.refreshData();
		this.dashboardPage.render();
	}

	onTabRender(tabId: AnalyticsHubPage): void {
		this.refreshData();
		switch (tabId) {
			case "queries":
				this.queriesTab.renderMaster();
				this.queriesTab.renderDetail();
				break;
			case "dashboards":
				this.dashboardsTab.renderMaster();
				this.dashboardsTab.renderDetail();
				break;
			case "measurements":
				this.measurementsTab.renderMaster();
				this.measurementsTab.renderDetail();
				break;
		}
	}

	// ── Deps & state ─────────────────────────────────────────

	private buildDeps(): AnalyticsHubDeps {
		const navigation: AnalyticsNavigationCallbacks = {
			navigateTo: (page) => this.navigateTo(page as AnalyticsHubPage | "dashboard"),
			navigateToTab: (tabId, entityId) => {
				this.pendingEntityId = entityId ?? null;
				this.navigateTo(tabId);
			},
		};

		return {
			app: this.app,
			eventBus: this.eventBus,
			analyticsService: this.analyticsService,
			onboardingService: this.onboardingService,
			tileResultCache: this.tileResultCache,
			getState: () => this.getHubState(),
			setState: (partial) => this.setHubState(partial),
			navigation,
			scheduleRender: () => this.scheduleRender(),
		};
	}

	private getHubState(): AnalyticsHubState {
		return {
			currentPage: this.activePage as AnalyticsHubPage | "dashboard",
			queries: this.queries,
			dashboards: this.dashboards,
			csvFiles: this.csvFiles,
			baseFiles: this.baseFiles,
			csvFolders: this.csvFolders,
			measurements: this.measurements,
			filterText: this.filterText,
			selectedQueryId: this.selectedQueryId,
			selectedDashboardId: this.selectedDashboardId,
			selectedMeasurementId: this.selectedMeasurementId,
			homepageDashboardId: this.homepageDashboardId,
			dashboardFilters: this.dashboardFilters,
			dateRangeFilter: this.dateRangeFilter,
			crossTileFilter: this.crossTileFilter,
			pendingSourcePath: this.pendingSourcePath,
			pendingEntityId: this.pendingEntityId,
			pendingNewQuery: this.pendingNewQuery,
		};
	}

	private setHubState(partial: Partial<AnalyticsHubState>): void {
		if (partial.currentPage !== undefined) this.activePage = partial.currentPage as AnalyticsHubPage | "dashboard";
		if (partial.filterText !== undefined) this.filterText = partial.filterText;
		if (partial.selectedQueryId !== undefined) this.selectedQueryId = partial.selectedQueryId;
		if (partial.selectedDashboardId !== undefined) {
			// Reset filters when switching dashboards
			if (partial.selectedDashboardId !== this.selectedDashboardId) {
				this.dashboardFilters = [];
				this.dateRangeFilter = null;
				this.crossTileFilter = null;
			}
			this.selectedDashboardId = partial.selectedDashboardId;
		}
		if (partial.homepageDashboardId !== undefined) {
			// Reset filters when switching homepage dashboard
			if (partial.homepageDashboardId !== this.homepageDashboardId) {
				this.dashboardFilters = [];
				this.dateRangeFilter = null;
				this.crossTileFilter = null;
			}
			this.homepageDashboardId = partial.homepageDashboardId;
		}
		if (partial.selectedMeasurementId !== undefined) this.selectedMeasurementId = partial.selectedMeasurementId;
		if (partial.dashboardFilters !== undefined) this.dashboardFilters = partial.dashboardFilters;
		if (partial.dateRangeFilter !== undefined) this.dateRangeFilter = partial.dateRangeFilter;
		if (partial.crossTileFilter !== undefined) this.crossTileFilter = partial.crossTileFilter;
		if (partial.pendingSourcePath !== undefined) this.pendingSourcePath = partial.pendingSourcePath;
		if (partial.pendingEntityId !== undefined) this.pendingEntityId = partial.pendingEntityId;
		if ("pendingNewQuery" in partial) this.pendingNewQuery = partial.pendingNewQuery;
	}

	// ── Data refresh ─────────────────────────────────────────

	private refreshData(): void {
		this.queries = this.analyticsService.listQueries();
		this.dashboards = this.analyticsService.listDashboards();
		this.measurements = this.analyticsService.listMeasurements();
		this.scanCsvFiles();
		this.scanBaseFiles();
		this.scanCsvFolders();
	}

	private scanCsvFiles(): void {
		this.csvFiles = [];
		const nameCount = new Map<string, number>();
		const entries: Array<{ path: string; name: string }> = [];

		for (const file of this.app.vault.getFiles()) {
			if (!file.path.toLowerCase().endsWith(".csv")) continue;
			entries.push({ path: file.path, name: file.name });
			nameCount.set(file.name, (nameCount.get(file.name) ?? 0) + 1);
		}

		for (const entry of entries) {
			let displayName = entry.name;
			if ((nameCount.get(entry.name) ?? 0) > 1) {
				const lastSlash = entry.path.lastIndexOf("/");
				const parentFolder = lastSlash > 0
					? entry.path.substring(0, lastSlash).split("/").pop() ?? ""
					: "";
				displayName = parentFolder ? `${entry.name} (${parentFolder})` : entry.name;
			}
			this.csvFiles.push({ path: entry.path, displayName });
		}

		this.csvFiles.sort((a, b) => a.displayName.localeCompare(b.displayName));
	}

	private scanBaseFiles(): void {
		this.baseFiles = [];
		const nameCount = new Map<string, number>();
		const entries: Array<{ path: string; name: string }> = [];

		for (const file of this.app.vault.getFiles()) {
			if (!file.path.toLowerCase().endsWith(".base")) continue;
			entries.push({ path: file.path, name: file.name });
			nameCount.set(file.name, (nameCount.get(file.name) ?? 0) + 1);
		}

		for (const entry of entries) {
			let displayName = entry.name;
			if ((nameCount.get(entry.name) ?? 0) > 1) {
				const lastSlash = entry.path.lastIndexOf("/");
				const parentFolder = lastSlash > 0
					? entry.path.substring(0, lastSlash).split("/").pop() ?? ""
					: "";
				displayName = parentFolder ? `${entry.name} (${parentFolder})` : entry.name;
			}
			this.baseFiles.push({ path: entry.path, displayName });
		}

		this.baseFiles.sort((a, b) => a.displayName.localeCompare(b.displayName));
	}

	private scanCsvFolders(): void {
		// Group CSV files by parent folder, show folders with ≥2 CSVs
		const folderCounts = new Map<string, number>();
		for (const file of this.app.vault.getFiles()) {
			if (!file.path.toLowerCase().endsWith(".csv")) continue;
			const lastSlash = file.path.lastIndexOf("/");
			if (lastSlash <= 0) continue; // skip root-level CSVs
			const folder = file.path.substring(0, lastSlash);
			folderCounts.set(folder, (folderCounts.get(folder) ?? 0) + 1);
		}

		this.csvFolders = [];
		for (const [folder, count] of folderCounts) {
			if (count < 2) continue;
			const displayName = folder.split("/").pop() ?? folder;
			this.csvFolders.push({ path: folder, displayName, fileCount: count });
		}
		this.csvFolders.sort((a, b) => a.displayName.localeCompare(b.displayName));
	}
}
