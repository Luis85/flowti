/**
 * ImportService — orchestrates CSV import into vault notes.
 *
 * Pipeline: read CSV → parse → map columns → create/update notes.
 * Each CSV row becomes one Markdown note with YAML frontmatter.
 */

import type { IEventBus } from "../../infrastructure/events/types";
import type { IFileSystemClient } from "../../infrastructure/filesystem/types";
import type { ImportConfig, ImportResult, ParsedCsv } from "./types";
import { CsvParser } from "./CsvParser";
import { generateUUID } from "../../utils/helpers";

export interface ImportExecuteOptions {
	operationId?: string;
	pipelineId?: string;
}

export interface ImportServiceDeps {
	eventBus: IEventBus;
	fileSystem: IFileSystemClient;
}

export class ImportService {
	private eventBus: IEventBus;
	private fileSystem: IFileSystemClient;
	private csvParser: CsvParser;

	constructor(deps: ImportServiceDeps) {
		this.eventBus = deps.eventBus;
		this.fileSystem = deps.fileSystem;
		this.csvParser = new CsvParser();
	}

	/**
	 * Parses a CSV file from the vault and returns structured data for preview.
	 */
	async parseFile(filePath: string): Promise<ParsedCsv> {
		const content = await this.fileSystem.readFile(filePath);
		return this.csvParser.parse(content);
	}

	/**
	 * Executes the full import pipeline.
	 */
	async executeImport(config: ImportConfig, options?: ImportExecuteOptions): Promise<ImportResult> {
		const operationId = options?.operationId ?? generateUUID();
		const pipelineId = options?.pipelineId;

		try {
			const content = await this.fileSystem.readFile(config.sourcePath);
			const parsed = this.csvParser.parse(content);

			await this.eventBus.emit("dataExchange.import.started", {
				operationId,
				config,
				totalRows: parsed.rowCount,
				pipelineId,
			});

			const result: ImportResult = {
				totalRows: parsed.rowCount,
				created: 0,
				updated: 0,
				skipped: 0,
				failed: 0,
				errors: [],
			};

			const nameColumnIndex = parsed.headers.indexOf(config.nameColumn);
			if (nameColumnIndex === -1) {
				throw new Error(
					`Name column "${config.nameColumn}" not found in CSV headers`,
				);
			}

			for (let i = 0; i < parsed.rows.length; i++) {
				const row = parsed.rows[i];
				try {
					await this.processRow(
						row,
						i,
						nameColumnIndex,
						parsed.headers,
						config,
						result,
					);
				} catch (error) {
					const errMsg =
						error instanceof Error ? error.message : String(error);
					result.errors.push({
						row: i + 1,
						filename: row[nameColumnIndex] ?? "",
						error: errMsg,
					});
					result.failed++;
				}

				await this.eventBus.emit("dataExchange.import.progress", {
					operationId,
					current: i + 1,
					total: parsed.rowCount,
					lastFilename: row[nameColumnIndex] ?? "",
					pipelineId,
				});
			}

			await this.eventBus.emit("dataExchange.import.completed", {
				operationId,
				result,
				sourcePath: config.sourcePath,
				pipelineId,
			});
			return result;
		} catch (error) {
			await this.eventBus.emit("dataExchange.import.failed", {
				operationId,
				error: error instanceof Error ? error.message : String(error),
				config,
				pipelineId,
			});
			throw error;
		}
	}

	/**
	 * Sanitizes a string for use as a vault filename.
	 * Removes characters not allowed in Obsidian vault paths.
	 */
	sanitizeFilename(name: string): string {
		if (!name) return "";
		return name
			.replace(/[\\/:*?"<>|#^[\]]/g, "")
			.replace(/\s+/g, " ")
			.trim();
	}

	/**
	 * Sanitizes a string for use as a YAML frontmatter key.
	 * Replaces non-alphanumeric characters (except hyphens and underscores)
	 * and ensures the key starts with a letter or underscore.
	 */
	sanitizeYamlKey(key: string): string {
		if (!key) return "_empty";
		const sanitized = key.replace(/[^a-zA-Z0-9_-]/g, "_");
		return /^[a-zA-Z_]/.test(sanitized) ? sanitized : `_${sanitized}`;
	}

	/**
	 * Builds Markdown content with YAML frontmatter.
	 */
	buildNoteContent(frontmatter: Record<string, string>): string {
		const lines = ["---"];
		for (const [key, value] of Object.entries(frontmatter)) {
			const safeKey = this.sanitizeYamlKey(key);
			const needsQuotes =
				/[:#{}[\],&*?|>!%@`]/.test(value) ||
				value.includes("\n") ||
				value.includes('"');
			if (needsQuotes) {
				const escaped = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
				lines.push(`${safeKey}: "${escaped}"`);
			} else {
				lines.push(`${safeKey}: ${value}`);
			}
		}
		lines.push("---", "", "");
		return lines.join("\n");
	}

	// ── Private ─────────────────────────────────────────────

	private async processRow(
		row: string[],
		rowIndex: number,
		nameColumnIndex: number,
		headers: string[],
		config: ImportConfig,
		result: ImportResult,
	): Promise<void> {
		const rawName = row[nameColumnIndex];
		const baseName = this.sanitizeFilename(rawName);

		if (!baseName) {
			result.errors.push({
				row: rowIndex + 1,
				filename: rawName ?? "",
				error: "Empty filename after sanitization",
			});
			result.failed++;
			return;
		}

		const prefix = config.namePrefix ?? "";
		const suffix = config.nameSuffix ?? "";
		const filename = `${prefix}${baseName}${suffix}`;

		const notePath = `${config.targetFolder}/${filename}.md`;

		// Build frontmatter from mapped columns
		const frontmatter: Record<string, string> = {};
		for (const mapping of config.columnMappings) {
			if (!mapping.included) continue;
			const colIndex = headers.indexOf(mapping.csvColumn);
			if (colIndex >= 0 && row[colIndex] !== undefined && row[colIndex] !== "") {
				frontmatter[mapping.frontmatterKey] = row[colIndex];
			}
		}

		// Merge custom properties into frontmatter
		if (config.customProperties) {
			for (const [key, value] of Object.entries(config.customProperties)) {
				frontmatter[key] = value;
			}
		}

		// Check if note already exists
		const exists = await this.fileSystem.fileExists(notePath);

		if (exists) {
			switch (config.conflictStrategy) {
				case "skip":
					result.skipped++;
					return;
				case "update":
					await this.fileSystem.updateFrontmatter(notePath, frontmatter);
					result.updated++;
					return;
				case "overwrite": {
					const noteContent = this.buildNoteContent(frontmatter);
					await this.fileSystem.updateFile(notePath, noteContent);
					result.updated++;
					return;
				}
			}
		} else {
			const noteContent = this.buildNoteContent(frontmatter);
			await this.fileSystem.createFile(notePath, noteContent, {
				createFolders: true,
			});
			result.created++;
		}
	}

}
