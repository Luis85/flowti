/**
 * Session utility functions: state machine, cognitive overload detection,
 * closure templates, type resolution, activity filtering, and factory functions.
 */

import type { CognitiveLoadThresholds, ClosureTemplate, ContextBindingType, ExecutionTask, OverloadResult, Session, SessionContextBinding, SessionDecision, SessionGoal, SessionStatusV2, SessionTemplate, SessionType, SessionTypeConfig } from "./types";
import { DEFAULT_COGNITIVE_LOAD_THRESHOLDS, SESSION_TYPE_CONFIGS } from "./types";

// ── Session v2 State Machine (ADR-031) ───────────────────────

/** Valid state transitions for the v2 session lifecycle. */
const VALID_TRANSITIONS: Record<SessionStatusV2, readonly SessionStatusV2[]> = {
	prepared:  ["running"],
	running:   ["paused", "reviewing"],
	paused:    ["running"],
	reviewing: ["completed"],
	completed: ["archived"],
	archived:  [],
};

/**
 * Checks whether a session status transition is valid per the v2 lifecycle.
 * Returns `true` only for transitions defined in the state machine.
 */
export function isValidTransition(from: SessionStatusV2, to: SessionStatusV2): boolean {
	return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

// ── Cognitive Overload Detection (FR-16) ─────────────────────

/**
 * Detects cognitive overload by comparing session state against thresholds.
 * Pure function — no side effects. Returns reasons for each exceeded threshold.
 */
export function detectCognitiveOverload(
	session: Session,
	thresholds: CognitiveLoadThresholds = DEFAULT_COGNITIVE_LOAD_THRESHOLDS,
): OverloadResult {
	const reasons: string[] = [];

	// Task count
	if (session.executionTasks.length > thresholds.maxTasks) {
		reasons.push(`Too many tasks (${session.executionTasks.length}/${thresholds.maxTasks})`);
	}

	// Context binding count
	if (session.contextBindings.length > thresholds.maxBindings) {
		reasons.push(`Too many context bindings (${session.contextBindings.length}/${thresholds.maxBindings})`);
	}

	// Duration exceeded
	if (session.startedAt) {
		const elapsedMs = Date.now() - new Date(session.startedAt).getTime() - (session.elapsedBeforePauseMs ?? 0);
		const maxMs = thresholds.maxDurationMinutes * 60_000;
		if (elapsedMs > maxMs) {
			reasons.push(`Session duration exceeded (>${thresholds.maxDurationMinutes}min)`);
		}
	}

	// Compound: low energy + high task load
	if (
		session.energy !== null &&
		session.energy <= thresholds.lowEnergyThreshold &&
		session.executionTasks.length > 3
	) {
		reasons.push(`Low energy (${session.energy}/5) with ${session.executionTasks.length} tasks`);
	}

	return { overloaded: reasons.length > 0, reasons };
}

// ── Closure Ritual Helpers (FR-14) ────────────────────────────

/** Default closure ritual template with 4 standard questions. */
export const DEFAULT_CLOSURE_TEMPLATE: ClosureTemplate = {
	questions: [
		{ id: "outcome", question: "Did you achieve your intended outcome?", type: "select", required: true, options: ["yes", "partial", "no"] },
		{ id: "what-worked", question: "What worked well?", type: "text", required: false },
		{ id: "what-didnt", question: "What didn't work?", type: "text", required: false },
		{ id: "next-action", question: "What's the next action?", type: "text", required: true },
	],
	requiredFields: ["outcome", "next-action"],
};

/**
 * Resolves the closure template for a session using 3-tier inheritance:
 * 1. Session type config override (if defined)
 * 2. Global override (if provided)
 * 3. Default template (fallback)
 */
export function resolveClosureTemplate(
	session: Session,
	globalTemplate?: ClosureTemplate,
	typeTemplates?: Record<string, ClosureTemplate>,
): ClosureTemplate {
	if (typeTemplates?.[session.type]) return typeTemplates[session.type];
	if (globalTemplate) return globalTemplate;
	return DEFAULT_CLOSURE_TEMPLATE;
}

// ── Execution Task Helpers (FR-12) ───────────────────────────

/**
 * Returns progress stats for an execution task list.
 * Pure function — no side effects.
 */
export function getTaskProgress(tasks: ExecutionTask[]): { completed: number; total: number; percent: number } {
	const total = tasks.length;
	if (total === 0) return { completed: 0, total: 0, percent: 0 };
	const completed = tasks.filter((t) => t.completed).length;
	return { completed, total, percent: Math.round((completed / total) * 100) };
}

// ── Session Type Resolution ──────────────────────────────────

/**
 * Resolves the configuration for a session type.
 * Custom configs take priority over built-in configs.
 * Returns the built-in "documentation" config as fallback for unknown types.
 */
export function resolveTypeConfig(
	type: SessionType,
	customConfigs?: Record<string, SessionTypeConfig>,
): SessionTypeConfig {
	if (customConfigs && customConfigs[type]) {
		return customConfigs[type];
	}
	return SESSION_TYPE_CONFIGS[type] ?? SESSION_TYPE_CONFIGS["documentation"];
}

// ── Activity filtering (ADR-026) ─────────────────────────────

/**
 * Check if a file path is excluded by global or per-session folder filters.
 * A path is excluded if it starts with any filter prefix.
 */
export function isExcluded(path: string, globalFilter: string[], perSessionFilter: string[]): boolean {
	for (const prefix of globalFilter) {
		if (prefix && path.startsWith(prefix)) return true;
	}
	for (const prefix of perSessionFilter) {
		if (prefix && path.startsWith(prefix)) return true;
	}
	return false;
}

// ── Factory Functions ────────────────────────────────────────

/**
 * Creates a new Session object with default values.
 */
export function createSession(
	id: string,
	type: SessionType,
	title: string,
	durationMinutes: number,
	focusFile?: string,
): Session {
	return {
		id,
		type,
		title,
		status: "prepared",
		durationMinutes,
		createdAt: new Date().toISOString(),
		startedAt: null,
		pausedAt: null,
		elapsedBeforePauseMs: 0,
		completedAt: null,
		artifacts: [],
		notes: "",
		focusFile: focusFile ?? null,
		timeline: [],
		goals: [],
		links: [],
		notesFile: null,
		canvasFile: null,
		activity: [],
		activityFilter: [],
		contextBindings: [],
		decisions: [],
		workspaceState: null,
		outputArtifacts: [],
		featureName: null,
		intent: null,
		energy: null,
		executionTasks: [],
		reflections: [],
		closureResponse: null,
	};
}

/**
 * Creates a new SessionContextBinding, auto-deriving label from the path basename.
 */
export function createContextBinding(
	id: string,
	type: ContextBindingType,
	path: string,
): SessionContextBinding {
	const segments = path.replace(/\/$/, "").split("/");
	const last = segments[segments.length - 1] ?? path;
	const label = last.includes(".") ? last.replace(/\.[^.]+$/, "") : last;
	return { id, type, label, path, boundAt: new Date().toISOString() };
}

/**
 * Creates a new SessionGoal with default values.
 */
export function createGoal(id: string, text: string): SessionGoal {
	return {
		id,
		text,
		completed: false,
		completedAt: null,
	};
}

/**
 * Creates a new SessionDecision.
 */
export function createDecision(id: string, title: string, description?: string, context?: string): SessionDecision {
	return {
		id,
		title,
		description,
		recordedAt: new Date().toISOString(),
		context,
	};
}

// ── Path Reconciliation ──────────────────────────────────────

/**
 * Updates all paths in a session when a file is renamed/moved.
 * Returns true if any path was updated.
 */
export function updateSessionPathsForFileMove(session: Session, oldPath: string, newPath: string): boolean {
	let hit = false;
	if (session.focusFile === oldPath) { session.focusFile = newPath; hit = true; }
	if (session.notesFile === oldPath) { session.notesFile = newPath; hit = true; }
	if (session.canvasFile === oldPath) { session.canvasFile = newPath; hit = true; }
	for (const binding of session.contextBindings) {
		if (binding.path === oldPath) { binding.path = newPath; hit = true; }
	}
	for (const artifact of session.artifacts) {
		if (artifact.path === oldPath) { artifact.path = newPath; hit = true; }
	}
	for (const link of session.links) {
		if (link.path === oldPath) { link.path = newPath; hit = true; }
	}
	return hit;
}

/**
 * Updates all paths in a session when a folder is renamed/moved.
 * Uses prefix matching to catch all children under the folder.
 * Returns true if any path was updated.
 */
export function updateSessionPathsForFolderMove(session: Session, oldPath: string, newPath: string): boolean {
	let hit = false;
	const oldPrefix = oldPath + "/";

	if (session.focusFile && session.focusFile.startsWith(oldPrefix)) {
		session.focusFile = newPath + session.focusFile.slice(oldPath.length); hit = true;
	}
	if (session.notesFile && session.notesFile.startsWith(oldPrefix)) {
		session.notesFile = newPath + session.notesFile.slice(oldPath.length); hit = true;
	}
	if (session.canvasFile && session.canvasFile.startsWith(oldPrefix)) {
		session.canvasFile = newPath + session.canvasFile.slice(oldPath.length); hit = true;
	}
	for (const binding of session.contextBindings) {
		if (binding.path === oldPath + "/" || binding.path.startsWith(oldPrefix)) {
			binding.path = newPath + binding.path.slice(oldPath.length); hit = true;
		}
	}
	for (const artifact of session.artifacts) {
		if (artifact.path.startsWith(oldPrefix)) {
			artifact.path = newPath + artifact.path.slice(oldPath.length); hit = true;
		}
	}
	for (const link of session.links) {
		if (link.path.startsWith(oldPrefix)) {
			link.path = newPath + link.path.slice(oldPath.length); hit = true;
		}
	}
	for (let i = 0; i < session.activityFilter.length; i++) {
		if (session.activityFilter[i] === oldPath || session.activityFilter[i].startsWith(oldPrefix)) {
			session.activityFilter[i] = newPath + session.activityFilter[i].slice(oldPath.length); hit = true;
		}
	}
	return hit;
}

/**
 * Updates a template's focusFile when a file is renamed.
 * Returns true if the path was updated.
 */
export function updateTemplatePathForFileMove(tmpl: SessionTemplate, oldPath: string, newPath: string): boolean {
	if (tmpl.focusFile === oldPath) {
		tmpl.focusFile = newPath;
		return true;
	}
	return false;
}

/**
 * Updates a template's focusFile when a folder is renamed.
 * Returns true if the path was updated.
 */
export function updateTemplatePathForFolderMove(tmpl: SessionTemplate, oldPath: string, newPath: string): boolean {
	const oldPrefix = oldPath + "/";
	if (tmpl.focusFile && tmpl.focusFile.startsWith(oldPrefix)) {
		tmpl.focusFile = newPath + tmpl.focusFile.slice(oldPath.length);
		return true;
	}
	return false;
}
