import { TFile, TFolder } from "obsidian";
import type { App } from "obsidian";
import type { EventBridgeOptions, IEventBridge, IEventBus } from "./types";
import type { ILogger } from "../logger/types";
import { setupFileSystemHandlers, setupFrontmatterHandlers } from "./EventBridge-fs-handlers";

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

	constructor(options: EventBridgeOptions) {
		this.app = options.app;
		this.eventBus = options.eventBus;
		this.logger = options.logger;
		this.registerEvent = options.registerEvent;
	}

	register(): void {
		const fsUnsubs = setupFileSystemHandlers(this.app, this.eventBus, this.logger);
		this.unsubscribers.push(...fsUnsubs);
		const fmUnsubs = setupFrontmatterHandlers(this.app, this.eventBus, this.logger);
		this.unsubscribers.push(...fmUnsubs);
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
