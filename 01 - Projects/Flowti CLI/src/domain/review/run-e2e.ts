/**
 * run-e2e.ts — E2E test runner wrapper.
 *
 * Runs the vitest E2E suite, then always generates the E2E report
 * regardless of test outcome. After report generation, opens the
 * report in the test vault so it's immediately viewable.
 *
 * Exits with the vitest exit code so failures are visible to CI.
 *
 * Usage:
 *   node scripts/run-e2e.mjs                                           Full suite
 *   node scripts/run-e2e.mjs --journey=installer                       Installer only
 *   node scripts/run-e2e.mjs --journey=getting-started                  One journey
 *   node scripts/run-e2e.mjs --journey=getting-started,component-library Multiple journeys
 *   node scripts/run-e2e.mjs --journey=installer,getting-started        Installer + journey
 *   node scripts/run-e2e.mjs --list                                     Interactive test session
 *
 * npm script presets:
 *   npm run test:e2e                   Full suite
 *   npm run test:e2e:installer         Installer only
 *   npm run test:e2e:getting-started   Getting Started only
 *   npm run test:e2e:components        Component Library only
 *   npm run test:e2e:tool-showcase      Tool Showcase only
 *   npm run test:e2e:journeys          All journeys (no installer)
 *   npm run test:e2e:quick             Installer + Getting Started (fast)
 *   npm run test:e2e:list              Interactive test session
 */
import { execSync } from "node:child_process";
import path from "node:path";
import { disk } from "../../infrastructure/filesystem.js";
import readline from "node:readline";

import { VAULT_ROOT, PLUGIN_ROOT } from "../../infrastructure/config.js";
import { log } from "../../infrastructure/logger.js";
const PROJECTS_ROOT: string = path.resolve(VAULT_ROOT, "..");
const TEST_VAULT: string = process.env.E2E_VAULT_DIR ?? path.join(PROJECTS_ROOT, "flowti-e2e");
const VAULT_NAME: string = path.basename(TEST_VAULT);
const JOURNEYS_DIR: string = path.join(PLUGIN_ROOT, "tests", "e2e", "journeys");
const PLUGIN_ID: string = "flowti-ibde";
const PLUGIN_DIR: string = path.join(TEST_VAULT, ".obsidian", "plugins", PLUGIN_ID);
const DATA_JSON_PATH: string = path.join(PLUGIN_DIR, "data.json");
const PLUGIN_ARTIFACTS: string[] = ["main.js", "manifest.json", "styles.css"];
const TEST_DATA_CSV: string = path.join(TEST_VAULT, "03 - Resources", "Test Data", "Analytics", "Suppliers.csv");

// ── Readline helpers ────────────────────────────────────────────────

function ask(rl: readline.Interface, question: string, defaultValue: string = ""): Promise<string> {
	return new Promise((resolve) => {
		const suffix = defaultValue ? ` (${defaultValue})` : "";
		rl.question(`  ${question}${suffix}: `, (answer: string) => {
			resolve(answer.trim() || defaultValue);
		});
	});
}

function askYesNo(rl: readline.Interface, question: string, defaultNo: boolean = true): Promise<boolean> {
	return new Promise((resolve) => {
		const hint = defaultNo ? "(y/N)" : "(Y/n)";
		rl.question(`  ${question} ${hint}: `, (answer: string) => {
			const input = answer.trim().toLowerCase();
			if (!input) {
				resolve(!defaultNo);
				return;
			}
			resolve(input === "y" || input === "yes");
		});
	});
}

// ── File explorer helpers ────────────────────────────────────────────

function collapseFileExplorer(): void {
	try {
		execSync(
			`obsidian vault=${VAULT_NAME} eval code="(() => { const explorer = app.workspace.getLeavesOfType('file-explorer')[0]; if (explorer && explorer.view) { const foldStatus = explorer.view.fileItems; if (foldStatus) { Object.values(foldStatus).forEach(item => { if (item.collapsed !== undefined) item.setCollapsed(true); }); } } })()"`,
			{ stdio: "pipe", timeout: 10_000 },
		);
		log("  \x1b[32m✓\x1b[0m File navigator folders collapsed");
	} catch {
		// Non-fatal — file explorer may not be visible
	}
}

// ── Prerequisites check (local filesystem + single CLI ping) ────────

interface PrerequisiteResults {
	vaultExists: boolean;
	artifactsPresent: boolean;
	missingArtifacts: string[];
	cliResponsive: boolean;
	vaultInstalled: boolean;
	testDataPresent: boolean;
}

function checkPrerequisites(): PrerequisiteResults {
	const results: PrerequisiteResults = {
		vaultExists: false,
		artifactsPresent: false,
		missingArtifacts: [],
		cliResponsive: false,
		vaultInstalled: false,
		testDataPresent: false,
	};

	// 1. Vault exists
	results.vaultExists = disk.existsSync(TEST_VAULT);

	// 2. Plugin artifacts
	if (results.vaultExists) {
		results.missingArtifacts = PLUGIN_ARTIFACTS.filter(
			(f) => !disk.existsSync(path.join(PLUGIN_DIR, f)),
		);
		results.artifactsPresent = results.missingArtifacts.length === 0;
	}

	// 3. CLI responsive (single eval, best-effort)
	if (results.vaultExists) {
		try {
			const output = execSync(
				`obsidian vault=${VAULT_NAME} eval code="1+1"`,
				{ encoding: "utf-8", stdio: "pipe", timeout: 10_000 },
			);
			results.cliResponsive = output.includes("2");
		} catch {
			results.cliResponsive = false;
		}
	}

	// 4. Vault installed (data.json check)
	if (results.vaultExists && disk.existsSync(DATA_JSON_PATH)) {
		try {
			const data = JSON.parse(disk.readFileSync(DATA_JSON_PATH, "utf-8")) as Record<string, unknown>;
			results.vaultInstalled = (data.installer as Record<string, unknown>)?.installed === true;
		} catch {
			results.vaultInstalled = false;
		}
	}

	// 5. Test data present
	results.testDataPresent = disk.existsSync(TEST_DATA_CSV);

	return results;
}

function printPrerequisites(results: PrerequisiteResults): void {
	const ok: (msg: string) => void = (msg) => log(`  \x1b[32m✓\x1b[0m ${msg}`);
	const fail: (msg: string) => void = (msg) => log(`  \x1b[31m✗\x1b[0m ${msg}`);
	const info: (msg: string) => void = (msg) => log(`  \x1b[33m○\x1b[0m ${msg}`);

	log("\n  Prerequisites (local):\n");

	if (results.vaultExists) ok(`Test vault exists: ${TEST_VAULT}`);
	else fail(`Test vault missing: ${TEST_VAULT}`);

	if (results.artifactsPresent) ok("Plugin artifacts: main.js, manifest.json, styles.css");
	else fail(`Plugin artifacts missing: ${results.missingArtifacts.join(", ")}`);

	if (results.cliResponsive) ok("Obsidian CLI responsive");
	else fail("Obsidian CLI not responsive (is Obsidian running?)");

	if (results.vaultInstalled) ok("Vault installed (data.json → installer.installed = true)");
	else info("Vault not installed (installer will run)");

	if (results.testDataPresent) ok("Test data CSV present");
	else info("Test data missing (generated during setup)");

	log();
}

// ── Teardown to fresh state ─────────────────────────────────────────

/**
 * Performs the actual teardown steps (non-interactive).
 * Deletes vault content, resets installer state, deactivates plugin,
 * clears workspace layout, and collapses file explorer.
 */
async function performTeardown(): Promise<void> {
	// 1. Delete vault content via Obsidian CLI (cache-safe)
	try {
		execSync(
			`obsidian vault=${VAULT_NAME} eval code="(async () => { const root = app.vault.getRoot(); const children = root.children || []; for (const child of [...children]) { if (child.path === '.obsidian' || child.path.startsWith('.obsidian/')) continue; try { await app.vault.delete(child, true); } catch(e) {} } })()"`,
			{ stdio: "pipe", timeout: 30_000 },
		);
		// Wait for async deletions
		await new Promise<void>((r) => setTimeout(r, 1000));
		log("  \x1b[32m✓\x1b[0m Vault content deleted (via Obsidian API)");
	} catch {
		log("  \x1b[31m✗\x1b[0m Failed to delete vault content (is Obsidian running?)");
	}

	// 2. Purge ghost file index entries
	try {
		execSync(
			`obsidian vault=${VAULT_NAME} eval code="(async () => { const ghosts = []; for (const f of [...app.vault.getAllLoadedFiles()]) { if (f.path === '/' || f.path.startsWith('.obsidian')) continue; const exists = await app.vault.adapter.exists(f.path); if (!exists) ghosts.push(f); } for (const f of ghosts) { try { await app.vault.delete(f, true); } catch {} try { if (f.parent) f.parent.children = f.parent.children.filter(c => c !== f); delete app.vault.fileMap[f.path]; } catch {} } })()"`,
			{ stdio: "pipe", timeout: 30_000 },
		);
		await new Promise<void>((r) => setTimeout(r, 500));
		log("  \x1b[32m✓\x1b[0m Ghost entries purged");
	} catch {
		// Non-fatal — ghost entries will be cleaned on next globalSetup
	}

	// 3. Reset data.json
	if (disk.existsSync(DATA_JSON_PATH)) {
		try {
			const data = JSON.parse(disk.readFileSync(DATA_JSON_PATH, "utf-8")) as Record<string, unknown>;
			data.installer = { installed: false, completedSteps: {} };
			disk.writeFileSync(DATA_JSON_PATH, JSON.stringify(data), "utf-8");
			log("  \x1b[32m✓\x1b[0m Installer state reset");
		} catch {
			log("  \x1b[31m✗\x1b[0m Failed to reset data.json");
		}
	} else {
		log("  \x1b[33m○\x1b[0m data.json not found (already fresh)");
	}

	// 4. Deactivate plugin
	try {
		execSync(
			`obsidian vault=${VAULT_NAME} eval code="app.plugins.disablePlugin('${PLUGIN_ID}')"`,
			{ stdio: "pipe", timeout: 10_000 },
		);
		await new Promise<void>((r) => setTimeout(r, 1000));
		log("  \x1b[32m✓\x1b[0m Plugin deactivated");
	} catch {
		log("  \x1b[33m○\x1b[0m Plugin deactivation skipped (may not be loaded)");
	}

	// 5. Clear workspace layout
	const workspacePath: string = path.join(TEST_VAULT, ".obsidian", "workspace.json");
	if (disk.existsSync(workspacePath)) {
		try {
			disk.rmSync(workspacePath, { force: true });
			log("  \x1b[32m✓\x1b[0m Workspace layout cleared");
		} catch {
			// Non-fatal
		}
	}

	// 6. Collapse all folders in the file navigator
	collapseFileExplorer();

	log("\n  \x1b[32m✓\x1b[0m Fresh state.\n");
}

