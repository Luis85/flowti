/**
 * DataExchangeService — top-level orchestrator for import/export operations.
 *
 * Wires ImportService + ExportService and handles EventBus command events.
 * Follows the same service pattern as SubscriptionService.
 */

import type { IEventBus } from "../../infrastructure/events/types";
import type { IFileSystemClient } from "../../infrastructure/filesystem/types";
import type { IStorageProvider } from "../../utils/types";
import type { EventDocMeta } from "../discovery/types";
import type {
	ColumnMapping,
	CsvDisplaySettings,
	DataDictionaryEntry,
	DataExchangeState,
	ImportConfig,
	MultiImportResult,
	PipelineSourceResult,
	SavedImportConfig,
	SavedExportConfig,
	SavedMultiImportPipeline,
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

		// Listen for pipeline execute command
		this.unsubscribes.push(
			this.eventBus.on("dataExchange.pipeline.execute", async (event) => {
				try {
					const result = await this.executePipeline(
						event.payload.pipelineId,
					);
					await this.updatePipeline(event.payload.pipelineId, {
						lastExecutedAt: Date.now(),
					});
					await this.eventBus.emit("dataExchange.pipeline.completed", {
						result,
					});
				} catch (error) {
					await this.eventBus.emit("dataExchange.pipeline.failed", {
						error:
							error instanceof Error
								? error.message
								: String(error),
						pipelineId: event.payload.pipelineId,
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
		if (saved.noteType) {
			void this.createOrUpdateTypeDoc(saved.noteType);
		}
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
		if (cfg.noteType) {
			void this.createOrUpdateTypeDoc(cfg.noteType);
		}
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
		if (saved.noteType) {
			void this.createOrUpdateTypeDoc(saved.noteType);
		}
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
		if (cfg.noteType) {
			void this.createOrUpdateTypeDoc(cfg.noteType);
		}
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

	// ── Pipeline config CRUD ────────────────────────────────

	getSavedPipelines(): SavedMultiImportPipeline[] {
		return [...(this.state.savedPipelines ?? [])];
	}

	getPipeline(id: string): SavedMultiImportPipeline | undefined {
		return this.state.savedPipelines?.find((p) => p.id === id);
	}

	async savePipeline(
		config: Omit<SavedMultiImportPipeline, "id" | "createdAt">,
	): Promise<SavedMultiImportPipeline> {
		const saved: SavedMultiImportPipeline = {
			...config,
			id: generateId(),
			createdAt: Date.now(),
		};
		if (!this.state.savedPipelines) this.state.savedPipelines = [];
		this.state.savedPipelines.push(saved);
		await this.saveState();
		this.emitConfigChanged();
		void this.createPipelineConfigDoc(saved);
		if (saved.noteType) {
			void this.createOrUpdateTypeDoc(saved.noteType);
		}
		return saved;
	}

	async deletePipeline(id: string): Promise<void> {
		if (!this.state.savedPipelines) return;
		this.state.savedPipelines = this.state.savedPipelines.filter((p) => p.id !== id);
		await this.saveState();
		this.emitConfigChanged();
	}

	async updatePipeline(
		id: string,
		updates: Partial<Omit<SavedMultiImportPipeline, "id" | "createdAt">>,
	): Promise<SavedMultiImportPipeline | undefined> {
		const pipe = this.state.savedPipelines?.find((p) => p.id === id);
		if (!pipe) return undefined;
		Object.assign(pipe, updates);
		await this.saveState();
		this.emitConfigChanged();
		void this.createPipelineConfigDoc(pipe);
		if (pipe.noteType) {
			void this.createOrUpdateTypeDoc(pipe.noteType);
		}
		return { ...pipe };
	}

	async togglePipelineFavourite(id: string): Promise<void> {
		const pipe = this.getPipeline(id);
		if (!pipe) return;
		await this.updatePipeline(id, { favourite: !pipe.favourite });
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

		const tagType = (entry: DataDictionaryEntry, typeName: string): void => {
			if (!entry.typeNames) entry.typeNames = [];
			if (!entry.typeNames.includes(typeName)) entry.typeNames.push(typeName);
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
				if (cfg.noteType) tagType(entry, cfg.noteType);
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
					if (cfg.noteType) tagType(entry, cfg.noteType);
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
				if (cfg.noteType) tagType(entry, cfg.noteType);
			}
		}

		for (const pipe of this.state.savedPipelines ?? []) {
			const mergeEntry = getOrCreate(pipe.mergeKey);
			if (pipe.noteType) tagType(mergeEntry, pipe.noteType);
			for (const src of pipe.sources) {
				if (!mergeEntry.csvColumnNames.includes(src.mergeKeyColumn)) {
					mergeEntry.csvColumnNames.push(src.mergeKeyColumn);
				}
				if (!mergeEntry.usedInConfigs.some((c) => c.configId === pipe.id)) {
					mergeEntry.usedInConfigs.push({
						configId: pipe.id,
						configName: pipe.name,
						configType: "import",
					});
				}
				for (const m of src.columnMappings) {
					if (!m.included) continue;
					const entry = getOrCreate(m.frontmatterKey);
					if (pipe.noteType) tagType(entry, pipe.noteType);
					if (!entry.usedInConfigs.some((c) => c.configId === pipe.id)) {
						entry.usedInConfigs.push({
							configId: pipe.id,
							configName: pipe.name,
							configType: "import",
						});
					}
					if (!entry.csvColumnNames.includes(m.csvColumn)) {
						entry.csvColumnNames.push(m.csvColumn);
					}
				}
				if (src.customProperties) {
					for (const [key, value] of Object.entries(src.customProperties)) {
						const entry = getOrCreate(key);
						if (pipe.noteType) tagType(entry, pipe.noteType);
						if (!entry.usedInConfigs.some((c) => c.configId === pipe.id)) {
							entry.usedInConfigs.push({
								configId: pipe.id,
								configName: pipe.name,
								configType: "import",
							});
						}
						if (value && entry.sampleValues.length < 5 && !entry.sampleValues.includes(value)) {
							entry.sampleValues.push(value);
						}
					}
				}
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

	async ensurePipelineDoc(pipelineId: string): Promise<string> {
		const pipe = this.getPipeline(pipelineId);
		if (pipe) {
			await this.createPipelineConfigDoc(pipe);
			return this.getPipelineDocPath(pipe.name);
		}
		return "";
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

		for (const pipe of this.state.savedPipelines ?? []) {
			for (const src of pipe.sources) {
				if (src.csvPath === oldPath) {
					src.csvPath = newPath;
					changed = true;
				}
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

		for (const pipe of this.state.savedPipelines ?? []) {
			if (
				pipe.targetFolder === oldPath ||
				pipe.targetFolder.startsWith(oldPrefix)
			) {
				pipe.targetFolder = newPath + pipe.targetFolder.slice(oldPath.length);
				changed = true;
			}
			for (const src of pipe.sources) {
				if (src.csvPath.startsWith(oldPrefix)) {
					src.csvPath = newPath + src.csvPath.slice(oldPath.length);
					changed = true;
				}
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

	private getTypesFolder(): string {
		const base = this.docsRootPath.replace(/\/+$/, "");
		return `${base}/Types`;
	}

	getTypesFolderPath(): string {
		return this.getTypesFolder();
	}

	getEventDocPath(eventType: string): string {
		const base = this.docsRootPath.replace(/\/+$/, "");
		return `${base}/Events/${eventType}.md`;
	}

	getTypeDocPath(typeName: string): string {
		const folder = this.getTypesFolder();
		const safeName = this.sanitizeDocName(typeName);
		return `${folder}/Type - ${safeName}.md`;
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
				config.noteType ? `noteType: "${config.noteType}"` : "",
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
				config.noteType ? `| **Note Type**     | [[Type - ${this.sanitizeDocName(config.noteType)}\\|${config.noteType}]] |` : "",
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
				config.noteType ? `noteType: "${config.noteType}"` : "",
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
				config.noteType ? `| **Note Type**    | [[Type - ${this.sanitizeDocName(config.noteType)}\\|${config.noteType}]] |` : "",
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

	// ── Pipeline execution ──────────────────────────────────

	private async executePipeline(pipelineId: string): Promise<MultiImportResult> {
		const pipeline = this.getPipeline(pipelineId);
		if (!pipeline) throw new Error(`Pipeline not found: ${pipelineId}`);
		if (pipeline.sources.length === 0) throw new Error("Pipeline has no sources");

		await this.eventBus.emit("dataExchange.pipeline.started", {
			pipeline,
			totalSources: pipeline.sources.length,
		});

		const result: MultiImportResult = {
			totalSources: pipeline.sources.length,
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
				namePrefix: source.namePrefix,
				nameSuffix: source.nameSuffix,
				columnMappings: [mergeKeyMapping, ...otherMappings],
				conflictStrategy: "update",
				customProperties: Object.keys(customProps).length > 0 ? customProps : undefined,
			};

			try {
				const sourceResult = await this.importService.executeImport(importConfig);
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

				await this.eventBus.emit("dataExchange.pipeline.sourceCompleted", {
					pipelineId: pipeline.id,
					sourceIndex: i,
					totalSources: pipeline.sources.length,
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

		// Create .base view if configured
		if (pipeline.createBase) {
			await this.createPipelineBaseFile(pipeline);
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
			await this.fileSystem.readFile(path);
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
			await this.fileSystem.createFile(path, lines.join("\n"), { createFolders: true });
		} catch (error) {
			console.error("[Flowti] Failed to create pipeline base file", error);
		}
	}

	private buildPipelineDocContent(pipeline: SavedMultiImportPipeline, userNotes?: string): string {
		const now = new Date(pipeline.createdAt).toISOString();
		const lastRun = pipeline.lastExecutedAt
			? new Date(pipeline.lastExecutedAt).toISOString()
			: "";

		const lines: string[] = [
			"---",
			"type: PipelineConfigDoc",
			`configId: "${pipeline.id}"`,
			`name: "${pipeline.name}"`,
			`description: ""`,
			`targetFolder: "${pipeline.targetFolder}"`,
			`mergeKey: "${pipeline.mergeKey}"`,
			pipeline.noteType ? `noteType: "${pipeline.noteType}"` : "",
			`sources: ${pipeline.sources.length}`,
			`created: "${now}"`,
			lastRun ? `lastExecuted: "${lastRun}"` : "",
			"---",
			"",
			`# ${pipeline.name}`,
			"",
			"> Multi-import pipeline for merging CSV sources into enriched notes.",
			"",
			"## Settings",
			"",
			"| Setting           | Value            |",
			"| ----------------- | ---------------- |",
			`| **Target Folder** | \`${pipeline.targetFolder}\` |`,
			`| **Merge Key**     | \`${pipeline.mergeKey}\` |`,
			`| **Sources**       | ${pipeline.sources.length} |`,
			pipeline.noteType ? `| **Note Type**     | [[Type - ${this.sanitizeDocName(pipeline.noteType)}\\|${pipeline.noteType}]] |` : "",
			lastRun ? `| **Last Run**      | ${lastRun} |` : "",
			"",
		];

		// Remove empty lines from conditional entries in frontmatter/table
		const filtered = lines.filter((l) => l !== "" || lines.indexOf(l) > 10);

		if (pipeline.sources.length > 0) {
			filtered.push("## Sources", "");
			for (const source of pipeline.sources) {
				const csvName = source.csvPath.split("/").pop() ?? source.csvPath;
				const included = source.columnMappings.filter((m) => m.included);
				filtered.push(`### [[${source.csvPath}|${csvName}]]`, "");
				filtered.push(`- **Merge Key Column**: \`${source.mergeKeyColumn}\` → \`${pipeline.mergeKey}\``);
				filtered.push(`- **Mapped Columns**: ${included.length} of ${source.columnMappings.length}`);
				if (source.namePrefix) filtered.push(`- **Filename Prefix**: \`${source.namePrefix}\``);
				if (source.nameSuffix) filtered.push(`- **Filename Suffix**: \`${source.nameSuffix}\``);
				if (source.customProperties && Object.keys(source.customProperties).length > 0) {
					filtered.push(`- **Custom Properties**: ${Object.entries(source.customProperties).map(([k, v]) => `\`${k}\`=\`${v}\``).join(", ")}`);
				}
				if (included.length > 0) {
					filtered.push("");
					filtered.push("| CSV Column | Frontmatter Key |");
					filtered.push("| ---------- | --------------- |");
					for (const m of included) {
						filtered.push(`| ${m.csvColumn} | \`${m.frontmatterKey}\` |`);
					}
				}
				filtered.push("");
			}
		}

		if (pipeline.createBase && pipeline.basePath) {
			filtered.push("## Base View", "");
			filtered.push(`Linked base view: [[${pipeline.basePath}]]`, "");
		}

		filtered.push("## Related", "");
		filtered.push(`- **Target folder**: \`${pipeline.targetFolder}\``);
		if (pipeline.sources.length > 0) {
			filtered.push("- **Source files**:");
			for (const source of pipeline.sources) {
				const csvName = source.csvPath.split("/").pop() ?? source.csvPath;
				filtered.push(`  - [[${source.csvPath}|${csvName}]]`);
			}
		}
		filtered.push("");

		if (userNotes !== undefined) {
			filtered.push("## Notes", "", userNotes);
		} else {
			filtered.push("## Notes", "", "> Document usage notes, scheduling, or workflow context.", "");
		}

		return filtered.join("\n");
	}

	private async createPipelineConfigDoc(pipeline: SavedMultiImportPipeline): Promise<void> {
		if (!this.docsRootPath) return;
		try {
			const folder = this.getConfigsFolder();
			const safeName = this.sanitizeDocName(pipeline.name);
			const path = `${folder}/Pipeline - ${safeName}.md`;

			// Try to preserve user-written notes from existing doc
			let userNotes: string | undefined;
			try {
				const existing = await this.fileSystem.readFile(path);
				const notesMatch = existing.match(/## Notes\n\n([\s\S]*?)$/);
				if (notesMatch) {
					const notes = notesMatch[1].trim();
					// Only preserve if user replaced the default placeholder
					if (notes && notes !== "> Document usage notes, scheduling, or workflow context.") {
						userNotes = notesMatch[1];
					}
				}
			} catch {
				// File doesn't exist yet — that's fine
			}

			const content = this.buildPipelineDocContent(pipeline, userNotes);

			try {
				await this.fileSystem.createFile(path, content, { createFolders: true });
			} catch {
				// File already exists — update it
				await this.fileSystem.updateFile(path, content);
			}
		} catch (error) {
			console.error("[Flowti] Failed to create pipeline config doc", error);
		}
	}

	/** Returns the pipeline config doc path. */
	getPipelineDocPath(pipelineName: string): string {
		const folder = this.getConfigsFolder();
		const safeName = this.sanitizeDocName(pipelineName);
		return `${folder}/Pipeline - ${safeName}.md`;
	}

	// ── TypeDoc CRUD ────────────────────────────────────────

	/**
	 * Collects all properties from pipelines, import configs, and export configs
	 * with the given noteType, then creates or updates the TypeDoc file.
	 */
	async createOrUpdateTypeDoc(typeName: string): Promise<void> {
		const properties = new Set<string>();

		// Collect from pipelines
		for (const pipe of this.state.savedPipelines ?? []) {
			if (pipe.noteType !== typeName) continue;
			properties.add(pipe.mergeKey);
			for (const src of pipe.sources) {
				for (const m of src.columnMappings) {
					if (m.included) properties.add(m.frontmatterKey);
				}
				if (src.customProperties) {
					for (const key of Object.keys(src.customProperties)) {
						properties.add(key);
					}
				}
			}
		}

		// Collect from import configs
		for (const cfg of this.state.savedImportConfigs) {
			if (cfg.noteType !== typeName) continue;
			for (const m of cfg.columnMappings) {
				if (m.included) properties.add(m.frontmatterKey);
			}
			if (cfg.customProperties) {
				for (const key of Object.keys(cfg.customProperties)) {
					properties.add(key);
				}
			}
		}

		// Collect from export configs (column names = expected properties)
		for (const cfg of this.state.savedExportConfigs) {
			if (cfg.noteType !== typeName) continue;
			for (const col of cfg.columns) {
				properties.add(col);
			}
		}

		await this.createTypeDoc(typeName, [...properties].sort());
	}

	/** Creates or updates a TypeDoc file in the Types folder. */
	private async createTypeDoc(typeName: string, properties: string[]): Promise<void> {
		if (!this.docsRootPath) return;
		try {
			const path = this.getTypeDocPath(typeName);

			// Preserve user-written notes from existing doc
			let userNotes: string | undefined;
			try {
				const existing = await this.fileSystem.readFile(path);
				const notesMatch = existing.match(/## Notes\n\n([\s\S]*?)$/);
				if (notesMatch) {
					const notes = notesMatch[1].trim();
					if (notes && notes !== "> Describe this type, its purpose, and usage guidelines.") {
						userNotes = notesMatch[1];
					}
				}
			} catch {
				// File doesn't exist yet
			}

			const now = new Date().toISOString();

			// Find configs that use this type
			const pipelines = (this.state.savedPipelines ?? []).filter(
				(p) => p.noteType === typeName,
			);
			const importConfigs = this.state.savedImportConfigs.filter(
				(c) => c.noteType === typeName,
			);
			const exportConfigs = this.state.savedExportConfigs.filter(
				(c) => c.noteType === typeName,
			);
			const totalConfigs = pipelines.length + importConfigs.length + exportConfigs.length;

			const lines: string[] = [
				"---",
				"type: TypeDoc",
				`name: "${typeName}"`,
				`description: ""`,
				`properties: [${properties.map((p) => `"${p}"`).join(", ")}]`,
				`pipelines: ${totalConfigs}`,
				`created: "${now}"`,
				"---",
				"",
				`# ${typeName}`,
				"",
				"> Note type definition.",
				"",
				"## Overview",
				"",
				`- **Type**: \`${typeName}\``,
				`- **Expected Properties**: ${properties.length}`,
				`- **Used by Configs**: ${totalConfigs}`,
				"",
			];

			if (properties.length > 0) {
				lines.push("## Expected Properties", "");
				lines.push("| Property | Documented |");
				lines.push("| -------- | ---------- |");
				for (const prop of properties) {
					const propDocPath = this.getPropertyDocPath(prop);
					const propDocName = propDocPath.split("/").pop()?.replace(/\.md$/, "") ?? prop;
					lines.push(`| [[${propDocName}\\|${prop}]] | — |`);
				}
				lines.push("");
			}

			if (totalConfigs > 0) {
				lines.push("## Configs", "");
				for (const pipe of pipelines) {
					const pipeDocPath = this.getPipelineDocPath(pipe.name);
					const pipeDocName = pipeDocPath.split("/").pop()?.replace(/\.md$/, "") ?? pipe.name;
					lines.push(`- [[${pipeDocName}\\|${pipe.name}]] — Pipeline (${pipe.sources.length} source${pipe.sources.length !== 1 ? "s" : ""})`);
				}
				for (const cfg of importConfigs) {
					const docPath = this.getConfigDocPath(cfg.name, "import");
					const docName = docPath.split("/").pop()?.replace(/\.md$/, "") ?? cfg.name;
					lines.push(`- [[${docName}\\|${cfg.name}]] — Import`);
				}
				for (const cfg of exportConfigs) {
					const docPath = this.getConfigDocPath(cfg.name, "export");
					const docName = docPath.split("/").pop()?.replace(/\.md$/, "") ?? cfg.name;
					lines.push(`- [[${docName}\\|${cfg.name}]] — Export`);
				}
				lines.push("");
			}

			// Lifecycle event wikilinks
			const lowerType = typeName.toLowerCase();
			const crudSuffixes = [
				{ suffix: "created", label: "Created" },
				{ suffix: "read", label: "Read" },
				{ suffix: "updated", label: "Updated" },
				{ suffix: "deleted", label: "Deleted" },
			];
			lines.push("## Lifecycle Events", "");
			for (const crud of crudSuffixes) {
				const eventType = `${lowerType}.${crud.suffix}`;
				lines.push(`- [[${eventType}\\|${eventType}]] — ${crud.label}`);
			}
			lines.push("");

			if (userNotes !== undefined) {
				lines.push("## Notes", "", userNotes);
			} else {
				lines.push("## Notes", "", "> Describe this type, its purpose, and usage guidelines.", "");
			}

			const content = lines.join("\n");

			try {
				await this.fileSystem.createFile(path, content, { createFolders: true });
			} catch {
				await this.fileSystem.updateFile(path, content);
			}
			// Create CRUD event docs for this type
			await this.createTypeEventDocs(typeName);
		} catch (error) {
			console.error("[Flowti] Failed to create type doc", error);
		}
	}

	/**
	 * Emits `discovery.create` events for the 4 CRUD lifecycle events
	 * of a note type ({type}.created, .read, .updated, .deleted).
	 *
	 * The DiscoveryService handles both registration and EventDoc file creation
	 * via the centralized `generateEventDocContent()` template.
	 */
	private async createTypeEventDocs(typeName: string): Promise<void> {
		const lowerType = typeName.toLowerCase();
		const typeDocName = `Type - ${this.sanitizeDocName(typeName)}`;

		const crudDefs = [
			{ suffix: "created", label: "Created", desc: `A new ${typeName} was added` },
			{ suffix: "read", label: "Read", desc: `A ${typeName} was viewed or queried` },
			{ suffix: "updated", label: "Updated", desc: `An existing ${typeName} was modified` },
			{ suffix: "deleted", label: "Deleted", desc: `A ${typeName} was removed` },
		];

		for (const def of crudDefs) {
			const eventType = `${lowerType}.${def.suffix}`;
			const siblings = crudDefs
				.filter((d) => d.suffix !== def.suffix)
				.map((d) => `- [[${lowerType}.${d.suffix}\\|${lowerType}.${d.suffix}]] — ${d.desc}`);

			const docMeta: EventDocMeta = {
				description: def.desc,
				domain: "Types",
				services: "DataExchange",
				direction: "outbound",
				stability: "draft",
				visibility: "public",
				relatedEvents: siblings,
				extraSections: [
					`**Type**: [[${typeDocName}\\|${typeName}]]`,
				],
			};

			void this.eventBus.emit("discovery.create", {
				eventName: eventType,
				category: typeName,
				docMeta,
			});
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
