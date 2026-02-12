/**
 * DataExchangeService — top-level orchestrator for import/export operations.
 *
 * Wires ImportService + ExportService and handles EventBus command events.
 * Follows the same service pattern as SubscriptionService.
 */

import type { IEventBus } from "../../infrastructure/events/types";
import type { IFileSystemClient } from "../../infrastructure/filesystem/types";
import type { VaultFileInfo } from "./types";
import { ImportService } from "./ImportService";
import { ExportService, type ListFilesCallback, type WriteExternalFileCallback } from "./ExportService";

export interface DataExchangeServiceOptions {
	eventBus: IEventBus;
	fileSystem: IFileSystemClient;
	listFiles?: ListFilesCallback;
}

export class DataExchangeService {
	private eventBus: IEventBus;
	private importService: ImportService;
	private exportService: ExportService;
	private unsubscribes: (() => void)[] = [];

	constructor(options: DataExchangeServiceOptions) {
		this.eventBus = options.eventBus;

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

	/** Cleans up all event listeners. */
	dispose(): void {
		for (const unsub of this.unsubscribes) {
			unsub();
		}
		this.unsubscribes = [];
	}
}
