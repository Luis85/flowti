/**
 * scaffold-menu.ts — Interactive scaffold menu.
 *
 * Moved from domain/scaffold/scaffold-service.ts to separate display
 * concerns from pure domain logic.
 */

import { RESET, DIM, GREEN, RED, CYAN, BOLD, printHeader } from "../../infrastructure/ui.js";
import { PROJECTS_DIR, cliConfig } from "../../infrastructure/config.js";
import { runMenu } from "../../infrastructure/menu.js";
import type { MenuEntry, MenuResult } from "../../infrastructure/types.js";
import type { MakeDeps } from "../../infrastructure/deps.js";
import { scaffold, listDefinitions, resolvePromptDefault, deriveVariables } from "../../domain/scaffold/scaffold-service.js";
import { resolveNextSteps } from "../../domain/scaffold/scaffold-plan.js";
import type { ScaffoldDefinition } from "../../domain/scaffold/scaffold-types.js";

export async function scaffoldMenu(deps: MakeDeps): Promise<MenuResult> {
	const { log } = deps;
	const definitions = listDefinitions();

	if (definitions.length === 0) {
		log(`\n  ${DIM}No scaffold definitions found.${RESET}\n`);
		return "main";
	}

	const items: MenuEntry[] = definitions.map((def, i) => ({
		key: String(i + 1),
		label: `${def.label}  ${DIM}${def.description}${RESET}`,
		action: async () => { await runScaffoldInteractive(def, deps); },
	}));

	items.push(
		{ separator: true },
		{ key: "b", label: "Back", action: () => "main" as const },
		{ key: "q", label: "Quit", action: () => "quit" as const },
	);

	return runMenu("New Project", items);
}

async function runScaffoldInteractive(def: ScaffoldDefinition, deps: MakeDeps): Promise<void> {
	const { disk, paths, input, log } = deps;
	printHeader(`New Project: ${def.label}`);

	const name = await input.ask("Project name");
	if (!name) return;

	const extraVars: Record<string, string> = {};
	for (const prompt of def.prompts) {
		const defaultVal = resolvePromptDefault(prompt.default, cliConfig.defaultAuthor);
		const answer = await input.ask(prompt.label, defaultVal);
		if (prompt.required && !answer) {
			log(`\n  ${RED}Required field "${prompt.variable}" is empty.${RESET}\n`);
			return;
		}
		extraVars[prompt.variable] = answer;
	}

	const vars = deriveVariables(name, extraVars.author, undefined, cliConfig.defaultAuthor);
	const outputDir = paths.join(PROJECTS_DIR, vars.name);

	if (disk.existsSync(outputDir)) {
		log(`\n  ${RED}Directory already exists:${RESET} ${outputDir}\n`);
		return;
	}

	log(`\n  ${CYAN}Scaffolding${RESET} ${BOLD}${name}${RESET} → ${DIM}${outputDir}${RESET}\n`);

	const result = scaffold(PROJECTS_DIR, deps, { definitionId: def.id, name, author: extraVars.author, outputDir }, cliConfig.defaultAuthor);

	if ("error" in result) {
		log(`\n  ${RED}Scaffold failed:${RESET} ${result.error}\n`);
		return;
	}

	log(`\n  ${GREEN}✓${RESET} Created ${result.created} files.\n`);

	const varMap = { ...vars, outputPath: outputDir };
	const steps = resolveNextSteps(def, varMap as unknown as Record<string, string>);
	if (steps.length > 0) {
		log(`  ${DIM}Next steps:${RESET}`);
		for (const step of steps) {
			log(`    ${CYAN}▸${RESET} ${step}`);
		}
		log("");
	}
}
