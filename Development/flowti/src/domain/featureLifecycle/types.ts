/**
 * Types for the Feature Lifecycle domain.
 *
 * Defines the entity model for PRD-driven feature lifecycle management:
 * stages, gate checks, FRI scoring, prioritization, sessions, and reviews.
 */

// ─────────────────────────────────────────────────────────────
// Feature Stages
// ─────────────────────────────────────────────────────────────

/**
 * The 6 standardized feature stages.
 * PRDs flow through these stages from initial idea to completion.
 */
export type FeatureStage = "idea" | "draft" | "approved" | "in-progress" | "review" | "done";

/** Ordered list of stages for progression logic. */
export const FEATURE_STAGES: readonly FeatureStage[] = [
	"idea", "draft", "approved", "in-progress", "review", "done",
] as const;

/** Display labels for each stage. */
export const STAGE_LABELS: Record<FeatureStage, string> = {
	"idea": "Idea",
	"draft": "Draft",
	"approved": "Approved",
	"in-progress": "In Progress",
	"review": "Review",
	"done": "Done",
};

/**
 * Map of legacy stage values to their normalized equivalents.
 * Covers the 10+ inconsistent values found in existing PRD frontmatter.
 */
export const LEGACY_STAGE_MAP: Record<string, FeatureStage> = {
	"new": "idea",
	"open": "draft",
	"planned": "approved",
	"development": "in-progress",
	"active": "in-progress",
	"in_progress": "in-progress",
	"testing": "review",
	"completed": "done",
	"closed": "done",
	"shipped": "done",
	"delivered": "done",
	"deferred": "idea",
};

// ─────────────────────────────────────────────────────────────
// Gate Checks
// ─────────────────────────────────────────────────────────────

/** The 6 gate names aligned to stage transitions. */
export type GateName = "problem" | "design" | "readiness" | "build" | "quality" | "release";

/** Maps each stage to the gate that must pass to enter it. */
export const STAGE_GATE_MAP: Record<FeatureStage, GateName | null> = {
	"idea": null,
	"draft": "problem",
	"approved": "design",
	"in-progress": "readiness",
	"review": "build",
	"done": "quality",
};

/** Display labels for gates. */
export const GATE_LABELS: Record<GateName, string> = {
	"problem": "Problem Gate",
	"design": "Design Gate",
	"readiness": "Readiness Gate",
	"build": "Build Gate",
	"quality": "Quality Gate",
	"release": "Release Gate",
};

/** Severity of a gate check failure. */
export type GateCheckSeverity = "error" | "warning" | "info";

/** Result of a single gate check item. */
export interface GateCheckItem {
	/** Unique check identifier (e.g. "problem.prd_exists") */
	id: string;
	/** Human-readable description of the check */
	label: string;
	/** Whether the check passed */
	passed: boolean;
	/** Explanation when failed */
	reason?: string;
	/** Severity level */
	severity: GateCheckSeverity;
}

/** Aggregate result for a gate check. */
export interface GateCheckResult {
	/** Which gate was checked */
	gate: GateName;
	/** Individual check items */
	checks: GateCheckItem[];
	/** Overall pass (all checks passed) */
	passed: boolean;
}

// ─────────────────────────────────────────────────────────────
// FRI Scoring
// ─────────────────────────────────────────────────────────────

/** The 7 FRI dimensions. */
export type FRIDimension =
	| "strategy"
	| "scope"
	| "architecture"
	| "event_integration"
	| "data_model"
	| "ui_consistency"
	| "validation_testing";

/** Ordered list of FRI dimensions. */
export const FRI_DIMENSIONS: readonly FRIDimension[] = [
	"strategy",
	"scope",
	"architecture",
	"event_integration",
	"data_model",
	"ui_consistency",
	"validation_testing",
] as const;

/** Display labels for FRI dimensions. */
export const FRI_DIMENSION_LABELS: Record<FRIDimension, string> = {
	strategy: "Strategy",
	scope: "Scope",
	architecture: "Architecture",
	event_integration: "Event Integration",
	data_model: "Data Model",
	ui_consistency: "UI Consistency",
	validation_testing: "Validation & Testing",
};

/** FRI readiness level derived from total score. */
export type FRILevel = "not-ready" | "conceptual" | "technically-ready" | "integration-ready" | "production-ready";

/** FRI level thresholds: [minScore, level, label]. */
export const FRI_LEVEL_THRESHOLDS: readonly { min: number; level: FRILevel; label: string }[] = [
	{ min: 31, level: "production-ready", label: "Production Ready" },
	{ min: 26, level: "integration-ready", label: "Integration Ready" },
	{ min: 19, level: "technically-ready", label: "Technically Ready" },
	{ min: 11, level: "conceptual", label: "Conceptual" },
	{ min: 0, level: "not-ready", label: "Not Ready" },
] as const;

