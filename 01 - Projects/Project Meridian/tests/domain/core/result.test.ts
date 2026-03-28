import { describe, it, expect } from 'vitest';
import { Result } from '../../../src/domain/core/result.js';

describe('Result', () => {
	it('creates a success result with a value', () => {
		const result = Result.ok(42);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value).toBe(42);
		}
	});

	it('creates an error result with a GameError', () => {
		const result = Result.err({
			code: 'TEST_ERROR',
			message: 'something failed',
			system: 'TestSystem',
			recoverable: true,
		});
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe('TEST_ERROR');
		}
	});

	it('maps a success result', () => {
		const result = Result.ok(10).map(v => v * 2);
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.value).toBe(20);
	});

	it('does not map an error result', () => {
		const err = Result.err({ code: 'E', message: 'm', system: 's', recoverable: true });
		const mapped = err.map(() => 999);
		expect(mapped.ok).toBe(false);
	});

	it('flatMaps through a 3-step chain', () => {
		const step1 = (n: number) => Result.ok(n + 1);
		const step2 = (n: number) => Result.ok(n * 2);
		const step3 = (n: number) => Result.ok(`result: ${n}`);

		const final = Result.ok(5)
			.flatMap(step1)
			.flatMap(step2)
			.flatMap(step3);

		expect(final.ok).toBe(true);
		if (final.ok) expect(final.value).toBe('result: 12');
	});

	it('short-circuits on error in a chain', () => {
		const step1 = (n: number) => Result.ok(n + 1);
		const step2 = (_n: number) => Result.err<number>({
			code: 'STEP2_FAIL', message: 'boom', system: 'test', recoverable: false,
		});
		const step3 = (n: number) => Result.ok(n * 100);

		const final = Result.ok(5).flatMap(step1).flatMap(step2).flatMap(step3);

		expect(final.ok).toBe(false);
		if (!final.ok) expect(final.error.code).toBe('STEP2_FAIL');
	});
});
