/**
 * Command registry for Flowti.
 *
 * Central location for defining all plugin commands.
 * Commands are registered with the command registry and
 * automatically bound to Obsidian's command system.
 *
 * Each command handler emits a `ui.*` event on the EventBus.
 * The {@link UiCommandService} listens and performs the actual
 * view/modal opening.
 */

import type { ICommandRegistry } from "./types";
import { createCommandDefinitions, getExternalCommandMeta } from "./command-definitions";

// Re-export for consumers that import from registry.ts
export { createCommandDefinitions, getExternalCommandMeta } from "./command-definitions";

/**
 * Registers all commands with the registry.
 *
 * @param registry - The command registry
 */
export function registerCommands(registry: ICommandRegistry): void {
	const commands = createCommandDefinitions();
	registry.registerMany(commands);

	// Register metadata for commands defined outside the registry
	for (const meta of getExternalCommandMeta()) {
		registry.registerMeta(meta);
	}
}
