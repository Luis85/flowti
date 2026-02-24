/**
 * Inbox domain service.
 *
 * Listens to source events (subscription matches, import/export results),
 * converts them to InboxItems via pure mappers, persists state via
 * TypedStorage, and emits inbox lifecycle events.
 *
 * Source events can be enabled/disabled via setEnabledSources().
 * Follows the same pattern as SubscriptionService.
 */

import type { IEventBus } from "../../infrastructure/events/types";
import type { ITypedStorage } from "../../utils/TypedStorage";
import { generateUUID } from "../../utils/helpers";
import type { InboxItem, InboxState } from "./types";
import { MAX_INBOX_ITEMS } from "./types";
import {
	mapSubscriptionMatched,
	mapImportCompleted,
	mapImportToAnalytics,
	mapImportFailed,
	mapExportCompleted,
	mapPipelineCompleted,
	mapPipelineFailed,
	mapSyncCompleted,
	mapSyncFailed,
	mapCaptureNoteCreated,
	mapTrainThoughtAdded,
	mapTrainCompleted,
	mapCanvasImportCompleted,
	mapCanvasImportFailed,
} from "./mappers";
import { mapVaultFolderNote, VAULT_FOLDER_SOURCE_EVENT, VAULT_FOLDER_SOURCE_HUB } from "./vaultFolderMapper";

/** All source event types the inbox can listen to. */
export const ALL_INBOX_SOURCES = [
	"subscription.matched",
	"dataExchange.import.completed",
	"dataExchange.import.failed",
	"dataExchange.export.completed",
	"dataExchange.pipeline.completed",
	"dataExchange.pipeline.failed",
	"signal.sync.completed",
	"signal.sync.failed",
	"inbox.vaultFolder.noteDetected",
	"capture.note.created",
	"train.thought.added",
	"train.completed",
	"canvas.import.completed",
	"canvas.import.failed",
] as const;

/**
 * Configuration options for the InboxService.
 */
export interface InboxServiceOptions {
	storage: ITypedStorage<InboxState>;
	eventBus?: IEventBus;
}

/**
 * Creates a fresh default inbox state.
 */
function createDefaultState(): InboxState {
	return { items: [] };
}

/**
 * Generates a unique inbox item ID.
 */
function generateId(): string {
	return `inbox_${generateUUID()}`;
}

/**
 * Service for managing the user's inbox.
 *
 * Captures actionable and informational items from domain events,
 * persists them across sessions, and exposes state for the UI.
 */
export class InboxService {
	private state: InboxState = createDefaultState();
	private storage: ITypedStorage<InboxState>;
	private eventBus?: IEventBus;
	private unsubscribes: (() => void)[] = [];
	private enabledSources: Set<string> = new Set();
	private watchedFolders: Array<{ path: string; recursive: boolean; isPrimary?: boolean }> = [];
	private fileDebounceTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
	private triageTargetFolder = "";

	/** Late-binding frontmatter getter — wired in main.ts to metadataCache. */
	public getFrontmatter: (path: string) => Record<string, unknown> | undefined = () => undefined;

	/** Late-binding frontmatter updater — wired in main.ts to FileSystemClient. */
	public updateFileFrontmatter: (path: string, data: Record<string, unknown>) => Promise<void> = async () => {};

	/** Late-binding file mover — wired in main.ts to FileSystemClient. */
	public moveFile: (path: string, newPath: string) => Promise<string> = async (_p, np) => np;