/**
 * Interactive teardown — prompts for confirmation before proceeding.
 */
async function teardownVault(): Promise<void> {
	log("\n  Teardown will:");
	log("    - Delete all vault content (except .obsidian/)");
	log("    - Reset installer state (data.json → installed: false)");
	log("    - Deactivate plugin");
	log("    - Clear workspace layout");
	log("    - Collapse file navigator folders\n");

	const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
	const proceed = await askYesNo(rl, "Proceed?", true);
	rl.close();

	if (!proceed) {
		log("\n  Teardown cancelled.\n");
		return;
	}

	log();
	await performTeardown();
}

// ── Journey table ───────────────────────────────────────────────────

interface JourneyEntry {
	slug: string;
	name: string;
	chapter: string;
	steps: number;
	description: string;
}

function loadJourneyEntries(): JourneyEntry[] {
	const files = disk.readdirSync(JOURNEYS_DIR)
		.filter((f) => f.endsWith(".journey"))
		.sort();

	return files.map((f) => {
		const def = JSON.parse(disk.readFileSync(path.join(JOURNEYS_DIR, f), "utf-8")) as Record<string, unknown>;
		const slug = f.replace(".journey", "");
		return {
			slug,
			name: (def.journey as string) ?? slug,
			chapter: (def.chapter as string) ?? "?",
			steps: Array.isArray(def.steps) ? def.steps.length : 0,
			description: (def.description as string) ?? "",
		};
	});
}

function printJourneyTable(entries: JourneyEntry[]): void {
	log("\n  Available Journeys:\n");
	log("  #  Ch  Name                          Steps  Description");
	log("  " + "-".repeat(78));
	for (let i = 0; i < entries.length; i++) {
		const e = entries[i];
		const num = String(i + 1).padStart(2, " ");
		const ch = String(e.chapter).padStart(2, " ");
		const name = e.name.padEnd(28);
		const steps = String(e.steps).padStart(5);
		const desc = e.description.length > 40 ? e.description.slice(0, 37) + "..." : e.description;
		log(`  ${num}  ${ch}  ${name}  ${steps}  ${desc}`);
	}
	log();
}

// ── Session config prompt ───────────────────────────────────────────

interface SessionConfig {
	sessionName: string;
	selectedSlugs: string[];
	includeInstaller: boolean;
	includePrerequisites: boolean;
	stepFilter: Record<string, "all" | string[]>;
}

async function promptSessionConfig(rl: readline.Interface, entries: JourneyEntry[], prereqResults: PrerequisiteResults): Promise<SessionConfig> {
	// Journey selection first — needed for auto-generated session name
	printJourneyTable(entries);
	const journeyInput = await ask(rl, 'Enter journey numbers (e.g. "2" or "1 3 4") or "all"');

	if (!journeyInput) {
		log("\n  No selection — exiting.\n");
		process.exit(0);
	}

	let selectedSlugs: string[];
	if (journeyInput.toLowerCase() === "all") {
		selectedSlugs = entries.map((e) => e.slug);
	} else {
		const indices = journeyInput.split(/[\s,]+/).map(Number).filter((n) => n >= 1 && n <= entries.length);
		if (indices.length === 0) {
			log("\n  Invalid selection — exiting.\n");
			process.exit(1);
		}
		selectedSlugs = indices.map((i) => entries[i - 1].slug);
	}

	log();

	// Step selection — per-journey step filtering
	const stepFilter = await promptStepFilter(rl, selectedSlugs);

	// Session name — auto-generated from timestamp + journey slugs
	const timestamp = new Date().toISOString().replace(/:/g, "-").slice(0, 19);
	const journeySuffix = selectedSlugs.length === entries.length
		? "all"
		: selectedSlugs.join("+");
	const autoName = `${timestamp} ${journeySuffix}`;
	const sessionName = await ask(rl, "Session name (Enter for auto)", autoName);

	// Installer toggle — default N when installed, Y (force) when not
	const installerLabel = prereqResults.vaultInstalled
		? "Include installer? (force)"
		: "Include installer? (not installed)";
	const includeInstaller = await askYesNo(rl, installerLabel, prereqResults.vaultInstalled);

	// Prerequisites toggle — default N when all prereqs met, Y (force) when not
	const prereqsMet = prereqResults.vaultInstalled && prereqResults.vaultExists && prereqResults.artifactsPresent;
	const prereqLabel = prereqsMet
		? "Include prerequisites? (force)"
		: "Include prerequisites? (not yet passed)";
	const includePrerequisites = await askYesNo(rl, prereqLabel, prereqsMet);

	return { sessionName, selectedSlugs, includeInstaller, includePrerequisites, stepFilter };
}

/** Prints the step table for a journey definition. */
function printStepTable(def: Record<string, unknown>, steps: Array<Record<string, unknown>>): void {
	const setupSteps = (def.setup as Array<Record<string, unknown>>) ?? [];
	const teardownSteps = (def.teardown as Array<Record<string, unknown>>) ?? [];
	const dim = "\x1b[2m";
	const reset = "\x1b[0m";
	log(`  Steps for ${def.journey} (${steps.length} steps):\n`);
	log("    #  ID                          Title");
	log("   " + "-".repeat(62));

	for (const s of setupSteps) {
		const id = ((s.id as string) ?? "setup").padEnd(26);
		log(`${dim}   ·  ${id}  ${s.title}  [setup]${reset}`);
	}
	for (let i = 0; i < steps.length; i++) {
		const s = steps[i];
		const num = String(i + 1).padStart(3);
		const id = ((s.id as string) ?? `step-${i + 1}`).padEnd(26);
		log(`  ${num}  ${id}  ${s.title}`);
	}
	for (const s of teardownSteps) {
		const id = ((s.id as string) ?? "teardown").padEnd(26);
		log(`${dim}   ·  ${id}  ${s.title}  [teardown]${reset}`);
	}
	log();
}

/** Parses a step input string like "1 3 5-7" into step IDs from the steps array. */
function parseStepInput(input: string, steps: Array<Record<string, unknown>>): string[] {
	const ids: string[] = [];
	for (const token of input.split(/[\s,]+/)) {
		const range = token.match(/^(\d+)-(\d+)$/);
		if (range) {
			const lo = Number(range[1]);
			const hi = Number(range[2]);
			for (let n = lo; n <= hi; n++) {
				if (n >= 1 && n <= steps.length) ids.push(steps[n - 1].id as string);
			}
		} else {
			const n = Number(token);
			if (n >= 1 && n <= steps.length) ids.push(steps[n - 1].id as string);
		}
	}
	return ids;
}

/** Resolves step filter from user input string. */
function resolveStepFilter(input: string, steps: Array<Record<string, unknown>>): "all" | string[] {
	const normalized = input.trim().toLowerCase();
	if (normalized === "all" || normalized === "") return "all";
	if (normalized === "none") return [];
	const ids = parseStepInput(input, steps);
	return ids.length > 0 ? ids : "all";
}

/**
 * Prompts the user to select steps for each journey.
 * Returns a map of { slug: "all" | string[] } where string[] contains step IDs.
 */
async function promptStepFilter(rl: readline.Interface, selectedSlugs: string[]): Promise<Record<string, "all" | string[]>> {
	const stepFilter: Record<string, "all" | string[]> = {};

	for (const slug of selectedSlugs) {
		const journeyPath = path.join(JOURNEYS_DIR, `${slug}.journey`);
		if (!disk.existsSync(journeyPath)) {
			stepFilter[slug] = "all";
			continue;
		}

		const def = JSON.parse(disk.readFileSync(journeyPath, "utf-8")) as Record<string, unknown>;
		const steps = (def.steps as Array<Record<string, unknown>>) ?? [];
		if (steps.length === 0) {
			stepFilter[slug] = "all";
			continue;
		}

		printStepTable(def, steps);
		const stepInput = await ask(rl, 'Steps (numbers/ranges, "all", or "none")', "all");
		stepFilter[slug] = resolveStepFilter(stepInput, steps);

		const sel = stepFilter[slug];
		if (sel === "all") {
			log(`  → All ${steps.length} steps selected\n`);
		} else {
			log(`  → ${sel.length} of ${steps.length} steps selected\n`);
		}
	}

	return stepFilter;
}

// ── Post-run summary ────────────────────────────────────────────────

interface TestStats {
	totalTests: number;
	passed: number;
	failed: number;
	skipped: number;
}

/** Extracts test stats from the vitest JSON reporter format (testResults array). */
function extractStatsFromTestResults(testResults: Array<Record<string, unknown>>): TestStats {
	let totalTests = 0, passed = 0, failed = 0, skipped = 0;
	const statusCounters: Record<string, () => void> = {
		passed: () => passed++,
		failed: () => failed++,
	};
	for (const suite of testResults) {
		if (!Array.isArray(suite.assertionResults)) continue;
		for (const test of suite.assertionResults as Array<Record<string, unknown>>) {
			totalTests++;
			const counter = statusCounters[test.status as string];
			if (counter) counter(); else skipped++;
		}
	}
	return { totalTests, passed, failed, skipped };
}

/**
 * Reads vitest JSON report and returns test result stats.
 */
function readTestStats(): TestStats {
	const reportPath = path.join(PLUGIN_ROOT, "docs", "reports", "tests", "testreport.json");
	if (!disk.existsSync(reportPath)) return { totalTests: 0, passed: 0, failed: 0, skipped: 0 };

	try {
		const report = JSON.parse(disk.readFileSync(reportPath, "utf-8")) as Record<string, unknown>;
		if (report.numTotalTests != null) {
			return {
				totalTests: report.numTotalTests as number,
				passed: (report.numPassedTests as number) ?? 0,
				failed: (report.numFailedTests as number) ?? 0,
				skipped: (report.numPendingTests as number) ?? 0,
			};
		}
		if (Array.isArray(report.testResults)) {
			return extractStatsFromTestResults(report.testResults as Array<Record<string, unknown>>);
		}
	} catch {
		// Report parsing failed — show zeros
	}
	return { totalTests: 0, passed: 0, failed: 0, skipped: 0 };
}

