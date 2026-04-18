import { err, ok, type Result } from '../shared/result.js';
import type { Field, FieldKind, TypeSchema } from './type-schema.js';
import { FIELD_KINDS_LITERAL } from './type-schema.js';
import type { SchemaError } from './errors.js';
import { validateFieldName, validateTypeName } from './name-validation.js';

const FIELD_KEY_ORDER: readonly (keyof TypeSchema)[] = [
	'id', 'name', 'description', 'instancesFolder', 'titleFieldName', 'fields', 'createdAt', 'updatedAt', 'baseFile',
] as const;

function isObject(x: unknown): x is Record<string, unknown> {
	return typeof x === 'object' && x !== null && !Array.isArray(x);
}

function parseField(raw: unknown): Result<Field, SchemaError> {
	if (!isObject(raw)) return err({ kind: 'invalid-json', reason: 'field is not an object' });
	const { kind, name, label, description, required, default: dflt } = raw;
	if (typeof kind !== 'string') return err({ kind: 'invalid-field-kind', received: String(kind) });
	if (!FIELD_KINDS_LITERAL.includes(kind as FieldKind)) return err({ kind: 'invalid-field-kind', received: kind });
	if (typeof name !== 'string') return err({ kind: 'missing-required-key', key: 'name' });
	const nameCheck = validateFieldName(name);
	if (nameCheck.kind === 'err') return err(nameCheck.error);
	if (typeof required !== 'boolean') return err({ kind: 'missing-required-key', key: 'required' });
	const field: Field = { kind, name, required, ...(typeof label === 'string' ? { label } : {}), ...(typeof description === 'string' ? { description } : {}), ...(dflt !== undefined ? { default: dflt } : {}) } as Field;
	return ok(field);
}

export function parseTypeSchema(raw: unknown): Result<TypeSchema, SchemaError> {
	if (!isObject(raw)) return err({ kind: 'invalid-json', reason: 'root is not an object' });
	for (const k of ['id', 'name', 'instancesFolder', 'fields', 'createdAt', 'updatedAt'] as const) {
		if (!(k in raw)) return err({ kind: 'missing-required-key', key: k });
	}
	const { id, name, description, instancesFolder, titleFieldName, fields, createdAt, updatedAt, baseFile } = raw;
	if (typeof id !== 'string') return err({ kind: 'missing-required-key', key: 'id' });
	if (typeof name !== 'string') return err({ kind: 'missing-required-key', key: 'name' });
	const nameCheck = validateTypeName(name);
	if (nameCheck.kind === 'err') return err(nameCheck.error);
	if (typeof instancesFolder !== 'string') return err({ kind: 'invalid-folder-path', path: String(instancesFolder) });
	if (!Array.isArray(fields)) return err({ kind: 'missing-required-key', key: 'fields' });

	const parsedFields: Field[] = [];
	const seen = new Set<string>();
	for (const rawField of fields) {
		const parsed = parseField(rawField);
		if (parsed.kind === 'err') return err(parsed.error);
		if (seen.has(parsed.value.name)) return err({ kind: 'duplicate-field-name', name: parsed.value.name });
		seen.add(parsed.value.name);
		parsedFields.push(parsed.value);
	}

	const titleField = titleFieldName;
	if (titleField !== null && titleField !== undefined) {
		if (typeof titleField !== 'string') return err({ kind: 'invalid-json', reason: 'titleFieldName must be a string or null' });
		const target = parsedFields.find((f) => f.name === titleField);
		if (target === undefined) return err({ kind: 'title-field-missing', titleFieldName: titleField });
		if (target.kind !== 'text') return err({ kind: 'title-field-not-text', titleFieldName: titleField });
	}

	if (typeof createdAt !== 'string' || typeof updatedAt !== 'string') {
		return err({ kind: 'invalid-json', reason: 'createdAt/updatedAt must be strings' });
	}

	const schema: TypeSchema = {
		id,
		name: nameCheck.value,
		...(typeof description === 'string' ? { description } : {}),
		instancesFolder,
		titleFieldName: typeof titleField === 'string' ? titleField : null,
		fields: parsedFields,
		createdAt,
		updatedAt,
		...(isObject(baseFile) && typeof baseFile['path'] === 'string' && typeof baseFile['generatedAt'] === 'string'
			? { baseFile: { path: baseFile['path'], generatedAt: baseFile['generatedAt'] } }
			: {}),
	};
	return ok(schema);
}

export function serializeTypeSchema(schema: TypeSchema): string {
	const ordered: Record<string, unknown> = {};
	for (const k of FIELD_KEY_ORDER) {
		const v = schema[k];
		if (v !== undefined) ordered[k] = v;
	}
	return JSON.stringify(ordered, null, 2);
}
