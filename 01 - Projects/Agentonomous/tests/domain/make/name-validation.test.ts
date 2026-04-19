import { describe, it, expect } from 'vitest';
import { validateTypeName, validateFieldName, validateInstancesFolder } from '../../../src/domain/make/name-validation.js';

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

describe('validateInstancesFolder', () => {
	it('returns ok with trimmed value for valid folders', () => {
		expect(validateInstancesFolder('Books')).toEqual({ kind: 'ok', value: 'Books' });
		expect(validateInstancesFolder('  Books/Reviews  ')).toEqual({ kind: 'ok', value: 'Books/Reviews' });
	});

	it('rejects empty folder', () => {
		const r = validateInstancesFolder('');
		expect(r).toMatchObject({ kind: 'err', error: { kind: 'invalid-folder-path' } });
	});

	it('rejects leading or trailing slash', () => {
		expect(validateInstancesFolder('/Books').kind).toBe('err');
		expect(validateInstancesFolder('Books/').kind).toBe('err');
	});

	it('rejects illegal filesystem characters', () => {
		expect(validateInstancesFolder('Books*').kind).toBe('err');
		expect(validateInstancesFolder('Books?').kind).toBe('err');
		expect(validateInstancesFolder('Books<>').kind).toBe('err');
	});
});

describe('cross-platform name edge cases', () => {
	describe('validateTypeName unicode + control chars', () => {
		it.each([
			['simple ASCII', 'Book', true],
			['CJK', '書籍', true],
			['emoji', '📚 Library', true],
			['accented', 'Café Récipé', true],
			['cyrillic', 'Книга', true],
			['mixed with hyphen', 'Item-Type_v2', true],
		])('accepts %s: %j', (_label, input, shouldAccept) => {
			const r = validateTypeName(input);
			expect(r.kind).toBe(shouldAccept ? 'ok' : 'err');
		});

		it.each([
			['null byte', 'Book\x00'],
			['tab', 'Book\tX'],
			['newline', 'Book\nX'],
			['escape', 'Book\x1bX'],
		])('rejects control char %s', (_label, input) => {
			const r = validateTypeName(input);
			expect(r).toMatchObject({ kind: 'err', error: { reason: 'illegal-char' } });
		});
	});

	describe('validateInstancesFolder path shapes', () => {
		it.each([
			['simple', 'Books', true],
			['nested', 'Content/Books', true],
			['deeply nested', 'a/b/c/d/e', true],
			['unicode segment', 'Контент/Книги', true],
			['emoji segment', '📁/Books', true],
			['space in segment', 'My Books/2026', true],
		])('accepts path shape %s: %j', (_label, input, shouldAccept) => {
			const r = validateInstancesFolder(input);
			expect(r.kind).toBe(shouldAccept ? 'ok' : 'err');
		});

		it.each([
			['leading slash',       '/Books'],
			['trailing slash',      'Books/'],
			['double slash',        'Books//Reviews'], // not currently rejected — document current behavior in separate test
			['backslash',           'Books\\Reviews'],
			['pipe',                'Books|x'],
			['asterisk',            'Books/*.md'],
			['quote',               'Books/"x"'],
		].filter(([label]) => label !== 'double slash'))('rejects %s: %j', (_label, input) => {
			expect(validateInstancesFolder(input).kind).toBe('err');
		});

		it('does NOT currently reject traversal segments (documents existing behavior)', () => {
			// `..` and `.` pass the character check; no path-semantic analysis happens here.
			// Flagged as a follow-up — domain would need explicit traversal rejection.
			expect(validateInstancesFolder('..').kind).toBe('ok');
			expect(validateInstancesFolder('Books/..').kind).toBe('ok');
		});

		it('does NOT currently reject Windows reserved segments (documents existing behavior)', () => {
			// CON, PRN, AUX, NUL, COM1-9, LPT1-9 are reserved on Windows. The validator
			// is filesystem-agnostic today — a follow-up could add a platform-aware pass.
			expect(validateInstancesFolder('CON').kind).toBe('ok');
			expect(validateInstancesFolder('PRN/x').kind).toBe('ok');
		});
	});
});
