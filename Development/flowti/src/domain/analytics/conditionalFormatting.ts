/**
 * Conditional formatting rule evaluation.
 *
 * Pure functions for evaluating conditional rules against cell values.
 * First matching rule wins. Returns a CSS color string or null.
 */

import type { ConditionalRule, ColorPreset } from "./types";

/** Map from preset names to CSS variable references. */
const COLOR_PRESETS: Record<ColorPreset, string> = {
	positive: "var(--text-success)",
	negative: "var(--text-error)",
	warning: "var(--text-warning)",
};

/**
 * Resolve a color value — preset name returns CSS variable, anything else passes through.
 */
export function resolveColor(color: string): string {
	if (color in COLOR_PRESETS) {
		return COLOR_PRESETS[color as ColorPreset];
	}
	return color;
}

/**
 * Evaluate conditional rules against a numeric value.
 * Returns the resolved CSS color of the first matching rule, or null if no match.
 */
export function evaluateConditionalRules(value: number, rules: ConditionalRule[]): string | null {
	for (const rule of rules) {
		if (matchesRule(value, rule)) {
			return resolveColor(rule.color);
		}
	}
	return null;
}

function matchesRule(value: number, rule: ConditionalRule): boolean {
	switch (rule.operator) {
		case ">": return value > rule.threshold;
		case "<": return value < rule.threshold;
		case ">=": return value >= rule.threshold;
		case "<=": return value <= rule.threshold;
		case "=": return value === rule.threshold;
		case "!=": return value !== rule.threshold;
		default: return false;
	}
}
