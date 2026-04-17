import { describe, expect, it } from 'vitest';
import { appError, appErrorFromUnknown } from '../../../src/domain/shared/app-error.js';

describe('appError', () => {
	it('defaults severity to "system"', () => {
		const e = appError({ code: 'X', message: 'm', source: 's' });
		expect(e.severity).toBe('system');
	});

	it('accepts explicit severity', () => {
		const e = appError({ code: 'X', message: 'm', source: 's', severity: 'user' });
		expect(e.severity).toBe('user');
	});

	it('omits cause when undefined (exactOptionalPropertyTypes-friendly)', () => {
		const e = appError({ code: 'X', message: 'm', source: 's' });
		expect('cause' in e).toBe(false);
	});

	it('carries cause when provided', () => {
		const cause = new Error('orig');
		const e = appError({ code: 'X', message: 'm', source: 's', cause });
		expect(e.cause).toBe(cause);
	});
});

describe('appErrorFromUnknown', () => {
	it('takes the Error message', () => {
		const e = appErrorFromUnknown(new Error('boom'), { code: 'X', source: 's' });
		expect(e.message).toBe('boom');
	});

	it('stringifies non-Error inputs', () => {
		expect(appErrorFromUnknown('nope', { code: 'X', source: 's' }).message).toBe('nope');
		expect(appErrorFromUnknown(42, { code: 'X', source: 's' }).message).toBe('42');
	});

	it('keeps the original cause', () => {
		const cause = { raw: true };
		expect(appErrorFromUnknown(cause, { code: 'X', source: 's' }).cause).toBe(cause);
	});
});
