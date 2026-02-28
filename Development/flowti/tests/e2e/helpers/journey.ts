/**
 * Journey test helpers — orchestrates multi-step user journeys with
 * screenshot capture and result tracking.
 *
 * Each journey step: execute action → wait for render → annotate via
 * notice → screenshot → record result.
 *
 * Notices are never dismissed or inspected for errors — they serve as
 * screenshot annotations and provide context when reviewing reports.
 * Step pass/fail is determined solely by whether the action throws.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import type { ObsidianCli } from "../../../src/infrastructure/cli/ObsidianCli";
import { clearHighlights } from "./highlight";
import { collectErrorContext, type ErrorContext } from "./errorContext";
import { qcCheckpoint } from "./qc";

export interface JourneyStepUiContext {
	/** Hub view type. e.g. "flowti-user-hub" */
	view?: string;
	/** Hub display name. e.g. "User Hub" */
	viewName?: string;
	/** Active tab ID. e.g. "domains" */
	tab?: string;
	/** Tab display name. e.g. "Domains" */
	tabName?: string;
	/** UI components involved. e.g. ["WorkspaceShell", "DashboardsTab"] */
	components?: string[];
}

export interface JourneyStep {
	/** Step identifier, used as screenshot filename prefix. e.g. "01-user-hub" */
	id: string;
	/** Human-readable step title. e.g. "Open the User Hub" */
	title: string;
	/** Section number in the guide (1-based). */
	guideSection: number;
	/** What this step does and why. */
	description?: string;
	/** What state or data this step expects to be present. */
	expectedInput?: string;
	/** What the step should produce or change. */
	expectedOutput?: string;
	/** UI context — which view, tab, and components are involved. */
	uiContext?: JourneyStepUiContext;
}

export interface JourneyStepResult {
	step: JourneyStep;
	status: "pass" | "fail" | "skip";
	durationMs: number;
	screenshotFile: string | null;
	error?: string;
	/** Diagnostic context captured on failure (DOM state, recent events, plugin state). */
	errorContext?: ErrorContext;
}

export interface JourneyResult {
	journey: string;
	date: string;
	totalSteps: number;
	passed: number;
	failed: number;
	skipped: number;
	durationMs: number;
	steps: JourneyStepResult[];
	/** Relative path to the test source file (from plugin root). */
	testSource?: string;
}

