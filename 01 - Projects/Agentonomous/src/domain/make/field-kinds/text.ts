import { err, ok } from '../../shared/result.js';
import type { Field, FieldValue } from '../type-schema.js';
import type { FieldError, SchemaError } from '../errors.js';
import type { Result } from '../../shared/result.js';

type TextField = Extract<Field, { kind: 'text' }>;
type TextValue = Extract<FieldValue, { kind: 'text' }>;

export const TEXT_FIELD_KIND = {
	kind: 'text' as const,
	defaultField: (name: string): TextField => ({ kind: 'text', name, required: false }),
	validateField: (_field: TextField): readonly SchemaError[] => [],
	validateValue: (field: TextField, raw: unknown): Result<TextValue, FieldError> => {
		if (typeof raw !== 'string') return err({ kind: 'invalid-text', fieldName: field.name });
		if (field.required && raw.trim() === '') return err({ kind: 'required-missing', fieldName: field.name });
		return ok({ kind: 'text', value: raw });
	},
	toFrontmatter: (value: TextValue): unknown => value.value,
	fromFrontmatter: (field: TextField, raw: unknown): Result<TextValue, FieldError> => {
		if (typeof raw !== 'string') return err({ kind: 'invalid-text', fieldName: field.name });
		return ok({ kind: 'text', value: raw });
	},
};
