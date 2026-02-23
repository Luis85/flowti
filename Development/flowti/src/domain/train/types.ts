/**
 * Types for the Train of Thoughts domain.
 *
 * A "Train" is a serial thought capture session. Each ThoughtNode
 * is a vault note linked to the previous one, forming a navigable chain.
 */

// ─────────────────────────────────────────────────────────────
// ThoughtNode — a single thought in a train
// ─────────────────────────────────────────────────────────────

/** Direction of a thought relationship. */
export type ThoughtDirection = "next" | "branch" | "merge";

/** Relationship between two thoughts in a train. */
export interface ThoughtRelation {
	fromId: string;
	toId: string;
	direction: ThoughtDirection;
}

/** Options for adding a thought to a train. */
export interface AddThoughtOptions {
	/** Link direction — "next" continues the chain, "branch" forks. Default: "next". */
	direction?: ThoughtDirection;
	/** ID of the thought to link from. Default: last thought in the train. */
	fromThoughtId?: string;
	/** Use an existing file path instead of creating a new note. */
	path?: string;
}

/** Status label for a branch origin node. */
export type BranchStatus = "exploring" | "stale" | "promising";

/** A single thought in a train. */
export interface ThoughtNode {
	id: string;
	trainId: string;
	title: string;
	/** Vault path to the created note. */
	path: string;
	/** ISO 8601 timestamp. */
	createdAt: string;
	/** Ordinal position in the train (0-based). */
	order: number;
	/** Optional status label for branch origin nodes. */
	branchStatus?: BranchStatus;
}

// ─────────────────────────────────────────────────────────────
// TrainState — a complete train session
// ─────────────────────────────────────────────────────────────

/** Status of a train capture session. */
export type TrainStatus = "running" | "paused" | "completed";

/** A complete Train of Thoughts capture session. */
export interface TrainState {
	id: string;
	/** The linked session ID (from SessionService). */
	sessionId: string;
	title: string;
	status: TrainStatus;
	thoughts: ThoughtNode[];
	relations: ThoughtRelation[];
	/** Timer duration in minutes (0 = unlimited / no timer). */
	durationMinutes: number;
	createdAt: string;
	pausedAt: string | null;
	completedAt: string | null;
	/** ID of the train that was paused when this one started (nesting). */
	parentTrainId?: string;
	/** Per-train subfolder path (e.g. "00 - Connectivity/trains/20260223-1430 My Train"). */
	folderPath?: string;
	/** Train type ID (e.g. "brainstorm", "research"). Undefined for legacy trains. */
	trainType?: string;
}

// ─────────────────────────────────────────────────────────────
// Persistence
// ─────────────────────────────────────────────────────────────

/** Shape of persisted data via TypedStorage. */
export interface TrainServiceState {
	trains: TrainState[];
}

// ─────────────────────────────────────────────────────────────
// Train Types
// ─────────────────────────────────────────────────────────────

/** Configuration for a train type. */
export interface TrainTypeConfig {
	id: string;
	label: string;
	icon: string;
	/** Default duration in minutes (0 = no timer). */
	defaultDuration: number;
}

/** Built-in train types available at creation. */
export const BUILT_IN_TRAIN_TYPES: readonly TrainTypeConfig[] = [
	{ id: "brainstorm", label: "Brainstorm", icon: "lightbulb", defaultDuration: 15 },
	{ id: "research", label: "Research", icon: "search", defaultDuration: 25 },
	{ id: "decision", label: "Decision", icon: "scale", defaultDuration: 10 },
	{ id: "free-form", label: "Free-form", icon: "pen-line", defaultDuration: 0 },
];

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

export const MAX_TRAINS = 100;
/** Absolute safety cap — user-facing limit is `trainMaxThoughts` in settings (default 100). */
export const MAX_THOUGHTS_PER_TRAIN = 500;
