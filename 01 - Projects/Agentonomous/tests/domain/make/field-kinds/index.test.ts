import { describe, it, expect } from 'vitest';
import { FIELD_KINDS, getFieldKindSpec } from '../../../../src/domain/make/field-kinds/index.js';
import { FIELD_KINDS_LITERAL } from '../../../../src/domain/make/type-schema.js';

describe('FIELD_KINDS registry', () => {
	it('has one entry per kind', () => {
		for (const k of FIELD_KINDS_LITERAL) {
			expect(FIELD_KINDS).toHaveProperty(k);
			expect(FIELD_KINDS[k].kind).toBe(k);
		}
	});
	it('getFieldKindSpec returns the right spec', () => {
		expect(getFieldKindSpec('text').kind).toBe('text');
		expect(getFieldKindSpec('number').kind).toBe('number');
		expect(getFieldKindSpec('datetime').kind).toBe('datetime');
	});
});
