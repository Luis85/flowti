/**
 * Types for the Journey Executor domain.
 *
 * Defines the ToolHost abstraction (platform capabilities),
 * execution state, step results, and run options.
 */

import type { JourneyAction } from "../journeyBuilder/types";

// ── ToolHost ─────────────────────────────────────────────────

/** Abstraction over Obsidian App + DOM for tool execution. */
export interface ToolHost {
	executeCommand(id: string): boolean;
	querySelector(selector: string): Element | null;
	querySelectorAll(selector: string): NodeListOf<Element>;
	createFile(path: string, content: string): Promise<void>;
	deleteFile(path: string): Promise<void>;
	readFile(path: string): Promise<string>;
	moveFile(from: string, to: string): Promise<void>;
	copyFile(from: string, to: string): Promise<void>;
	openFile(path: string): Promise<void>;
	openUrl(url: string): void;
	showNotice(message: string, duration?: number): void;
	setTheme(theme: string): void;
	closeLeaves(viewType?: string): void;
	closeModals(): void;
	clickRibbon(label: string): boolean;
	scrollTo(selector: string, behavior?: string, block?: string): boolean;
	getFrontmatter(path: string): Record<string, unknown> | undefined;
	updateFrontmatter(path: string, data: Record<string, unknown>): Promise<void>;
	getEventTrace(event: string, since?: number): unknown[];
	showSpinner(id: string, message?: string): void;
	hideSpinner(id: string): void;
	writeRunLog(path: string, content: string): Promise<void>;
	seed(id: string, mode: string): Promise<void>;
}

// ── Journey definition ───────────────────────────────────────

/** A step ready for execution. */
export interface ExecutableStep {
	id: string;
	title: string;
	description: string;
	actions: JourneyAction[];
}

/** Full journey definition for execution. */
export interface ExecutableJourney {
	journey: string;
	steps: ExecutableStep[];
}

// ── Execution results ────────────────────────────────────────

/** Per-step result after execution. */
export interface StepResult {
	stepIndex: number;
	stepId: string;
	stepTitle: string;
	status: "pass" | "fail" | "skip";
	durationMs: number;
	error?: string;
}

/** Full result after a journey run. */
export interface ExecutionResult {
	journeyName: string;
	totalSteps: number;
	passed: number;
	failed: number;
	skipped: number;
	durationMs: number;
	steps: StepResult[];
}

// ── Run options ──────────────────────────────────────────────

/** Options controlling a single journey run. */
export interface ExecutionOptions {
	/** Validate without executing side effects. */
	dryRun?: boolean;
	/** Initial variable map for {{var}} interpolation. */
	variables?: Record<string, string>;
	/** Callback for manual / visual-inspection tools. Auto-passes if not provided. */
	onManualInput?: (instruction: string) => Promise<"pass" | "fail">;
	/** Callback for vault-modifying tools. Skips tool if rejected. */
	onConfirmDestructive?: (description: string) => Promise<boolean>;
	/** Continue executing after a step failure. Default true. */
	continueOnFailure?: boolean;
}

// ── Live state ───────────────────────────────────────────────

/** Current execution progress (for UI polling). */
export interface ExecutionState {
	journeyName: string;
	totalSteps: number;
	currentStep: number;
	stepResults: StepResult[];
	running: boolean;
	dryRun: boolean;
}
