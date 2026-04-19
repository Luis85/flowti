import { describe, it, expectTypeOf } from 'vitest';
import type {
	MoveReport, FailedMove,
	ListTypesResult, UpdateTypeResult, UpdateTypeOptions,
	CreateInstanceOptions, DeleteTypeReport,
	TypeSchema,
	CorruptTypeRef,
} from '../../../src/domain/make/types.js';

describe('MoveReport', () => {
	it('carries oldFolder, newFolder, movedCount, and a FailedMove[] list', () => {
		expectTypeOf<MoveReport['oldFolder']>().toBeString();
		expectTypeOf<MoveReport['newFolder']>().toBeString();
		expectTypeOf<MoveReport['movedCount']>().toBeNumber();
		expectTypeOf<MoveReport['failedMoves']>().toEqualTypeOf<readonly FailedMove[]>();
	});
});

describe('ListTypesResult', () => {
	it('carries types and issues arrays', () => {
		expectTypeOf<ListTypesResult['types']>().toEqualTypeOf<readonly TypeSchema[]>();
		expectTypeOf<ListTypesResult['issues']>().toEqualTypeOf<readonly CorruptTypeRef[]>();
	});
});

describe('UpdateTypeResult', () => {
	it('always has schema and optionally moveReport', () => {
		expectTypeOf<UpdateTypeResult['schema']>().toEqualTypeOf<TypeSchema>();
		expectTypeOf<UpdateTypeResult['moveReport']>().toEqualTypeOf<MoveReport | undefined>();
	});
});

describe('UpdateTypeOptions', () => {
	it('has optional acknowledgeRenames and moveInstances', () => {
		const a: UpdateTypeOptions = {};
		const b: UpdateTypeOptions = { acknowledgeRenames: true };
		const c: UpdateTypeOptions = { moveInstances: true };
		const d: UpdateTypeOptions = { acknowledgeRenames: true, moveInstances: true };
		expectTypeOf(a).toMatchTypeOf<UpdateTypeOptions>();
		expectTypeOf(b).toMatchTypeOf<UpdateTypeOptions>();
		expectTypeOf(c).toMatchTypeOf<UpdateTypeOptions>();
		expectTypeOf(d).toMatchTypeOf<UpdateTypeOptions>();
	});
});

describe('CreateInstanceOptions', () => {
	it('has optional overwrite flag', () => {
		const a: CreateInstanceOptions = {};
		const b: CreateInstanceOptions = { overwrite: true };
		expectTypeOf(a).toMatchTypeOf<CreateInstanceOptions>();
		expectTypeOf(b).toMatchTypeOf<CreateInstanceOptions>();
	});
});

describe('DeleteTypeReport (Chunk 4 widening)', () => {
	it('includes instanceFailures array', () => {
		expectTypeOf<DeleteTypeReport['instanceFailures']>().toBeObject();
	});
});
