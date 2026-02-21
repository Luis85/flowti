/**
 * Event types owned by the Data Exchange domain.
 *
 * Covers both import (CSV → notes) and export (notes → CSV/Tab) operations.
 */

import type {
	ImportConfig,
	ImportResult,
	ExportConfig,
	ExportResult,
	SavedMultiImportPipeline,
	MultiImportResult,
	PipelineSourceResult,
} from "./types";

export interface DataExchangeEventMap {
	// ── Import commands & lifecycle ──────────────────────────

	/** Command: execute CSV import with provided config */
	"dataExchange.import.execute": { config: ImportConfig; operationId?: string };

	/** Import process started */
	"dataExchange.import.started": { operationId: string; config: ImportConfig; totalRows: number; pipelineId?: string };

	/** Progress update during import */
	"dataExchange.import.progress": {
		operationId: string;
		current: number;
		total: number;
		lastFilename: string;
		pipelineId?: string;
	};

	/** Import completed successfully */
	"dataExchange.import.completed": { operationId: string; result: ImportResult; pipelineId?: string };

	/** Import failed */
	"dataExchange.import.failed": { operationId: string; error: string; config: ImportConfig; pipelineId?: string };

	// ── Export commands & lifecycle ──────────────────────────

	/** Command: execute export with provided config */
	"dataExchange.export.execute": { config: ExportConfig; operationId?: string };

	/** Export process started */
	"dataExchange.export.started": { operationId: string; config: ExportConfig; pipelineId?: string };

	/** Progress update during export */
	"dataExchange.export.progress": {
		operationId: string;
		current: number;
		total: number;
		currentFile: string;
		pipelineId?: string;
	};

	/** Export completed successfully */
	"dataExchange.export.completed": { operationId: string; result: ExportResult; pipelineId?: string };

	/** Export failed */
	"dataExchange.export.failed": { operationId: string; error: string; config: ExportConfig; pipelineId?: string };

	// ── Pipeline commands & lifecycle ───────────────────────

	/** Command: execute a multi-import pipeline */
	"dataExchange.pipeline.execute": { pipelineId: string };

	/** Pipeline started (before first source) */
	"dataExchange.pipeline.started": {
		pipeline: SavedMultiImportPipeline;
		totalSources: number;
	};

	/** Progress: one source completed within the pipeline */
	"dataExchange.pipeline.sourceCompleted": {
		pipelineId: string;
		sourceIndex: number;
		totalSources: number;
		sourceResult: PipelineSourceResult;
	};

	/** Full pipeline completed */
	"dataExchange.pipeline.completed": { result: MultiImportResult };

	/** Pipeline failed (top-level error) */
	"dataExchange.pipeline.failed": { error: string; pipelineId: string };

	// ── Config lifecycle ────────────────────────────────────

	/** Emitted after any saved config is created or deleted */
	"dataExchange.config.changed": {
		importCount: number;
		exportCount: number;
	};
}
