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
	type?: "functional" | "regression" | "smoke" | "exploratory" | "blueprint";
	/** Category for grouping. */
	category?: string;
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
	/** The journey steps. */
	steps: JourneyStep[];
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
}

// ── Executor options ────────────────────────────────────────────────

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
	variables?: Record<string, string>;
}
