/**
 * Dashboard provider for the Data Exchange hub.
 *
 * Queries the DataExchangeService to produce summary stats
 * without requiring the view to be open.
 */

import type { DataExchangeService } from "../dataExchange/DataExchangeService";
import { VIEW_TYPE_DATA_EXCHANGE_HUB } from "../../ui/DataExchangeHubView";
import type { HubDashboardProvider, HubSummary } from "./types";

export class DataExchangeProvider implements HubDashboardProvider {
	constructor(private dataExchangeService: DataExchangeService) {}

	getHubId(): string {
		return "data-exchange";
	}

	getViewType(): string {
		return VIEW_TYPE_DATA_EXCHANGE_HUB;
	}

	getDisplayName(): string {
		return "Data Exchange";
	}

	getIcon(): string {
		return "arrow-left-right";
	}

	getSummary(): HubSummary {
		const imports = this.dataExchangeService.getSavedImportConfigs();
		const exports = this.dataExchangeService.getSavedExportConfigs();
		const pipelines = this.dataExchangeService.getSavedPipelines();

		return {
			stats: [
				{ label: "Pipelines", value: String(pipelines.length), icon: "workflow", tabId: "pipelines" },
				{ label: "Imports", value: String(imports.length), icon: "file-input", tabId: "imports" },
				{ label: "Exports", value: String(exports.length), icon: "file-output", tabId: "exports" },
			],
			healthLevel: "healthy",
			actionItemCount: 0,
		};
	}
}
