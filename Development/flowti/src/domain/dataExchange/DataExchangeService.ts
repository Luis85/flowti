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
	private storage: IStorageProvider | null;
	private state: DataExchangeState = createDefaultState();
	private importService: ImportService;
	private exportService: ExportService;
	private unsubscribes: (() => void)[] = [];

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
		return saved;
	}

	async deleteImportConfig(id: string): Promise<void> {
		this.state.savedImportConfigs =
			this.state.savedImportConfigs.filter((c) => c.id !== id);
		await this.saveState();
	}

	// ── Export config CRUD ──────────────────────────────────

	getSavedExportConfigs(): SavedExportConfig[] {
		return [...this.state.savedExportConfigs];
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
		return saved;
	}

	async deleteExportConfig(id: string): Promise<void> {
		this.state.savedExportConfigs =
			this.state.savedExportConfigs.filter((c) => c.id !== id);
		await this.saveState();
	}

	/** Cleans up all event listeners. */
	dispose(): void {
		for (const unsub of this.unsubscribes) {
			unsub();
		}
		this.unsubscribes = [];
	}
}
