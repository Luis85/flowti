/**
 * menu.mjs — Generic data-driven menu engine.
 *
 * Replaces the while+switch pattern in every domain module with a single
 * `runMenu()` call that takes an array of { key, label, action } items.
 */

import { printHeader, printMenu } from "./ui.mjs";
import { createRL, ask } from "./readline.mjs";

/**
 * Run an interactive menu loop.
 *
 * @param {string|null} title  Header text (null → skip header)
 * @param {Array} items        Menu item objects (see below)
 * @param {object} [options]
 * @param {Function} [options.beforeMenu]    Callback rendered between header and items
 * @param {string}   [options.defaultChoice] Default answer for the prompt (default "1")
 * @returns {Promise<"main"|"quit">}
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
export async function runMenu(title, items, options = {}) {
	// eslint-disable-next-line no-constant-condition
	while (true) {
		if (title) printHeader(title);
		if (options.beforeMenu) options.beforeMenu();

		const displayItems = items.map((item) => {
			if (item.separator) return item;
			return {
				...item,
				disabled: typeof item.disabled === "function" ? item.disabled() : item.disabled,
			};
		});
		printMenu(displayItems);

		const rl = createRL();
		const choice = await ask(rl, "Choice", options.defaultChoice ?? "1");
		rl.close();

		const match = items.find((i) => i.key === choice.toLowerCase());
		if (!match || match.separator) {
			console.log("\n  Invalid choice — try again.\n");
			continue;
		}

		const isDisabled = typeof match.disabled === "function" ? match.disabled() : match.disabled;
		if (isDisabled) {
			if (match.disabledMessage) console.log(match.disabledMessage);
			continue;
		}

		const result = await match.action();
		if (result === "main" || result === "quit") return result;
	}
}
