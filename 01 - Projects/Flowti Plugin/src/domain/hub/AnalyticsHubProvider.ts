/**
 * Dashboard provider for the Analytics Hub.
 *
 * Queries the AnalyticsService to produce summary stats
 * without requiring the view to be open.
 *
 * When a default dashboard exists with stat-card tiles,
 * extracts the top 3 KPI values and surfaces them as
 * dashboardStats on the HubSummary (5-minute cache).
 */

import type { AnalyticsService } from "../analytics/AnalyticsService";
import type { DashboardTile } from "../analytics/types";
import { VIEW_TYPE_ANALYTICS_HUB, type DashboardStatItem, type HubDashboardProvider, type HubSummary } from "./types";

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_DASHBOARD_STATS = 3;

export class AnalyticsHubProvider implements HubDashboardProvider {
	private cachedStats: DashboardStatItem[] = [];
	private cacheTimestamp = 0;
	private refreshInProgress = false;

	constructor(private analyticsService: AnalyticsService) {}

	getHubId(): string {
		return "analytics";
	}

	getViewType(): string {
		return VIEW_TYPE_ANALYTICS_HUB;
	}

	getDisplayName(): string {
		return "Analytics";
	}

	getIcon(): string {
		return "bar-chart-2";
	}

	getSummary(): HubSummary {
		const queries = this.analyticsService.listQueries();
		const dashboards = this.analyticsService.listDashboards();

		// Trigger async refresh if cache is stale
		if (Date.now() - this.cacheTimestamp > CACHE_TTL_MS) {
			void this.refreshDashboardStats();
		}

		return {
			stats: [
				{ label: "Queries", value: String(queries.length), icon: "search", tabId: "queries" },
				{ label: "Dashboards", value: String(dashboards.length), icon: "layout-grid", tabId: "dashboards" },
			],
			healthLevel: "healthy",
			actionItemCount: 0,
			dashboardStats: this.cachedStats.length > 0 ? this.cachedStats : undefined,
		};
	}

	/** Refresh cached dashboard KPI values from the default dashboard's stat-card tiles. */
	private async refreshDashboardStats(): Promise<void> {
		if (this.refreshInProgress) return;
		this.refreshInProgress = true;

		try {
			const defaultDashboard = this.analyticsService.getDefaultDashboard();
			if (!defaultDashboard) {
				this.cachedStats = [];
				this.cacheTimestamp = Date.now();
				return;
			}

			const statTiles = defaultDashboard.tiles
				.filter((t: DashboardTile) => t.displayMode === "stat-card")
				.slice(0, MAX_DASHBOARD_STATS);

			if (statTiles.length === 0) {
				this.cachedStats = [];
				this.cacheTimestamp = Date.now();
				return;
			}

			const stats: DashboardStatItem[] = [];
			for (const tile of statTiles) {
				try {
					const result = await this.analyticsService.runSavedQuery(tile.queryId);
					if (result.rows.length > 0) {
						const firstRow = result.rows[0];
						const numericCol = result.columns.find((c) => typeof firstRow[c] === "number");
						const value = numericCol ? firstRow[numericCol] : undefined;

						stats.push({
							label: tile.title ?? "KPI",
							value: value !== undefined ? this.formatStatValue(value as number) : "—",
						});
					}
				} catch {
					// Skip tiles that fail to execute
				}
			}

			this.cachedStats = stats;
			this.cacheTimestamp = Date.now();
		} finally {
			this.refreshInProgress = false;
		}
	}

	private formatStatValue(v: number): string {
		if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
		if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
		return Number.isInteger(v) ? String(v) : v.toFixed(1);
	}
}
