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
import { VAULT_ROOT, CLI_PROJECT } from "../infrastructure/config.js";
import {
	loadPlugins,
	discoverPluginFiles,
	validateManifest,
	scaffoldPlugin,
	PLUGINS_DIR,
} from "../domain/plugins/plugin-loader.js";
import { generatePluginReference } from "../domain/plugins/plugin-reference.js";

import {
	renderPluginList,
	renderPluginValidation,
	renderPluginCreated,
	type PluginListItem,
	type PluginValidationItem,
	type PluginCreatedModel,
} from "../ui/displays/plugins-display.js";
import { renderSuccess, renderError, type SuccessModel, type ErrorModel } from "../ui/renderers/common-renderers.js";

// ── Controller actions ──────────────────────────────────────────────

const actions: Record<string, ControllerAction> = {
	"plugin:list": (req) => {
		const { disk, paths, shell } = req.deps;
		const pluginDeps = { disk, paths } as const;
		const plugins = loadPlugins(pluginDeps, VAULT_ROOT, disk, shell);
		const model: PluginListItem[] = plugins.map((p) => ({
			name: p.manifest.name,
			version: p.manifest.version ?? null,
			description: p.manifest.description,
			commands: Object.keys(p.commands),
			valid: p.valid,
			errors: p.errors,
		}));
		return dataResponse(model, (d) => renderPluginList(d, req.deps.log));
	},

	"plugin:validate": (req) => {
		const { disk, paths } = req.deps;
		const pluginDeps = { disk, paths } as const;
		const pluginsDir = paths.join(VAULT_ROOT, PLUGINS_DIR);
		const files = discoverPluginFiles(pluginDeps, pluginsDir, disk);
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
		return dataResponse(results, (d) => renderPluginValidation(d, req.deps.log));
	},

	"plugin:reference": (req) => {
		const { disk, paths, shell, clock } = req.deps;
		const pluginDeps = { disk, paths } as const;
		const plugins = loadPlugins(pluginDeps, VAULT_ROOT, disk, shell);
		const doc = generatePluginReference({ clock } as const, plugins);
		const outputPath = paths.join(CLI_PROJECT, "docs", "reference", "Plugin Reference.md");
		doc.save(outputPath, disk);
		return dataResponse<SuccessModel>({ message: `Reference saved to ${outputPath}` }, (d) => renderSuccess(req.deps.log, d));
	},

	"plugin:new": async (req) => {
		const { disk, paths, input, log } = req.deps;
		const pluginDeps = { disk, paths } as const;
		const name = await input.ask("Plugin name (lowercase, hyphens)");
		if (!name) return dataResponse<SuccessModel>({ message: "Cancelled." }, (d) => renderSuccess(log, d));
		const desc = await input.ask("Description");
		const result = scaffoldPlugin(pluginDeps, VAULT_ROOT, name, desc || "A Flowti plugin", disk);
		if ("error" in result) {
			return dataResponse<ErrorModel>({ error: result.error }, (d) => renderError(log, d));
		}
		return dataResponse<PluginCreatedModel>({ path: result.path }, (d) => renderPluginCreated(d, log));
	},
};

// ── Adapted commands ────────────────────────────────────────────────

export const commands: Record<string, CommandHandler> = Object.fromEntries(
	Object.entries(actions).map(([key, action]) => [key, adapt(action)]),
);
