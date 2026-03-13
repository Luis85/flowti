/**
 * plugins-menu.ts — Interactive plugin management menu.
 *
 * Moved from domain/plugins/plugin-commands.ts to separate display
 * concerns from pure domain logic.
 */

import { log } from "../../infrastructure/logger.js";
import { RESET, DIM, GREEN, RED } from "../../infrastructure/ui.js";
import { disk } from "../../infrastructure/filesystem.js";
import { shell } from "../../infrastructure/shell.js";
import { input } from "../../infrastructure/input.js";
import { paths } from "../../infrastructure/paths.js";
import { clock } from "../../infrastructure/clock.js";
import { VAULT_ROOT, CLI_PROJECT } from "../../infrastructure/config.js";
import { runMenu } from "../../infrastructure/menu.js";
import type { MenuEntry, MenuResult } from "../../infrastructure/types.js";
import { loadPlugins, scaffoldPlugin } from "../../domain/plugins/plugin-loader.js";
import { generatePluginReference } from "../../domain/plugins/plugin-reference.js";

function pluginDeps() { return { disk, paths } as const; }
function clockDeps() { return { clock } as const; }
import { renderPluginList, renderPluginValidation } from "../plugins-display.js";
import { toPluginListItems, toPluginValidationItems } from "../../domain/plugins/plugin-commands.js";

export async function pluginsMenu(): Promise<MenuResult> {
	const items: MenuEntry[] = [
		{
			key: "1",
			label: "List Plugins",
			action: () => {
				const plugins = loadPlugins(pluginDeps(), VAULT_ROOT, disk, shell);
				const items = toPluginListItems(plugins);
				renderPluginList(items);
				return "main" as const;
			},
		},
		{
			key: "2",
			label: "Validate Plugins",
			action: () => {
				const items = toPluginValidationItems(pluginDeps(), VAULT_ROOT);
				renderPluginValidation(items);
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
				const result = scaffoldPlugin(pluginDeps(), VAULT_ROOT, name, desc || "A Flowti plugin", disk);
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
				const plugins = loadPlugins(pluginDeps(), VAULT_ROOT, disk, shell);
				const doc = generatePluginReference(clockDeps(), plugins);
				const outputPath = paths.join(CLI_PROJECT, "docs", "reference", "Plugin Reference.md");
				doc.save(outputPath, disk);
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
