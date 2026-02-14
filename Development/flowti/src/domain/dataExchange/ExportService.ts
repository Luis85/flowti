/**
 * ExportService — orchestrates export of vault notes to CSV or tab-delimited files.
 *
 * Supports two source types:
 * - **Folder**: exports all notes in a folder, extracting frontmatter as columns
 * - **Base**: parses a `.base` YAML file, evaluates its filters against the vault,
 *   and exports the matching files
 *
 * The `listFiles` callback is injected to avoid coupling to the Obsidian API.
 */

import type { IEventBus } from "../../infrastructure/events/types";
import type { IFileSystemClient } from "../../infrastructure/filesystem/types";
import type {
	ExportConfig,
	ExportResult,
	ParsedBaseFile,
	VaultFileInfo,
} from "./types";
import { STANDARD_FILE_PROPERTIES } from "./types";
import { CsvParser } from "./CsvParser";
import { BaseQueryEngine } from "./BaseQueryEngine";

export type ListFilesCallback = (folderPath: string) => VaultFileInfo[];
export type WriteExternalFileCallback = (absolutePath: string, content: string) => Promise<void>;
/** Returns file content if it exists, null if it does not. */
export type ReadExternalFileCallback = (absolutePath: string) => Promise<string | null>;

export interface ExportServiceDeps {
	eventBus: IEventBus;
	fileSystem: IFileSystemClient;
	listFiles?: ListFilesCallback;
	writeExternalFile?: WriteExternalFileCallback;
	readExternalFile?: ReadExternalFileCallback;
}

export class ExportService {
	private eventBus: IEventBus;
	private fileSystem: IFileSystemClient;
	private listFiles: ListFilesCallback;
	private writeExternalFile: WriteExternalFileCallback | null;
	private readExternalFile: ReadExternalFileCallback | null;
	private csvParser: CsvParser;
	private baseEngine: BaseQueryEngine;

	constructor(deps: ExportServiceDeps) {
		this.eventBus = deps.eventBus;
		this.fileSystem = deps.fileSystem;
		this.listFiles = deps.listFiles ?? (() => []);
		this.writeExternalFile = deps.writeExternalFile ?? null;
		this.readExternalFile = deps.readExternalFile ?? null;
		this.csvParser = new CsvParser();
		this.baseEngine = new BaseQueryEngine();
	}

	/**
	 * Replaces the listFiles callback. Called from main.ts once the
	 * vault is available (onLayoutReady pattern).
	 */
	setListFiles(callback: ListFilesCallback): void {
		this.listFiles = callback;
	}

	/**
	 * Sets the callback for writing files to absolute filesystem paths
	 * outside the vault.
	 */
	setWriteExternalFile(callback: WriteExternalFileCallback): void {
		this.writeExternalFile = callback;
	}

	/**
	 * Sets the callback for reading files from absolute filesystem paths
	 * outside the vault. Used for skip/append conflict resolution.
	 */
	setReadExternalFile(callback: ReadExternalFileCallback): void {
		this.readExternalFile = callback;
	}

	/**
	 * Scans a source and returns available column names.
	 *
	 * - **Folder**: discovers frontmatter keys across all files.
	 * - **Base**: returns the view's `order` array (its configured columns),
	 *   normalized to frontmatter key names (`note.X` → `X`, `file.*` filtered out).
	 *   Falls back to frontmatter scan if the view has no `order`.
	 */
	async scanColumns(
		sourcePath: string,
		sourceType: "folder" | "base",
		viewIndex?: number,
	): Promise<string[]> {
		// For base sources, try the view's column config first
		if (sourceType === "base") {
			const content = await this.fileSystem.readFile(sourcePath);
			const baseFile = this.baseEngine.parseBaseFile(content);
			const viewColumns = this.baseEngine.getViewColumns(baseFile, viewIndex ?? 0);
			if (viewColumns && viewColumns.length > 0) {
				return this.normalizeBaseColumns(viewColumns, baseFile.formulas);
			}
		}

		// Fallback: scan frontmatter from resolved files
		const files = await this.resolveFiles(sourcePath, sourceType, viewIndex);
		const columnSet = new Set<string>();

		for (const file of files) {
			if (file.frontmatter) {
				for (const key of Object.keys(file.frontmatter)) {
					if (key !== "position") {
						columnSet.add(key);
					}
				}
			}
		}

		return Array.from(columnSet).sort();
	}

