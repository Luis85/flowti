import { describe, it, expect } from 'vitest';
import { INPUT_COMPONENTS } from '../../../../../src/ui/components/make/inputs/registry.js';
import { FIELD_KINDS_LITERAL } from '../../../../../src/domain/make/type-schema.js';

describe('INPUT_COMPONENTS registry', () => {
	it('has one entry per FieldKind', () => {
		for (const kind of FIELD_KINDS_LITERAL) {
			expect(INPUT_COMPONENTS[kind]).toBeDefined();
		}
	});
});