	constructor(options: InboxServiceOptions) {
		this.storage = options.storage;
		this.eventBus = options.eventBus;

		if (this.eventBus) {
			// Source: subscription matched
			this.unsubscribes.push(
				this.eventBus.on("subscription.matched", (event) => {
					if (!this.enabledSources.has("subscription.matched")) return;
					const item = mapSubscriptionMatched(event.payload, generateId());
					void this.addItem(item);
				}),
			);

			// Source: import completed
			this.unsubscribes.push(
				this.eventBus.on("dataExchange.import.completed", (event) => {
					if (!this.enabledSources.has("dataExchange.import.completed")) return;
					const item = mapImportCompleted(event.payload, generateId());
					void this.addItem(item);
					// Analytics bridge: also create an "Analyze in Analytics Hub" action
					const analyticsItem = mapImportToAnalytics(event.payload, generateId());
					void this.addItem(analyticsItem);
				}),
			);

			// Source: import failed
			this.unsubscribes.push(
				this.eventBus.on("dataExchange.import.failed", (event) => {
					if (!this.enabledSources.has("dataExchange.import.failed")) return;
					const item = mapImportFailed(event.payload, generateId());
					void this.addItem(item);
				}),
			);

			// Source: export completed
			this.unsubscribes.push(
				this.eventBus.on("dataExchange.export.completed", (event) => {
					if (!this.enabledSources.has("dataExchange.export.completed")) return;
					const item = mapExportCompleted(event.payload, generateId());
					void this.addItem(item);
				}),
			);

			// Source: pipeline completed
			this.unsubscribes.push(
				this.eventBus.on("dataExchange.pipeline.completed", (event) => {
					if (!this.enabledSources.has("dataExchange.pipeline.completed")) return;
					const item = mapPipelineCompleted(event.payload, generateId());
					void this.addItem(item);
				}),
			);

			// Source: pipeline failed
			this.unsubscribes.push(
				this.eventBus.on("dataExchange.pipeline.failed", (event) => {
					if (!this.enabledSources.has("dataExchange.pipeline.failed")) return;
					const item = mapPipelineFailed(event.payload, generateId());
					void this.addItem(item);
				}),
			);

			// Source: signal sync completed
			this.unsubscribes.push(
				this.eventBus.on("signal.sync.completed", (event) => {
					if (!this.enabledSources.has("signal.sync.completed")) return;
					const item = mapSyncCompleted(event.payload, generateId());
					void this.addItem(item);
				}),
			);

			// Source: signal sync failed
			this.unsubscribes.push(
				this.eventBus.on("signal.sync.failed", (event) => {
					if (!this.enabledSources.has("signal.sync.failed")) return;
					const item = mapSyncFailed(event.payload, generateId());
					void this.addItem(item);
				}),
			);

			// Source: quick capture note created
			this.unsubscribes.push(
				this.eventBus.on("capture.note.created", (event) => {
					if (!this.enabledSources.has("capture.note.created")) return;
					const item = mapCaptureNoteCreated(event.payload, generateId());
					void this.addItem(item);
				}),
			);

			// Source: train thought added
			this.unsubscribes.push(
				this.eventBus.on("train.thought.added", (event) => {
					if (!this.enabledSources.has("train.thought.added")) return;
					const item = mapTrainThoughtAdded(event.payload, generateId());
					void this.addItem(item);
				}),
			);

			// Source: train completed
			this.unsubscribes.push(
				this.eventBus.on("train.completed", (event) => {
					if (!this.enabledSources.has("train.completed")) return;
					const item = mapTrainCompleted(event.payload, generateId());
					void this.addItem(item);
				}),
			);

			// Source: canvas import completed
			this.unsubscribes.push(
				this.eventBus.on("canvas.import.completed", (event) => {
					if (!this.enabledSources.has("canvas.import.completed")) return;
					const item = mapCanvasImportCompleted(event.payload, generateId());
					void this.addItem(item);
				}),
			);

			// Source: canvas import failed
			this.unsubscribes.push(
				this.eventBus.on("canvas.import.failed", (event) => {
					if (!this.enabledSources.has("canvas.import.failed")) return;
					const item = mapCanvasImportFailed(event.payload, generateId());
					void this.addItem(item);
				}),
			);

			// Source: vault folder — file created
			this.unsubscribes.push(
				this.eventBus.on("file.created", (event) => {
					this.handleVaultFolderFile(event.payload.path);
				}),
			);

			// Source: vault folder — file modified
			this.unsubscribes.push(
				this.eventBus.on("file.modified", (event) => {
					this.handleVaultFolderFile(event.payload.path);
				}),
			);

			// Command: refresh — re-emit current state
			this.unsubscribes.push(
				this.eventBus.on("inbox.refresh", () => {
					void this.eventBus?.emit("inbox.loaded", {
						items: this.getItems(),
						unreadCount: this.getUnreadCount(),
					});
				}),
			);
		}
	}

