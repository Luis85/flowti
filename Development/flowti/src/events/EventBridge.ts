import { TFile } from "obsidian";
import type { App } from "obsidian";
import type { EventBridgeOptions, IEventBridge, IEventBus } from "./types";
import type { ILogger } from "../logger/types";

/**
 * Bridges Obsidian's API with the internal EventBus.
 *
 * Handles five categories of events:
 * 1. **File system requests**: Listens for `file.*.request` events from services,
 *    performs the Obsidian vault operation, and emits `file.*.response`.
 * 2. **Frontmatter requests**: Listens for `frontmatter.*.request` events,
 *    performs metadata operations, and emits `frontmatter.*.response`.
 * 3. **Vault notifications**: Listens for Obsidian vault events (create, modify,
 *    delete, rename) and emits internal notification events.
 * 4. **Workspace notifications**: Listens for Obsidian workspace events
 *    (active-leaf-change, file-open, layout-change) and emits `workspace.*` events.
 * 5. **MetadataCache notifications**: Listens for metadata cache events
 *    (changed, resolved) and emits `metadata.*` events.
 *
 * This separation keeps services decoupled from the Obsidian API and makes
 * them fully testable with a mock EventBus.
 *
 * @example
 * ```typescript
 * const bridge = new EventBridge({
 *   app: this.app,
 *   eventBus: this.eventBus,
 *   logger: this.logger,
 *   registerEvent: (ref) => this.registerEvent(ref),
 * });
 * bridge.register();
 * ```
 */
export class EventBridge implements IEventBridge {
	private app: App;
	private eventBus: IEventBus;
	private logger: ILogger;
	private registerEvent: (eventRef: import("obsidian").EventRef) => void;
	private unsubscribers: (() => void)[] = [];

	constructor(options: EventBridgeOptions) {
		this.app = options.app;
		this.eventBus = options.eventBus;
		this.logger = options.logger;
		this.registerEvent = options.registerEvent;
	}

	register(): void {
		this.setupFileSystemHandlers();
		this.setupFrontmatterHandlers();
		this.setupVaultListeners();
		this.setupWorkspaceListeners();
		this.setupMetadataCacheListeners();
		this.logger.debug("EventBridge registered");
	}

	dispose(): void {
		for (const unsub of this.unsubscribers) {
			unsub();
		}
		this.unsubscribers = [];
		this.logger.debug("EventBridge disposed");
	}

