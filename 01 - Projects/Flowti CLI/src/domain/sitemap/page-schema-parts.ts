/**
 * page-schema-parts.ts — Sub-validators for page-schema.ts.
 *
 * Extracted to keep page-schema.ts under the line limit
 * while maintaining low cyclomatic complexity per function.
 */

import { FIELD_TYPES } from "./unified-page.js";
import type { FieldType } from "./unified-page.js";

// ── Children validation ─────────────────────────────────────────────

export function validateChildren(
	prefix: string, children: unknown[], allPageIds: Set<string>,
	warnings: string[],
): void {
	for (let i = 0; i < children.length; i++) {
		const raw = children[i];
		const cp = `${prefix}.children[${i}]`;

		if (!raw || typeof raw !== "object") {
			warnings.push(`${cp}: must be an object.`);
			continue;
		}

		const child = raw as Record<string, unknown>;

		if (typeof child.ref !== "string" || child.ref.length === 0) {
			warnings.push(`${cp}: missing or empty "ref".`);
		} else if (!allPageIds.has(child.ref)) {
			warnings.push(`${cp}: ref "${child.ref}" does not reference a known page.`);
		}
	}
}

// ── Data source validation ──────────────────────────────────────────

export function validateDataSources(prefix: string, sources: unknown[], errors: string[]): void {
	for (let i = 0; i < sources.length; i++) {
		const raw = sources[i];
		const dp = `${prefix}.dataSources[${i}]`;

		if (!raw || typeof raw !== "object") {
			errors.push(`${dp}: must be an object.`);
			continue;
		}

		const ds = raw as Record<string, unknown>;
		if (typeof ds.id !== "string" || ds.id.length === 0) {
			errors.push(`${dp}: missing or empty "id".`);
		}
	}
}

// ── Validation rules validation ─────────────────────────────────────

const VALID_VALIDATION_RULES = ["required", "min", "max", "minLength", "maxLength", "pattern", "custom"];

export function validateValidationRules(prefix: string, rules: unknown[], errors: string[]): void {
	for (let i = 0; i < rules.length; i++) {
		const raw = rules[i];
		const rp = `${prefix}.validation[${i}]`;

		if (!raw || typeof raw !== "object") {
			errors.push(`${rp}: must be an object.`);
			continue;
		}

		const rule = raw as Record<string, unknown>;

		if (typeof rule.field !== "string") {
			errors.push(`${rp}: missing "field".`);
		}

		if (!VALID_VALIDATION_RULES.includes(rule.rule as string)) {
			errors.push(`${rp}: unknown rule "${rule.rule}". Valid: ${VALID_VALIDATION_RULES.join(", ")}.`);
		}

		if (typeof rule.message !== "string") {
			errors.push(`${rp}: missing "message".`);
		}
	}
}

// ── Event declarations validation ───────────────────────────────────

export function validateEventDeclarations(
	prefix: string, field: string, raw: unknown, errors: string[],
): void {
	if (!Array.isArray(raw)) {
		errors.push(`${prefix}: "${field}" must be an array.`);
		return;
	}

	for (let i = 0; i < (raw as unknown[]).length; i++) {
		const entry = (raw as unknown[])[i];
		const ep = `${prefix}.${field}[${i}]`;

		if (!entry || typeof entry !== "object") {
			errors.push(`${ep}: must be an object.`);
			continue;
		}

		if (typeof (entry as Record<string, unknown>).name !== "string") {
			errors.push(`${ep}: missing "name".`);
		}
	}
}

// ── Properties / Variants / States validation ───────────────────────

