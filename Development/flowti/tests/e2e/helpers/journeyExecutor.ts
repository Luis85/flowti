/**
 * Journey executor — reads a declarative JourneyDefinition and generates
 * vitest describe/it blocks that run via the JourneyRunner.
 *
 * Usage (in a .test.ts file):
 *
 *   import { executeJourney } from "./helpers/journeyExecutor";
 *   import definition from "./journeys/canvas-session.journey.json";
 *   executeJourney(definition);
 *
 * The executor handles:
 *   - Fixture creation and cleanup
 *   - Plugin enable, install check, event trace (configurable via lifecycle)
 *   - JourneyRunner lifecycle (notifySuiteEnter → steps → writeResults)
 *   - Action dispatch via the actionRunner
 *   - Variable interpolation across steps
 *   - Setup steps (run in beforeAll, failures block main steps)
 *   - Teardown steps (run in afterAll, always execute)
 *   - Gate flags and anchor file writing (afterAll)
 *   - Skip mode with onSkip callback
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import type { ObsidianCli } from "../../../src/infrastructure/cli/ObsidianCli";
import type { JourneyDefinition, StepDefinition, StepOrRef, ToolName } from "./journeyTypes";
import { isJourneyRef } from "./journeyTypes";
import {
	createFixture,
	ensurePluginEnabled,
	ensureInstalled,
	startEventTrace,
	openActivityLog,
	getTraceLength,
	PLUGIN_ID,
} from "./fixtures";
import { JourneyRunner } from "./journey";
import type { JourneyStep } from "./journey";
import { executeAction } from "./actionRunner";
import type { ScreenshotCollector } from "./actionRunner";
import type { TestFixture } from "./fixtures";

// ── Run log auto-logging ────────────────────────────────────────────

/**
 * Appends a line to `E2E Test Run.md` in the vault root.
 * Best-effort — does not throw on failure.
 */
function writeRunLog(cli: ObsidianCli, message: string): void {
	try {
		cli.appendFile("E2E Test Run.md", message + "\n");
	} catch {
		// Best-effort — file may not exist yet
	}
}

/** Returns true if any action in the step is a `write-run-log` tool. */
function hasExplicitRunLog(step: StepDefinition): boolean {
	return step.actions.some((a) => a.tool === "write-run-log");
}

/** Directory containing *.journey.json files. */
const JOURNEYS_DIR = path.join(__dirname, "..", "journeys");

// ── Options ─────────────────────────────────────────────────────────

export interface ExecuteJourneyOptions {
	/** If true, skip the entire journey. All steps register as skipped. */
	skip?: boolean;
	/** Callback to run when the journey is skipped (e.g. set gate flags). */
	onSkip?: (cli: ObsidianCli) => Promise<void> | void;
	/** Extra variables merged into the variable map (available as {{key}} in actions). */
	variables?: Record<string, string>;
}

// ── Ref resolution ──────────────────────────────────────────────────

/**
 * Recursively resolves JourneyRefStep entries into concrete StepDefinitions.
 * Loads referenced journey JSON files, flattens their steps, and renumbers
 * guideSection sequentially (1, 2, 3...) after flattening.
 *
 * Detects circular references via a `seen` set.
 */
function resolveSteps(steps: StepOrRef[], seen = new Set<string>()): StepDefinition[] {
	const resolved: StepDefinition[] = [];
	for (const step of steps) {
		if (!isJourneyRef(step)) {
			resolved.push(step);
			continue;
		}
		const jsonFile = `${step.ref}.journey.json`;
		if (seen.has(jsonFile)) {
			throw new Error(`Circular journey ref: ${step.ref}`);
		}
		const refPath = path.join(JOURNEYS_DIR, jsonFile);
		const refDef: JourneyDefinition = JSON.parse(fs.readFileSync(refPath, "utf-8"));
		resolved.push(...resolveSteps(refDef.steps, new Set([...seen, jsonFile])));
	}
	return resolved;
}

/**
 * Renumbers guideSection on all steps sequentially starting from 1.
 */
function renumberSteps(steps: StepDefinition[]): StepDefinition[] {
	return steps.map((step, i) => ({ ...step, guideSection: i + 1 }));
}

/**
 * Collects tool names from referenced journeys so validateTools can pass.
 */
