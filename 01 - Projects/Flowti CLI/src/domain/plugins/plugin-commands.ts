/**
 * plugin-commands.ts — Pure domain logic for plugin management.
 *
 * Data-mapping functions for transforming loaded plugins into display models.
 * Interactive menu lives in ui/menus/plugins-menu.ts.
 */

import type { CliDeps } from "../../infrastructure/deps.js";
import {
	discoverPluginFiles,
	validateManifest,
	PLUGINS_DIR,
} from "./plugin-loader.js";
import type { LoadedPlugin } from "./plugin-types.js";

// ── Data mapping (domain → display model) ────────────────────────────

export interface PluginListItem {
	name: string;
	version: string | null;
	description: string;
	commands: string[];
	valid: boolean;
	errors: string[];
}

export interface PluginValidationItem {
	name: string;
	valid: boolean;
	errors: string[];
	warnings: string[];
}

export function toPluginListItems(plugins: LoadedPlugin[]): PluginListItem[] {
	return plugins.map((plugin) => ({
		name: plugin.manifest.name,
		version: plugin.manifest.version ?? null,
		description: plugin.manifest.description || "",
		commands: Object.keys(plugin.commands),
		valid: plugin.valid,
		errors: [...plugin.errors],
	}));
}

export function toPluginValidationItems(
	deps: Pick<CliDeps, "disk" | "paths">,
	vaultRoot: string,
): PluginValidationItem[] {
	const pluginsDir = deps.paths.join(vaultRoot, PLUGINS_DIR);
	const files = discoverPluginFiles(deps, pluginsDir, deps.disk);
	return files.map((file) => {
		const pluginDir = deps.paths.dirname(file);
		const pluginName = deps.paths.basename(pluginDir);
		try {
			const raw = JSON.parse(deps.disk.readFileSync(file, "utf-8")) as unknown;
			const result = validateManifest(raw);
			return {
				name: pluginName,
				valid: result.valid,
				errors: [...result.errors],
				warnings: [...result.warnings],
			};
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : String(err);
			return {
				name: pluginName,
				valid: false,
				errors: [`Parse error: ${message}`],
				warnings: [],
			};
		}
	});
}
