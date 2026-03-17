/**
 * Dashboard provider for the Train Hub.
 *
 * Queries the TrainService to produce summary stats
 * without requiring the view to be open.
 */

import type { TrainService } from "../train/TrainService";
import { VIEW_TYPE_TRAIN_HUB, type HubDashboardProvider, type HubSummary } from "./types";

export class TrainHubProvider implements HubDashboardProvider {
	constructor(private trainService: TrainService) {}

	getHubId(): string {
		return "train";
	}

	getViewType(): string {
		return VIEW_TYPE_TRAIN_HUB;
	}

	getDisplayName(): string {
		return "Trains";
	}

	getIcon(): string {
		return "train-front";
	}

	getSummary(): HubSummary {
		const allTrains = this.trainService.getAllTrains();
		const active = this.trainService.getActiveTrain();

		return {
			stats: [
				{ label: "Trains", value: String(allTrains.length), icon: "train-front", tabId: "trains" },
				...(active ? [{ label: "Active", value: active.title, icon: "play", tabId: "active" }] : []),
			],
			healthLevel: "healthy",
			actionItemCount: active ? 1 : 0,
		};
	}
}
