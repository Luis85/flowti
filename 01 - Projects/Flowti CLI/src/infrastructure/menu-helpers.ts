/**
 * menu-helpers.ts — Reusable interactive prompt utilities for menus.
 *
 * Three lightweight helpers that eliminate boilerplate across CRUD menus:
 *   - collectFields()  — sequential field prompting with required/optional
 *   - selectFromList()  — numbered list picker
 *   - selectStatus()    — status enum picker
 *
 * All helpers take deps as arguments (no singleton imports).
 */

import type { IInput } from "./types.js";

// ── Field Collection ────────────────────────────────────────────────

export interface FieldDef {
	/** Key in the result record. */
	readonly key: string;
	/** Label shown to the user. */
	readonly label: string;
	/** If true, empty input cancels the entire form (returns null). */
	readonly required?: boolean;
	/** Default value — string or function returning a string. */
	readonly default?: string | (() => string);
}

/**
 * Prompt the user for each field sequentially.
 *
 * Returns a record of key→value, or null if a required field was left empty.
 * Optional fields that are left empty appear as empty strings.
 */
export async function collectFields(
	fields: readonly FieldDef[],
	input: IInput,
): Promise<Record<string, string> | null> {
	const result: Record<string, string> = {};

	for (const field of fields) {
		const defaultValue = typeof field.default === "function" ? field.default() : field.default;
		const value = await input.ask(field.label, defaultValue);

		if (!value && field.required) return null;
		result[field.key] = value;
	}

	return result;
}

// ── List Selector ───────────────────────────────────────────────────

export interface SelectOptions<T> {
	/** Format a single item for display (receives item and 0-based index). */
	readonly format: (item: T, index: number) => string;
	/** Prompt text shown to the user. Default: "Select (number)". */
	readonly prompt?: string;
	/** Message when the list is empty. Default: "No items found.". */
	readonly emptyMessage?: string;
}

/**
 * Display a numbered list and let the user pick one.
 *
 * Returns the selected item, or null if the list is empty or selection is invalid.
 */
export async function selectFromList<T>(
	items: readonly T[],
	deps: { readonly input: IInput; readonly log: (msg: string) => void },
	options: SelectOptions<T>,
): Promise<T | null> {
	if (items.length === 0) {
		deps.log(`\n  ${options.emptyMessage ?? "No items found."}\n`);
		return null;
	}

	for (let i = 0; i < items.length; i++) {
		deps.log(`  ${i + 1}. ${options.format(items[i], i)}`);
	}

	const choice = await deps.input.ask(options.prompt ?? "Select (number)");
	const idx = parseInt(choice, 10) - 1;
	if (isNaN(idx) || idx < 0 || idx >= items.length) return null;

	return items[idx];
}

// ── Status Picker ───────────────────────────────────────────────────

/**
 * Show available statuses and let the user pick one.
 *
 * Returns the new status, or null if the input doesn't match.
 */
export async function selectStatus<S extends string>(
	statuses: readonly S[],
	currentStatus: S,
	deps: { readonly input: IInput; readonly log: (msg: string) => void },
): Promise<S | null> {
	deps.log(`\n  Statuses: ${statuses.join(", ")}`);
	const newStatus = await deps.input.ask("New status", currentStatus) as S;
	if (!statuses.includes(newStatus)) {
		deps.log(`\n  Invalid status: "${newStatus}"\n`);
		return null;
	}
	return newStatus;
}