export interface JourneyRunnerOptions {
	journeyName: string;
	/** Absolute filesystem path for screenshot output. */
	screenshotDir: string;
	/** Milliseconds to wait after action before screenshot. Default: 2000. */
	settleMs?: number;
	/** Relative path to the test source file (from plugin root). Used in reports. */
	testSource?: string;
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export class JourneyRunner {
	private readonly results: JourneyStepResult[] = [];
	private readonly startTime: number;
	private readonly settleMs: number;

	constructor(
		private readonly cli: ObsidianCli,
		private readonly options: JourneyRunnerOptions,
	) {
		this.startTime = Date.now();
		this.settleMs = options.settleMs ?? 2000;
		fs.mkdirSync(options.screenshotDir, { recursive: true });
	}

	/** Posts an Obsidian notice announcing that a test suite has started. */
	notifySuiteEnter(): void {
		this.cli.notice(`▶ Suite: ${this.options.journeyName}`);
	}

	/** Posts a summary notice when the suite finishes. */
	notifySuiteExit(): void {
		const r = this.getResults();
		const icon = r.failed === 0 ? "✓" : "✗";
		this.cli.notice(
			`${icon} Suite: ${r.journey} — ${r.passed}/${r.totalSteps} passed`,
		);
	}

	/**
	 * Executes a journey step: runs the action, waits for the UI to settle,
	 * annotates via notice, takes a screenshot, and records the result.
	 *
	 * Only one JourneyRunner notice is visible at a time — the predecessor
	 * is dismissed before posting the next. Plugin/app notices are left
	 * untouched so they appear naturally in screenshots.
	 */
	async runStep(
		step: JourneyStep,
		action: () => void | Promise<void>,
	): Promise<JourneyStepResult> {
		const stepStart = Date.now();
		let screenshotFile: string | null = null;

		// Dismiss the previous step's result notice (already captured in its screenshot)
		this.dismissAllNotices();
		clearHighlights(this.cli);

		try {
			this.cli.notice(`Step ${step.guideSection}: ${step.title} …`);
			await action();
			await sleep(this.settleMs);

			// Dismiss the "starting" notice before posting the result
			this.dismissAllNotices();
			this.cli.notice(`Step ${step.guideSection}: ${step.title} ✓`);

			// Screenshot — only the result notice is visible
			const filename = `${step.id}.png`;
			const outputPath = path.join(this.options.screenshotDir, filename);
			this.cli.screenshot(outputPath);
			screenshotFile = filename;

			const result: JourneyStepResult = {
				step,
				status: "pass",
				durationMs: Date.now() - stepStart,
				screenshotFile,
			};
			this.results.push(result);
			return result;
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);

			// Collect error context while the failure state is still visible
			let errorContext: ErrorContext | undefined;
			try {
				errorContext = collectErrorContext(this.cli);
			} catch {
				// Error context collection must not mask the step error
			}

			// Dismiss the "starting" notice before posting the error
			this.dismissAllNotices();
			this.cli.notice(`Step ${step.guideSection}: ${step.title} ✗ ${message}`);

			// Still take a screenshot to capture the error state
			const filename = `${step.id}.png`;
			const outputPath = path.join(this.options.screenshotDir, filename);
			try {
				this.cli.screenshot(outputPath);
				screenshotFile = filename;
			} catch {
				// Screenshot failure must not mask the step error
			}

			const result: JourneyStepResult = {
				step,
				status: "fail",
				durationMs: Date.now() - stepStart,
				screenshotFile,
				error: message,
				errorContext,
			};
			this.results.push(result);
			return result;
		}
	}

	/**
	 * Executes a QC checkpoint step. If QC mode is disabled (default),
	 * auto-approves and records a "pass" result. If enabled, shows
	 * a modal and waits for operator response.
	 */
	async runQcStep(
		step: JourneyStep,
		prompt: string,
	): Promise<JourneyStepResult> {
		return this.runStep(step, async () => {
			await qcCheckpoint(this.cli, prompt);
		});
	}

	/** Removes all notices — cleans the slate for the next step. */
	private dismissAllNotices(): void {
		this.cli.eval(
			"document.querySelectorAll('.notice').forEach(n => n.remove())",
		);
	}

	/**
	 * Reads all currently visible Obsidian notice texts.
	 * Useful inside step actions for result validation — e.g. checking
	 * that Flowti posted a success notice or detecting app-level errors.
	 *
	 * Notices are never dismissed or modified by this call.
	 */
	getNotices(): string[] {
		const result = this.cli.eval(
			"JSON.stringify(Array.from(document.querySelectorAll('.notice')).map(n => n.textContent || ''))",
		);
		if (!result.success) return [];
		try {
			return JSON.parse(result.value) as string[];
		} catch {
			return [];
		}
	}

	/** Writes the journey results JSON to the given path. */
	writeResults(outputPath: string): void {
		const dir = path.dirname(outputPath);
		fs.mkdirSync(dir, { recursive: true });
		fs.writeFileSync(outputPath, JSON.stringify(this.getResults(), null, 2), "utf-8");
	}

	/** Returns the accumulated journey results. */
	getResults(): JourneyResult {
		const passed = this.results.filter((r) => r.status === "pass").length;
		const failed = this.results.filter((r) => r.status === "fail").length;
		const skipped = this.results.filter((r) => r.status === "skip").length;

		return {
			journey: this.options.journeyName,
			date: new Date().toISOString(),
			totalSteps: this.results.length,
			passed,
			failed,
			skipped,
			durationMs: Date.now() - this.startTime,
			steps: this.results,
			...(this.options.testSource ? { testSource: this.options.testSource } : {}),
		};
	}
}
