import type { IEventBus } from "../../infrastructure/events/types";
import { getEventsByCategory } from "../../infrastructure/events/catalog";
import { loadStateFromStorage, saveStateToStorage } from "../../utils/persistence";
import type { IStorageProvider } from "../../utils/types";
import type { EventFilterState } from "./types";

/**
 * Configuration options for the EventFilterService.
 */
export interface EventFilterServiceOptions {
	storage: IStorageProvider;
	eventBus?: IEventBus;
}

/**
 * Creates a fresh default filter state (nothing excluded).
 */
function createDefaultState(): EventFilterState {
	return { excludedTypes: [] };
}

/**
 * Service for managing event visibility in the Event Log.
 *
 * Owns a persisted set of excluded event types. Views communicate
 * with this service via EventBus: emitting `eventFilter.toggle` /
 * `eventFilter.toggleCategory` commands, and subscribing to
 * `eventFilter.changed` for state updates.
 */
export class EventFilterService {
	private state: EventFilterState = createDefaultState();
	private excluded: Set<string> = new Set();
	private storage: IStorageProvider;
	private eventBus?: IEventBus;
	private unsubscribes: (() => void)[] = [];

	constructor(options: EventFilterServiceOptions) {
		this.storage = options.storage;
		this.eventBus = options.eventBus;

		if (this.eventBus) {
			this.unsubscribes.push(
				this.eventBus.on("eventFilter.toggle", (event) =>
					this.handleToggle(event.payload.eventType)
				)
			);
			this.unsubscribes.push(
				this.eventBus.on("eventFilter.toggleCategory", (event) =>
					this.handleToggleCategory(event.payload.category)
				)
			);
		}
	}

	/**
	 * Loads filter state from storage.
	 * Emits "eventFilter.loaded" with the current exclusion list.
	 */
	async load(): Promise<void> {
		const saved = await loadStateFromStorage<EventFilterState>(this.storage, "eventFilter");
		if (saved) {
			this.state = saved;
			this.excluded = new Set(this.state.excludedTypes);
		}
		await this.eventBus?.emit("eventFilter.loaded", {
			excludedTypes: this.state.excludedTypes,
		});
	}

	/**
	 * Checks if an event type is excluded from the Event Log.
	 */
	isExcluded(eventType: string): boolean {
		return this.excluded.has(eventType);
	}

	/**
	 * Returns the current list of excluded event types.
	 */
	getExcludedTypes(): string[] {
		return [...this.excluded];
	}

	/**
	 * Toggles a single event type's exclusion.
	 */
	private async handleToggle(eventType: string): Promise<void> {
		if (this.excluded.has(eventType)) {
			this.excluded.delete(eventType);
		} else {
			this.excluded.add(eventType);
		}
		await this.syncAndEmit();
	}

	/**
	 * Toggles all event types in a category.
	 * If all are excluded → include all. Otherwise → exclude all.
	 */
	private async handleToggleCategory(category: string): Promise<void> {
		const entries = getEventsByCategory(category);
		const types = entries.map((e) => e.type);

		if (types.length === 0) return;

		const allExcluded = types.every((t) => this.excluded.has(t));

		if (allExcluded) {
			for (const t of types) this.excluded.delete(t);
		} else {
			for (const t of types) this.excluded.add(t);
		}

		await this.syncAndEmit();
	}

	/**
	 * Syncs the Set back to state, persists, and emits change event.
	 */
	private async syncAndEmit(): Promise<void> {
		this.state.excludedTypes = [...this.excluded];
		await this.saveState();
		await this.eventBus?.emit("eventFilter.changed", {
			excludedTypes: this.state.excludedTypes,
		});
	}

	/**
	 * Persists the filter state to storage.
	 */
	private async saveState(): Promise<void> {
		await saveStateToStorage(this.storage, "eventFilter", this.state);
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
