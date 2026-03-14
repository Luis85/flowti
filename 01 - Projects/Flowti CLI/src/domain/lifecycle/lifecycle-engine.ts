/**
 * lifecycle-engine.ts — Pure state machine for entity lifecycles.
 *
 * No side effects, no deps — just state validation and transition logic.
 * Supports both built-in templates (project/product/feature) and
 * JSON-loaded templates with optional quality gates.
 */

import type { ProjectLifecycleState, ProductLifecycleState, FeatureLifecycleState } from "../../infrastructure/types.js";
import type { LifecycleTemplate, TransitionResult, GateDefinition, GateResult, GatedTransitionResult } from "./lifecycle-types.js";

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

const TEMPLATES = new Map<string, LifecycleTemplate>([
	["project", {
		entityType: "project",
		states: PROJECT_STATES,
		transitions: PROJECT_TRANSITIONS,
		initialState: "inception",
		terminalStates: ["archived"],
	}],
	["product", {
		entityType: "product",
		states: PRODUCT_STATES,
		transitions: PRODUCT_TRANSITIONS,
		initialState: "concept",
		terminalStates: ["sunset"],
	}],
	["feature", {
		entityType: "feature",
		states: FEATURE_STATES,
		transitions: FEATURE_TRANSITIONS,
		initialState: "ideation",
		terminalStates: ["deprecated"],
	}],
]);

// ── Public API ──────────────────────────────────────────────────────

/** Get the lifecycle template for an entity type. Returns undefined if not registered. */
export function getTemplate(entityType: string): LifecycleTemplate | undefined {
	return TEMPLATES.get(entityType);
}

/** Register a lifecycle template at runtime (e.g., loaded from JSON). */
export function registerTemplate(template: LifecycleTemplate): void {
	TEMPLATES.set(template.entityType, template);
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

/** Get exit gates for a state. Returns empty array if no gates defined. */
export function getGates(template: LifecycleTemplate, state: string): readonly GateDefinition[] {
	return template.gates?.[state] ?? [];
}

/** Validate a transition including quality gate evaluation. */
export function validateGatedTransition(
	template: LifecycleTemplate,
	from: string,
	to: string,
	evaluator: (gateId: string) => GateResult,
): GatedTransitionResult {
	const base = validateTransition(template, from, to);
	if (!base.success) return base;

	// Skip exit gates when cancelling — cancellation should always be allowed
	if (to === "cancelled") return { ...base, gateResults: [] };

	const gateDefs = getGates(template, from);
	if (gateDefs.length === 0) return { ...base, gateResults: [] };

	const gateResults = gateDefs.map((g) => evaluator(g.id));
	const failed = gateResults.filter((r) => !r.passed);

	if (failed.length > 0) {
		const reasons = failed.map((r) => r.message ?? r.gateId).join("; ");
		return { success: false, error: `Gates failed: ${reasons}`, from, to, gateResults };
	}

	return { ...base, gateResults };
}

function parseStates(statesObj: unknown): { states: string[]; transitions: Record<string, readonly string[]>; labels: Record<string, string> } | null {
	if (!statesObj || typeof statesObj !== "object") return null;
	const entries = statesObj as Record<string, unknown>;
	const states = Object.keys(entries);
	if (states.length === 0) return null;

	const transitions: Record<string, readonly string[]> = {};
	const labels: Record<string, string> = {};
	for (const name of states) {
		const entry = entries[name];
		if (!entry || typeof entry !== "object") return null;
		const e = entry as Record<string, unknown>;
		if (!Array.isArray(e.transitions)) return null;
		transitions[name] = e.transitions as string[];
		if (typeof e.label === "string") labels[name] = e.label;
	}
	return { states, transitions, labels };
}

function parseGates(raw: unknown): Record<string, GateDefinition[]> | undefined {
	if (!raw || typeof raw !== "object") return undefined;
	const result: Record<string, GateDefinition[]> = {};
	for (const [state, defs] of Object.entries(raw as Record<string, unknown>)) {
		if (!Array.isArray(defs)) return undefined;
		result[state] = defs.map((d) => {
			if (!d || typeof d !== "object") return null;
			const gd = d as Record<string, unknown>;
			if (typeof gd.id !== "string" || typeof gd.label !== "string") return null;
			return { id: gd.id, label: gd.label };
		}).filter((g): g is GateDefinition => g !== null);
	}
	return result;
}

/** Parse and validate a raw JSON object into a LifecycleTemplate. Returns null if invalid. */
export function loadTemplate(raw: unknown): LifecycleTemplate | null {
	if (!raw || typeof raw !== "object") return null;
	const obj = raw as Record<string, unknown>;

	const entityType = obj.entityType;
	if (typeof entityType !== "string") return null;

	const initialState = obj.initialState;
	if (typeof initialState !== "string") return null;

	const terminalStates = obj.terminalStates;
	if (!Array.isArray(terminalStates) || !terminalStates.every((s) => typeof s === "string")) return null;

	const parsed = parseStates(obj.states);
	if (!parsed) return null;
	if (!parsed.states.includes(initialState)) return null;

	const gates = parseGates(obj.gates);

	return { entityType, states: parsed.states, transitions: parsed.transitions, initialState, terminalStates, labels: parsed.labels, gates };
}