/** Per-dimension FRI scores. */
export type FRIScores = Record<FRIDimension, number>;

/** Computed FRI result. */
export interface FRIResult {
	/** Per-dimension scores (0-5 each) */
	dimensions: FRIScores;
	/** Sum of all dimensions (0-35) */
	total: number;
	/** Readiness level derived from total */
	level: FRILevel;
	/** Human-readable label */
	levelLabel: string;
}

// ─────────────────────────────────────────────────────────────
// Prioritization Scoring
// ─────────────────────────────────────────────────────────────

/** The 7 prioritization dimensions. */
export type PrioritizationDimension =
	| "business_value"
	| "implementation_cost"
	| "maintenance_cost"
	| "discovery_cost"
	| "design_cost"
	| "test_cost"
	| "priority";

/** Ordered list of prioritization dimensions. */
export const PRIORITIZATION_DIMENSIONS: readonly PrioritizationDimension[] = [
	"business_value",
	"implementation_cost",
	"maintenance_cost",
	"discovery_cost",
	"design_cost",
	"test_cost",
	"priority",
] as const;

/** Display labels for prioritization dimensions. */
export const PRIORITIZATION_LABELS: Record<PrioritizationDimension, string> = {
	business_value: "Business Value",
	implementation_cost: "Implementation Cost",
	maintenance_cost: "Maintenance Cost",
	discovery_cost: "Discovery Cost",
	design_cost: "Design Cost",
	test_cost: "Test Cost",
	priority: "Priority",
};

/** Per-dimension prioritization scores (null = not scored). */
export type PrioritizationScores = Record<PrioritizationDimension, number | null>;

/** Computed prioritization result. */
export interface PrioritizationResult {
	/** Per-dimension scores */
	dimensions: PrioritizationScores;
	/** Priority signal: business_value - avg(costs) */
	signal: number | null;
}

// ─────────────────────────────────────────────────────────────
// Session & Review Records
// ─────────────────────────────────────────────────────────────

/** Record of a work session on a feature. */
export interface FeatureSessionRecord {
	/** Feature this session was for */
	featureName: string;
	/** When the session started */
	startTime: string;
	/** When the session ended (null if still active) */
	endTime: string | null;
	/** Files created during the session */
	filesCreated: string[];
	/** Files modified during the session */
	filesModified: string[];
	/** Session notes */
	notes: string;
	/** Stage at session start */
	stageAtStart: FeatureStage;
	/** Stage at session end */
	stageAtEnd: FeatureStage | null;
}

/** Record of a Three Amigos review for a feature. */
export interface ReviewRecord {
	/** Feature this review was for */
	featureName: string;
	/** Review date */
	date: string;
	/** TASM total score (0-20) */
	tasmScore: number | null;
	/** Path to review document in vault */
	filePath: string;
}

// ─────────────────────────────────────────────────────────────
// Feature Entry (scanned from PRD)
// ─────────────────────────────────────────────────────────────

/** A PBI entry parsed from PRD backlog. */
export interface FeaturePBI {
	/** PBI identifier */
	id: string;
	/** PBI title */
	title: string;
	/** PBI stage */
	stage: string;
}

/** A feature entry assembled from PRD scanning. */
export interface FeatureEntry {
	/** Feature name (derived from PRD file name) */
	name: string;
	/** File path relative to vault root */
	filePath: string;
	/** Current lifecycle stage */
	stage: FeatureStage;
	/** Original stage value from frontmatter (before normalization) */
	rawStage: string;
	/** Domain the feature belongs to */
	domain: string;
	/** FRI scores (null if not yet scored) */
	fri: FRIResult | null;
	/** Prioritization scores (null if not yet scored) */
	prioritization: PrioritizationResult | null;
	/** PBIs from PRD backlog */
	pbis: FeaturePBI[];
	/** Related events declared in PRD */
	relatedEvents: string[];
	/** Maturity level string from frontmatter */
	maturity: string | null;
}

// ─────────────────────────────────────────────────────────────
// Persistence Shape
// ─────────────────────────────────────────────────────────────

/** Shape of persisted feature lifecycle state in TypedStorage. */
export interface FeatureLifecycleState {
	/** Session records across all features */
	sessions: FeatureSessionRecord[];
	/** Currently active session (null if none) */
	activeSession: { featureName: string; startTime: string } | null;
}

/** Default state for fresh storage. */
export const DEFAULT_FEATURE_LIFECYCLE_STATE: FeatureLifecycleState = {
	sessions: [],
	activeSession: null,
};
