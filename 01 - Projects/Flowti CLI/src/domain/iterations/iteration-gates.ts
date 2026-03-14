/**
 * iteration-gates.ts — Pure gate evaluators for iteration lifecycle transitions.
 *
 * Each gate checks a condition on an IterationSummary and returns a GateResult.
 * No deps, no I/O — just data inspection.
 */

import type { GateResult } from "../lifecycle/lifecycle-types.js";
import type { IterationSummary } from "./iteration-types.js";

type GateEvaluator = (summary: IterationSummary) => GateResult;

const GATE_REGISTRY: Record<string, GateEvaluator> = {
	"has-goal": (s) => ({
		gateId: "has-goal",
		passed: s.goal.trim().length > 0,
		message: "Iteration must have a goal defined.",
	}),
	"has-scope": (s) => ({
		gateId: "has-scope",
		passed: s.scopeItems.length > 0,
		message: "Iteration must have at least one scope item.",
	}),
	"has-dates": (s) => ({
		gateId: "has-dates",
		passed: s.startDate.length > 0 && s.endDate.length > 0,
		message: "Iteration must have start and end dates set.",
	}),
	"has-resources": (s) => ({
		gateId: "has-resources",
		passed: s.resources.length > 0 || s.capacities.length > 0,
		message: "Iteration must have resources or capacity allocated.",
	}),
	"scope-progress": (s) => ({
		gateId: "scope-progress",
		passed: s.scopeItems.some((item) => item.done),
		message: "At least one scope item must be completed.",
	}),
	"all-scope-done": (s) => ({
		gateId: "all-scope-done",
		passed: s.scopeItems.length > 0 && s.scopeItems.every((item) => item.done),
		message: "All scope items must be completed.",
	}),
};

/** Evaluate a gate by ID against an iteration summary. */
export function evaluateGate(gateId: string, summary: IterationSummary): GateResult {
	const evaluator = GATE_REGISTRY[gateId];
	if (!evaluator) return { gateId, passed: true, message: `Unknown gate "${gateId}" — skipped.` };
	return evaluator(summary);
}

/** Build a gate evaluator function bound to a specific iteration summary. */
export function makeGateEvaluator(summary: IterationSummary): (gateId: string) => GateResult {
	return (gateId) => evaluateGate(gateId, summary);
}
