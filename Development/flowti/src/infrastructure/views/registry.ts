/**
 * View registry for Flowti.
 *
 * Central location for defining all plugin views.
 * Views are registered with the view registry and
 * automatically bound to Obsidian's view system.
 */

import type { IEventBus } from "../events/types";
import {
	EventCatalogView,
	VIEW_TYPE_EVENT_CATALOG,
} from "../../ui/catalog/EventCatalogView";
import type { IViewRegistry, ViewDefinition } from "./types";
import type { FlowtiSettings } from "../../domain/settings/settings";
import type { DiscoveredEvent } from "../../domain/discovery/types";
import type { OnboardingService } from "../../domain/onboarding/OnboardingService";

/**
 * Provides current state for views opened mid-session.
 * Views call these in `onOpen()` to initialize from live state
 * instead of stale defaults.
 */
export interface ViewStateProvider {
	getSettings: () => FlowtiSettings;
	getExcludedTypes: () => string[];
	getNotifiedTypes: () => string[];
	getDiscoveredEvents: () => DiscoveredEvent[];
	/** Shared reference — survives view close/reopen within a session */
	collapsedCategories: Set<string>;
}

/**
 * Dependencies required by view factories.
 */
export interface ViewDependencies {
	eventBus: IEventBus;
	state: ViewStateProvider;
	getOnboardingService: () => OnboardingService;
}

/**
 * Creates all view definitions for the application.
 *
 * @param deps - Shared dependencies for views that need them
 * @returns Array of view definitions
 */
export function createViewDefinitions(deps: ViewDependencies): ViewDefinition[] {
	return [
		{
			type: VIEW_TYPE_EVENT_CATALOG,
			displayName: "Event Catalog",
			icon: "list",
			factory: (leaf) => new EventCatalogView(leaf, deps.eventBus, deps.state, deps.getOnboardingService()),
		},
	];
}

/**
 * Registers all views with the registry.
 *
 * @param registry - The view registry
 * @param deps - Shared dependencies for views that need them
 */
export function registerViews(registry: IViewRegistry, deps: ViewDependencies): void {
	const views = createViewDefinitions(deps);
	registry.registerMany(views);
}
