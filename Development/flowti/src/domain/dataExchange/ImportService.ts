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
	async executeImport(config: ImportConfig): Promise<ImportResult> {
		const content = await this.fileSystem.readFile(config.sourcePath);
		const parsed = this.csvParser.parse(content);

		await this.eventBus.emit("dataExchange.import.started", {
			config,
			totalRows: parsed.rowCount,
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
				current: i + 1,
				total: parsed.rowCount,
				lastFilename: row[nameColumnIndex] ?? "",
			});
		}

		return result;
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
	 * Builds Markdown content with YAML frontmatter.
	 */
	buildNoteContent(frontmatter: Record<string, string>): string {
		const lines = ["---"];
		for (const [key, value] of Object.entries(frontmatter)) {
			const needsQuotes =
				/[:#{}[\],&*?|>!%@`]/.test(value) ||
				value.includes("\n") ||
				value.includes('"');
			if (needsQuotes) {
				const escaped = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
				lines.push(`${key}: "${escaped}"`);
			} else {
				lines.push(`${key}: ${value}`);
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
		const filename = this.sanitizeFilename(rawName);

		if (!filename) {
			result.errors.push({
				row: rowIndex + 1,
				filename: rawName ?? "",
				error: "Empty filename after sanitization",
			});
			result.failed++;
			return;
		}

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

		// Check if note already exists
		const exists = await this.fileExists(notePath);

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

	private async fileExists(path: string): Promise<boolean> {
		try {
			await this.fileSystem.readFile(path);
			return true;
		} catch {
			return false;
		}
	}
}
