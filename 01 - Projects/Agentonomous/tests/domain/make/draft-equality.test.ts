import { describe, it, expect } from 'vitest';
import { deepEqualDraft, type Draft } from '../../../src/domain/make/draft-equality.js';
import type { Field } from '../../../src/domain/make/type-schema.js';

const TEXT: Field = { kind: 'text', name: 'title', required: true };
const NUM: Field = { kind: 'number', name: 'pages', required: false };

const BASE: Draft = {
	name: 'Book',
	description: 'Reading log',
	instancesFolder: 'Books',
	titleFieldName: 'title',
	fields: [TEXT, NUM],
};

describe('deepEqualDraft', () => {
	it('returns true for structurally identical drafts', () => {
		const clone = structuredClone(BASE);
		expect(deepEqualDraft(BASE, clone)).toBe(true);
	});

	it('returns false when a top-level field differs', () => {
		expect(deepEqualDraft(BASE, { ...BASE, name: 'BOOK' })).toBe(false);
		expect(deepEqualDraft(BASE, { ...BASE, description: 'other' })).toBe(false);
		expect(deepEqualDraft(BASE, { ...BASE, instancesFolder: 'Library' })).toBe(false);
		expect(deepEqualDraft(BASE, { ...BASE, titleFieldName: null })).toBe(false);
	});

	it('returns false when fields length differs', () => {
		expect(deepEqualDraft(BASE, { ...BASE, fields: [TEXT] })).toBe(false);
		expect(deepEqualDraft(BASE, { ...BASE, fields: [TEXT, NUM, NUM] })).toBe(false);
	});

	it('returns false when fields are reordered', () => {
		expect(deepEqualDraft(BASE, { ...BASE, fields: [NUM, TEXT] })).toBe(false);
	});

	it('returns false when a single field property differs', () => {
		const changed: Field = { kind: 'text', name: 'title', required: false };
		expect(deepEqualDraft(BASE, { ...BASE, fields: [changed, NUM] })).toBe(false);
	});

	it('returns false when a field kind changes', () => {
		const changed: Field = { kind: 'number', name: 'title', required: true };
		expect(deepEqualDraft(BASE, { ...BASE, fields: [changed, NUM] })).toBe(false);
	});

	it('ignores undefined optional properties vs missing keys', () => {
		// required field has `description: undefined` on one side and missing on the other.
		// Both should compare equal because structurally they represent the same schema.
		const a: Field = { kind: 'text', name: 'x', required: true };
		const b: Field = { kind: 'text', name: 'x', required: true, description: undefined };
		expect(deepEqualDraft({ ...BASE, fields: [a] }, { ...BASE, fields: [b] })).toBe(true);
	});

	it('distinguishes empty-string description from undefined', () => {
		const a: Field = { kind: 'text', name: 'x', required: true };
		const b: Field = { kind: 'text', name: 'x', required: true, description: '' };
		expect(deepEqualDraft({ ...BASE, fields: [a] }, { ...BASE, fields: [b] })).toBe(false);
	});

	it('treats undefined default and missing default as equal', () => {
		const a: Field = { kind: 'text', name: 'x', required: true };
		const b: Field = { kind: 'text', name: 'x', required: true, default: undefined };
		expect(deepEqualDraft({ ...BASE, fields: [a] }, { ...BASE, fields: [b] })).toBe(true);
	});

	it('distinguishes different default values', () => {
		const a: Field = { kind: 'text', name: 'x', required: true, default: 'Hello' };
		const b: Field = { kind: 'text', name: 'x', required: true, default: 'World' };
		expect(deepEqualDraft({ ...BASE, fields: [a] }, { ...BASE, fields: [b] })).toBe(false);
	});
});
