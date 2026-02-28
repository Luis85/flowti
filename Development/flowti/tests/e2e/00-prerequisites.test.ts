/**
 * E2E Chapter 1: Prerequisites
 *
 * Validates that the test environment is ready before any Flowti-specific
 * testing begins. Runs in two phases:
 *
 *   Phase 1 — Platform (no plugin needed):
 *     CLI connectivity, vault file operations, frontmatter, search
 *
 *   Phase 2 — Plugin activation:
 *     Two modes depending on vault state:
 *
 *     INSTALLER MODE (vault not installed, or E2E_RUN_INSTALLER=true):
 *       Resets installer state + deletes seed files via vault API,
 *       enables plugin → wizard opens automatically → Chapter 2 tests it.
 *
 *     SKIP MODE (vault already installed):
 *       Enables plugin normally (no wizard), sets both gate flags,
 *       Chapter 2 is skipped entirely.
 *
 * This file runs FIRST (alphabetical sequencer: 00-). Combined with
 * vitest `bail: 1`, any failure here stops the entire E2E suite.
 *
 * Sets `window._e2ePrerequisitesPassed = true` for downstream test files.
 *
 * Run with: npm run test:e2e
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { ObsidianCli } from "../../src/infrastructure/cli/ObsidianCli";
import {
	createFixture,
	startEventTrace,
	shouldRunInstaller,
	vaultDelete,
	INSTALLER_SEED_FILES,
	PLUGIN_ID,
} from "./helpers/fixtures";
import { JourneyRunner } from "./helpers/journey";
import { revealInExplorer } from "./helpers/navigation";
import type { TestFixture } from "./helpers/fixtures";

const JOURNEY_NAME = "Prerequisites";

describe("Chapter 1: Prerequisites", () => {
	let fixture: TestFixture;
	let cli: ObsidianCli;
	let runner: JourneyRunner;
	let resultsPath: string;
	let runInstaller: boolean;

	beforeAll(async () => {
		fixture = createFixture(process.env.OBSIDIAN_VAULT);
		cli = fixture.cli;

		// Determine mode: run installer wizard or skip with fixtures
		runInstaller = shouldRunInstaller(fixture.vault.vaultDir);
		console.log(`[e2e] Installer mode: ${runInstaller ? "RUN (fresh install)" : "SKIP (vault already installed)"}`);

		// Write screenshots and results into the test vault
		const journeyDir = path.join(fixture.vault.vaultDir, "03 - Resources", "Tested Journeys", JOURNEY_NAME);
		const screenshotDir = path.join(journeyDir, "screenshots");
		resultsPath = path.join(journeyDir, `${JOURNEY_NAME}-results.json`);

		runner = new JourneyRunner(cli, {
			journeyName: JOURNEY_NAME,
			screenshotDir,
			settleMs: 2000,
			testSource: "tests/e2e/00-prerequisites.test.ts",
		});

		runner.notifySuiteEnter();
	});

	afterAll(() => {
		// Only set the gate flag if ALL prerequisite checks passed
		const results = runner.getResults();
		if (results.failed === 0 && results.totalSteps > 0) {
			cli.eval("window._e2ePrerequisitesPassed = true");

			// In skip mode, also set the installer-done flag
			// (installer test won't run, journey tests need this gate)
			if (!runInstaller) {
				cli.eval("window._e2eInstallerDone = true");
			}
		}

		runner.writeResults(resultsPath);
		runner.notifySuiteExit();
		fixture.cleanup();
	});

	// ── Phase 1: Platform (no plugin needed) ─────────────────

	it("1.1 — CLI can reach Obsidian", async () => {
		const result = await runner.runStep(
			{
				id: "01-cli-connectivity",
				title: "CLI can reach Obsidian",
				guideSection: 1,
				description:
					"Verifies the Obsidian CLI can execute JavaScript in the running Obsidian instance. " +
					"This is the foundation — every subsequent test depends on CLI connectivity.",
				expectedInput: "Obsidian running with the test vault open",
				expectedOutput: "eval('1+1') returns '2'",
			},
			() => {
				const check = cli.eval("1+1");
				if (!check.success) throw new Error(`CLI eval failed: ${check.error ?? "unknown"}`);
				if (check.value !== "2") throw new Error(`Expected '2', got '${check.value}'`);
			},
		);

		expect(result.status).toBe("pass");
	});

	it("1.2 — Vault accepts file operations", async () => {
		const result = await runner.runStep(
			{
				id: "02-file-crud",
				title: "Vault accepts file operations",
				guideSection: 2,
				description:
					"Creates a test markdown file, reads it back, and verifies the content " +
					"matches. Confirms the CLI-to-vault file I/O pipeline works.",
				expectedInput: "CLI accessible, vault responsive",
				expectedOutput: "Created file content matches on read-back",
			},
			() => {
				const testPath = fixture.createFile("prereq-crud.md", "# E2E CRUD Test");
				revealInExplorer(cli, testPath);
				const content = cli.readFile(testPath);
				if (!content.includes("E2E CRUD Test")) {
					throw new Error(`Read content mismatch: ${content.substring(0, 100)}`);
				}
			},
		);

		expect(result.status).toBe("pass");
	});

	it("1.3 — Frontmatter properties persist", async () => {
		const result = await runner.runStep(
			{
				id: "03-frontmatter",
				title: "Frontmatter properties persist",
				guideSection: 3,
				description:
					"Creates a file with YAML frontmatter, sets a property via CLI, " +
					"reads the file back and verifies the property was written.",
				expectedInput: "File CRUD works",
				expectedOutput: "Property 'status: verified' appears in file content",
			},
			() => {
				const testPath = fixture.createFile(
					"prereq-fm.md",
					"---\ntype: test\n---\n# Frontmatter Test",
				);
				cli.setProperty(testPath, "status", "verified");
				const content = cli.readFile(testPath);
				if (!content.includes("verified")) {
					throw new Error("Frontmatter property 'status' not found after set");
				}
			},
		);

		expect(result.status).toBe("pass");
	});

	it("1.4 — Vault search indexes content", async () => {
		const result = await runner.runStep(
			{
				id: "04-search",
				title: "Vault search indexes content",
				guideSection: 4,
				description:
					"Creates a file with a unique token, then searches for it. " +
					"Verifies Obsidian's search index picks up new content.",
				expectedInput: "File CRUD works",
				expectedOutput: "Search returns at least one result for the unique token",
			},
			() => {
				const token = `prereq-search-${Date.now()}`;
				fixture.createFile("prereq-search.md", `# Search\n${token}`);
				const results = cli.search(token);
				if (results.length === 0) {
					throw new Error(`Search returned no results for token '${token}'`);
				}
			},
		);

		expect(result.status).toBe("pass");
	});

	// ── Phase 2: Plugin activation ───────────────────────────

	it("1.5 — Installer state prepared", async () => {
		const result = await runner.runStep(
			{
				id: "05-installer-reset",
				title: runInstaller
					? "Installer state reset (fresh install mode)"
					: "Installer state verified (skip mode)",
				guideSection: 5,
				description: runInstaller
					? "Resets installer state in data.json and removes seed files via " +
					  "vault API. The wizard will open when the plugin starts."
					: "Vault is already installed from a previous run. Plugin will " +
					  "load normally without opening the wizard.",
				expectedInput: "data.json exists in plugin directory",
				expectedOutput: runInstaller
					? "installer.installed === false, seed files removed"
					: "installer.installed === true, seed files present",
			},
			async () => {
				const dataJsonPath = path.join(
					fixture.vault.vaultDir, ".obsidian", "plugins", PLUGIN_ID, "data.json",
				);

				if (runInstaller) {
					// INSTALLER MODE: disable plugin, modify data.json through
					// Obsidian's adapter (bypasses any internal cache), then
					// re-enable in step 1.6 to trigger the wizard.
					cli.eval(`app.plugins.disablePlugin('${PLUGIN_ID}')`);

					// Poll until the plugin is actually disabled (async op)
					let disabled = false;
					for (let i = 0; i < 20; i++) {
						await new Promise((resolve) => setTimeout(resolve, 500));
						const check = cli.eval(`!app.plugins.plugins['${PLUGIN_ID}']`);
						if (check.success && check.value === "true") {
							disabled = true;
							break;
						}
					}
					if (!disabled) {
						throw new Error("Plugin did not disable within 10 seconds");
					}

					// Modify data.json through Obsidian's vault adapter so that
					// any internal data cache is consistent with the file on disk.
					// TypedStorage key is "installer" (NOT "installerService").
					const dataRelPath = `.obsidian/plugins/${PLUGIN_ID}/data.json`;
					cli.eval([
						"(async () => {",
						`  const raw = await app.vault.adapter.read('${dataRelPath}');`,
						"  const data = JSON.parse(raw);",
						"  data.installer = { installed: false, completedSteps: {} };",
						`  await app.vault.adapter.write('${dataRelPath}', JSON.stringify(data));`,
						"})()",
					].join(" "));
					// Wait for async adapter write to complete
					await new Promise((resolve) => setTimeout(resolve, 1000));

					// Verify the write took effect on disk
					const verify = JSON.parse(fs.readFileSync(dataJsonPath, "utf-8"));
					if (verify.installer?.installed !== false) {
						throw new Error("data.json write did not persist");
					}

					// Remove seed files via Obsidian vault API (cache-safe).
					// Uses vault.delete() so the file index stays consistent.
					for (const relPath of INSTALLER_SEED_FILES) {
						vaultDelete(cli, relPath);
					}
				} else {
					// SKIP MODE: verify the vault is in a good state
					for (const relPath of INSTALLER_SEED_FILES) {
						const absPath = path.join(fixture.vault.vaultDir, relPath);
						if (!fs.existsSync(absPath)) {
							throw new Error(`Seed file missing in skip mode: ${relPath}`);
						}
						revealInExplorer(cli, relPath);
					}
				}
			},
		);

		expect(result.status).toBe("pass");
	});

	it("1.6 — Flowti plugin activates successfully", async () => {
		const result = await runner.runStep(
			{
				id: "06-plugin-activated",
				title: "Flowti plugin activates successfully",
				guideSection: 6,
				description: runInstaller
					? "Enables the Flowti IBDE plugin. With installer state reset, " +
					  "the wizard opens automatically via showIfNeeded()."
					: "Enables the Flowti IBDE plugin. Already installed — loads normally.",
				expectedInput: runInstaller
					? "Installer state reset, plugin not yet enabled"
					: "Vault installed, plugin not yet enabled",
				expectedOutput: "Plugin is loaded and accessible via app.plugins.plugins",
			},
			() => {
				cli.enablePlugin(PLUGIN_ID);
			},
		);

		expect(result.status).toBe("pass");

		// Wait for plugin to fully initialize (services load asynchronously)
		await new Promise((resolve) => setTimeout(resolve, 5000));

		// Start collecting EventBus trace for the entire E2E run.
		startEventTrace(cli);
	});

	it("1.7 — Plugin reports healthy state", async () => {
		const result = await runner.runStep(
			{
				id: "07-plugin-health",
				title: "Plugin reports healthy state",
				guideSection: 7,
				description:
					"Inspects the plugin state snapshot: loaded=true, no errors, " +
					"and at least one service registered.",
				expectedInput: "Plugin enabled",
				expectedOutput: "loaded=true, hasErrors=false, services.length > 0",
			},
			() => {
				const state = cli.getPluginState();
				if (!state.loaded) throw new Error("Plugin state: not loaded");
				if (state.hasErrors) throw new Error("Plugin state: has errors");
				if (!state.services || state.services.length === 0) {
					throw new Error("Plugin state: no services registered");
				}
			},
		);

		expect(result.status).toBe("pass");
	});

	it("1.8 — EventBus is collecting events", async () => {
		const result = await runner.runStep(
			{
				id: "08-eventbus",
				title: "EventBus is collecting events",
				guideSection: 8,
				description:
					"Verifies the plugin's EventBus is available and the E2E event trace " +
					"array is initialized (started after plugin activation).",
				expectedInput: "Plugin loaded, event trace started",
				expectedOutput: "eventBus exists and _e2eEventTrace is an array",
			},
			() => {
				const check = cli.eval(
					`(() => { const p = app.plugins.plugins['${PLUGIN_ID}']; ` +
					"return !!p.eventBus && Array.isArray(p._e2eEventTrace); })()",
				);
				if (!check.success || check.value !== "true") {
					throw new Error("EventBus or event trace not available");
				}
			},
		);

		expect(result.status).toBe("pass");
	});

	it("1.9 — Flowti commands are registered", async () => {
		const result = await runner.runStep(
			{
				id: "09-commands",
				title: "Flowti commands are registered",
				guideSection: 9,
				description:
					"Executes the 'open User Hub' command via CLI to verify the Flowti " +
					"command pipeline is wired up and responsive.",
				expectedInput: "Plugin loaded with registered commands",
				expectedOutput: "Command executes without throwing",
			},
			() => {
				cli.executeCommand("flowti-ibde:flowti:open-user-hub");
			},
		);

		expect(result.status).toBe("pass");
	});

	it("1.10 — Required services are available", async () => {
		const result = await runner.runStep(
			{
				id: "10-services",
				title: "Required services are available",
				guideSection: 10,
				description:
					"Reads the plugin's registered service keys and verifies the essential " +
					"services (userService, analyticsService, dataExchangeService) are present.",
				expectedInput: "Plugin loaded and healthy",
				expectedOutput: "Service keys include userService, analyticsService, dataExchangeService",
			},
			() => {
				const keys = cli.evalJson<string[]>(
					`JSON.stringify(Object.keys(app.plugins.plugins['${PLUGIN_ID}']).filter(k => k.endsWith('Service')))`,
				);
				if (!Array.isArray(keys) || keys.length === 0) {
					throw new Error("No services found on plugin instance");
				}
				const required = ["analyticsService", "dataExchangeService", "userService"];
				for (const svc of required) {
					if (!keys.includes(svc)) {
						throw new Error(`Missing required service: ${svc}`);
					}
				}
			},
		);

		expect(result.status).toBe("pass");
	});
});
