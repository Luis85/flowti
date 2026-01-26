/**
 * Base class for views that need service and event bus access.
 *
 * Provides automatic event subscription management with cleanup on close.
 */

import { ItemView, WorkspaceLeaf } from "obsidian";
import type { IEventBus, EventType, EventHandler } from "../events/types";
import type { IServiceContainer } from "../services/types";

/**
 * Abstract base class for service-aware views.
 *
 * Features:
 * - Access to ServiceContainer for service retrieval
 * - Access to EventBus for event subscriptions
 * - Automatic cleanup of event subscriptions on view close
 * - Abstract refresh() method for reactive updates
 */
export abstract class BaseServiceView extends ItemView {
	protected services: IServiceContainer;
	protected eventBus: IEventBus;
	private subscriptions: Array<() => void> = [];

	constructor(
		leaf: WorkspaceLeaf,
		services: IServiceContainer,
		eventBus: IEventBus
	) {
		super(leaf);
		this.services = services;
		this.eventBus = eventBus;
	}

	/**
	 * Subscribe to an event with automatic cleanup.
	 *
	 * @param type - Event type to subscribe to
	 * @param handler - Event handler function
	 */
	protected subscribe<T extends EventType>(
		type: T,
		handler: EventHandler<T>
	): void {
		const unsubscribe = this.eventBus.on(type, handler);
		this.subscriptions.push(unsubscribe);
	}

	/**
	 * Called when the view is closed.
	 * Automatically cleans up all event subscriptions.
	 */
	async onClose(): Promise<void> {
		// Cleanup all event subscriptions
		for (const unsubscribe of this.subscriptions) {
			unsubscribe();
		}
		this.subscriptions = [];
	}

	/**
	 * Refresh the view content.
	 * Implement this method in subclasses to update the view.
	 */
	protected abstract refresh(): Promise<void>;

	/**
	 * Get the main content container for the view.
	 * Returns the second child of containerEl (Obsidian convention).
	 */
	protected getContentContainer(): HTMLElement {
		return this.containerEl.children[1] as HTMLElement;
	}

	/**
	 * Clear the content container.
	 */
	protected clearContent(): void {
		const container = this.getContentContainer();
		container.empty();
	}
}
