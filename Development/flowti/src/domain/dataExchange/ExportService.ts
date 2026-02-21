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
	ResolvedColumn,
	VaultFileInfo,
} from "./types";
import { STANDARD_FILE_PROPERTIES } from "./types";
import { CsvParser } from "./CsvParser";
import { BaseQueryEngine } from "./BaseQueryEngine";
import { PathMutex } from "../../utils/mutex";
import { generateUUID } from "../../utils/helpers";

export interface ExportExecuteOptions {
	operationId?: string;
	pipelineId?: string;
}

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
	private writeMutex = new PathMutex();

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
	 * - `formula.X` → resolves via formulas map:
	 *   - simple property: `foo: price` → `price`
	 *   - prop() reference: `foo: prop("price")` → `price`
	 *   - compound formula: `foo: prop("a") * prop("b")` → `foo` (formula name)
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
				if (expression) {
					const resolved = this.resolveFormulaExpression(expression);
					result.push(resolved ?? formulaName);
				} else {
					result.push(formulaName);
				}
			} else {
				result.push(col);
			}
		}
		return result;
	}

	/**
	 * Attempts to resolve a formula expression to a frontmatter property name.
	 * Returns the property name if resolvable, or null for compound formulas.
	 */
	private resolveFormulaExpression(expression: string): string | null {
		// Simple property reference: `price`, `status.value`
		if (/^[\w.]+$/.test(expression)) {
			return expression;
		}
		// Single prop() reference: `prop("price")` or `prop('price')`
		const propMatch = expression.match(/^prop\(["']([^"']+)["']\)$/);
		if (propMatch) {
			return propMatch[1];
		}
		// Compound formula — cannot resolve to a single property
		return null;
	}

	/**
	 * Resolves a formula column entry into a ResolvedColumn descriptor.
	 * Determines whether the formula targets a file property or frontmatter.
	 */
	private resolveFormulaColumn(
		key: string,
		formulaName: string,
		expression: string | undefined,
	): ResolvedColumn {
		if (!expression) {
			return {
				key,
				header: formulaName,
				source: "formula",
				resolveKey: formulaName,
				resolveSource: "frontmatter",
			};
		}

		const resolved = this.resolveFormulaExpression(expression);
		if (resolved && resolved.startsWith("file.")) {
			return {
				key,
				header: formulaName,
				source: "formula",
				resolveKey: resolved,
				resolveSource: "file",
			};
		}

		return {
			key,
			header: formulaName,
			source: "formula",
			resolveKey: resolved ?? formulaName,
			resolveSource: "frontmatter",
		};
	}

	/**
	 * Builds a displayName lookup map from a base file's properties section.
	 * Keys are the raw property keys (e.g. "note.baz.foo", "file.folder").
	 */
	private buildDisplayNameMap(
		properties?: Record<string, { displayName?: string }>,
	): Record<string, string> {
		const result: Record<string, string> = {};
		if (!properties) return result;
		for (const [key, config] of Object.entries(properties)) {
			if (config.displayName) {
				result[key] = config.displayName;
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
	 * Scans a Base view and returns unified ResolvedColumn descriptors
	 * preserving the exact column order, headers, and value resolution.
	 * Returns null if the view has no `order` array (caller falls back to legacy scan).
	 */
	async scanResolvedColumns(
		sourcePath: string,
		viewIndex: number,
	): Promise<ResolvedColumn[] | null> {
		const content = await this.fileSystem.readFile(sourcePath);
		const baseFile = this.baseEngine.parseBaseFile(content);
		const viewColumns = this.baseEngine.getViewColumns(baseFile, viewIndex);
		if (!viewColumns || viewColumns.length === 0) return null;

		const dnMap = this.buildDisplayNameMap(baseFile.properties);
		const result: ResolvedColumn[] = [];

		for (const col of viewColumns) {
			if (col.startsWith("file.")) {
				result.push({
					key: col,
					header: dnMap[col] ?? this.filePropertyLabel(col),
					source: "file",
					resolveKey: col,
				});
			} else if (col.startsWith("formula.")) {
				const formulaName = col.slice(8);
				const expression = baseFile.formulas?.[formulaName];
				result.push(this.resolveFormulaColumn(col, formulaName, expression));
			} else {
				// Bare property (e.g. "baz.foo") or note-prefixed (e.g. "note.stage")
				const propKey = col.startsWith("note.") ? col.slice(5) : col;
				result.push({
					key: col,
					header: dnMap[`note.${propKey}`] ?? dnMap[col] ?? propKey,
					source: "frontmatter",
					resolveKey: propKey,
				});
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
	async executeExport(config: ExportConfig, options?: ExportExecuteOptions): Promise<ExportResult> {
		const operationId = options?.operationId ?? generateUUID();
		const pipelineId = options?.pipelineId;
		await this.eventBus.emit("dataExchange.export.started", { operationId, config, pipelineId });

		try {
			const files = await this.resolveFiles(
				config.sourcePath,
				config.sourceType,
				config.baseViewIndex,
			);

			let headers: string[];
			let rows: Array<Record<string, string>>;

			if (config.resolvedColumns && config.resolvedColumns.length > 0) {
				// Unified column path for Base view exports
				headers = config.resolvedColumns.map((rc) => rc.header);
				rows = [];
				for (let fi = 0; fi < files.length; fi++) {
					const file = files[fi];
					const row: Record<string, string> = {};
					for (const rc of config.resolvedColumns!) {
						row[rc.header] = this.resolveColumnValue(file, rc);
					}
					rows.push(row);
					void this.eventBus.emit("dataExchange.export.progress", {
						operationId, current: fi + 1, total: files.length, currentFile: file.path, pipelineId,
					});
				}
			} else {
				// Legacy dual-array path for folder exports
				const dn = config.displayNames ?? {};
				headers = [
					...config.fileProperties.map((fp) => dn[fp] ?? this.filePropertyLabel(fp)),
					...config.columns.map((col) => dn[col] ?? dn[`note.${col}`] ?? col),
				];

				rows = [];
				for (let fi = 0; fi < files.length; fi++) {
					const file = files[fi];
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
					void this.eventBus.emit("dataExchange.export.progress", {
						operationId, current: fi + 1, total: files.length, currentFile: file.path, pipelineId,
					});
				}
			}

			// Generate output content
			const newContent = this.csvParser.generate(headers, rows, config.format);

			// Serialize all read-check-write operations targeting the same output path
			const result = await this.writeMutex.withLock(config.outputPath, async () => {
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

				let content = newContent;

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
			});

			await this.eventBus.emit("dataExchange.export.completed", { operationId, result, pipelineId });
			return result;
		} catch (error) {
			await this.eventBus.emit("dataExchange.export.failed", {
				operationId,
				error: error instanceof Error ? error.message : String(error),
				config,
				pipelineId,
			});
			throw error;
		}
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

	/**
	 * Resolves a column value from a file using a ResolvedColumn descriptor.
	 */
	private resolveColumnValue(file: VaultFileInfo, rc: ResolvedColumn): string {
		if (rc.source === "file") {
			return this.resolveFileProperty(file, rc.resolveKey);
		}
		if (rc.source === "formula") {
			if (rc.resolveSource === "file") {
				return this.resolveFileProperty(file, rc.resolveKey);
			}
			const value = file.frontmatter?.[rc.resolveKey];
			return value !== undefined && value !== null ? String(value) : "";
		}
		// frontmatter
		const value = file.frontmatter?.[rc.resolveKey];
		return value !== undefined && value !== null ? String(value) : "";
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
