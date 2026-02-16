/**
 * Types for the Session domain.
 *
 * Defines the Session entity, persisted state shape,
 * session types, and constants.
 */

// ─────────────────────────────────────────────────────────────
// Session Types
// ─────────────────────────────────────────────────────────────

/** Available documentation session types. */
export type SessionType =
	| "event-storming"
	| "service-design"
	| "requirements-refinement"
	| "backlog-structuring"
	| "knowledge-cleanup";

/** Human-readable labels for each session type. */
export const SESSION_TYPES: ReadonlyArray<{ type: SessionType; label: string; description: string }> = [
	{ type: "event-storming", label: "Event Storming", description: "Discover and map domain events" },
	{ type: "service-design", label: "Service Design", description: "Design service boundaries and contracts" },
	{ type: "requirements-refinement", label: "Requirements Refinement", description: "Refine and clarify requirements" },
	{ type: "backlog-structuring", label: "Backlog Structuring", description: "Organize and prioritize backlog items" },
	{ type: "knowledge-cleanup", label: "Knowledge Cleanup", description: "Consolidate and clean up documentation" },
];

// ─────────────────────────────────────────────────────────────
// Session Status
// ─────────────────────────────────────────────────────────────

/** Lifecycle states for a session. */
export type SessionStatus = "prepared" | "active" | "paused" | "completed" | "archived";

// ─────────────────────────────────────────────────────────────
// Entity
// ─────────────────────────────────────────────────────────────

/** An artifact produced or modified during a session. */
export interface SessionArtifact {
	path: string;
	action: "created" | "modified";
	timestamp: string;
}

/** A time-boxed documentation session. */
export interface Session {
	id: string;
	type: SessionType;
	title: string;
	status: SessionStatus;
	/** Duration in minutes (e.g. 25 or 50). */
	durationMinutes: number;
	createdAt: string;
	/** ISO timestamp when timer was last started. Null when paused or not yet started. */
	startedAt: string | null;
	/** ISO timestamp when paused. Null when active or not yet paused. */
	pausedAt: string | null;
	/** Accumulated elapsed time from previous active segments (ms). */
	elapsedBeforePauseMs: number;
	/** ISO timestamp when session was completed. */
	completedAt: string | null;
	artifacts: SessionArtifact[];
	notes: string;
}

// ─────────────────────────────────────────────────────────────
// Persisted state
// ─────────────────────────────────────────────────────────────

/** Shape of the session state persisted via TypedStorage. */
export interface SessionState {
	sessions: Session[];
	activeSessionId: string | null;
}

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

/** Maximum number of sessions before oldest-first eviction. */
export const MAX_SESSIONS = 200;

/** Deduplication window for artifact tracking (ms). */
export const ARTIFACT_DEDUP_WINDOW_MS = 1000;
