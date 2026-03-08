/**
 * component-makers.ts — Interactive component scaffolding for the Make menu.
 *
 * Provides the component submenu (listing all component types) and the
 * interactive maker that prompts for input and writes files.
 */

import { disk } from "../../../infrastructure/filesystem.js";
import { paths } from "../../../infrastructure/paths.js";
import { input } from "../../../infrastructure/input.js";
import { runMenu } from "../../../infrastructure/menu.js";
import { log } from "../../../infrastructure/logger.js";
import { RESET, BOLD, DIM, GREEN, RED, CYAN } from "../../../infrastructure/ui.js";
import { toKebab, toPascal, toCamel } from "../naming.js";
import { createFileWriter } from "../templates/file-writer.js";
import { buildComponentPlan, resolveNextSteps } from "./component-plan.js";
import { loadComponentDefinitions, createComponentTemplateRegistry } from "./component-registry.js";
import type { ComponentDefinition, ComponentVariables } from "./component-types.js";
import type { FileEntry } from "./component-plan.js";
import type { MenuEntry, MenuResult } from "../../../infrastructure/types.js";

// ── Helpers ─────────────────────────────────────────────────────────

function writePlan(basePath: string, files: FileEntry[]): number {
	const writer = createFileWriter(basePath);
	for (const f of files) writer.write(f.path, f.content);
	return writer.created;
}

// ── Interactive maker ───────────────────────────────────────────────

async function makeComponentInteractive(projectRoot: string, def: ComponentDefinition): Promise<void> {
	const { printHeader } = await import("../../../infrastructure/ui.js");
	printHeader(`Add ${def.label}`);

	log(`  ${DIM}Project root: ${projectRoot}${RESET}\n`);

	const name = await input.ask("Component name");
	if (!name) return;

	const kebab = toKebab(name);
	const pascal = toPascal(name);
	const camel = toCamel(name);

	// Resolve additional prompts from the definition
	const extraVars: Record<string, string> = {};
	for (const prompt of def.prompts) {
		const answer = await input.ask(prompt.label, prompt.default ?? "");
		if (prompt.required && !answer) {
			log(`\n  ${RED}Required: ${prompt.label}${RESET}\n`);
			return;
		}
		extraVars[prompt.variable] = answer;
	}

	const vars: ComponentVariables = { name, kebab, pascal, camel, ...extraVars };

	// Check for existing component
	const docPath = paths.join(projectRoot, "docs", "components", `${kebab}.md`);
	if (disk.existsSync(docPath)) {
		log(`\n  ${RED}Component already exists:${RESET} ${kebab}\n`);
		return;
	}

	log();
	log(`  ${BOLD}Adding: ${name}${RESET} ${DIM}(${def.label})${RESET}`);
	log(`  ${DIM}ID: ${kebab}${RESET}`);
	log();

	const proceed = await input.ask("Create files? (Y/n)", "Y");
	if (proceed.toLowerCase() === "n") return;

	const templates = createComponentTemplateRegistry();
	const plan = buildComponentPlan(vars, def, templates);
	const created = writePlan(projectRoot, plan);

	log(`\n  ${GREEN}✓${RESET} Created ${created} files for ${name}.\n`);

	const steps = resolveNextSteps(def, vars);
	if (steps.length > 0) {
		log(`  ${BOLD}Next steps:${RESET}`);
		for (const step of steps) {
			log(`    ${CYAN}▸${RESET} ${step}`);
		}
		log();
	}
}

// ── Component submenu ───────────────────────────────────────────────

export async function componentMenu(projectRoot: string): Promise<MenuResult> {
	const definitions = loadComponentDefinitions();

	const items: MenuEntry[] = definitions.map((def, i) => ({
		key: String(i + 1),
		label: `Add ${def.label}`,
		action: async () => {
			await makeComponentInteractive(projectRoot, def);
		},
	}));

	items.push(
		{ separator: true },
		{ key: "b", label: "Back", action: () => "main" as const },
		{ key: "q", label: "Quit", action: () => "quit" as const },
	);

	return runMenu("Add Component", items);
}
