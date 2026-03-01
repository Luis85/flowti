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
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as path from "node:path";
import type { ObsidianCli } from "../../../src/infrastructure/cli/ObsidianCli";
import type { JourneyDefinition, StepDefinition, ToolName } from "./journeyTypes";
import {
	createFixture,
	ensurePluginEnabled,
	ensureInstalled,
	startEventTrace,
	getTraceLength,
	PLUGIN_ID,
} from "./fixtures";
import { JourneyRunner } from "./journey";
import type { JourneyStep } from "./journey";
import { executeAction } from "./actionRunner";
import type { TestFixture } from "./fixtures";

/**
 * Validates that all actions in the definition use only declared tools.
 * Throws on the first undeclared tool found.
 */
function validateTools(definition: JourneyDefinition): void {
	const allowed = new Set<string>(definition.tools);
	for (const step of definition.steps) {
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
 * Strips the `actions` and `capture` fields which are handled by the executor.
 */
function toJourneyStep(step: StepDefinition): JourneyStep {
	return {
		id: step.id,
		title: step.title,
		guideSection: step.guideSection,
		description: step.description,
		expectedInput: step.expectedInput,
		expectedOutput: step.expectedOutput,
		uiContext: step.uiContext,
		events: step.events,
		commands: step.commands,
		interactions: step.interactions,
		queries: step.queries,
	};
}

/**
 * Generates vitest describe/it blocks from a JourneyDefinition.
 *
 * Call this at the top level of a .test.ts file. It registers all steps
 * as vitest it() blocks inside a describe() block, with full lifecycle
 * management (fixture, plugin, event trace, runner).
 */
export function executeJourney(definition: JourneyDefinition): void {
	validateTools(definition);

	const chapterLabel = `Chapter ${definition.chapter}: ${definition.journey}`;

	describe(chapterLabel, () => {
		let fixture: TestFixture;
		let runner: JourneyRunner;
		let cli: ObsidianCli;
		let resultsPath: string;
		const variables: Record<string, string> = {
			PLUGIN_ID,
		};

		beforeAll(async () => {
			fixture = createFixture(process.env.OBSIDIAN_VAULT);
			cli = fixture.cli;

			await ensurePluginEnabled(cli);
			ensureInstalled(cli, fixture.vault.vaultDir);
			startEventTrace(cli);

			const journeyDir = path.join(
				fixture.vault.vaultDir,
				"03 - Resources",
				"Tested Journeys",
				definition.journey,
			);
			const screenshotDir = path.join(journeyDir, "screenshots");
			resultsPath = path.join(journeyDir, `${definition.journey}-results.json`);

			runner = new JourneyRunner(cli, {
				journeyName: definition.journey,
				screenshotDir,
				settleMs: 1000,
				testSource: definition.testSource,
			});

			runner.notifySuiteEnter();
		});

		afterAll(() => {
			if (runner) {
				runner.writeResults(resultsPath);
				runner.notifySuiteExit();
			}
			fixture?.cleanup();
		});

		for (const step of definition.steps) {
			it(`${definition.chapter}.${step.guideSection} — ${step.title}`, async () => {
				const traceBookmark = getTraceLength(cli);
				const journeyStep = toJourneyStep(step);

				const screenshotDir = path.join(
					fixture.vault.vaultDir,
					"03 - Resources",
					"Tested Journeys",
					definition.journey,
					"screenshots",
				);
				const screenshotPath = path.join(screenshotDir, `${step.id}.png`);

				const result = await runner.runStep(
					journeyStep,
					async () => {
						for (const action of step.actions) {
							await executeAction(cli, action, variables, traceBookmark, screenshotPath);
						}
					},
					{ capture: step.capture ?? "afterSettle" },
				);

				expect(result.status).toBe("pass");
			});
		}
	});
}
