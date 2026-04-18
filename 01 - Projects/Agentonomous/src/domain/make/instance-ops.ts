import { err, ok, type Result } from '../shared/result.js';
import type { FieldValue, TypeSchema } from './type-schema.js';
import type { FieldError } from './errors.js';
import type { NonEmptyArray, ReadonlyRecord } from './types.js';
import { FIELD_KINDS } from './field-kinds/index.js';
import { sanitizeFilenameStem } from './sanitize-filename.js';

type RawValues = ReadonlyRecord<string, unknown>;

export function validateInstanceValues(schema: TypeSchema, raw: RawValues): Result<readonly FieldValue[], NonEmptyArray<FieldError>> {
	const out: FieldValue[] = [];
	const errors: FieldError[] = [];
	for (const field of schema.fields) {
		const spec = FIELD_KINDS[field.kind];
		const rawValue = (raw as Record<string, unknown>)[field.name];
		const r = spec.validateValue(field as never, rawValue);
		if (r.kind === 'err') errors.push(r.error);
		else out.push(r.value);
	}
	if (errors.length > 0) return err(errors as unknown as NonEmptyArray<FieldError>);
	return ok(out);
}

function yamlQuote(s: string): string {
	return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function emitScalar(v: unknown): string {
	if (typeof v === 'string') return yamlQuote(v);
	if (typeof v === 'number') return String(v);
	if (typeof v === 'boolean') return v ? 'true' : 'false';
	if (Array.isArray(v)) return `[${v.map((x) => emitScalar(x)).join(', ')}]`;
	return yamlQuote(String(v));
}

export function renderInstanceContent(schema: TypeSchema, values: readonly FieldValue[]): { readonly frontmatter: string; readonly body: string; readonly fullMarkdown: string } {
	const lines: string[] = ['---'];
	lines.push(`type: ${yamlQuote(schema.name)}`);
	lines.push(`type-id: ${yamlQuote(schema.id)}`);
	for (let i = 0; i < schema.fields.length; i += 1) {
		const field = schema.fields[i];
		const value = values[i];
		if (field === undefined || value === undefined) continue;
		const spec = FIELD_KINDS[field.kind];
		const emitted = spec.toFrontmatter(value as never);
		lines.push(`${field.name}: ${emitScalar(emitted)}`);
	}
	lines.push('---', '');
	const frontmatter = lines.join('\n');
	const body = '';
	return { frontmatter, body, fullMarkdown: `${frontmatter}\n` };
}

function findTitleValue(schema: TypeSchema, values: readonly FieldValue[]): string | null {
	if (schema.titleFieldName === null) return null;
	const idx = schema.fields.findIndex((f) => f.name === schema.titleFieldName);
	if (idx === -1) return null;
	const v = values[idx];
	if (v?.kind !== 'text') return null;
	return v.value;
}

export function resolveInstancePath(schema: TypeSchema, values: readonly FieldValue[], explicitFilename: string | null): Result<string, 'no-title-field-and-no-filename' | 'invalid-filename'> {
	let stem: string;
	if (explicitFilename !== null) {
		stem = sanitizeFilenameStem(explicitFilename.replace(/\.md$/i, ''));
	} else {
		const titleValue = findTitleValue(schema, values);
		if (titleValue === null) return err('no-title-field-and-no-filename');
		stem = sanitizeFilenameStem(titleValue);
	}
	if (stem === '') return err('invalid-filename');
	const folder = schema.instancesFolder.replace(/\/$/, '');
	return ok(`${folder}/${stem}.md`);
}
