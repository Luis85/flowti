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
import { clearHighlights, injectHighlightStyles } from "./highlight";
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
	/** Exact describe() block name. e.g. "Chapter 3: Getting Started" */
	describeBlock?: string;
	/** Exact it() description. e.g. "3.1 — Open the User Hub" */
	itBlock?: string;
	/** What this step does and why. */
	description?: string;
	/** What state or data this step expects to be present. */
	expectedInput?: string;
	/** What the step should produce or change. */
	expectedOutput?: string;
	/** UI context — which view, tab, and components are involved. */
	uiContext?: JourneyStepUiContext;
	/** EventBus events triggered or asserted. e.g. ["hub.navigate", "hub.tab.changed"] */
	events?: string[];
	/** User interactions performed. e.g. ["click: Open Hub", "navigate: Domains tab"] */
	interactions?: string[];
	/** Obsidian/Flowti commands executed. e.g. ["flowti:open-user-hub"] */
	commands?: string[];
	/** Analytics queries run or validated. e.g. ["supplier-overview"] */
	queries?: string[];
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

/** Static journey spec — step definitions without runtime data. */
export interface JourneyConfig {
	journey: string;
	testSource?: string;
	steps: JourneyStep[];
	/** it() descriptions derived from step definitions (e.g. "1 — CLI can reach Obsidian"). */
	items: string[];
	/** All unique UI components across all steps. */
	components: string[];
	/** All unique EventBus events across all steps. */
	events: string[];
	/** All unique commands across all steps. */
	commands: string[];
	/** All unique queries across all steps. */
	queries: string[];
	/** All unique interactions across all steps. */
	interactions: string[];
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

/** Controls how a step is executed and captured. */
export interface StepOptions {
	/**
	 * When to take the screenshot:
	 *   - "afterSettle" (default): action → settle → dismiss → result notice → screenshot
	 *   - "afterAction": action → screenshot → settle → dismiss → result notice
	 */
	capture?: "afterSettle" | "afterAction";
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export class JourneyRunner {
	private readonly results: JourneyStepResult[] = [];
	private readonly startTime: number;
	private readonly settleMs: number;
	private stylesInjected = false;

	constructor(
		private readonly cli: ObsidianCli,
		private readonly options: JourneyRunnerOptions,
	) {
		this.startTime = Date.now();
		this.settleMs = options.settleMs ?? 1000;
		fs.mkdirSync(options.screenshotDir, { recursive: true });
	}

	/** Posts an Obsidian notice announcing that a test suite has started. */
	notifySuiteEnter(): void {
		this.cli.notice(`▶ Suite: ${this.options.journeyName}`);
		this.openTestSource();
	}

	/**
	 * Opens the test source file in Obsidian's editor so the operator
	 * can see which test file is executing. The testSource option is
	 * relative to the plugin root (e.g. "tests/e2e/00-prerequisites.test.ts"),
	 * so we prepend "Development/flowti/" to get the vault-relative path.
	 */
	private openTestSource(): void {
		if (!this.options.testSource) return;
		const vaultPath = `Development/flowti/${this.options.testSource}`;
		this.cli.eval([
			`(async () => {`,
			`  const f = app.vault.getAbstractFileByPath('${vaultPath}');`,
			`  if (f) { const leaf = app.workspace.getLeaf('tab');`,
			`    await leaf.openFile(f); }`,
			`})()`,
		].join(" "));
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
		options?: StepOptions,
	): Promise<JourneyStepResult> {
		const stepStart = Date.now();
		let screenshotFile: string | null = null;
		const capture = options?.capture ?? "afterSettle";

		// Lazy-inject highlight CSS on first step
		if (!this.stylesInjected) {
			injectHighlightStyles(this.cli);
			this.stylesInjected = true;
		}

		// Dismiss the previous step's result notice (already captured in its screenshot)
		this.dismissAllNotices();
		clearHighlights(this.cli);

		try {
			this.cli.notice(`Step ${step.guideSection}: ${step.title} …`);
			await action();

			const filename = `${step.id}.png`;
			const outputPath = path.join(this.options.screenshotDir, filename);

			if (capture === "afterAction") {
				// Screenshot FIRST — captures transient UI (modals, hover states)
				this.cli.screenshot(outputPath);
				screenshotFile = filename;
				await sleep(this.settleMs);
				this.dismissAllNotices();
				this.cli.notice(`Step ${step.guideSection}: ${step.title} ✓`);
			} else {
				// Default: settle first, then screenshot with result notice
				await sleep(this.settleMs);
				this.dismissAllNotices();
				this.cli.notice(`Step ${step.guideSection}: ${step.title} ✓`);
				this.cli.screenshot(outputPath);
				screenshotFile = filename;
			}

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

		// Also write the static journey config alongside the results.
		// Config captures the step definitions (spec) without runtime data.
		const configPath = outputPath.replace(/-results\.json$/, "-config.json");
		fs.writeFileSync(configPath, JSON.stringify(this.getConfig(), null, 2), "utf-8");
	}

	/** Returns the static journey configuration (step definitions only). */
	getConfig(): JourneyConfig {
		// Ensure every step carries the describe/it block strings.
		// If not explicitly set by the test author, derive from available data.
		const steps = this.results.map((r) => ({
			...r.step,
			describeBlock: r.step.describeBlock ?? this.options.journeyName,
			itBlock: r.step.itBlock ?? `${r.step.guideSection} — ${r.step.title}`,
		}));

		// Aggregate unique metadata across all steps
		const components = new Set<string>();
		const events = new Set<string>();
		const commands = new Set<string>();
		const queries = new Set<string>();
		const interactions = new Set<string>();

		for (const step of steps) {
			for (const c of step.uiContext?.components ?? []) components.add(c);
			for (const e of step.events ?? []) events.add(e);
			for (const cmd of step.commands ?? []) commands.add(cmd);
			for (const q of step.queries ?? []) queries.add(q);
			for (const i of step.interactions ?? []) interactions.add(i);
		}

		return {
			journey: this.options.journeyName,
			...(this.options.testSource ? { testSource: this.options.testSource } : {}),
			steps,
			items: steps.map((s) => s.itBlock!),
			components: [...components],
			events: [...events],
			commands: [...commands],
			queries: [...queries],
			interactions: [...interactions],
		};
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
