/**
 * ViewRegistry for Flowti.
 *
 * Central registry for managing custom ItemViews.
 * Provides a clean API for registering views that can be
 * bound to Obsidian's plugin.registerView() method.
 */

import type { IEventBus } from "../events/types";
import type { ILogger } from "../logger/types";
import type {
	IViewRegistry,
	ViewDefinition,
	ViewRegistryOptions,
} from "./types";

/**
 * Registry for managing custom views.
 */
export class ViewRegistry implements IViewRegistry {
	private views: Map<string, ViewDefinition> = new Map();
	private logger?: ILogger;
	private eventBus?: IEventBus;

	constructor(options: ViewRegistryOptions = {}) {
		this.logger = options.logger;
		this.eventBus = options.eventBus;
	}

	/**
	 * Registers a view definition.
	 */
	register(view: ViewDefinition): void {
		if (this.views.has(view.type)) {
			this.logger?.warn(`View already registered: ${view.type}`);
			return;
		}

		this.views.set(view.type, view);
		this.logger?.debug(`View registered: ${view.type}`);

		void this.eventBus?.emit("view.registered", {
			type: view.type,
			displayName: view.displayName,
		});
	}

	/**
	 * Registers multiple view definitions.
	 */
	registerMany(views: ViewDefinition[]): void {
		for (const view of views) {
			this.register(view);
		}
	}

	/**
	 * Gets all registered view definitions.
	 */
	getViews(): ViewDefinition[] {
		return Array.from(this.views.values());
	}

	/**
	 * Gets a view definition by type.
	 */
	getView(type: string): ViewDefinition | undefined {
		return this.views.get(type);
	}

	/**
	 * Clears all registered views.
	 */
	clear(): void {
		this.views.clear();
		this.logger?.debug("View registry cleared");
	}
}