	/**
	 * Normalizes base view column references to clean property names.
	 * - `note.stage` → `stage`
	 * - `formula.X` → resolves via formulas map (e.g. `formula.foo` with `foo: description` → `description`)
	 * - `file.*` → filtered out (handled by fileProperties section)
	 * - `domain` → `domain` (direct property)
	 */
	private normalizeBaseColumns(
		viewColumns: string[],
		formulas?: Record<string, string>,
	): string[] {
		const result: string[] = [];
		for (const col of viewColumns) {
			if (col.startsWith("file.")) continue;
			if (col.startsWith("note.")) {
				result.push(col.slice(5));
			} else if (col.startsWith("formula.")) {
				const formulaName = col.slice(8);
				const expression = formulas?.[formulaName];
				// If the formula resolves to a simple property name, use it
				if (expression && /^[\w.]+$/.test(expression)) {
					result.push(expression);
				} else {
					// Fallback: use formula name as-is
					result.push(formulaName);
				}
			} else {
				result.push(col);
			}
		}
		return result;
	}

	/**
	 * Returns file property keys from a base view's order array.
	 * Used to pre-select file properties in the export modal.
	 */
	async scanViewFileProperties(
		sourcePath: string,
		viewIndex: number,
	): Promise<string[]> {
		const content = await this.fileSystem.readFile(sourcePath);
		const baseFile = this.baseEngine.parseBaseFile(content);
		const viewColumns = this.baseEngine.getViewColumns(baseFile, viewIndex);
		if (!viewColumns) return [];
		return viewColumns.filter((col) => col.startsWith("file."));
	}

	/**
	 * Returns display name overrides from a base file's `properties` section.
	 * Keys are normalized (file.folder stays as file.folder, note.X → X).
	 */
	async scanDisplayNames(
		sourcePath: string,
	): Promise<Record<string, string>> {
		const content = await this.fileSystem.readFile(sourcePath);
		const baseFile = this.baseEngine.parseBaseFile(content);
		const result: Record<string, string> = {};

		if (!baseFile.properties) return result;

		for (const [key, config] of Object.entries(baseFile.properties)) {
			if (config.displayName) {
				result[key] = config.displayName;
			}
		}
		return result;
	}

	/**
	 * Returns the list of files that would be exported.
	 * Useful for preview rendering.
	 */
	async resolveExportFiles(
		sourcePath: string,
		sourceType: "folder" | "base",
		viewIndex?: number,
	): Promise<VaultFileInfo[]> {
		return this.resolveFiles(sourcePath, sourceType, viewIndex);
	}

	/** Returns the BaseQueryEngine for synchronous parsing from pre-read content. */
	getBaseEngine(): BaseQueryEngine {
		return this.baseEngine;
	}

	/**
	 * Parses a `.base` file and returns its view configurations.
	 * Useful for the view-select page of the export modal.
	 */
	async parseBaseViews(
		basePath: string,
	): Promise<ParsedBaseFile> {
		const content = await this.fileSystem.readFile(basePath);
		return this.baseEngine.parseBaseFile(content);
	}

