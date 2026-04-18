import type { Result } from '../shared/result.js';
import type { Field, FieldKind, FieldValue } from './type-schema.js';
import type { FieldError, SchemaError } from './errors.js';

export type FieldKindSpec<K extends FieldKind> = {
	readonly kind: K;
	readonly defaultField: (name: string) => Extract<Field, { kind: K }>;
	readonly validateField: (field: Extract<Field, { kind: K }>) => readonly SchemaError[];
	/**
	 * Validate a raw value against this kind.
	 *
	 * **Empty-value contract differs by kind** because FieldValue has no null variant:
	 * - text/list: return `ok` with an empty sentinel (`''` / `[]`) when optional + empty.
	 * - number/date/datetime: return `err(invalid-*)` — the form layer MUST strip
	 *   optional absent/empty values before calling this. The validator is strict.
	 * - required + empty always returns `err(required-missing)` regardless of kind.
	 *
	 * Slice 4 (instance form submission) owns the pre-strip responsibility.
	 */
	readonly validateValue: (field: Extract<Field, { kind: K }>, raw: unknown) => Result<Extract<FieldValue, { kind: K }>, FieldError>;
	readonly toFrontmatter: (value: Extract<FieldValue, { kind: K }>) => unknown;
	readonly fromFrontmatter: (field: Extract<Field, { kind: K }>, raw: unknown) => Result<Extract<FieldValue, { kind: K }>, FieldError>;
};
