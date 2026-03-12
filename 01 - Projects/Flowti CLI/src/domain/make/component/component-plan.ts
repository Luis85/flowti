/**
 * component-plan.ts — Pure plan builder for component scaffolding.
 *
 * Takes validated inputs and returns a FileEntry[] — no I/O, no side effects.
 */

import type { ComponentVariables, ComponentDefinition, ComponentTemplateFn, ComponentTemplateDeps } from "./component-types.js";
import { InternalError } from "../../../infrastructure/errors.js";

export interface FileEntry {
	path: string;
	content: string;
}

export type ComponentTemplateRegistry = Map<string, ComponentTemplateFn>;

/** Interpolate {{variable}} placeholders in a path string. */
function interpolatePath(template: string, vars: ComponentVariables): string {
	return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? "");
}

/**
 * When a domain variable is set, rewrite `components/{name}/…` to
 * `components/{domain}/{name}/…` so components are grouped by domain.
 */
function applyDomainPrefix(path: string, domain: string | undefined): string {
	if (!domain) return path;
	return path.replace(/^components\//, `components/${domain}/`);
}

/** Build the file plan for a component from its definition and variables. */
export function buildComponentPlan(
	vars: ComponentVariables,
	def: ComponentDefinition,
	templates: ComponentTemplateRegistry,
	deps: ComponentTemplateDeps,
): FileEntry[] {
	const domain = vars.domain || undefined;
	return def.files.map((f) => {
		const templateFn = templates.get(f.templateId);
		if (!templateFn) {
			throw new InternalError(`Unknown component template: "${f.templateId}"`);
		}
		const result = templateFn(vars, def, deps);
		return {
			path: applyDomainPrefix(interpolatePath(f.path, vars), domain),
			content: result.toString(),
		};
	});
}

/** Resolve next-step instructions with variable interpolation. */
export function resolveNextSteps(def: ComponentDefinition, vars: ComponentVariables): string[] {
	const domain = vars.domain || undefined;
	return def.nextSteps.map((step) => applyDomainPrefix(interpolatePath(step, vars), domain));
}
