/**
 * Types for Canvas Session monitoring.
 *
 * A CanvasSession tracks structured canvas work: goal, template used,
 * node operations, and an activity feed.
 */

export interface CanvasSessionState {
	/** ID of the linked Session (from SessionService). */
	sessionId: string;
	/** User-defined session goal. */
	goal: string;
	/** Template ID used to create the canvas (if any). */
	templateId: string | null;
	/** Template display name. */
	templateName: string | null;
	/** Path to the canvas file in the vault. */
	canvasPath: string;
	/** Node operation counters. */
	stats: CanvasSessionStats;
	/** Chronological activity feed (newest first). */
	activities: CanvasActivity[];
	/** Ordered list of phase IDs from the template. */
	phases: CanvasSessionPhase[];
	/** Index of the currently active phase (-1 = none). */
	activePhaseIndex: number;
}

export interface CanvasSessionStats {
	nodesAdded: number;
	nodesModified: number;
	edgesAdded: number;
}

export interface CanvasActivity {
	timestamp: string;
	action: CanvasActivityAction;
	detail: string;
}

export type CanvasActivityAction =
	| "node-added"
	| "node-modified"
	| "edge-added"
	| "phase-changed"
	| "goal-set"
	| "session-started"
	| "session-paused"
	| "session-resumed"
	| "session-completed";

export interface CanvasSessionPhase {
	id: string;
	label: string;
	/** Whether this phase has been visited. */
	visited: boolean;
}

/** Maximum activity feed entries before trimming. */
export const MAX_ACTIVITIES = 50;
