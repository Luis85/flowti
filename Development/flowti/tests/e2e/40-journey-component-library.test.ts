/**
 * E2E Chapter 4: Component Library Journey
 *
 * Systematically opens each of the 5 hubs, navigates to every tab
 * (including the dashboard), and captures a screenshot of each view —
 * a visual regression baseline for all hub views.
 *
 * 5 hubs x (1 dashboard + N tabs) = 30 screenshots total.
 *
 * Depends on Chapter 2 (Installer) having completed.
 *
 * Run with: npm run test:e2e
 * Run alone: npm run test:e2e -- --journey=component-library
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as path from "node:path";
import { ObsidianCli } from "../../src/infrastructure/cli/ObsidianCli";
import {
	createFixture,
	ensurePluginEnabled,
	ensureInstalled,
} from "./helpers/fixtures";
import { JourneyRunner } from "./helpers/journey";
import { navigateToTab, assertLeafOpen, closeHub } from "./helpers/navigation";
import { highlightElement } from "./helpers/highlight";
import type { TestFixture } from "./helpers/fixtures";

const JOURNEY_NAME = "Component Library";

interface HubDef {
	name: string;
	hubId: string;
	viewType: string;
	command: string;
	tabs: string[];
}

const HUBS: HubDef[] = [
	{
		name: "Event Catalog",
		hubId: "event-catalog",
		viewType: "flowti-event-catalog",
		command: "flowti-ibde:flowti:open-event-catalog",
		tabs: ["domains", "services", "events", "flows", "systems", "actors", "products", "health"],
	},
	{
		name: "Data Exchange",
		hubId: "data-exchange",
		viewType: "flowti-data-exchange-hub",
		command: "flowti-ibde:flowti:open-data-exchange",
		tabs: ["pipelines", "imports", "exports", "types", "properties", "signals", "reports", "canvas"],
	},
	{
		name: "User Hub",
		hubId: "user-hub",
		viewType: "flowti-user-hub",
		command: "flowti-ibde:flowti:open-user-hub",
		tabs: ["sessions", "inbox", "commands", "preferences"],
	},
	{
		name: "Train Hub",
		hubId: "train-hub",
		viewType: "flowti-train-hub",
		command: "flowti-ibde:flowti:open-train-hub",
		tabs: ["active", "history"],
	},
	{
		name: "Analytics Hub",
		hubId: "analytics",
		viewType: "flowti-analytics-hub",
		command: "flowti-ibde:flowti:open-analytics-hub",
		tabs: ["dashboards", "measurements", "queries"],
	},
];

describe("Chapter 4: Component Library", () => {
	let fixture: TestFixture;
	let runner: JourneyRunner;
	let cli: ObsidianCli;
	let resultsPath: string;

	beforeAll(async () => {
		fixture = createFixture(process.env.OBSIDIAN_VAULT);
		cli = fixture.cli;

		await ensurePluginEnabled(cli);
		ensureInstalled(cli, fixture.vault.vaultDir);

		const journeyDir = path.join(fixture.vault.vaultDir, "03 - Resources", "Tested Journeys", JOURNEY_NAME);
		const screenshotDir = path.join(journeyDir, "screenshots");
		resultsPath = path.join(journeyDir, `${JOURNEY_NAME}-results.json`);

		runner = new JourneyRunner(cli, {
			journeyName: JOURNEY_NAME,
			screenshotDir,
			settleMs: 3000,
			testSource: "tests/e2e/40-journey-component-library.test.ts",
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

	// ── Step numbering ─────────────────────────────────────
	// Registration-time counter for test names (evaluated when vitest collects tests)
	let regStep = 0;
	// Execution-time counter for step IDs and guide sections
	let execStep = 0;

	function stepId(n: number, suffix: string): string {
		return `${String(n).padStart(2, "0")}-${suffix}`;
	}

	// ── Generate tests for each hub ────────────────────────
	for (const hub of HUBS) {
		const hubSlug = hub.hubId;

		// Open hub
		const openNum = ++regStep;
		it(`4.${openNum} — Open ${hub.name}`, async () => {
			const n = ++execStep;
			const result = await runner.runStep(
				{
					id: stepId(n, `${hubSlug}-open`),
					title: `Open ${hub.name}`,
					guideSection: n,
					description: `Opens the ${hub.name} hub via command.`,
					expectedOutput: `${hub.viewType} leaf is active`,
				},
				() => {
					// Close any existing leaf from prior journeys so we start fresh on dashboard
					closeHub(cli, hub.viewType);
					cli.executeCommand(hub.command);
				},
			);
			expect(result.status).toBe("pass");
			assertLeafOpen(cli, hub.viewType);
		});

		// Dashboard screenshot
		const dashNum = ++regStep;
		it(`4.${dashNum} — ${hub.name} Dashboard`, async () => {
			const n = ++execStep;
			const result = await runner.runStep(
				{
					id: stepId(n, `${hubSlug}-dashboard`),
					title: `${hub.name} Dashboard`,
					guideSection: n,
					description: `Screenshots the ${hub.name} dashboard (default view).`,
				},
				() => {
					highlightElement(cli, ".ft-dashboard");
				},
			);
			expect(result.status).toBe("pass");
		});

		// Each tab
		for (const tab of hub.tabs) {
			const tabNum = ++regStep;
			it(`4.${tabNum} — ${hub.name} > ${tab}`, async () => {
				const n = ++execStep;
				const result = await runner.runStep(
					{
						id: stepId(n, `${hubSlug}-${tab}`),
						title: `${hub.name} > ${tab}`,
						guideSection: n,
						description: `Navigates to the ${tab} tab in ${hub.name}.`,
					},
					async () => {
						await navigateToTab(cli, hub.hubId, hub.viewType, tab);
					},
				);
				expect(result.status).toBe("pass");
			});
		}
	}
});
