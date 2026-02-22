/**
 * Pipeline execution logic — multi-source import + .base file creation.
 *
 * Extracted from DataExchangeService to reduce its LOC.
 */

import type { IEventBus } from "../../infrastructure/events/types";
import type { IFileSystemClient } from "../../infrastructure/filesystem/types";
import type { ImportService } from "./ImportService";
import type { ExportService } from "./ExportService";
import type {
	ColumnMapping,
	FileExistsCallback,
	ImportConfig,
	MultiImportResult,
	PipelinePreviewEntry,
	PipelinePreviewResult,
	PipelinePreviewSource,
	PipelineSourceResult,
	SavedExportConfig,
	SavedMultiImportPipeline,
} from "./types";
import type { CanvasService } from "../canvas/CanvasService";
import { basename } from "../../utils/pathUtils";

export interface PipelineExecutorDeps {
	eventBus: IEventBus;
	importService: ImportService;
	exportService: ExportService;
	fileSystem: IFileSystemClient;
	getPipeline: (id: string) => SavedMultiImportPipeline | undefined;
	getExportConfig: (id: string) => SavedExportConfig | undefined;
	getCanvasService?: () => CanvasService | undefined;
}

export class PipelineExecutor {
	constructor(private deps: PipelineExecutorDeps) {}

	/**
	 * Builds a preview of what the pipeline would do without executing it.
	 *
	 * Parses each source CSV, extracts merge key values, deduplicates them,
	 * constructs expected filenames, and checks whether they already exist.
	 */
	async buildPreview(
		pipeline: SavedMultiImportPipeline,
		fileExists: FileExistsCallback,
	): Promise<PipelinePreviewResult> {
		const sources: PipelinePreviewSource[] = [];

		for (const source of pipeline.sources) {
			try {
				const parsed = await this.deps.importService.parseFile(source.csvPath);
				const mergeKeyIndex = parsed.headers.indexOf(source.mergeKeyColumn);
				if (mergeKeyIndex < 0) {
					sources.push({
						sourceId: source.id,
						csvName: basename(source.csvPath) || source.csvPath,
						rowCount: 0,
						columns: [],
						mergeKeyValues: [],
						error: `Merge key column "${source.mergeKeyColumn}" not found`,
					});
					continue;
				}

				const mergeKeyValues = parsed.rows
					.map((row) => row[mergeKeyIndex])
					.filter((v): v is string => v !== undefined && v !== "");

				const columns = source.columnMappings
					.filter((m) => m.included && m.csvColumn !== source.mergeKeyColumn)
					.map((m) => m.frontmatterKey);

				sources.push({
					sourceId: source.id,
					csvName: basename(source.csvPath) || source.csvPath,
					rowCount: parsed.rows.length,
					columns,
					mergeKeyValues,
				});
			} catch (err) {
				sources.push({
					sourceId: source.id,
					csvName: basename(source.csvPath) || source.csvPath,
					rowCount: 0,
					columns: [],
					mergeKeyValues: [],
					error: err instanceof Error ? err.message : String(err),
				});
			}
		}

		const allKeys = new Set<string>();
		for (const src of sources) {
			for (const v of src.mergeKeyValues) allKeys.add(v);
		}

		const entries: PipelinePreviewEntry[] = [];
		for (const key of allKeys) {
			const sanitized = this.deps.importService.sanitizeFilename(key);
			if (!sanitized) continue;
			const prefix = pipeline.namePrefix ?? "";
			const suffix = pipeline.nameSuffix ?? "";
			const filename = `${prefix}${sanitized}${suffix}`;
			const notePath = `${pipeline.targetFolder}/${filename}.md`;
			entries.push({ key, filename, exists: fileExists(notePath) });
		}

		return {
			sources,
			entries,
			toCreate: entries.filter((e) => !e.exists).length,
			toUpdate: entries.filter((e) => e.exists).length,
		};
	}

