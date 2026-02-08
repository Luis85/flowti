/**
 * Command registry for Flowti.
 *
 * Central location for defining all plugin commands.
 * Commands are registered with the command registry and
 * automatically bound to Obsidian's command system.
 */

import { VIEW_TYPE_COMPONENT_SHOWCASE } from "../views/ComponentShowcaseView";
import type { CommandDefinition, ICommandRegistry } from "./types";

/**
 * Creates all command definitions for the application.
 *
 * @returns Array of command definitions
 */
export function createCommandDefinitions(): CommandDefinition[] {
	return [
		{
			id: "flowti:open-component-showcase",
			name: "Open Component Showcase",
			icon: "palette",
			handler: async (ctx) => {
				ctx.logger.debug("Opening component showcase view");
				const { workspace } = ctx.app;

				// Check if view is already open
				const existing = workspace.getLeavesOfType(VIEW_TYPE_COMPONENT_SHOWCASE);
				if (existing.length > 0) {
					workspace.revealLeaf(existing[0]);
					return;
				}

				// Open in right sidebar
				const leaf = workspace.getRightLeaf(false);
				if (leaf) {
					await leaf.setViewState({
						type: VIEW_TYPE_COMPONENT_SHOWCASE,
						active: true,
					});
					workspace.revealLeaf(leaf);
				}
			},
		},
	];
}

/**
 * Registers all commands with the registry.
 *
 * @param registry - The command registry
 */
export function registerCommands(registry: ICommandRegistry): void {
	const commands = createCommandDefinitions();
	registry.registerMany(commands);
}
