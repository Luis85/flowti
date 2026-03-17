/**
 * condition-registry.ts — Shared interface for condition lookup.
 *
 * Both the legacy HandlerRegistry and TuiHandlerRegistry implement this,
 * so sitemap-conditions can accept either.
 */

/** Condition function with `unknown` context so both RouterContext and TuiActionContext work. */
export type ConditionFn = (ctx: unknown) => boolean;

export interface IConditionRegistry {
	hasCondition(id: string): boolean;
	getCondition(id: string): ConditionFn;
}