	async executePipeline(pipelineId: string): Promise<MultiImportResult> {
		const pipeline = this.deps.getPipeline(pipelineId);
		if (!pipeline) throw new Error(`Pipeline not found: ${pipelineId}`);
		const canvasCount = pipeline.canvasConfigIds?.length ?? 0;
		const totalSourceCount = pipeline.sources.length + canvasCount;
		if (totalSourceCount === 0) throw new Error("Pipeline has no sources");

		await this.deps.eventBus.emit("dataExchange.pipeline.started", {
			pipeline,
			totalSources: totalSourceCount,
		});

		const result: MultiImportResult = {
			totalSources: totalSourceCount,
			completedSources: 0,
			totalRows: 0,
			created: 0,
			updated: 0,
			skipped: 0,
			failed: 0,
			errors: [],
			sourceResults: [],
		};

		for (let i = 0; i < pipeline.sources.length; i++) {
			const source = pipeline.sources[i];

			// Auto-build merge key mapping
			const mergeKeyMapping: ColumnMapping = {
				csvColumn: source.mergeKeyColumn,
				frontmatterKey: pipeline.mergeKey,
				included: true,
			};

			// Filter out any user mapping that already targets the merge key
			const otherMappings = source.columnMappings.filter(
				(m) => m.frontmatterKey !== pipeline.mergeKey,
			);

			// Merge note type into custom properties if set
			const customProps = { ...source.customProperties };
			if (pipeline.noteType) {
				customProps.type = pipeline.noteType;
			}

			const importConfig: ImportConfig = {
				sourcePath: source.csvPath,
				targetFolder: pipeline.targetFolder,
				nameColumn: source.mergeKeyColumn,
				namePrefix: pipeline.namePrefix,
				nameSuffix: pipeline.nameSuffix,
				columnMappings: [mergeKeyMapping, ...otherMappings],
				conflictStrategy: "update",
				customProperties: Object.keys(customProps).length > 0 ? customProps : undefined,
			};

			try {
				const sourceResult = await this.deps.importService.executeImport(importConfig, { pipelineId: pipeline.id });
				const psr: PipelineSourceResult = {
					sourceId: source.id,
					csvPath: source.csvPath,
					result: sourceResult,
				};
				result.sourceResults.push(psr);
				result.totalRows += sourceResult.totalRows;
				result.created += sourceResult.created;
				result.updated += sourceResult.updated;
				result.skipped += sourceResult.skipped;
				result.failed += sourceResult.failed;
				result.errors.push(...sourceResult.errors);
				result.completedSources++;

				await this.deps.eventBus.emit("dataExchange.pipeline.sourceCompleted", {
					pipelineId: pipeline.id,
					sourceIndex: i,
					totalSources: totalSourceCount,
					sourceResult: psr,
				});
			} catch (error) {
				result.sourceResults.push({
					sourceId: source.id,
					csvPath: source.csvPath,
					result: {
						totalRows: 0,
						created: 0,
						updated: 0,
						skipped: 0,
						failed: 1,
						errors: [{
							row: 0,
							filename: source.csvPath,
							error: error instanceof Error ? error.message : String(error),
						}],
					},
				});
				result.failed++;
				result.errors.push({
					row: 0,
					filename: source.csvPath,
					error: error instanceof Error ? error.message : String(error),
				});
			}
		}

		// Execute canvas import steps
		const canvasService = this.deps.getCanvasService?.();
		if (canvasService && pipeline.canvasConfigIds?.length) {
			const csvCount = pipeline.sources.length;
			for (let j = 0; j < pipeline.canvasConfigIds.length; j++) {
				const configId = pipeline.canvasConfigIds[j];
				try {
					const canvasResult = await canvasService.runImport(configId);
					const mappedErrors = canvasResult.errors.map((e) => ({
						row: 0,
						filename: e.title || e.nodeId,
						error: e.error,
					}));
					const psr: PipelineSourceResult = {
						sourceId: configId,
						csvPath: canvasResult.canvasPath,
						result: {
							totalRows: canvasResult.totalNodes,
							created: canvasResult.imported,
							updated: 0,
							skipped: canvasResult.skipped,
							failed: canvasResult.errors.length,
							errors: mappedErrors,
						},
					};
					result.sourceResults.push(psr);
					result.totalRows += canvasResult.totalNodes;
					result.created += canvasResult.imported;
					result.skipped += canvasResult.skipped;
					result.failed += canvasResult.errors.length;
					result.errors.push(...mappedErrors);
					result.completedSources++;

					await this.deps.eventBus.emit("dataExchange.pipeline.sourceCompleted", {
						pipelineId: pipeline.id,
						sourceIndex: csvCount + j,
						totalSources: totalSourceCount,
						sourceResult: psr,
					});
				} catch (error) {
					const configName = canvasService.getConfig(configId)?.name ?? configId;
					result.sourceResults.push({
						sourceId: configId,
						csvPath: configName,
						result: {
							totalRows: 0,
							created: 0,
							updated: 0,
							skipped: 0,
							failed: 1,
							errors: [{
								row: 0,
								filename: configName,
								error: error instanceof Error ? error.message : String(error),
							}],
						},
					});
					result.failed++;
					result.errors.push({
						row: 0,
						filename: configName,
						error: error instanceof Error ? error.message : String(error),
					});
				}
			}
		}

		// Create .base view if configured
		if (pipeline.createBase) {
			await this.createPipelineBaseFile(pipeline);
		}

		// Run linked exports if configured
		for (const exportId of pipeline.exportConfigIds ?? []) {
			const exportCfg = this.deps.getExportConfig(exportId);
			if (exportCfg) {
				try {
					await this.deps.exportService.executeExport({
						sourcePath: exportCfg.sourcePath,
						sourceType: exportCfg.sourceType,
						format: exportCfg.format,
						outputPath: exportCfg.outputPath,
						columns: exportCfg.columns,
						fileProperties: exportCfg.fileProperties,
						baseViewIndex: exportCfg.baseViewIndex,
						isExternal: exportCfg.isExternal,
						conflictStrategy: exportCfg.conflictStrategy,
					}, { pipelineId: pipeline.id });
				} catch (err) {
					console.error(`[Flowti] Pipeline export step failed (${exportCfg.name}): ${err instanceof Error ? err.message : String(err)}`);
				}
			}
		}

		return result;
	}

