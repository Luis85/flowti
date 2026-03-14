/**
 * key-assigner.ts — Auto-assigns shortcut keys to PageObject actions.
 *
 * Actions with an explicit `key` keep it. Actions without a key get
 * one auto-assigned from the pool: 1-9, then a-z (skipping reserved
 * keys like "b" for back and "q" for quit if already declared).
 */

import type { PageAction, HiddenCondition } from "../domain/sitemap/unified-page.js";

/** The ordered pool of keys to auto-assign from. */
const KEY_POOL = [
	"1", "2", "3", "4", "5", "6", "7", "8", "9",
	"a", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l",
	"m", "n", "o", "p", "r", "s", "t", "u", "v", "w", "x", "y", "z",
];

export interface KeyedAction {
	readonly action: PageAction;
	readonly assignedKey: string;
}

/**
 * Assign shortcut keys to a list of actions.
 *
 * - Actions with an explicit `key` keep it
 * - Hidden actions (literal `hidden: true`) are excluded from key assignment
 * - Remaining actions get keys from the pool in order
 * - Returns actions paired with their assigned keys
 */
export function assignKeys(actions: readonly PageAction[]): KeyedAction[] {
	const usedKeys = new Set<string>();
	const result: KeyedAction[] = [];
	const needsKey: PageAction[] = [];

	// First pass: collect explicit keys
	for (const action of actions) {
		if (isLiterallyHidden(action.hidden)) continue;

		if (action.key) {
			usedKeys.add(action.key.toLowerCase());
			result.push({ action, assignedKey: action.key.toLowerCase() });
		} else {
			needsKey.push(action);
		}
	}

	// Second pass: assign from pool
	let poolIdx = 0;
	for (const action of needsKey) {
		while (poolIdx < KEY_POOL.length && usedKeys.has(KEY_POOL[poolIdx])) {
			poolIdx++;
		}
		if (poolIdx >= KEY_POOL.length) {
			// Pool exhausted — skip this action (shouldn't happen with ≤35 actions)
			continue;
		}
		const key = KEY_POOL[poolIdx];
		usedKeys.add(key);
		result.push({ action, assignedKey: key });
		poolIdx++;
	}

	return result;
}

function isLiterallyHidden(hidden: HiddenCondition | undefined): boolean {
	return hidden === true;
}
