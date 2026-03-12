/**
 * lifecycle-engine.ts — Pure state machine for entity lifecycles.
 *
 * No side effects, no deps — just state validation and transition logic.
 */

import type { EntityType, ProjectLifecycleState, ProductLifecycleState, FeatureLifecycleState } from "../../infrastructure/types.js";
import type { LifecycleTemplate, TransitionResult } from "./lifecycle-types.js";

// ── Project lifecycle ───────────────────────────────────────────────

const PROJECT_STATES: readonly ProjectLifecycleState[] = [
	"inception", "planning", "execution", "monitoring", "closing", "archived",
];

const PROJECT_TRANSITIONS: Record<string, readonly string[]> = {
	inception:  ["planning"],
	planning:   ["execution", "inception"],
	execution:  ["monitoring", "closing"],
	monitoring: ["execution", "closing"],
	closing:    ["archived"],
	archived:   [],
};

// ── Product lifecycle ───────────────────────────────────────────────

const PRODUCT_STATES: readonly ProductLifecycleState[] = [
	"concept", "development", "launch", "growth", "maturity", "decline", "sunset",
];

const PRODUCT_TRANSITIONS: Record<string, readonly string[]> = {
	concept:     ["development"],
	development: ["launch"],
	launch:      ["growth"],
	growth:      ["maturity"],
	maturity:    ["decline"],
	decline:     ["sunset"],
	sunset:      [],
};

// ── Feature lifecycle ───────────────────────────────────────────────

const FEATURE_STATES: readonly FeatureLifecycleState[] = [
	"ideation", "specification", "development", "testing", "release", "deprecated",
];

const FEATURE_TRANSITIONS: Record<string, readonly string[]> = {
	ideation:       ["specification"],
	specification:  ["development"],
	development:    ["testing"],
	testing:        ["release", "development"],
	release:        ["deprecated"],
	deprecated:     [],
};

// ── Template registry ───────────────────────────────────────────────

const TEMPLATES: Record<EntityType, LifecycleTemplate> = {
	project: {
		entityType: "project",
		states: PROJECT_STATES,
		transitions: PROJECT_TRANSITIONS,
		initialState: "inception",
		terminalStates: ["archived"],
	},
	product: {
		entityType: "product",
		states: PRODUCT_STATES,
		transitions: PRODUCT_TRANSITIONS,
		initialState: "concept",
		terminalStates: ["sunset"],
	},
	feature: {
		entityType: "feature",
		states: FEATURE_STATES,
		transitions: FEATURE_TRANSITIONS,
		initialState: "ideation",
		terminalStates: ["deprecated"],
	},
};

// ── Public API ──────────────────────────────────────────────────────

/** Get the lifecycle template for an entity type. */
export function getTemplate(entityType: EntityType): LifecycleTemplate {
	return TEMPLATES[entityType];
}

/** Get valid next states from the current state. */
export function getValidTransitions(template: LifecycleTemplate, currentState: string): readonly string[] {
	return template.transitions[currentState] ?? [];
}

/** Validate whether a transition from one state to another is allowed. */
export function validateTransition(template: LifecycleTemplate, from: string, to: string): TransitionResult {
	const validTargets = template.transitions[from];
	if (!validTargets) {
		return { success: false, error: `Unknown state "${from}" for ${template.entityType} lifecycle.` };
	}
	if (!validTargets.includes(to)) {
		const allowed = validTargets.length > 0 ? validTargets.join(", ") : "none (terminal state)";
		return { success: false, error: `Cannot transition from "${from}" to "${to}". Valid transitions: ${allowed}.` };
	}
	return { success: true, from, to };
}

/** Check whether a state is terminal (no outgoing transitions). */
export function isTerminal(template: LifecycleTemplate, state: string): boolean {
	return template.terminalStates.includes(state);
}
