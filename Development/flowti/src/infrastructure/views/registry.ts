/**
 * View registry for Flowti.
 *
 * Central location for defining all plugin views.
 * Views are registered with the view registry and
 * automatically bound to Obsidian's view system.
 */

import {
	ComponentShowcaseView,
	VIEW_TYPE_COMPONENT_SHOWCASE,
} from "../../ui/ComponentShowcaseView";
import type { IViewRegistry, ViewDefinition } from "./types";

/**
 * Creates all view definitions for the application.
 *
 * @returns Array of view definitions
 */
export function createViewDefinitions(): ViewDefinition[] {
	return [
		{
			type: VIEW_TYPE_COMPONENT_SHOWCASE,
			displayName: "Flowti Components",
			icon: "palette",
			factory: (leaf) => new ComponentShowcaseView(leaf),
		},
	];
}

/**
 * Registers all views with the registry.
 *
 * @param registry - The view registry
 */
export function registerViews(registry: IViewRegistry): void {
	const views = createViewDefinitions();
	registry.registerMany(views);
}
