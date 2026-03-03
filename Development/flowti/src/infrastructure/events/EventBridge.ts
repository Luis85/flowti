import { TFile, TFolder } from "obsidian";
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
	/** Paths of files that were just created — consumed by metadata.changed listener */
	private pendingCreatedPaths = new Set<string>();
	private static readonly MAX_PENDING_PATHS = 100;
	/** Gate: suppresses vault/metadata events until first metadata.resolved fires */
	private cacheResolved = false;

	/** Extensions Obsidian's vault API indexes and manages natively */
	private static readonly VAULT_MANAGED_EXTENSIONS = new Set([
		"md", "canvas",
		"png", "jpg", "jpeg", "gif", "svg", "webp", "bmp", "avif",
		"mp3", "wav", "m4a", "ogg", "3gp", "flac",
		"mp4", "ogv", "mov", "mkv", "webm",
		"pdf",
	]);

	constructor(options: EventBridgeOptions) {
		this.app = options.app;
		this.eventBus = options.eventBus;
		this.logger = options.logger;
		this.registerEvent = options.registerEvent;
	}

	register(): void {
		this.setupFileSystemHandlers();
		this.setupFrontmatterHandlers();
		this.logger.debug("EventBridge request handlers registered");
	}

	registerVaultListeners(): void {
		this.setupVaultListeners();
		this.setupWorkspaceListeners();
		this.setupMetadataCacheListeners();
		this.logger.debug("EventBridge vault listeners registered");
	}

	dispose(): void {
		for (const unsub of this.unsubscribers) {
			unsub();
		}
		this.unsubscribers = [];
		this.logger.debug("EventBridge disposed");
	}

	/** Returns true if the file extension is managed by Obsidian's vault API. */
	private isVaultManaged(path: string): boolean {
		const dotIdx = path.lastIndexOf(".");
		if (dotIdx < 0) return false;
		const ext = path.substring(dotIdx + 1).toLowerCase();
		return EventBridge.VAULT_MANAGED_EXTENSIONS.has(ext);
	}

	/** Creates a file via the vault adapter (for non-vault-managed extensions). */
	private async createViaAdapter(
		path: string,
		content: string,
		createFolders?: boolean,
	): Promise<void> {
		const adapter = this.app.vault.adapter;
		if (createFolders) {
			const folderPath = path.substring(0, path.lastIndexOf("/"));
			if (folderPath && !(await adapter.exists(folderPath))) {
				await adapter.mkdir(folderPath);
			}
		}
		await adapter.write(path, content);
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
					if (!this.isVaultManaged(path)) {
						// Non-standard extension — vault won't track it, use adapter
						await this.createViaAdapter(path, content, createFolders);
						await this.eventBus.emit("file.create.response", {
							requestId,
							success: true,
							path,
						});
						return;
					}

					if (createFolders) {
						const folderPath = path.substring(0, path.lastIndexOf("/"));
						if (
							folderPath &&
							!this.app.vault.getAbstractFileByPath(folderPath)
						) {
							try {
								await this.app.vault.createFolder(folderPath);
							} catch {
								// Folder may already exist due to race condition or stale metadata cache — skip
							}
						}
					}

					// Guard: if file already exists, report success (idempotent)
					if (this.app.vault.getAbstractFileByPath(path)) {
						await this.eventBus.emit("file.create.response", {
							requestId,
							success: true,
							path,
						});
						return;
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
					let content: string;

					if (!this.isVaultManaged(path)) {
						// Non-standard extension — read via adapter
						const adapter = this.app.vault.adapter;
						if (!(await adapter.exists(path))) {
							throw new Error(`File not found: ${path}`);
						}
						content = await adapter.read(path);
					} else {
						const file = this.app.vault.getAbstractFileByPath(path);
						if (!file || !(file instanceof TFile)) {
							throw new Error(`File not found: ${path}`);
						}
						content = await this.app.vault.read(file);
					}

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
					if (!this.isVaultManaged(path)) {
						const adapter = this.app.vault.adapter;
						if (!(await adapter.exists(path))) {
							throw new Error(`File not found: ${path}`);
						}
						await adapter.write(path, content);
					} else {
						const file = this.app.vault.getAbstractFileByPath(path);
						if (!file || !(file instanceof TFile)) {
							throw new Error(`File not found: ${path}`);
						}
						await this.app.vault.modify(file, content);
					}

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
					if (!this.isVaultManaged(path)) {
						const adapter = this.app.vault.adapter;
						if (!(await adapter.exists(path))) {
							throw new Error(`File not found: ${path}`);
						}
						await adapter.remove(path);
					} else {
						const file = this.app.vault.getAbstractFileByPath(path);
						if (!file) {
							throw new Error(`File not found: ${path}`);
						}
						await this.app.fileManager.trashFile(file);
					}

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

		// Handle file.list.request (recursive — walks subdirectories)
		this.unsubscribers.push(
			this.eventBus.on("file.list.request", async (event) => {
				const { requestId, path } = event.payload;
				try {
					const adapter = this.app.vault.adapter;
					if (!(await adapter.exists(path))) {
						await this.eventBus.emit("file.list.response", {
							requestId,
							success: true,
							path,
							files: [],
						});
						return;
					}
					const collectFiles = async (dir: string): Promise<string[]> => {
						const listing = await adapter.list(dir);
						let files = [...listing.files];
						for (const sub of listing.folders) {
							files = files.concat(await collectFiles(sub));
						}
						return files;
					};
					const files = await collectFiles(path);
					await this.eventBus.emit("file.list.response", {
						requestId,
						success: true,
						path,
						files,
					});
				} catch (error) {
					await this.eventBus.emit("file.list.response", {
						requestId,
						success: false,
						path,
						error: {
							code: "FILE_LIST_FAILED",
							message:
								error instanceof Error ? error.message : String(error),
							path,
						},
					});
				}
			})
		);

		// Handle folder.ensure.request
		this.unsubscribers.push(
			this.eventBus.on("folder.ensure.request", async (event) => {
				const { requestId, path } = event.payload;
				try {
					const adapter = this.app.vault.adapter;
					if (!(await adapter.exists(path))) {
						await adapter.mkdir(path);
					}
					await this.eventBus.emit("folder.ensure.response", {
						requestId,
						success: true,
						path,
					});
				} catch (error) {
					await this.eventBus.emit("folder.ensure.response", {
						requestId,
						success: false,
						path,
						error: {
							code: "FOLDER_ENSURE_FAILED",
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

					let mergedFrontmatter: Record<string, unknown> = {};
					await this.app.fileManager.processFrontMatter(
						file,
						(frontmatter) => {
							Object.assign(frontmatter, data);
							mergedFrontmatter = { ...frontmatter };
						}
					);

					await this.eventBus.emit("frontmatter.update.response", {
						requestId,
						success: true,
						path,
						data: mergedFrontmatter,
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
				if (!this.cacheResolved) return;
				if (file instanceof TFile) {
					void this.eventBus.emit("file.created", {
						path: file.path,
						source: "obsidian",
					});
					// Cache is not populated yet on create — defer to metadata.changed
					if (this.pendingCreatedPaths.size >= EventBridge.MAX_PENDING_PATHS) {
						this.pendingCreatedPaths.clear();
					}
					this.pendingCreatedPaths.add(file.path);
				} else if (file instanceof TFolder) {
					void this.eventBus.emit("folder.created", {
						path: file.path,
						source: "obsidian",
					});
				}
			})
		);

		this.registerEvent(
			this.app.vault.on("modify", (file) => {
				if (!this.cacheResolved) return;
				if (file instanceof TFile) {
					void this.eventBus.emit("file.modified", {
						path: file.path,
						source: "obsidian",
					});
					this.emitEventFileTriggered(file, "modified");
				}
			})
		);

		this.registerEvent(
			this.app.vault.on("delete", (file) => {
				if (!this.cacheResolved) return;
				if (file instanceof TFile) {
					void this.eventBus.emit("file.deleted", {
						path: file.path,
						source: "obsidian",
					});
					this.emitEventFileTriggered(file, "deleted");
				} else if (file instanceof TFolder) {
					void this.eventBus.emit("folder.deleted", {
						path: file.path,
						source: "obsidian",
					});
				}
			})
		);

		this.registerEvent(
			this.app.vault.on("rename", (file, oldPath) => {
				if (!this.cacheResolved) return;
				if (file instanceof TFile) {
					void this.eventBus.emit("file.renamed", {
						path: file.path,
						oldPath,
						newPath: file.path,
						source: "obsidian",
					});
					this.emitEventFileTriggered(file, "renamed");
				} else if (file instanceof TFolder) {
					void this.eventBus.emit("folder.renamed", {
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
	 * Check if a file has frontmatter `type: "event"` and `name`,
	 * and if so emit an `event.file.triggered` event.
	 */
	private emitEventFileTriggered(
		file: TFile,
		action: "created" | "modified" | "deleted" | "renamed"
	): void {
		const cache = this.app.metadataCache.getFileCache(file);
		const fm = cache?.frontmatter;
		if (fm?.type === "Event") {
			const eventName =
				typeof fm.name === "string"
					? fm.name
					: file.basename.toLowerCase().replace(/ /g, ".");
			void this.eventBus.emit("event.file.triggered", {
				eventName,
				path: file.path,
				action,
			});
		}
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
				if (!this.cacheResolved) return;
				if (file instanceof TFile) {
					const cache = this.app.metadataCache.getFileCache(file);
					void this.eventBus.emit("metadata.changed", {
						path: file.path,
						frontmatter: cache?.frontmatter as
							| Record<string, unknown>
							| undefined,
					});

					// On file creation, the vault "create" event fires before
					// the metadata cache is populated. The create listener
					// records the path; we consume it here once the cache
					// is available.
					if (this.pendingCreatedPaths.delete(file.path)) {
						this.emitEventFileTriggered(file, "created");
					}
				}
			})
		);

		this.registerEvent(
			this.app.metadataCache.on("resolved", () => {
				if (!this.cacheResolved) {
					this.cacheResolved = true;
					this.logger.debug("MetadataCache resolved — vault event gate opened");
				}
				void this.eventBus.emit("metadata.resolved", {});
			})
		);

		this.logger.debug("MetadataCache listeners initialized");
	}
}
