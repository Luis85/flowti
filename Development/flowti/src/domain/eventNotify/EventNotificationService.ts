import type { IEventBus } from "../../infrastructure/events/types";
import { loadStateFromStorage, saveStateToStorage } from "../../utils/persistence";
import type { IStorageProvider } from "../../utils/types";
import type { EventNotifyState } from "./types";

/**
 * Configuration options for the EventNotificationService.
 */
export interface EventNotificationServiceOptions {
	storage: IStorageProvider;
	eventBus?: IEventBus;
}

/**
 * Creates a fresh default notify state (nothing notified).
 */
function createDefaultState(): EventNotifyState {
	return { notifiedTypes: [] };
}

/**
 * Service for managing event notifications via Obsidian Notice popups.
 *
 * Owns a persisted set of event types that trigger notifications.
 * Views communicate with this service via EventBus: emitting
 * `eventNotify.toggle` commands, and subscribing to
 * `eventNotify.changed` for state updates.
 *
 * Uses a wildcard listener to observe all events. When a matching
 * event fires, emits `eventNotify.fired` which main.ts consumes
 * to show an Obsidian Notice (keeping this service Obsidian-free).
 */
export class EventNotificationService {
	private state: EventNotifyState = createDefaultState();
	private notified: Set<string> = new Set();
	private storage: IStorageProvider;
	private eventBus?: IEventBus;
	private unsubscribes: (() => void)[] = [];

	constructor(options: EventNotificationServiceOptions) {
		this.storage = options.storage;
		this.eventBus = options.eventBus;

		if (this.eventBus) {
			this.unsubscribes.push(
				this.eventBus.on("eventNotify.toggle", (event) =>
					this.handleToggle(event.payload.eventType)
				)
			);

			// Wildcard listener to detect when notified events fire
			this.unsubscribes.push(
				this.eventBus.on("*", (event) => {
					const type = event.type;
					// Skip log.* and eventNotify.* to avoid infinite loops
					if (type.startsWith("log.") || type.startsWith("eventNotify.")) return;
					if (this.notified.has(type)) {
						void this.eventBus?.emit("eventNotify.fired", {
							eventType: type,
							timestamp: new Date().toISOString(),
						});
					}
				})
			);
		}
	}

	/**
	 * Loads notify state from storage.
	 * Emits "eventNotify.loaded" with the current notification list.
	 */
	async load(): Promise<void> {
		const saved = await loadStateFromStorage<EventNotifyState>(this.storage, "eventNotify");
		if (saved) {
			this.state = saved;
			this.notified = new Set(this.state.notifiedTypes);
		}
		await this.eventBus?.emit("eventNotify.loaded", {
			notifiedTypes: this.state.notifiedTypes,
		});
	}

	/**
	 * Checks if an event type has notifications enabled.
	 */
	isNotified(eventType: string): boolean {
		return this.notified.has(eventType);
	}

	/**
	 * Returns the current list of notified event types.
	 */
	getNotifiedTypes(): string[] {
		return [...this.notified];
	}

	/**
	 * Toggles a single event type's notification.
	 */
	private async handleToggle(eventType: string): Promise<void> {
		if (this.notified.has(eventType)) {
			this.notified.delete(eventType);
		} else {
			this.notified.add(eventType);
		}
		await this.syncAndEmit();
	}

	/**
	 * Syncs the Set back to state, persists, and emits change event.
	 */
	private async syncAndEmit(): Promise<void> {
		this.state.notifiedTypes = [...this.notified];
		await this.saveState();
		await this.eventBus?.emit("eventNotify.changed", {
			notifiedTypes: this.state.notifiedTypes,
		});
	}

	/**
	 * Persists the notify state to storage.
	 */
	private async saveState(): Promise<void> {
		await saveStateToStorage(this.storage, "eventNotify", this.state);
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
