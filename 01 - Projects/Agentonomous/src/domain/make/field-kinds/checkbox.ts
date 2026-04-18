import { err, ok } from '../../shared/result.js';
import type { Field, FieldValue } from '../type-schema.js';
import type { FieldError, SchemaError } from '../errors.js';
import type { Result } from '../../shared/result.js';

type CheckboxField = Extract<Field, { kind: 'checkbox' }>;
type CheckboxValue = Extract<FieldValue, { kind: 'checkbox' }>;

export const CHECKBOX_FIELD_KIND = {
	kind: 'checkbox' as const,
	defaultField: (name: string): CheckboxField => ({ kind: 'checkbox', name, required: false }),
	validateField: (_field: CheckboxField): readonly SchemaError[] => [],
	validateValue: (field: CheckboxField, raw: unknown): Result<CheckboxValue, FieldError> => {
		if (raw === undefined || raw === null) return ok({ kind: 'checkbox', value: false });
		if (typeof raw !== 'boolean') return err({ kind: 'invalid-boolean', fieldName: field.name });
		return ok({ kind: 'checkbox', value: raw });
	},
	toFrontmatter: (value: CheckboxValue): unknown => value.value,
	fromFrontmatter: (field: CheckboxField, raw: unknown): Result<CheckboxValue, FieldError> => {
		if (raw === undefined || raw === null) return ok({ kind: 'checkbox', value: false });
		if (typeof raw !== 'boolean') return err({ kind: 'invalid-boolean', fieldName: field.name });
		return ok({ kind: 'checkbox', value: raw });
	},
};
