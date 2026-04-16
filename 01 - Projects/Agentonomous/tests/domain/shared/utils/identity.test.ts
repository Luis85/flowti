import { describe, expect, it } from 'vitest';
import { generateId, timestamp } from '../../../../src/domain/shared/utils/identity.js';

describe('generateId', () => {
	it('returns a string', () => {
		expect(typeof generateId()).toBe('string');
	});
	it('returns unique values on consecutive calls', () => {
		const a = generateId();
		const b = generateId();
		expect(a).not.toBe(b);
	});
});

describe('timestamp', () => {
	it('returns a number close to Date.now()', () => {
		const before = Date.now();
		const ts = timestamp();
		const after = Date.now();
		expect(ts).toBeGreaterThanOrEqual(before);
		expect(ts).toBeLessThanOrEqual(after);
	});
});
