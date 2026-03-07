/**
 * menu.ts — Generic data-driven menu engine.
 *
 * Replaces the while+switch pattern in every domain module with a single
 * `runMenu()` call that takes an array of { key, label, action } items.
 */

import { printHeader, printMenu } from "./ui.js";
import { createRL, ask } from "./readline.js";
import type { MenuEntry, MenuItem, MenuOptions, MenuResult } from "../types.js";

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
export async function runMenu(
	title: string | null,
	items: MenuEntry[],
	options: MenuOptions & { beforeMenu?: () => void } = {},
): Promise<MenuResult> {
	// eslint-disable-next-line no-constant-condition
	while (true) {
		if (title) printHeader(title);
		if (options.beforeMenu) options.beforeMenu();

		const displayItems: MenuEntry[] = items.map((item) => {
			if ("separator" in item) return item;
			return {
				...item,
				disabled: typeof item.disabled === "function" ? item.disabled() : item.disabled,
			};
		});
		printMenu(displayItems);

		const rl = createRL();
		const choice = await ask(rl, "Choice", options.defaultChoice ?? "1");
		rl.close();

		const match = items.find((i): i is MenuItem => "key" in i && i.key === choice.toLowerCase());
		if (!match) {
			console.log("\n  Invalid choice — try again.\n");
			continue;
		}

		const isDisabled = typeof match.disabled === "function" ? match.disabled() : match.disabled;
		if (isDisabled) {
			if (match.disabledMessage) console.log(match.disabledMessage);
			continue;
		}

		const result = await match.action();
		if (result === "main" || result === "quit" || result === "start") return result;
	}
}
