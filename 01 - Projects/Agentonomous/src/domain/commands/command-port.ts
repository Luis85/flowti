import type { CommandEntry } from './command-types.js';

/**
 * Register commands (and optional ribbon icons) with the host platform.
 *
 * `register` does NOT return an unsubscribe handle: Obsidian has no command
 * deregistration API.  Commands live until the plugin unloads.  Ribbon
 * elements created via `register` are torn down together in `unregisterAll`.
 */
export interface CommandPort {
	register(entry: CommandEntry): void;
	unregisterAll(): void;
}
