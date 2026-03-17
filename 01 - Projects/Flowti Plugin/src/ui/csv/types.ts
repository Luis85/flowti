/**
 * Shared types and constants for CsvActionView page components.
 */

import type { App, TFile } from "obsidian";
import type { IEventBus } from "../../infrastructure/events/types";
import type { DataExchangeService } from "../../domain/dataExchange/DataExchangeService";
import type { ImportService } from "../../domain/dataExchange/ImportService";
import type {
	ColumnMapping,
	ConflictStrategy,
	ImportResult,
	ParsedCsv,
	SavedImportConfig,
} from "../../domain/dataExchange/types";

export type CsvPage = "landing" | "config" | "preview" | "result";

export const STEP_LABELS: Record<string, string> = {
	config: "Configure",
	preview: "Preview",
	result: "Import",
};

export interface CsvViewState {
	currentPage: CsvPage;
	importService: ImportService | null;
	parsedCsv: ParsedCsv | null;
	parseError: string | null;
	targetFolder: string;
	nameColumn: string;
	namePrefix: string;
	nameSuffix: string;
	columnMappings: ColumnMapping[];
	conflictStrategy: ConflictStrategy;
	importResult: ImportResult | null;
	importError: string | null;
	importProgress: { current: number; total: number };
	createBase: boolean;
	basePath: string;
	savedConfigs: SavedImportConfig[];
	pendingSavedConfig: SavedImportConfig | null;
	columnSearchText: string;
	customProperties: Record<string, string>;
	loadedConfigId: string | null;
	detectedDelimiter: string;
	previewSortColumn: string | null;
	previewSortDir: "asc" | "desc";
	hiddenColumns: string[];
	filterColumn: string | null;
	filterText: string;
	previewMaxRows: number;
	lastImportedAt: number | null;
}

export interface CsvComponentDeps {
	app: App;
	eventBus: IEventBus;
	dataExchangeService: DataExchangeService;
	getState: () => CsvViewState;
	setState: (partial: Partial<CsvViewState>) => void;
	renderContent: () => void;
	startImportWizard: (skipAutoDetect?: boolean) => Promise<void>;
	resetImportState: () => void;
	openFolderPicker: () => void;
	openBaseFolderPicker: () => void;
	openHubImportConfig: (configId: string) => void;
	detachLeaf: () => void;
	runImport: () => Promise<void>;
	promptSaveConfig: () => void;
	hasUnsavedChanges: () => boolean;
	updateUnsavedHint: () => void;
	getUnsavedHintEl: () => HTMLElement | null;
	setUnsavedHintEl: (el: HTMLElement) => void;
	getFile: () => TFile | null;
	getData: () => string;
	/** Optional: get saved analytics queries referencing a source path. */
	getQueriesBySource?: (csvPath: string) => import("../../domain/analytics/types").SavedAnalyticsQuery[];
	/** Optional: navigate to Analytics Hub with a specific query or source pre-selected. */
	openAnalyticsHub?: (tabId: string, entityId: string) => void;
}