function printSummary(sessionName: string, selectedNames: string[], startTime: number, stats: TestStats): void {
	const duration = ((Date.now() - startTime) / 1000).toFixed(1);
	const failColor = stats.failed > 0 ? "\x1b[31m" : "\x1b[32m";
	const reset = "\x1b[0m";

	log(`\n  ${"=".repeat(60)}`);
	log(`  Session Summary: ${sessionName}`);
	log(`  ${"=".repeat(60)}\n`);
	log(`  Duration:     ${duration}s`);
	log(`  Journeys:     ${selectedNames.length} (${selectedNames.join(", ")})`);
	log(`  Tests:        ${stats.totalTests} total`);
	log(`  Passed:       \x1b[32m${stats.passed}${reset}`);
	log(`  Failed:       ${failColor}${stats.failed}${reset}`);
	log(`  Skipped:      ${stats.skipped}`);
	log(`  Report:       docs/reports/e2e/E2E Report.md`);
	log();
}

// ── Session note ────────────────────────────────────────────────────

/** Builds the session note frontmatter lines. */
function buildSessionFrontmatter(sessionName: string, config: SessionConfig, stats: TestStats, status: string, duration: string, now: Date): string[] {
	return [
		"---",
		"type: E2ESession",
		`session: ${yamlStr(sessionName)}`,
		`date: ${now.toISOString()}`,
		`status: ${status}`,
		`duration_s: ${duration}`,
		`total_tests: ${stats.totalTests}`,
		`passed: ${stats.passed}`,
		`failed: ${stats.failed}`,
		`skipped: ${stats.skipped}`,
		`installer: ${config.includeInstaller}`,
		`prerequisites: ${config.includePrerequisites}`,
		`journeys:`,
		...config.selectedSlugs.map((s) => `  - ${s}`),
		"tags:",
		"  - e2e",
		"  - session",
		"---",
	];
}

/** Builds the prerequisite check table rows. */
function buildPrereqRows(prereqResults: PrerequisiteResults): string[] {
	return [
		`| Test vault exists | ${prereqResults.vaultExists ? "✓" : "✗"} |`,
		`| Plugin artifacts | ${prereqResults.artifactsPresent ? "✓" : "✗"} |`,
		`| Obsidian CLI responsive | ${prereqResults.cliResponsive ? "✓" : "✗"} |`,
		`| Vault installed | ${prereqResults.vaultInstalled ? "✓" : "○ not yet"} |`,
		`| Test data present | ${prereqResults.testDataPresent ? "✓" : "○ generated during setup"} |`,
	];
}

/**
 * Writes a Markdown session note to the test vault at:
 *   03 - Resources/Sessions/{sessionName}/{sessionName}.md
 */
function writeSessionNote(sessionName: string, config: SessionConfig, selectedNames: string[], prereqResults: PrerequisiteResults, stats: TestStats, startTime: number, exitCode: number): string {
	const now = new Date();
	const duration = ((Date.now() - startTime) / 1000).toFixed(1);
	const status = exitCode === 0 ? "passed" : "failed";

	const journeyEntries = loadJourneyEntries();
	const journeyRows = config.selectedSlugs.map((slug, i) => {
		const name = selectedNames[i] || slug;
		const entry = journeyEntries.find((e) => e.slug === slug);
		return `| ${i + 1} | ${name} | ${entry ? entry.steps : "?"} |`;
	});

	const lines: string[] = [
		...buildSessionFrontmatter(sessionName, config, stats, status, duration, now),
		"",
		`# E2E Session: ${sessionName}`,
		"",
		`> [!${exitCode === 0 ? "success" : "danger"}] ${exitCode === 0 ? "All tests passed" : "Some tests failed"}`,
		`> Duration: ${duration}s | Tests: ${stats.totalTests} | Passed: ${stats.passed} | Failed: ${stats.failed} | Skipped: ${stats.skipped}`,
		"",
		"## Configuration",
		"",
		`| Setting | Value |`,
		`|---|---|`,
		`| Session | ${sessionName} |`,
		`| Date | ${now.toISOString().slice(0, 19).replace("T", " ")} |`,
		`| Installer | ${config.includeInstaller ? "yes" : "no"} |`,
		`| Prerequisites | ${config.includePrerequisites ? "force" : "skip"} |`,
		`| Journeys | ${selectedNames.join(", ")} |`,
		"",
		"---",
		"",
		"## Prerequisites (local)",
		"",
		`| Check | Status |`,
		`|---|---|`,
		...buildPrereqRows(prereqResults),
		"",
		"---",
		"",
		"## Journeys",
		"",
		`| # | Journey | Steps |`,
		`|---|---|---|`,
		...journeyRows,
		"",
		"---",
		"",
		"## Results",
		"",
		`| Metric | Value |`,
		`|---|---|`,
		`| Duration | ${duration}s |`,
		`| Total tests | ${stats.totalTests} |`,
		`| Passed | ${stats.passed} |`,
		`| Failed | ${stats.failed} |`,
		`| Skipped | ${stats.skipped} |`,
		`| Exit code | ${exitCode} |`,
		"",
		"---",
		"",
		"## Links",
		"",
		"- [[E2E Report]]",
		"- [[Event Trace]]",
		"",
	];

	const content = lines.join("\n");

	// Write to test vault
	const sessionDir = path.join(TEST_VAULT, "03 - Resources", "Sessions", sessionName);
	const notePath = path.join(sessionDir, `${sessionName}.md`);
	disk.mkdirSync(sessionDir, { recursive: true });
	disk.writeFileSync(notePath, content, "utf-8");
	log(`[e2e] Session note written: ${notePath}`);

	// Mirror to dev vault
	const devSessionDir = path.join(PLUGIN_ROOT, "docs", "reports", "e2e", "sessions", sessionName);
	const devNotePath = path.join(devSessionDir, `${sessionName}.md`);
	disk.mkdirSync(devSessionDir, { recursive: true });
	disk.writeFileSync(devNotePath, content, "utf-8");
	log(`[e2e] Session note mirrored: ${devNotePath}`);

	return notePath;
}

