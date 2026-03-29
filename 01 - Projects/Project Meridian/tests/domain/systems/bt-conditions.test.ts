import { describe, it, expect } from 'vitest';
import { evaluateBT, type BTContext, type BTNode } from '../../../src/domain/systems/behavior-tree.js';
import { createGameRNG } from '../../../src/domain/core/game-rng.js';

function createBaseContext(overrides: Partial<BTContext> = {}): BTContext {
	return {
		needs: { hunger: 50, energy: 50, social: 50 },
		mood: { value: 0, bucket: 'stressed' },
		perception: { nearbyAgents: [], nearbyLocations: [] },
		timePhase: 'day',
		rng: createGameRNG(42),
		interactionRadius: 25,
		wallet: 50,
		inventory: [],
		job: null,
		nearbyFacilities: [],
		...overrides,
	};
}

function conditionNode(check: string, params: Record<string, unknown> = {}): BTNode {
	return {
		type: 'sequence',
		children: [
			{ type: 'condition', check, params },
			{ type: 'action', action: 'test-action', params: {} },
		],
	};
}

describe('BT Conditions — economy', () => {
	describe('has_gold', () => {
		it('succeeds when wallet >= amount', () => {
			const ctx = createBaseContext({ wallet: 50 });
			const node = conditionNode('has_gold', { amount: 50 });
			const result = evaluateBT(node, ctx);
			expect(result.status).toBe('success');
			expect(result.action).toBe('test-action');
		});

		it('fails when wallet < amount', () => {
			const ctx = createBaseContext({ wallet: 10 });
			const node = conditionNode('has_gold', { amount: 50 });
			const result = evaluateBT(node, ctx);
			expect(result.status).toBe('failure');
		});
	});

	describe('has_item', () => {
		it('succeeds when item is in inventory', () => {
			const ctx = createBaseContext({
				inventory: [{ item_id: 'bread', quantity: 3 }],
			});
			const node = conditionNode('has_item', { itemId: 'bread' });
			const result = evaluateBT(node, ctx);
			expect(result.status).toBe('success');
			expect(result.action).toBe('test-action');
		});

		it('fails when item is not in inventory', () => {
			const ctx = createBaseContext({ inventory: [] });
			const node = conditionNode('has_item', { itemId: 'bread' });
			const result = evaluateBT(node, ctx);
			expect(result.status).toBe('failure');
		});

		it('fails when item quantity is 0', () => {
			const ctx = createBaseContext({
				inventory: [{ item_id: 'bread', quantity: 0 }],
			});
			const node = conditionNode('has_item', { itemId: 'bread' });
			const result = evaluateBT(node, ctx);
			expect(result.status).toBe('failure');
		});
	});

	describe('can_afford', () => {
		it('succeeds with enough gold and stock nearby', () => {
			const ctx = createBaseContext({
				wallet: 10,
				nearbyFacilities: [
					{ id: 'loc-bakery', job: 'baker', stock: [{ item_id: 'bread', quantity: 5 }] },
				],
			});
			const node = conditionNode('can_afford', { price: 2 });
			const result = evaluateBT(node, ctx);
			expect(result.status).toBe('success');
			expect(result.action).toBe('test-action');
		});

		it('fails when no facility has stock', () => {
			const ctx = createBaseContext({
				wallet: 10,
				nearbyFacilities: [
					{ id: 'loc-bakery', job: 'baker', stock: [] },
				],
			});
			const node = conditionNode('can_afford', { price: 2 });
			const result = evaluateBT(node, ctx);
			expect(result.status).toBe('failure');
		});

		it('fails when wallet is below price', () => {
			const ctx = createBaseContext({
				wallet: 1,
				nearbyFacilities: [
					{ id: 'loc-bakery', job: 'baker', stock: [{ item_id: 'bread', quantity: 5 }] },
				],
			});
			const node = conditionNode('can_afford', { price: 2 });
			const result = evaluateBT(node, ctx);
			expect(result.status).toBe('failure');
		});
	});

	describe('facility_has_stock', () => {
		it('succeeds when a nearby facility has the item', () => {
			const ctx = createBaseContext({
				nearbyFacilities: [
					{ id: 'loc-farm', job: 'farmer', stock: [{ item_id: 'wheat', quantity: 3 }] },
				],
			});
			const node = conditionNode('facility_has_stock', { itemId: 'wheat' });
			const result = evaluateBT(node, ctx);
			expect(result.status).toBe('success');
			expect(result.action).toBe('test-action');
		});

		it('fails when no facility has the item', () => {
			const ctx = createBaseContext({
				nearbyFacilities: [
					{ id: 'loc-farm', job: 'farmer', stock: [{ item_id: 'wheat', quantity: 3 }] },
				],
			});
			const node = conditionNode('facility_has_stock', { itemId: 'bread' });
			const result = evaluateBT(node, ctx);
			expect(result.status).toBe('failure');
		});

		it('fails when facilities have zero quantity', () => {
			const ctx = createBaseContext({
				nearbyFacilities: [
					{ id: 'loc-farm', job: 'farmer', stock: [{ item_id: 'wheat', quantity: 0 }] },
				],
			});
			const node = conditionNode('facility_has_stock', { itemId: 'wheat' });
			const result = evaluateBT(node, ctx);
			expect(result.status).toBe('failure');
		});
	});

	describe('has_job_facility', () => {
		it('succeeds when agent job matches a nearby facility', () => {
			const ctx = createBaseContext({
				job: 'farmer',
				nearbyFacilities: [
					{ id: 'loc-farm', job: 'farmer', stock: [] },
				],
			});
			const node = conditionNode('has_job_facility');
			const result = evaluateBT(node, ctx);
			expect(result.status).toBe('success');
			expect(result.action).toBe('test-action');
		});

		it('fails when agent has no job', () => {
			const ctx = createBaseContext({
				job: null,
				nearbyFacilities: [
					{ id: 'loc-farm', job: 'farmer', stock: [] },
				],
			});
			const node = conditionNode('has_job_facility');
			const result = evaluateBT(node, ctx);
			expect(result.status).toBe('failure');
		});

		it('fails when no facility matches agent job', () => {
			const ctx = createBaseContext({
				job: 'baker',
				nearbyFacilities: [
					{ id: 'loc-farm', job: 'farmer', stock: [] },
				],
			});
			const node = conditionNode('has_job_facility');
			const result = evaluateBT(node, ctx);
			expect(result.status).toBe('failure');
		});
	});
});
