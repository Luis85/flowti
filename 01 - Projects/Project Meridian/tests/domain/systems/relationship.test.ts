import { describe, it, expect } from 'vitest';
import { applyRelationshipUpdate } from '../../../src/domain/systems/relationship.js';

describe('applyRelationshipUpdate', () => {
	it('increases disposition and familiarity', () => {
		const result = applyRelationshipUpdate({
			currentDisposition: 10,
			currentFamiliarity: 5,
			dispositionChange: 15,
			familiarityChange: 3,
		});
		expect(result.newDisposition).toBe(25);
		expect(result.newFamiliarity).toBe(8);
	});

	it('clamps disposition to +100', () => {
		const result = applyRelationshipUpdate({
			currentDisposition: 90,
			currentFamiliarity: 50,
			dispositionChange: 20,
			familiarityChange: 0,
		});
		expect(result.newDisposition).toBe(100);
	});

	it('clamps disposition to -100', () => {
		const result = applyRelationshipUpdate({
			currentDisposition: -90,
			currentFamiliarity: 50,
			dispositionChange: -20,
			familiarityChange: 0,
		});
		expect(result.newDisposition).toBe(-100);
	});

	it('clamps familiarity at 0 minimum', () => {
		const result = applyRelationshipUpdate({
			currentDisposition: 0,
			currentFamiliarity: 2,
			dispositionChange: 0,
			familiarityChange: -10,
		});
		expect(result.newFamiliarity).toBe(0);
	});

	it('handles fractional changes', () => {
		const result = applyRelationshipUpdate({
			currentDisposition: 10.5,
			currentFamiliarity: 3.2,
			dispositionChange: 0.3,
			familiarityChange: 0.1,
		});
		expect(result.newDisposition).toBeCloseTo(10.8);
		expect(result.newFamiliarity).toBeCloseTo(3.3);
	});

	it('handles zero changes', () => {
		const result = applyRelationshipUpdate({
			currentDisposition: 42,
			currentFamiliarity: 17,
			dispositionChange: 0,
			familiarityChange: 0,
		});
		expect(result.newDisposition).toBe(42);
		expect(result.newFamiliarity).toBe(17);
	});
});
