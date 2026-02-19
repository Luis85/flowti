/**
 * DataExchangeService — top-level orchestrator for import/export operations.
 *
 * Wires ImportService + ExportService and handles EventBus command events.
 * Follows the same service pattern as SubscriptionService.
 */

import type { IEventBus } from "../../infrastructure/events/types";
import type { IFileSystemClient } from "../../infrastructure/filesystem/types";
import type { ITypedStorage } from "../../utils/TypedStorage";
import type {
	CsvDisplaySettings,
	DataDictionaryEntry,
	DataExchangeState,
	SavedImportConfig,
	SavedExportConfig,
	SavedMultiImportPipeline,
	VaultFileInfo,
} from "./types";
import { ImportService } from "./ImportService";
import { ExportService, type ListFilesCallback, type WriteExternalFileCallback, type ReadExternalFileCallback } from "./ExportService";
import { buildDataDictionary as buildDataDictionaryFn } from "./DataDictionaryBuilder";
import { ConfigPathTracker } from "./ConfigPathTracker";
import { PipelineExecutor } from "./PipelineExecutor";
import { ConfigDocService } from "./ConfigDocService";
import { generateUUID } from "../../utils/helpers";

export interface DataExchangeServiceOptions {
	eventBus: IEventBus;
	fileSystem: IFileSystemClient;
	storage?: ITypedStorage<DataExchangeState>;
	listFiles?: ListFilesCallback;
}

function createDefaultState(): DataExchangeState {
	return { savedImportConfigs: [], savedExportConfigs: [] };
}

function generateId(): string {
	return generateUUID();
}

export class DataExchangeService {
	private eventBus: IEventBus;
	private storage: ITypedStorage<DataExchangeState> | null;
	private state: DataExchangeState = createDefaultState();
	private importService: ImportService;
	private exportService: ExportService;
	private unsubscribes: (() => void)[] = [];
	private docsRootPath = "";
	private pathTracker: ConfigPathTracker;
	private pipelineExecutor: PipelineExecutor;
	private configDocService: ConfigDocService;

