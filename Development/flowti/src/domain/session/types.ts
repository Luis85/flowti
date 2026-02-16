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

/** Actions recorded in the session timeline. */
export type SessionTimelineAction = "started" | "paused" | "resumed" | "completed";

/** A single entry in the session timeline log. */
export interface SessionTimelineEntry {
	action: SessionTimelineAction;
	timestamp: string; // ISO 8601
}

/** A computed pause segment derived from timeline entries. */
export interface PauseSegment {
	pausedAt: string;
	resumedAt: string | null;
	durationMs: number;
}

/** Aggregated time statistics for a session. */
export interface TimelineSummary {
	wallClockMs: number;
	activeTimeMs: number;
	totalPauseMs: number;
	pauseCount: number;
	pauseSegments: PauseSegment[];
}

/** A goal defined for a session. */
export interface SessionGoal {
	id: string;
	text: string;
	completed: boolean;
	completedAt: string | null;
}

/** A user-linked file manually attached to a session. */
export interface SessionLink {
	path: string;
	addedAt: string; // ISO 8601
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
	/** Optional file path the user is focusing on during this session. */
	focusFile: string | null;
	/** Chronological log of lifecycle actions. */
	timeline: SessionTimelineEntry[];
	/** Session goals — checklist items for focused work. */
	goals: SessionGoal[];
	/** User-linked files manually attached to this session. */
	links: SessionLink[];
	/** Optional vault path for a dedicated session notes file. */
	notesFile: string | null;
	/** Optional vault path for a session canvas file. */
	canvasFile: string | null;
}

// ─────────────────────────────────────────────────────────────
// Session Templates
// ─────────────────────────────────────────────────────────────

/** A reusable session template created from a completed session. */
export interface SessionTemplate {
	id: string;
	name: string;
	type: SessionType;
	durationMinutes: number;
	description?: string;
	focusFile?: string;
	/** Goal texts to pre-populate on sessions created from this template. */
	goals?: string[];
	createdAt: number; // epoch ms
}

// ─────────────────────────────────────────────────────────────
// Persisted state
// ─────────────────────────────────────────────────────────────

/** Shape of the session state persisted via TypedStorage. */
export interface SessionState {
	sessions: Session[];
	activeSessionId: string | null;
	savedTemplates?: SessionTemplate[];
}

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

/** Maximum number of sessions before oldest-first eviction. */
export const MAX_SESSIONS = 200;

/** Maximum number of saved templates before oldest-first eviction. */
export const MAX_TEMPLATES = 50;

/** Deduplication window for artifact tracking (ms). */
export const ARTIFACT_DEDUP_WINDOW_MS = 1000;

/** Vault folder where session notes (persistent markdown files) are stored. */
export const SESSION_NOTES_FOLDER = "03 - Resources/Sessions";
