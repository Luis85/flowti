/**
 * DataExchangeService — top-level orchestrator for import/export operations.
 *
 * Wires ImportService + ExportService and handles EventBus command events.
 * Follows the same service pattern as SubscriptionService.
 */

import type { IEventBus } from "../../infrastructure/events/types";
import type { IFileSystemClient } from "../../infrastructure/filesystem/types";
import type { IStorageProvider } from "../../utils/types";
import type {
	CsvDisplaySettings,
	DataDictionaryEntry,
	DataExchangeState,
	SavedImportConfig,
	SavedExportConfig,
	VaultFileInfo,
} from "./types";
import { ImportService } from "./ImportService";
import { ExportService, type ListFilesCallback, type WriteExternalFileCallback, type ReadExternalFileCallback } from "./ExportService";

export interface DataExchangeServiceOptions {
	eventBus: IEventBus;
	fileSystem: IFileSystemClient;
	storage?: IStorageProvider;
	listFiles?: ListFilesCallback;
}

function createDefaultState(): DataExchangeState {
	return { savedImportConfigs: [], savedExportConfigs: [] };
}

function generateId(): string {
	return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export class DataExchangeService {
	private eventBus: IEventBus;
	private fileSystem: IFileSystemClient;
	private storage: IStorageProvider | null;
	private state: DataExchangeState = createDefaultState();
	private importService: ImportService;
	private exportService: ExportService;
	private unsubscribes: (() => void)[] = [];
	private docsRootPath = "";

	constructor(options: DataExchangeServiceOptions) {
		this.eventBus = options.eventBus;
		this.fileSystem = options.fileSystem;
		this.storage = options.storage ?? null;

		this.importService = new ImportService({
			eventBus: options.eventBus,
			fileSystem: options.fileSystem,
		});

		this.exportService = new ExportService({
			eventBus: options.eventBus,
			fileSystem: options.fileSystem,
			listFiles: options.listFiles,
		});

		// Listen for import command
		this.unsubscribes.push(
			this.eventBus.on("dataExchange.import.execute", async (event) => {
				try {
					const result = await this.importService.executeImport(
						event.payload.config,
					);
					await this.eventBus.emit("dataExchange.import.completed", {
						result,
					});
				} catch (error) {
					await this.eventBus.emit("dataExchange.import.failed", {
						error:
							error instanceof Error
								? error.message
								: String(error),
						config: event.payload.config,
					});
				}
			}),
		);

		// Listen for export command
		this.unsubscribes.push(
			this.eventBus.on("dataExchange.export.execute", async (event) => {
				try {
					const result = await this.exportService.executeExport(
						event.payload.config,
					);
					await this.eventBus.emit("dataExchange.export.completed", {
						result,
					});
				} catch (error) {
					await this.eventBus.emit("dataExchange.export.failed", {
						error:
							error instanceof Error
								? error.message
								: String(error),
						config: event.payload.config,
					});
				}
			}),
		);

		// Track file renames → update saved config paths
		this.unsubscribes.push(
			this.eventBus.on("file.renamed", (event) => {
				void this.handleFileRenamed(
					event.payload.oldPath,
					event.payload.newPath,
				);
			}),
		);

		// Track folder renames → update configs with paths under the folder
		this.unsubscribes.push(
			this.eventBus.on("folder.renamed", (event) => {
				void this.handleFolderRenamed(
					event.payload.oldPath,
					event.payload.newPath,
				);
			}),
		);
	}

	/** Expose import service for direct modal access. */
	getImportService(): ImportService {
		return this.importService;
	}

	/** Expose export service for direct modal access. */
	getExportService(): ExportService {
		return this.exportService;
	}

	/**
	 * Injects the vault-aware listFiles callback.
	 * Called from main.ts once the vault is available (onLayoutReady).
	 */
	setListFiles(callback: (folderPath: string) => VaultFileInfo[]): void {
		this.exportService.setListFiles(callback);
	}

	/**
	 * Injects the callback for writing files outside the vault.
	 * Called from main.ts once the vault is available (onLayoutReady).
	 */
	setWriteExternalFile(callback: WriteExternalFileCallback): void {
		this.exportService.setWriteExternalFile(callback);
	}

	/**
	 * Injects the callback for reading files outside the vault.
	 * Used for skip/append conflict resolution on external exports.
	 */
	setReadExternalFile(callback: ReadExternalFileCallback): void {
		this.exportService.setReadExternalFile(callback);
	}

	/**
	 * Sets the documentation root path for auto-creating config doc files.
	 * Called from main.ts once settings are loaded.
	 */
	setDocsRootPath(path: string): void {
		this.docsRootPath = path;
	}

	// ── Persistence ─────────────────────────────────────────

	/** Loads persisted state from storage. Call once in onLayoutReady. */
	async load(): Promise<void> {
		if (!this.storage) return;
		const data = (await this.storage.load()) as {
			dataExchange?: DataExchangeState;
		} | null;
		if (data?.dataExchange) {
			this.state = data.dataExchange;
		}
	}

	private async saveState(): Promise<void> {
		if (!this.storage) return;
		const existingData = ((await this.storage.load()) as object) || {};
		await this.storage.save({
			...existingData,
			dataExchange: this.state,
		});
	}

	// ── Import config CRUD ──────────────────────────────────

	getSavedImportConfigs(): SavedImportConfig[] {
		return [...this.state.savedImportConfigs];
	}

	getImportConfig(id: string): SavedImportConfig | undefined {
		return this.state.savedImportConfigs.find((c) => c.id === id);
	}

	async saveImportConfig(
		config: Omit<SavedImportConfig, "id" | "createdAt">,
	): Promise<SavedImportConfig> {
		const saved: SavedImportConfig = {
			...config,
			id: generateId(),
			createdAt: Date.now(),
		};
		this.state.savedImportConfigs.push(saved);
		await this.saveState();
		this.emitConfigChanged();
		void this.createImportConfigDoc(saved);
		return saved;
	}

	async deleteImportConfig(id: string): Promise<void> {
		this.state.savedImportConfigs =
			this.state.savedImportConfigs.filter((c) => c.id !== id);
		await this.saveState();
		this.emitConfigChanged();
	}

	async updateImportConfig(
		id: string,
		updates: Partial<Omit<SavedImportConfig, "id" | "createdAt">>,
	): Promise<SavedImportConfig | undefined> {
		const cfg = this.state.savedImportConfigs.find((c) => c.id === id);
		if (!cfg) return undefined;
		Object.assign(cfg, updates);
		await this.saveState();
		this.emitConfigChanged();
		return { ...cfg };
	}

	/** Toggles the favourite status of an import config. */
	async toggleImportFavourite(id: string): Promise<void> {
		const cfg = this.getImportConfig(id);
		if (!cfg) return;
		await this.updateImportConfig(id, { favourite: !cfg.favourite });
	}

	/** Returns import configs whose sourcePath matches the given CSV path. */
	getImportConfigsForFile(csvPath: string): SavedImportConfig[] {
		return this.state.savedImportConfigs.filter(
			(c) => c.sourcePath === csvPath,
		);
	}

	// ── Export config CRUD ──────────────────────────────────

	getSavedExportConfigs(): SavedExportConfig[] {
		return [...this.state.savedExportConfigs];
	}

	getExportConfig(id: string): SavedExportConfig | undefined {
		return this.state.savedExportConfigs.find((c) => c.id === id);
	}

	async saveExportConfig(
		config: Omit<SavedExportConfig, "id" | "createdAt">,
	): Promise<SavedExportConfig> {
		const saved: SavedExportConfig = {
			...config,
			id: generateId(),
			createdAt: Date.now(),
		};
		this.state.savedExportConfigs.push(saved);
		await this.saveState();
		this.emitConfigChanged();
		void this.createExportConfigDoc(saved);
		return saved;
	}

	async deleteExportConfig(id: string): Promise<void> {
		this.state.savedExportConfigs =
			this.state.savedExportConfigs.filter((c) => c.id !== id);
		await this.saveState();
		this.emitConfigChanged();
	}

	async updateExportConfig(
		id: string,
		updates: Partial<Omit<SavedExportConfig, "id" | "createdAt">>,
	): Promise<SavedExportConfig | undefined> {
		const cfg = this.state.savedExportConfigs.find((c) => c.id === id);
		if (!cfg) return undefined;
		Object.assign(cfg, updates);
		await this.saveState();
		this.emitConfigChanged();
		return { ...cfg };
	}

	/** Toggles the favourite status of an export config. */
	async toggleExportFavourite(id: string): Promise<void> {
		const cfg = this.getExportConfig(id);
		if (!cfg) return;
		await this.updateExportConfig(id, { favourite: !cfg.favourite });
	}

	/** Returns export configs whose sourcePath matches the given path. */
	getExportConfigsForSource(sourcePath: string): SavedExportConfig[] {
		return this.state.savedExportConfigs.filter(
			(c) => c.sourcePath === sourcePath,
		);
	}

	/** Returns export configs whose outputPath matches the given path. */
	getExportConfigsForOutput(outputPath: string): SavedExportConfig[] {
		return this.state.savedExportConfigs.filter(
			(c) => c.outputPath === outputPath,
		);
	}

	// ── CSV display settings ────────────────────────────────

	getCsvDisplaySettings(csvPath: string): CsvDisplaySettings | undefined {
		return this.state.csvDisplaySettings?.[csvPath];
	}

	async saveCsvDisplaySettings(
		csvPath: string,
		settings: CsvDisplaySettings,
	): Promise<void> {
		if (!this.state.csvDisplaySettings) {
			this.state.csvDisplaySettings = {};
		}
		this.state.csvDisplaySettings[csvPath] = settings;
		await this.saveState();
	}

	// ── CSV file visibility ─────────────────────────────────

	getHiddenCsvPaths(): string[] {
		return this.state.hiddenCsvPaths ?? [];
	}

	async hideCsv(csvPath: string): Promise<void> {
		if (!this.state.hiddenCsvPaths) {
			this.state.hiddenCsvPaths = [];
		}
		if (!this.state.hiddenCsvPaths.includes(csvPath)) {
			this.state.hiddenCsvPaths.push(csvPath);
			await this.saveState();
		}
	}

	async unhideCsv(csvPath: string): Promise<void> {
		if (!this.state.hiddenCsvPaths) return;
		const idx = this.state.hiddenCsvPaths.indexOf(csvPath);
		if (idx !== -1) {
			this.state.hiddenCsvPaths.splice(idx, 1);
			await this.saveState();
		}
	}

	// ── Data dictionary ─────────────────────────────────────

	buildDataDictionary(): DataDictionaryEntry[] {
		const map = new Map<string, DataDictionaryEntry>();

		const getOrCreate = (name: string): DataDictionaryEntry => {
			let entry = map.get(name);
			if (!entry) {
				entry = {
					propertyName: name,
					usedInConfigs: [],
					csvColumnNames: [],
					sampleValues: [],
				};
				map.set(name, entry);
			}
			return entry;
		};

		for (const cfg of this.state.savedImportConfigs) {
			for (const m of cfg.columnMappings) {
				if (!m.included) continue;
				const entry = getOrCreate(m.frontmatterKey);
				entry.usedInConfigs.push({
					configId: cfg.id,
					configName: cfg.name,
					configType: "import",
				});
				if (!entry.csvColumnNames.includes(m.csvColumn)) {
					entry.csvColumnNames.push(m.csvColumn);
				}
			}
			if (cfg.customProperties) {
				for (const [key, value] of Object.entries(cfg.customProperties)) {
					const entry = getOrCreate(key);
					entry.usedInConfigs.push({
						configId: cfg.id,
						configName: cfg.name,
						configType: "import",
					});
					if (value && entry.sampleValues.length < 5 && !entry.sampleValues.includes(value)) {
						entry.sampleValues.push(value);
					}
				}
			}
		}

		for (const cfg of this.state.savedExportConfigs) {
			for (const col of cfg.columns) {
				const entry = getOrCreate(col);
				entry.usedInConfigs.push({
					configId: cfg.id,
					configName: cfg.name,
					configType: "export",
				});
			}
		}

		return [...map.values()].sort((a, b) =>
			a.propertyName.localeCompare(b.propertyName),
		);
	}

	// ── CSV doc path ────────────────────────────────────────

	/** Returns the vault path for a CSV file's documentation note. */
	getCsvDocPath(csvPath: string): string {
		const folder = this.getReportsFolder();
		const basename = csvPath.split("/").pop()?.replace(/\.csv$/i, "") ?? "csv";
		const safeName = this.sanitizeDocName(basename);
		return `${folder}/CSV - ${safeName}.md`;
	}

	/** Creates a documentation note for a CSV file. Returns the doc path. */
	async createCsvDoc(
		csvPath: string,
		headers: string[],
		rowCount: number,
		delimiter?: string,
	): Promise<string> {
		const docPath = this.getCsvDocPath(csvPath);
		const basename = csvPath.split("/").pop() ?? "file.csv";
		const now = new Date().toISOString();

		const lines: string[] = [
			"---",
			"type: CsvDoc",
			`csvFile: "[[${basename}]]"`,
			`filePath: "${csvPath}"`,
			`name: "${basename}"`,
			`description: ""`,
			`columns: ${headers.length}`,
			`rows: ${rowCount}`,
			`delimiter: "${delimiter ?? ","}"`,
			`headers: [${headers.map((h) => `"${h}"`).join(", ")}]`,
			`created: "${now}"`,
			"---",
			"",
			`# ${basename}`,
			"",
			"> CSV file documentation.",
			"",
			"## Overview",
			"",
			`- **File**: [[${basename}]]`,
			`- **Columns**: ${headers.length}`,
			`- **Rows**: ${rowCount}`,
			"",
			"## Notes",
			"",
			"> Document usage notes, data source, or workflow context.",
			"",
		];

		await this.fileSystem.createFile(docPath, lines.join("\n"), { createFolders: true });
		return docPath;
	}

	// ── Config doc path ─────────────────────────────────────

	getConfigDocPath(
		configName: string,
		configType: "import" | "export",
	): string {
		const folder = this.getConfigsFolder();
		const safeName = this.sanitizeDocName(configName);
		const prefix = configType === "import" ? "Import" : "Export";
		return `${folder}/${prefix} - ${safeName}.md`;
	}

	/** Recreates a config documentation file (e.g. if deleted). */
	async ensureConfigDoc(
		configName: string,
		configType: "import" | "export",
	): Promise<string> {
		const path = this.getConfigDocPath(configName, configType);
		if (configType === "import") {
			const cfg = this.state.savedImportConfigs.find((c) => c.name === configName);
			if (cfg) await this.createImportConfigDoc(cfg);
		} else {
			const cfg = this.state.savedExportConfigs.find((c) => c.name === configName);
			if (cfg) await this.createExportConfigDoc(cfg);
		}
		return path;
	}

	private emitConfigChanged(): void {
		void this.eventBus.emit("dataExchange.config.changed", {
			importCount: this.state.savedImportConfigs.length,
			exportCount: this.state.savedExportConfigs.length,
		});
	}

	// ── Path tracking on rename ────────────────────────────

	/** Updates saved configs when a file is renamed/moved. */
	private async handleFileRenamed(
		oldPath: string,
		newPath: string,
	): Promise<void> {
		let changed = false;

		for (const cfg of this.state.savedImportConfigs) {
			if (cfg.sourcePath === oldPath) {
				cfg.sourcePath = newPath;
				changed = true;
			}
		}

		for (const cfg of this.state.savedExportConfigs) {
			if (cfg.sourcePath === oldPath) {
				cfg.sourcePath = newPath;
				changed = true;
			}
			if (!cfg.isExternal && cfg.outputPath === oldPath) {
				cfg.outputPath = newPath;
				changed = true;
			}
		}

		if (changed) {
			await this.saveState();
			this.emitConfigChanged();
		}
	}

	/** Updates saved configs when a folder is renamed/moved. */
	private async handleFolderRenamed(
		oldPath: string,
		newPath: string,
	): Promise<void> {
		let changed = false;
		const oldPrefix = oldPath + "/";

		for (const cfg of this.state.savedExportConfigs) {
			if (
				cfg.sourcePath === oldPath ||
				cfg.sourcePath.startsWith(oldPrefix)
			) {
				cfg.sourcePath = newPath + cfg.sourcePath.slice(oldPath.length);
				changed = true;
			}
			if (
				!cfg.isExternal &&
				(cfg.outputPath === oldPath ||
					cfg.outputPath.startsWith(oldPrefix))
			) {
				cfg.outputPath = newPath + cfg.outputPath.slice(oldPath.length);
				changed = true;
			}
		}

		for (const cfg of this.state.savedImportConfigs) {
			if (
				cfg.sourcePath &&
				(cfg.sourcePath === oldPath ||
					cfg.sourcePath.startsWith(oldPrefix))
			) {
				cfg.sourcePath =
					newPath + cfg.sourcePath.slice(oldPath.length);
				changed = true;
			}
			if (
				cfg.targetFolder === oldPath ||
				cfg.targetFolder.startsWith(oldPrefix)
			) {
				cfg.targetFolder =
					newPath + cfg.targetFolder.slice(oldPath.length);
				changed = true;
			}
		}

		if (changed) {
			await this.saveState();
			this.emitConfigChanged();
		}
	}

	// ── Config documentation ────────────────────────────────

	/** Returns the Configs folder path (public for Hub scanning). */
	getConfigsFolderPath(): string {
		return this.getConfigsFolder();
	}

	/** Returns the Reports folder path (public for Hub scanning). */
	getReportsFolderPath(): string {
		return this.getReportsFolder();
	}

	/** Returns the Properties folder path (public for Hub scanning). */
	getPropertiesFolderPath(): string {
		return this.getPropertiesFolder();
	}

	/** Returns the vault path for a property's documentation note. */
	getPropertyDocPath(propertyName: string): string {
		const folder = this.getPropertiesFolder();
		const safeName = this.sanitizeDocName(propertyName);
		return `${folder}/Property - ${safeName}.md`;
	}

	/** Creates a documentation note for a Data Dictionary property. Returns the doc path. */
	async createPropertyDoc(propertyName: string): Promise<string> {
		const docPath = this.getPropertyDocPath(propertyName);
		const entry = this.buildDataDictionary().find((e) => e.propertyName === propertyName);
		const now = new Date().toISOString();

		const csvColumns = entry?.csvColumnNames ?? [];
		const configRefs = entry?.usedInConfigs ?? [];

		// Collect wikilinks to all relevant files
		const relatedFiles = new Set<string>();
		const configDocLinks: string[] = [];

		for (const ref of configRefs) {
			// Config doc
			const configDocPath = this.getConfigDocPath(ref.configName, ref.configType);
			const configDocName = configDocPath.split("/").pop()?.replace(/\.md$/, "") ?? ref.configName;
			configDocLinks.push(`- [[${configDocName}]]`);

			if (ref.configType === "import") {
				const cfg = this.state.savedImportConfigs.find((c) => c.id === ref.configId);
				if (cfg) {
					if (cfg.sourcePath) relatedFiles.add(cfg.sourcePath);
					if (cfg.basePath) relatedFiles.add(cfg.basePath);
				}
			} else {
				const cfg = this.state.savedExportConfigs.find((c) => c.id === ref.configId);
				if (cfg) {
					relatedFiles.add(cfg.sourcePath);
					if (!cfg.isExternal) relatedFiles.add(cfg.outputPath);
				}
			}
		}

		// Build CSV report doc links
		const reportLinks: string[] = [];
		for (const filePath of relatedFiles) {
			if (filePath.toLowerCase().endsWith(".csv")) {
				const reportDocPath = this.getCsvDocPath(filePath);
				const reportDocName = reportDocPath.split("/").pop()?.replace(/\.md$/, "") ?? filePath;
				reportLinks.push(`- [[${reportDocName}]]`);
			}
		}

		// Build file wikilinks
		const fileLinks = [...relatedFiles].map((f) => {
			const name = f.split("/").pop() ?? f;
			return `- [[${name}]]`;
		});

		const lines: string[] = [
			"---",
			"type: PropertyDoc",
			`property: "${propertyName}"`,
			`description: ""`,
			`csvColumns: [${csvColumns.map((c) => `"${c}"`).join(", ")}]`,
			`configs: [${configRefs.map((c) => `"${c.configName}"`).join(", ")}]`,
			`created: "${now}"`,
			"---",
			"",
			`# ${propertyName}`,
			"",
			"> Property documentation.",
			"",
			"## Overview",
			"",
			`- **Property**: \`${propertyName}\``,
			...(csvColumns.length > 0
				? [`- **CSV Columns**: ${csvColumns.join(", ")}`]
				: []),
			"",
			"## Description",
			"",
			"> Describe what this property represents, valid values, and any constraints.",
			"",
		];

		if (configDocLinks.length > 0) {
			lines.push("## Configs", "", ...configDocLinks, "");
		}

		if (fileLinks.length > 0) {
			lines.push("## Related Files", "", ...fileLinks, "");
		}

		if (reportLinks.length > 0) {
			lines.push("## Reports", "", ...reportLinks, "");
		}

		lines.push(
			"## Notes",
			"",
			"> Document usage context, data lineage, or related properties.",
			"",
		);

		await this.fileSystem.createFile(docPath, lines.join("\n"), { createFolders: true });
		return docPath;
	}

	private getConfigsFolder(): string {
		const base = this.docsRootPath.replace(/\/+$/, "");
		return `${base}/Configs`;
	}

	private getReportsFolder(): string {
		const base = this.docsRootPath.replace(/\/+$/, "");
		return `${base}/Reports`;
	}

	private getPropertiesFolder(): string {
		const base = this.docsRootPath.replace(/\/+$/, "");
		return `${base}/Properties`;
	}

	private sanitizeDocName(name: string): string {
		return name.replace(/[\\/:*?"<>|#^[\]]/g, "").replace(/\s+/g, " ").trim();
	}

	private async createImportConfigDoc(config: SavedImportConfig): Promise<void> {
		if (!this.docsRootPath) return;
		try {
			const folder = this.getConfigsFolder();
			const safeName = this.sanitizeDocName(config.name);
			const path = `${folder}/Import - ${safeName}.md`;
			const now = new Date(config.createdAt).toISOString();
			const included = config.columnMappings.filter((m) => m.included);

			const lines: string[] = [
				"---",
				"type: ImportConfigDoc",
				`configId: "${config.id}"`,
				`name: "${config.name}"`,
				`targetFolder: "${config.targetFolder}"`,
				`nameColumn: "${config.nameColumn}"`,
				`namePrefix: "${config.namePrefix ?? ""}"`,
				`nameSuffix: "${config.nameSuffix ?? ""}"`,
				`conflictStrategy: "${config.conflictStrategy}"`,
				`columns: ${config.columnMappings.length}`,
				`includedColumns: ${included.length}`,
				`created: "${now}"`,
				"---",
				"",
				`# ${config.name}`,
				"",
				"> Import configuration for CSV-to-Notes pipeline.",
				"",
				"## Settings",
				"",
				"| Setting           | Value            |",
				"| ----------------- | ---------------- |",
				`| **Target Folder** | ${config.targetFolder} |`,
				`| **Name Column**   | ${config.nameColumn} |`,
				`| **Name Prefix**   | ${config.namePrefix || "_(none)_"} |`,
				`| **Name Suffix**   | ${config.nameSuffix || "_(none)_"} |`,
				`| **Conflict**      | ${config.conflictStrategy} |`,
				`| **Columns**       | ${included.length} of ${config.columnMappings.length} |`,
				"",
			];

			if (included.length > 0) {
				lines.push("## Column Mappings");
				lines.push("");
				lines.push("| CSV Column | Frontmatter Key | Included |");
				lines.push("| ---------- | --------------- | -------- |");
				for (const m of config.columnMappings) {
					lines.push(`| ${m.csvColumn} | ${m.frontmatterKey} | ${m.included ? "Yes" : "No"} |`);
				}
				lines.push("");
			}

			lines.push("## Notes");
			lines.push("");
			lines.push("> Document usage notes, scheduling, or workflow context.");
			lines.push("");

			await this.fileSystem.createFile(path, lines.join("\n"), { createFolders: true });
		} catch (error) {
			console.error("[Flowti] Failed to create import config doc", error);
		}
	}

	private async createExportConfigDoc(config: SavedExportConfig): Promise<void> {
		if (!this.docsRootPath) return;
		try {
			const folder = this.getConfigsFolder();
			const safeName = this.sanitizeDocName(config.name);
			const path = `${folder}/Export - ${safeName}.md`;
			const now = new Date(config.createdAt).toISOString();
			const formatLabel = config.format === "tab" ? "Tab-delimited" : "CSV";

			const lines: string[] = [
				"---",
				"type: ExportConfigDoc",
				`configId: "${config.id}"`,
				`name: "${config.name}"`,
				`sourcePath: "${config.sourcePath}"`,
				`sourceType: "${config.sourceType}"`,
				`format: "${config.format}"`,
				`outputPath: "${config.outputPath}"`,
				`columns: ${config.columns.length}`,
				`fileProperties: ${config.fileProperties.length}`,
				`conflictStrategy: "${config.conflictStrategy ?? "overwrite"}"`,
				`created: "${now}"`,
				"---",
				"",
				`# ${config.name}`,
				"",
				"> Export configuration for vault data extraction.",
				"",
				"## Settings",
				"",
				"| Setting           | Value              |",
				"| ----------------- | ------------------ |",
				`| **Source**        | ${config.sourcePath} |`,
				`| **Source Type**   | ${config.sourceType} |`,
				`| **Format**       | ${formatLabel} |`,
				`| **Output**       | ${config.outputPath} |`,
				`| **Conflict**     | ${config.conflictStrategy ?? "overwrite"} |`,
				"",
			];

			if (config.columns.length > 0) {
				lines.push("## Note Properties");
				lines.push("");
				for (const col of config.columns) {
					lines.push(`- ${col}`);
				}
				lines.push("");
			}

			if (config.fileProperties.length > 0) {
				lines.push("## File Properties");
				lines.push("");
				for (const fp of config.fileProperties) {
					lines.push(`- ${fp}`);
				}
				lines.push("");
			}

			lines.push("## Notes");
			lines.push("");
			lines.push("> Document usage notes, scheduling, or workflow context.");
			lines.push("");

			await this.fileSystem.createFile(path, lines.join("\n"), { createFolders: true });
		} catch (error) {
			console.error("[Flowti] Failed to create export config doc", error);
		}
	}

	/** Cleans up all event listeners. */
	dispose(): void {
		for (const unsub of this.unsubscribes) {
			unsub();
		}
		this.unsubscribes = [];
	}
}
