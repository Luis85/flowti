/**
 * Reusable test helpers for Hub component tests.
 *
 * Provides mock factories for HubComponentDeps and HubState
 * so each component test can focus on behavior, not setup boilerplate.
 */

import { vi } from "vitest";
import { EventBus } from "../../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../../src/infrastructure/events/types";
import type { HubComponentDeps, HubState } from "../../../src/ui/hub/types";

export function makeDefaultHubState(overrides: Partial<HubState> = {}): HubState {
	return {
		currentPage: "dashboard",
		importConfigs: [],
		exportConfigs: [],
		pipelineConfigs: [],
		dictionaryEntries: [],
		reportEntries: [],
		typeEntries: [],
		csvFileEntries: [],
		documentedProperties: new Set(),
		filterText: "",
		showHiddenCsvs: false,
		frontmatterIssues: [],
		activeOperations: [],
		canvasConfigs: [],
		selectedImportId: null,
		selectedExportId: null,
		selectedDictProp: null,
		selectedReportPath: null,
		selectedCsvFilePath: null,
		selectedPipelineId: null,
		selectedTypeName: null,
		selectedSignalId: null,
		selectedCanvasId: null,
		editingImportId: null,
		editingExportId: null,
		editingPipelineId: null,
		editingCanvasId: null,
		selectedAnalyticsQueryId: null,
		...overrides,
	};
}

export function createMockHubDeps(
	overrides: {
		state?: Partial<HubState>;
		eventBus?: IEventBus;
	} = {},
): { deps: HubComponentDeps; state: HubState } {
	const state = makeDefaultHubState(overrides.state);
	return {
		deps: {
			app: {
				vault: {
					getAbstractFileByPath: vi.fn().mockReturnValue(null),
					getFiles: vi.fn().mockReturnValue([]),
				},
				workspace: {
					getLeaf: vi.fn().mockReturnValue({
						openFile: vi.fn(),
						setViewState: vi.fn().mockResolvedValue(undefined),
					}),
				},
				metadataCache: {
					getFileCache: vi.fn().mockReturnValue(null),
				},
			} as unknown as HubComponentDeps["app"],
			eventBus: overrides.eventBus ?? new EventBus(),
			dataExchangeService: {
				getImportConfigs: vi.fn().mockReturnValue([]),
				getExportConfigs: vi.fn().mockReturnValue([]),
				getPipelineConfigs: vi.fn().mockReturnValue([]),
				getPropertyDictionary: vi.fn().mockReturnValue([]),
				getReports: vi.fn().mockReturnValue([]),
				getTypeDocEntries: vi.fn().mockReturnValue([]),
			} as unknown as HubComponentDeps["dataExchangeService"],
			signalService: undefined,
			canvasService: undefined,
			getState: () => state,
			setState: vi.fn((partial: Partial<HubState>) => Object.assign(state, partial)),
			navigation: {
				navigateTo: vi.fn(),
				showImportConfig: vi.fn(),
				openCsvImport: vi.fn(),
				openExport: vi.fn(),
				openNewExport: vi.fn(),
				openEventInCatalog: vi.fn(),
				createNewPipeline: vi.fn(),
				executeExportConfig: vi.fn(),
				runPipelinePreview: vi.fn(),
				executePipeline: vi.fn(),
				openCanvasImport: vi.fn(),
			},
			scheduleRender: vi.fn(),
		},
		state,
	};
}
