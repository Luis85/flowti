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
	mapImportFailed,
	mapExportCompleted,
	mapPipelineCompleted,
	mapPipelineFailed,
	mapSyncCompleted,
	mapSyncFailed,
} from "./mappers";

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
	private enabledSources: Set<string> = new Set(ALL_INBOX_SOURCES);

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
	 * Unsubscribes from event bus listeners.
	 */
	dispose(): void {
		for (const unsub of this.unsubscribes) {
			unsub();
		}
		this.unsubscribes = [];
	}
}
