import type { Field } from './type-schema.js';

export type Draft = {
	readonly name: string;
	readonly description: string;
	readonly instancesFolder: string;
	readonly titleFieldName: string | null;
	readonly fields: readonly Field[];
};

export function deepEqualDraft(a: Draft, b: Draft): boolean {
	if (a.name !== b.name) return false;
	if (a.description !== b.description) return false;
	if (a.instancesFolder !== b.instancesFolder) return false;
	if (a.titleFieldName !== b.titleFieldName) return false;
	if (a.fields.length !== b.fields.length) return false;
	for (let i = 0; i < a.fields.length; i++) {
		if (!fieldsEqual(a.fields[i]!, b.fields[i]!)) return false;
	}
	return true;
}

function fieldsEqual(a: Field, b: Field): boolean {
	const scalarsEqual =
		a.kind === b.kind &&
		a.name === b.name &&
		a.required === b.required &&
		(a.label ?? undefined) === (b.label ?? undefined) &&
		(a.description ?? undefined) === (b.description ?? undefined);
	if (!scalarsEqual) return false;
	// Per-kind defaults: use JSON compare — defaults are simple scalars or readonly string arrays.
	return JSON.stringify((a as { default?: unknown }).default) === JSON.stringify((b as { default?: unknown }).default);
}
