/**
 * condition-registry.ts — Shared interface for sitemap condition lookup.
 *
 * Used by sitemap-conditions when evaluating `hidden` / `disabled` entries in sitemap.json.
 */

/** Condition function with `unknown` context so both RouterContext and TuiActionContext work. */
export type ConditionFn = (ctx: unknown) => boolean;

export interface IConditionRegistry {
	hasCondition(id: string): boolean;
	getCondition(id: string): ConditionFn;
}
