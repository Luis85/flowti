import { describe, expect, it } from 'vitest';
import { tryAsync, trySync } from '../../../src/domain/shared/try-async.js';
import { isErr, isOk } from '../../../src/domain/shared/result.js';

describe('tryAsync', () => {
	it('wraps a successful call as ok(value)', async () => {
		const result = await tryAsync(async () => 42, { code: 'X', source: 'test' });
		expect(isOk(result) && result.value).toBe(42);
	});

	it('wraps a thrown Error as err(AppError) carrying the message', async () => {
		const result = await tryAsync(
			() => Promise.reject(new Error('boom')),
			{ code: 'X_FAILED', source: 'test' },
		);
		expect(isErr(result)).toBe(true);
		if (isErr(result)) {
			expect(result.error.code).toBe('X_FAILED');
			expect(result.error.source).toBe('test');
			expect(result.error.message).toBe('boom');
			expect(result.error.severity).toBe('system');
			expect(result.error.cause).toBeInstanceOf(Error);
		}
	});

	it('wraps non-Error rejections as err with stringified message', async () => {
		const result = await tryAsync(
			() => Promise.reject('plain-string'),
			{ code: 'X', source: 'test' },
		);
		expect(isErr(result) && result.error.message).toBe('plain-string');
	});

	it('respects the severity override', async () => {
		const result = await tryAsync(
			() => Promise.reject(new Error('x')),
			{ code: 'X', source: 'test', severity: 'user' },
		);
		expect(isErr(result) && result.error.severity).toBe('user');
	});
});

describe('trySync', () => {
	it('wraps a successful call as ok(value)', () => {
		const result = trySync(() => 'hi', { code: 'X', source: 'test' });
		expect(isOk(result) && result.value).toBe('hi');
	});

	it('wraps a thrown Error as err(AppError)', () => {
		const result = trySync(
			() => { throw new Error('boom'); },
			{ code: 'X_FAILED', source: 'test' },
		);
		expect(isErr(result) && result.error.message).toBe('boom');
	});
});
