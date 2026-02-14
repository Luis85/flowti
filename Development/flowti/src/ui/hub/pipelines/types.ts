/**
 * Shared types for Pipeline sub-components.
 */

import type { App } from "obsidian";
import type { IEventBus } from "../../../infrastructure/events/types";
import type { DataExchangeService } from "../../../domain/dataExchange/DataExchangeService";
import type { SavedMultiImportPipeline } from "../../../domain/dataExchange/types";
import type { HubState, HubNavigationCallbacks } from "../types";

export interface PipelineComponentDeps {
	app: App;
	eventBus: IEventBus;
	dataExchangeService: DataExchangeService;
	getState: () => HubState;
	setState: (partial: Partial<HubState>) => void;
	navigation: HubNavigationCallbacks;
	scheduleRender: () => void;
	// Callbacks to orchestrator
	renderDetail: () => void;
	executePipeline: (pipe: SavedMultiImportPipeline) => void;
	runPreview: (pipe: SavedMultiImportPipeline) => void;
}
