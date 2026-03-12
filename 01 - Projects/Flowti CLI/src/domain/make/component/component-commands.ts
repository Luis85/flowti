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
import type { ComponentVariables } from "./component-types.js";
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
	return {
		name,
		kebab: toKebab(name),
		pascal: toPascal(name),
		camel: toCamel(name),
		description: String(flags.description ?? ""),
		technology: String(flags.technology ?? ""),
		containedBy: String(flags.containedBy ?? ""),
		owner: String(flags.owner ?? ""),
		domain: String(flags.domain ?? ""),
		storybookFramework: String(flags.storybookFramework ?? ""),
	};
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
	const compDir = domain
		? deps.paths.join(projectPath, "components", domain, kebab)
		: deps.paths.join(projectPath, "components", kebab);
	const jsonPath = deps.paths.join(compDir, `${kebab}.json`);
	if (!deps.disk.existsSync(jsonPath)) {
		return { success: false, error: `Definition not found: components/${domain ? domain + "/" : ""}${kebab}/${kebab}.json` };
	}

	let instanceJson: Record<string, unknown>;
	try {
		instanceJson = JSON.parse(deps.disk.readFileSync(jsonPath, "utf-8"));
	} catch {
		return { success: false, error: `Failed to parse: components/${kebab}/${kebab}.json` };
	}

	const instanceType = String(instanceJson.type ?? "component");
	const definitions = loadComponentDefinitions();
	const blueprint = definitions.find((d) => d.kind === instanceType);
	if (!blueprint) {
		return { success: false, error: `Unknown component type in definition: ${instanceType}` };
	}

	const vars: ComponentVariables = {
		name: String(instanceJson.name ?? componentName),
		kebab,
		pascal: toPascal(kebab),
		camel: toCamel(kebab),
		description: String(instanceJson.description ?? ""),
		technology: String(instanceJson.technology ?? ""),
		containedBy: String(instanceJson.containedBy ?? ""),
		owner: String(instanceJson.owner ?? ""),
		domain: domain ?? String(instanceJson.domain ?? ""),
		storybookFramework: storybookFramework ?? "",
	};

	const templates = createComponentTemplateRegistry();
	const plan = buildComponentPlan(vars, blueprint, templates, { clock: deps.clock });

	const writer = createOverwriteFileWriter(projectPath);
	for (const f of plan) {
		if (f.path.endsWith(".json")) continue;
		writer.write(f.path, f.content);
	}

	return { success: true, name: vars.name, filesWritten: writer.created };
}

/** All supported make:* definition IDs. */
export const COMPONENT_DEFINITION_IDS = ["component", "c4-system", "c4-container", "c4-component", "c4-person"] as const;
