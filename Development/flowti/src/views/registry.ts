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
} from "./ComponentShowcaseView";
import {
	LifecycleView,
	VIEW_TYPE_LIFECYCLE,
} from "./LifecycleView";
import {
	SolutionDetailView,
	VIEW_TYPE_SOLUTION_DETAIL,
} from "./SolutionDetailView";
import {
	SolutionExplorerView,
	VIEW_TYPE_SOLUTION_EXPLORER,
} from "./SolutionExplorerView";
import {
	TraceabilityMatrixView,
	VIEW_TYPE_TRACEABILITY_MATRIX,
} from "./TraceabilityMatrixView";
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
		{
			type: VIEW_TYPE_SOLUTION_EXPLORER,
			displayName: "Solutions",
			icon: "folder-tree",
			enhancedFactory: (leaf, services, eventBus) =>
				new SolutionExplorerView(leaf, services, eventBus),
		},
		{
			type: VIEW_TYPE_SOLUTION_DETAIL,
			displayName: "Solution Detail",
			icon: "layout-dashboard",
			enhancedFactory: (leaf, services, eventBus) =>
				new SolutionDetailView(leaf, services, eventBus),
		},
		{
			type: VIEW_TYPE_LIFECYCLE,
			displayName: "Lifecycle View",
			icon: "git-branch",
			enhancedFactory: (leaf, services, eventBus) =>
				new LifecycleView(leaf, services, eventBus),
		},
		{
			type: VIEW_TYPE_TRACEABILITY_MATRIX,
			displayName: "Traceability Matrix",
			icon: "table-2",
			enhancedFactory: (leaf, services, eventBus) =>
				new TraceabilityMatrixView(leaf, services, eventBus),
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
