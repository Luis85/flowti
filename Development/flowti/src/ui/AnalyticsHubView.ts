/**
 * Analytics Hub — dedicated view for analytics queries and dashboards.
 *
 * This is the orchestrator: it owns state, CSV scanning, and tab rendering.
 * Shell lifecycle (wrapper, top bar, tab bar, split layout) is handled by BaseHubView.
 */

import type { WorkspaceLeaf } from "obsidian";
import type { IEventBus } from "../infrastructure/events/types";
import type { AnalyticsService } from "../domain/analytics/AnalyticsService";
import { VIEW_TYPE_ANALYTICS_HUB } from "../domain/hub/types";
import { BaseHubView, type TabDef } from "./BaseHubView";
import { QueriesTab } from "./analytics/QueriesTab";
import { DashboardsTab } from "./analytics/DashboardsTab";
import { AnalyticsDashboardPage } from "./analytics/AnalyticsDashboardPage";
import type { AnalyticsHubPage, AnalyticsHubState, AnalyticsCsvEntry, AnalyticsHubDeps, AnalyticsNavigationCallbacks } from "./analytics/types";
export { VIEW_TYPE_ANALYTICS_HUB };

export class AnalyticsHubView extends BaseHubView<AnalyticsHubPage> {
	private analyticsService: AnalyticsService;

	// ── State ────────────────────────────────────────────────
	private queries: AnalyticsHubState["queries"] = [];
	private dashboards: AnalyticsHubState["dashboards"] = [];
	private csvFiles: AnalyticsCsvEntry[] = [];
	private selectedQueryId: string | null = null;
	private selectedDashboardId: string | null = null;

	// ── Tab components ───────────────────────────────────────
	private dashboardPage!: AnalyticsDashboardPage;
	private queriesTab!: QueriesTab;
	private dashboardsTab!: DashboardsTab;

	constructor(
		leaf: WorkspaceLeaf,
		eventBus: IEventBus,
		analyticsService: AnalyticsService,
	) {
		super(leaf, eventBus);
		this.analyticsService = analyticsService;
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
			{ id: "queries", label: "Queries", icon: "search", searchPlaceholder: "Search CSV sources..." },
		];
	}

	renderTopBarActions(_bar: HTMLElement): void {
		// No extra top bar buttons in v1
	}

	onHubOpen(): void {
		this.refreshData();

		const deps = this.buildDeps();
		this.dashboardPage = new AnalyticsDashboardPage(this.dashboardEl, deps);
		this.queriesTab = new QueriesTab(this.masterTreeEl, this.detailPanelEl, deps);
		this.dashboardsTab = new DashboardsTab(this.masterTreeEl, this.detailPanelEl, deps);

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
				this.dashboardsTab.clearResultCache();
				this.scheduleRender();
			}),
		);
		this.addUnsubscribe(
			this.eventBus.on("analytics.dashboard.tile.removed", () => {
				this.refreshData();
				this.dashboardsTab.clearResultCache();
				this.scheduleRender();
			}),
		);
	}

	onHubClose(): void {
		// No cleanup needed in v1
	}

	protected onTabChanged(): void {
		this.filterText = "";
		this.searchInput.value = "";
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
		}
	}

	// ── Deps & state ─────────────────────────────────────────

	private buildDeps(): AnalyticsHubDeps {
		const navigation: AnalyticsNavigationCallbacks = {
			navigateTo: (page) => this.navigateTo(page as AnalyticsHubPage | "dashboard"),
		};

		return {
			app: this.app,
			eventBus: this.eventBus,
			analyticsService: this.analyticsService,
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
			filterText: this.filterText,
			selectedQueryId: this.selectedQueryId,
			selectedDashboardId: this.selectedDashboardId,
		};
	}

	private setHubState(partial: Partial<AnalyticsHubState>): void {
		if (partial.currentPage !== undefined) this.activePage = partial.currentPage as AnalyticsHubPage | "dashboard";
		if (partial.filterText !== undefined) this.filterText = partial.filterText;
		if (partial.selectedQueryId !== undefined) this.selectedQueryId = partial.selectedQueryId;
		if (partial.selectedDashboardId !== undefined) this.selectedDashboardId = partial.selectedDashboardId;
	}

	// ── Data refresh ─────────────────────────────────────────

	private refreshData(): void {
		this.queries = this.analyticsService.listQueries();
		this.dashboards = this.analyticsService.listDashboards();
		this.scanCsvFiles();
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
}
