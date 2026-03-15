/**
 * plugins.controller.ts — Controller for plugin management commands.
 *
 * Returns typed data models; rendering is handled by ui/plugins-display.ts.
 * Interactive pluginsMenu stays in domain/plugins/plugin-commands.ts
 * as it's a menu action, not a non-interactive command.
 */

import { adaptDescriptor } from "../infrastructure/command-engine.js";
import type { CommandHandler } from "../infrastructure/types.js";
import type { LogFn } from "../infrastructure/command-engine.js";
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

type PluginNewModel = PluginCreatedModel | SuccessModel | ErrorModel;

function isErrorModel(m: unknown): m is ErrorModel {
	return typeof m === "object" && m !== null && "error" in m;
}

function isSuccess(m: unknown): m is SuccessModel {
	return typeof m === "object" && m !== null && "message" in m;
}

function renderPluginNew(data: PluginNewModel, log: LogFn): void {
	if (isErrorModel(data)) { renderError(data, log); return; }
	if (isSuccess(data)) { renderSuccess(data as SuccessModel, log); return; }
	renderPluginCreated(data as PluginCreatedModel, log);
}

export const commands: Record<string, CommandHandler> = {
	"plugin:list": adaptDescriptor<Record<string, unknown>, PluginListItem[]>({
		handler: (ctx) => {
			const { disk, paths, shell } = ctx.deps;
			const pluginDeps = { disk, paths } as const;
			const plugins = loadPlugins(pluginDeps, VAULT_ROOT, disk, shell);
			return plugins.map((p) => ({
				name: p.manifest.name,
				version: p.manifest.version ?? null,
				description: p.manifest.description,
				commands: Object.keys(p.commands),
				valid: p.valid,
				errors: p.errors,
			}));
		},
		renderer: renderPluginList,
	}),

	"plugin:validate": adaptDescriptor<Record<string, unknown>, PluginValidationItem[]>({
		handler: (ctx) => {
			const { disk, paths } = ctx.deps;
			const pluginDeps = { disk, paths } as const;
			const pluginsDir = paths.join(VAULT_ROOT, PLUGINS_DIR);
			const files = discoverPluginFiles(pluginDeps, pluginsDir, disk);
			return files.map((file) => {
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
		},
		renderer: renderPluginValidation,
	}),

	"plugin:reference": adaptDescriptor<Record<string, unknown>, SuccessModel>({
		handler: (ctx) => {
			const { disk, paths, shell, clock } = ctx.deps;
			const pluginDeps = { disk, paths } as const;
			const plugins = loadPlugins(pluginDeps, VAULT_ROOT, disk, shell);
			const doc = generatePluginReference({ clock } as const, plugins);
			const outputPath = paths.join(CLI_PROJECT, "docs", "reference", "Plugin Reference.md");
			doc.save(outputPath, disk);
			return { message: `Reference saved to ${outputPath}` };
		},
		renderer: renderSuccess,
	}),

	"plugin:new": adaptDescriptor<Record<string, unknown>, PluginNewModel>({
		handler: async (ctx) => {
			const { disk, paths, input } = ctx.deps;
			const pluginDeps = { disk, paths } as const;
			const name = await input.ask("Plugin name (lowercase, hyphens)");
			if (!name) return { message: "Cancelled." } as SuccessModel;
			const desc = await input.ask("Description");
			const result = scaffoldPlugin(pluginDeps, VAULT_ROOT, name, desc || "A Flowti plugin", disk);
			if ("error" in result) {
				return { error: result.error } as ErrorModel;
			}
			return { path: result.path } as PluginCreatedModel;
		},
		renderer: renderPluginNew,
	}),
};