function collectRefTools(steps: StepOrRef[]): ToolName[] {
	const tools = new Set<ToolName>();
	for (const step of steps) {
		if (isJourneyRef(step)) {
			const jsonFile = `${step.ref}.journey.json`;
			const refPath = path.join(JOURNEYS_DIR, jsonFile);
			const refDef: JourneyDefinition = JSON.parse(fs.readFileSync(refPath, "utf-8"));
			for (const t of refDef.tools ?? []) tools.add(t);
			// Recurse into nested refs
			for (const t of collectRefTools(refDef.steps)) tools.add(t);
		}
	}
	return [...tools];
}

/**
 * Derives the journey slug from the definition's testSource field.
 * e.g. "tests/e2e/60-journey-tool-showcase.test.ts" → "tool-showcase"
 * Falls back to lowercased journey name with spaces replaced by hyphens.
 */
function deriveJourneySlug(definition: JourneyDefinition): string {
	if (definition.testSource) {
		const base = path.basename(definition.testSource, ".test.ts");
		// Strip numeric prefix and "journey-" prefix: "60-journey-tool-showcase" → "tool-showcase"
		const match = base.match(/^\d+-journey-(.+)$/);
		if (match) return match[1];
	}
	return definition.journey.toLowerCase().replace(/\s+/g, "-");
}

/**
 * Reads the E2E_STEPS env var and returns the step filter for a journey.
 * Format: "slug1:stepId1,stepId2;slug2:stepId3"
 * Returns null if no filter (run all steps), or a Set of step IDs to include.
 */
function getStepFilter(journeySlug: string): Set<string> | null {
	const raw = process.env.E2E_STEPS;
	if (!raw) return null;

	for (const segment of raw.split(";")) {
		const colonIdx = segment.indexOf(":");
		if (colonIdx === -1) continue;
		const slug = segment.slice(0, colonIdx);
		if (slug === journeySlug) {
			const stepIds = segment.slice(colonIdx + 1).split(",").filter(Boolean);
			return new Set(stepIds);
		}
	}
	return null; // this journey not in filter — run all
}

/**
 * Validates that all actions in the resolved steps use only declared tools.
 * Checks setup, resolved steps, and teardown arrays.
 * Skips validation when tools array is not declared (tools are derived from actions).
 * Throws on the first undeclared tool found.
 */
function validateTools(
	tools: ToolName[] | undefined,
	setup: StepDefinition[],
	steps: StepDefinition[],
	teardown: StepDefinition[],
): void {
	if (!tools?.length) return; // tools derived from actions — skip validation
	const allowed = new Set<string>(tools);
	const allSteps = [...setup, ...steps, ...teardown];
	for (const step of allSteps) {
		for (const action of step.actions) {
			if (!allowed.has(action.tool)) {
				throw new Error(
					`Step '${step.id}' uses undeclared tool '${action.tool}'. ` +
					`Declared tools: [${tools.join(", ")}]`,
				);
			}
		}
	}
}

/**
 * Validates the structural integrity of a journey definition.
 * Checks: required fields, unique step IDs, sequential guide sections,
 * tool declarations, and blueprint swimlane consistency.
 * Returns an array of validation errors (empty = valid).
 */
function validateJourney(definition: JourneyDefinition): string[] {
	const errors: string[] = [];
	const allSteps = [
		...(definition.setup ?? []),
		...(definition.steps.filter((s): s is StepDefinition => !isJourneyRef(s))),
		...(definition.teardown ?? []),
	];

	// Required fields
	if (!definition.journey) errors.push("Missing required field: journey");
	// chapter is optional — unnumbered journeys are valid
	// tools array is now optional — derived from actions when omitted

	// Unique step IDs
	const ids = new Set<string>();
	for (const step of allSteps) {
		if (ids.has(step.id)) {
			errors.push(`Duplicate step ID: '${step.id}'`);
		}
		ids.add(step.id);
	}

	// Steps must have at least one action
	for (const step of allSteps) {
		if (!step.actions?.length) {
			errors.push(`Step '${step.id}' has no actions`);
		}
	}

	// Setup/teardown steps cannot be skipped (they control lifecycle)
	for (const step of definition.setup ?? []) {
		if (step.skip) errors.push(`Setup step '${step.id}' cannot be skipped`);
	}
	for (const step of definition.teardown ?? []) {
		if (step.skip) errors.push(`Teardown step '${step.id}' cannot be skipped`);
	}

	// Blueprint swimlane validation (if type is "blueprint")
	if (definition.type === "blueprint") {
		const stepsWithoutSwimlane = allSteps.filter((s) => !s.swimlane);
		if (stepsWithoutSwimlane.length > 0) {
			errors.push(
				`Blueprint journey requires swimlane on all steps. ` +
				`Missing: ${stepsWithoutSwimlane.map((s) => s.id).join(", ")}`,
			);
		}
	}

	// Actors and services recommended for blueprint
	if (definition.type === "blueprint") {
		if (!definition.actors?.length) errors.push("Blueprint journey should declare actors");
		if (!definition.services?.length) errors.push("Blueprint journey should declare services");
	}

	return errors;
}

