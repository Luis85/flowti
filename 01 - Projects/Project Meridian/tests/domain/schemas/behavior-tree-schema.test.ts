import { describe, it, expect } from 'vitest';
import { BTNodeSchema, BehaviorTreeSchema } from '../../../src/domain/schemas/behavior-tree-schema.js';

describe('BTNodeSchema', () => {
	it('parses a valid action node', () => {
		const result = BTNodeSchema.safeParse({
			type: 'action',
			action: 'move_to',
			params: { target: 'tavern' },
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.type).toBe('action');
		}
	});

	it('parses a valid condition node', () => {
		const result = BTNodeSchema.safeParse({
			type: 'condition',
			check: 'is_hungry',
			params: { threshold: 30 },
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.type).toBe('condition');
		}
	});

	it('parses a valid selector with children', () => {
		const result = BTNodeSchema.safeParse({
			type: 'selector',
			children: [
				{ type: 'action', action: 'eat', params: {} },
				{ type: 'action', action: 'sleep', params: {} },
			],
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.type).toBe('selector');
		}
	});

	it('parses a valid sequence with children', () => {
		const result = BTNodeSchema.safeParse({
			type: 'sequence',
			children: [
				{ type: 'condition', check: 'has_gold', params: {} },
				{ type: 'action', action: 'buy_food', params: {} },
			],
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.type).toBe('sequence');
		}
	});

	it('parses a deeply nested tree (3+ levels)', () => {
		const result = BTNodeSchema.safeParse({
			type: 'selector',
			children: [
				{
					type: 'sequence',
					children: [
						{ type: 'condition', check: 'is_tired', params: {} },
						{
							type: 'selector',
							children: [
								{ type: 'action', action: 'find_bed', params: {} },
								{ type: 'action', action: 'rest_on_ground', params: {} },
							],
						},
					],
				},
				{ type: 'action', action: 'wander', params: {} },
			],
		});
		expect(result.success).toBe(true);
	});

	it('rejects an invalid node type', () => {
		const result = BTNodeSchema.safeParse({
			type: 'parallel',
			children: [],
		});
		expect(result.success).toBe(false);
	});

	it('rejects action node missing required action field', () => {
		const result = BTNodeSchema.safeParse({
			type: 'action',
		});
		expect(result.success).toBe(false);
	});

	it('rejects condition node missing required check field', () => {
		const result = BTNodeSchema.safeParse({
			type: 'condition',
		});
		expect(result.success).toBe(false);
	});

	it('rejects selector node missing children', () => {
		const result = BTNodeSchema.safeParse({
			type: 'selector',
		});
		expect(result.success).toBe(false);
	});
});

describe('BehaviorTreeSchema', () => {
	it('parses a complete behavior tree', () => {
		const result = BehaviorTreeSchema.safeParse({
			id: 'bt-patrol',
			root: {
				type: 'sequence',
				children: [
					{ type: 'condition', check: 'is_alert', params: {} },
					{ type: 'action', action: 'patrol_route', params: { route: 'north' } },
				],
			},
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.id).toBe('bt-patrol');
		}
	});

	it('rejects a tree missing id', () => {
		const result = BehaviorTreeSchema.safeParse({
			root: { type: 'action', action: 'idle', params: {} },
		});
		expect(result.success).toBe(false);
	});

	it('rejects a tree missing root', () => {
		const result = BehaviorTreeSchema.safeParse({
			id: 'bt-empty',
		});
		expect(result.success).toBe(false);
	});
});
