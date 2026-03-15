/**
 * journey-types.ts — Shared journey types compatible with Flowti Plugin format.
 *
 * These types define the journey definition schema used by both the CLI
 * and the Plugin. The CLI supports a subset of tools that work without
 * a running Obsidian instance.
 */

// ── Tool names ──────────────────────────────────────────────────────

/**
 * Base tool names available in every environment.
 * These work without any external dependencies.
 */
export type BaseToolName =
	| "command"		// Run a shell command
	| "assert"		// Assert a condition (exit-code, stdout, file-exists, file-contains, frontmatter-equals)
	| "wait"		// Pause for milliseconds
	| "log"			// Log a message
	| "file-write"	// Write content to a file
	| "file-read"	// Read a file and store result
	| "file-exists"	// Check if file/directory exists
	| "frontmatter"	// Read/write/assert YAML frontmatter in markdown files
	| "screenshot";	// Placeholder (no-op in CLI mode, captured in Plugin mode)

/**
 * @deprecated Use BaseToolName. Kept for backward compat.
 */
export type CliToolName = BaseToolName;

/**
 * All tool names supported by journeys (Plugin superset).
 * Imported journeys may reference Plugin-only tools — the CLI executor
 * skips unsupported tools with a warning.
 */
export type JourneyToolName = CliToolName | string;

// ── Actions ─────────────────────────────────────────────────────────

/** A single action within a journey step. */
export interface JourneyAction {
	tool: JourneyToolName;
	description?: string;
	[key: string]: unknown;
}

// ── Steps ───────────────────────────────────────────────────────────

/** Acceptance criterion for a journey step. */
export interface AcceptanceCriterion {
	id: string;
	description: string;
	/** If true, failure of this criterion fails the step. Default true. */
	required?: boolean;
}

/** Retry configuration for a step. */
export interface StepRetryConfig {
	maxAttempts: number;
	delayMs?: number;
}

/** Condition for conditional step execution. */
export interface StepCondition {
	/** Run this step only if the expression is truthy. Supports {{var}} interpolation. */
	runIf?: string;
	/** Skip this step if the expression is truthy. */
	skipIf?: string;
}

/** Per-step traceability links. */
export interface StepTraceability {
	/** Requirement IDs this step verifies. */
	requirements?: string[];
	/** Acceptance criterion ID this step verifies. */
	verifies?: string;
}

/** A reference to a step in another journey (composition). */
export interface JourneyRefStep {
	/** Reference in format "journey-slug#step-id". */
	$ref: string;
}

/** A step can be an inline definition or a $ref to another journey's step. */
export type StepOrRef = JourneyStep | JourneyRefStep;

/** Type guard: is this a $ref step? */
export function isRefStep(step: StepOrRef): step is JourneyRefStep {
	return "$ref" in step && typeof (step as JourneyRefStep).$ref === "string";
}

/** A single step in a journey definition. */
export interface JourneyStep {
	id: string;
	title: string;
	description: string;
	/** Acceptance criteria — human-readable and machine-checkable. */
	acceptanceCriteria?: AcceptanceCriterion[];
	/** Components involved in this step (UI references). */
	components?: string[];
	/** Actions to execute for automated testing. */
	actions: JourneyAction[];
	/** Guide section number (for documentation linking). */
	guideSection?: number;
	/** Swimlane for process visualization (Plugin compat). */
	swimlane?: string;
	/** Per-step traceability links to requirements/acceptance criteria. */
	traceability?: StepTraceability;
	/** Skip this step entirely. Default false. */
	skip?: boolean;
	/** Dev-mode only step — skipped in CI / non-dev runs. Default false. */
	dev?: boolean;
	/** Retry configuration for flaky or eventually-consistent steps. */
	retry?: StepRetryConfig;
	/** Conditional execution. */
	condition?: StepCondition;
	/** Per-step timeout in milliseconds. Overrides journey-level timeout. */
	timeout?: number;
}

// ── Project targets ──────────────────────────────────────────────────

/**
 * Project target types the CLI can provide environments for.
 * Each target has an EnvironmentProvider that supplies additional tools.
 */
export type ProjectTarget =
	| "cli"				// Standalone CLI project
	| "obsidian-vault"	// Obsidian vault (no plugin)
	| "obsidian-plugin"	// Obsidian plugin (vault + plugin lifecycle)
	| "typescript"		// Generic TypeScript project
	| "webapp";			// Web application (browser-based)

/** What the journey needs from the environment (DI declaration). */
export interface JourneyRequirements {
	/** Project target type — determines which EnvironmentProvider is used. */
	target: ProjectTarget | string;
	/** Capability IDs required for this journey. */
	capabilities?: string[];
}