/**
 * Converts a StepDefinition (from JSON) to a JourneyStep (for the runner).
 * Strips the `capture` field which is handled by the executor.
 * Passes `actions` through for report/canvas generation.
 */
function toJourneyStep(step: StepDefinition, phase?: "setup" | "journey" | "teardown"): JourneyStep {
	return {
		id: step.id,
		title: step.title,
		guideSection: step.guideSection,
		phase,
		swimlane: step.swimlane,
		description: step.description,
		expectedInput: step.expectedInput,
		expectedOutput: step.expectedOutput,
		uiContext: step.uiContext,
		events: step.events,
		commands: step.commands,
		interactions: step.interactions,
		queries: step.queries,
		actions: step.actions,
		skip: step.skip,
		dev: step.dev,
	};
}

/** Returns true if the step has explicit screenshot tool actions. */
function hasExplicitScreenshots(step: StepDefinition): boolean {
	return step.actions.some((a) => a.tool === "screenshot");
}

/**
 * Runs a single step through the JourneyRunner with full action dispatch.
 * Shared by setup, journey, and teardown phases.
 */
async function runStepWithActions(
	step: StepDefinition,
	phase: "setup" | "journey" | "teardown",
	runner: JourneyRunner,
	cli: ObsidianCli,
	variables: Record<string, string>,
	screenshotDir: string,
): Promise<"pass" | "fail"> {
	const traceBookmark = getTraceLength(cli);
	const journeyStep = toJourneyStep(step, phase);
	const useExplicit = hasExplicitScreenshots(step);

	const collector: ScreenshotCollector = {
		stepId: step.id,
		screenshotDir,
		files: [],
		counter: 0,
	};
	const warnings: string[] = [];

	const result = await runner.runStep(
		journeyStep,
		async () => {
			const actions = step.actions;
			for (let i = 0; i < actions.length; i++) {
				const action = actions[i];
				try {
					await executeAction(cli, action, variables, traceBookmark, collector);
				} catch (err) {
					const msg = err instanceof Error ? err.message : String(err);
					// Visual inspections are advisory — log failure but don't block the test
					if (action.tool === "visual-inspection") {
						writeRunLog(cli, `- [ ] **Visual Inspection** — ${msg}`);
						console.warn(`[e2e] Visual inspection soft-fail: ${msg}`);
						warnings.push(msg);
						continue;
					}
					const desc = action.description ? ` — ${action.description}` : "";
					throw new Error(
						`[Action ${i + 1}/${actions.length}] ${action.tool}${desc}\n${msg}`,
					);
				}
			}
		},
		{
			capture: step.capture ?? "afterSettle",
			autoScreenshot: !useExplicit,
		},
		collector.files,
		variables,
		warnings,
	);

	return result.status === "pass" ? "pass" : "fail";
}

// ── Anchor file ─────────────────────────────────────────────────────

/**
 * Writes an anchor file with pass/fail metadata for skip-mode detection.
 * Future runs can read `passed: true` from frontmatter to skip the journey.
 */
