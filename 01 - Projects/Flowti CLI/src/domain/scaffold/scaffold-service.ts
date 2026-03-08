/**
 * scaffold-service.ts — Scaffold domain orchestrator.
 *
 * Manages definition loading, registry setup, and the interactive scaffold menu.
 */

import { disk } from "../../infrastructure/filesystem.js";
import { paths } from "../../infrastructure/paths.js";
import { cliConfig, PROJECTS_DIR } from "../../infrastructure/config.js";
import { input } from "../../infrastructure/input.js";
import { runMenu } from "../../infrastructure/menu.js";
import { log } from "../../infrastructure/logger.js";
import { RESET, DIM, GREEN, RED, CYAN, BOLD } from "../../infrastructure/ui.js";
import { createFileWriter } from "../make/templates/file-writer.js";
import { toKebab, toPascal, toCamel } from "../make/naming.js";
import type { MenuEntry, MenuResult } from "../../infrastructure/types.js";
import type { ScaffoldDefinition, ScaffoldVariables, ScaffoldContext, FileEntry } from "./scaffold-types.js";
import { createTemplateRegistry, registerAll } from "./templates/template-registry.js";
import type { TemplateRegistry } from "./templates/template-registry.js";
import { sharedTemplates } from "./templates/shared-templates.js";
import { projectTemplates } from "./templates/project-templates.js";
import { validateDefinition } from "./scaffold-schema.js";
import { buildScaffoldPlan, resolveNextSteps } from "./scaffold-plan.js";

// ── Definition loading ───────────────────────────────────────────────
// Definitions are imported directly so esbuild inlines them into the bundle.
// Adding a new definition: import it here and add to BUNDLED_DEFINITIONS.

import flowtiProjectDef from "./definitions/flowti-project.json";

const BUNDLED_DEFINITIONS: unknown[] = [flowtiProjectDef];

function loadDefinitions(): ScaffoldDefinition[] {
	return BUNDLED_DEFINITIONS
		.filter(raw => validateDefinition(raw).length === 0) as ScaffoldDefinition[];
}

// ── Registry setup ───────────────────────────────────────────────────

function createDefaultRegistry(): TemplateRegistry {
	const registry = createTemplateRegistry();
	registerAll(registry, sharedTemplates);
	registerAll(registry, projectTemplates);
	return registry;
}

// ── Variable derivation ──────────────────────────────────────────────

function deriveVariables(name: string, author?: string): ScaffoldVariables {
	return {
		name,
		id: toKebab(name),
		pascal: toPascal(name),
		camel: toCamel(name),
		author: author ?? cliConfig.defaultAuthor ?? "",
	};
}

// ── Prompt resolution ────────────────────────────────────────────────

function resolvePromptDefault(defaultValue: string | undefined): string {
	if (!defaultValue) return "";
	if (defaultValue === "{{cliConfig.defaultAuthor}}") {
		return cliConfig.defaultAuthor ?? "";
	}
	return defaultValue;
}

// ── Write plan ───────────────────────────────────────────────────────

function writePlan(outputPath: string, entries: FileEntry[]): number {
	const writer = createFileWriter(outputPath);
	for (const f of entries) writer.write(f.path, f.content);
	return writer.created;
}

// ── Core scaffold function ───────────────────────────────────────────

export interface ScaffoldOptions {
	definitionId: string;
	name: string;
	author?: string;
	outputDir?: string;
}

export function scaffold(opts: ScaffoldOptions): { created: number; outputPath: string } | { error: string } {
	const registry = createDefaultRegistry();
	const definitions = loadDefinitions();
	const def = definitions.find(d => d.id === opts.definitionId);

	if (!def) {
		return { error: `Unknown scaffold definition: "${opts.definitionId}". Available: ${definitions.map(d => d.id).join(", ")}` };
	}

	const vars = deriveVariables(opts.name, opts.author);
	const outputDir = opts.outputDir ?? paths.join(PROJECTS_DIR, vars.name);

	if (disk.existsSync(outputDir)) {
		return { error: `Directory already exists: ${outputDir}` };
	}

	// Validate all templateIds are resolvable
	const unknownIds = def.files
		.filter(f => !registry.has(f.templateId))
		.map(f => f.templateId);
	if (unknownIds.length > 0) {
		return { error: `Unknown template IDs: ${unknownIds.join(", ")}` };
	}

	const ctx: ScaffoldContext = { vars, outputPath: outputDir, definition: def };
	const plan = buildScaffoldPlan(ctx, registry);
	const created = writePlan(outputDir, plan);

	return { created, outputPath: outputDir };
}

// ── List definitions ─────────────────────────────────────────────────

export function listDefinitions(): ScaffoldDefinition[] {
	return loadDefinitions();
}

// ── Interactive menu ─────────────────────────────────────────────────

export async function menu(): Promise<MenuResult> {
	const definitions = loadDefinitions();

	if (definitions.length === 0) {
		log(`\n  ${DIM}No scaffold definitions found.${RESET}\n`);
		return "main";
	}

	const items: MenuEntry[] = definitions.map((def, i) => ({
		key: String(i + 1),
		label: `${def.label}  ${DIM}${def.description}${RESET}`,
		action: async () => { await runScaffoldInteractive(def); },
	}));

	items.push(
		{ separator: true },
		{ key: "b", label: "Back", action: () => "main" as const },
		{ key: "q", label: "Quit", action: () => "quit" as const },
	);

	return runMenu("New Project", items);
}

async function runScaffoldInteractive(def: ScaffoldDefinition): Promise<void> {
	const { printHeader } = await import("../../infrastructure/ui.js");
	printHeader(`New Project: ${def.label}`);

	const name = await input.ask("Project name");
	if (!name) return;

	// Resolve additional prompts
	const extraVars: Record<string, string> = {};
	for (const prompt of def.prompts) {
		const defaultVal = resolvePromptDefault(prompt.default);
		const answer = await input.ask(prompt.label, defaultVal);
		if (prompt.required && !answer) {
			log(`\n  ${RED}Required field "${prompt.variable}" is empty.${RESET}\n`);
			return;
		}
		extraVars[prompt.variable] = answer;
	}

	const vars = deriveVariables(name, extraVars.author);
	const outputDir = paths.join(PROJECTS_DIR, vars.name);

	if (disk.existsSync(outputDir)) {
		log(`\n  ${RED}Directory already exists:${RESET} ${outputDir}\n`);
		return;
	}

	log(`\n  ${CYAN}Scaffolding${RESET} ${BOLD}${name}${RESET} → ${DIM}${outputDir}${RESET}\n`);

	const registry = createDefaultRegistry();
	const ctx: ScaffoldContext = { vars, outputPath: outputDir, definition: def };

	try {
		const plan = buildScaffoldPlan(ctx, registry);
		const created = writePlan(outputDir, plan);
		log(`\n  ${GREEN}✓${RESET} Created ${created} files.\n`);

		// Show next steps
		const varMap = { ...vars, outputPath: outputDir };
		const steps = resolveNextSteps(def, varMap as unknown as Record<string, string>);
		if (steps.length > 0) {
			log(`  ${DIM}Next steps:${RESET}`);
			for (const step of steps) {
				log(`    ${CYAN}▸${RESET} ${step}`);
			}
			log();
		}
	} catch (err) {
		log(`\n  ${RED}Scaffold failed:${RESET} ${err instanceof Error ? err.message : String(err)}\n`);
	}
}
