import { describe, expect, it } from 'vitest';
import { invariant } from '../../../../src/domain/shared/utils/invariant.js';

describe('invariant', () => {
	it('does nothing when condition is true', () => {
		expect(() => invariant(true, 'should not throw')).not.toThrow();
	});
	it('throws Error with message when condition is false', () => {
		expect(() => invariant(false, 'broke')).toThrow('broke');
	});
	it('throws an Error instance', () => {
		try { invariant(false, 'test'); } catch (e) {
			expect(e).toBeInstanceOf(Error);
		}
	});
});