function writeAnchorFile(
	journeyDir: string,
	journeyName: string,
	results: { totalSteps: number; passed: number; failed: number },
): void {
	const allPassed = results.failed === 0 && results.totalSteps > 0;
	const now = new Date();
	const content = [
		"---",
		`type: E2EAnchor`,
		`passed: ${allPassed}`,
		`date: "${now.toISOString()}"`,
		`totalSteps: ${results.totalSteps}`,
		`passedSteps: ${results.passed}`,
		`failedSteps: ${results.failed}`,
		"---",
		"",
		`# ${journeyName} — Last Run`,
		"",
		`Status: **${allPassed ? "PASS" : "FAIL"}**`,
		`Date: ${now.toISOString().slice(0, 16).replace("T", " ")}`,
		`Steps: ${results.passed}/${results.totalSteps} passed`,
		"",
	].join("\n");

	const anchorPath = path.join(journeyDir, `${journeyName}-anchor.md`);
	fs.mkdirSync(journeyDir, { recursive: true });
	fs.writeFileSync(anchorPath, content, "utf-8");
	console.log(`[e2e] Anchor written: ${anchorPath}`);
}

// ── Executor ────────────────────────────────────────────────────────

/**
 * Generates vitest describe/it blocks from a JourneyDefinition.
 *
 * Call this at the top level of a .test.ts file. It registers all steps
 * as vitest it() blocks inside a describe() block, with full lifecycle
 * management (fixture, plugin, event trace, runner).
 *
 * Execution flow:
 *   beforeAll: fixture init → lifecycle → setup steps (failures block main steps)
 *   it() per step: main journey steps (skipped if setup failed)
 *   afterAll: teardown steps (always run) → gate flags → anchor → write results → cleanup
 */