export function validateProperties(prefix: string, raw: unknown, warnings: string[]): void {
	if (!Array.isArray(raw)) { warnings.push(`${prefix}: "properties" must be an array.`); return; }
	const validTypes = ["string", "number", "boolean"];
	for (let i = 0; i < (raw as unknown[]).length; i++) {
		const p = (raw as unknown[])[i] as Record<string, unknown>;
		if (!p || typeof p !== "object") { warnings.push(`${prefix}.properties[${i}]: must be an object.`); continue; }
		if (typeof p.key !== "string") warnings.push(`${prefix}.properties[${i}]: missing "key".`);
		if (!validTypes.includes(p.type as string)) warnings.push(`${prefix}.properties[${i}]: "type" must be string, number, or boolean.`);
	}
}

export function validateVariants(prefix: string, raw: unknown, warnings: string[]): void {
	if (!Array.isArray(raw)) { warnings.push(`${prefix}: "variants" must be an array.`); return; }
	for (let i = 0; i < (raw as unknown[]).length; i++) {
		const v = (raw as unknown[])[i] as Record<string, unknown>;
		if (!v || typeof v !== "object") { warnings.push(`${prefix}.variants[${i}]: must be an object.`); continue; }
		if (typeof v.name !== "string") warnings.push(`${prefix}.variants[${i}]: missing "name".`);
		if (!v.props || typeof v.props !== "object") warnings.push(`${prefix}.variants[${i}]: missing "props".`);
	}
}

export function validateStates(prefix: string, raw: unknown, warnings: string[]): void {
	if (!Array.isArray(raw)) { warnings.push(`${prefix}: "states" must be an array.`); return; }
	for (let i = 0; i < (raw as unknown[]).length; i++) {
		const s = (raw as unknown[])[i] as Record<string, unknown>;
		if (!s || typeof s !== "object") { warnings.push(`${prefix}.states[${i}]: must be an object.`); continue; }
		if (typeof s.name !== "string") warnings.push(`${prefix}.states[${i}]: missing "name".`);
	}
}

// ── Field validation ────────────────────────────────────────────────

export function validateFields(
	prefix: string, fields: unknown[],
	errors: string[], _warnings: string[],
): void {
	const names = new Set<string>();

	for (let i = 0; i < fields.length; i++) {
		const raw = fields[i];
		const fp = `${prefix}.fields[${i}]`;

		if (!raw || typeof raw !== "object") {
			errors.push(`${fp}: must be an object.`);
			continue;
		}

		const field = raw as Record<string, unknown>;
		validateSingleField(fp, field, names, errors);
	}
}

function validateSingleField(
	fp: string, field: Record<string, unknown>,
	names: Set<string>, errors: string[],
): void {
	if (typeof field.name !== "string" || field.name.length === 0) {
		errors.push(`${fp}: missing or empty "name".`);
	} else {
		if (names.has(field.name)) {
			errors.push(`${fp}: duplicate field name "${field.name}".`);
		}
		names.add(field.name);
	}

	if (typeof field.label !== "string" || field.label.length === 0) {
		errors.push(`${fp}: missing or empty "label".`);
	}

	if (!FIELD_TYPES.includes(field.type as FieldType)) {
		errors.push(`${fp}: unknown field type "${field.type}". Valid: ${FIELD_TYPES.join(", ")}.`);
	}

	if ((field.type === "select" || field.type === "radio") && !Array.isArray(field.options)) {
		errors.push(`${fp}: select/radio fields must have an "options" array.`);
	}

	validateFieldOptions(fp, field, errors);
}

function validateFieldOptions(fp: string, field: Record<string, unknown>, errors: string[]): void {
	if (!Array.isArray(field.options)) return;

	for (let j = 0; j < (field.options as unknown[]).length; j++) {
		const opt = (field.options as unknown[])[j];
		if (!opt || typeof opt !== "object") {
			errors.push(`${fp}.options[${j}]: must be an object.`);
			continue;
		}
		const o = opt as Record<string, unknown>;
		if (typeof o.value !== "string") errors.push(`${fp}.options[${j}]: missing "value".`);
		if (typeof o.label !== "string") errors.push(`${fp}.options[${j}]: missing "label".`);
	}
}
