import type { Result } from '../shared/result.js';
import type { Field, FieldKind, FieldValue } from './type-schema.js';
import type { FieldError, SchemaError } from './errors.js';

export type FieldKindSpec<K extends FieldKind> = {
	readonly kind: K;
	readonly defaultField: (name: string) => Extract<Field, { kind: K }>;
	readonly validateField: (field: Extract<Field, { kind: K }>) => readonly SchemaError[];
	readonly validateValue: (field: Extract<Field, { kind: K }>, raw: unknown) => Result<Extract<FieldValue, { kind: K }>, FieldError>;
	readonly toFrontmatter: (value: Extract<FieldValue, { kind: K }>) => unknown;
	readonly fromFrontmatter: (field: Extract<Field, { kind: K }>, raw: unknown) => Result<Extract<FieldValue, { kind: K }>, FieldError>;
};
