import { err, ok, type Result } from '../shared/result.js';
import type { SchemaError } from './errors.js';

const ILLEGAL_TYPE_CHARS = /[\/\\:*?"<>|\x00-\x1f]/;
const FIELD_NAME_RE = /^[A-Za-z][A-Za-z0-9_-]*$/;
const RESERVED_FIELD_NAMES = new Set(['type', 'type-id']);

export function validateTypeName(raw: string): Result<string, SchemaError> {
	const trimmed = raw.trim();
	if (trimmed === '') return err({ kind: 'invalid-name', name: raw, reason: 'empty' });
	if (trimmed.length > 64) return err({ kind: 'invalid-name', name: trimmed, reason: 'too-long' });
	if (ILLEGAL_TYPE_CHARS.test(trimmed)) return err({ kind: 'invalid-name', name: trimmed, reason: 'illegal-char' });
	return ok(trimmed);
}

export function validateFieldName(raw: string): Result<string, SchemaError> {
	const trimmed = raw.trim();
	if (trimmed === '') return err({ kind: 'invalid-name', name: raw, reason: 'empty' });
	if (trimmed.length > 64) return err({ kind: 'invalid-name', name: trimmed, reason: 'too-long' });
	if (!FIELD_NAME_RE.test(trimmed)) return err({ kind: 'invalid-name', name: trimmed, reason: 'illegal-char' });
	if (RESERVED_FIELD_NAMES.has(trimmed)) return err({ kind: 'invalid-name', name: trimmed, reason: 'reserved' });
	return ok(trimmed);
}