	/**
	 * Updates the set of enabled source event types.
	 * Only enabled sources will create inbox items.
	 */
	setEnabledSources(sources: string[]): void {
		this.enabledSources = new Set(sources);
	}

	/**
	 * Updates the list of watched vault folders.
	 * Called from main.ts on settings load/change.
	 */
	setWatchedFolders(folders: Array<{ path: string; recursive: boolean; isPrimary?: boolean }>): void {
		this.watchedFolders = folders;
	}

	/**
	 * Updates the triage target folder path.
	 * Called from main.ts on settings load/change.
	 */
	setTriageTargetFolder(folder: string): void {
		this.triageTargetFolder = folder;
	}

	/**
	 * Triages a vault folder inbox item: applies frontmatter, optionally routes
	 * to target folder (for primary watched folders), then dismisses the item.
	 */
	async triageVaultFolderItem(
		itemId: string,
		noteType: string,
		description?: string,
	): Promise<void> {
		const item = this.state.items.find((i) => i.id === itemId);
		if (!item || item.sourceHub !== VAULT_FOLDER_SOURCE_HUB) return;
		if (!item.filePath) return;

		// 1. Apply frontmatter
		const fmData: Record<string, unknown> = { type: noteType };
		if (description?.trim()) fmData.description = description.trim();
		await this.updateFileFrontmatter(item.filePath, fmData);

		// 2. Route if primary folder + target configured
		let moved = false;
		let targetPath: string | undefined;
		const sourceFolder = this.findMatchingFolder(item.filePath);
		const isPrimary = sourceFolder
			? this.watchedFolders.some((f) => f.path === sourceFolder && f.isPrimary)
			: false;

		if (isPrimary && this.triageTargetFolder) {
			const basename = item.filePath.split("/").pop() ?? item.filePath;
			targetPath = `${this.triageTargetFolder}/${basename}`;
			await this.moveFile(item.filePath, targetPath);
			moved = true;
		}

		// 3. Dismiss item from inbox
		await this.dismiss(itemId);

		// 4. Emit triage event
		await this.eventBus?.emit("inbox.vaultFolder.noteTriaged", {
			path: item.filePath,
			type: noteType,
			moved,
			targetPath,
		});
	}

	/**
	 * Loads inbox state from storage.
	 * Emits "inbox.loaded" with current items.
	 */
	async load(): Promise<void> {
		const saved = await this.storage.load();
		if (saved) {
			this.state = saved;
		}
		await this.eventBus?.emit("inbox.loaded", {
			items: this.getItems(),
			unreadCount: this.getUnreadCount(),
		});
	}

	/**
	 * Returns a copy of all inbox items (newest first).
	 */
	getItems(): InboxItem[] {
		return [...this.state.items];
	}

	/**
	 * Returns the number of unread items.
	 */
	getUnreadCount(): number {
		return this.state.items.filter((i) => !i.read).length;
	}

	/**
	 * Marks an item as read.
	 */
	async markRead(itemId: string): Promise<void> {
		const item = this.state.items.find((i) => i.id === itemId);
		if (!item || item.read) return;

		item.read = true;
		await this.saveState();
		await this.emitItemsChanged();
	}

	/**
	 * Marks all unread items as read.
	 */
	async markAllRead(): Promise<void> {
		const unread = this.state.items.filter((i) => !i.read);
		if (unread.length === 0) return;

		for (const item of unread) {
			item.read = true;
		}
		await this.saveState();
		await this.emitItemsChanged();
	}

