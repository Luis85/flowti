/**
 * Shared types for Analytics Hub components.
 */

import type { App } from "obsidian";
import type { IEventBus } from "../../infrastructure/events/types";
import type { AnalyticsService } from "../../domain/analytics/AnalyticsService";
import type { Dashboard, SavedAnalyticsQuery } from "../../domain/analytics/types";

// ─────────────────────────────────────────────────────────────
// Hub pages
// ─────────────────────────────────────────────────────────────

export type AnalyticsHubPage = "dashboards" | "queries";

// ─────────────────────────────────────────────────────────────
// CSV file entry (lightweight, for source picker)
// ─────────────────────────────────────────────────────────────

export interface AnalyticsCsvEntry {
	path: string;
	displayName: string;
}

// ─────────────────────────────────────────────────────────────
// Hub state — owned by the orchestrator
// ─────────────────────────────────────────────────────────────

export interface AnalyticsHubState {
	currentPage: AnalyticsHubPage | "dashboard";
	queries: SavedAnalyticsQuery[];
	dashboards: Dashboard[];
	csvFiles: AnalyticsCsvEntry[];
	filterText: string;
	selectedQueryId: string | null;
	selectedDashboardId: string | null;
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
	getState: () => AnalyticsHubState;
	setState: (partial: Partial<AnalyticsHubState>) => void;
	navigation: AnalyticsNavigationCallbacks;
	scheduleRender: () => void;
}
