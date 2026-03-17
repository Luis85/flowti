/**
 * Shared types for Analytics Hub components.
 */

import type { App } from "obsidian";
import type { IEventBus } from "../../infrastructure/events/types";
import type { AnalyticsService } from "../../domain/analytics/AnalyticsService";
import type { OnboardingService } from "../../domain/onboarding/OnboardingService";
import type { CrossTileFilter, Dashboard, DateRangeFilter, Measurement, SavedAnalyticsQuery } from "../../domain/analytics/types";
import type { TileResultCache } from "./TileResultCache";

// ─────────────────────────────────────────────────────────────
// Hub pages
// ─────────────────────────────────────────────────────────────

export type AnalyticsHubPage = "dashboards" | "measurements" | "queries";

// ─────────────────────────────────────────────────────────────
// Source file entries (lightweight, for source picker)
// ─────────────────────────────────────────────────────────────

export interface AnalyticsCsvEntry {
	path: string;
	displayName: string;
}

export interface AnalyticsBaseEntry {
	path: string;
	displayName: string;
}

// ─────────────────────────────────────────────────────────────
// Dashboard filter (runtime-only, not persisted)
// ─────────────────────────────────────────────────────────────

export interface DashboardFilter {
	column: string;
	values: string[];
}

// ─────────────────────────────────────────────────────────────
// Hub state — owned by the orchestrator
// ─────────────────────────────────────────────────────────────

export interface AnalyticsFolderEntry {
	path: string;
	displayName: string;
	fileCount: number;
}

export interface AnalyticsHubState {
	currentPage: AnalyticsHubPage | "dashboard";
	queries: SavedAnalyticsQuery[];
	dashboards: Dashboard[];
	csvFiles: AnalyticsCsvEntry[];
	baseFiles: AnalyticsBaseEntry[];
	/** Vault folders containing ≥2 CSV files (for csv-folder sources). */
	csvFolders: AnalyticsFolderEntry[];
	measurements: Measurement[];
	filterText: string;
	selectedQueryId: string | null;
	selectedDashboardId: string | null;
	selectedMeasurementId: string | null;
	/** Dashboard ID to display on the homepage (null = use default dashboard). */
	homepageDashboardId: string | null;
	/** Active dashboard filters (runtime-only, reset on dashboard switch). */
	dashboardFilters: DashboardFilter[];
	/** Active date range filter (runtime-only, reset on dashboard switch). */
	dateRangeFilter: DateRangeFilter | null;
	/** Active cross-tile filter (runtime-only, reset on dashboard switch). */
	crossTileFilter: CrossTileFilter | null;
	/** Pending CSV source path from cross-hub navigation (consumed once). */
	pendingSourcePath: string | null;
	/** Pending entity ID for cross-tab navigation (consumed once after tab switch). */
	pendingEntityId: string | null;
	/** Pending new query from top-bar modal (consumed once by QueriesTab). */
	pendingNewQuery?: {
		name: string;
		sources: Array<{ path: string; alias: string; sourceType: string; viewIndex?: number }>;
	};
}

// ─────────────────────────────────────────────────────────────
// Breadcrumb navigation stack (PBI-ANA-122, Cycle 43)
// ─────────────────────────────────────────────────────────────

export type BreadcrumbLevel = "list" | "dashboard" | "filtered" | "tile";

export interface NavigationStackEntry {
	level: BreadcrumbLevel;
	label: string;
	dashboardId?: string;
}

export const MAX_BREADCRUMB_DEPTH = 4;

// ─────────────────────────────────────────────────────────────
// Navigation callbacks
// ─────────────────────────────────────────────────────────────

export interface AnalyticsNavigationCallbacks {
	navigateTo: (page: AnalyticsHubPage | "dashboard") => void;
	/** Switch to a tab and optionally pre-select an entity. */
	navigateToTab: (tabId: AnalyticsHubPage, entityId?: string) => void;
}

// ─────────────────────────────────────────────────────────────
// Dependency interface for analytics hub components
// ─────────────────────────────────────────────────────────────

export interface AnalyticsHubDeps {
	app: App;
	eventBus: IEventBus;
	analyticsService: AnalyticsService;
	onboardingService: OnboardingService;
	tileResultCache: TileResultCache;
	getState: () => AnalyticsHubState;
	setState: (partial: Partial<AnalyticsHubState>) => void;
	navigation: AnalyticsNavigationCallbacks;
	scheduleRender: () => void;
}
