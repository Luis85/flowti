import { err, ok } from '../../shared/result.js';
import type { Field, FieldValue } from '../type-schema.js';
import type { FieldError, SchemaError } from '../errors.js';
import type { Result } from '../../shared/result.js';

type NumberField = Extract<Field, { kind: 'number' }>;
type NumberValue = Extract<FieldValue, { kind: 'number' }>;

function parseNumber(raw: unknown): number | null {
	if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
	if (typeof raw === 'string') {
		const trimmed = raw.trim();
		if (trimmed === '') return null;
		const n = Number(trimmed);
		if (Number.isFinite(n)) return n;
	}
	return null;
}

export const NUMBER_FIELD_KIND = {
	kind: 'number' as const,
	defaultField: (name: string): NumberField => ({ kind: 'number', name, required: false }),
	validateField: (_field: NumberField): readonly SchemaError[] => [],
	validateValue: (field: NumberField, raw: unknown): Result<NumberValue, FieldError> => {
		if ((raw === undefined || raw === null || raw === '') && field.required) {
			return err({ kind: 'required-missing', fieldName: field.name });
		}
		const parsed = parseNumber(raw);
		if (parsed === null) return err({ kind: 'invalid-number', fieldName: field.name });
		return ok({ kind: 'number', value: parsed });
	},
	toFrontmatter: (value: NumberValue): unknown => value.value,
	fromFrontmatter: (field: NumberField, raw: unknown): Result<NumberValue, FieldError> => {
		const parsed = parseNumber(raw);
		if (parsed === null) return err({ kind: 'invalid-number', fieldName: field.name });
		return ok({ kind: 'number', value: parsed });
	},
};
