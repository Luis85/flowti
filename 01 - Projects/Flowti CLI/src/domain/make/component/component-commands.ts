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

import { paths } from "../../../infrastructure/paths.js";
import { disk } from "../../../infrastructure/filesystem.js";
import { toKebab, toPascal, toCamel } from "../naming.js";
import { createFileWriter } from "../templates/file-writer.js";
import { buildComponentPlan } from "./component-plan.js";
import { loadComponentDefinitions, createComponentTemplateRegistry } from "./component-registry.js";
import type { ComponentVariables } from "./component-types.js";
import type { Suggestion } from "../../../infrastructure/suggestions.js";
import { afterMakeComponent } from "../../../infrastructure/suggestions.js";

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
	};
}

// ── Pure domain function ─────────────────────────────────────────────

export function makeComponent(
	definitionId: string,
	name: string | undefined,
	flags: Record<string, string | boolean>,
	projectPath: string,
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

	const docPath = paths.join(projectPath, "docs", "components", `${vars.kebab}.md`);
	if (disk.existsSync(docPath)) {
		return { success: false, error: `Component already exists: ${vars.kebab}` };
	}

	const templates = createComponentTemplateRegistry();
	const plan = buildComponentPlan(vars, def, templates);

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

/** All supported make:* definition IDs. */
export const COMPONENT_DEFINITION_IDS = ["component", "c4-system", "c4-container", "c4-component", "c4-person"] as const;
