/**
 * Dashboard provider for the Feature Lifecycle hub card.
 *
 * Queries the FeatureLifecycleService to produce summary stats
 * for the User Hub dashboard.
 */

import type { FeatureLifecycleService } from "../featureLifecycle/FeatureLifecycleService";
import { VIEW_TYPE_EVENT_CATALOG, type HubDashboardProvider, type HubSummary } from "./types";

export class FeatureLifecycleProvider implements HubDashboardProvider {
	constructor(private service: FeatureLifecycleService) {}

	getHubId(): string {
		return "feature-lifecycle";
	}

	getViewType(): string {
		return VIEW_TYPE_EVENT_CATALOG;
	}

	getDisplayName(): string {
		return "Feature Lifecycle";
	}

	getIcon(): string {
		return "sparkles";
	}

	getSummary(): HubSummary {
		const features = this.service.getFeatures();
		const byStage = this.service.getFeaturesByStage();
		const active = byStage["in-progress"].length + byStage["review"].length;
		const done = byStage["done"].length;
		const activeSession = this.service.getActiveSession();

		return {
			stats: [
				{ label: "Features", value: String(features.length), icon: "sparkles", tabId: "features" },
				{ label: "Active", value: String(active), icon: "activity" },
				{ label: "Done", value: String(done), icon: "check-circle" },
			],
			healthLevel: activeSession ? "healthy" : features.length === 0 ? "healthy" : "healthy",
			actionItemCount: activeSession ? 1 : 0,
		};
	}
}
