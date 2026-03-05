/**
 * Dashboard provider for the Test Management Hub.
 *
 * Queries the TestManagementService to produce summary stats
 * without requiring the view to be open.
 */

import type { TestManagementService } from "../testManagement/TestManagementService";
import { deriveJourneyStatus } from "../testManagement/journeyParser";
import { VIEW_TYPE_TEST_MANAGEMENT_HUB, type HubDashboardProvider, type HubSummary } from "./types";

export class TestManagementHubProvider implements HubDashboardProvider {
	constructor(private service: TestManagementService) {}

	getHubId(): string {
		return "test-management";
	}

	getViewType(): string {
		return VIEW_TYPE_TEST_MANAGEMENT_HUB;
	}

	getDisplayName(): string {
		return "Test Management";
	}

	getIcon(): string {
		return "shield-check";
	}

	getSummary(): HubSummary {
		const journeys = this.service.getJourneys();
		const passing = journeys.filter((j) => deriveJourneyStatus(j) === "passing").length;
		const failing = journeys.filter((j) => deriveJourneyStatus(j) === "failing").length;
		const stale = journeys.filter((j) => deriveJourneyStatus(j) === "stale").length;

		return {
			stats: [
				{ label: "Journeys", value: String(journeys.length), icon: "route" },
				{ label: "Passing", value: String(passing), icon: "check-circle" },
			],
			healthLevel: failing > 0 ? "warning" : "healthy",
			actionItemCount: failing + stale,
		};
	}
}
