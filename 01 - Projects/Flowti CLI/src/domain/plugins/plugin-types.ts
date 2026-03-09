/**
 * plugin-types.ts — Type definitions for the CLI plugin system.
 *
 * Plugins are JSON manifests that map commands to shell commands.
 * Each plugin lives in .flowti/plugins/<name>/manifest.json at vault level.
 */

import type { CommandHandler } from "../../infrastructure/types.js";

/** Shape of a single command entry inside a plugin manifest. */
export interface PluginCommandDef {
	description: string;
	run: string;
	projectFree?: boolean;
}

/** The JSON manifest format stored in .flowti/plugins/<name>/manifest.json. */
export interface PluginManifest {
	name: string;
	description: string;
	version?: string;
	commands: Record<string, PluginCommandDef>;
}

/** A plugin after discovery, validation, and command wrapping. */
export interface LoadedPlugin {
	manifest: PluginManifest;
	path: string;
	commands: Record<string, CommandHandler>;
	valid: boolean;
	errors: string[];
}

/** Result of validating a raw manifest object. */
export interface PluginValidationResult {
	valid: boolean;
	errors: string[];
	warnings: string[];
}
