import { err, ok } from '../../shared/result.js';
import type { Field, FieldValue } from '../type-schema.js';
import type { FieldError, SchemaError } from '../errors.js';
import type { Result } from '../../shared/result.js';

type DateField = Extract<Field, { kind: 'date' }>;
type DateValue = Extract<FieldValue, { kind: 'date' }>;

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseLocalDate(raw: string): Date | null {
	const m = DATE_RE.exec(raw);
	if (m === null) return null;
	const year = Number(m[1]);
	const month = Number(m[2]);
	const day = Number(m[3]);
	if (month < 1 || month > 12) return null;
	if (day < 1 || day > 31) return null;
	const d = new Date(year, month - 1, day);
	if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
	return d;
}

function formatLocalDate(d: Date): string {
	const y = String(d.getFullYear()).padStart(4, '0');
	const m = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${y}-${m}-${day}`;
}

export const DATE_FIELD_KIND = {
	kind: 'date' as const,
	defaultField: (name: string): DateField => ({ kind: 'date', name, required: false }),
	validateField: (_field: DateField): readonly SchemaError[] => [],
	validateValue: (field: DateField, raw: unknown): Result<DateValue, FieldError> => {
		if (raw === undefined || raw === null || raw === '') {
			if (field.required) return err({ kind: 'required-missing', fieldName: field.name });
			return err({ kind: 'invalid-date', fieldName: field.name, expected: 'YYYY-MM-DD' });
		}
		if (raw instanceof Date) {
			if (Number.isNaN(raw.getTime())) return err({ kind: 'invalid-date', fieldName: field.name, expected: 'YYYY-MM-DD' });
			return ok({ kind: 'date', value: new Date(raw.getFullYear(), raw.getMonth(), raw.getDate()) });
		}
		if (typeof raw !== 'string') return err({ kind: 'invalid-date', fieldName: field.name, expected: 'YYYY-MM-DD' });
		const parsed = parseLocalDate(raw);
		if (parsed === null) return err({ kind: 'invalid-date', fieldName: field.name, expected: 'YYYY-MM-DD' });
		return ok({ kind: 'date', value: parsed });
	},
	toFrontmatter: (value: DateValue): unknown => formatLocalDate(value.value),
	fromFrontmatter: (field: DateField, raw: unknown): Result<DateValue, FieldError> => {
		if (raw instanceof Date) return ok({ kind: 'date', value: raw });
		if (typeof raw !== 'string') return err({ kind: 'invalid-date', fieldName: field.name, expected: 'YYYY-MM-DD' });
		const parsed = parseLocalDate(raw);
		if (parsed === null) return err({ kind: 'invalid-date', fieldName: field.name, expected: 'YYYY-MM-DD' });
		return ok({ kind: 'date', value: parsed });
	},
};
