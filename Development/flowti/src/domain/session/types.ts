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
	| "documentation"
	| "vault-hygiene"
	| "event-storming"
	| "service-design"
	| "domain-design"
	| "requirements-refinement"
	| "backlog-structuring"
	| "knowledge-cleanup"
	| "daily-tracking";

/** Human-readable labels for each session type. */
export const SESSION_TYPES: ReadonlyArray<{ type: SessionType; label: string; description: string }> = [
	{ type: "documentation", label: "Documentation", description: "Document systems, processes, and decisions" },
	{ type: "vault-hygiene", label: "Vault Hygiene", description: "Clean up, reorganize, and maintain vault health" },
	{ type: "event-storming", label: "Event Storming", description: "Discover and map domain events" },
	{ type: "service-design", label: "Service Design", description: "Design service boundaries and contracts" },
	{ type: "domain-design", label: "Domain Design", description: "Design bounded contexts and domain models" },
	{ type: "requirements-refinement", label: "Requirements Refinement", description: "Refine and clarify requirements" },
	{ type: "backlog-structuring", label: "Backlog Structuring", description: "Organize and prioritize backlog items" },
	{ type: "knowledge-cleanup", label: "Knowledge Cleanup", description: "Consolidate and clean up documentation" },
];

// ─────────────────────────────────────────────────────────────
// Session Type Configuration
// ─────────────────────────────────────────────────────────────

/** Configuration for a session type with defaults and guiding questions. */
export interface SessionTypeConfig {
	type: SessionType;
	label: string;
	icon: string;
	guidingQuestions: string[];
	defaultDuration: number;
	defaultGoals: string[];
	color?: string;
	/** Optional closure template override for this session type (3-tier inheritance). */
	closureTemplate?: ClosureTemplate;
}

/** Pre-built session type configurations. */
export const SESSION_TYPE_CONFIGS: Record<SessionType, SessionTypeConfig> = {
	"documentation": {
		type: "documentation",
		label: "Documentation",
		icon: "file-text",
		guidingQuestions: ["What needs to be documented?", "What is the current gap?"],
		defaultDuration: 25,
		defaultGoals: [],
	},
	"event-storming": {
		type: "event-storming",
		label: "Event Storming",
		icon: "zap",
		guidingQuestions: ["What events does this domain produce?", "What triggers each event?"],
		defaultDuration: 50,
		defaultGoals: [],
	},
	"service-design": {
		type: "service-design",
		label: "Service Design",
		icon: "server",
		guidingQuestions: ["What services does this domain expose?", "What are the contracts?"],
		defaultDuration: 50,
		defaultGoals: [],
	},
	"domain-design": {
		type: "domain-design",
		label: "Domain Design",
		icon: "boxes",
		guidingQuestions: ["What are the bounded contexts?", "What entities belong here?", "What events cross boundaries?"],
		defaultDuration: 50,
		defaultGoals: [],
	},
	"requirements-refinement": {
		type: "requirements-refinement",
		label: "Requirements Refinement",
		icon: "check-square",
		guidingQuestions: ["What are the acceptance criteria?", "What edge cases exist?"],
		defaultDuration: 25,
		defaultGoals: [],
	},
	"backlog-structuring": {
		type: "backlog-structuring",
		label: "Backlog Structuring",
		icon: "list-ordered",
		guidingQuestions: ["What are the priorities?", "What delivers the most value first?"],
		defaultDuration: 25,
		defaultGoals: [],
	},
	"knowledge-cleanup": {
		type: "knowledge-cleanup",
		label: "Knowledge Cleanup",
		icon: "book-open",
		guidingQuestions: ["What is outdated?", "What is missing?", "What is duplicated?"],
		defaultDuration: 25,
		defaultGoals: [],
	},
	"vault-hygiene": {
		type: "vault-hygiene",
		label: "Vault Hygiene",
		icon: "hard-drive",
		guidingQuestions: ["What files are orphaned?", "What links are broken?", "What needs reorganizing?"],
		defaultDuration: 15,
		defaultGoals: [],
	},
	"daily-tracking": {
		type: "daily-tracking",
		label: "Daily Tracking",
		icon: "calendar",
		guidingQuestions: [],
		defaultDuration: 0,
		defaultGoals: [],
	},
};

