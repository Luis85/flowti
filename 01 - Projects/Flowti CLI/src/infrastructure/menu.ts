/**
 * menu.ts — Generic data-driven menu engine.
 *
 * Replaces the while+switch pattern in every domain module with a single
 * `runMenu()` call that takes an array of { key, label, action } items.
 */

import { printHeader, printMenu } from "./ui.js";
import { input } from "./input.js";
import type { MenuEntry, MenuItem, MenuOptions, MenuResult } from "./types.js";
import { log } from ".//logger.js";

/**
 * Run an interactive menu loop.
 *
 * Item shapes:
 *   { key, label, action }                      — simple item
 *   { key, label, action, disabled, disabledMessage } — gated item
 *   { separator: true }                         — visual separator
 *
 * `action()` may return "main" or "quit" to exit the menu loop,
 * or return nothing to stay in the loop.
 *
 * `disabled` may be a boolean or a function returning boolean
 * (re-evaluated each iteration for stateful menus).
 */
function resolveDisabled(item: MenuItem): boolean {
	return typeof item.disabled === "function" ? item.disabled() : !!item.disabled;
}

function resolveDisplayItems(items: MenuEntry[]): MenuEntry[] {
	const resolved = insertGroupSeparators(items);
	return resolved.map((item) => {
		if ("separator" in item) return item;
		return { ...item, disabled: resolveDisabled(item) };
	});
}

/** Insert separators between items with different `group` values. */
export function insertGroupSeparators(items: MenuEntry[]): MenuEntry[] {
	const result: MenuEntry[] = [];
	let lastGroup: string | undefined;

	for (const item of items) {
		if ("separator" in item) {
			result.push(item);
			continue;
		}

		if (item.group !== undefined && lastGroup !== undefined && item.group !== lastGroup) {
			result.push({ separator: true as const });
		}

		if (item.group !== undefined) lastGroup = item.group;
		result.push(item);
	}

	return result;
}

const EXIT_RESULTS: Set<string> = new Set(["main", "quit", "start", "refresh"]);

function isExitResult(result: unknown): result is MenuResult {
	return typeof result === "string" && (EXIT_RESULTS.has(result) || result.startsWith("navigate:"));
}

function findMatch(items: MenuEntry[], choice: string): MenuItem | null {
	return items.find((i): i is MenuItem => "key" in i && i.key === choice.toLowerCase()) ?? null;
}

export async function runMenu(
	title: string | null,
	items: MenuEntry[],
	options: MenuOptions & { beforeMenu?: () => void } = {},
): Promise<MenuResult> {

	while (true) {
		if (title) printHeader(title);
		if (options.beforeMenu) options.beforeMenu();
		if (options.renderStatusBar) options.renderStatusBar();
		printMenu(resolveDisplayItems(items));

		const choice = await input.ask("Choice", options.defaultChoice ?? "1");

		if (choice === "*") return "refresh" as MenuResult;

		if (choice === "!" && options.onAgentQuestion) {
			const result = await options.onAgentQuestion();
			if (result) return result;
			continue;
		}

		const match = findMatch(items, choice);
		if (!match) { log("\n  Invalid choice — try again.\n"); continue; }
		if (resolveDisabled(match)) { if (match.disabledMessage) log(match.disabledMessage); continue; }

		const result = await match.action();
		if (isExitResult(result)) return result;
	}
}
