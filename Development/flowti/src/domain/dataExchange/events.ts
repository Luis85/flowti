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
	"dataExchange.import.execute": { config: ImportConfig };

	/** Import process started */
	"dataExchange.import.started": { config: ImportConfig; totalRows: number };

	/** Progress update during import */
	"dataExchange.import.progress": {
		current: number;
		total: number;
		lastFilename: string;
	};

	/** Import completed successfully */
	"dataExchange.import.completed": { result: ImportResult };

	/** Import failed */
	"dataExchange.import.failed": { error: string; config: ImportConfig };

	// ── Export commands & lifecycle ──────────────────────────

	/** Command: execute export with provided config */
	"dataExchange.export.execute": { config: ExportConfig };

	/** Export process started */
	"dataExchange.export.started": { config: ExportConfig };

	/** Export completed successfully */
	"dataExchange.export.completed": { result: ExportResult };

	/** Export failed */
	"dataExchange.export.failed": { error: string; config: ExportConfig };

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