	/**
	 * Set up event listeners for file system operations.
	 * Bridges the EventBus with Obsidian's file API.
	 */
	private setupFileSystemHandlers(): void {
		// Handle file.create.request
		this.unsubscribers.push(
			this.eventBus.on("file.create.request", async (event) => {
				const { requestId, path, content, createFolders } = event.payload;
				try {
					if (createFolders) {
						const folderPath = path.substring(0, path.lastIndexOf("/"));
						if (
							folderPath &&
							!this.app.vault.getAbstractFileByPath(folderPath)
						) {
							await this.app.vault.createFolder(folderPath);
						}
					}

					await this.app.vault.create(path, content);

					await this.eventBus.emit("file.create.response", {
						requestId,
						success: true,
						path,
					});
				} catch (error) {
					await this.eventBus.emit("file.create.response", {
						requestId,
						success: false,
						path,
						error: {
							code: "FILE_CREATE_FAILED",
							message:
								error instanceof Error ? error.message : String(error),
							path,
						},
					});
				}
			})
		);

		// Handle file.read.request
		this.unsubscribers.push(
			this.eventBus.on("file.read.request", async (event) => {
				const { requestId, path } = event.payload;
				try {
					const file = this.app.vault.getAbstractFileByPath(path);
					if (!file || !(file instanceof TFile)) {
						throw new Error(`File not found: ${path}`);
					}

					const content = await this.app.vault.read(file);

					await this.eventBus.emit("file.read.response", {
						requestId,
						success: true,
						path,
						content,
					});
				} catch (error) {
					await this.eventBus.emit("file.read.response", {
						requestId,
						success: false,
						path,
						error: {
							code: "FILE_READ_FAILED",
							message:
								error instanceof Error ? error.message : String(error),
							path,
						},
					});
				}
			})
		);

		// Handle file.update.request
		this.unsubscribers.push(
			this.eventBus.on("file.update.request", async (event) => {
				const { requestId, path, content } = event.payload;
				try {
					const file = this.app.vault.getAbstractFileByPath(path);
					if (!file || !(file instanceof TFile)) {
						throw new Error(`File not found: ${path}`);
					}

					await this.app.vault.modify(file, content);

					await this.eventBus.emit("file.update.response", {
						requestId,
						success: true,
						path,
					});
				} catch (error) {
					await this.eventBus.emit("file.update.response", {
						requestId,
						success: false,
						path,
						error: {
							code: "FILE_UPDATE_FAILED",
							message:
								error instanceof Error ? error.message : String(error),
							path,
						},
					});
				}
			})
		);

		// Handle file.delete.request
		this.unsubscribers.push(
			this.eventBus.on("file.delete.request", async (event) => {
				const { requestId, path } = event.payload;
				try {
					const file = this.app.vault.getAbstractFileByPath(path);
					if (!file) {
						throw new Error(`File not found: ${path}`);
					}

					await this.app.vault.delete(file);

					await this.eventBus.emit("file.delete.response", {
						requestId,
						success: true,
						path,
					});
				} catch (error) {
					await this.eventBus.emit("file.delete.response", {
						requestId,
						success: false,
						path,
						error: {
							code: "FILE_DELETE_FAILED",
							message:
								error instanceof Error ? error.message : String(error),
							path,
						},
					});
				}
			})
		);

		// Handle file.move.request
		this.unsubscribers.push(
			this.eventBus.on("file.move.request", async (event) => {
				const { requestId, path, newPath } = event.payload;
				try {
					const file = this.app.vault.getAbstractFileByPath(path);
					if (!file) {
						throw new Error(`File not found: ${path}`);
					}

					await this.app.fileManager.renameFile(file, newPath);

					await this.eventBus.emit("file.move.response", {
						requestId,
						success: true,
						path,
						newPath,
					});
				} catch (error) {
					await this.eventBus.emit("file.move.response", {
						requestId,
						success: false,
						path,
						error: {
							code: "FILE_MOVE_FAILED",
							message:
								error instanceof Error ? error.message : String(error),
							path,
						},
					});
				}
			})
		);

		// Handle file.rename.request
		this.unsubscribers.push(
			this.eventBus.on("file.rename.request", async (event) => {
				const { requestId, path, newName } = event.payload;
				try {
					const file = this.app.vault.getAbstractFileByPath(path);
					if (!file) {
						throw new Error(`File not found: ${path}`);
					}

					const folderPath = path.substring(0, path.lastIndexOf("/"));
					const newPath = folderPath ? `${folderPath}/${newName}` : newName;

					await this.app.fileManager.renameFile(file, newPath);

					await this.eventBus.emit("file.rename.response", {
						requestId,
						success: true,
						path,
						newPath,
					});
				} catch (error) {
					await this.eventBus.emit("file.rename.response", {
						requestId,
						success: false,
						path,
						error: {
							code: "FILE_RENAME_FAILED",
							message:
								error instanceof Error ? error.message : String(error),
							path,
						},
					});
				}
			})
		);

		this.logger.debug("File system handlers initialized");
	}

	/**
	 * Set up event listeners for frontmatter operations.
	 * Bridges the EventBus with Obsidian's metadata API.
	 */
	private setupFrontmatterHandlers(): void {
		// Handle frontmatter.get.request
		this.unsubscribers.push(
			this.eventBus.on("frontmatter.get.request", async (event) => {
				const { requestId, path } = event.payload;
				try {
					const file = this.app.vault.getAbstractFileByPath(path);
					if (!file || !(file instanceof TFile)) {
						throw new Error(`File not found: ${path}`);
					}

					const cache = this.app.metadataCache.getFileCache(file);
					const data = cache?.frontmatter ?? {};

					await this.eventBus.emit("frontmatter.get.response", {
						requestId,
						success: true,
						path,
						data,
					});
				} catch (error) {
					await this.eventBus.emit("frontmatter.get.response", {
						requestId,
						success: false,
						path,
						error: {
							code: "FRONTMATTER_GET_FAILED",
							message:
								error instanceof Error ? error.message : String(error),
							path,
						},
					});
				}
			})
		);

		// Handle frontmatter.update.request (merge with existing)
		this.unsubscribers.push(
			this.eventBus.on("frontmatter.update.request", async (event) => {
				const { requestId, path, data } = event.payload;
				try {
					const file = this.app.vault.getAbstractFileByPath(path);
					if (!file || !(file instanceof TFile)) {
						throw new Error(`File not found: ${path}`);
					}

					await this.app.fileManager.processFrontMatter(
						file,
						(frontmatter) => {
							Object.assign(frontmatter, data);
						}
					);

					const cache = this.app.metadataCache.getFileCache(file);
					const updatedData = cache?.frontmatter ?? {};

					await this.eventBus.emit("frontmatter.update.response", {
						requestId,
						success: true,
						path,
						data: updatedData,
					});
				} catch (error) {
					await this.eventBus.emit("frontmatter.update.response", {
						requestId,
						success: false,
						path,
						error: {
							code: "FRONTMATTER_UPDATE_FAILED",
							message:
								error instanceof Error ? error.message : String(error),
							path,
						},
					});
				}
			})
		);

		// Handle frontmatter.set.request (replace entire frontmatter)
		this.unsubscribers.push(
			this.eventBus.on("frontmatter.set.request", async (event) => {
				const { requestId, path, data } = event.payload;
				try {
					const file = this.app.vault.getAbstractFileByPath(path);
					if (!file || !(file instanceof TFile)) {
						throw new Error(`File not found: ${path}`);
					}

					await this.app.fileManager.processFrontMatter(
						file,
						(frontmatter) => {
							for (const key of Object.keys(frontmatter)) {
								delete frontmatter[key];
							}
							Object.assign(frontmatter, data);
						}
					);

					await this.eventBus.emit("frontmatter.set.response", {
						requestId,
						success: true,
						path,
					});
				} catch (error) {
					await this.eventBus.emit("frontmatter.set.response", {
						requestId,
						success: false,
						path,
						error: {
							code: "FRONTMATTER_SET_FAILED",
							message:
								error instanceof Error ? error.message : String(error),
							path,
						},
					});
				}
			})
		);

		this.logger.debug("Frontmatter handlers initialized");
	}

