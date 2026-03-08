/**
 * scaffold-schema.ts — Validation for scaffold definitions.
 *
 * Pure functions that validate raw JSON against the ScaffoldDefinition shape.
 * Returns an array of error messages (empty = valid).
 */

import type { ScaffoldDefinition } from "./scaffold-types.js";

/** Validate a raw object as a ScaffoldDefinition. */
export function validateDefinition(raw: unknown, knownTemplateIds?: string[]): string[] {
	const errors: string[] = [];

	if (!raw || typeof raw !== "object") {
		return ["Definition must be a non-null object."];
	}

	const def = raw as Record<string, unknown>;

	validateRequiredStrings(def, errors);
	validatePackage(def, errors);
	validateFiles(def, knownTemplateIds, errors);
	validatePrompts(def, errors);
	validateOptionalArray(def, "directories", errors);
	validateOptionalArray(def, "nextSteps", errors);

	return errors;
}

function validateRequiredStrings(def: Record<string, unknown>, errors: string[]): void {
	for (const field of ["id", "label", "description"] as const) {
		if (typeof def[field] !== "string" || (def[field] as string).length === 0) {
			errors.push(`Missing or empty required field: "${field}".`);
		}
	}
}

function validatePackage(def: Record<string, unknown>, errors: string[]): void {
	if (!def.package || typeof def.package !== "object") {
		errors.push('Missing required field: "package".');
		return;
	}
	const pkg = def.package as Record<string, unknown>;
	if (!pkg.scripts || typeof pkg.scripts !== "object") {
		errors.push('Missing "package.scripts".');
	}
	if (!pkg.devDependencies || typeof pkg.devDependencies !== "object") {
		errors.push('Missing "package.devDependencies".');
	}
}

function validateFiles(def: Record<string, unknown>, knownTemplateIds: string[] | undefined, errors: string[]): void {
	if (!Array.isArray(def.files)) {
		errors.push('Missing required field: "files" (must be an array).');
		return;
	}
	const paths = new Set<string>();
	for (let i = 0; i < (def.files as unknown[]).length; i++) {
		const entry = (def.files as unknown[])[i] as Record<string, unknown>;
		if (!entry || typeof entry !== "object") {
			errors.push(`files[${i}]: must be an object.`);
			continue;
		}
		validateFilePath(entry, i, paths, errors);
		validateFileTemplate(entry, i, knownTemplateIds, errors);
	}
}

function validateFilePath(entry: Record<string, unknown>, i: number, paths: Set<string>, errors: string[]): void {
	if (typeof entry.path !== "string" || entry.path.length === 0) {
		errors.push(`files[${i}]: missing "path".`);
	} else if (paths.has(entry.path as string)) {
		errors.push(`files[${i}]: duplicate path "${entry.path}".`);
	} else {
		paths.add(entry.path as string);
	}
}

function validateFileTemplate(entry: Record<string, unknown>, i: number, knownTemplateIds: string[] | undefined, errors: string[]): void {
	if (typeof entry.templateId !== "string" || entry.templateId.length === 0) {
		errors.push(`files[${i}]: missing "templateId".`);
	} else if (knownTemplateIds && !knownTemplateIds.includes(entry.templateId as string)) {
		errors.push(`files[${i}]: unknown templateId "${entry.templateId}".`);
	}
}

function validatePrompts(def: Record<string, unknown>, errors: string[]): void {
	if (def.prompts !== undefined && !Array.isArray(def.prompts)) {
		errors.push('"prompts" must be an array.');
		return;
	}
	if (!Array.isArray(def.prompts)) return;
	for (let i = 0; i < (def.prompts as unknown[]).length; i++) {
		const prompt = (def.prompts as unknown[])[i] as Record<string, unknown>;
		if (typeof prompt?.variable !== "string") {
			errors.push(`prompts[${i}]: missing "variable".`);
		}
		if (typeof prompt?.label !== "string") {
			errors.push(`prompts[${i}]: missing "label".`);
		}
	}
}

function validateOptionalArray(def: Record<string, unknown>, field: string, errors: string[]): void {
	if (def[field] !== undefined && !Array.isArray(def[field])) {
		errors.push(`"${field}" must be an array.`);
	}
}

/** Type guard: validates and narrows to ScaffoldDefinition. */
export function isValidDefinition(raw: unknown, knownTemplateIds?: string[]): raw is ScaffoldDefinition {
	return validateDefinition(raw, knownTemplateIds).length === 0;
}
