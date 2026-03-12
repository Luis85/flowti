/**
 * scaffold-service.ts — Scaffold domain orchestrator.
 *
 * Manages definition loading, registry setup, and scaffold execution.
 * Interactive menu lives in ui/menus/scaffold-menu.ts.
 */

import { cliConfig, PROJECTS_DIR } from "../../infrastructure/config.js";
import type { CliDeps } from "../../infrastructure/deps.js";
import type { IFileSystem } from "../../infrastructure/types.js";
import { createFileWriter } from "../make/templates/file-writer.js";
import { toKebab, toPascal, toCamel } from "../make/naming.js";
import type { ScaffoldDefinition, ScaffoldVariables, ScaffoldContext, FileEntry } from "./scaffold-types.js";
import { createTemplateRegistry, registerAll } from "./templates/template-registry.js";
import type { TemplateRegistry } from "./templates/template-registry.js";
import { sharedTemplates } from "./templates/shared-templates.js";
import { projectTemplates } from "./templates/project-templates.js";
import { bareTemplates } from "./templates/bare-templates.js";
import { cliTemplates } from "./templates/cli-templates.js";
import { pluginTemplates } from "./templates/plugin-templates.js";
import { validateDefinition } from "./scaffold-schema.js";
import { buildScaffoldPlan } from "./scaffold-plan.js";
import { loadAllDefinitions, resolveDefinitionsDir } from "./marketplace.js";

// ── Definition loading ───────────────────────────────────────────────
// Definitions are imported directly so esbuild inlines them into the bundle.
// Adding a new definition: import it here and add to BUNDLED_DEFINITIONS.

import flowtiProjectDef from "./definitions/flowti-project.json" with { type: "json" };
import flowtiBareDef from "./definitions/flowti-bare.json" with { type: "json" };
import flowtiCliDef from "./definitions/flowti-cli.json" with { type: "json" };
import flowtiPluginDef from "./definitions/flowti-obsidian-plugin.json" with { type: "json" };

export const BUNDLED_DEFINITIONS: unknown[] = [flowtiProjectDef, flowtiBareDef, flowtiCliDef, flowtiPluginDef];

function loadDefinitions(): ScaffoldDefinition[] {
	return BUNDLED_DEFINITIONS
		.filter(raw => validateDefinition(raw).length === 0) as ScaffoldDefinition[];
}

/**
 * Load all definitions — bundled plus project-local (configs/definitions/).
 *
 * Local definitions are validated against the known template IDs
 * from the default registry.
 */
export function loadAllDefinitionsFromProject(
	deps: Pick<CliDeps, "disk" | "paths">,
	projectRoot?: string,
): ScaffoldDefinition[] {
	const registry = createDefaultRegistry();
	const knownIds = registry.ids();
	const localDir = projectRoot ? resolveDefinitionsDir(deps, projectRoot) : "";
	return loadAllDefinitions(deps, BUNDLED_DEFINITIONS, localDir, knownIds);
}

/** Get the known template IDs from the default registry. */
export function getKnownTemplateIds(): string[] {
	return createDefaultRegistry().ids();
}

// ── Registry setup ───────────────────────────────────────────────────

function createDefaultRegistry(): TemplateRegistry {
	const registry = createTemplateRegistry();
	registerAll(registry, sharedTemplates);
	registerAll(registry, projectTemplates);
	registerAll(registry, bareTemplates);
	registerAll(registry, cliTemplates);
	registerAll(registry, pluginTemplates);
	return registry;
}

// ── Variable derivation ──────────────────────────────────────────────

export function deriveVariables(name: string, author?: string): ScaffoldVariables {
	return {
		name,
		id: toKebab(name),
		pascal: toPascal(name),
		camel: toCamel(name),
		author: author ?? cliConfig.defaultAuthor ?? "",
	};
}

// ── Prompt resolution ────────────────────────────────────────────────

export function resolvePromptDefault(defaultValue: string | undefined): string {
	if (!defaultValue) return "";
	if (defaultValue === "{{cliConfig.defaultAuthor}}") {
		return cliConfig.defaultAuthor ?? "";
	}
	return defaultValue;
}

// ── Write plan ───────────────────────────────────────────────────────

function writePlan(outputPath: string, entries: FileEntry[], disk?: IFileSystem): number {
	const writer = createFileWriter(outputPath, disk);
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

export interface DryRunResult {
	files: string[];
	outputPath: string;
	definition: string;
}

export function scaffold(
	deps: Pick<CliDeps, "disk" | "paths">,
	opts: ScaffoldOptions,
): { created: number; outputPath: string } | { error: string } {
	const registry = createDefaultRegistry();
	const definitions = loadDefinitions();
	const def = definitions.find(d => d.id === opts.definitionId);

	if (!def) {
		return { error: `Unknown scaffold definition: "${opts.definitionId}". Available: ${definitions.map(d => d.id).join(", ")}` };
	}

	const vars = deriveVariables(opts.name, opts.author);
	const outputDir = opts.outputDir ?? deps.paths.join(PROJECTS_DIR, vars.name);

	if (deps.disk.existsSync(outputDir)) {
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
	const created = writePlan(outputDir, plan, deps.disk);

	return { created, outputPath: outputDir };
}

/**
 * Preview scaffold output without writing any files.
 * Returns the list of files that would be created.
 */
export function scaffoldDryRun(
	deps: Pick<CliDeps, "paths">,
	opts: ScaffoldOptions,
): DryRunResult | { error: string } {
	const registry = createDefaultRegistry();
	const definitions = loadDefinitions();
	const def = definitions.find(d => d.id === opts.definitionId);

	if (!def) {
		return { error: `Unknown scaffold definition: "${opts.definitionId}". Available: ${definitions.map(d => d.id).join(", ")}` };
	}

	const vars = deriveVariables(opts.name, opts.author);
	const outputDir = opts.outputDir ?? deps.paths.join(PROJECTS_DIR, vars.name);

	const unknownIds = def.files
		.filter(f => !registry.has(f.templateId))
		.map(f => f.templateId);
	if (unknownIds.length > 0) {
		return { error: `Unknown template IDs: ${unknownIds.join(", ")}` };
	}

	const ctx: ScaffoldContext = { vars, outputPath: outputDir, definition: def };
	const plan = buildScaffoldPlan(ctx, registry);

	return {
		files: plan.map(f => f.path),
		outputPath: outputDir,
		definition: def.id,
	};
}

// ── List definitions ─────────────────────────────────────────────────

export function listDefinitions(): ScaffoldDefinition[] {
	return loadDefinitions();
}
