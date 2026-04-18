import { describe, it, expect } from 'vitest';
import { sanitizeFilenameStem } from '../../../src/domain/make/sanitize-filename.js';

describe('sanitizeFilenameStem', () => {
	it('passes through safe names', () => {
		expect(sanitizeFilenameStem('Dune')).toBe('Dune');
	});
	it('strips filesystem-hostile characters and collapses whitespace', () => {
		// 'Some / Title: v2' -> strip '/' and ':' -> 'Some  Title v2' -> collapse to single spaces -> 'Some Title v2'
		expect(sanitizeFilenameStem('Some / Title: v2')).toBe('Some Title v2');
	});
	it('collapses whitespace', () => {
		expect(sanitizeFilenameStem('a    b   c')).toBe('a b c');
	});
	it('trims leading/trailing whitespace', () => {
		expect(sanitizeFilenameStem('  Book  ')).toBe('Book');
	});
	it('removes trailing dots', () => {
		expect(sanitizeFilenameStem('file...')).toBe('file');
	});
	it('caps length at 120', () => {
		expect(sanitizeFilenameStem('a'.repeat(500)).length).toBe(120);
	});
	it('returns empty for fully-illegal input', () => {
		expect(sanitizeFilenameStem('///')).toBe('');
		expect(sanitizeFilenameStem('   ')).toBe('');
	});
	it('rejects Windows reserved device names (case-insensitive)', () => {
		for (const reserved of ['CON', 'con', 'Con', 'PRN', 'AUX', 'NUL', 'COM1', 'com9', 'LPT1', 'lpt9']) {
			expect(sanitizeFilenameStem(reserved)).toBe('');
		}
	});
	it('allows names that merely contain a reserved name as a substring', () => {
		expect(sanitizeFilenameStem('CONtract')).toBe('CONtract');
		expect(sanitizeFilenameStem('acon')).toBe('acon');
	});
});
