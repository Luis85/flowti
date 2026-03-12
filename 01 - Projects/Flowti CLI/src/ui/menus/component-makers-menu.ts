/**
 * component-makers-menu.ts — Interactive component scaffolding for the Make menu.
 *
 * Provides the component submenu (listing all component types) and the
 * interactive maker that prompts for input and writes files.
 *
 * Moved from domain/make/component/component-makers.ts to separate
 * display/input concerns from pure domain logic.
 */

import { disk } from "../../infrastructure/filesystem.js";
import { paths } from "../../infrastructure/paths.js";
import { clock } from "../../infrastructure/clock.js";
import { input } from "../../infrastructure/input.js";
import { runMenu } from "../../infrastructure/menu.js";
import { log } from "../../infrastructure/logger.js";
import { RESET, BOLD, DIM, GREEN, RED, CYAN } from "../../infrastructure/ui.js";
import { toKebab, toPascal, toCamel } from "../../domain/make/naming.js";
import { createFileWriter } from "../../domain/make/templates/file-writer.js";
import { buildComponentPlan, resolveNextSteps } from "../../domain/make/component/component-plan.js";
import { loadComponentDefinitions, createComponentTemplateRegistry } from "../../domain/make/component/component-registry.js";
import { getFramework } from "../../domain/make/component/storybook-settings.js";
import { getFrameworkPackages } from "../../domain/make/component/storybook-service.js";
import type { ComponentDefinition, ComponentVariables } from "../../domain/make/component/component-types.js";
import type { FileEntry } from "../../domain/make/component/component-plan.js";
import type { MenuEntry, MenuResult } from "../../infrastructure/types.js";

// ── Helpers ─────────────────────────────────────────────────────────

function writePlan(basePath: string, files: FileEntry[]): number {
	const writer = createFileWriter(basePath);
	for (const f of files) writer.write(f.path, f.content);
	return writer.created;
}

// ── Interactive helpers ──────────────────────────────────────────────

async function collectDefinitionPrompts(def: ComponentDefinition): Promise<Record<string, string> | null> {
	const vars: Record<string, string> = {};
	for (const prompt of def.prompts) {
		const answer = await input.ask(prompt.label, prompt.default ?? "");
		if (prompt.required && !answer) {
			log(`\n  ${RED}Required: ${prompt.label}${RESET}\n`);
			return null;
		}
		vars[prompt.variable] = answer;
	}
	return vars;
}

async function collectPropertyValues(def: ComponentDefinition): Promise<Record<string, string>> {
	const values: Record<string, string> = {};
	if (def.properties.length === 0) return values;
	log(`\n  ${BOLD}Properties:${RESET}`);
	for (const prop of def.properties) {
		const hint = prop.description ? ` — ${prop.description}` : "";
		const label = `${prop.key} (${prop.type}${hint})`;
		const defaultVal = prop.default != null ? String(prop.default) : "";
		values[`prop.${prop.key}`] = await input.ask(label, defaultVal);
	}
	return values;
}

async function collectCustomProperties(): Promise<Record<string, string>> {
	const props: Record<string, string> = {};
	log(`\n  ${BOLD}Properties${RESET}  ${DIM}(enter blank name to finish)${RESET}`);
	for (;;) {
		const key = await input.ask("Property name", "");
		if (!key) break;
		const value = await input.ask(`  ${key} default value`, "");
		props[`prop.${key}`] = value;
		log(`    ${GREEN}+${RESET} ${key}: ${DIM}${value || "(empty)"}${RESET}`);
	}
	return props;
}

// ── Interactive maker ───────────────────────────────────────────────

async function makeComponentInteractive(projectRoot: string, def: ComponentDefinition): Promise<void> {
	const { printHeader } = await import("../../infrastructure/ui.js");
	printHeader(`Add ${def.label}`);

	log(`  ${DIM}Project root: ${projectRoot}${RESET}\n`);

	const name = await input.ask("Component name");
	if (!name) return;

	const domain = await input.ask("Domain (optional, e.g. auth, checkout)", "");

	const extraVars = await collectDefinitionPrompts(def);
	if (!extraVars) return;

	const propertyValues = await collectPropertyValues(def);
	const fw = getFrameworkPackages(getFramework(projectRoot, { disk, paths }));
	const vars: ComponentVariables = {
		name, kebab: toKebab(name), pascal: toPascal(name), camel: toCamel(name),
		domain,
		storybookFramework: fw.framework,
		...extraVars, ...propertyValues,
	};

	const docPath = paths.join(projectRoot, "docs", "components", `${vars.kebab}.md`);
	if (disk.existsSync(docPath)) {
		log(`\n  ${RED}Component already exists:${RESET} ${vars.kebab}\n`);
		return;
	}

	// Always prompt for custom properties
	const customProps = await collectCustomProperties();
	Object.assign(vars, customProps);

	const domainNote = domain ? `  ${DIM}Domain: ${domain}${RESET}` : "";
	log(`\n  ${BOLD}Adding: ${name}${RESET} ${DIM}(${def.label})${RESET}${domainNote}`);
	log(`  ${DIM}ID: ${vars.kebab}${RESET}\n`);

	const proceed = await input.ask("Create files? (Y/n)", "Y");
	if (proceed.toLowerCase() === "n") return;

	const templates = createComponentTemplateRegistry();
	const plan = buildComponentPlan(vars, def, templates, { clock });
	const created = writePlan(projectRoot, plan);

	log(`\n  ${GREEN}✓${RESET} Created ${created} files for ${name}.\n`);

	const steps = resolveNextSteps(def, vars);
	if (steps.length > 0) {
		log(`  ${BOLD}Next steps:${RESET}`);
		for (const step of steps) log(`    ${CYAN}▸${RESET} ${step}`);
		log();
	}

	await input.waitForEnter();
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
