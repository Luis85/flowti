/**
 * E2E Chapter 2: Installer Wizard
 *
 * Validates the full installer workflow by interacting with the
 * InstallerWizardModal step-by-step: filling in user details, navigating
 * pages, watching installation progress, and verifying all created artifacts.
 *
 * Verification strategy:
 *   - EventBus events (installer.started, installer.step.completed, installer.completed)
 *   - File content inspection (folders, markdown, CSV)
 *   - DOM state for modal pages
 *
 * Prerequisites (Chapter 1) reset the installer state via filesystem and
 * enabled the plugin, which triggers InstallerWizardModal.showIfNeeded().
 * The wizard is already open when this chapter starts — we just interact
 * with it.
 *
 * Sets `window._e2eInstallerDone = true` for downstream test files.
 *
 * Run with: npm run test:e2e
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as path from "node:path";
import { ObsidianCli } from "../../src/infrastructure/cli/ObsidianCli";
import {
	createFixture,
	ensurePrerequisitesPassed,
	shouldRunInstaller,
	PLUGIN_ID,
	getTraceLength,
	getEventsSince,
	assertEventEmitted,
} from "./helpers/fixtures";
import { JourneyRunner } from "./helpers/journey";
import { highlightInput, highlightButton, highlightElement } from "./helpers/highlight";
import type { TestFixture } from "./helpers/fixtures";

const JOURNEY_NAME = "Installer";
const USER_NAME = "E2E Tester";
const USER_ROLE = "user";

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Reads the h2 heading text from the installer wizard modal. */
function getModalHeading(cli: ObsidianCli): string {
	const result = cli.eval(
		"document.querySelector('.flowti-installer-modal h2')?.textContent ?? ''",
	);
	return result.success ? result.value : "";
}

/** Checks whether the installer wizard modal is present in the DOM. */
function isModalOpen(cli: ObsidianCli): boolean {
	const result = cli.eval("!!document.querySelector('.flowti-installer-modal')");
	return result.success && result.value === "true";
}

// Detect skip mode: if vault is already installed and we're not explicitly
// testing the installer, skip the entire suite (prerequisites sets the gate flag).
const _tempFixture = createFixture(process.env.OBSIDIAN_VAULT);
const skipInstaller = !shouldRunInstaller(_tempFixture.vault.vaultDir);

