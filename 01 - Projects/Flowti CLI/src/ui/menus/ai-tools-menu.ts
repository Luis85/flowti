/**
 * ai-tools-menu.ts — Interactive AI tools menu.
 *
 * Moved from domain/ai-tools/ai-tool-commands.ts to separate display
 * concerns from pure domain logic.
 */

import { log } from "../../infrastructure/logger.js";
import { RESET, DIM, GREEN, RED } from "../../infrastructure/ui.js";
import { disk } from "../../infrastructure/filesystem.js";
import { input } from "../../infrastructure/input.js";
import { VAULT_ROOT, CLI_PROJECT } from "../../infrastructure/config.js";
import { runMenu } from "../../infrastructure/menu.js";
import { paths } from "../../infrastructure/paths.js";
import { clock } from "../../infrastructure/clock.js";
import type { MenuEntry, MenuResult } from "../../infrastructure/types.js";
import { loadAiTools, scaffoldAiTool } from "../../domain/ai-tools/ai-tool-loader.js";
import { generateAiToolReference } from "../../domain/ai-tools/ai-tool-reference.js";

function toolDeps() { return { disk, paths } as const; }
function clockDeps() { return { clock } as const; }
import { renderToolList, renderToolValidation } from "../ai-tools-display.js";
import type { ToolListItem, ToolValidationItem } from "../ai-tools-display.js";
import { toToolListItems, toToolValidationItems } from "../../domain/ai-tools/ai-tool-commands.js";

export async function aiToolsMenu(): Promise<MenuResult> {
	const items: MenuEntry[] = [
		{
			key: "1",
			label: "List Tools",
			action: () => {
				const tools = loadAiTools(toolDeps(), VAULT_ROOT, disk);
				const items: ToolListItem[] = toToolListItems(tools);
				renderToolList(items);
				return "main" as const;
			},
		},
		{
			key: "2",
			label: "Validate Tools",
			action: () => {
				const items: ToolValidationItem[] = toToolValidationItems(toolDeps(), VAULT_ROOT);
				renderToolValidation(items);
				return "main" as const;
			},
		},
		{
			key: "3",
			label: "Create Tool",
			action: async () => {
				const name = await input.ask("Tool name (lowercase, hyphens/underscores)");
				if (!name) {
					log(`\n  ${DIM}Cancelled.${RESET}\n`);
					return "main" as const;
				}
				const desc = await input.ask("Description");
				const run = await input.ask("Shell command to run");
				if (!run) {
					log(`\n  ${DIM}Cancelled.${RESET}\n`);
					return "main" as const;
				}
				const result = scaffoldAiTool(toolDeps(), VAULT_ROOT, name, desc || "An AI tool", run, disk);
				if ("error" in result) {
					log(`\n  ${RED}${result.error}${RESET}\n`);
				} else {
					log(`\n  ${GREEN}✓${RESET} Created tool at ${DIM}${result.path}${RESET}`);
					log(`  ${DIM}Edit the JSON file to add parameters and tags.${RESET}\n`);
				}
				return "main" as const;
			},
		},
		{
			key: "4",
			label: "Generate Reference",
			action: () => {
				const tools = loadAiTools(toolDeps(), VAULT_ROOT, disk);
				const doc = generateAiToolReference(clockDeps(), tools);
				const outputPath = paths.join(CLI_PROJECT, "docs", "reference", "AI Tool Reference.md");
				doc.save(outputPath);
				log(`\n  ${GREEN}✓${RESET} Reference saved to ${DIM}${outputPath}${RESET}\n`);
				return "main" as const;
			},
		},
		{ separator: true },
		{ key: "b", label: "Back", action: () => "quit" as const },
	];

	await runMenu("AI Tools", items);
	return "main";
}
