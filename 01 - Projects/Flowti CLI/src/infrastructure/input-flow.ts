/**
 * input-flow.ts — Declarative field collection for sitemap-driven forms.
 *
 * Provides a factory that takes a field definition array and a submit handler,
 * returning an ActionHandler-compatible function. This replaces hand-rolled
 * interactive flows (ask name, ask domain, ask version…) with a declarative
 * schema that can be driven from sitemap JSON.
 */

import type { IInput } from "./types.js";

// ── Field definitions ───────────────────────────────────────────────

export interface TextField {
	readonly type: "text";
	readonly name: string;
	readonly label: string;
	readonly default?: string;
	readonly required?: boolean;
}

export interface BooleanField {
	readonly type: "boolean";
	readonly name: string;
	readonly label: string;
	readonly default?: boolean;
}

export interface SelectField {
	readonly type: "select";
	readonly name: string;
	readonly label: string;
	readonly options: readonly { readonly key: string; readonly label: string; readonly value: string }[];
	readonly default?: string;
}

export type InputField = TextField | BooleanField | SelectField;

// ── Collected values ────────────────────────────────────────────────

export type InputFlowValues = Record<string, string | boolean>;

// ── Flow runner ─────────────────────────────────────────────────────

export interface InputFlowResult {
	readonly submitted: boolean;
	readonly values: InputFlowValues;
}

/**
 * Run a declarative input flow — prompt for each field in sequence.
 *
 * Returns `{ submitted: true, values }` when all fields are collected,
 * or `{ submitted: false, values: {} }` if the user cancels (empty
 * required field).
 */
export async function runInputFlow(
	fields: readonly InputField[],
	inputAdapter: IInput,
): Promise<InputFlowResult> {
	const values: InputFlowValues = {};

	for (const field of fields) {
		const collected = await collectField(field, inputAdapter);
		if (collected === null) return { submitted: false, values: {} };
		values[field.name] = collected;
	}

	return { submitted: true, values };
}

async function collectField(field: InputField, inputAdapter: IInput): Promise<string | boolean | null> {
	switch (field.type) {
		case "text": {
			const answer = await inputAdapter.ask(field.label, field.default ?? "");
			if (field.required && !answer) return null;
			return answer;
		}
		case "boolean": {
			return inputAdapter.askYesNo(field.label, !field.default);
		}
		case "select": {
			const optionLines = field.options.map((o) => `    ${o.key}) ${o.label}`).join("\n");
			const defaultKey = field.default ?? field.options[0]?.key ?? "";
			const keysLabel = field.options.map((o) => o.key).join("/");
			const answer = await inputAdapter.ask(
				`${field.label} (${keysLabel})\n${optionLines}\n  Choice`,
				defaultKey,
			);
			const selected = field.options.find((o) => o.key === answer);
			return selected?.value ?? field.options[0]?.value ?? "";
		}
	}
}

/**
 * Factory: create an input-flow action handler.
 *
 * Usage in handler registration:
 * ```ts
 * registry.registerAction("add-event", createInputFlowHandler(
 *   [{ type: "text", name: "name", label: "Event name", required: true }],
 *   async (values, ctx) => { createEvent(values.name as string, ...); },
 * ));
 * ```
 */
export function createInputFlowHandler(
	fields: readonly InputField[],
	onSubmit: (values: InputFlowValues) => void | Promise<void>,
): (inputAdapter: IInput) => Promise<boolean> {
	return async (inputAdapter) => {
		const result = await runInputFlow(fields, inputAdapter);
		if (!result.submitted) return false;
		await onSubmit(result.values);
		return true;
	};
}
