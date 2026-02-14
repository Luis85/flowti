/**
 * Shared types for Data Exchange Hub components.
 *
 * Follows the same pattern as `src/ui/catalog/types.ts`.
 */

import type { App } from "obsidian";
import type { IEventBus } from "../../infrastructure/events/types";
import type { DataExchangeService } from "../../domain/dataExchange/DataExchangeService";
import type {
	DataDictionaryEntry,
	ExportFormat,
	SavedImportConfig,
	SavedExportConfig,
	SavedMultiImportPipeline,
	TypeDocEntry,
} from "../../domain/dataExchange/types";

// ─────────────────────────────────────────────────────────────
// Hub pages
// ─────────────────────────────────────────────────────────────

export type HubPage = "dashboard" | "imports" | "exports" | "reports" | "properties" | "pipelines" | "types";

// ─────────────────────────────────────────────────────────────
// Hub state — owned by the orchestrator
// ─────────────────────────────────────────────────────────────

export interface CsvFileEntry {
	path: string;
	name: string;
	importConfigs: SavedImportConfig[];
	exportConfigs: SavedExportConfig[];
	hasDoc: boolean;
	baseViews: Array<{ path: string; name: string }>;
}

export interface ReportEntry {
	name: string;
	path: string;
	frontmatter: Record<string, unknown>;
}

export interface HubState {
	currentPage: HubPage;
	importConfigs: SavedImportConfig[];
	exportConfigs: SavedExportConfig[];
	pipelineConfigs: SavedMultiImportPipeline[];
	dictionaryEntries: DataDictionaryEntry[];
	reportEntries: ReportEntry[];
	typeEntries: TypeDocEntry[];
	csvFileEntries: CsvFileEntry[];
	documentedProperties: Set<string>;
	filterText: string;
	showHiddenCsvs: boolean;

	// Selection & editing state
	selectedImportId: string | null;
	selectedExportId: string | null;
	selectedDictProp: string | null;
	selectedReportPath: string | null;
	selectedPipelineId: string | null;
	selectedTypeName: string | null;
	editingImportId: string | null;
	editingExportId: string | null;
	editingPipelineId: string | null;
}

// ─────────────────────────────────────────────────────────────
// Navigation callbacks
// ─────────────────────────────────────────────────────────────

export interface HubNavigationCallbacks {
	navigateTo: (page: HubPage) => void;
	showImportConfig: (configId: string) => void;
	openCsvImport: (csvPath: string, savedConfig?: SavedImportConfig) => void;
	openExport: (savedConfig: SavedExportConfig) => void;
	openNewExport: (sourcePath: string, sourceType: "folder" | "base", format: ExportFormat) => void;
	openEventInCatalog: (eventType: string) => void;
	createNewPipeline: () => void;
	executeExportConfig: (cfg: SavedExportConfig) => void;
	runPipelinePreview: (pipe: SavedMultiImportPipeline) => void;
	executePipeline: (pipe: SavedMultiImportPipeline) => void;
}

// ─────────────────────────────────────────────────────────────
// Dependency interface for hub components
// ─────────────────────────────────────────────────────────────

export interface HubComponentDeps {
	app: App;
	eventBus: IEventBus;
	dataExchangeService: DataExchangeService;
	getState: () => HubState;
	setState: (partial: Partial<HubState>) => void;
	navigation: HubNavigationCallbacks;
	scheduleRender: () => void;
}
