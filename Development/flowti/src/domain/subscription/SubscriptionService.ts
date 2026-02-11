import type { IEventBus } from "../../infrastructure/events/types";
import type { IStorageProvider } from "../../utils/types";
import { matchGlob } from "../../utils/glob";
import type { Subscription, SubscriptionFilter, SubscriptionState } from "./types";

/**
 * Configuration options for the SubscriptionService.
 */
export interface SubscriptionServiceOptions {
	storage: IStorageProvider;
	eventBus?: IEventBus;
}

/**
 * Creates a fresh default subscription state (no subscriptions).
 */
function createDefaultState(): SubscriptionState {
	return { subscriptions: {} };
}

/**
 * Generates a unique subscription ID.
 */
function generateId(): string {
	return `sub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Prefixes to skip in the wildcard listener to avoid infinite loops.
 */
const SKIPPED_PREFIXES = ["log.", "subscription.", "settings."];

/**
 * Service for managing event subscriptions with conditional filters.
 *
 * Subscriptions allow users to declare interest in specific event types
 * with optional path/extension/name filters. When an incoming event
 * matches a subscription's criteria, `subscription.matched` is emitted.
 *
 * Uses a wildcard listener to observe all events. Filter matching uses
 * AND logic: all specified filter fields must match.
 */
export class SubscriptionService {
	private state: SubscriptionState = createDefaultState();
	private storage: IStorageProvider;
	private eventBus?: IEventBus;
	private unsubscribes: (() => void)[] = [];

	// Master toggle (responds to settings.changed / settings.loaded)
	private enabled = true;

	constructor(options: SubscriptionServiceOptions) {
		this.storage = options.storage;
		this.eventBus = options.eventBus;

		if (this.eventBus) {
			// Listen for settings changes to update the enabled flag
			this.unsubscribes.push(
				this.eventBus.on("settings.changed", (event) => {
					const settings = event.payload.settings as { eventSystemEnabled?: boolean };
					if (typeof settings.eventSystemEnabled === "boolean") {
						this.enabled = settings.eventSystemEnabled;
					}
				})
			);
			this.unsubscribes.push(
				this.eventBus.on("settings.loaded", (event) => {
					const settings = event.payload.settings as { eventSystemEnabled?: boolean };
					if (typeof settings.eventSystemEnabled === "boolean") {
						this.enabled = settings.eventSystemEnabled;
					}
				})
			);

			// Command: create a subscription
			this.unsubscribes.push(
				this.eventBus.on("subscription.create", (event) =>
					this.handleCreate(event.payload)
				)
			);

			// Command: update a subscription
			this.unsubscribes.push(
				this.eventBus.on("subscription.update", (event) =>
					this.handleUpdate(event.payload)
				)
			);

			// Command: remove a subscription
			this.unsubscribes.push(
				this.eventBus.on("subscription.remove", (event) =>
					this.handleRemove(event.payload.subscriptionId)
				)
			);

			// Command: refresh — re-emit current state
			this.unsubscribes.push(
				this.eventBus.on("subscription.refresh", () => {
					void this.eventBus?.emit("subscription.loaded", {
						subscriptions: this.getSubscriptions(),
					});
				})
			);

			// Wildcard listener to match events against subscriptions
			this.unsubscribes.push(
				this.eventBus.on("*", (event) => {
					if (!this.enabled) return;
					const type = event.type;
					if (SKIPPED_PREFIXES.some((p) => type.startsWith(p))) return;
					this.matchSubscriptions(type, event.payload as Record<string, unknown>);
				})
			);
		}
	}

	/**
	 * Loads subscription state from storage.
	 * Emits "subscription.loaded" with all subscriptions.
	 */
	async load(): Promise<void> {
		const data = (await this.storage.load()) as {
			subscription?: SubscriptionState;
		} | null;
		if (data?.subscription) {
			this.state = data.subscription;
		}
		await this.eventBus?.emit("subscription.loaded", {
			subscriptions: this.getSubscriptions(),
		});
	}

	/**
	 * Returns all subscriptions as an array.
	 */
	getSubscriptions(): Subscription[] {
		return Object.values(this.state.subscriptions);
	}

	/**
	 * Returns a subscription by ID, or undefined.
	 */
	getSubscription(id: string): Subscription | undefined {
		return this.state.subscriptions[id];
	}

	/**
	 * Creates a new subscription.
	 */
	private async handleCreate(payload: {
		eventType: string;
		label?: string;
		filters: SubscriptionFilter;
	}): Promise<void> {
		const sub: Subscription = {
			id: generateId(),
			eventType: payload.eventType,
			label: payload.label,
			filters: payload.filters,
			enabled: true,
			createdAt: new Date().toISOString(),
		};
		this.state.subscriptions[sub.id] = sub;
		await this.saveState();
		await this.eventBus?.emit("subscription.created", { subscription: sub });
	}

	/**
	 * Updates an existing subscription.
	 */
	private async handleUpdate(payload: {
		subscriptionId: string;
		label?: string;
		filters?: SubscriptionFilter;
		enabled?: boolean;
	}): Promise<void> {
		const existing = this.state.subscriptions[payload.subscriptionId];
		if (!existing) return;

		if (payload.label !== undefined) existing.label = payload.label;
		if (payload.filters !== undefined) existing.filters = payload.filters;
		if (payload.enabled !== undefined) existing.enabled = payload.enabled;

		await this.saveState();
		await this.eventBus?.emit("subscription.updated", { subscription: existing });
	}

	/**
	 * Removes a subscription.
	 */
	private async handleRemove(subscriptionId: string): Promise<void> {
		if (!this.state.subscriptions[subscriptionId]) return;
		delete this.state.subscriptions[subscriptionId];
		await this.saveState();
		await this.eventBus?.emit("subscription.deleted", { subscriptionId });
	}

	/**
	 * Checks all enabled subscriptions for a match against the given event.
	 */
	private matchSubscriptions(
		eventType: string,
		payload: Record<string, unknown>
	): void {
		for (const sub of Object.values(this.state.subscriptions)) {
			if (!sub.enabled) continue;
			if (sub.eventType !== eventType) continue;
			if (!this.matchesFilters(sub.filters, payload)) continue;

			void this.eventBus?.emit("subscription.matched", {
				eventType,
				subscriptionId: sub.id,
				subscriptionLabel: sub.label,
				timestamp: new Date().toISOString(),
			});
		}
	}

	/**
	 * Evaluates filter criteria against a payload.
	 * All specified filters must match (AND logic).
	 * If no filters are specified, the match succeeds.
	 */
	private matchesFilters(
		filters: SubscriptionFilter,
		payload: Record<string, unknown>
	): boolean {
		const path = typeof payload.path === "string" ? payload.path : undefined;

		// pathPattern: glob against the full file path
		if (filters.pathPattern) {
			if (!path) return false;
			if (!matchGlob(filters.pathPattern, path)) return false;
		}

		// extension: match the file extension
		if (filters.extension) {
			if (!path) return false;
			const ext = path.split(".").pop() ?? "";
			if (ext !== filters.extension) return false;
		}

		// namePattern: glob against the filename (basename)
		if (filters.namePattern) {
			if (!path) return false;
			const basename = path.split("/").pop() ?? "";
			if (!matchGlob(filters.namePattern, basename)) return false;
		}

		return true;
	}

	/**
	 * Persists subscription state to storage.
	 */
	private async saveState(): Promise<void> {
		const existingData = ((await this.storage.load()) as object) || {};
		await this.storage.save({
			...existingData,
			subscription: this.state,
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
