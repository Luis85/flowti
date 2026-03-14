/**
 * form-runner.ts — Generic CLI form engine driven by FormField definitions.
 *
 * Reads a `FormField[]` array from a PageObject (kind: "form"),
 * prompts the user sequentially via `IInput`, validates, and
 * returns the collected data as `Record<string, unknown>`.
 *
 * Supports HTML input types mapped to CLI equivalents:
 * - text/email/url/tel/password → IInput.ask()
 * - number/range → IInput.ask() + parseFloat
 * - select/radio → numbered option picker
 * - checkbox/toggle → IInput.askYesNo()
 * - textarea → IInput.ask() (single-line in CLI)
 * - date/datetime-local/time → IInput.ask() with format hint
 * - hidden → skipped (uses defaultValue)
 * - file/color → IInput.ask() (raw string in CLI)
 */

import type { FormField, FieldType, ValidationRule } from "../domain/sitemap/unified-page.js";
import type { IInput } from "./types.js";

export type FormData = Record<string, unknown>;

export interface FormRunnerDeps {
	readonly input: IInput;
	readonly log: (msg?: string) => void;
}

/** Result of running a form. `null` if the user cancelled. */
export type FormResult = FormData | null;

/**
 * Run an interactive form in the CLI.
 *
 * Prompts the user for each visible field, validates input,
 * and returns the collected data. Returns `null` if a required
 * field is left empty (user cancelled).
 */
export async function runForm(
	fields: readonly FormField[],
	validation: readonly ValidationRule[] | undefined,
	deps: FormRunnerDeps,
): Promise<FormResult> {
	const data: FormData = {};

	for (const field of fields) {
		if (field.type === "hidden") {
			data[field.name] = field.defaultValue ?? "";
			continue;
		}

		const value = await promptField(field, deps);

		if (value === null) {
			if (field.required) return null;
			continue;
		}

		data[field.name] = value;
	}

	if (validation) {
		const errors = validateForm(data, validation);
		if (errors.length > 0) {
			for (const err of errors) deps.log(`  ${err}`);
			return null;
		}
	}

	return data;
}

// ── Field prompting ─────────────────────────────────────────────────

async function promptField(field: FormField, deps: FormRunnerDeps): Promise<unknown | null> {
	switch (classifyField(field.type)) {
		case "text":
			return promptText(field, deps);
		case "number":
			return promptNumber(field, deps);
		case "select":
			return promptSelect(field, deps);
		case "boolean":
			return promptBoolean(field, deps);
	}
}

type FieldClass = "text" | "number" | "select" | "boolean";

function classifyField(type: FieldType): FieldClass {
	switch (type) {
		case "number": case "range":
			return "number";
		case "select": case "radio":
			return "select";
		case "checkbox": case "toggle":
			return "boolean";
		default:
			return "text";
	}
}

async function promptText(field: FormField, deps: FormRunnerDeps): Promise<string | null> {
	const hint = formatHint(field);
	const defaultStr = field.defaultValue !== undefined ? String(field.defaultValue) : undefined;
	const label = hint ? `${field.label} ${hint}` : field.label;
	const value = await deps.input.ask(label, defaultStr);

	if (!value && field.required) return null;

	const error = validateTextConstraints(field, value);
	if (error) { deps.log(`  ${error}`); return null; }

	return value || (field.defaultValue !== undefined ? String(field.defaultValue) : "");
}

function validateTextConstraints(field: FormField, value: string): string | null {
	if (value && field.pattern && !new RegExp(field.pattern).test(value)) {
		return `Invalid format for ${field.label}.`;
	}
	if (value && field.minLength !== undefined && value.length < field.minLength) {
		return `${field.label} must be at least ${field.minLength} characters.`;
	}
	if (value && field.maxLength !== undefined && value.length > field.maxLength) {
		return `${field.label} must be at most ${field.maxLength} characters.`;
	}
	return null;
}

async function promptNumber(field: FormField, deps: FormRunnerDeps): Promise<number | null> {
	const defaultStr = field.defaultValue !== undefined ? String(field.defaultValue) : undefined;
	const raw = await deps.input.ask(field.label, defaultStr);

	if (!raw && field.required) return null;
	if (!raw) return field.defaultValue !== undefined ? Number(field.defaultValue) : null;

	const num = parseFloat(raw);
	if (isNaN(num)) { deps.log(`  ${field.label} must be a number.`); return null; }

	const error = validateNumberRange(field, num);
	if (error) { deps.log(`  ${error}`); return null; }

	return num;
}

