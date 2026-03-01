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
 *   - Plugin enable, install check, event trace
 *   - JourneyRunner lifecycle (notifySuiteEnter → steps → writeResults)
 *   - Action dispatch via the actionRunner
 *   - Variable interpolation across steps
 *   - Setup steps (run in beforeAll, failures block main steps)
 *   - Teardown steps (run in afterAll, always execute)
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as path from "node:path";
import type { ObsidianCli } from "../../../src/infrastructure/cli/ObsidianCli";
import type { JourneyDefinition, StepDefinition } from "./journeyTypes";
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

/**
 * Validates that all actions in the definition use only declared tools.
 * Checks setup, steps, and teardown arrays.
 * Throws on the first undeclared tool found.
 */
function validateTools(definition: JourneyDefinition): void {
	const allowed = new Set<string>(definition.tools);
	const allSteps = [
		...(definition.setup ?? []),
		...definition.steps,
		...(definition.teardown ?? []),
	];
	for (const step of allSteps) {
		for (const action of step.actions) {
			if (!allowed.has(action.tool)) {
				throw new Error(
					`Step '${step.id}' uses undeclared tool '${action.tool}'. ` +
					`Declared tools: [${definition.tools.join(", ")}]`,
				);
			}
		}
	}
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
		description: step.description,
		expectedInput: step.expectedInput,
		expectedOutput: step.expectedOutput,
		uiContext: step.uiContext,
		events: step.events,
		commands: step.commands,
		interactions: step.interactions,
		queries: step.queries,
		actions: step.actions,
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

	const result = await runner.runStep(
		journeyStep,
		async () => {
			for (const action of step.actions) {
				await executeAction(cli, action, variables, traceBookmark, collector);
			}
		},
		{
			capture: step.capture ?? "afterSettle",
			autoScreenshot: !useExplicit,
		},
		collector.files,
	);

	return result.status === "pass" ? "pass" : "fail";
}

/**
 * Generates vitest describe/it blocks from a JourneyDefinition.
 *
 * Call this at the top level of a .test.ts file. It registers all steps
 * as vitest it() blocks inside a describe() block, with full lifecycle
 * management (fixture, plugin, event trace, runner).
 *
 * Execution flow:
 *   beforeAll: fixture init → setup steps (failures block main steps)
 *   it() per step: main journey steps (skipped if setup failed)
 *   afterAll: teardown steps (always run) → write results → cleanup
 */
export function executeJourney(definition: JourneyDefinition): void {
	validateTools(definition);

	const chapterLabel = `Chapter ${definition.chapter}: ${definition.journey}`;

	describe(chapterLabel, () => {
		let fixture: TestFixture;
		let runner: JourneyRunner;
		let cli: ObsidianCli;
		let resultsPath: string;
		let screenshotDir: string;
		let setupFailed = false;
		const variables: Record<string, string> = {
			PLUGIN_ID,
		};

		beforeAll(async () => {
			fixture = createFixture(process.env.OBSIDIAN_VAULT);
			cli = fixture.cli;

			await ensurePluginEnabled(cli);
			ensureInstalled(cli, fixture.vault.vaultDir);
			startEventTrace(cli);
			openActivityLog(cli);

			const journeyDir = path.join(
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
			});

			runner.notifySuiteEnter();

			// ── Run setup steps ──────────────────────────────────
			// Failures set setupFailed flag, blocking main steps.
			// Teardown still runs regardless.
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
			// ── Run teardown steps ───────────────────────────────
			// Always execute, even when setup or main steps failed.
			if (runner && cli) {
				for (const step of definition.teardown ?? []) {
					await runStepWithActions(
						step, "teardown", runner, cli, variables, screenshotDir,
					);
					// Don't break on teardown failure — run all teardown steps
				}
			}

			if (runner) {
				runner.writeResults(resultsPath);
				runner.notifySuiteExit();
			}
			fixture?.cleanup();
		});

		for (const step of definition.steps) {
			it(`${definition.chapter}.${step.guideSection} — ${step.title}`, async () => {
				// Skip main steps if setup failed
				if (setupFailed) {
					const journeyStep = toJourneyStep(step, "journey");
					runner.addSkippedResult(journeyStep);
					return;
				}

				const status = await runStepWithActions(
					step, "journey", runner, cli, variables, screenshotDir,
				);
				expect(status).toBe("pass");
			});
		}
	});
}
