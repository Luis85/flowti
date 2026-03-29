import { describe, it, expect } from 'vitest';
import { evaluateBT } from '../../../src/domain/systems/behavior-tree.js';
import type { BTNode, BTContext } from '../../../src/domain/systems/behavior-tree.js';
import { createGameRNG } from '../../../src/domain/core/game-rng.js';

function makeContext(overrides: Partial<BTContext> = {}): BTContext {
	return {
		needs: { hunger: 50, energy: 50, social: 50 },
		mood: { value: 0, bucket: 'stressed' },
		perception: { nearbyAgents: [], nearbyLocations: [] },
		timePhase: 'day',
		rng: createGameRNG(42),
		interactionRadius: 25,
		...overrides,
	};
}

describe('evaluateBT', () => {
	it('action node always succeeds and returns action', () => {
		const node: BTNode = { type: 'action', action: 'idle', params: {} };
		const result = evaluateBT(node, makeContext());
		expect(result.status).toBe('success');
		expect(result.action).toBe('idle');
	});

	it('selector returns first succeeding child', () => {
		const node: BTNode = {
			type: 'selector',
			children: [
				{ type: 'condition', check: 'need_critical', params: { need: 'hunger' } },
				{ type: 'action', action: 'idle', params: {} },
			],
		};
		const result = evaluateBT(node, makeContext());
		expect(result.action).toBe('idle');
	});

	it('sequence fails on first failing child', () => {
		const node: BTNode = {
			type: 'sequence',
			children: [
				{ type: 'condition', check: 'need_critical', params: { need: 'hunger' } },
				{ type: 'action', action: 'eat', params: {} },
			],
		};
		const result = evaluateBT(node, makeContext());
		expect(result.status).toBe('failure');
		expect(result.action).toBeNull();
	});

	it('need_critical condition succeeds when need is below threshold', () => {
		const node: BTNode = {
			type: 'sequence',
			children: [
				{ type: 'condition', check: 'need_critical', params: { need: 'energy' } },
				{ type: 'action', action: 'rest', params: {} },
			],
		};
		const ctx = makeContext({ needs: { hunger: 50, energy: 10, social: 50 } });
		const result = evaluateBT(node, ctx);
		expect(result.status).toBe('success');
		expect(result.action).toBe('rest');
	});

	it('need_below condition with custom threshold', () => {
		const node: BTNode = {
			type: 'sequence',
			children: [
				{ type: 'condition', check: 'need_below', params: { need: 'hunger', threshold: 40 } },
				{ type: 'action', action: 'eat', params: {} },
			],
		};
		const ctx = makeContext({ needs: { hunger: 30, energy: 50, social: 50 } });
		expect(evaluateBT(node, ctx).action).toBe('eat');
	});

	it('mood_is condition matches bucket', () => {
		const node: BTNode = { type: 'condition', check: 'mood_is', params: { bucket: 'stressed' } };
		expect(evaluateBT(node, makeContext()).status).toBe('success');
	});

	it('time_is condition matches phase', () => {
		const node: BTNode = { type: 'condition', check: 'time_is', params: { phase: 'day' } };
		expect(evaluateBT(node, makeContext()).status).toBe('success');
	});

	it('nearby_location condition succeeds when type present', () => {
		const ctx = makeContext({
			perception: { nearbyAgents: [], nearbyLocations: [{ id: 'loc1', type: 'food', distance: 50 }] },
		});
		const node: BTNode = { type: 'condition', check: 'nearby_location', params: { locationType: 'food' } };
		expect(evaluateBT(node, ctx).status).toBe('success');
	});

	it('nearby_agent condition succeeds when agents nearby', () => {
		const ctx = makeContext({
			perception: { nearbyAgents: [{ id: 'a1', distance: 30 }], nearbyLocations: [] },
		});
		const node: BTNode = { type: 'condition', check: 'nearby_agent', params: {} };
		expect(evaluateBT(node, ctx).status).toBe('success');
	});

	it('chance condition uses RNG deterministically', () => {
		const node: BTNode = { type: 'condition', check: 'chance', params: { probability: 0.5 } };
		const r1 = evaluateBT(node, makeContext());
		const r2 = evaluateBT(node, makeContext());
		expect(r1.status).toBe(r2.status);
	});

	it('move_to_nearest action passes locationType in params', () => {
		const node: BTNode = { type: 'action', action: 'move_to_nearest', params: { locationType: 'rest' } };
		const result = evaluateBT(node, makeContext());
		expect(result.action).toBe('move_to_nearest');
		expect(result.params.locationType).toBe('rest');
	});

	it('nested selector/sequence combination', () => {
		const tree: BTNode = {
			type: 'selector',
			children: [
				{
					type: 'sequence',
					children: [
						{ type: 'condition', check: 'need_critical', params: { need: 'energy' } },
						{ type: 'action', action: 'rest', params: {} },
					],
				},
				{
					type: 'sequence',
					children: [
						{ type: 'condition', check: 'need_below', params: { need: 'hunger', threshold: 40 } },
						{ type: 'action', action: 'eat', params: {} },
					],
				},
				{ type: 'action', action: 'idle', params: {} },
			],
		};
		expect(evaluateBT(tree, makeContext({ needs: { hunger: 50, energy: 10, social: 50 } })).action).toBe('rest');
		expect(evaluateBT(tree, makeContext({ needs: { hunger: 30, energy: 50, social: 50 } })).action).toBe('eat');
		expect(evaluateBT(tree, makeContext({ needs: { hunger: 50, energy: 50, social: 50 } })).action).toBe('idle');
	});
});