	/** Creates a .base view file for the pipeline's target folder. */
	private async createPipelineBaseFile(pipeline: SavedMultiImportPipeline): Promise<void> {
		let path = (pipeline.basePath ?? "").trim();
		if (!path) {
			// Default: {targetFolder}/{pipelineName}.base
			const safeName = pipeline.name.replace(/[\\/:*?"<>|]/g, "_");
			path = pipeline.targetFolder
				? `${pipeline.targetFolder}/${safeName}.base`
				: `${safeName}.base`;
		}
		if (!path.endsWith(".base")) path += ".base";

		// Never overwrite an existing base file
		try {
			await this.deps.fileSystem.readFile(path);
			return; // File exists — don't overwrite
		} catch {
			// File doesn't exist — proceed to create
		}

		// Gather all included column names across all sources
		const columns = new Set<string>();
		columns.add(pipeline.mergeKey);
		if (pipeline.noteType) {
			columns.add("type");
		}
		for (const source of pipeline.sources) {
			for (const m of source.columnMappings) {
				if (m.included) columns.add(m.frontmatterKey);
			}
			if (source.customProperties) {
				for (const key of Object.keys(source.customProperties)) {
					columns.add(key);
				}
			}
		}

		const lines: string[] = [];
		lines.push("filters:");
		lines.push("  and:");
		lines.push(`    - 'file.inFolder("${pipeline.targetFolder}")'`);
		lines.push(`    - 'file.ext == "md"'`);
		lines.push("");
		lines.push("views:");
		lines.push("  - name: \"Merged Data\"");
		lines.push("    type: \"table\"");
		lines.push("    order:");
		lines.push("      - \"file.name\"");
		for (const col of columns) {
			lines.push(`      - "${col}"`);
		}
		lines.push("");

		try {
			await this.deps.fileSystem.createFile(path, lines.join("\n"), { createFolders: true });
		} catch (error) {
			console.error("[Flowti] Failed to create pipeline base file", error);
		}
	}
}
