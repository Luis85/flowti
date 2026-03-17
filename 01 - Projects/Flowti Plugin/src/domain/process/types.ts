/**
 * Types for the Process Management domain.
 *
 * Defines the entity model for canvas-based process modeling:
 * process definitions, node types, edges, validation, and phase mapping.
 */

import type { FeatureStage } from "../featureLifecycle/types";

// ─────────────────────────────────────────────────────────────
// Process Node Types
// ─────────────────────────────────────────────────────────────

/** Phase 1 process node types. */
export type ProcessNodeType = "start" | "activity" | "decision" | "end";

/** All Phase 1 node types in order. */
export const PROCESS_NODE_TYPES: readonly ProcessNodeType[] = [
	"start", "activity", "decision", "end",
] as const;

/** Canvas title token prefixes for detecting node types. */
export const NODE_TYPE_TOKENS: Record<ProcessNodeType, string> = {
	start: "●",
	activity: "■",
	decision: "◇",
	end: "⦿",
};

/** Reverse lookup: token → node type. */
export const TOKEN_TO_NODE_TYPE: Record<string, ProcessNodeType> = {
	"●": "start",
	"■": "activity",
	"◇": "decision",
	"⦿": "end",
};

/** Display labels for node types. */
export const NODE_TYPE_LABELS: Record<ProcessNodeType, string> = {
	start: "Start",
	activity: "Activity",
	decision: "Decision",
	end: "End",
};

// ─────────────────────────────────────────────────────────────
// Process Graph
// ─────────────────────────────────────────────────────────────

/** Metadata parsed from fenced YAML in a node body. */
export interface ProcessNodeMetadata {
	/** Phase number (1-10) for lifecycle activities */
	phase?: number;
	/** Role or responsible party */
	role?: string;
	/** Description of the node */
	description?: string;
	/** Gate name required at this step */
	gate?: string;
	/** Arbitrary extra fields */
	[key: string]: unknown;
}

/** A node in a process definition. */
export interface ProcessNode {
	/** Unique node ID (from canvas) */
	id: string;
	/** Node type (start, activity, decision, end) */
	type: ProcessNodeType;
	/** Display name (title without token prefix) */
	name: string;
	/** Metadata parsed from fenced YAML block */
	metadata: ProcessNodeMetadata;
	/** Canvas position x */
	x: number;
	/** Canvas position y */
	y: number;
}

/** An edge connecting two nodes. */
export interface ProcessEdge {
	/** Source node ID */
	fromNode: string;
	/** Target node ID */
	toNode: string;
	/** Optional edge label (e.g., "Yes"/"No" for decisions) */
	label?: string;
}

/** A complete process definition parsed from a canvas file. */
export interface ProcessDefinition {
	/** Process name (derived from file name) */
	name: string;
	/** Canvas file path relative to vault root */
	filePath: string;
	/** All nodes in the process */
	nodes: ProcessNode[];
	/** All edges connecting nodes */
	edges: ProcessEdge[];
}

// ─────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────

/** Severity of a validation finding. */
export type ValidationSeverity = "error" | "warning" | "info";

/** A single validation finding. */
export interface ValidationFinding {
	/** Rule identifier (e.g. "PM-STRUCT-001") */
	ruleId: string;
	/** Finding severity */
	severity: ValidationSeverity;
	/** Human-readable message */
	message: string;
	/** Related node ID (if applicable) */
	nodeId?: string;
}

/** Aggregate validation result for a process. */
export interface ValidationResult {
	/** All findings from validation */
	findings: ValidationFinding[];
	/** Count of error-level findings */
	errorCount: number;
	/** Count of warning-level findings */
	warningCount: number;
	/** Count of info-level findings */
	infoCount: number;
	/** True if no error-level findings */
	valid: boolean;
}

// ─────────────────────────────────────────────────────────────
// Phase Mapping
// ─────────────────────────────────────────────────────────────

/** A lifecycle phase in the Development Lifecycle. */
export interface LifecyclePhase {
	/** Phase number (1-10) */
	phase: number;
	/** Phase name */
	name: string;
	/** Feature stage this phase belongs to */
	stage: FeatureStage;
	/** Brief description */
	description: string;
}

/** The 10 Development Lifecycle phases mapped to 6 feature stages. */
export const LIFECYCLE_PHASES: readonly LifecyclePhase[] = [
	{ phase: 1, name: "Feedback & Intake", stage: "idea", description: "Capture ideas, signals, and user feedback" },
	{ phase: 2, name: "Problem Discovery", stage: "draft", description: "Define the problem space and user pains" },
	{ phase: 3, name: "Solution Design", stage: "draft", description: "Design the solution approach and architecture" },
	{ phase: 4, name: "Readiness Review", stage: "approved", description: "Validate readiness via FRI and gate checks" },
	{ phase: 5, name: "Backlog Refinement", stage: "approved", description: "Break down into PBIs and plan increments" },
	{ phase: 6, name: "Development", stage: "in-progress", description: "Implement in incremental cycles" },
	{ phase: 7, name: "Quality Assurance", stage: "in-progress", description: "Test, validate, and ensure quality" },
	{ phase: 8, name: "Review & Acceptance", stage: "review", description: "Three Amigos review and TASM scoring" },
	{ phase: 9, name: "Release & Deploy", stage: "review", description: "Package, distribute, and deploy" },
	{ phase: 10, name: "Feedback Loop", stage: "done", description: "Collect feedback and close the loop" },
] as const;

// ─────────────────────────────────────────────────────────────
// Process Compliance
// ─────────────────────────────────────────────────────────────

/** Compliance status for a single process step. */
export interface StepCompliance {
	/** Phase number */
	phase: number;
	/** Phase name */
	name: string;
	/** Whether evidence exists for this step */
	satisfied: boolean;
	/** Description of evidence (if any) */
	evidence?: string;
}

/** Aggregate compliance for a feature against a process. */
export interface ProcessCompliance {
	/** Feature name */
	featureName: string;
	/** Process name */
	processName: string;
	/** Per-step compliance */
	steps: StepCompliance[];
	/** Percentage of steps satisfied (0-100) */
	percentage: number;
}
