import type { BTNode } from '../schemas/behavior-tree-schema.js';

export interface BTLintWarning {
	btId: string;
	nodeType: string;
	issue: string;
}

export interface BTLintInput {
	btDefinitions: Record<string, BTNode>;
	knownActions: Set<string>;
	knownConditions: Set<string>;
	knownFoodItems: Set<string>;
	locationTypes: string[];
}

const FOOD_SUBSTRINGS = ['bread', 'food', 'wheat'];

function isFoodLikeItem(itemId: string): boolean {
	const lower = itemId.toLowerCase();
	return FOOD_SUBSTRINGS.some(sub => lower.includes(sub));
}

function collectLeafActions(node: BTNode): string[] {
	switch (node.type) {
		case 'action':
			return [node.action];
		case 'condition':
			return [];
		case 'selector':
		case 'sequence':
			return node.children.flatMap(collectLeafActions);
	}
}

function walkNode(
	btId: string,
	node: BTNode,
	input: BTLintInput,
	warnings: BTLintWarning[],
): void {
	switch (node.type) {
		case 'action': {
			if (!input.knownActions.has(node.action)) {
				warnings.push({
					btId,
					nodeType: 'action',
					issue: `Unknown action "${node.action}"`,
				});
			}
			break;
		}
		case 'condition': {
			if (!input.knownConditions.has(node.check)) {
				warnings.push({
					btId,
					nodeType: 'condition',
					issue: `Unknown condition "${node.check}"`,
				});
			}
			if (node.check === 'has_item') {
				const itemId = node.params.itemId;
				if (typeof itemId !== 'string' || itemId === '') {
					warnings.push({
						btId,
						nodeType: 'condition',
						issue: 'has_item condition missing params.itemId',
					});
				} else if (isFoodLikeItem(itemId) && !input.knownFoodItems.has(itemId)) {
					warnings.push({
						btId,
						nodeType: 'condition',
						issue: `has_item references food-like item "${itemId}" not in knownFoodItems`,
					});
				}
			}
			if (node.check === 'need_below') {
				const threshold = node.params.threshold;
				if (typeof threshold !== 'number' || threshold <= 0 || threshold > 100) {
					warnings.push({
						btId,
						nodeType: 'condition',
						issue: `need_below threshold must be > 0 and <= 100, got ${String(threshold)}`,
					});
				}
			}
			if (node.check === 'facility_has_stock') {
				const itemId = node.params.itemId;
				if (typeof itemId !== 'string' || itemId === '') {
					warnings.push({
						btId,
						nodeType: 'condition',
						issue: 'facility_has_stock condition missing params.itemId',
					});
				}
			}
			break;
		}
		case 'selector':
		case 'sequence': {
			for (const child of node.children) {
				walkNode(btId, child, input, warnings);
			}
			break;
		}
	}
}

export function lintBehaviorTrees(input: BTLintInput): BTLintWarning[] {
	const warnings: BTLintWarning[] = [];

	for (const [btId, root] of Object.entries(input.btDefinitions)) {
		// Per-node lint checks via recursive walk
		walkNode(btId, root, input, warnings);

		// Whole-tree check: BT whose only leaf is idle
		const leafActions = collectLeafActions(root);
		if (leafActions.length > 0 && leafActions.every(a => a === 'idle')) {
			warnings.push({
				btId,
				nodeType: 'tree',
				issue: 'BT has only idle action — agent will never do anything useful',
			});
		}
	}

	return warnings;
}
