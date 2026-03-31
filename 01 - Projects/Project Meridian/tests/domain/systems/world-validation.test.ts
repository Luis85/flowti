import { describe, it, expect } from 'vitest';
import { validateWorldConsistency } from '../../../src/domain/systems/world-validation.js';
import type { WorldValidationInput, WorldValidationAgent, WorldValidationLocation, ValidationWarning } from '../../../src/domain/systems/world-validation.js';

function makeAgent(overrides: Partial<WorldValidationAgent> = {}): WorldValidationAgent {
	return {
		id: 'agent-1',
		name: 'Alice',
		job: null,
		inventory: [],
		behaviorTree: 'default',
		...overrides,
	};
}

function makeLocation(overrides: Partial<WorldValidationLocation> = {}): WorldValidationLocation {
	return {
		id: 'loc-tavern',
		type: 'social',
		production: null,
		...overrides,
	};
}

function makeInput(overrides: Partial<WorldValidationInput> = {}): WorldValidationInput {
	return {
		agents: [],
		locations: [],
		btDefinitions: { default: {} },
		knownFoodItems: new Set(['bread']),
		knownActions: new Set(['idle', 'eat']),
		...overrides,
	};
}

describe('validateWorldConsistency', () => {
	it('returns no warnings for a consistent world', () => {
		const input = makeInput({
			agents: [makeAgent({ job: 'baker', behaviorTree: 'default', inventory: [{ item_id: 'bread', quantity: 2 }] })],
			locations: [makeLocation({
				id: 'loc-bakery',
				type: 'work',
				production: { job: 'baker', output: { item_id: 'bread' }, input: null },
			})],
		});
		const warnings = validateWorldConsistency(input);
		expect(warnings).toEqual([]);
	});

	describe('item_mismatch', () => {
		it('warns when agent has food-like item not in food registry', () => {
			const input = makeInput({
				agents: [makeAgent({ inventory: [{ item_id: 'rye_bread', quantity: 1 }] })],
			});
			const warnings = validateWorldConsistency(input);
			const itemWarnings = warnings.filter(w => w.category === 'item_mismatch');
			expect(itemWarnings).toHaveLength(1);
			expect(itemWarnings[0].message).toContain('rye_bread');
			expect(itemWarnings[0].message).toContain('bread');
			expect(itemWarnings[0].agentId).toBe('agent-1');
		});

		it('does not warn for registered food items', () => {
			const input = makeInput({
				agents: [makeAgent({ inventory: [{ item_id: 'bread', quantity: 3 }] })],
			});
			const warnings = validateWorldConsistency(input);
			const itemWarnings = warnings.filter(w => w.category === 'item_mismatch');
			expect(itemWarnings).toHaveLength(0);
		});

		it('does not warn for non-food items like tools', () => {
			const input = makeInput({
				agents: [makeAgent({ inventory: [{ item_id: 'hammer', quantity: 1 }] })],
			});
			const warnings = validateWorldConsistency(input);
			const itemWarnings = warnings.filter(w => w.category === 'item_mismatch');
			expect(itemWarnings).toHaveLength(0);
		});

		it('flags wheat as food-like when not in registry', () => {
			const input = makeInput({
				agents: [makeAgent({ inventory: [{ item_id: 'wheat', quantity: 5 }] })],
			});
			const warnings = validateWorldConsistency(input);
			const itemWarnings = warnings.filter(w => w.category === 'item_mismatch');
			expect(itemWarnings).toHaveLength(1);
			expect(itemWarnings[0].message).toContain('wheat');
		});
	});

	describe('job_mismatch', () => {
		it('warns when agent has job but no facility exists for it', () => {
			const input = makeInput({
				agents: [makeAgent({ job: 'blacksmith' })],
				locations: [makeLocation({
					id: 'loc-bakery',
					production: { job: 'baker', output: { item_id: 'bread' }, input: null },
				})],
			});
			const warnings = validateWorldConsistency(input);
			const jobWarnings = warnings.filter(w => w.category === 'job_mismatch');
			expect(jobWarnings).toHaveLength(1);
			expect(jobWarnings[0].message).toContain('blacksmith');
			expect(jobWarnings[0].agentId).toBe('agent-1');
		});

		it('does not warn when facility matches agent job', () => {
			const input = makeInput({
				agents: [makeAgent({ job: 'baker' })],
				locations: [makeLocation({
					id: 'loc-bakery',
					production: { job: 'baker', output: { item_id: 'bread' }, input: null },
				})],
			});
			const warnings = validateWorldConsistency(input);
			const jobWarnings = warnings.filter(w => w.category === 'job_mismatch');
			expect(jobWarnings).toHaveLength(0);
		});

		it('does not warn when agent has no job', () => {
			const input = makeInput({
				agents: [makeAgent({ job: null })],
			});
			const warnings = validateWorldConsistency(input);
			const jobWarnings = warnings.filter(w => w.category === 'job_mismatch');
			expect(jobWarnings).toHaveLength(0);
		});
	});

	describe('bt_missing', () => {
		it('warns when agent references missing behavior tree', () => {
			const input = makeInput({
				agents: [makeAgent({ behaviorTree: 'warrior' })],
				btDefinitions: { default: {} },
			});
			const warnings = validateWorldConsistency(input);
			const btWarnings = warnings.filter(w => w.category === 'bt_missing');
			expect(btWarnings).toHaveLength(1);
			expect(btWarnings[0].message).toContain('warrior');
			expect(btWarnings[0].agentId).toBe('agent-1');
		});

		it('does not warn when behavior tree exists', () => {
			const input = makeInput({
				agents: [makeAgent({ behaviorTree: 'default' })],
				btDefinitions: { default: {} },
			});
			const warnings = validateWorldConsistency(input);
			const btWarnings = warnings.filter(w => w.category === 'bt_missing');
			expect(btWarnings).toHaveLength(0);
		});
	});

	describe('supply_chain', () => {
		it('warns when facility input has no supplier', () => {
			const input = makeInput({
				locations: [makeLocation({
					id: 'loc-bakery',
					production: { job: 'baker', output: { item_id: 'bread' }, input: { item_id: 'flour' } },
				})],
			});
			const warnings = validateWorldConsistency(input);
			const supplyWarnings = warnings.filter(w => w.category === 'supply_chain');
			expect(supplyWarnings).toHaveLength(1);
			expect(supplyWarnings[0].message).toContain('flour');
			expect(supplyWarnings[0].locationId).toBe('loc-bakery');
		});

		it('does not warn when another facility supplies the input', () => {
			const input = makeInput({
				locations: [
					makeLocation({
						id: 'loc-mill',
						production: { job: 'miller', output: { item_id: 'flour' }, input: { item_id: 'wheat' } },
					}),
					makeLocation({
						id: 'loc-bakery',
						production: { job: 'baker', output: { item_id: 'bread' }, input: { item_id: 'flour' } },
					}),
					makeLocation({
						id: 'loc-farm',
						production: { job: 'farmer', output: { item_id: 'wheat' }, input: null },
					}),
				],
			});
			const warnings = validateWorldConsistency(input);
			const supplyWarnings = warnings.filter(w => w.category === 'supply_chain');
			expect(supplyWarnings).toHaveLength(0);
		});

		it('does not warn for facilities with no input', () => {
			const input = makeInput({
				locations: [makeLocation({
					id: 'loc-farm',
					production: { job: 'farmer', output: { item_id: 'wheat' }, input: null },
				})],
			});
			const warnings = validateWorldConsistency(input);
			const supplyWarnings = warnings.filter(w => w.category === 'supply_chain');
			expect(supplyWarnings).toHaveLength(0);
		});
	});

	describe('multiple warnings', () => {
		it('collects warnings across all categories', () => {
			const input = makeInput({
				agents: [
					makeAgent({ id: 'a1', name: 'Bob', job: 'blacksmith', behaviorTree: 'missing-bt', inventory: [{ item_id: 'fish_food', quantity: 1 }] }),
				],
				locations: [
					makeLocation({
						id: 'loc-bakery',
						production: { job: 'baker', output: { item_id: 'bread' }, input: { item_id: 'flour' } },
					}),
				],
				btDefinitions: { default: {} },
			});
			const warnings = validateWorldConsistency(input);
			const categories = new Set(warnings.map(w => w.category));
			expect(categories.has('item_mismatch')).toBe(true);
			expect(categories.has('job_mismatch')).toBe(true);
			expect(categories.has('bt_missing')).toBe(true);
			expect(categories.has('supply_chain')).toBe(true);
		});
	});
});
