/**
 * extensibility-handlers.ts — Action handlers for plugins and AI tools menus.
 */

import type { HandlerRegistry } from "../../infrastructure/handler-registry.js";
import type { MenuResult } from "../../infrastructure/types.js";
import { disk } from "../../infrastructure/filesystem.js";
import { shell } from "../../infrastructure/shell.js";
import { paths } from "../../infrastructure/paths.js";
import { clock } from "../../infrastructure/clock.js";
import { input } from "../../infrastructure/input.js";
import { log } from "../../infrastructure/logger.js";
import { RESET, DIM, GREEN, RED } from "../../infrastructure/ui.js";
import { VAULT_ROOT, CLI_PROJECT } from "../../infrastructure/config.js";
import { loadPlugins, scaffoldPlugin } from "../../domain/plugins/plugin-loader.js";
import { generatePluginReference } from "../../domain/plugins/plugin-reference.js";
import { toPluginListItems, toPluginValidationItems } from "../../domain/plugins/plugin-commands.js";
import { renderPluginList, renderPluginValidation } from "../displays/plugins-display.js";
import { loadAiTools, scaffoldAiTool } from "../../domain/ai-tools/ai-tool-loader.js";
import { generateAiToolReference } from "../../domain/ai-tools/ai-tool-reference.js";
import { toToolListItems, toToolValidationItems } from "../../domain/ai-tools/ai-tool-commands.js";
import { renderToolList, renderToolValidation } from "../displays/ai-tools-display.js";

function pluginDeps() { return { disk, paths } as const; }

export function registerExtensibilityHandlers(registry: HandlerRegistry): void {
	// ── Plugin handlers ─────────────────────────────────────────────

	registry.registerAction("plugins:list", async () => {
		const plugins = loadPlugins(pluginDeps(), VAULT_ROOT, disk, shell);
		renderPluginList(toPluginListItems(plugins));
		await input.waitForEnter();
		return "main" as MenuResult;
	});

	registry.registerAction("plugins:validate", async () => {
		renderPluginValidation(toPluginValidationItems(pluginDeps(), VAULT_ROOT));
		await input.waitForEnter();
		return "main" as MenuResult;
	});

	registry.registerAction("plugins:create", async () => {
		const name = await input.ask("Plugin name (lowercase, hyphens)");
		if (!name) { log(`\n  ${DIM}Cancelled.${RESET}\n`); return "main" as MenuResult; }
		const desc = await input.ask("Description");
		const result = scaffoldPlugin(pluginDeps(), VAULT_ROOT, name, desc || "A Flowti plugin", disk);
		if ("error" in result) {
			log(`\n  ${RED}${result.error}${RESET}\n`);
		} else {
			log(`\n  ${GREEN}✓${RESET} Created plugin at ${DIM}${result.path}${RESET}`);
			log(`  ${DIM}Edit manifest.json to add commands.${RESET}\n`);
		}
		await input.waitForEnter();
		return "main" as MenuResult;
	});

	registry.registerAction("plugins:reference", async () => {
		const plugins = loadPlugins(pluginDeps(), VAULT_ROOT, disk, shell);
		const doc = generatePluginReference({ clock }, plugins);
		const outputPath = paths.join(CLI_PROJECT, "docs", "reference", "Plugin Reference.md");
		doc.save(outputPath, disk);
		log(`\n  ${GREEN}✓${RESET} Reference saved to ${DIM}${outputPath}${RESET}\n`);
		await input.waitForEnter();
		return "main" as MenuResult;
	});

	// ── AI Tools handlers ───────────────────────────────────────────

	registry.registerAction("ai-tools:list", async () => {
		const tools = loadAiTools(pluginDeps(), VAULT_ROOT, disk);
		renderToolList(toToolListItems(tools));
		await input.waitForEnter();
		return "main" as MenuResult;
	});

	registry.registerAction("ai-tools:validate", async () => {
		renderToolValidation(toToolValidationItems(pluginDeps(), VAULT_ROOT));
		await input.waitForEnter();
		return "main" as MenuResult;
	});

	registry.registerAction("ai-tools:create", async () => {
		const name = await input.ask("Tool name (lowercase, hyphens/underscores)");
		if (!name) { log(`\n  ${DIM}Cancelled.${RESET}\n`); return "main" as MenuResult; }
		const desc = await input.ask("Description");
		const run = await input.ask("Shell command to run");
		if (!run) { log(`\n  ${DIM}Cancelled.${RESET}\n`); return "main" as MenuResult; }
		const result = scaffoldAiTool(pluginDeps(), VAULT_ROOT, name, desc || "An AI tool", run, disk);
		if ("error" in result) {
			log(`\n  ${RED}${result.error}${RESET}\n`);
		} else {
			log(`\n  ${GREEN}✓${RESET} Created tool at ${DIM}${result.path}${RESET}`);
			log(`  ${DIM}Edit the JSON file to add parameters and tags.${RESET}\n`);
		}
		await input.waitForEnter();
		return "main" as MenuResult;
	});

	registry.registerAction("ai-tools:reference", async () => {
		const tools = loadAiTools(pluginDeps(), VAULT_ROOT, disk);
		const doc = generateAiToolReference({ clock }, tools);
		const outputPath = paths.join(CLI_PROJECT, "docs", "reference", "AI Tool Reference.md");
		doc.save(outputPath, disk);
		log(`\n  ${GREEN}✓${RESET} Reference saved to ${DIM}${outputPath}${RESET}\n`);
		await input.waitForEnter();
		return "main" as MenuResult;
	});
}
