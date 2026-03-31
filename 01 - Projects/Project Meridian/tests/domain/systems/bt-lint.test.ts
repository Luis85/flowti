import { describe, it, expect } from 'vitest';
import { lintBehaviorTrees, type BTLintInput } from '../../../src/domain/systems/bt-lint.js';
import { KNOWN_ACTIONS } from '../../../src/domain/systems/bt-actions.js';
import { KNOWN_CONDITIONS } from '../../../src/domain/systems/bt-conditions.js';
import { FOOD_ITEMS } from '../../../src/domain/systems/food-items.js';
import { LOCATION_TYPES } from '../../../src/domain/schemas/location-schema.js';
import type { BTNode } from '../../../src/domain/schemas/behavior-tree-schema.js';

function makeInput(btDefinitions: Record<string, BTNode>): BTLintInput {
	return {
		btDefinitions,
		knownActions: KNOWN_ACTIONS,
		knownConditions: KNOWN_CONDITIONS,
		knownFoodItems: FOOD_ITEMS,
		locationTypes: [...LOCATION_TYPES],
	};
}

describe('lintBehaviorTrees', () => {
	describe('unknown action check', () => {
		it('warns on unknown action', () => {
			const input = makeInput({
				'bt-test': { type: 'action', action: 'fly_to_moon', params: {} },
			});
			const warnings = lintBehaviorTrees(input);
			expect(warnings).toHaveLength(1);
			expect(warnings[0]).toMatchObject({
				btId: 'bt-test',
				nodeType: 'action',
				issue: 'Unknown action "fly_to_moon"',
			});
		});

		it('passes on known action', () => {
			const input = makeInput({
				'bt-test': { type: 'action', action: 'idle', params: {} },
			});
			const warnings = lintBehaviorTrees(input);
			// idle-only tree will trigger the "only idle" warning, not unknown action
			const unknownActionWarnings = warnings.filter(w => w.issue.startsWith('Unknown action'));
			expect(unknownActionWarnings).toHaveLength(0);
		});
	});

	describe('unknown condition check', () => {
		it('warns on unknown condition', () => {
			const input = makeInput({
				'bt-test': { type: 'condition', check: 'is_flying', params: {} },
			});
			const warnings = lintBehaviorTrees(input);
			expect(warnings).toHaveLength(1);
			expect(warnings[0]).toMatchObject({
				btId: 'bt-test',
				nodeType: 'condition',
				issue: 'Unknown condition "is_flying"',
			});
		});

		it('passes on known condition', () => {
			const input = makeInput({
				'bt-test': { type: 'condition', check: 'need_below', params: { need: 'hunger', threshold: 50 } },
			});
			const warnings = lintBehaviorTrees(input);
			expect(warnings).toHaveLength(0);
		});
	});

	describe('has_item condition checks', () => {
		it('warns when itemId is missing', () => {
			const input = makeInput({
				'bt-test': { type: 'condition', check: 'has_item', params: {} },
			});
			const warnings = lintBehaviorTrees(input);
			expect(warnings).toContainEqual(
				expect.objectContaining({
					btId: 'bt-test',
					issue: 'has_item condition missing params.itemId',
				}),
			);
		});

		it('warns when itemId is empty string', () => {
			const input = makeInput({
				'bt-test': { type: 'condition', check: 'has_item', params: { itemId: '' } },
			});
			const warnings = lintBehaviorTrees(input);
			expect(warnings).toContainEqual(
				expect.objectContaining({
					issue: 'has_item condition missing params.itemId',
				}),
			);
		});

		it('warns on food-like item not in knownFoodItems', () => {
			const input = makeInput({
				'bt-test': { type: 'condition', check: 'has_item', params: { itemId: 'wheat_flour' } },
			});
			const warnings = lintBehaviorTrees(input);
			expect(warnings).toContainEqual(
				expect.objectContaining({
					issue: 'has_item references food-like item "wheat_flour" not in knownFoodItems',
				}),
			);
		});

		it('passes on food-like item that is in knownFoodItems', () => {
			const input = makeInput({
				'bt-test': { type: 'condition', check: 'has_item', params: { itemId: 'bread' } },
			});
			const warnings = lintBehaviorTrees(input);
			expect(warnings).toHaveLength(0);
		});

		it('passes on non-food item', () => {
			const input = makeInput({
				'bt-test': { type: 'condition', check: 'has_item', params: { itemId: 'iron_sword' } },
			});
			const warnings = lintBehaviorTrees(input);
			expect(warnings).toHaveLength(0);
		});
	});

	describe('need_below threshold checks', () => {
		it('warns when threshold is 0', () => {
			const input = makeInput({
				'bt-test': { type: 'condition', check: 'need_below', params: { need: 'hunger', threshold: 0 } },
			});
			const warnings = lintBehaviorTrees(input);
			expect(warnings).toContainEqual(
				expect.objectContaining({
					issue: 'need_below threshold must be > 0 and <= 100, got 0',
				}),
			);
		});

		it('warns when threshold is negative', () => {
			const input = makeInput({
				'bt-test': { type: 'condition', check: 'need_below', params: { need: 'hunger', threshold: -10 } },
			});
			const warnings = lintBehaviorTrees(input);
			expect(warnings).toContainEqual(
				expect.objectContaining({
					issue: 'need_below threshold must be > 0 and <= 100, got -10',
				}),
			);
		});

		it('warns when threshold exceeds 100', () => {
			const input = makeInput({
				'bt-test': { type: 'condition', check: 'need_below', params: { need: 'hunger', threshold: 150 } },
			});
			const warnings = lintBehaviorTrees(input);
			expect(warnings).toContainEqual(
				expect.objectContaining({
					issue: 'need_below threshold must be > 0 and <= 100, got 150',
				}),
			);
		});

		it('warns when threshold is missing', () => {
			const input = makeInput({
				'bt-test': { type: 'condition', check: 'need_below', params: { need: 'hunger' } },
			});
			const warnings = lintBehaviorTrees(input);
			expect(warnings).toContainEqual(
				expect.objectContaining({
					issue: 'need_below threshold must be > 0 and <= 100, got undefined',
				}),
			);
		});

		it('passes on valid threshold', () => {
			const input = makeInput({
				'bt-test': { type: 'condition', check: 'need_below', params: { need: 'hunger', threshold: 50 } },
			});
			const warnings = lintBehaviorTrees(input);
			expect(warnings).toHaveLength(0);
		});

		it('passes on threshold at boundaries', () => {
			const input1 = makeInput({
				'bt-test': { type: 'condition', check: 'need_below', params: { need: 'hunger', threshold: 1 } },
			});
			expect(lintBehaviorTrees(input1)).toHaveLength(0);

			const input2 = makeInput({
				'bt-test': { type: 'condition', check: 'need_below', params: { need: 'hunger', threshold: 100 } },
			});
			expect(lintBehaviorTrees(input2)).toHaveLength(0);
		});
	});

	describe('facility_has_stock condition checks', () => {
		it('warns when itemId is missing', () => {
			const input = makeInput({
				'bt-test': { type: 'condition', check: 'facility_has_stock', params: {} },
			});
			const warnings = lintBehaviorTrees(input);
			expect(warnings).toContainEqual(
				expect.objectContaining({
					issue: 'facility_has_stock condition missing params.itemId',
				}),
			);
		});

		it('warns when itemId is empty string', () => {
			const input = makeInput({
				'bt-test': { type: 'condition', check: 'facility_has_stock', params: { itemId: '' } },
			});
			const warnings = lintBehaviorTrees(input);
			expect(warnings).toContainEqual(
				expect.objectContaining({
					issue: 'facility_has_stock condition missing params.itemId',
				}),
			);
		});

		it('passes with valid itemId', () => {
			const input = makeInput({
				'bt-test': { type: 'condition', check: 'facility_has_stock', params: { itemId: 'wheat' } },
			});
			const warnings = lintBehaviorTrees(input);
			expect(warnings).toHaveLength(0);
		});
	});

	describe('idle-only tree check', () => {
		it('warns when BT has only idle action', () => {
			const input = makeInput({
				'bt-idle-only': { type: 'action', action: 'idle', params: {} },
			});
			const warnings = lintBehaviorTrees(input);
			expect(warnings).toContainEqual(
				expect.objectContaining({
					btId: 'bt-idle-only',
					nodeType: 'tree',
					issue: 'BT has only idle action — agent will never do anything useful',
				}),
			);
		});

		it('warns when all branches resolve to idle', () => {
			const input = makeInput({
				'bt-all-idle': {
					type: 'selector',
					children: [
						{ type: 'action', action: 'idle', params: {} },
						{ type: 'sequence', children: [
							{ type: 'condition', check: 'need_below', params: { need: 'hunger', threshold: 20 } },
							{ type: 'action', action: 'idle', params: {} },
						] },
					],
				},
			});
			const warnings = lintBehaviorTrees(input);
			expect(warnings).toContainEqual(
				expect.objectContaining({
					nodeType: 'tree',
					issue: 'BT has only idle action — agent will never do anything useful',
				}),
			);
		});

		it('does not warn when BT has non-idle actions', () => {
			const input = makeInput({
				'bt-active': {
					type: 'selector',
					children: [
						{ type: 'action', action: 'seek_food', params: {} },
						{ type: 'action', action: 'idle', params: {} },
					],
				},
			});
			const warnings = lintBehaviorTrees(input);
			const treeWarnings = warnings.filter(w => w.nodeType === 'tree');
			expect(treeWarnings).toHaveLength(0);
		});
	});

	describe('tree traversal', () => {
		it('lints deeply nested nodes', () => {
			const input = makeInput({
				'bt-deep': {
					type: 'selector',
					children: [
						{
							type: 'sequence',
							children: [
								{ type: 'condition', check: 'need_below', params: { need: 'hunger', threshold: 20 } },
								{
									type: 'selector',
									children: [
										{ type: 'action', action: 'unknown_deep_action', params: {} },
									],
								},
							],
						},
					],
				},
			});
			const warnings = lintBehaviorTrees(input);
			expect(warnings).toContainEqual(
				expect.objectContaining({
					issue: 'Unknown action "unknown_deep_action"',
				}),
			);
		});

		it('lints multiple BTs', () => {
			const input = makeInput({
				'bt-a': { type: 'action', action: 'bad_action_a', params: {} },
				'bt-b': { type: 'action', action: 'bad_action_b', params: {} },
			});
			const warnings = lintBehaviorTrees(input);
			const unknownActionWarnings = warnings.filter(w => w.issue.startsWith('Unknown action'));
			expect(unknownActionWarnings).toHaveLength(2);
			expect(unknownActionWarnings.map(w => w.btId)).toContain('bt-a');
			expect(unknownActionWarnings.map(w => w.btId)).toContain('bt-b');
		});
	});

	describe('clean tree', () => {
		it('returns no warnings for a valid tree', () => {
			const input = makeInput({
				'bt-valid': {
					type: 'selector',
					children: [
						{
							type: 'sequence',
							children: [
								{ type: 'condition', check: 'need_below', params: { need: 'hunger', threshold: 30 } },
								{ type: 'condition', check: 'has_item', params: { itemId: 'bread' } },
								{ type: 'action', action: 'eat', params: {} },
							],
						},
						{
							type: 'sequence',
							children: [
								{ type: 'condition', check: 'facility_has_stock', params: { itemId: 'bread' } },
								{ type: 'action', action: 'buy', params: {} },
							],
						},
						{ type: 'action', action: 'idle', params: {} },
					],
				},
			});
			const warnings = lintBehaviorTrees(input);
			expect(warnings).toHaveLength(0);
		});
	});
});