	/**
	 * Executes the full export pipeline.
	 */
	async executeExport(config: ExportConfig): Promise<ExportResult> {
		await this.eventBus.emit("dataExchange.export.started", { config });

		const strategy = config.conflictStrategy ?? "overwrite";

		// Check for existing file when skip or append
		if (strategy !== "overwrite") {
			const existing = await this.readOutputFile(config);
			if (existing !== null && strategy === "skip") {
				return {
					totalRows: 0,
					totalColumns: 0,
					outputPath: config.outputPath,
					skipped: true,
				};
			}
		}

		const files = await this.resolveFiles(
			config.sourcePath,
			config.sourceType,
			config.baseViewIndex,
		);

		// Build headers: displayNames override → clean label fallback
		const dn = config.displayNames ?? {};
		const headers = [
			...config.fileProperties.map((fp) => dn[fp] ?? this.filePropertyLabel(fp)),
			...config.columns.map((col) => dn[col] ?? dn[`note.${col}`] ?? col),
		];

		// Build row data (keyed by header labels)
		const rows: Array<Record<string, string>> = [];
		for (const file of files) {
			const row: Record<string, string> = {};
			for (let i = 0; i < config.fileProperties.length; i++) {
				row[headers[i]] = this.resolveFileProperty(file, config.fileProperties[i]);
			}
			const fpCount = config.fileProperties.length;
			for (let i = 0; i < config.columns.length; i++) {
				const value = file.frontmatter?.[config.columns[i]];
				row[headers[fpCount + i]] =
					value !== undefined && value !== null ? String(value) : "";
			}
			rows.push(row);
		}

		// Generate output content
		let content = this.csvParser.generate(headers, rows, config.format);

		// Append: read existing file and prepend its content
		if (strategy === "append") {
			const existing = await this.readOutputFile(config);
			if (existing !== null && existing.trim().length > 0) {
				// Strip the header line from the new content and append rows to existing
				const newLines = content.split("\n");
				const dataOnly = newLines.slice(1).join("\n");
				content = existing.trimEnd() + "\n" + dataOnly;
			}
		}

		// Write output file
		await this.writeOutputFile(config, content);

		return {
			totalRows: rows.length,
			totalColumns: headers.length,
			outputPath: config.outputPath,
		};
	}

	/**
	 * Returns the clean export label for a file property key.
	 */
	private filePropertyLabel(key: string): string {
		const def = STANDARD_FILE_PROPERTIES.find((p) => p.key === key);
		return def?.label ?? key.replace(/^file\./, "");
	}

	/**
	 * Resolves a file property value from a VaultFileInfo.
	 */
	private resolveFileProperty(file: VaultFileInfo, property: string): string {
		switch (property) {
			case "file.name": return file.basename;
			case "file.basename": return file.basename;
			case "file.fullname": return `${file.basename}.${file.extension}`;
			case "file.path": return file.path;
			case "file.folder": return file.folder;
			case "file.ext": return file.extension;
			case "file.ctime":
				return file.stat?.ctime ? new Date(file.stat.ctime).toISOString() : "";
			case "file.mtime":
				return file.stat?.mtime ? new Date(file.stat.mtime).toISOString() : "";
			case "file.size":
				return file.stat?.size !== undefined ? String(file.stat.size) : "";
			case "file.tags": return file.tags?.join(", ") ?? "";
			default: return "";
		}
	}

	// ── Private ─────────────────────────────────────────────

	/**
	 * Reads the output file if it exists. Returns content or null.
	 */
	private async readOutputFile(config: ExportConfig): Promise<string | null> {
		if (config.isExternal) {
			return this.readExternalFile
				? this.readExternalFile(config.outputPath)
				: null;
		}
		try {
			return await this.fileSystem.readFile(config.outputPath);
		} catch {
			return null;
		}
	}

	/**
	 * Writes the output file (vault or external).
	 */
	private async writeOutputFile(config: ExportConfig, content: string): Promise<void> {
		if (config.isExternal) {
			if (!this.writeExternalFile) {
				throw new Error("External file writing is not available");
			}
			await this.writeExternalFile(config.outputPath, content);
		} else {
			// Check if file already exists — vault.create() throws on duplicates
			const existing = await this.readOutputFile(config);
			if (existing !== null) {
				await this.fileSystem.updateFile(config.outputPath, content);
			} else {
				await this.fileSystem.createFile(config.outputPath, content, {
					createFolders: true,
				});
			}
		}
	}

	private async resolveFiles(
		sourcePath: string,
		sourceType: "folder" | "base",
		viewIndex?: number,
	): Promise<VaultFileInfo[]> {
		if (sourceType === "folder") {
			return this.listFiles(sourcePath);
		}

		// .base file: parse YAML, evaluate filters
		const content = await this.fileSystem.readFile(sourcePath);
		const baseFile = this.baseEngine.parseBaseFile(content);

		// Get all vault files — base filters define the scope
		const allFiles = this.listFiles("");

		return this.baseEngine.resolveView(allFiles, baseFile, viewIndex ?? 0);
	}
}
