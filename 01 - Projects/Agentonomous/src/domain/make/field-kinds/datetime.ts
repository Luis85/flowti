import { err, ok } from '../../shared/result.js';
import type { Field, FieldValue } from '../type-schema.js';
import type { FieldError, SchemaError } from '../errors.js';
import type { Result } from '../../shared/result.js';

type DatetimeField = Extract<Field, { kind: 'datetime' }>;
type DatetimeValue = Extract<FieldValue, { kind: 'datetime' }>;

const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?$/;

function parseDatetime(raw: string): Date | null {
	if (!ISO_RE.test(raw)) return null;
	const d = new Date(raw);
	if (Number.isNaN(d.getTime())) return null;
	return d;
}

function formatLocalIso(d: Date): string {
	// Keep local offset: YYYY-MM-DDTHH:mm:ss±HH:MM
	const pad = (n: number): string => String(n).padStart(2, '0');
	const tzMin = -d.getTimezoneOffset();
	const sign = tzMin >= 0 ? '+' : '-';
	const abs = Math.abs(tzMin);
	const tz = `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${tz}`;
}

export const DATETIME_FIELD_KIND = {
	kind: 'datetime' as const,
	defaultField: (name: string): DatetimeField => ({ kind: 'datetime', name, required: false }),
	validateField: (_field: DatetimeField): readonly SchemaError[] => [],
	validateValue: (field: DatetimeField, raw: unknown): Result<DatetimeValue, FieldError> => {
		if (raw === undefined || raw === null || raw === '') {
			if (field.required) return err({ kind: 'required-missing', fieldName: field.name });
			return err({ kind: 'invalid-datetime', fieldName: field.name, expected: 'ISO-8601' });
		}
		if (raw instanceof Date) {
			if (Number.isNaN(raw.getTime())) return err({ kind: 'invalid-datetime', fieldName: field.name, expected: 'ISO-8601' });
			return ok({ kind: 'datetime', value: raw });
		}
		if (typeof raw !== 'string') return err({ kind: 'invalid-datetime', fieldName: field.name, expected: 'ISO-8601' });
		const parsed = parseDatetime(raw);
		if (parsed === null) return err({ kind: 'invalid-datetime', fieldName: field.name, expected: 'ISO-8601' });
		return ok({ kind: 'datetime', value: parsed });
	},
	toFrontmatter: (value: DatetimeValue): unknown => formatLocalIso(value.value),
	fromFrontmatter: (field: DatetimeField, raw: unknown): Result<DatetimeValue, FieldError> => {
		if (raw instanceof Date) return ok({ kind: 'datetime', value: raw });
		if (typeof raw !== 'string') return err({ kind: 'invalid-datetime', fieldName: field.name, expected: 'ISO-8601' });
		const parsed = parseDatetime(raw);
		if (parsed === null) return err({ kind: 'invalid-datetime', fieldName: field.name, expected: 'ISO-8601' });
		return ok({ kind: 'datetime', value: parsed });
	},
};