export function executeJourney(definition: JourneyDefinition, options?: ExecuteJourneyOptions): void {
	// ── Resolve journey refs ─────────────────────────────────
	const resolvedSteps = renumberSteps(resolveSteps(definition.steps));
	const refTools = collectRefTools(definition.steps);
	const allTools: ToolName[] = [...new Set([...(definition.tools ?? []), ...refTools])];

	// ── Step filter (E2E_STEPS env var) ─────────────────────
	const journeySlug = deriveJourneySlug(definition);
	const stepFilter = getStepFilter(journeySlug);

	validateTools(
		allTools,
		definition.setup ?? [],
		resolvedSteps,
		definition.teardown ?? [],
	);

	// ── Structural validation ────────────────────────────────
	const validationErrors = validateJourney(definition);
	if (validationErrors.length > 0) {
		throw new Error(
			`Journey '${definition.journey}' validation failed:\n` +
			validationErrors.map((e) => `  - ${e}`).join("\n"),
		);
	}

	const chapterLabel = definition.chapter != null
		? `Chapter ${definition.chapter}: ${definition.journey}`
		: definition.journey;

	// ── Skip mode ────────────────────────────────────────────
	if (options?.skip || definition.skip) {
		describe(`${chapterLabel} (skip mode)`, () => {
			it(`${definition.chapter != null ? `${definition.chapter}.0` : "0"} — Skipped (previous run passed)`, async () => {
				if (options?.onSkip) {
					const fixture = createFixture(process.env.OBSIDIAN_VAULT);
					await options.onSkip(fixture.cli);
				}
			});
		});
		return;
	}

	// ── Full mode ────────────────────────────────────────────

	describe(chapterLabel, () => {
		let fixture: TestFixture;
		let runner: JourneyRunner;
		let cli: ObsidianCli;
		let resultsPath: string;
		let journeyDir: string;
		let screenshotDir: string;
		let setupFailed = false;
		let devStopped = false;
		const variables: Record<string, string> = {
			PLUGIN_ID,
			...(options?.variables ?? {}),
		};

		beforeAll(async () => {
			fixture = createFixture(process.env.OBSIDIAN_VAULT);
			cli = fixture.cli;

			// ── Lifecycle (configurable per journey) ─────────
			cli.notice(`\u23f3 ${definition.journey}: preparing\u2026`, 3000);

			const lc = definition.lifecycle ?? {};
			if (lc.enablePlugin !== false) await ensurePluginEnabled(cli);
			if (lc.checkInstalled !== false) ensureInstalled(cli, fixture.vault.vaultDir);
			if (lc.startTrace !== false) startEventTrace(cli);
			if (lc.openActivityLog !== false) openActivityLog(cli);

			journeyDir = path.join(
				fixture.vault.vaultDir,
				"docs",
				"journeys",
				definition.journey,
			);
			screenshotDir = path.join(journeyDir, "screenshots");
			resultsPath = path.join(journeyDir, `${definition.journey}-results.json`);

			runner = new JourneyRunner(cli, {
				journeyName: definition.journey,
				screenshotDir,
				settleMs: 1000,
				testSource: definition.testSource,
				classification: {
					type: definition.type,
					category: definition.category,
					domain: definition.domain,
					actors: definition.actors,
					services: definition.services,
				},
			});

			runner.notifySuiteEnter();

			// ── Run setup steps ──────────────────────────────
			for (const step of definition.setup ?? []) {
				const status = await runStepWithActions(
					step, "setup", runner, cli, variables, screenshotDir,
				);
				if (status === "fail") {
					setupFailed = true;
					break;
				}
			}
		});

		afterAll(async () => {
			// ── Close stale modals before teardown ───────────
			if (cli) {
				cli.eval("document.querySelectorAll('.modal-container').forEach(el => el.remove())");
			}

			// ── Run teardown steps ───────────────────────────
			if (runner && cli) {
				for (const step of definition.teardown ?? []) {
					await runStepWithActions(
						step, "teardown", runner, cli, variables, screenshotDir,
					);
				}
			}

			// ── Gate flags (set window properties on pass) ───
			// Suppress when dev-stopped — partial runs shouldn't set gates.
			if (definition.gateFlags?.length && runner && cli && !devStopped) {
				const results = runner.getResults();
				if (results.failed === 0 && results.totalSteps > 0) {
					for (const flag of definition.gateFlags) {
						cli.eval(`window.${flag} = true`);
					}
				}
			}

			// ── Anchor file (for skip-mode detection) ────────
			// Skip anchor when step filter is active or dev-stopped — partial runs
			// shouldn't mark the journey as "passed".
			if (definition.anchor && runner && !stepFilter && !devStopped) {
				const results = runner.getResults();
				writeAnchorFile(journeyDir, definition.journey, results);
			}

			if (runner) {
				runner.writeResults(resultsPath, variables);
				runner.notifySuiteExit();
			}
			fixture?.cleanup();
		});

		for (const step of resolvedSteps) {
			it(`${definition.chapter != null ? `${definition.chapter}.` : ""}${step.guideSection} — ${step.title}`, async () => {
				// Skip if marked as skipped in the journey definition
				if (step.skip) {
					const journeyStep = toJourneyStep(step, "journey");
					runner.addSkippedResult(journeyStep);
					return;
				}

				// Skip if step not in active filter (E2E_STEPS)
				if (stepFilter && !stepFilter.has(step.id)) {
					const journeyStep = toJourneyStep(step, "journey");
					runner.addSkippedResult(journeyStep);
					return;
				}

				if (setupFailed || devStopped) {
					const journeyStep = toJourneyStep(step, "journey");
					runner.addSkippedResult(journeyStep);
					return;
				}

				const status = await runStepWithActions(
					step, "journey", runner, cli, variables, screenshotDir,
				);

				// Dev step: run normally, mark as dev boundary, then terminate
				if (step.dev) {
					runner.markStepAsDev(step.id);
					runner.markDevStopped();
					devStopped = true;
					const devIcon = status === "pass" ? "\u2714" : "\u2718";
					cli.styledNotice(
						`${devIcon} ${step.title} [dev boundary]`,
						status === "pass" ? "success" : "error",
						6000,
					);
					if (!hasExplicitRunLog(step)) {
						const checkbox = status === "pass" ? "x" : " ";
						writeRunLog(cli, `- [${checkbox}] **${step.title}** _(dev)_`);
					}
					// Dev steps don't assert — failure is expected at the frontier
					return;
				}

				// Step result notice — green for pass, red for fail
				if (status === "pass") {
					cli.styledNotice(`\u2714 ${step.title}`, "success", 4000);
				} else {
					cli.styledNotice(`\u2718 ${step.title}`, "error", 8000);
				}

				// Auto-log step result unless the step has explicit write-run-log actions
				if (!hasExplicitRunLog(step)) {
					const checkbox = status === "pass" ? "x" : " ";
					writeRunLog(cli, `- [${checkbox}] **${step.title}**`);
				}

				expect(status).toBe("pass");
			});
		}
	});
}