	constructor(options: DataExchangeServiceOptions) {
		this.eventBus = options.eventBus;
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

		this.pathTracker = new ConfigPathTracker({
			getState: () => this.state,
			saveState: () => this.saveState(),
			emitConfigChanged: () => this.emitConfigChanged(),
		});

		this.pipelineExecutor = new PipelineExecutor({
			eventBus: this.eventBus,
			importService: this.importService,
			exportService: this.exportService,
			fileSystem: options.fileSystem,
			getPipeline: (id) => this.getPipeline(id),
			getExportConfig: (id) => this.getExportConfig(id),
		});

		this.configDocService = new ConfigDocService({
			fileSystem: options.fileSystem,
			eventBus: this.eventBus,
			getDocsRootPath: () => this.docsRootPath,
			getState: () => this.state,
			getExportConfig: (id) => this.getExportConfig(id),
			buildDataDictionary: () => this.buildDataDictionary(),
		});

		// Listen for import command (ImportService emits started/completed/failed)
		this.unsubscribes.push(
			this.eventBus.on("dataExchange.import.execute", async (event) => {
				const operationId = event.payload.operationId ?? generateUUID();
				try {
					await this.importService.executeImport(
						event.payload.config,
						{ operationId },
					);
				} catch {
					// ImportService already emitted import.failed
				}
			}),
		);

		// Listen for export command (ExportService emits started/completed/failed)
		this.unsubscribes.push(
			this.eventBus.on("dataExchange.export.execute", async (event) => {
				const operationId = event.payload.operationId ?? generateUUID();
				try {
					await this.exportService.executeExport(
						event.payload.config,
						{ operationId },
					);
				} catch {
					// ExportService already emitted export.failed
				}
			}),
		);

		// Listen for pipeline execute command
		this.unsubscribes.push(
			this.eventBus.on("dataExchange.pipeline.execute", async (event) => {
				try {
					const result = await this.pipelineExecutor.executePipeline(
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
				void this.pathTracker.handleFileRenamed(
					event.payload.oldPath,
					event.payload.newPath,
				);
			}),
		);

		// Track folder renames → update configs with paths under the folder
		this.unsubscribes.push(
			this.eventBus.on("folder.renamed", (event) => {
				void this.pathTracker.handleFolderRenamed(
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

	/** Expose pipeline executor for preview building. */
	getPipelineExecutor(): PipelineExecutor {
		return this.pipelineExecutor;
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
		const saved = await this.storage.load();
		if (saved) {
			this.state = saved;
			// Migrate legacy singular exportConfigId → exportConfigIds
			let migrated = false;
			for (const pipe of this.state.savedPipelines ?? []) {
				const raw = pipe as unknown as Record<string, unknown>;
				const legacy = raw["exportConfigId"];
				if (typeof legacy === "string" && legacy && !pipe.exportConfigIds) {
					pipe.exportConfigIds = [legacy];
					delete raw["exportConfigId"];
					migrated = true;
				}
			}
			if (migrated) await this.saveState();
		}
	}

	private async saveState(): Promise<void> {
		if (!this.storage) return;
		await this.storage.save(this.state);
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
		void this.configDocService.createImportConfigDoc(saved);
		void this.configDocService.createConfigEventDocs(saved.name, "import");
		if (saved.noteType) {
			void this.configDocService.createOrUpdateTypeDoc(saved.noteType);
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
		void this.configDocService.createImportConfigDoc(cfg);
		if (cfg.noteType) {
			void this.configDocService.createOrUpdateTypeDoc(cfg.noteType);
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
		void this.configDocService.createExportConfigDoc(saved);
		void this.configDocService.createConfigEventDocs(saved.name, "export");
		if (saved.noteType) {
			void this.configDocService.createOrUpdateTypeDoc(saved.noteType);
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
		void this.configDocService.createExportConfigDoc(cfg);
		if (cfg.noteType) {
			void this.configDocService.createOrUpdateTypeDoc(cfg.noteType);
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
		void this.configDocService.createPipelineConfigDoc(saved);
		void this.configDocService.createConfigEventDocs(saved.name, "pipeline");
		if (saved.noteType) {
			void this.configDocService.createOrUpdateTypeDoc(saved.noteType);
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
		void this.configDocService.createPipelineConfigDoc(pipe);
		if (pipe.noteType) {
			void this.configDocService.createOrUpdateTypeDoc(pipe.noteType);
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
		return buildDataDictionaryFn(this.state);
	}

	// ── Doc delegation ──────────────────────────────────────

	getCsvDocPath(csvPath: string): string {
		return this.configDocService.getCsvDocPath(csvPath);
	}

	/** Returns the doc path that actually exists (new or legacy), or the new path if neither exists. */
	resolveCsvDocPath(csvPath: string, fileExists: (path: string) => boolean): string {
		return this.configDocService.resolveCsvDocPath(csvPath, fileExists);
	}

	async createCsvDoc(csvPath: string, headers: string[], rowCount: number, delimiter?: string): Promise<string> {
		return this.configDocService.createCsvDoc(csvPath, headers, rowCount, delimiter);
	}

	getConfigDocPath(configName: string, configType: "import" | "export"): string {
		return this.configDocService.getConfigDocPath(configName, configType);
	}

	async ensureConfigDoc(configName: string, configType: "import" | "export"): Promise<string> {
		return this.configDocService.ensureConfigDoc(configName, configType);
	}

	async ensurePipelineDoc(pipelineId: string): Promise<string> {
		return this.configDocService.ensurePipelineDoc(pipelineId);
	}

	getConfigsFolderPath(): string {
		return this.configDocService.getConfigsFolderPath();
	}

	getReportsFolderPath(): string {
		return this.configDocService.getReportsFolderPath();
	}

	getPropertiesFolderPath(): string {
		return this.configDocService.getPropertiesFolderPath();
	}

	getPropertyDocPath(propertyName: string): string {
		return this.configDocService.getPropertyDocPath(propertyName);
	}

	async createPropertyDoc(propertyName: string): Promise<string> {
		return this.configDocService.createPropertyDoc(propertyName);
	}

	getTypesFolderPath(): string {
		return this.configDocService.getTypesFolderPath();
	}

	getEventDocPath(eventType: string): string {
		return this.configDocService.getEventDocPath(eventType);
	}

	getTypeDocPath(typeName: string): string {
		return this.configDocService.getTypeDocPath(typeName);
	}

	getPipelineDocPath(pipelineName: string): string {
		return this.configDocService.getPipelineDocPath(pipelineName);
	}

	async createOrUpdateTypeDoc(typeName: string): Promise<void> {
		return this.configDocService.createOrUpdateTypeDoc(typeName);
	}

	// ── Internal ─────────────────────────────────────────────

	private emitConfigChanged(): void {
		void this.eventBus.emit("dataExchange.config.changed", {
			importCount: this.state.savedImportConfigs.length,
			exportCount: this.state.savedExportConfigs.length,
		});
	}

	/** Cleans up all event listeners. */
	dispose(): void {
		for (const unsub of this.unsubscribes) {
			unsub();
		}
		this.unsubscribes = [];
	}
}