// ─────────────────────────────────────────────────────────────
// Session Status
// ─────────────────────────────────────────────────────────────

/** Lifecycle states for a session (v1 — includes legacy "active"). */
export type SessionStatus = "prepared" | "active" | "paused" | "completed" | "archived" | "running" | "reviewing";

/** Canonical v2 lifecycle states (ADR-031). "active" is legacy; use "running". */
export type SessionStatusV2 = "prepared" | "running" | "paused" | "reviewing" | "completed" | "archived";

// ─────────────────────────────────────────────────────────────
// Entity
// ─────────────────────────────────────────────────────────────

/** An artifact produced or modified during a session. */
export interface SessionArtifact {
	path: string;
	action: "created" | "modified";
	timestamp: string;
}

/** Actions tracked in the session activity log. */
export type SessionActivityAction = "created" | "modified" | "opened" | "deleted" | "renamed";

/** A vault file event tracked during an active session (see ADR-025). */
export interface SessionActivity {
	timestamp: string;     // ISO 8601
	action: SessionActivityAction;
	path: string;
	oldPath?: string;      // for renames only
}

/** Actions recorded in the session timeline. */
export type SessionTimelineAction = "started" | "paused" | "resumed" | "reviewing" | "completed";

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

/** A structured decision recorded during a session. */
export interface SessionDecision {
	id: string;
	title: string;
	description?: string;
	recordedAt: string; // ISO 8601
	context?: string;
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

/** Type of context binding attached to a session. */
export type ContextBindingType = "domain" | "feature" | "product" | "file" | "folder";

/** Ordered list used for cycling through binding types in the UI. */
export const BINDING_TYPES: readonly ContextBindingType[] = ["file", "folder", "domain", "feature", "product"];

/** A context binding attached to a session workspace. */
export interface SessionContextBinding {
	id: string;
	type: ContextBindingType;
	label: string;
	path: string;
	boundAt: string; // ISO 8601
}

/** Snapshot of workspace state for save/restore on pause/resume. */
export interface WorkspaceState {
	openFiles: string[];
	activeFile: string | null;
	scrollPositions: Record<string, number>;
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
	/** Chronological vault activity log — separate from artifacts (see ADR-025). */
	activity: SessionActivity[];
	/** Per-session folder paths excluded from the activity log (see ADR-026). */
	activityFilter: string[];
	/** Context bindings scoping this session to vault entities. */
	contextBindings: SessionContextBinding[];
	/** Structured decisions recorded during this session. */
	decisions: SessionDecision[];
	/** Saved workspace state for restore on resume (null if never captured). */
	workspaceState: WorkspaceState | null;
	/** Output artifacts generated from this session (meeting invites, action items, etc.). */
	outputArtifacts: SessionOutputArtifact[];

