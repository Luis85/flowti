import { describe, expect, it } from 'vitest';
import { err, isErr, isOk, ok, type Result } from '../../../src/domain/shared/result.js';

describe('Result', () => {
	it('ok() creates an Ok variant holding the value', () => {
		const r: Result<number, string> = ok(42);
		expect(isOk(r)).toBe(true);
		expect(isErr(r)).toBe(false);
		if (isOk(r)) expect(r.value).toBe(42);
	});

	it('err() creates an Err variant holding the error', () => {
		const r: Result<number, string> = err('boom');
		expect(isErr(r)).toBe(true);
		expect(isOk(r)).toBe(false);
		if (isErr(r)) expect(r.error).toBe('boom');
	});

	it('isOk / isErr narrow the type correctly', () => {
		const value: Result<{ id: number }, string> = ok({ id: 7 });
		if (isOk(value)) expect(value.value.id).toBe(7);
	});
});
