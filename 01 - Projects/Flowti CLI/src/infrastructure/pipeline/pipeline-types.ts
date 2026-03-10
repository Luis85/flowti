/**
 * pipeline-types.ts — Core type definitions for the generic execution pipeline.
 *
 * The pipeline engine orchestrates steps with dependency resolution,
 * prerequisite execution, output capture, and resilient error handling.
 * It is domain-agnostic — report generation, test execution, journey
 * execution, and process execution all use the same engine.
 */

// ── Step contract ────────────────────────────────────────────────────

/** A single unit of work in a pipeline. */
export interface PipelineStep {
	/** Unique identifier for this step. */
	id: string;
	/** Human-readable label for logging. */
	label: string;
	/** IDs of other steps that must complete successfully before this one runs. */
	dependencies?: string[];
	/** Shell commands to run before execute(); output is stored in the context. */
	prerequisites?: string[];
	/** The work function. Receives the pipeline context for dependency data. May be async. */
	execute: (ctx: PipelineContext) => StepOutput | Promise<StepOutput>;
}

/** What a step produces when it completes. */
export interface StepOutput {
	success: boolean;
	/** Path to the primary output artifact (if any). */
	outputPath?: string;
	/** Named metrics for summary display and downstream analysis. */
	metrics?: Record<string, string | number>;
	/** Non-fatal issues surfaced in the run summary. */
	warnings?: string[];
	/** Arbitrary data for downstream steps to consume via ctx.getStepData(). */
	data?: Record<string, unknown>;
}

// ── Result types ─────────────────────────────────────────────────────

/** Result recorded after a step completes (or fails). */
export interface StepResult {
	id: string;
	label: string;
	success: boolean;
	durationMs: number;
	output: StepOutput | null;
	error?: string;
	warnings?: string[];
	/** Phase number this step ran in (for phased execution). */
	phase?: number;
}

/** Aggregate result of a full pipeline run. */
export interface PipelineResult {
	steps: StepResult[];
	totalDurationMs: number;
	passed: number;
	failed: number;
	skipped: number;
}

// ── Context interface ────────────────────────────────────────────────

/** Per-run state container. Created fresh for each pipeline execution. */
export interface PipelineContext {
	/** The project root path for this run. */
	readonly projectPath: string;

	/** Record a completed step result. */
	pushResult(result: StepResult): void;
	/** Get all results accumulated so far (read-only). */
	getResults(): readonly StepResult[];
	/** Get the result for a specific step by ID. */
	getStepResult(id: string): StepResult | undefined;

	/** Store captured command output (keyed by command string). */
	setCommandOutput(command: string, output: string): void;
	/** Retrieve previously captured command output. */
	getCommandOutput(command: string): string | undefined;

	/** Emit a progress message (wired to PipelineDeps.log by the runner). */
	log(message: string): void;

	/** Store arbitrary step data for downstream consumption. */
	setStepData(stepId: string, data: Record<string, unknown>): void;
	/** Retrieve step data set by a prior step. */
	getStepData(stepId: string): Record<string, unknown> | undefined;
}

// ── Runner options ───────────────────────────────────────────────────

/** Options for configuring a pipeline run. */
export interface PipelineOptions {
	/** Use dependency-aware phased execution (default: false = linear order). */
	phased?: boolean;
	/** Label for this pipeline run (used in log summary header). */
	label?: string;
}

// ── Injectable dependencies ──────────────────────────────────────────

/** Dependencies injected into the pipeline runner for testability. */
export interface PipelineDeps {
	/** Shell for running prerequisite commands. */
	runCommand: (cmd: string, cwd: string) => { output: string; exitCode: number };
	/** Monotonic clock for timing. */
	now: () => number;
	/** Log function for step progress messages. */
	log: (message: string) => void;
}

// ── Phase types ──────────────────────────────────────────────────────

/** A group of steps that can run in the same phase. */
export interface StepPhase {
	phase: number;
	steps: PipelineStep[];
}
