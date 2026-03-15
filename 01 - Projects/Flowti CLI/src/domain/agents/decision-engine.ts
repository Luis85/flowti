/**
 * decision-engine.ts — Rule-based decision engine for agent workers.
 *
 * Pure functions. Evaluates trigger against rules, returns action or null.
 */

import type { DecisionRule } from "./worker-types.js";

export const LLM_RULES: readonly DecisionRule[] = [
	{ trigger: "task-assigned", action: "execute-task", priority: 10 },
	{ trigger: "message-received", action: "respond", priority: 10 },
	{ trigger: "question-received", action: "respond", priority: 10 },
	{ trigger: "iteration-changed", action: "review", priority: 5 },
	{ trigger: "agent-mentioned", action: "review", priority: 3 },
];

export const NPC_RULES: readonly DecisionRule[] = [
	{ trigger: "message-received", action: "respond-from-state", priority: 10 },
	{ trigger: "task-assigned", action: "acknowledge", priority: 10 },
];

export function evaluateDecision(trigger: string, rules: readonly DecisionRule[]): string | null {
	const matches = rules.filter((r) => r.trigger === trigger);
	if (matches.length === 0) return null;
	const best = matches.reduce((a, b) => a.priority >= b.priority ? a : b);
	return best.action;
}

export function getRulesForAgent(hasLLM: boolean): readonly DecisionRule[] {
	return hasLLM ? LLM_RULES : NPC_RULES;
}
