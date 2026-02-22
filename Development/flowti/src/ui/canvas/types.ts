/**
 * Types for the Canvas Action View (ItemView-based import workflow).
 *
 * Follows the CsvActionView pattern: landing → config → preview → result.
 */

import type { App } from "obsidian";
import type { IEventBus } from "../../infrastructure/events/types";
import type { CanvasService } from "../../domain/canvas/CanvasService";
import type { CanvasImportResult, CanvasItem, FlowtiCanvasType } from "../../domain/canvas/types";

export type CanvasPage = "landing" | "config" | "preview" | "result";

export const STEP_LABELS: Record<string, string> = {
	config: "Configure",
	preview: "Preview",
	result: "Import",
};

export interface CanvasViewState {
	currentPage: CanvasPage;
	canvasPath: string;
	targetFolder: string;
	configName: string;
	conflictStrategy: "skip" | "update" | "overwrite";
	hierarchyMode: "flat" | "product" | "group";
	/** Override for the import subfolder name. Defaults to canvas file basename if empty. */
	subfolderName: string;
	createCanvas: boolean;
	createBase: boolean;
	colorMap: Record<string, FlowtiCanvasType>;
	shapeMap: Record<string, FlowtiCanvasType>;
	/** Types to exclude from import (empty = import all). */
	excludedTypes: string[];
	/** Parsed preview items (populated after parse). */
	previewItems: CanvasItem[];
	legendMap: Record<string, FlowtiCanvasType> | null;
	parseError: string | null;
	/** Whether an import is currently running. */
	importing: boolean;
	importDone: boolean;
	importSuccess: boolean;
	importMessage: string;
	importProgress: { current: number; total: number; title: string };
	/** Structured import result (populated after import completes). */
	importResult: CanvasImportResult | null;
	/** Paths of generated artifacts (canvas, base) — for result page links. */
	artifactPaths: { canvasPath?: string; basePath?: string };
	/** Loaded config ID when editing an existing config. */
	loadedConfigId: string | null;
}

export interface CanvasComponentDeps {
	app: App;
	eventBus: IEventBus;
	canvasService: CanvasService;
	getState: () => CanvasViewState;
	setState: (partial: Partial<CanvasViewState>) => void;
	renderContent: () => void;
	parseAndPreview: () => Promise<void>;
	runImport: () => Promise<void>;
	saveConfig: () => Promise<void>;
	hasUnsavedChanges: () => boolean;
	updateUnsavedHint: () => void;
	setUnsavedHintEl: (el: HTMLElement) => void;
	readCanvasFile: (path: string) => Promise<string>;
	openFolderPicker: () => void;
	detachLeaf: () => void;
}
