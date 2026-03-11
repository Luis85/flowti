/**
 * plugins.controller.ts — Controller for plugin management commands.
 *
 * Returns typed data models; rendering is handled by ui/plugins-display.ts.
 * Interactive pluginsMenu stays in domain/plugins/plugin-commands.ts
 * as it's a menu action, not a non-interactive command.
 */

import type { ControllerAction } from "../infrastructure/request-response.js";
import { adapt, dataResponse } from "../infrastructure/request-response.js";
import type { CommandHandler } from "../infrastructure/types.js";
import { disk } from "../infrastructure/filesystem.js";
import { input } from "../infrastructure/input.js";
import { shell } from "../infrastructure/shell.js";
import { paths } from "../infrastructure/paths.js";
import { clock } from "../infrastructure/clock.js";
import { VAULT_ROOT, CLI_PROJECT } from "../infrastructure/config.js";
import {
	loadPlugins,
	discoverPluginFiles,
	validateManifest,
	scaffoldPlugin,
	PLUGINS_DIR,
} from "../domain/plugins/plugin-loader.js";
import { generatePluginReference } from "../domain/plugins/plugin-reference.js";

function pluginDeps() { return { disk, paths } as const; }
function clockDeps() { return { clock } as const; }
import {
	renderPluginList,
	renderPluginValidation,
	renderPluginCreated,
	type PluginListItem,
	type PluginValidationItem,
	type PluginCreatedModel,
} from "../ui/plugins-display.js";
import { renderSuccess, renderError, type SuccessModel, type ErrorModel } from "../ui/common-renderers.js";

// ── Controller actions ──────────────────────────────────────────────

const actions: Record<string, ControllerAction> = {
	"plugin:list": () => {
		const plugins = loadPlugins(pluginDeps(), VAULT_ROOT, disk, shell);
		const model: PluginListItem[] = plugins.map((p) => ({
			name: p.manifest.name,
			version: p.manifest.version ?? null,
			description: p.manifest.description,
			commands: Object.keys(p.commands),
			valid: p.valid,
			errors: p.errors,
		}));
		return dataResponse(model, renderPluginList);
	},

	"plugin:validate": () => {
		const pluginsDir = paths.join(VAULT_ROOT, PLUGINS_DIR);
		const files = discoverPluginFiles(pluginDeps(), pluginsDir, disk);
		const results: PluginValidationItem[] = files.map((file) => {
			const pluginDir = paths.dirname(file);
			const pluginName = paths.basename(pluginDir);
			try {
				const raw = JSON.parse(disk.readFileSync(file, "utf-8")) as unknown;
				const result = validateManifest(raw);
				return { name: pluginName, ...result };
			} catch (err: unknown) {
				return { name: pluginName, valid: false, errors: [`Parse error: ${err instanceof Error ? err.message : String(err)}`], warnings: [] };
			}
		});
		return dataResponse(results, renderPluginValidation);
	},

	"plugin:reference": () => {
		const plugins = loadPlugins(pluginDeps(), VAULT_ROOT, disk, shell);
		const doc = generatePluginReference(clockDeps(), plugins);
		const outputPath = paths.join(CLI_PROJECT, "docs", "reference", "Plugin Reference.md");
		doc.save(outputPath);
		return dataResponse<SuccessModel>({ message: `Reference saved to ${outputPath}` }, renderSuccess);
	},

	"plugin:new": async () => {
		const name = await input.ask("Plugin name (lowercase, hyphens)");
		if (!name) return dataResponse<SuccessModel>({ message: "Cancelled." }, renderSuccess);
		const desc = await input.ask("Description");
		const result = scaffoldPlugin(pluginDeps(), VAULT_ROOT, name, desc || "A Flowti plugin", disk);
		if ("error" in result) {
			return dataResponse<ErrorModel>({ error: result.error }, renderError);
		}
		return dataResponse<PluginCreatedModel>({ path: result.path }, renderPluginCreated);
	},
};

// ── Adapted commands ────────────────────────────────────────────────

export const commands: Record<string, CommandHandler> = Object.fromEntries(
	Object.entries(actions).map(([key, action]) => [key, adapt(action)]),
);
