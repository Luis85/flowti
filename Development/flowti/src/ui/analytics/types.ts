/**
 * Shared types for Analytics Hub components.
 */

import type { App } from "obsidian";
import type { IEventBus } from "../../infrastructure/events/types";
import type { AnalyticsService } from "../../domain/analytics/AnalyticsService";
import type { Dashboard, SavedAnalyticsQuery } from "../../domain/analytics/types";
import type { TileResultCache } from "./TileResultCache";

// ─────────────────────────────────────────────────────────────
// Hub pages
// ─────────────────────────────────────────────────────────────

export type AnalyticsHubPage = "dashboards" | "queries";

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

export interface AnalyticsHubState {
	currentPage: AnalyticsHubPage | "dashboard";
	queries: SavedAnalyticsQuery[];
	dashboards: Dashboard[];
	csvFiles: AnalyticsCsvEntry[];
	baseFiles: AnalyticsBaseEntry[];
	filterText: string;
	selectedQueryId: string | null;
	selectedDashboardId: string | null;
	/** Dashboard ID to display on the homepage (null = use default dashboard). */
	homepageDashboardId: string | null;
	/** Active dashboard filters (runtime-only, reset on dashboard switch). */
	dashboardFilters: DashboardFilter[];
	/** Pending CSV source path from cross-hub navigation (consumed once). */
	pendingSourcePath: string | null;
}

// ─────────────────────────────────────────────────────────────
// Navigation callbacks
// ─────────────────────────────────────────────────────────────

export interface AnalyticsNavigationCallbacks {
	navigateTo: (page: AnalyticsHubPage | "dashboard") => void;
}

// ─────────────────────────────────────────────────────────────
// Dependency interface for analytics hub components
// ─────────────────────────────────────────────────────────────

export interface AnalyticsHubDeps {
	app: App;
	eventBus: IEventBus;
	analyticsService: AnalyticsService;
	tileResultCache: TileResultCache;
	getState: () => AnalyticsHubState;
	setState: (partial: Partial<AnalyticsHubState>) => void;
	navigation: AnalyticsNavigationCallbacks;
	scheduleRender: () => void;
}