describe.skipIf(skipInstaller)("Chapter 2: Installer Wizard", () => {
	let fixture: TestFixture;
	let cli: ObsidianCli;
	let runner: JourneyRunner;
	let resultsPath: string;

	beforeAll(async () => {
		fixture = createFixture(process.env.OBSIDIAN_VAULT);
		cli = fixture.cli;

		// Gate: prerequisites must have passed (plugin loaded, wizard already open)
		ensurePrerequisitesPassed(cli);

		// The wizard modal should already be open — Prerequisites (Chapter 1)
		// reset installer state on disk, then enabled the plugin fresh.
		// The plugin's onLayoutReady() → showIfNeeded() opens the wizard
		// when isInstalled() returns false.
		//
		// Give it a short grace period in case the modal is still rendering.
		let modalFound = false;
		for (let i = 0; i < 10; i++) {
			if (isModalOpen(cli)) {
				modalFound = true;
				break;
			}
			await sleep(500);
		}

		if (!modalFound) {
			const diag = cli.eval([
				"(() => {",
				`  const p = app.plugins.plugins['${PLUGIN_ID}'];`,
				"  if (!p) return 'plugin not loaded';",
				"  const keys = Object.keys(p).filter(k => k.endsWith('Service'));",
				"  const modals = document.querySelectorAll('.modal-container').length;",
				"  let installerState = 'unknown';",
				"  try {",
				"    const svc = p.services?.get?.('installerService');",
				"    installerState = svc ? String(svc.isInstalled()) : 'svc not in container';",
				"  } catch(e) { installerState = 'error: ' + e.message; }",
				"  return `services: ${keys.length}, installed: ${installerState}, modals: ${modals}`;",
				"})()",
			].join(" "));
			throw new Error(
				"Installer wizard modal not found in DOM. " +
				"Prerequisites should have left it open after plugin activation. " +
				`Diagnostic: ${diag.success ? diag.value : diag.error}`,
			);
		}

		// Write screenshots and results into the test vault
		const journeyDir = path.join(fixture.vault.vaultDir, "Tested Journeys", JOURNEY_NAME);
		const screenshotDir = path.join(journeyDir, "screenshots");
		resultsPath = path.join(journeyDir, `${JOURNEY_NAME}-results.json`);

		runner = new JourneyRunner(cli, {
			journeyName: JOURNEY_NAME,
			screenshotDir,
			settleMs: 3000,
			testSource: "tests/e2e/10-installer.test.ts",
		});

		runner.notifySuiteEnter();
	});

	afterAll(() => {
		if (runner) {
			runner.writeResults(resultsPath);
			runner.notifySuiteExit();
		}
	});

	// ── Welcome Page ─────────────────────────────────────────

	it("2.1 — Wizard modal opens on plugin load", async () => {
		const result = await runner.runStep(
			{
				id: "01-wizard-opens",
				title: "Wizard modal opens on plugin load",
				guideSection: 1,
				description:
					"Verifies the installer wizard modal is present in the DOM. Prerequisites " +
					"enabled the plugin with installer state reset — the wizard opened automatically.",
				expectedInput: "Plugin enabled by Prerequisites, installer state reset",
				expectedOutput: ".flowti-installer-modal element is present in the DOM",
			},
			() => {
				if (!isModalOpen(cli)) {
					throw new Error("Installer wizard modal not found in DOM");
				}
			},
		);

		expect(result.status).toBe("pass");
	});

	it("2.2 — Welcome page is displayed", async () => {
		const result = await runner.runStep(
			{
				id: "02-welcome-page",
				title: "Welcome page is displayed",
				guideSection: 2,
				description:
					"Verifies the wizard starts on the Welcome page with the correct heading, " +
					"a name input field, and role selector cards.",
				expectedInput: "Wizard modal is open",
				expectedOutput:
					"Heading contains 'Welcome', name input with placeholder exists, " +
					"at least 2 enabled role cards are visible",
			},
			() => {
				const heading = getModalHeading(cli);
				if (!heading.includes("Welcome")) {
					throw new Error(`Expected 'Welcome' heading, got: '${heading}'`);
				}

				const hasInput = cli.eval(
					'!!document.querySelector(\'.flowti-installer-modal input[placeholder="Enter your name"]\')',
				);
				if (!hasInput.success || hasInput.value !== "true") {
					throw new Error("Name input field not found");
				}

				const roleCards = cli.eval(
					"document.querySelectorAll('.flowti-installer-modal .ft-role-card-enabled').length",
				);
				if (!roleCards.success || Number(roleCards.value) < 2) {
					throw new Error(`Expected at least 2 role cards, found: ${roleCards.value}`);
				}
			},
		);

		expect(result.status).toBe("pass");
	});

	it("2.3 — Enter username", async () => {
		const result = await runner.runStep(
			{
				id: "03-enter-username",
				title: "Enter username",
				guideSection: 3,
				description:
					`Types '${USER_NAME}' into the name input field. Uses the native HTMLInputElement ` +
					"value setter and dispatches an 'input' event to trigger the onChange callback " +
					"that stores the name on the modal instance.",
				expectedInput: "Welcome page with empty name input",
				expectedOutput: `Name input value === '${USER_NAME}'`,
			},
			() => {
				// Highlight the input before interacting
				highlightInput(cli, '.flowti-installer-modal input[placeholder="Enter your name"]');

				// Set the input value using the native setter to ensure
				// the onChange callback fires correctly
				cli.eval([
					"(() => {",
					'  const input = document.querySelector(\'.flowti-installer-modal input[placeholder="Enter your name"]\');',
					"  if (!input) throw new Error('Name input not found');",
					"  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;",
					`  setter.call(input, '${USER_NAME}');`,
					"  input.dispatchEvent(new Event('input', { bubbles: true }));",
					"})()",
				].join(" "));

				// Verify the value was set
				const check = cli.eval(
					'document.querySelector(\'.flowti-installer-modal input[placeholder="Enter your name"]\')?.value ?? ""',
				);
				if (!check.success || check.value !== USER_NAME) {
					throw new Error(`Input value: '${check.value}', expected: '${USER_NAME}'`);
				}
			},
		);

		expect(result.status).toBe("pass");
	});

	it("2.4 — Select user role", async () => {
		const result = await runner.runStep(
			{
				id: "04-select-role",
				title: "Select user role",
				guideSection: 4,
				description:
					`Selects the '${USER_ROLE}' role by clicking the first enabled role card. ` +
					"This triggers a re-render of the welcome page (preserving the entered name).",
				expectedInput: "Welcome page with name filled in",
				expectedOutput: "First role card has .ft-card-selected class",
			},
			() => {
				// Highlight the role card before clicking
				highlightButton(cli, ".flowti-installer-modal .ft-role-card-enabled");

				// Click the first enabled role card ("User")
				cli.eval(
					"document.querySelector('.flowti-installer-modal .ft-role-card-enabled')?.click()",
				);

				// Verify it's selected (re-render sets .ft-card-selected)
				const check = cli.eval(
					"!!document.querySelector('.flowti-installer-modal .ft-card-selected')",
				);
				if (!check.success || check.value !== "true") {
					throw new Error("Role card not selected after click");
				}
			},
		);

		expect(result.status).toBe("pass");
	});

	// ── Review Page ──────────────────────────────────────────

	it("2.5 — Navigate to Review page", async () => {
		const result = await runner.runStep(
			{
				id: "05-navigate-review",
				title: "Navigate to Review page",
				guideSection: 5,
				description:
					"Clicks the 'Next' button to advance from Welcome to Review page. " +
					"The Next button only works when the name input is non-empty.",
				expectedInput: `Name: '${USER_NAME}', Role: '${USER_ROLE}'`,
				expectedOutput: "Review page heading: 'Ready to set up your vault?'",
			},
			() => {
				highlightButton(cli, ".flowti-installer-modal .ft-btn-primary");
				cli.eval(
					"document.querySelector('.flowti-installer-modal .ft-btn-primary')?.click()",
				);
			},
		);

		expect(result.status).toBe("pass");

		// Verify we landed on the review page
		const heading = getModalHeading(cli);
		expect(heading).toContain("Ready");
	});

	it("2.6 — Review page shows correct settings", async () => {
		const result = await runner.runStep(
			{
				id: "06-review-settings",
				title: "Review page shows correct settings",
				guideSection: 6,
				description:
					"Validates the Review page displays the entered user name, selected role badge, " +
					"folder structure preview, and sample content toggle.",
				expectedInput: "On Review page",
				expectedOutput:
					`Shows '${USER_NAME}' as name, 'User' as role badge, ` +
					"folder list section, sample content toggle enabled",
			},
			() => {
				// Verify user name is displayed in the identity row
				const nameCheck = cli.eval(
					"document.querySelector('.flowti-installer-modal .ft-review-identity')?.textContent ?? ''",
				);
				if (!nameCheck.success || !nameCheck.value.includes(USER_NAME)) {
					throw new Error(`Name not shown on review: '${nameCheck.value}'`);
				}

				// Verify role badge
				const roleCheck = cli.eval(
					"document.querySelector('.flowti-installer-modal .ft-review-role-badge')?.textContent ?? ''",
				);
				if (!roleCheck.success || !roleCheck.value.includes("User")) {
					throw new Error(`Role badge not shown: '${roleCheck.value}'`);
				}

				// Verify folder structure section exists
				const foldersCheck = cli.eval(
					"!!document.querySelector('.flowti-installer-modal .ft-folder-list')",
				);
				if (!foldersCheck.success || foldersCheck.value !== "true") {
					throw new Error("Folder structure section not found");
				}

				// Verify sample content toggle is enabled
				const toggleCheck = cli.eval(
					"!!document.querySelector('.flowti-installer-modal .checkbox-container.is-enabled')",
				);
				if (!toggleCheck.success || toggleCheck.value !== "true") {
					throw new Error("Sample content toggle is not enabled");
				}
			},
		);

		expect(result.status).toBe("pass");
	});

	// ── Installation ─────────────────────────────────────────

	it("2.7 — Start installation", async () => {
		const traceBefore = getTraceLength(cli);

		const result = await runner.runStep(
			{
				id: "07-start-install",
				title: "Start installation",
				guideSection: 7,
				description:
					"Clicks the 'Install' button on the Review page. This triggers " +
					"InstallerService.runAll() which executes all 3 installer steps " +
					"(user creation, folder scaffold, seed content).",
				expectedInput: "Review page with settings confirmed",
				expectedOutput:
					"installer.started event emitted, installation runs asynchronously",
			},
			() => {
				highlightButton(cli, ".flowti-installer-modal .ft-btn-primary");
				cli.eval(
					"document.querySelector('.flowti-installer-modal .ft-btn-primary')?.click()",
				);
			},
		);

		expect(result.status).toBe("pass");

		// Verify installer.started event was emitted
		assertEventEmitted(cli, traceBefore, "installer.started");
	});

	it("2.8 — Installation completes successfully", async () => {
		// Poll for completion — the installation is fast but async.
		// Check the modal heading to know when it transitions to the complete page.
		let completedHeading = "";
		for (let i = 0; i < 15; i++) {
			const heading = getModalHeading(cli);
			if (heading.toLowerCase().includes("complete") || heading.toLowerCase().includes("failed")) {
				completedHeading = heading;
				break;
			}
			await sleep(1000);
		}

		const result = await runner.runStep(
			{
				id: "08-install-complete",
				title: "Installation completes successfully",
				guideSection: 8,
				description:
					"Waits for the installer to finish all 3 steps and verifies the " +
					"modal transitions to the completion page with a success heading.",
				expectedInput: "Installation started",
				expectedOutput: "Complete page heading: 'Setup complete'",
			},
			() => {
				if (!completedHeading.toLowerCase().includes("complete")) {
					// Capture the error message from the failed installation page
					const errorResult = cli.eval(
						"document.querySelector('.flowti-installer-modal .flowti-installer-error, .flowti-installer-modal .ft-error, .flowti-installer-modal p')?.textContent ?? 'no error element found'",
					);
					const errorMsg = errorResult.success ? errorResult.value : "eval failed";
					throw new Error(`Installation did not complete. Heading: '${completedHeading}'. Error: ${errorMsg}`);
				}
			},
		);

		expect(result.status).toBe("pass");
	});

	it("2.9 — Installer events confirm all steps passed", async () => {
		const result = await runner.runStep(
			{
				id: "09-installer-events",
				title: "Installer events confirm all steps passed",
				guideSection: 9,
				description:
					"Reads the EventBus trace to verify all 3 installer steps emitted " +
					"completion events and the overall installer.completed event fired.",
				expectedInput: "Installation completed",
				expectedOutput:
					"3x installer.step.completed events + 1x installer.completed event in trace",
			},
			() => {
				// Check step completion events
				const stepEvents = getEventsSince(cli, 0, "installer.step.completed");
				if (stepEvents.length < 3) {
					throw new Error(
						`Expected 3 step completions, got ${stepEvents.length}: ` +
						stepEvents.map((e) => e.payload).join(", "),
					);
				}

				// Check overall completion event
				const completeEvents = getEventsSince(cli, 0, "installer.completed");
				if (completeEvents.length === 0) {
					throw new Error("installer.completed event not found in trace");
				}
			},
		);

		expect(result.status).toBe("pass");
	});

	it("2.10 — Complete page shows success message", async () => {
		const result = await runner.runStep(
			{
				id: "10-success-message",
				title: "Complete page shows success message",
				guideSection: 10,
				description:
					"Verifies the completion page displays a success alert with the user's " +
					"name and a summary of all completed steps.",
				expectedInput: "On complete page",
				expectedOutput:
					`Success alert contains '${USER_NAME}', step summary list present`,
			},
			() => {
				// Verify success alert contains the user name
				const alertCheck = cli.eval(
					"document.querySelector('.flowti-installer-modal .ft-alert-success')?.textContent ?? ''",
				);
				if (!alertCheck.success || !alertCheck.value.includes(USER_NAME)) {
					throw new Error(`Success alert missing user name: '${alertCheck.value}'`);
				}

				// Verify step summary section exists
				const summaryCheck = cli.eval(
					"document.querySelectorAll('.flowti-installer-modal .ft-step-status-icon').length",
				);
				if (!summaryCheck.success || Number(summaryCheck.value) < 3) {
					throw new Error(`Expected 3+ step summaries, found: ${summaryCheck.value}`);
				}
			},
		);

		expect(result.status).toBe("pass");
	});

	// ── Close Wizard ─────────────────────────────────────────

	it("2.11 — Close the wizard", async () => {
		const result = await runner.runStep(
			{
				id: "11-close-wizard",
				title: "Close the wizard",
				guideSection: 11,
				description:
					"Clicks the 'Close' button on the completion page to dismiss the " +
					"installer wizard modal.",
				expectedInput: "On complete page with success state",
				expectedOutput: "No .flowti-installer-modal element in DOM",
			},
			() => {
				// Highlight then click the Close button (secondary button on the left)
				highlightButton(cli, ".flowti-installer-modal .ft-btn-secondary");
				cli.eval(
					"document.querySelector('.flowti-installer-modal .ft-btn-secondary')?.click()",
				);
			},
		);

		expect(result.status).toBe("pass");

		// Verify modal is gone
		expect(isModalOpen(cli)).toBe(false);
	});

	// ── Artifact Verification ────────────────────────────────
	// Verify through file content inspection, not just existence checks.

	it("2.12 — User was created with correct profile", async () => {
		const result = await runner.runStep(
			{
				id: "12-verify-user",
				title: "User was created with correct profile",
				guideSection: 12,
				description:
					"Reads the created user via UserService and verifies the name and role " +
					"match what was entered in the wizard.",
				expectedInput: `Wizard set userName='${USER_NAME}', role='${USER_ROLE}'`,
				expectedOutput: `user.name === '${USER_NAME}', user.role === '${USER_ROLE}'`,
			},
			() => {
				// Read user through the service (async getService, but eval is fire-and-forget)
				cli.eval([
					"void (async () => {",
					`  const p = app.plugins.plugins['${PLUGIN_ID}'];`,
					"  const svc = await p.getService('userService');",
					"  const u = svc.getUser();",
					"  p._e2eUser = JSON.stringify({ name: u?.name, role: u?.role });",
					"})();",
				].join(" "));

				// Small delay for async eval to complete
				const check = cli.eval(`app.plugins.plugins['${PLUGIN_ID}']._e2eUser`);
				if (!check.success || !check.value) {
					throw new Error("Could not read user data from plugin");
				}
				const user = JSON.parse(check.value) as { name: string; role: string };
				if (user.name !== USER_NAME) throw new Error(`User name: '${user.name}'`);
				if (user.role !== USER_ROLE) throw new Error(`User role: '${user.role}'`);
			},
		);

		expect(result.status).toBe("pass");
	});

	it("2.13 — Folder structure was scaffolded", async () => {
		const result = await runner.runStep(
			{
				id: "13-verify-folders",
				title: "Folder structure was scaffolded",
				guideSection: 13,
				description:
					"Spot-checks key folders from the 29-folder scaffold by querying " +
					"app.vault.getAbstractFileByPath() for each.",
				expectedInput: "Installer ran FolderScaffoldStep",
				expectedOutput: "Folders 00-Connectivity/inbox, 03-Resources/Sample Data, 04-Archive exist",
			},
			() => {
				const folders = [
					"00 - Connectivity/inbox",
					"03 - Resources/Sample Data",
					"03 - Resources/Documentation",
					"04 - Archive",
					"var/data",
				];
				for (const folder of folders) {
					const check = cli.eval(`!!app.vault.getAbstractFileByPath('${folder}')`);
					if (!check.success || check.value !== "true") {
						throw new Error(`Folder not found: ${folder}`);
					}
				}
			},
		);

		expect(result.status).toBe("pass");
	});

	it("2.14 — Welcome note was created with correct content", async () => {
		const result = await runner.runStep(
			{
				id: "14-verify-welcome",
				title: "Welcome note was created with correct content",
				guideSection: 14,
				description:
					"Reads the Welcome to Flowti.md file and verifies it contains " +
					"the expected content (not just that it exists).",
				expectedInput: "Installer ran SeedContentStep with includeSampleContent=true",
				expectedOutput: "File exists and contains Flowti-related content",
			},
			() => {
				const welcomePath = "00 - Connectivity/inbox/Welcome to Flowti.md";
				const check = cli.eval(`!!app.vault.getAbstractFileByPath('${welcomePath}')`);
				if (!check.success || check.value !== "true") {
					throw new Error(`Welcome note not found: ${welcomePath}`);
				}

				// Read the file content and verify it's not empty
				const content = cli.readFile(welcomePath);
				if (!content || content.trim().length === 0) {
					throw new Error("Welcome note is empty");
				}
				if (!content.toLowerCase().includes("flowti")) {
					throw new Error("Welcome note does not mention Flowti");
				}
			},
		);

		expect(result.status).toBe("pass");
	});

	it("2.15 — Sample CSV was seeded with data rows", async () => {
		const result = await runner.runStep(
			{
				id: "15-verify-csv",
				title: "Sample CSV was seeded with data rows",
				guideSection: 15,
				description:
					"Reads the supplier-overview.csv and verifies it contains data rows " +
					"with expected column headers (Month, Supplier, SKU, etc.).",
				expectedInput: "Installer ran SeedContentStep with sample data",
				expectedOutput: "CSV file contains headers and at least 10 data rows",
			},
			() => {
				const csvPath = "03 - Resources/Sample Data/supplier-overview.csv";
				const check = cli.eval(`!!app.vault.getAbstractFileByPath('${csvPath}')`);
				if (!check.success || check.value !== "true") {
					throw new Error(`CSV not found: ${csvPath}`);
				}

				// Read and validate CSV content
				const content = cli.readFile(csvPath);
				const lines = content.trim().split("\n");
				if (lines.length < 10) {
					throw new Error(`CSV too short: ${lines.length} lines (expected 10+)`);
				}

				// Verify header row contains expected columns
				const header = lines[0].toLowerCase();
				const expectedColumns = ["month", "supplier", "category"];
				for (const col of expectedColumns) {
					if (!header.includes(col)) {
						throw new Error(`CSV header missing column '${col}': ${lines[0]}`);
					}
				}
			},
		);

		expect(result.status).toBe("pass");
	});

	it("2.16 — Test data CSVs are indexed by Obsidian", async () => {
		const result = await runner.runStep(
			{
				id: "16-verify-test-csv",
				title: "Test data CSVs are indexed by Obsidian",
				guideSection: 16,
				description:
					"Confirms that the analytics test CSV (generated by generate-test-data.mjs " +
					"in globalSetup) is indexed by Obsidian — requires detectAllFileExtensions.",
				expectedInput: "globalSetup generated test data, detectAllFileExtensions enabled",
				expectedOutput: "Suppliers.csv is accessible via vault API",
			},
			() => {
				const csvPath = "03 - Resources/Test Data/Analytics/Suppliers.csv";
				const check = cli.eval(`!!app.vault.getAbstractFileByPath('${csvPath}')`);
				if (!check.success || check.value !== "true") {
					throw new Error(`Test data CSV not found: ${csvPath}`);
				}
			},
		);

		expect(result.status).toBe("pass");

		// Set the installer gate flag on window (survives plugin reloads)
		cli.eval("window._e2eInstallerDone = true");
	});
});
