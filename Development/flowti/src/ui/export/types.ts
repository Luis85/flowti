/**
 * Shared types and constants for ExportView page components.
 */

import type { App } from "obsidian";
import type { ExportService } from "../../domain/dataExchange/ExportService";
import type {
	ExportConflictStrategy,
	ExportFormat,
	ExportResult,
	ParsedBaseFile,
	SavedExportConfig,
	VaultFileInfo,
} from "../../domain/dataExchange/types";

export type ExportPage = "view-select" | "configure" | "preview" | "result";

export const STEP_LABELS: Record<string, string> = {
	"view-select": "View",
	configure: "Configure",
	preview: "Preview",
	result: "Export",
};

export const STRATEGY_LABELS: Record<string, string> = {
	overwrite: "Overwrite — replace existing file",
	skip: "Skip — do not write if file exists",
	append: "Append — add rows to existing file",
};

export interface ExportViewState {
	sourcePath: string;
	sourceType: "folder" | "base";
	format: ExportFormat;
	currentPage: ExportPage;
	outputPath: string;
	isExternal: boolean;
	availableColumns: string[];
	selectedColumns: string[];
	selectedFileProperties: string[];
	baseViewIndex: number;
	baseFile: ParsedBaseFile | null;
	previewFiles: VaultFileInfo[];
	conflictStrategy: ExportConflictStrategy;
	displayNames: Record<string, string>;
	noteType: string;
	exportResult: ExportResult | null;
	exportError: string | null;
	loadError: string | null;
	savedConfigs: SavedExportConfig[];
	loadedConfigId: string | null;
	propertySearchText: string;
}

export interface ExportComponentDeps {
	app: App;
	exportService: ExportService;
	getState: () => ExportViewState;
	setState: (partial: Partial<ExportViewState>) => void;
	renderPage: () => void;
	openFolderPicker: () => void;
	openNativeSaveDialog: () => Promise<void>;
	detachLeaf: () => void;
	runExport: () => void;
	updateUnsavedHint: () => void;
	hasUnsavedChanges: () => boolean;
	/** Reference to the unsaved hint element for direct visibility toggling. */
	getUnsavedHintEl: () => HTMLElement | null;
	setUnsavedHintEl: (el: HTMLElement) => void;
}
