/**
 * scaffold-plan.ts — Pure plan builder for scaffold definitions.
 *
 * Resolves a ScaffoldDefinition + context into a FileEntry[] plan.
 * No I/O, no prompts, no side effects.
 */

import type { ScaffoldContext, ScaffoldDefinition, FileEntry } from "./scaffold-types.js";
import type { TemplateRegistry } from "./templates/template-registry.js";

// ── Interpolation ────────────────────────────────────────────────────

/** Replace {{variable}} placeholders in a string. */
export function interpolate(template: string, vars: Record<string, string>): string {
	return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? "");
}

/** Build a flat variables map for interpolation (including outputPath). */
function buildVarMap(ctx: ScaffoldContext): Record<string, string> {
	return {
		name: ctx.vars.name,
		id: ctx.vars.id,
		pascal: ctx.vars.pascal,
		camel: ctx.vars.camel,
		author: ctx.vars.author,
		outputPath: ctx.outputPath,
	};
}

// ── Plan builder ─────────────────────────────────────────────────────

/**
 * Build a complete scaffold plan from a definition and context.
 *
 * Steps:
 *   1. Resolve each file mapping: interpolate path, resolve template
 *   2. Add .gitkeep files for declared empty directories
 *   3. Return FileEntry[]
 *
 * Throws if a templateId cannot be resolved.
 */
export function buildScaffoldPlan(ctx: ScaffoldContext, registry: TemplateRegistry): FileEntry[] {
	const varMap = buildVarMap(ctx);
	const entries: FileEntry[] = [];
	const createdDirs = new Set<string>();

	// Resolve file mappings
	for (const mapping of ctx.definition.files) {
		const resolvedPath = interpolate(mapping.path, varMap);
		const templateFn = registry.resolve(mapping.templateId);
		if (!templateFn) {
			throw new Error(`Unknown templateId "${mapping.templateId}" for file "${resolvedPath}".`);
		}
		const content = templateFn(ctx.vars, ctx.definition);
		entries.push({ path: resolvedPath, content });

		// Track parent directories
		const dir = resolvedPath.includes("/") ? resolvedPath.substring(0, resolvedPath.lastIndexOf("/")) : "";
		if (dir) createdDirs.add(dir);
	}

	// Add .gitkeep for declared directories that have no files
	for (const dir of ctx.definition.directories) {
		const interpolatedDir = interpolate(dir, varMap);
		const hasFiles = [...createdDirs].some(d => d === interpolatedDir || d.startsWith(interpolatedDir + "/"));
		if (!hasFiles) {
			entries.push({ path: `${interpolatedDir}/.gitkeep`, content: "" });
		}
	}

	return entries;
}

/**
 * Resolve nextSteps with variable interpolation.
 */
export function resolveNextSteps(def: ScaffoldDefinition, vars: Record<string, string>): string[] {
	return (def.nextSteps ?? []).map(step => interpolate(step, vars));
}