// ── Risk & quality classification ───────────────────────────────────

/** Risk levels for journey prioritization. */
export type RiskLevel = "critical" | "high" | "medium" | "low";

/** ISO 25010 quality characteristic categories. */
export type QualityCategory =
	| "functional-suitability"
	| "reliability"
	| "usability"
	| "performance-efficiency"
	| "security"
	| "compatibility"
	| "maintainability"
	| "portability";

/** Journey-level traceability to requirements and quality model. */
export interface JourneyTraceability {
	/** Requirement IDs this journey verifies. */
	requirements?: string[];
	/** Use Case IDs this journey exercises. */
	useCases?: string[];
	/** User Story IDs this journey covers. */
	userStories?: string[];
	/** Risk level — determines execution priority. */
	risk?: RiskLevel;
	/** ISO 25010 quality category. */
	category?: QualityCategory;
}

/** Risk priority order for sequencing. Lower index = higher priority. */
export const RISK_PRIORITY: RiskLevel[] = ["critical", "high", "medium", "low"];

// ── Journey types ───────────────────────────────────────────────────

/** All supported journey type classifications. */
export type JourneyType =
	| "functional"
	| "regression"
	| "smoke"
	| "exploratory"
	| "blueprint"
	| "security"
	| "performance"
	| "usability"
	| "compatibility"
	| "integration";

// ── Journey definition ──────────────────────────────────────────────

/** Lifecycle configuration for journey execution. */
export interface JourneyLifecycle {
	enablePlugin?: boolean;
	checkInstalled?: boolean;
	startTrace?: boolean;
	openActivityLog?: boolean;
}

/** Complete journey definition — the `.journey` file format. */
export interface JourneyDefinition {
	journey: string;
	description: string;
	/** Chapter number for ordering. */
	chapter?: number;
	/** Journey type classification. */
	type?: JourneyType;
	/** Category for grouping. */
	category?: string;
	/** Journey-level traceability to requirements, use cases, and quality model. */
	traceability?: JourneyTraceability;
	/**
	 * What the journey needs from the execution environment.
	 * The CLI resolves the right provider and checks capabilities
	 * before executing — like dependency injection for test environments.
	 */
	requires?: JourneyRequirements;
	/** Tools used in this journey (informational). */
	tools?: string[];
	/** Lifecycle hooks for Plugin-mode execution. */
	lifecycle?: JourneyLifecycle;
	/** Setup actions to run before steps. */
	setup?: JourneyAction[];
	/** Teardown actions to run after steps. */
	teardown?: JourneyAction[];
	/** The journey steps — inline or $ref to other journeys. */
	steps: StepOrRef[];
	/** Plugin compat: start/end events. */
	startEvent?: string;
	endEvent?: string;
}

// ── Execution results ───────────────────────────────────────────────

/** Result of executing a single action. */
export interface ActionResult {
	tool: string;
	success: boolean;
	output?: string;
	error?: string;
	durationMs: number;
}

/** Result of executing a single step. */
export interface StepResult {
	stepId: string;
	stepTitle: string;
	status: "pass" | "fail" | "skip";
	durationMs: number;
	actions: ActionResult[];
	error?: string;
	/** Number of retry attempts (0 if no retries). */
	retryAttempts?: number;
	/** Evidence artifacts collected during this step. */
	evidence?: string[];
}

/** Result of executing a full journey. */
export interface JourneyResult {
	journeyName: string;
	totalSteps: number;
	passed: number;
	failed: number;
	skipped: number;
	durationMs: number;
	steps: StepResult[];
	/** Journey-level traceability (copied from definition for result tracking). */
	traceability?: JourneyTraceability;
}

// ── Executor options ────────────────────────────────────────────────

/** Sequencer strategy for journey ordering. */
export type SequencerStrategy = "alphabetical" | "risk-priority" | "chapter-order";

/** Options for the CLI journey executor. */
export interface JourneyExecutorOptions {
	/** Working directory for commands. Defaults to process.cwd(). */
	cwd?: string;
	/** Continue executing after a step failure. Default: true. */
	continueOnFailure?: boolean;
	/** Environment variables to set for commands. */
	env?: Record<string, string>;
	/** Timeout in ms for individual commands. Default: 30000. */
	commandTimeout?: number;
	/** Variables for interpolation in action fields. */
	variables?: Record<string, unknown>;
	/** Step ID filter — only run steps matching these IDs. */
	stepFilter?: string[];
	/** Dev mode — include dev-only steps. Default: false. */
	devMode?: boolean;
	/** Evidence directory for this run. If set, evidence is collected. */
	evidenceDir?: string;
	/** Bail after N failures. 0 = never bail. Default: 0. */
	bail?: number;
}
