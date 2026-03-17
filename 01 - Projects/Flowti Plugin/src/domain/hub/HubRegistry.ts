/**
 * Central registry for hub dashboard providers.
 *
 * Manages provider registration and provides cross-hub navigation
 * via the EventBus (hub.navigate event).
 */

import type { IEventBus } from "../../infrastructure/events/types";
import type { HubDashboardProvider, IViewNavigator } from "./types";

export class HubRegistry {
	private providers = new Map<string, HubDashboardProvider>();

	constructor(
		private navigator: IViewNavigator,
		private eventBus: IEventBus,
	) {}

	/** Register a hub dashboard provider. */
	register(provider: HubDashboardProvider): void {
		this.providers.set(provider.getHubId(), provider);
	}

	/** Unregister a hub dashboard provider. */
	unregister(hubId: string): void {
		this.providers.delete(hubId);
	}

	/** Get all registered providers. */
	getAll(): HubDashboardProvider[] {
		return Array.from(this.providers.values());
	}

	/** Get a provider by hub ID. */
	get(hubId: string): HubDashboardProvider | undefined {
		return this.providers.get(hubId);
	}

	/** Clear all registered providers. */
	clear(): void {
		this.providers.clear();
	}

	/**
	 * Open a hub and optionally navigate to a specific tab/entity.
	 *
	 * Reveals or creates the Obsidian leaf via the navigator, then
	 * emits `hub.navigate` so that the hub view can navigate to the
	 * right tab.
	 */
	async openHub(hubId: string, tabId?: string, entityId?: string): Promise<void> {
		const provider = this.providers.get(hubId);
		if (!provider) return;

		try {
			await this.navigator.openView(provider.getViewType());
		} catch (err) {
			console.error(`[Flowti] Failed to open hub "${hubId}":`, err);
			return;
		}

		// Emit navigate event for the hub view to handle
		if (tabId) {
			void this.eventBus.emit("hub.navigate", { hubId, tabId, entityId });
		}
	}
}
