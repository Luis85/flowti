/**
 * component-plan.ts — Pure plan builder for component scaffolding.
 *
 * Takes validated inputs and returns a FileEntry[] — no I/O, no side effects.
 */

import type { ComponentVariables, ComponentDefinition, ComponentTemplateFn } from "./component-types.js";

export interface FileEntry {
	path: string;
	content: string;
}

export type ComponentTemplateRegistry = Map<string, ComponentTemplateFn>;

/** Interpolate {{variable}} placeholders in a path string. */
function interpolatePath(template: string, vars: ComponentVariables): string {
	return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? "");
}

/** Build the file plan for a component from its definition and variables. */
export function buildComponentPlan(
	vars: ComponentVariables,
	def: ComponentDefinition,
	templates: ComponentTemplateRegistry,
): FileEntry[] {
	return def.files.map((f) => {
		const templateFn = templates.get(f.templateId);
		if (!templateFn) {
			throw new Error(`Unknown component template: "${f.templateId}"`);
		}
		const result = templateFn(vars, def);
		return {
			path: interpolatePath(f.path, vars),
			content: result.toString(),
		};
	});
}

/** Resolve next-step instructions with variable interpolation. */
export function resolveNextSteps(def: ComponentDefinition, vars: ComponentVariables): string[] {
	return def.nextSteps.map((step) => interpolatePath(step, vars));
}