function validateNumberRange(field: FormField, num: number): string | null {
	if (field.min !== undefined && num < field.min) {
		return `${field.label} must be at least ${field.min}.`;
	}
	if (field.max !== undefined && num > field.max) {
		return `${field.label} must be at most ${field.max}.`;
	}
	return null;
}

async function promptSelect(field: FormField, deps: FormRunnerDeps): Promise<string | null> {
	if (!field.options || field.options.length === 0) {
		deps.log(`  No options available for ${field.label}.`);
		return null;
	}

	const available = field.options.filter((o) => !o.disabled);
	renderSelectOptions(field, available, deps);

	const defaultIdx = resolveDefaultIndex(field, available);
	const raw = await deps.input.ask("Select", defaultIdx);

	if (!raw && field.required) return null;
	if (!raw && field.defaultValue !== undefined) return String(field.defaultValue);

	const idx = parseInt(raw, 10) - 1;
	if (isNaN(idx) || idx < 0 || idx >= available.length) {
		deps.log(`  Invalid selection.`);
		return null;
	}

	return available[idx].value;
}

function renderSelectOptions(
	field: FormField, available: readonly { value: string; label: string }[],
	deps: FormRunnerDeps,
): void {
	deps.log();
	deps.log(`  ${field.label}:`);
	for (let i = 0; i < available.length; i++) {
		const marker = available[i].value === field.defaultValue ? " (default)" : "";
		deps.log(`    ${i + 1}. ${available[i].label}${marker}`);
	}
}

function resolveDefaultIndex(
	field: FormField, available: readonly { value: string }[],
): string {
	if (field.defaultValue === undefined) return "1";
	const found = available.findIndex((o) => o.value === String(field.defaultValue)) + 1;
	return found !== 0 ? String(found) : "1";
}

async function promptBoolean(field: FormField, deps: FormRunnerDeps): Promise<boolean> {
	const defaultNo = field.defaultValue === false || field.defaultValue === undefined;
	return deps.input.askYesNo(field.label, defaultNo);
}

// ── Hints ───────────────────────────────────────────────────────────

function formatHint(field: FormField): string {
	switch (field.type) {
		case "date": return "(YYYY-MM-DD)";
		case "datetime-local": return "(YYYY-MM-DDTHH:mm)";
		case "time": return "(HH:mm)";
		case "email": return "(email)";
		case "url": return "(URL)";
		case "tel": return "(phone)";
		default: return field.placeholder ? `(${field.placeholder})` : "";
	}
}

// ── Validation ──────────────────────────────────────────────────────

export function validateForm(data: FormData, rules: readonly ValidationRule[]): string[] {
	const errors: string[] = [];
	for (const rule of rules) {
		if (isRuleViolated(data[rule.field], rule)) {
			errors.push(rule.message);
		}
	}
	return errors;
}

function isRuleViolated(value: unknown, rule: ValidationRule): boolean {
	switch (rule.rule) {
		case "required":
			return value === undefined || value === null || value === "";
		case "min":
			return isNumberBelow(value, rule.value);
		case "max":
			return isNumberAbove(value, rule.value);
		case "minLength":
			return isStringShorterThan(value, rule.value);
		case "maxLength":
			return isStringLongerThan(value, rule.value);
		case "pattern":
			return isPatternMismatch(value, rule.value);
		case "custom":
			return false;
	}
}

function isNumberBelow(value: unknown, limit: unknown): boolean {
	return typeof value === "number" && limit !== undefined && value < Number(limit);
}

function isNumberAbove(value: unknown, limit: unknown): boolean {
	return typeof value === "number" && limit !== undefined && value > Number(limit);
}

function isStringShorterThan(value: unknown, limit: unknown): boolean {
	return typeof value === "string" && limit !== undefined && value.length < Number(limit);
}

function isStringLongerThan(value: unknown, limit: unknown): boolean {
	return typeof value === "string" && limit !== undefined && value.length > Number(limit);
}

function isPatternMismatch(value: unknown, pattern: unknown): boolean {
	return typeof value === "string" && pattern !== undefined && !new RegExp(String(pattern)).test(value);
}
