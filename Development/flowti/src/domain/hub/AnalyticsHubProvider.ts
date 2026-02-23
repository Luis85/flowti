/**
 * Dashboard provider for the Analytics Hub.
 *
 * Queries the AnalyticsService to produce summary stats
 * without requiring the view to be open.
 */

import type { AnalyticsService } from "../analytics/AnalyticsService";
import { VIEW_TYPE_ANALYTICS_HUB, type HubDashboardProvider, type HubSummary } from "./types";

export class AnalyticsHubProvider implements HubDashboardProvider {
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

		return {
			stats: [
				{ label: "Queries", value: String(queries.length), icon: "search", tabId: "queries" },
				{ label: "Dashboards", value: String(dashboards.length), icon: "layout-grid", tabId: "dashboards" },
			],
			healthLevel: "healthy",
			actionItemCount: 0,
		};
	}
}
