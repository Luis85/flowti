/**
 * component-commands.ts — Pure domain logic for component scaffolding.
 *
 * Returns typed results; rendering is handled by the controller.
 *
 * Invoked from the command line:
 *   flowti make:component --name=UserProfile
 *   flowti make:system --name=PaymentGateway --description="Handles payments"
 *   flowti make:container --name=ApiServer --technology="Node.js"
 *   flowti make:c4-component --name=AuthService
 *   flowti make:person --name=Customer --description="End user"
 */

import type { CliDeps } from "../../../infrastructure/deps.js";
import { toKebab, toPascal, toCamel } from "../naming.js";
import { createFileWriter, createOverwriteFileWriter } from "../templates/file-writer.js";
import { buildComponentPlan } from "./component-plan.js";
import { loadComponentDefinitions, createComponentTemplateRegistry } from "./component-registry.js";
import type { ComponentVariables, ComponentDefinition } from "./component-types.js";
import type { Suggestion } from "../../../infrastructure/suggestions.js";
import { afterMakeComponent } from "../../../infrastructure/suggestions.js";

export type ComponentCommandsDeps = Pick<CliDeps, "disk" | "paths" | "clock">;

// ── Result types ─────────────────────────────────────────────────────

export interface MakeComponentResult {
	success: true;
	definitionLabel: string;
	name: string;
	filesCreated: number;
	suggestions: Suggestion[];
}

export interface MakeComponentError {
	success: false;
	error: string;
	hint?: string;
}

export type MakeComponentOutcome = MakeComponentResult | MakeComponentError;

// ── Helpers ──────────────────────────────────────────────────────────

function buildComponentVars(name: string, flags: Record<string, string | boolean>): ComponentVariables {
	return buildVarsFromRecord(name, toKebab(name), flags);
}

export function buildVarsFromRecord(name: string, kebab: string, fields: Record<string, unknown>): ComponentVariables {
	return {
		name,
		kebab,
		pascal: toPascal(kebab),
		camel: toCamel(kebab),
		description: String(fields.description ?? ""),
		technology: String(fields.technology ?? ""),
		containedBy: String(fields.containedBy ?? ""),
		owner: String(fields.owner ?? ""),
		domain: String(fields.domain ?? ""),
		storybookFramework: String(fields.storybookFramework ?? ""),
	};
}

export function resolveBlueprint(instanceType: string): ComponentDefinition | null {
	return loadComponentDefinitions().find((d) => d.kind === instanceType) ?? null;
}

export function parseJsonFile(filePath: string, deps: Pick<CliDeps, "disk">): Record<string, unknown> | null {
	try {
		return JSON.parse(deps.disk.readFileSync(filePath, "utf-8"));
	} catch {
		return null;
	}
}

function writePlanSkippingJson(projectPath: string, plan: { path: string; content: string }[]): number {
	const writer = createOverwriteFileWriter(projectPath);
	for (const f of plan) {
		if (!f.path.endsWith(".json")) writer.write(f.path, f.content);
	}
	return writer.created;
}

// ── Pure domain function ─────────────────────────────────────────────

export function makeComponent(
	definitionId: string,
	name: string | undefined,
	flags: Record<string, string | boolean>,
	projectPath: string,
	deps: ComponentCommandsDeps,
): MakeComponentOutcome {
	if (!name || typeof name !== "string") {
		return {
			success: false,
			error: "--name is required.",
			hint: `Usage: flowti make:${definitionId} --name=MyComponent [--description="..."]`,
		};
	}

	const definitions = loadComponentDefinitions();
	const def = definitions.find((d) => d.id === definitionId);
	if (!def) {
		return { success: false, error: `Unknown component type: ${definitionId}` };
	}

	const vars = buildComponentVars(name, flags);

	const docPath = deps.paths.join(projectPath, "docs", "components", `${vars.kebab}.md`);
	if (deps.disk.existsSync(docPath)) {
		return { success: false, error: `Component already exists: ${vars.kebab}` };
	}

	const templates = createComponentTemplateRegistry();
	const plan = buildComponentPlan(vars, def, templates, { clock: deps.clock });

	const writer = createFileWriter(projectPath);
	for (const f of plan) writer.write(f.path, f.content);

	return {
		success: true,
		definitionLabel: def.label,
		name,
		filesCreated: writer.created,
		suggestions: afterMakeComponent(name),
	};
}

// ── Regeneration ─────────────────────────────────────────────────────

export interface RegenerateResult {
	success: true;
	name: string;
	filesWritten: number;
}

export interface RegenerateError {
	success: false;
	error: string;
}

export type RegenerateOutcome = RegenerateResult | RegenerateError;

/**
 * Regenerates a component's generated files from its definition JSON.
 * The .json file itself is never overwritten — it is the source of truth.
 */
export function regenerateComponent(
	componentName: string,
	projectPath: string,
	deps: ComponentCommandsDeps,
	domain?: string,
	storybookFramework?: string,
): RegenerateOutcome {
	const kebab = toKebab(componentName);
	const domainPrefix = domain ? `${domain}/` : "";
	const compDir = deps.paths.join(projectPath, "components", domainPrefix, kebab);
	const jsonPath = deps.paths.join(compDir, `${kebab}.json`);

	if (!deps.disk.existsSync(jsonPath)) {
		return { success: false, error: `Definition not found: components/${domainPrefix}${kebab}/${kebab}.json` };
	}

	const instanceJson = parseJsonFile(jsonPath, deps);
	if (!instanceJson) {
		return { success: false, error: `Failed to parse: components/${kebab}/${kebab}.json` };
	}

	const blueprint = resolveBlueprint(String(instanceJson.type ?? "component"));
	if (!blueprint) {
		return { success: false, error: `Unknown component type in definition: ${instanceJson.type}` };
	}

	const vars = buildVarsFromRecord(String(instanceJson.name ?? componentName), kebab, {
		...instanceJson,
		domain: domain ?? instanceJson.domain,
		storybookFramework: storybookFramework ?? "",
	});

	const plan = buildComponentPlan(vars, blueprint, createComponentTemplateRegistry(), { clock: deps.clock });
	const filesWritten = writePlanSkippingJson(projectPath, plan);
	return { success: true, name: vars.name, filesWritten };
}

/** All supported make:* definition IDs. */
export const COMPONENT_DEFINITION_IDS = ["component", "c4-system", "c4-container", "c4-component", "c4-person"] as const;
