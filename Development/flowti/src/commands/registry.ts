/**
 * Command registry for Flowti.
 *
 * Central location for defining all plugin commands.
 * Commands are registered with the command registry and
 * automatically bound to Obsidian's command system.
 */

import type { CommandDefinition, ICommandRegistry } from "./types";

/**
 * Creates all command definitions for the application.
 *
 * @returns Array of command definitions
 */
export function createCommandDefinitions(): CommandDefinition[] {
	return [
		// Example commands - uncomment and modify as needed:
		//
		// {
		//   id: "flowti:open-dashboard",
		//   name: "Open Dashboard",
		//   icon: "layout-dashboard",
		//   hotkeys: [{ modifiers: ["Mod", "Shift"], key: "d" }],
		//   handler: async (ctx) => {
		//     ctx.logger.info("Opening dashboard");
		//     // Open dashboard view
		//   },
		// },
		//
		// {
		//   id: "flowti:quick-capture",
		//   name: "Quick Capture",
		//   icon: "plus-circle",
		//   hotkeys: [{ modifiers: ["Mod"], key: "q" }],
		//   handler: async (ctx) => {
		//     ctx.logger.info("Opening quick capture");
		//     // Open quick capture modal
		//   },
		// },
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
