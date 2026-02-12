import type { IEventBus } from "../../infrastructure/events/types";
import type { IStorageProvider } from "../../utils/types";
import type { DiscoveredEvent, DiscoveryState } from "./types";

/**
 * Configuration options for the DiscoveryService.
 */
export interface DiscoveryServiceOptions {
	storage: IStorageProvider;
	eventBus?: IEventBus;
}

/**
 * Creates a fresh default discovery state.
 */
function createDefaultState(): DiscoveryState {
	return { events: {} };
}

/**
 * Service for discovering user-land events from vault files.
 *
 * Listens to `event.file.triggered` events (fired when files with
 * `type: "Event"` frontmatter are created/modified/deleted/renamed),
 * persists discovered event names, and emits discovery events so the
 * Event Catalog can display them alongside system events.
 */
export class DiscoveryService {
	private state: DiscoveryState = createDefaultState();
	private storage: IStorageProvider;
	private eventBus?: IEventBus;
	private unsubscribes: (() => void)[] = [];

	constructor(options: DiscoveryServiceOptions) {
		this.storage = options.storage;
		this.eventBus = options.eventBus;

		if (this.eventBus) {
			this.unsubscribes.push(
				this.eventBus.on("event.file.triggered", (event) =>
					this.handleEventFileTriggered(
						event.payload.eventName,
						event.payload.path
					)
				)
			);
			this.unsubscribes.push(
				this.eventBus.on("discovery.create", (event) =>
					this.handleCreate(event.payload.eventName, event.payload.category)
				)
			);
			this.unsubscribes.push(
				this.eventBus.on("discovery.remove", (event) =>
					this.handleRemove(event.payload.eventName)
				)
			);
		}
	}

	/**
	 * Loads discovery state from storage.
	 * Emits "discovery.loaded" with the current discovered events.
	 */
	async load(): Promise<void> {
		const data = (await this.storage.load()) as {
			discovery?: DiscoveryState;
		} | null;
		if (data?.discovery) {
			this.state = data.discovery;
		}
		await this.eventBus?.emit("discovery.loaded", {
			discoveredEvents: this.getDiscoveredEvents(),
		});
	}

	/**
	 * Returns all discovered events.
	 */
	getDiscoveredEvents(): DiscoveredEvent[] {
		return Object.values(this.state.events);
	}

	/**
	 * Handles an incoming event file trigger by upserting the discovered event.
	 */
	private async handleEventFileTriggered(
		eventName: string,
		path: string
	): Promise<void> {
		const now = new Date().toISOString();
		const existing = this.state.events[eventName];
		const isNew = !existing;

		const updated: DiscoveredEvent = existing
			? {
					...existing,
					sourcePath: path,
					lastSeenAt: now,
					triggerCount: existing.triggerCount + 1,
				}
			: {
					eventName,
					sourcePath: path,
					firstSeenAt: now,
					lastSeenAt: now,
					triggerCount: 1,
				};

		this.state.events[eventName] = updated;
		await this.saveState();
		await this.eventBus?.emit("discovery.updated", {
			event: updated,
			isNew,
		});

		// Fire the custom event itself so wildcard listeners (Activity Log) can see it
		await this.eventBus?.emitCustom(eventName, { sourcePath: path });
	}

	/**
	 * Creates a new custom event manually (before it has ever fired).
	 */
	private async handleCreate(eventName: string, category?: string): Promise<void> {
		if (this.state.events[eventName]) return;

		const now = new Date().toISOString();
		const created: DiscoveredEvent = {
			eventName,
			sourcePath: "",
			firstSeenAt: now,
			lastSeenAt: now,
			triggerCount: 0,
			...(category ? { category } : {}),
		};

		this.state.events[eventName] = created;
		await this.saveState();
		await this.eventBus?.emit("discovery.updated", {
			event: created,
			isNew: true,
		});
	}

	/**
	 * Removes a discovered event by name.
	 */
	private async handleRemove(eventName: string): Promise<void> {
		if (!this.state.events[eventName]) return;

		delete this.state.events[eventName];
		await this.saveState();
		await this.eventBus?.emit("discovery.removed", { eventName });
	}

	/**
	 * Persists the discovery state to storage.
	 */
	private async saveState(): Promise<void> {
		const existingData = ((await this.storage.load()) as object) || {};
		await this.storage.save({
			...existingData,
			discovery: this.state,
		});
	}

	/**
	 * Unsubscribes from event bus listeners.
	 */
	dispose(): void {
		for (const unsub of this.unsubscribes) unsub();
		this.unsubscribes = [];
	}
}