/** YAML-safe string escaping. */
function yamlStr(value: string): string {
	if (/[:\n\r\t#'"{}[\],&*?]|^\s|\s$/.test(value)) return JSON.stringify(value);
	return value;
}

// ── Quick build + deploy ─────────────────────────────────────────────

/**
 * Runs a fast production build (esbuild only, no type-check or tests)
 * and copies the artifacts to the test vault plugin directory.
 * Reloads the plugin in Obsidian so changes take effect immediately.
 * Returns 0 on success, non-zero on failure.
 */
function quickBuildAndDeploy(): number {
	log("\n  Quick build (esbuild → deploy → reload)...\n");

	// 1. Run esbuild production build
	try {
		execSync("node esbuild.config.mjs --production", { stdio: "inherit" });
		log("\n  \x1b[32m✓\x1b[0m Build completed");
	} catch (err) {
		log("\n  \x1b[31m✗\x1b[0m Build failed");
		return (err as { status?: number }).status ?? 1;
	}

	// 2. Copy artifacts from main vault to test vault
	const mainPluginDir = path.resolve(PLUGIN_ROOT, "..", "..", ".obsidian", "plugins", PLUGIN_ID);
	let copied = 0;
	for (const artifact of PLUGIN_ARTIFACTS) {
		const src = path.join(mainPluginDir, artifact);
		const dest = path.join(PLUGIN_DIR, artifact);
		if (disk.existsSync(src)) {
			disk.mkdirSync(path.dirname(dest), { recursive: true });
			disk.copyFileSync(src, dest);
			copied++;
		} else {
			log(`  \x1b[33m○\x1b[0m Artifact not found: ${artifact}`);
		}
	}
	log(`  \x1b[32m✓\x1b[0m Deployed ${copied} artifacts to test vault`);

	// 3. Reload plugin in Obsidian
	try {
		execSync(
			`obsidian vault=${VAULT_NAME} eval code="(async () => { await app.plugins.disablePlugin('${PLUGIN_ID}'); await app.plugins.enablePlugin('${PLUGIN_ID}'); return 'reloaded'; })()"`,
			{ stdio: "pipe", timeout: 15_000 },
		);
		log("  \x1b[32m✓\x1b[0m Plugin reloaded in Obsidian\n");
	} catch {
		log("  \x1b[33m○\x1b[0m Plugin reload skipped (Obsidian may not be running)\n");
	}

	return 0;
}

// ── Increment build ─────────────────────────────────────────────────

interface ReportSource {
	file: string;
	fm: Record<string, unknown> | null;
}

interface BuildStats {
	build: Record<string, unknown> | null;
	test: Record<string, unknown> | null;
	coverage: Record<string, unknown> | null;
	performance: Record<string, unknown> | null;
	cycle: Record<string, unknown> | null;
	e2e: Record<string, unknown> | null;
	traceability: Record<string, unknown> | null;
	unitTests: TestStats;
}

/**
 * Reads the latest build report frontmatter for summary display.
 */
function readBuildStats(): BuildStats {
	const buildFile = findLatestReport(path.join(REPORTS_DIR, "builds"));
	const testFile = findLatestReport(path.join(REPORTS_DIR, "tests"));
	const coverageDir = path.join(REPORTS_DIR, "coverage");
	const coverageFile = findLatestReport(coverageDir);
	const perfFile = findLatestReport(path.join(REPORTS_DIR, "performance"));
	const cycleFile = findLatestReport(path.join(REPORTS_DIR, "cycles"));
	const e2eFile = path.join(REPORTS_DIR, "e2e", "E2E Report.md");
	const traceFile = path.join(REPORTS_DIR, "traceability", "Trace Conformance Report.md");

	return {
		build: buildFile ? parseFrontmatter(buildFile) : null,
		test: testFile ? parseFrontmatter(testFile) : null,
		coverage: coverageFile ? parseFrontmatter(coverageFile) : null,
		performance: perfFile ? parseFrontmatter(perfFile) : null,
		cycle: cycleFile ? parseFrontmatter(cycleFile) : null,
		e2e: disk.existsSync(e2eFile) ? parseFrontmatter(e2eFile) : null,
		traceability: disk.existsSync(traceFile) ? parseFrontmatter(traceFile) : null,
		unitTests: readTestStats(),
	};
}

/** Shared metric extraction from BuildStats. */
interface ExtractedMetrics {
	b: Record<string, unknown>;
	t: Record<string, unknown>;
	c: Record<string, unknown>;
	e: Record<string, unknown>;
	p: Record<string, unknown>;
	cy: Record<string, unknown>;
	sizeKb: number;
	linesPct: number;
	branchesPct: number;
	functionsPct: number;
	cycle: string | number;
}

function extractReportMaps(stats: BuildStats): { b: Record<string, unknown>; t: Record<string, unknown>; c: Record<string, unknown>; e: Record<string, unknown>; p: Record<string, unknown>; cy: Record<string, unknown> } {
	return {
		b: stats.build ?? {},
		t: stats.test ?? {},
		c: stats.coverage ?? {},
		e: stats.e2e ?? {},
		p: stats.performance ?? {},
		cy: stats.cycle ?? {},
	};
}

function extractCoverageMetrics(c: Record<string, unknown>): { linesPct: number; branchesPct: number; functionsPct: number } {
	return {
		linesPct: (c.lines_pct ?? c.line_pct ?? c.line_percent ?? 0) as number,
		branchesPct: (c.branches_pct ?? 0) as number,
		functionsPct: (c.functions_pct ?? 0) as number,
	};
}

function extractMetrics(stats: BuildStats): ExtractedMetrics {
	const maps = extractReportMaps(stats);
	const cov = extractCoverageMetrics(maps.c);
	return {
		...maps,
		sizeKb: maps.b.total_bytes ? Math.round(maps.b.total_bytes as number / 1024) : 0,
		...cov,
		cycle: (maps.cy.cycle ?? maps.cy.number ?? "") as string | number,
	};
}

/** Builds the unit tests markdown section. */
function buildUnitTestsSection(ut: TestStats, t: Record<string, unknown>): string[] {
	const lines = ["## Unit Tests", ""];
	if (ut.totalTests > 0) {
		const icon = ut.failed === 0 ? "success" : "danger";
		lines.push(`> [!${icon}] ${ut.passed}/${ut.totalTests} passed | ${t.suites ?? "?"} suites`);
		lines.push("", "| Metric | Value |", "|---|---|");
		lines.push(`| Total | ${ut.totalTests} |`, `| Passed | ${ut.passed} |`, `| Failed | ${ut.failed} |`, `| Skipped | ${ut.skipped} |`, `| Suites | ${t.suites ?? "?"} |`);
		if (t.duration_ms) lines.push(`| Duration | ${Math.round(t.duration_ms as number / 1000)}s |`);
	} else {
		lines.push("> No unit test data available.");
	}
	lines.push("");
	return lines;
}

/** Builds the coverage markdown section. */
function buildCoverageSection(linesPct: number, branchesPct: number, functionsPct: number, c: Record<string, unknown>): string[] {
	const lines = ["## Coverage", ""];
	if (linesPct > 0) {
		lines.push("| Metric | Value |", "|---|---|");
		lines.push(`| Lines | ${linesPct}% |`, `| Branches | ${branchesPct}% |`, `| Functions | ${functionsPct}% |`);
		if (c.files_covered) lines.push(`| Files | ${c.files_covered} |`);
	} else {
		lines.push("> No coverage data available.");
	}
	lines.push("");
	return lines;
}

/** Builds the E2E tests markdown section. */
function buildE2eSection(e: Record<string, unknown>): string[] {
	const lines = ["## E2E Tests", ""];
	if (((e.total_tests as number) ?? 0) > 0) {
		const icon = ((e.failed as number) ?? 0) === 0 ? "success" : "danger";
		lines.push(`> [!${icon}] ${e.passed}/${e.total_tests} passed | ${e.journeys ?? "?"} journeys`);
		lines.push("", "| Metric | Value |", "|---|---|");
		lines.push(`| Total | ${e.total_tests} |`, `| Passed | ${e.passed} |`, `| Failed | ${e.failed} |`, `| Journeys | ${e.journeys} |`, `| Actions | ${e.total_actions} |`, `| Screenshots | ${e.total_screenshots ?? "?"} |`);
		if (e.duration) lines.push(`| Duration | ${e.duration} |`);
	} else {
		lines.push("> No E2E data available.");
	}
	lines.push("");
	return lines;
}

/** Builds the performance markdown section. */
function buildPerformanceSection(p: Record<string, unknown>, t: Record<string, unknown>): string[] {
	const lines = ["## Performance", ""];
	const p50 = p.startup_p50 ?? t.startup_p50;
	if (p50) {
		lines.push("| Metric | Value |", "|---|---|");
		lines.push(`| Startup p50 | ${p50} ms |`, `| Startup p95 | ${p.startup_p95 ?? t.startup_p95 ?? "?"} ms |`, `| Startup Max | ${p.startup_max ?? t.startup_max ?? "?"} ms |`);
		if (p.data_json_size_bytes || t.data_json_size_bytes) {
			const djSize = (p.data_json_size_bytes ?? t.data_json_size_bytes) as number;
			lines.push(`| data.json | ${(djSize / (1024 * 1024)).toFixed(1)} MB |`);
		}
	} else {
		lines.push("> No performance data available.");
	}
	lines.push("");
	return lines;
}

/** Builds the build table section. */
function buildBuildTable(sizeKb: number, b: Record<string, unknown>): string[] {
	return [
		"## Build", "",
		"| Metric | Value |", "|---|---|",
		`| Bundle Size | ${sizeKb} KB |`,
		`| Build Duration | ${b.duration_ms ?? "?"} ms |`,
		`| Plugin Version | ${b.plugin_version ?? "?"} |`,
		`| Warnings | ${b.warnings_count ?? 0} |`,
		`| Errors | ${b.errors_count ?? 0} |`,
		"",
	];
}

/** Builds the state report frontmatter (shared by increment and publish). */
function buildStateReportFrontmatter(type: string, status: string, duration: string, now: Date, m: ExtractedMetrics, ut: TestStats): string[] {
	return [
		"---",
		`type: ${type}`,
		`date: "${now.toISOString()}"`,
		`status: ${status}`,
		`duration_s: ${duration}`,
		...(m.cycle ? [`cycle: ${m.cycle}`] : []),
		`plugin_version: ${m.b.plugin_version ?? "?"}`,
		"# Build",
		`bundle_size_kb: ${m.sizeKb}`,
		`build_duration_ms: ${m.b.duration_ms ?? 0}`,
		`build_warnings: ${m.b.warnings_count ?? 0}`,
		`build_errors: ${m.b.errors_count ?? 0}`,
		"# Unit Tests",
		`unit_total: ${ut.totalTests}`,
		`unit_passed: ${ut.passed}`,
		`unit_failed: ${ut.failed}`,
		`unit_skipped: ${ut.skipped}`,
		`unit_suites: ${m.t.suites ?? 0}`,
		"# Coverage",
		`lines_pct: ${m.linesPct}`,
		`branches_pct: ${m.branchesPct}`,
		`functions_pct: ${m.functionsPct}`,
	];
}

/** Builds the state report header line (callout + cycle info). */
function buildStateReportHeader(title: string, status: string, duration: string, now: Date, m: ExtractedMetrics): string[] {
	return [
		"",
		`# ${title}`,
		"",
		`> [!${status === "pass" ? "success" : "danger"}] **${status.toUpperCase()}** — ${now.toISOString().slice(0, 16).replace("T", " ")}`,
		...(m.cycle ? [`> Cycle ${m.cycle} | v${m.b.plugin_version ?? "?"} | ${duration}s`] : [`> v${m.b.plugin_version ?? "?"} | ${duration}s`]),
		"",
	];
}

/**
 * Generates the Increment State Report — a consolidated snapshot of all
 * quality metrics at the time of the increment build.
 * Written to both the test vault root and dev vault root.
 */
function buildE2eFrontmatterLines(e: Record<string, unknown>): string[] {
	return [
		"# E2E",
		`e2e_total: ${e.total_tests ?? 0}`,
		`e2e_passed: ${e.passed ?? 0}`,
		`e2e_failed: ${e.failed ?? 0}`,
		`e2e_journeys: ${e.journeys ?? 0}`,
		`e2e_actions: ${e.total_actions ?? 0}`,
	];
}

function buildPerfFrontmatterLines(p: Record<string, unknown>, t: Record<string, unknown>): string[] {
	return [
		"# Performance",
		`startup_p50_ms: ${p.startup_p50 ?? t.startup_p50 ?? 0}`,
		`startup_p95_ms: ${p.startup_p95 ?? t.startup_p95 ?? 0}`,
	];
}

function generateIncrementStateReport(exitCode: number, duration: string, stats: BuildStats): { testPath: string; devPath: string } {
	const DEV_VAULT_ROOT = path.resolve(PLUGIN_ROOT, "..", "..");
	const now = new Date();
	const status = exitCode === 0 ? "pass" : "fail";
	const m = extractMetrics(stats);
	const ut = stats.unitTests;

	const lines: string[] = [
		...buildStateReportFrontmatter("IncrementStateReport", status, duration, now, m, ut),
		...buildE2eFrontmatterLines(m.e),
		...buildPerfFrontmatterLines(m.p, m.t),
		"tags:",
		"  - increment",
		"  - state-report",
		"---",
		...buildStateReportHeader("Increment State Report", status, duration, now, m),
		...buildBuildTable(m.sizeKb, m.b),
		...buildUnitTestsSection(ut, m.t),
		...buildCoverageSection(m.linesPct, m.branchesPct, m.functionsPct, m.c),
		...buildE2eSection(m.e),
		...buildPerformanceSection(m.p, m.t),
	];

	const content = lines.join("\n");
	const filename = "Increment State Report.md";

	// Write to test vault root
	const testPath = path.join(TEST_VAULT, filename);
	disk.writeFileSync(testPath, content, "utf-8");
	log(`  \x1b[32m✓\x1b[0m Increment State Report: ${testPath}`);

	// Write to dev vault root
	const devPath = path.join(DEV_VAULT_ROOT, filename);
	disk.writeFileSync(devPath, content, "utf-8");
	log(`  \x1b[32m✓\x1b[0m Increment State Report: ${devPath}`);

	return { testPath, devPath };
}

/** Prints build info lines to console. */
function printBuildInfo(build: Record<string, unknown>): void {
	const red = "\x1b[31m";
	const reset = "\x1b[0m";
	const sizeKb = build.total_bytes ? Math.round(build.total_bytes as number / 1024) : "?";
	log(`  Bundle:       ${sizeKb} KB`);
	log(`  Version:      ${build.plugin_version ?? "?"}`);
	if ((build.warnings_count as number) > 0) {
		log(`  Warnings:     ${red}${build.warnings_count}${reset}`);
	}
}

/** Prints unit test stats line to console. */
function printTestStatsLine(ut: TestStats): void {
	const green = "\x1b[32m";
	const red = "\x1b[31m";
	const dim = "\x1b[2m";
	const reset = "\x1b[0m";
	const failColor = ut.failed > 0 ? red : green;
	log(`  Tests:        ${green}${ut.passed}${reset} passed, ${failColor}${ut.failed}${reset} failed, ${dim}${ut.skipped} skipped${reset} ${dim}(${ut.totalTests} total)${reset}`);
}

/** Prints coverage percentage line to console. */
function printCoverageLine(coverage: Record<string, unknown>): void {
	const pct = coverage.line_pct ?? coverage.lines_pct ?? coverage.line_percent;
	if (pct != null) {
		log(`  Coverage:     ${pct}%`);
	}
}

function printIncrementSummary(exitCode: number, duration: string, stats: BuildStats): void {
	const reset = "\x1b[0m";
	const green = "\x1b[32m";
	const red = "\x1b[31m";
	const statusIcon = exitCode === 0 ? `${green}✓ PASS${reset}` : `${red}✗ FAIL${reset}`;

	log(`\n  ${"═".repeat(50)}`);
	log(`  Increment Build Results`);
	log(`  ${"═".repeat(50)}\n`);
	log(`  Status:       ${statusIcon}`);
	log(`  Duration:     ${duration}s`);

	if (stats.build) printBuildInfo(stats.build);
	if (stats.unitTests.totalTests > 0) printTestStatsLine(stats.unitTests);
	if (stats.coverage) printCoverageLine(stats.coverage);

	log();
}

async function runIncrementBuild(): Promise<number> {
	// Teardown test vault to fresh state so E2E runs the full journey with installer
	log("\n  Preparing test vault for full journey...\n");
	await performTeardown();

	log("  Starting increment build (check → build → test → e2e → docs → distribute)...\n");
	const startTime = Date.now();
	let exitCode: number;
	try {
		execSync("npm run build:increment", { stdio: "inherit" });
		exitCode = 0;
	} catch (err) {
		exitCode = (err as { status?: number }).status ?? 1;
	}
	const duration = ((Date.now() - startTime) / 1000).toFixed(1);
	const stats = readBuildStats();
	printIncrementSummary(exitCode, duration, stats);
	generateIncrementStateReport(exitCode, duration, stats);
	return exitCode;
}

// ── Publish ─────────────────────────────────────────────────────────

function printPublishSummary(exitCode: number, duration: string, stats: BuildStats): void {
	const reset = "\x1b[0m";
	const green = "\x1b[32m";
	const red = "\x1b[31m";
	const statusIcon = exitCode === 0 ? `${green}✓ PASS${reset}` : `${red}✗ FAIL${reset}`;

	log(`\n  ${"═".repeat(50)}`);
	log(`  Publish Results`);
	log(`  ${"═".repeat(50)}\n`);
	log(`  Status:       ${statusIcon}`);
	log(`  Duration:     ${duration}s`);

	if (stats.build) printBuildInfo(stats.build);
	if (stats.unitTests.totalTests > 0) printTestStatsLine(stats.unitTests);
	if (stats.coverage) printCoverageLine(stats.coverage);

	log();
}

/** Builds the traceability markdown section. */
function buildTraceabilitySection(tr: Record<string, unknown>): string[] {
	const lines = ["## Traceability", ""];
	if (((tr.total_events as number) ?? 0) > 0) {
		const pct = tr.linked && tr.total_events ? Math.round((tr.linked as number / (tr.total_events as number)) * 100) : 0;
		const icon = ((tr.unlinked as number) ?? 0) === 0 ? "success" : "warning";
		lines.push(`> [!${icon}] ${tr.linked}/${tr.total_events} linked (${pct}%)`);
		lines.push("", "| Metric | Value |", "|---|---|");
		lines.push(`| Total Events | ${tr.total_events} |`, `| Linked | ${tr.linked} |`, `| Unlinked | ${tr.unlinked} |`);
	} else {
		lines.push("> No traceability data available.");
	}
	lines.push("");
	return lines;
}

/**
 * Generates the Publish State Report — a consolidated snapshot of all
 * quality metrics at the time of the release publish.
 * Written to the dev vault root.
 */
function buildTraceFrontmatterLines(tr: Record<string, unknown>): string[] {
	return [
		"# Traceability",
		`trace_total: ${tr.total_events ?? 0}`,
		`trace_linked: ${tr.linked ?? 0}`,
		`trace_unlinked: ${tr.unlinked ?? 0}`,
	];
}

function generatePublishStateReport(exitCode: number, duration: string, stats: BuildStats): { devPath: string } {
	const DEV_VAULT_ROOT = path.resolve(PLUGIN_ROOT, "..", "..");
	const now = new Date();
	const status = exitCode === 0 ? "pass" : "fail";
	const m = extractMetrics(stats);
	const ut = stats.unitTests;
	const tr: Record<string, unknown> = stats.traceability ?? {};

	const lines: string[] = [
		...buildStateReportFrontmatter("PublishStateReport", status, duration, now, m, ut),
		...buildTraceFrontmatterLines(tr),
		...buildPerfFrontmatterLines(m.p, m.t),
		"tags:",
		"  - publish",
		"  - state-report",
		"---",
		...buildStateReportHeader("Publish State Report", status, duration, now, m),
		...buildBuildTable(m.sizeKb, m.b),
		...buildUnitTestsSection(ut, m.t),
		...buildCoverageSection(m.linesPct, m.branchesPct, m.functionsPct, m.c),
		...buildTraceabilitySection(tr),
		...buildPerformanceSection(m.p, m.t),
	];

	const content = lines.join("\n");
	const filename = "Publish State Report.md";

	// Write to dev vault root
	const devPath = path.join(DEV_VAULT_ROOT, filename);
	disk.writeFileSync(devPath, content, "utf-8");
	log(`  \x1b[32m✓\x1b[0m Publish State Report: ${devPath}`);

	return { devPath };
}

function runPublish(): number {
	log("\n  Starting publish (check → build → test → docs → publish)...\n");
	const startTime = Date.now();
	let exitCode: number;
	try {
		execSync("npm run build:release", { stdio: "inherit" });
		exitCode = 0;
	} catch (err) {
		exitCode = (err as { status?: number }).status ?? 1;
	}
	const duration = ((Date.now() - startTime) / 1000).toFixed(1);
	const stats = readBuildStats();
	printPublishSummary(exitCode, duration, stats);
	generatePublishStateReport(exitCode, duration, stats);
	return exitCode;
}

interface ViewResult {
	action: "main" | "quit";
	exitCode: number;
}

/** Prints a status banner for a result view. */
function printResultBanner(label: string, exitCode: number): void {
	const statusIcon = exitCode === 0 ? "\x1b[32m✓ PASS\x1b[0m" : "\x1b[31m✗ FAIL\x1b[0m";
	log(`  ${"─".repeat(50)}`);
	log(`  ${label}: ${statusIcon}`);
	log(`  ${"─".repeat(50)}`);
	log();
}

/**
 * Post-publish result view — shows after a publish completes.
 * Offers publish-specific actions before returning to the main menu.
 *
 * Returns { action, exitCode } where action is:
 *   - "main"  — return to main menu
 *   - "quit"  — exit the process
 */
async function publishResultView(exitCode: number): Promise<ViewResult> {

	while (true) {
		printResultBanner("Publish", exitCode);
		const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
		log("    r) Re-run publish");
		log("    a) Generate audit");
		log("    m) Back to main menu");
		log("    q) Quit");
		log();
		const choice = (await ask(rl, "Choice", "m")).toLowerCase();

		if (choice === "q") { rl.close(); return { action: "quit", exitCode }; }
		if (choice === "m") { rl.close(); return { action: "main", exitCode }; }
		if (choice === "a") { await generateAudit(rl); rl.close(); continue; }
		if (choice === "r") { rl.close(); exitCode = runPublish(); continue; }

		rl.close();
		log("\n  Invalid choice — try again.\n");
	}
}

/** Prints increment menu and returns the user's choice. */
function printIncrementMenu(exitCode: number): void {
	const dim = "\x1b[2m";
	const reset = "\x1b[0m";
	log(exitCode === 0 ? "    p) Publish the increment" : `    ${dim}p) Publish the increment (requires successful build)${reset}`);
	log("    r) Re-run increment build");
	log("    a) Generate audit");
	log("    m) Back to main menu");
	log("    q) Quit");
	log();
}

/** Handles the publish choice from the increment result view. */
async function handleIncrementPublish(exitCode: number): Promise<ViewResult | null> {
	if (exitCode !== 0) {
		log("\n  Cannot publish — increment build did not pass.\n");
		return null;
	}
	const publishExitCode = runPublish();
	return publishResultView(publishExitCode);
}

/**
 * Post-increment result view — shows after an increment build completes.
 * Offers build-specific actions before returning to the main menu.
 *
 * Returns { action, exitCode } where action is:
 *   - "main"  — return to main menu
 *   - "quit"  — exit the process
 */
async function incrementResultView(exitCode: number): Promise<ViewResult> {

	while (true) {
		printResultBanner("Increment Build", exitCode);
		const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
		printIncrementMenu(exitCode);
		const choice = (await ask(rl, "Choice", exitCode === 0 ? "p" : "m")).toLowerCase();

		if (choice === "q") { rl.close(); return { action: "quit", exitCode }; }
		if (choice === "m") { rl.close(); return { action: "main", exitCode }; }
		if (choice === "a") { await generateAudit(rl); rl.close(); continue; }
		if (choice === "r") { rl.close(); exitCode = await runIncrementBuild(); continue; }
		if (choice === "p") {
			rl.close();
			const result = await handleIncrementPublish(exitCode);
			if (result) return result;
			continue;
		}

		rl.close();
		log("\n  Invalid choice — try again.\n");
	}
}

// ── Rebuild (teardown + prerequisites + installer) ──────────────────

async function runRebuild(): Promise<number> {
	log("\n  Rebuilding vault (teardown → prerequisites → installer)...\n");

	// 1. Teardown
	await teardownVault();

	// 2. Run prerequisites + installer
	process.env.E2E_JOURNEY = "prerequisites,installer";
	process.env.E2E_RUN_PREREQUISITES = "true";
	process.env.E2E_RUN_INSTALLER = "true";

	const exitCode = runVitest();
	generateReportAndOpen();

	// Clean env vars so subsequent sessions don't inherit rebuild flags
	delete process.env.E2E_JOURNEY;
	delete process.env.E2E_RUN_PREREQUISITES;
	delete process.env.E2E_RUN_INSTALLER;

	if (exitCode === 0) {
		log("\n  \x1b[32m✓\x1b[0m Rebuild completed successfully.\n");
	} else {
		log("\n  \x1b[31m✗\x1b[0m Rebuild failed.\n");
	}

	return exitCode;
}

// ── Audit generation ────────────────────────────────────────────────

const REPORTS_DIR: string = path.join(PLUGIN_ROOT, "docs", "reports");

/** Coerces a raw YAML string value to a typed JS value. */
function parseYamlValue(raw: string): unknown {
	if (raw === "true") return true;
	if (raw === "false") return false;
	if (raw === "null") return null;
	if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw);
	if (raw.startsWith('"') && raw.endsWith('"')) return raw.slice(1, -1);
	return raw;
}

/**
 * Parses YAML frontmatter from a markdown file.
 * Returns the frontmatter as a key-value object, or null if no frontmatter found.
 */
function parseFrontmatter(filePath: string): Record<string, unknown> | null {
	try {
		const content = disk.readFileSync(filePath, "utf-8");
		const match = content.match(/^---\n([\s\S]*?)\n---/);
		if (!match) return null;
		const fm: Record<string, unknown> = {};
		for (const line of match[1].split("\n")) {
			const colonIdx = line.indexOf(":");
			if (colonIdx === -1) continue;
			fm[line.slice(0, colonIdx).trim()] = parseYamlValue(line.slice(colonIdx + 1).trim());
		}
		return fm;
	} catch {
		return null;
	}
}

/**
 * Finds the latest report file in a directory by sorting filenames (timestamp-prefixed).
 * Returns the absolute path, or null if directory is empty/missing.
 */
function findLatestReport(dir: string): string | null {
	try {
		const files = disk.readdirSync(dir)
			.filter((f) => f.endsWith(".md"))
			.sort()
			.reverse();
		return files.length > 0 ? path.join(dir, files[0]) : null;
	} catch {
		return null;
	}
}

/** Collects the latest report sources from all categories. */
function collectReportSources(): Record<string, ReportSource> {
	const sources: Record<string, ReportSource> = {};

	const timestampedDirs: Array<[string, string]> = [
		["build", "builds"], ["test", "tests"], ["coverage", "coverage"],
		["performance", "performance"], ["cycle", "cycles"],
	];
	for (const [key, dir] of timestampedDirs) {
		const file = findLatestReport(path.join(REPORTS_DIR, dir));
		if (file) sources[key] = { file, fm: parseFrontmatter(file) };
	}

	const stableFiles: Array<[string, string]> = [
		["e2e", path.join(REPORTS_DIR, "e2e", "E2E Report.md")],
		["traceability", path.join(REPORTS_DIR, "traceability", "Trace Conformance Report.md")],
	];
	for (const [key, filePath] of stableFiles) {
		if (disk.existsSync(filePath)) sources[key] = { file: filePath, fm: parseFrontmatter(filePath) };
	}

	return sources;
}

function buildAuditBuildFrontmatter(buildFm: Record<string, unknown>): string[] {
	return [
		"# Build",
		`build_size_kb: ${buildFm.total_bytes ? Math.round(buildFm.total_bytes as number / 1024) : 0}`,
		`build_duration_ms: ${buildFm.duration_ms ?? 0}`,
		`build_warnings: ${buildFm.warnings_count ?? 0}`,
		`build_errors: ${buildFm.errors_count ?? 0}`,
	];
}

function buildAuditUnitFrontmatter(testFm: Record<string, unknown>): string[] {
	return [
		"# Unit Tests",
		`unit_tests_total: ${testFm.total ?? 0}`,
		`unit_tests_passed: ${testFm.passed ?? 0}`,
		`unit_tests_failed: ${testFm.failed ?? 0}`,
		`unit_tests_skipped: ${testFm.skipped ?? 0}`,
		`unit_tests_suites: ${testFm.suites ?? 0}`,
	];
}

function buildAuditE2eFrontmatter(e2eFm: Record<string, unknown>): string[] {
	return [
		"# E2E",
		`e2e_tests_total: ${e2eFm.total_tests ?? 0}`,
		`e2e_passed: ${e2eFm.passed ?? 0}`,
		`e2e_failed: ${e2eFm.failed ?? 0}`,
		`e2e_journeys: ${e2eFm.journeys ?? 0}`,
		`e2e_actions: ${e2eFm.total_actions ?? 0}`,
	];
}

/** Builds the audit frontmatter lines. */
function buildAuditFrontmatter(auditName: string, overallStatus: string, currentCycle: string | number, now: Date, buildFm: Record<string, unknown>, testFm: Record<string, unknown>, e2eFm: Record<string, unknown>, perfFm: Record<string, unknown>): string[] {
	return [
		"---",
		"type: E2EAudit",
		`name: ${yamlStr(auditName)}`,
		`date: "${now.toISOString()}"`,
		`overall_status: ${overallStatus}`,
		...(currentCycle ? [`cycle: ${currentCycle}`] : []),
		...buildAuditBuildFrontmatter(buildFm),
		...buildAuditUnitFrontmatter(testFm),
		...buildAuditE2eFrontmatter(e2eFm),
		"# Performance",
		`startup_p50_ms: ${perfFm.startup_p50 ?? testFm.startup_p50 ?? 0}`,
		"tags:",
		"  - audit",
		"  - review",
		"---",
	];
}

/** Builds the audit build section. */
function buildAuditBuildSection(buildFm: Record<string, unknown>, hasSource: boolean): string[] {
	const lines = ["## Build", ""];
	if (hasSource) {
		lines.push("| Metric | Value |", "|---|---|");
		lines.push(`| Bundle Size | ${buildFm.total_bytes ? Math.round(buildFm.total_bytes as number / 1024) + " KB" : "N/A"} |`);
		lines.push(`| Build Duration | ${buildFm.duration_ms ?? "N/A"} ms |`);
		lines.push(`| Warnings | ${buildFm.warnings_count ?? 0} |`, `| Errors | ${buildFm.errors_count ?? 0} |`, `| Plugin Version | ${buildFm.plugin_version ?? "N/A"} |`);
	} else {
		lines.push("> No build report available.");
	}
	lines.push("");
	return lines;
}

/** Builds the audit unit tests section. */
function buildAuditTestSection(testFm: Record<string, unknown>, hasSource: boolean): string[] {
	const lines = ["---", "", "## Unit Tests", ""];
	if (hasSource) {
		const icon = ((testFm.failed as number) ?? 0) === 0 ? "success" : "danger";
		lines.push(`> [!${icon}] ${testFm.passed}/${testFm.total} passed | ${testFm.suites ?? "?"} suites`);
		lines.push("", "| Metric | Value |", "|---|---|");
		lines.push(`| Total | ${testFm.total} |`, `| Passed | ${testFm.passed} |`, `| Failed | ${testFm.failed} |`, `| Skipped | ${testFm.skipped} |`, `| Suites | ${testFm.suites} |`);
		lines.push(`| Duration | ${testFm.duration_ms ? Math.round(testFm.duration_ms as number / 1000) + "s" : "N/A"} |`);
	} else {
		lines.push("> No test report available.");
	}
	lines.push("");
	return lines;
}

/** Builds the audit E2E section. */
function buildAuditE2eSection(e2eFm: Record<string, unknown>, hasSource: boolean): string[] {
	const lines = ["---", "", "## E2E Tests", ""];
	if (hasSource) {
		const icon = ((e2eFm.failed as number) ?? 0) === 0 ? "success" : "danger";
		lines.push(`> [!${icon}] ${e2eFm.passed}/${e2eFm.total_tests} passed | ${e2eFm.journeys ?? "?"} journeys`);
		lines.push("", "| Metric | Value |", "|---|---|");
		lines.push(`| Total Tests | ${e2eFm.total_tests} |`, `| Passed | ${e2eFm.passed} |`, `| Failed | ${e2eFm.failed} |`);
		lines.push(`| Journeys | ${e2eFm.journeys} |`, `| Actions | ${e2eFm.total_actions} |`, `| Screenshots | ${e2eFm.total_screenshots} |`);
		lines.push(`| Duration | ${e2eFm.duration ?? "N/A"} |`);
	} else {
		lines.push("> No E2E report available.");
	}
	lines.push("");
	return lines;
}

/** Builds the audit performance section. */
function buildAuditPerfSection(perfFm: Record<string, unknown>, testFm: Record<string, unknown>, hasSource: boolean): string[] {
	const lines = ["---", "", "## Performance", ""];
	if (hasSource || testFm.startup_p50) {
		lines.push("| Metric | Value |", "|---|---|");
		lines.push(`| Startup p50 | ${perfFm.startup_p50 ?? testFm.startup_p50 ?? "N/A"} ms |`);
		lines.push(`| Startup p95 | ${perfFm.startup_p95 ?? testFm.startup_p95 ?? "N/A"} ms |`);
		lines.push(`| Startup Max | ${perfFm.startup_max ?? testFm.startup_max ?? "N/A"} ms |`);
	} else {
		lines.push("> No performance data available.");
	}
	lines.push("");
	return lines;
}

/** Builds the report sources section for the audit. */
function buildAuditSourcesSection(sources: Record<string, ReportSource>): string[] {
	const lines = ["---", "", "## Report Sources", ""];
	const sourceMap: Array<[string, string]> = [
		["build", "Build"], ["test", "Tests"], ["coverage", "Coverage"],
		["performance", "Performance"], ["cycle", "Cycle"],
	];
	const reportLinks: string[] = [];
	for (const [key, label] of sourceMap) {
		if (sources[key]) reportLinks.push(`- ${label}: \`${path.basename(sources[key].file)}\``);
	}
	if (sources.e2e) reportLinks.push("- E2E: [[E2E Report]]");
	if (sources.traceability) reportLinks.push("- Traceability: [[Trace Conformance Report]]");
	lines.push(...(reportLinks.length > 0 ? reportLinks : ["> No reports found."]));
	lines.push("");
	return lines;
}

/** Writes the audit note to both test and dev vaults, and opens in Obsidian. */
function writeAndOpenAudit(auditName: string, content: string): void {
	const testAuditDir = path.join(TEST_VAULT, "03 - Resources", "Reviews", "Audits", auditName);
	const testAuditPath = path.join(testAuditDir, `${auditName}.md`);
	disk.mkdirSync(testAuditDir, { recursive: true });
	disk.writeFileSync(testAuditPath, content, "utf-8");
	log(`  \x1b[32m✓\x1b[0m Audit written: ${testAuditPath}`);

	const devAuditDir = path.join(PLUGIN_ROOT, "docs", "reports", "e2e", "audits", auditName);
	const devAuditPath = path.join(devAuditDir, `${auditName}.md`);
	disk.mkdirSync(devAuditDir, { recursive: true });
	disk.writeFileSync(devAuditPath, content, "utf-8");
	log(`  \x1b[32m✓\x1b[0m Audit mirrored: ${devAuditPath}`);

	try {
		execSync(
			`obsidian vault=${VAULT_NAME} open "03 - Resources/Reviews/Audits/${auditName}/${auditName}.md"`,
			{ stdio: "pipe", timeout: 10_000 },
		);
		log("  \x1b[32m✓\x1b[0m Audit opened in Obsidian\n");
	} catch {
		log("  \x1b[33m○\x1b[0m Could not open audit in Obsidian\n");
	}
}

/**
 * Generates an audit note consolidating metrics from all available reports.
 * Creates the note in both the test vault and dev vault.
 */
interface AuditFrontmatters {
	buildFm: Record<string, unknown>;
	testFm: Record<string, unknown>;
	e2eFm: Record<string, unknown>;
	perfFm: Record<string, unknown>;
	cycleFm: Record<string, unknown>;
}

function extractSourceFm(sources: Record<string, ReportSource>, key: string): Record<string, unknown> {
	return sources[key]?.fm ?? {};
}

function extractAuditFrontmatters(sources: Record<string, ReportSource>): AuditFrontmatters {
	return {
		buildFm: extractSourceFm(sources, "build"),
		testFm: extractSourceFm(sources, "test"),
		e2eFm: extractSourceFm(sources, "e2e"),
		perfFm: extractSourceFm(sources, "performance"),
		cycleFm: extractSourceFm(sources, "cycle"),
	};
}

function determineAuditStatus(fm: AuditFrontmatters): { overallStatus: string; currentCycle: string | number } {
	const hasFailures = ((fm.testFm.failed as number) ?? 0) > 0 || ((fm.e2eFm.failed as number) ?? 0) > 0 || ((fm.buildFm.errors_count as number) ?? 0) > 0;
	return {
		overallStatus: hasFailures ? "fail" : "pass",
		currentCycle: (fm.cycleFm.cycle ?? fm.cycleFm.number ?? "") as string | number,
	};
}

async function generateAudit(rl: readline.Interface): Promise<void> {
	const defaultName = new Date().toISOString().slice(0, 10) + "-audit";
	const auditName = await ask(rl, "Audit name", defaultName);

	log(`\n  Generating audit: ${auditName}...\n`);

	const sources = collectReportSources();
	const fm = extractAuditFrontmatters(sources);
	const { overallStatus, currentCycle } = determineAuditStatus(fm);
	const now = new Date();

	const lines: string[] = [
		...buildAuditFrontmatter(auditName, overallStatus, currentCycle, now, fm.buildFm, fm.testFm, fm.e2eFm, fm.perfFm),
		"",
		`# Audit: ${auditName}`,
		"",
		`> [!${overallStatus === "pass" ? "success" : "danger"}] Overall: **${overallStatus.toUpperCase()}**`,
		`> Date: ${now.toISOString().slice(0, 16).replace("T", " ")}`,
		"",
		...buildAuditBuildSection(fm.buildFm, !!sources.build),
		...buildAuditTestSection(fm.testFm, !!sources.test),
		...buildAuditE2eSection(fm.e2eFm, !!sources.e2e),
		...buildAuditPerfSection(fm.perfFm, fm.testFm, !!sources.performance),
		...buildAuditSourcesSection(sources),
	];

	writeAndOpenAudit(auditName, lines.join("\n"));
}

// ── Interactive session ─────────────────────────────────────────────

/**
 * Post-run session view — shows after a test run completes.
 * Offers run-specific actions before returning to the main menu.
 *
 * Returns { action, exitCode } where action is:
 *   - "main"  — return to main menu
 *   - "quit"  — exit the process
 */
/** Prints session view banner. */
function printSessionBanner(config: SessionConfig, entries: JourneyEntry[], exitCode: number): void {
	const statusIcon = exitCode === 0 ? "\x1b[32m✓ PASS\x1b[0m" : "\x1b[31m✗ FAIL\x1b[0m";
	const journeyNames = config.selectedSlugs.map((slug) => {
		const entry = entries.find((e) => e.slug === slug);
		return entry ? entry.name : slug;
	});
	log(`\n  ${"─".repeat(50)}`);
	log(`  Session: ${config.sessionName}`);
	log(`  Status:  ${statusIcon}`);
	log(`  Tests:   ${journeyNames.join(", ")}`);
	log(`  ${"─".repeat(50)}`);
	log();
}

/** Handles the "build and re-run" choice in the session view. */
async function handleBuildAndRerun(currentConfig: SessionConfig, entries: JourneyEntry[], prereqResults: PrerequisiteResults): Promise<{ config: SessionConfig; exitCode: number }> {
	const buildResult = quickBuildAndDeploy();
	if (buildResult !== 0) return { config: currentConfig, exitCode: buildResult };
	const rerunConfig = rerunWithFreshTimestamp(currentConfig, entries);
	const exitCode = await executeSession(rerunConfig, entries, prereqResults);
	return { config: rerunConfig, exitCode };
}

async function sessionView(config: SessionConfig, entries: JourneyEntry[], prereqResults: PrerequisiteResults, exitCode: number): Promise<ViewResult> {
	let currentConfig = config;
	let currentExitCode = exitCode;

	while (true) {
		printSessionBanner(currentConfig, entries, currentExitCode);
		const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
		log("    r) Re-run");
		log("    b) Build and re-run");
		log("    d) Build only (no re-run)");
		log("    e) Edit test selection");
		log("    a) Generate audit");
		log("    m) Back to main menu");
		log("    q) Quit");
		log();
		const choice = (await ask(rl, "Choice", "r")).toLowerCase();

		if (choice === "q") { rl.close(); return { action: "quit", exitCode: currentExitCode }; }
		if (choice === "m") { rl.close(); return { action: "main", exitCode: currentExitCode }; }
		if (choice === "a") { await generateAudit(rl); rl.close(); continue; }
		if (choice === "d") { rl.close(); quickBuildAndDeploy(); continue; }
		if (choice === "r") {
			rl.close();
			const rerunConfig = rerunWithFreshTimestamp(currentConfig, entries);
			currentExitCode = await executeSession(rerunConfig, entries, prereqResults);
			currentConfig = rerunConfig;
			continue;
		}
		if (choice === "b") {
			rl.close();
			const result = await handleBuildAndRerun(currentConfig, entries, prereqResults);
			currentConfig = result.config;
			currentExitCode = result.exitCode;
			continue;
		}
		if (choice === "e") {
			const editConfig = await promptSessionConfig(rl, entries, prereqResults);
			rl.close();
			currentExitCode = await executeSession(editConfig, entries, prereqResults);
			currentConfig = editConfig;
			continue;
		}

		rl.close();
		log("\n  Invalid choice — try again.\n");
	}
}

/** Validates prerequisites and exits if critical ones are missing. */
function validatePrerequisites(prereqResults: PrerequisiteResults): void {
	if (!prereqResults.vaultExists) {
		log("  Cannot proceed — test vault does not exist.");
		log(`  Create it by running: npm run test:e2e\n`);
		process.exit(1);
	}
	if (!prereqResults.cliResponsive) {
		log("  Cannot proceed — Obsidian is not running or CLI not responsive.");
		log("  Start Obsidian with the test vault open, then try again.\n");
		process.exit(1);
	}
}

/** Prints the main interactive menu. */
function printMainMenu(incrementPassed: boolean): void {
	const dim = "\x1b[2m";
	const reset = "\x1b[0m";
	log("  What would you like to do?");
	log("    1) Start test session");
	log("    2) Build the increment");
	log(incrementPassed ? "    3) Publish the increment" : `    ${dim}3) Publish the increment (requires successful build)${reset}`);
	log("    4) Generate audit");
	log("    5) Teardown test vault to fresh state");
	log("    6) Rebuild (teardown → prerequisites → installer)");
	log("    q) Quit");
	log();
}

/** Handles the increment build choice (option 2). Returns updated state. */
async function handleIncrementChoice(): Promise<{ exitCode: number; incrementPassed: boolean; quit: boolean }> {
	const exitCode = await runIncrementBuild();
	let incrementPassed = exitCode === 0;
	const result = await incrementResultView(exitCode);
	if (result.exitCode === 0) incrementPassed = true;
	return { exitCode: result.exitCode, incrementPassed, quit: result.action === "quit" };
}

/** Handles the publish choice (option 3). Returns updated state. */
async function handlePublishChoice(): Promise<{ exitCode: number; quit: boolean }> {
	const exitCode = runPublish();
	const result = await publishResultView(exitCode);
	return { exitCode: result.exitCode, quit: result.action === "quit" };
}

/** Handles the test session choice (option 1). Returns updated state. */
async function handleTestSessionChoice(rl: readline.Interface, prereqResults: PrerequisiteResults): Promise<{ exitCode: number; quit: boolean }> {
	const entries = loadJourneyEntries();
	if (entries.length === 0) {
		rl.close();
		log("  No journey files found.\n");
		return { exitCode: 0, quit: false };
	}
	const config = await promptSessionConfig(rl, entries, prereqResults);
	rl.close();
	const exitCode = await executeSession(config, entries, prereqResults);
	const result = await sessionView(config, entries, prereqResults, exitCode);
	return { exitCode: result.exitCode, quit: result.action === "quit" };
}

interface InteractiveState {
	lastExitCode: number;
	incrementPassed: boolean;
}

async function handleMainMenuChoice(choice: string, rl: readline.Interface, prereqResults: PrerequisiteResults, state: InteractiveState): Promise<{ handled: boolean; state: InteractiveState }> {
	if (choice === "q") { rl.close(); log("\n  Goodbye.\n"); process.exit(state.lastExitCode); }
	if (choice === "4") { await generateAudit(rl); rl.close(); return { handled: true, state }; }
	if (choice === "5") { rl.close(); await teardownVault(); return { handled: true, state }; }
	if (choice === "6") { rl.close(); return { handled: true, state: { ...state, lastExitCode: await runRebuild() } }; }
	return { handled: false, state };
}

async function handleBuildMenuChoice(choice: string, rl: readline.Interface, prereqResults: PrerequisiteResults, state: InteractiveState): Promise<{ handled: boolean; state: InteractiveState }> {
	if (choice === "2") {
		rl.close();
		const result = await handleIncrementChoice();
		const updated = { lastExitCode: result.exitCode, incrementPassed: state.incrementPassed || result.incrementPassed };
		if (result.quit) { log("\n  Goodbye.\n"); process.exit(updated.lastExitCode); }
		return { handled: true, state: updated };
	}
	if (choice === "3") {
		rl.close();
		if (!state.incrementPassed) { log("\n  Cannot publish — no successful increment build in this session.\n  Run option 2 first.\n"); return { handled: true, state }; }
		const result = await handlePublishChoice();
		if (result.quit) { log("\n  Goodbye.\n"); process.exit(result.exitCode); }
		return { handled: true, state: { ...state, lastExitCode: result.exitCode } };
	}
	if (choice === "1") {
		const result = await handleTestSessionChoice(rl, prereqResults);
		if (result.quit) { log("\n  Goodbye.\n"); process.exit(result.exitCode); }
		return { handled: true, state: { ...state, lastExitCode: result.exitCode } };
	}
	return { handled: false, state };
}

async function interactiveSession(): Promise<void> {
	let state: InteractiveState = { lastExitCode: 0, incrementPassed: false };

	while (true) {
		log(`\n  ${"=".repeat(50)}`);
		log("  Flowti E2E Test Session");
		log(`  ${"=".repeat(50)}`);

		const prereqResults = checkPrerequisites();
		printPrerequisites(prereqResults);
		validatePrerequisites(prereqResults);

		const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
		printMainMenu(state.incrementPassed);
		const choice = (await ask(rl, "Choice", "1")).toLowerCase();

		const mainResult = await handleMainMenuChoice(choice, rl, prereqResults, state);
		if (mainResult.handled) { state = mainResult.state; continue; }

		const buildResult = await handleBuildMenuChoice(choice, rl, prereqResults, state);
		if (buildResult.handled) { state = buildResult.state; continue; }

		rl.close();
		log("\n  Invalid choice — try again.\n");
	}
}

/**
 * Creates a re-run config from a previous config with a fresh timestamp in the session name.
 */
function rerunWithFreshTimestamp(prevConfig: SessionConfig, entries: JourneyEntry[]): SessionConfig {
	const timestamp = new Date().toISOString().replace(/:/g, "-").slice(0, 19);
	const journeySuffix = prevConfig.selectedSlugs.length === entries.length
		? "all"
		: prevConfig.selectedSlugs.join("+");
	return {
		...prevConfig,
		sessionName: `${timestamp} ${journeySuffix}`,
	};
}

function buildStepFilterEnv(stepFilter: Record<string, "all" | string[]>): string | null {
	const parts: string[] = [];
	for (const [slug, filter] of Object.entries(stepFilter)) {
		if (filter !== "all" && Array.isArray(filter) && filter.length > 0) {
			parts.push(`${slug}:${filter.join(",")}`);
		}
	}
	return parts.length > 0 ? parts.join(";") : null;
}

/** Configures environment variables for the E2E session. */
function configureSessionEnv(config: SessionConfig): void {
	const allSlugs = [...config.selectedSlugs];
	if (config.includeInstaller && !allSlugs.includes("installer")) {
		allSlugs.unshift("installer");
	}
	process.env.E2E_JOURNEY = allSlugs.join(",");
	process.env.E2E_SESSION_NAME = config.sessionName;
	if (config.includeInstaller) process.env.E2E_RUN_INSTALLER = "true";
	if (config.includePrerequisites) process.env.E2E_RUN_PREREQUISITES = "true";

	if (config.stepFilter) {
		const stepsEnv = buildStepFilterEnv(config.stepFilter);
		if (stepsEnv) process.env.E2E_STEPS = stepsEnv;
	}
}

/** Cleans up environment variables after a session run. */
function cleanSessionEnv(): void {
	delete process.env.E2E_JOURNEY;
	delete process.env.E2E_SESSION_NAME;
	delete process.env.E2E_RUN_INSTALLER;
	delete process.env.E2E_RUN_PREREQUISITES;
	delete process.env.E2E_STEPS;
}

/** Prints the session execution banner. */
function printExecutionBanner(config: SessionConfig, selectedNames: string[]): void {
	log(`\n  Starting session "${config.sessionName}"...`);
	log(`    Journeys:       ${selectedNames.join(", ")}`);
	const hasStepFilter = config.stepFilter && Object.values(config.stepFilter).some((f) => f !== "all");
	if (hasStepFilter) {
		for (const [slug, filter] of Object.entries(config.stepFilter)) {
			if (filter !== "all" && Array.isArray(filter)) {
				log(`    Steps (${slug}): ${filter.join(", ")}`);
			}
		}
	}
	log(`    Installer:      ${config.includeInstaller ? "yes" : "no"}`);
	log(`    Prerequisites:  ${config.includePrerequisites ? "force" : "skip"}`);
	log();
}

/** Resolves journey slug to display name. */
function resolveJourneyNames(slugs: string[], entries: JourneyEntry[]): string[] {
	return slugs.map((slug) => {
		const entry = entries.find((e) => e.slug === slug);
		return entry ? entry.name : slug;
	});
}

/**
 * Executes a test session: sets env vars, runs vitest, generates report, writes session note.
 * Returns the vitest exit code.
 */
async function executeSession(config: SessionConfig, entries: JourneyEntry[], prereqResults: PrerequisiteResults): Promise<number> {
	configureSessionEnv(config);

	const selectedNames = resolveJourneyNames(config.selectedSlugs, entries);
	printExecutionBanner(config, selectedNames);

	const startTime = Date.now();
	const exitCode = runVitest();
	generateReportAndOpen();

	const stats = readTestStats();
	printSummary(config.sessionName, selectedNames, startTime, stats);
	const notePath = writeSessionNote(config.sessionName, config, selectedNames, prereqResults, stats, startTime, exitCode);
	log(`  Session note: ${notePath}\n`);
	collapseFileExplorer();
	cleanSessionEnv();

	return exitCode;
}

// ── Run vitest and generate report ──────────────────────────────────

function runVitest(): number {
	let exitCode = 0;
	try {
		execSync("npx vitest run --config tests/e2e/vitest.e2e.config.ts", {
			stdio: "inherit",
		});
	} catch (err) {
		exitCode = (err as { status?: number }).status ?? 1;
	}
	return exitCode;
}

/** Generates the E2E report and returns the vault-relative path, or null. */
function generateReport(): string | null {
	try {
		const output = execSync("node scripts/generate-e2e-report.mjs", { encoding: "utf-8" });
		log(output);
		const match = output.match(/E2EReport written:\s*(.+)/);
		if (match) return path.relative(TEST_VAULT, match[1].trim()).replace(/\\/g, "/");
	} catch {
		// Report generation failure shouldn't mask test failures
	}
	return null;
}

/** Restores installer state and re-enables the plugin after E2E run. */
function restorePluginState(): void {
	if (disk.existsSync(DATA_JSON_PATH)) {
		try {
			const data = JSON.parse(disk.readFileSync(DATA_JSON_PATH, "utf-8")) as Record<string, unknown>;
			if (data.installer && (data.installer as Record<string, unknown>).installed === false) {
				(data.installer as Record<string, unknown>).installed = true;
				disk.writeFileSync(DATA_JSON_PATH, JSON.stringify(data), "utf-8");
			}
		} catch {
			// best-effort
		}
	}
	try { execSync(`obsidian vault=${VAULT_NAME} eval code="app.plugins.enablePlugin('${PLUGIN_ID}')"`, { stdio: "pipe" }); } catch { /* best-effort */ }
	try { execSync(`obsidian vault=${VAULT_NAME} eval code="(() => { try { app.commands.executeCommandById('${PLUGIN_ID}:flowti:open-event-log'); } catch(e) {} })()"`, { stdio: "pipe" }); } catch { /* best-effort */ }
}

/** Opens the report in Obsidian and sets up the workspace. */
function openReportInObsidian(reportVaultPath: string): void {
	log("[e2e] Opening report in Obsidian...");
	try { execSync(`obsidian vault=${VAULT_NAME} open path="${reportVaultPath}"`, { stdio: "pipe" }); } catch { /* best-effort */ }
	try { execSync(`obsidian vault=${VAULT_NAME} eval code="(() => { const existing = app.workspace.getLeavesOfType('outline')[0]; if (existing) { app.workspace.revealLeaf(existing); return; } const leaf = app.workspace.getRightLeaf(false); if (leaf) leaf.setViewState({ type: 'outline', active: true }); })()"`, { stdio: "pipe" }); } catch { /* best-effort */ }
}

function generateReportAndOpen(): void {
	log("\n[e2e] Generating E2E report (this may take a moment)...\n");
	const reportVaultPath = generateReport();
	if (reportVaultPath) {
		openReportInObsidian(reportVaultPath);
		restorePluginState();
	}
}

// ── Main ────────────────────────────────────────────────────────────

const isListMode: boolean = process.argv.includes("--list");

if (isListMode) {
	await interactiveSession();
} else {
	const journeyArg = process.argv.find((a) => a.startsWith("--journey="));
	if (journeyArg) {
		process.env.E2E_JOURNEY = journeyArg.split("=")[1];
		log(`[e2e] Journey filter: ${process.env.E2E_JOURNEY}`);
	}

	// When installer or prerequisites are explicitly requested, force a fresh run
	const journeys = (process.env.E2E_JOURNEY ?? "").split(",").map((j) => j.trim());
	if (journeys.includes("installer")) {
		process.env.E2E_RUN_INSTALLER = "true";
		log("[e2e] Installer forced (explicitly requested).");
	}
	if (journeys.includes("prerequisites")) {
		process.env.E2E_RUN_PREREQUISITES = "true";
		log("[e2e] Prerequisites forced (explicitly requested).");
	}

	const exitCode = runVitest();
	generateReportAndOpen();
	process.exit(exitCode);
}
