/**
 * plugin-commands.ts — Command handlers for plugin management.
 *
 * Provides plugin:list, plugin:validate, and plugin:new commands.
 * Plugins live at .flowti/plugins/<name>/manifest.json (vault level).
 */

import { log } from "../../infrastructure/logger.js";
import { RESET, DIM, GREEN, RED, YELLOW, CYAN } from "../../infrastructure/ui.js";
import { disk } from "../../infrastructure/filesystem.js";
import { shell } from "../../infrastructure/shell.js";
import { input } from "../../infrastructure/input.js";
import { paths } from "../../infrastructure/paths.js";
import { VAULT_ROOT, CLI_PROJECT } from "../../infrastructure/config.js";
import { runMenu } from "../../infrastructure/menu.js";
import type { MenuEntry, MenuResult } from "../../infrastructure/types.js";
import {
	loadPlugins,
	discoverPluginFiles,
	validateManifest,
	scaffoldPlugin,
	PLUGINS_DIR,
} from "./plugin-loader.js";
import type { LoadedPlugin } from "./plugin-types.js";
import { generatePluginReference } from "./plugin-reference.js";

// ── Display helpers ──────────────────────────────────────────────────

function displayPluginList(plugins: LoadedPlugin[]): void {
	if (plugins.length === 0) {
		log(`\n  ${DIM}No plugins found in ${PLUGINS_DIR}/${RESET}\n`);
		return;
	}

	log(`\n  ${CYAN}Installed Plugins${RESET}\n`);

	for (const plugin of plugins) {
		const status = plugin.valid
			? `${GREEN}✓${RESET}`
			: `${RED}✗${RESET}`;
		const version = plugin.manifest.version ? ` ${DIM}v${plugin.manifest.version}${RESET}` : "";

		log(`  ${status} ${plugin.manifest.name}${version}`);
		log(`    ${DIM}${plugin.manifest.description || "(no description)"}${RESET}`);

		if (plugin.valid) {
			const cmdNames = Object.keys(plugin.commands);
			if (cmdNames.length > 0) {
				log(`    ${DIM}Commands:${RESET}`);
				for (const cmd of cmdNames) {
					log(`      ${DIM}•${RESET} ${cmd}`);
				}
			}
		} else {
			for (const err of plugin.errors) {
				log(`    ${RED}${err}${RESET}`);
			}
		}
		log();
	}
}

function displayValidation(vaultRoot: string): void {
	const pluginsDir = paths.join(vaultRoot, PLUGINS_DIR);
	const files = discoverPluginFiles(pluginsDir, disk);

	if (files.length === 0) {
		log(`\n  ${DIM}No plugin manifests found in ${PLUGINS_DIR}/${RESET}\n`);
		return;
	}

	log(`\n  ${CYAN}Plugin Validation${RESET}\n`);

	for (const file of files) {
		const pluginDir = paths.dirname(file);
		const pluginName = paths.basename(pluginDir);
		try {
			const raw = JSON.parse(disk.readFileSync(file, "utf-8")) as unknown;
			const result = validateManifest(raw);

			if (result.valid) {
				log(`  ${GREEN}✓${RESET} ${pluginName}`);
			} else {
				log(`  ${RED}✗${RESET} ${pluginName}`);
			}

			for (const err of result.errors) {
				log(`    ${RED}Error: ${err}${RESET}`);
			}
			for (const warn of result.warnings) {
				log(`    ${YELLOW}Warning: ${warn}${RESET}`);
			}
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : String(err);
			log(`  ${RED}✗${RESET} ${pluginName}`);
			log(`    ${RED}Parse error: ${message}${RESET}`);
		}
	}
	log();
}

// ── Interactive menu ─────────────────────────────────────────────────

export async function pluginsMenu(): Promise<MenuResult> {
	const items: MenuEntry[] = [
		{
			key: "1",
			label: "List Plugins",
			action: () => {
				const plugins = loadPlugins(VAULT_ROOT, disk, shell);
				displayPluginList(plugins);
				return "main" as const;
			},
		},
		{
			key: "2",
			label: "Validate Plugins",
			action: () => {
				displayValidation(VAULT_ROOT);
				return "main" as const;
			},
		},
		{
			key: "3",
			label: "Create Plugin",
			action: async () => {
				const name = await input.ask("Plugin name (lowercase, hyphens)");
				if (!name) {
					log(`\n  ${DIM}Cancelled.${RESET}\n`);
					return "main" as const;
				}
				const desc = await input.ask("Description");
				const result = scaffoldPlugin(VAULT_ROOT, name, desc || "A Flowti plugin", disk);
				if ("error" in result) {
					log(`\n  ${RED}${result.error}${RESET}\n`);
				} else {
					log(`\n  ${GREEN}✓${RESET} Created plugin at ${DIM}${result.path}${RESET}`);
					log(`  ${DIM}Edit manifest.json to add commands.${RESET}\n`);
				}
				return "main" as const;
			},
		},
		{
			key: "4",
			label: "Generate Reference",
			action: () => {
				const plugins = loadPlugins(VAULT_ROOT, disk, shell);
				const doc = generatePluginReference(plugins);
				const outputPath = paths.join(CLI_PROJECT, "docs", "reference", "Plugin Reference.md");
				doc.save(outputPath);
				log(`\n  ${GREEN}✓${RESET} Reference saved to ${DIM}${outputPath}${RESET}\n`);
				return "main" as const;
			},
		},
		{ separator: true },
		{ key: "b", label: "Back", action: () => "quit" as const },
	];

	await runMenu("Plugins", items);
	return "main";
}
