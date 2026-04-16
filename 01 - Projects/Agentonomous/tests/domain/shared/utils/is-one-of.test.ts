import { describe, expect, it } from 'vitest';
import { isOneOf } from '../../../../src/domain/shared/utils/is-one-of.js';

describe('isOneOf', () => {
	const allowed = ['home', 'agents', 'settings'] as const;
	it('returns true for a value in the array', () => {
		expect(isOneOf('home', allowed)).toBe(true);
	});
	it('returns false for a value not in the array', () => {
		expect(isOneOf('unknown', allowed)).toBe(false);
	});
	it('returns false for empty string', () => {
		expect(isOneOf('', allowed)).toBe(false);
	});
	it('narrows the type (compile-time check)', () => {
		const value: string = 'home';
		if (isOneOf(value, allowed)) {
			const narrowed: 'home' | 'agents' | 'settings' = value;
			expect(narrowed).toBe('home');
		}
	});
});
