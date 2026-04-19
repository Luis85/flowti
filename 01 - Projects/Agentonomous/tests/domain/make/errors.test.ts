import { describe, it, expectTypeOf } from 'vitest';
import type { SchemaError, FieldError, MakeError, CorruptTypeRef, IoError } from '../../../src/domain/make/errors.js';

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

describe('CorruptTypeRef', () => {
	it('unions SchemaError and IoError in the error field', () => {
		expectTypeOf<CorruptTypeRef['error']>().toEqualTypeOf<SchemaError | IoError>();
	});

	it('carries filename and absolute path', () => {
		expectTypeOf<CorruptTypeRef>().toHaveProperty('path').toBeString();
		expectTypeOf<CorruptTypeRef>().toHaveProperty('filename').toBeString();
	});
});

describe('IoError', () => {
	it('has kind "io-error" and cause string', () => {
		expectTypeOf<IoError['kind']>().toEqualTypeOf<'io-error'>();
		expectTypeOf<IoError['cause']>().toBeString();
	});
});