	/**
	 * Removes an item from the inbox.
	 */
	async dismiss(itemId: string): Promise<void> {
		const index = this.state.items.findIndex((i) => i.id === itemId);
		if (index === -1) return;

		this.state.items.splice(index, 1);
		await this.saveState();
		await this.emitItemsChanged();
	}

	/**
	 * Clears all items from the inbox.
	 */
	async clearAll(): Promise<void> {
		if (this.state.items.length === 0) return;

		this.state.items = [];
		await this.saveState();
		await this.emitItemsChanged();
	}

	/**
	 * Adds an item to the inbox (newest first).
	 * Evicts oldest items when MAX_INBOX_ITEMS is exceeded.
	 */
	private async addItem(item: InboxItem): Promise<void> {
		this.state.items.unshift(item);

		// Evict oldest if over capacity
		if (this.state.items.length > MAX_INBOX_ITEMS) {
			this.state.items = this.state.items.slice(0, MAX_INBOX_ITEMS);
		}

		await this.saveState();
		await this.eventBus?.emit("inbox.itemAdded", { item });
	}

	/**
	 * Persists inbox state to storage.
	 */
	private async saveState(): Promise<void> {
		await this.storage.save(this.state);
	}

	/**
	 * Emits the "inbox.itemsChanged" event with current state.
	 */
	private async emitItemsChanged(): Promise<void> {
		await this.eventBus?.emit("inbox.itemsChanged", {
			items: this.getItems(),
			unreadCount: this.getUnreadCount(),
		});
	}

	/**
	 * Handles a file event for vault folder watching.
	 * Debounces by path (500ms) to allow metadataCache to settle,
	 * then checks folder membership, frontmatter, and dedup.
	 */
	private handleVaultFolderFile(path: string): void {
		if (!this.enabledSources.has(VAULT_FOLDER_SOURCE_EVENT)) return;
		if (!path.endsWith(".md")) return;
		if (this.watchedFolders.length === 0) return;

		const matchedFolder = this.findMatchingFolder(path);
		if (!matchedFolder) return;

		// Debounce per file path — metadataCache needs time to settle
		const existing = this.fileDebounceTimers.get(path);
		if (existing) clearTimeout(existing);

		this.fileDebounceTimers.set(path, setTimeout(() => {
			this.fileDebounceTimers.delete(path);
			this.processVaultFolderFile(path, matchedFolder);
		}, 500));
	}

	private findMatchingFolder(filePath: string): string | undefined {
		for (const folder of this.watchedFolders) {
			if (folder.recursive) {
				if (filePath.startsWith(folder.path + "/")) return folder.path;
			} else {
				const relative = filePath.slice(folder.path.length + 1);
				if (filePath.startsWith(folder.path + "/") && !relative.includes("/")) {
					return folder.path;
				}
			}
		}
		return undefined;
	}

	private processVaultFolderFile(path: string, folder: string): void {
		const fm = this.getFrontmatter(path);
		const typeVal = fm?.["type"];
		if (typeVal && typeof typeVal === "string" && typeVal.trim()) return;

		// Dedup: skip if unread vault-folder item for this path already exists
		const duplicate = this.state.items.some(
			(i) => i.sourceHub === VAULT_FOLDER_SOURCE_HUB && !i.read && i.filePath === path,
		);
		if (duplicate) return;

		const basename = path.split("/").pop() ?? path;
		const title = basename.replace(/\.md$/, "");

		const item = mapVaultFolderNote({ path, title, folder }, generateId());
		void this.addItem(item);
		void this.eventBus?.emit("inbox.vaultFolder.noteDetected", { path, title });
	}

	/**
	 * Unsubscribes from event bus listeners.
	 */
	dispose(): void {
		for (const timer of this.fileDebounceTimers.values()) {
			clearTimeout(timer);
		}
		this.fileDebounceTimers.clear();
		for (const unsub of this.unsubscribes) {
			unsub();
		}
		this.unsubscribes = [];
	}
}
