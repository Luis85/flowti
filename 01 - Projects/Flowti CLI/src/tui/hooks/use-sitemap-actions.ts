/**
 * use-sitemap-actions.ts — Resolves sitemap PageActions into keyed, filtered SitemapActionDefs.
 *
 * Reads a page's actions from sitemap, evaluates hidden/disabled conditions,
 * assigns shortcut keys, and returns a flat array of SitemapActionDef ready
 * for rendering by ActionBar.
 */

import type { PageAction, ActionType } from "../../domain/sitemap/unified-page.js";
import type { IConditionRegistry } from "../../infrastructure/condition-registry.js";
import { evaluateExpression } from "../../infrastructure/sitemap-conditions.js";
import { assignKeys } from "../../infrastructure/key-assigner.js";

export interface SitemapActionDef {
	readonly key: string;
	readonly label: string;
	readonly disabled: boolean;
	readonly disabledMessage?: string;
	readonly group?: string;
	readonly type: ActionType;
	readonly target?: string;
	readonly params?: Readonly<Record<string, unknown>>;
}

export function resolvePageActions(
	actions: readonly PageAction[],
	flatContext: Record<string, boolean>,
	registry: IConditionRegistry,
): SitemapActionDef[] {
	// Resolve hidden/disabled inline using the flat context and registry.
	// For literal booleans and expression strings, evaluate directly.
	// For registered condition IDs, delegate to registry.
	const visible = actions.filter((a) => {
		if (a.hidden === undefined || a.hidden === false) return true;
		if (a.hidden === true) return false;
		// String condition: check registry first, else evaluate as expression
		if (typeof a.hidden === "string") {
			if (registry.hasCondition(a.hidden)) return !registry.getCondition(a.hidden)(flatContext);
			return !evaluateExpression(a.hidden, flatContext);
		}
		return true;
	});

	const keyed = assignKeys(visible);

	return keyed.map(({ action, assignedKey }) => {
		let disabled = false;
		if (action.disabled === true) {
			disabled = true;
		} else if (typeof action.disabled === "string") {
			disabled = registry.hasCondition(action.disabled)
				? registry.getCondition(action.disabled)(flatContext) as boolean
				: evaluateExpression(action.disabled, flatContext);
		} else if (action.disabled && typeof action.disabled === "object" && "unless" in action.disabled) {
			disabled = !evaluateExpression(action.disabled.unless, flatContext);
		}

		return {
			key: assignedKey,
			label: action.label,
			disabled,
			disabledMessage: action.disabledMessage,
			group: action.group,
			type: action.type,
			target: action.target,
			params: action.params,
		};
	});
}
