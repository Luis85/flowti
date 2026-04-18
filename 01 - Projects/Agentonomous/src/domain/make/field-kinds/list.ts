import { err, ok } from '../../shared/result.js';
import type { Field, FieldValue } from '../type-schema.js';
import type { FieldError, SchemaError } from '../errors.js';
import type { Result } from '../../shared/result.js';

type ListField = Extract<Field, { kind: 'list' }>;
type ListValue = Extract<FieldValue, { kind: 'list' }>;

export const LIST_FIELD_KIND = {
	kind: 'list' as const,
	defaultField: (name: string): ListField => ({ kind: 'list', name, required: false }),
	validateField: (_field: ListField): readonly SchemaError[] => [],
	validateValue: (field: ListField, raw: unknown): Result<ListValue, FieldError> => {
		if (raw === undefined || raw === null) {
			if (field.required) return err({ kind: 'required-missing', fieldName: field.name });
			return ok({ kind: 'list', value: [] });
		}
		if (!Array.isArray(raw)) return err({ kind: 'invalid-list', fieldName: field.name });
		if (!raw.every((x): x is string => typeof x === 'string')) return err({ kind: 'invalid-list', fieldName: field.name });
		if (field.required && raw.length === 0) return err({ kind: 'required-missing', fieldName: field.name });
		return ok({ kind: 'list', value: [...raw] });
	},
	toFrontmatter: (value: ListValue): unknown => [...value.value],
	fromFrontmatter: (field: ListField, raw: unknown): Result<ListValue, FieldError> => {
		if (raw === undefined || raw === null) return ok({ kind: 'list', value: [] });
		if (!Array.isArray(raw)) return err({ kind: 'invalid-list', fieldName: field.name });
		if (!raw.every((x): x is string => typeof x === 'string')) return err({ kind: 'invalid-list', fieldName: field.name });
		return ok({ kind: 'list', value: [...raw] });
	},
};
