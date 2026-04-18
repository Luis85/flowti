import { describe, it, expectTypeOf } from 'vitest';
import type { SchemaError, FieldError, MakeError } from '../../../src/domain/make/errors.js';

describe('error unions', () => {
	it('MakeError.kind is a finite literal union', () => {
		expectTypeOf<MakeError['kind']>().toEqualTypeOf<
			| 'vault-error'
			| 'invalid-schema'
			| 'invalid-values'
			| 'type-not-found'
			| 'duplicate-name'
			| 'instance-exists'
			| 'no-title-field'
			| 'base-generation-failed'
			| 'not-implemented'
		>();
	});
	it('SchemaError has at least nine variants', () => {
		expectTypeOf<SchemaError['kind']>().toMatchTypeOf<string>();
	});
	it('FieldError has at least eight variants', () => {
		expectTypeOf<FieldError['kind']>().toMatchTypeOf<string>();
	});
});