	/**
	 * Set up Obsidian vault event listeners.
	 * Translates external vault changes into internal notification events.
	 */
	private setupVaultListeners(): void {
		this.registerEvent(
			this.app.vault.on("create", (file) => {
				if (file instanceof TFile) {
					void this.eventBus.emit("file.created", {
						path: file.path,
						source: "obsidian",
					});
				}
			})
		);

		this.registerEvent(
			this.app.vault.on("modify", (file) => {
				if (file instanceof TFile) {
					void this.eventBus.emit("file.modified", {
						path: file.path,
						source: "obsidian",
					});
				}
			})
		);

		this.registerEvent(
			this.app.vault.on("delete", (file) => {
				if (file instanceof TFile) {
					void this.eventBus.emit("file.deleted", {
						path: file.path,
						source: "obsidian",
					});
				}
			})
		);

		this.registerEvent(
			this.app.vault.on("rename", (file, oldPath) => {
				if (file instanceof TFile) {
					void this.eventBus.emit("file.renamed", {
						oldPath,
						newPath: file.path,
						source: "obsidian",
					});
				}
			})
		);

		this.logger.debug("Vault listeners initialized");
	}

	/**
	 * Set up Obsidian workspace event listeners.
	 * Translates workspace interactions into internal notification events.
	 */
	private setupWorkspaceListeners(): void {
		this.registerEvent(
			this.app.workspace.on("active-leaf-change", (leaf) => {
				let file: {
					path: string;
					basename: string;
					extension: string;
				} | null = null;

				if (leaf) {
					const viewState = leaf.view;
					if (viewState && "file" in viewState) {
						const f = viewState.file as TFile | null;
						if (f instanceof TFile) {
							file = {
								path: f.path,
								basename: f.basename,
								extension: f.extension,
							};
						}
					}
				}

				void this.eventBus.emit("workspace.leaf-changed", { file });
			})
		);

		this.registerEvent(
			this.app.workspace.on("file-open", (openedFile) => {
				const file =
					openedFile instanceof TFile
						? {
								path: openedFile.path,
								basename: openedFile.basename,
								extension: openedFile.extension,
							}
						: null;

				void this.eventBus.emit("workspace.file-opened", { file });
			})
		);

		this.registerEvent(
			this.app.workspace.on("layout-change", () => {
				void this.eventBus.emit("workspace.layout-changed", {});
			})
		);

		this.logger.debug("Workspace listeners initialized");
	}

	/**
	 * Set up Obsidian metadata cache event listeners.
	 * Translates metadata updates into internal notification events.
	 */
	private setupMetadataCacheListeners(): void {
		this.registerEvent(
			this.app.metadataCache.on("changed", (file) => {
				if (file instanceof TFile) {
					const cache = this.app.metadataCache.getFileCache(file);
					void this.eventBus.emit("metadata.changed", {
						path: file.path,
						frontmatter: cache?.frontmatter as
							| Record<string, unknown>
							| undefined,
					});
				}
			})
		);

		this.registerEvent(
			this.app.metadataCache.on("resolved", () => {
				void this.eventBus.emit("metadata.resolved", {});
			})
		);

		this.logger.debug("MetadataCache listeners initialized");
	}
}
