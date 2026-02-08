/**
 * View system types and interfaces for Flowti.
 *
 * Provides a type-safe view registry pattern for registering
 * custom ItemViews with Obsidian's workspace.
 */

import type { ItemView, WorkspaceLeaf } from "obsidian";
import type { IEventBus } from "../events/types";
import type { ILogger } from "../logger/types";

/**
 * Factory function for creating view instances.
 */
export type ViewFactory = (leaf: WorkspaceLeaf) => ItemView;

/**
 * View definition with metadata.
 */
export interface ViewDefinition {
	/** Unique view type identifier (e.g., "flowti-component-showcase") */
	type: string;
	/** Display name shown in UI */
	displayName: string;
	/** Icon ID for the view */
	icon?: string;
	/** Factory function to create the view */
	factory: ViewFactory;
}

/**
 * Interface for the view registry.
 */
export interface IViewRegistry {
	/**
	 * Registers a view.
	 */
	register(view: ViewDefinition): void;

	/**
	 * Registers multiple views.
	 */
	registerMany(views: ViewDefinition[]): void;

	/**
	 * Gets all registered views.
	 */
	getViews(): ViewDefinition[];

	/**
	 * Gets a view by type.
	 */
	getView(type: string): ViewDefinition | undefined;

	/**
	 * Clears all registered views.
	 */
	clear(): void;
}

/**
 * Configuration options for the ViewRegistry.
 */
export interface ViewRegistryOptions {
	/** Logger for view registration logging */
	logger?: ILogger;
	/** Event bus for emitting view events */
	eventBus?: IEventBus;
}
