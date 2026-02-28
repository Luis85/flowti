/**
 * E2E Chapter 3: Getting Started Journey
 *
 * Validates the "User Guide — Getting Started" knowledgebase tutorial
 * by executing each step via Obsidian commands and EventBus events,
 * capturing a screenshot at every step, and recording results for the
 * E2E Report generator.
 *
 * Depends on Chapter 2 (Installer) having completed — the installed
 * vault state (folders, seed content, user) is required for these flows.
 *
 * Run with: npm run test:e2e
 * Run alone: npm run test:e2e -- --journey=getting-started
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
import { navigateToTab, assertLeafOpen, revealInExplorer } from "./helpers/navigation";
import { highlightElement } from "./helpers/highlight";
import type { TestFixture } from "./helpers/fixtures";

const JOURNEY_NAME = "Getting Started";

/** Path to the generated test data CSV (created by generate-test-data.mjs in globalSetup). */
const TEST_DATA_CSV = "03 - Resources/Test Data/Analytics/Suppliers.csv";

describe("Chapter 3: Getting Started", () => {
	let fixture: TestFixture;
	let runner: JourneyRunner;
	let cli: ObsidianCli;
	let resultsPath: string;

	beforeAll(async () => {
		fixture = createFixture(process.env.OBSIDIAN_VAULT);
		cli = fixture.cli;

		await ensurePluginEnabled(cli);
		ensureInstalled(cli, fixture.vault.vaultDir);

		// Write screenshots and results into the test vault (viewable in Obsidian)
		const journeyDir = path.join(fixture.vault.vaultDir, "03 - Resources", "Tested Journeys", JOURNEY_NAME);
		const screenshotDir = path.join(journeyDir, "screenshots");
		resultsPath = path.join(journeyDir, `${JOURNEY_NAME}-results.json`);

		runner = new JourneyRunner(cli, {
			journeyName: JOURNEY_NAME,
			screenshotDir,
			settleMs: 3000,
			testSource: "tests/e2e/30-journey-getting-started.test.ts",
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

	it("3.1 — Open the User Hub", async () => {
		const result = await runner.runStep(
			{
				id: "01-user-hub",
				title: "Open the User Hub",
				guideSection: 1,
				description: "Opens the User Hub via the command palette. This is the central dashboard for user-facing features.",
				expectedInput: "Plugin enabled, no views open",
				expectedOutput: "flowti-user-hub leaf is active in the center pane",
				uiContext: {
					view: "flowti-user-hub",
					viewName: "User Hub",
					tab: "sessions",
					tabName: "Sessions",
					components: ["WorkspaceShell", "SessionsTab"],
				},
			},
			() => {
				highlightElement(cli, ".side-dock-ribbon-action[aria-label*='User']");
				cli.executeCommand("flowti-ibde:flowti:open-user-hub");
			},
		);

		expect(result.status).toBe("pass");
		assertLeafOpen(cli, "flowti-user-hub");
	});

	it("3.2 — Open the Event Catalog", async () => {
		const result = await runner.runStep(
			{
				id: "02-event-catalog",
				title: "Open the Event Catalog",
				guideSection: 2,
				description: "Opens the Event Catalog to explore and describe the business domain. Lists all event definitions and domain categories.",
				expectedInput: "Plugin enabled",
				expectedOutput: "flowti-event-catalog leaf is active",
				uiContext: {
					view: "flowti-event-catalog",
					viewName: "Event Catalog",
					tab: "domains",
					tabName: "Domains",
					components: ["WorkspaceShell", "DomainsTab"],
				},
			},
			() => {
				highlightElement(cli, ".side-dock-ribbon-action[aria-label*='Event']");
				cli.executeCommand("flowti-ibde:flowti:open-event-catalog");
			},
		);

		expect(result.status).toBe("pass");
		assertLeafOpen(cli, "flowti-event-catalog");
	});

	it("3.3 — Navigate to the Domains tab", async () => {
		const result = await runner.runStep(
			{
				id: "03-domains-tab",
				title: "Navigate to Domains tab",
				guideSection: 3,
				description: "Switches the Event Catalog to the Domains tab to view domain groupings and categories.",
				expectedInput: "Event Catalog view is open",
				expectedOutput: "Domains tab is active, showing domain list",
				uiContext: {
					view: "flowti-event-catalog",
					viewName: "Event Catalog",
					tab: "domains",
					tabName: "Domains",
					components: ["WorkspaceShell", "DomainsTab"],
				},
			},
			async () => {
				await navigateToTab(cli, "event-catalog", "flowti-event-catalog", "domains");
			},
		);

		expect(result.status).toBe("pass");
	});

	it("3.4 — Open the Data Exchange Hub", async () => {
		const result = await runner.runStep(
			{
				id: "04-data-exchange-hub",
				title: "Open the Data Exchange Hub",
				guideSection: 4,
				description: "Opens the Data Exchange Hub where import/export configurations and data pipeline status are managed.",
				expectedInput: "Plugin enabled",
				expectedOutput: "flowti-data-exchange-hub leaf is active",
				uiContext: {
					view: "flowti-data-exchange-hub",
					viewName: "Data Exchange Hub",
					tab: "pipelines",
					tabName: "Pipelines",
					components: ["WorkspaceShell", "PipelinesTab"],
				},
			},
			() => {
				highlightElement(cli, ".side-dock-ribbon-action[aria-label*='Data']");
				cli.executeCommand("flowti-ibde:flowti:open-data-exchange");
			},
		);

		expect(result.status).toBe("pass");
		assertLeafOpen(cli, "flowti-data-exchange-hub");
	});

	it("3.5 — Verify test data for import", async () => {
		const result = await runner.runStep(
			{
				id: "05-test-data",
				title: "Verify test data for import",
				guideSection: 5,
				description: "Confirms the generated Suppliers.csv test data is present in the vault and indexed by Obsidian.",
				expectedInput: `CSV generated by generate-test-data.mjs at ${TEST_DATA_CSV}`,
				expectedOutput: "File is indexed in vault (getAbstractFileByPath returns truthy)",
				uiContext: {
					components: ["FileExplorer"],
				},
			},
			() => {
				const file = cli.eval(
					`!!app.vault.getAbstractFileByPath('${TEST_DATA_CSV}')`,
				);
				if (!file.success || file.value !== "true") {
					throw new Error(`Test data CSV not found: ${TEST_DATA_CSV}`);
				}
				revealInExplorer(cli, TEST_DATA_CSV);
			},
		);

		expect(result.status).toBe("pass");
	});

	it("3.6 — Open the CSV Import view", async () => {
		const result = await runner.runStep(
			{
				id: "06-import-view",
				title: "Open CSV Import view",
				guideSection: 6,
				description: "Triggers the CSV import flow by emitting ui.openCsvImport with the Suppliers.csv path. The Data Exchange Hub must be open for the import callback to be registered.",
				expectedInput: `Data Exchange Hub open, Suppliers CSV at ${TEST_DATA_CSV}`,
				expectedOutput: "CSV import action view opens with file preview",
				uiContext: {
					view: "flowti-data-exchange-hub",
					viewName: "Data Exchange Hub",
					tab: "imports",
					tabName: "Imports",
					components: ["WorkspaceShell", "CsvImportView", "EventBus"],
				},
			},
			() => {
				cli.eval([
					`const p = app.plugins.plugins['flowti-ibde'];`,
					`if (p && p.eventBus) p.eventBus.emit('ui.openCsvImport', {`,
					`  filePath: '${TEST_DATA_CSV}',`,
					`  autoStart: false`,
					`});`,
				].join(" "));
			},
		);

		expect(result.status).toBe("pass");
	});

	it("3.7 — Navigate to the Properties tab", async () => {
		const result = await runner.runStep(
			{
				id: "07-properties-tab",
				title: "Navigate to Properties tab",
				guideSection: 7,
				description: "Switches the Data Exchange Hub to the Properties tab to inspect data exchange configuration and field mappings.",
				expectedInput: "Data Exchange Hub view is open",
				expectedOutput: "Properties tab is active, showing configuration details",
				uiContext: {
					view: "flowti-data-exchange-hub",
					viewName: "Data Exchange Hub",
					tab: "properties",
					tabName: "Properties",
					components: ["WorkspaceShell", "PropertiesTab"],
				},
			},
			async () => {
				await navigateToTab(cli, "data-exchange", "flowti-data-exchange-hub", "properties");
			},
		);

		expect(result.status).toBe("pass");
	});

	it("3.8 — Open the Analytics Hub", async () => {
		const result = await runner.runStep(
			{
				id: "08-analytics-hub",
				title: "Open the Analytics Hub",
				guideSection: 8,
				description: "Opens the Analytics Hub for dashboard creation and CSV-based data analysis.",
				expectedInput: "Plugin enabled",
				expectedOutput: "flowti-analytics-hub leaf is active",
				uiContext: {
					view: "flowti-analytics-hub",
					viewName: "Analytics Hub",
					tab: "dashboards",
					tabName: "Dashboards",
					components: ["WorkspaceShell", "DashboardsTab"],
				},
			},
			() => {
				highlightElement(cli, ".side-dock-ribbon-action[aria-label*='Analytics']");
				cli.executeCommand("flowti-ibde:flowti:open-analytics-hub");
			},
		);

		expect(result.status).toBe("pass");
		assertLeafOpen(cli, "flowti-analytics-hub");
	});
});