	// ── v2 fields (ADR-031) ─────────────────────────────────
	/** Structured intent defined before starting (v2). Null for legacy sessions. */
	intent: SessionIntent | null;
	/** Energy level indicator (v2). Null if not set. */
	energy: EnergyLevel | null;
	/** Execution plan tasks (v2). */
	executionTasks: ExecutionTask[];
	/** Structured reflection entries (v2). */
	reflections: ReflectionEntry[];
	/** Closure ritual response (v2). Null until review is completed. */
	closureResponse: ClosureResponse | null;
}

// ─────────────────────────────────────────────────────────────
// Session Output Artifacts
// ─────────────────────────────────────────────────────────────

/** Available output artifact types. */
export type SessionOutputType = "meeting-invite" | "action-items" | "review-summary" | "custom";

/** A section within an output template. */
export interface SessionOutputSection {
	heading: string;
	placeholder: string;
}

/** A template for generating output artifacts from a session. */
export interface SessionOutputTemplate {
	type: SessionOutputType;
	title: string;
	description: string;
	sections: SessionOutputSection[];
}

/** A generated output artifact linked to a session. */
export interface SessionOutputArtifact {
	type: SessionOutputType;
	path: string;
	generatedAt: string; // ISO 8601
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
	/** Decision titles to pre-populate on sessions created from this template. */
	decisions?: string[];
	/** Execution task labels to pre-populate on sessions created from this template. */
	tasks?: string[];
	/** Context binding paths to pre-populate (stored as wikilink-compatible paths). */
	contextBindings?: Array<{ path: string; type: ContextBindingType }>;
	/** Notes text to pre-populate. */
	notes?: string;
	createdAt: number; // epoch ms
}

/** JSON-serializable shape for template import/export. */
export interface SessionTemplateExport {
	version: 1;
	template: Omit<SessionTemplate, "id" | "createdAt">;
}

// ─────────────────────────────────────────────────────────────
// Session v2 Types (ADR-031)
// ─────────────────────────────────────────────────────────────

/** Session execution mode — determines UI behavior and defaults. */
export type SessionMode = "deep-work" | "planning" | "workshop" | "review" | "exploration";

/** Energy level indicator (1 = drained, 5 = energized). */
export type EnergyLevel = 1 | 2 | 3 | 4 | 5;

/** Structured intent defined before starting a session. */
export interface SessionIntent {
	primaryOutcome: string;
	whyItMatters?: string;
	mode: SessionMode;
}

/** A task in the session execution plan. */
export interface ExecutionTask {
	id: string;
	label: string;
	completed: boolean;
	completedAt?: string; // ISO 8601
	order: number;
}

/** A structured reflection entry recorded during a session. */
export interface ReflectionEntry {
	id: string;
	type: "observation" | "blocker" | "idea" | "decision";
	content: string;
	timestamp: string; // ISO 8601
}

/** User's response to the closure ritual questions. */
export interface ClosureResponse {
	outcomeAchieved: "yes" | "partial" | "no";
	whatWorked: string;
	whatDidnt: string;
	nextAction: string;
	answers: Record<string, string>;
}

/** A single question in a closure template. */
export interface ClosureQuestion {
	id: string;
	question: string;
	type: "text" | "select" | "rating";
	required: boolean;
	options?: string[];
}

/** Configurable closure ritual template (3-tier: global → type → instance). */
export interface ClosureTemplate {
	questions: ClosureQuestion[];
	requiredFields: string[];
}

/** Thresholds for cognitive overload detection (FR-16). */
export interface CognitiveLoadThresholds {
	maxTasks: number;
	maxBindings: number;
	maxDurationMinutes: number;
	lowEnergyThreshold: EnergyLevel;
}

/** Result of cognitive overload detection (FR-16). */
export interface OverloadResult {
	overloaded: boolean;
	reasons: string[];
}

/** Default thresholds for cognitive overload detection. */
export const DEFAULT_COGNITIVE_LOAD_THRESHOLDS: CognitiveLoadThresholds = {
	maxTasks: 5,
	maxBindings: 8,
	maxDurationMinutes: 120,
	lowEnergyThreshold: 2 as EnergyLevel,
};

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

/** Maximum activity entries per session before oldest-first eviction. */
export const MAX_SESSION_ACTIVITY = 1000;

/** Deduplication window for activity tracking (ms). */
export const ACTIVITY_DEDUP_WINDOW_MS = 1000;

/** Maximum number of context bindings per session. */
export const MAX_CONTEXT_BINDINGS = 10;

/** Maximum number of decisions per session. */
export const MAX_SESSION_DECISIONS = 100;

/** Maximum number of output artifacts per session. */
export const MAX_OUTPUT_ARTIFACTS = 20;

/** Vault folder where session notes (persistent markdown files) are stored. */
export const SESSION_NOTES_FOLDER = "03 - Resources/Sessions";

/** Debounce delay (ms) for syncing session state to/from the notes file. */
export const SESSION_NOTES_SYNC_DELAY_MS = 500;
