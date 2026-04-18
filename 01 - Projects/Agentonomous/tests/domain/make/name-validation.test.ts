import { describe, it, expect } from 'vitest';
import { validateTypeName, validateFieldName } from '../../../src/domain/make/name-validation.js';

describe('validateTypeName', () => {
	it('accepts a simple name', () => {
		expect(validateTypeName('Book')).toEqual({ kind: 'ok', value: 'Book' });
	});
	it('rejects empty names', () => {
		expect(validateTypeName('')).toMatchObject({ kind: 'err', error: { kind: 'invalid-name', reason: 'empty' } });
		expect(validateTypeName('   ')).toMatchObject({ kind: 'err', error: { kind: 'invalid-name', reason: 'empty' } });
	});
	it('rejects over-long names', () => {
		expect(validateTypeName('a'.repeat(65))).toMatchObject({ kind: 'err', error: { kind: 'invalid-name', reason: 'too-long' } });
	});
	it('rejects filesystem-hostile characters', () => {
		for (const ch of ['/', '\\', ':', '*', '?', '"', '<', '>', '|']) {
			expect(validateTypeName(`Book${ch}s`)).toMatchObject({ kind: 'err', error: { kind: 'invalid-name', reason: 'illegal-char' } });
		}
	});
	it('trims surrounding whitespace on success', () => {
		expect(validateTypeName('  Book  ')).toEqual({ kind: 'ok', value: 'Book' });
	});
});

describe('validateFieldName', () => {
	it('accepts YAML-safe names', () => {
		expect(validateFieldName('title')).toEqual({ kind: 'ok', value: 'title' });
		expect(validateFieldName('page_count')).toEqual({ kind: 'ok', value: 'page_count' });
		expect(validateFieldName('is-read')).toEqual({ kind: 'ok', value: 'is-read' });
	});
	it('rejects names starting with a non-letter', () => {
		expect(validateFieldName('1title')).toMatchObject({ kind: 'err', error: { kind: 'invalid-name', reason: 'illegal-char' } });
		expect(validateFieldName('_title')).toMatchObject({ kind: 'err', error: { kind: 'invalid-name', reason: 'illegal-char' } });
	});
	it('rejects names with illegal characters', () => {
		expect(validateFieldName('title field')).toMatchObject({ kind: 'err', error: { kind: 'invalid-name', reason: 'illegal-char' } });
		expect(validateFieldName('title.sub')).toMatchObject({ kind: 'err', error: { kind: 'invalid-name', reason: 'illegal-char' } });
	});
	it('rejects reserved names', () => {
		expect(validateFieldName('type')).toMatchObject({ kind: 'err', error: { kind: 'invalid-name', reason: 'reserved' } });
		expect(validateFieldName('type-id')).toMatchObject({ kind: 'err', error: { kind: 'invalid-name', reason: 'reserved' } });
	});
});
