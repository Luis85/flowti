/**
 * run-e2e.mjs — E2E test runner wrapper.
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
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

const PLUGIN_ROOT = path.resolve(import.meta.dirname, "..");
const PROJECTS_ROOT = path.resolve(PLUGIN_ROOT, "..", "..", "..");
const TEST_VAULT = process.env.E2E_VAULT_DIR ?? path.join(PROJECTS_ROOT, "flowti-e2e");
const VAULT_NAME = path.basename(TEST_VAULT);
const JOURNEYS_DIR = path.join(PLUGIN_ROOT, "tests", "e2e", "journeys");
const PLUGIN_ID = "flowti-ibde";
const PLUGIN_DIR = path.join(TEST_VAULT, ".obsidian", "plugins", PLUGIN_ID);
const DATA_JSON_PATH = path.join(PLUGIN_DIR, "data.json");
const PLUGIN_ARTIFACTS = ["main.js", "manifest.json", "styles.css"];
const TEST_DATA_CSV = path.join(TEST_VAULT, "03 - Resources", "Test Data", "Analytics", "Suppliers.csv");

// ── Readline helpers ────────────────────────────────────────────────

function ask(rl, question, defaultValue = "") {
	return new Promise((resolve) => {
		const suffix = defaultValue ? ` (${defaultValue})` : "";
		rl.question(`  ${question}${suffix}: `, (answer) => {
			resolve(answer.trim() || defaultValue);
		});
	});
}

function askYesNo(rl, question, defaultNo = true) {
	return new Promise((resolve) => {
		const hint = defaultNo ? "(y/N)" : "(Y/n)";
		rl.question(`  ${question} ${hint}: `, (answer) => {
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

function collapseFileExplorer() {
	try {
		execSync(
			`obsidian vault=${VAULT_NAME} eval code="(() => { const explorer = app.workspace.getLeavesOfType('file-explorer')[0]; if (explorer && explorer.view) { const foldStatus = explorer.view.fileItems; if (foldStatus) { Object.values(foldStatus).forEach(item => { if (item.collapsed !== undefined) item.setCollapsed(true); }); } } })()"`,
			{ stdio: "pipe", timeout: 10_000 },
		);
		console.log("  \x1b[32m✓\x1b[0m File navigator folders collapsed");
	} catch {
		// Non-fatal — file explorer may not be visible
	}
}

// ── Prerequisites check (local filesystem + single CLI ping) ────────

function checkPrerequisites() {
	const results = {
		vaultExists: false,
		artifactsPresent: false,
		missingArtifacts: [],
		cliResponsive: false,
		vaultInstalled: false,
		testDataPresent: false,
	};

	// 1. Vault exists
	results.vaultExists = fs.existsSync(TEST_VAULT);

	// 2. Plugin artifacts
	if (results.vaultExists) {
		results.missingArtifacts = PLUGIN_ARTIFACTS.filter(
			(f) => !fs.existsSync(path.join(PLUGIN_DIR, f)),
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
	if (results.vaultExists && fs.existsSync(DATA_JSON_PATH)) {
		try {
			const data = JSON.parse(fs.readFileSync(DATA_JSON_PATH, "utf-8"));
			results.vaultInstalled = data.installer?.installed === true;
		} catch {
			results.vaultInstalled = false;
		}
	}

	// 5. Test data present
	results.testDataPresent = fs.existsSync(TEST_DATA_CSV);

	return results;
}

function printPrerequisites(results) {
	const ok = (msg) => console.log(`  \x1b[32m✓\x1b[0m ${msg}`);
	const fail = (msg) => console.log(`  \x1b[31m✗\x1b[0m ${msg}`);
	const info = (msg) => console.log(`  \x1b[33m○\x1b[0m ${msg}`);

	console.log("\n  Prerequisites (local):\n");

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

	console.log();
}

// ── Teardown to fresh state ─────────────────────────────────────────

/**
 * Performs the actual teardown steps (non-interactive).
 * Deletes vault content, resets installer state, deactivates plugin,
 * clears workspace layout, and collapses file explorer.
 */
async function performTeardown() {
	// 1. Delete vault content via Obsidian CLI (cache-safe)
	try {
		execSync(
			`obsidian vault=${VAULT_NAME} eval code="(async () => { const root = app.vault.getRoot(); const children = root.children || []; for (const child of [...children]) { if (child.path === '.obsidian' || child.path.startsWith('.obsidian/')) continue; try { await app.vault.delete(child, true); } catch(e) {} } })()"`,
			{ stdio: "pipe", timeout: 30_000 },
		);
		// Wait for async deletions
		await new Promise((r) => setTimeout(r, 1000));
		console.log("  \x1b[32m✓\x1b[0m Vault content deleted (via Obsidian API)");
	} catch {
		console.log("  \x1b[31m✗\x1b[0m Failed to delete vault content (is Obsidian running?)");
	}

	// 2. Purge ghost file index entries
	try {
		execSync(
			`obsidian vault=${VAULT_NAME} eval code="(async () => { const ghosts = []; for (const f of [...app.vault.getAllLoadedFiles()]) { if (f.path === '/' || f.path.startsWith('.obsidian')) continue; const exists = await app.vault.adapter.exists(f.path); if (!exists) ghosts.push(f); } for (const f of ghosts) { try { await app.vault.delete(f, true); } catch {} try { if (f.parent) f.parent.children = f.parent.children.filter(c => c !== f); delete app.vault.fileMap[f.path]; } catch {} } })()"`,
			{ stdio: "pipe", timeout: 30_000 },
		);
		await new Promise((r) => setTimeout(r, 500));
		console.log("  \x1b[32m✓\x1b[0m Ghost entries purged");
	} catch {
		// Non-fatal — ghost entries will be cleaned on next globalSetup
	}

	// 3. Reset data.json
	if (fs.existsSync(DATA_JSON_PATH)) {
		try {
			const data = JSON.parse(fs.readFileSync(DATA_JSON_PATH, "utf-8"));
			data.installer = { installed: false, completedSteps: {} };
			fs.writeFileSync(DATA_JSON_PATH, JSON.stringify(data), "utf-8");
			console.log("  \x1b[32m✓\x1b[0m Installer state reset");
		} catch {
			console.log("  \x1b[31m✗\x1b[0m Failed to reset data.json");
		}
	} else {
		console.log("  \x1b[33m○\x1b[0m data.json not found (already fresh)");
	}

	// 4. Deactivate plugin
	try {
		execSync(
			`obsidian vault=${VAULT_NAME} eval code="app.plugins.disablePlugin('${PLUGIN_ID}')"`,
			{ stdio: "pipe", timeout: 10_000 },
		);
		await new Promise((r) => setTimeout(r, 1000));
		console.log("  \x1b[32m✓\x1b[0m Plugin deactivated");
	} catch {
		console.log("  \x1b[33m○\x1b[0m Plugin deactivation skipped (may not be loaded)");
	}

	// 5. Clear workspace layout
	const workspacePath = path.join(TEST_VAULT, ".obsidian", "workspace.json");
	if (fs.existsSync(workspacePath)) {
		try {
			fs.rmSync(workspacePath, { force: true });
			console.log("  \x1b[32m✓\x1b[0m Workspace layout cleared");
		} catch {
			// Non-fatal
		}
	}

	// 6. Collapse all folders in the file navigator
	collapseFileExplorer();

	console.log("\n  \x1b[32m✓\x1b[0m Fresh state.\n");
}

/**
 * Interactive teardown — prompts for confirmation before proceeding.
 */
async function teardownVault() {
	console.log("\n  Teardown will:");
	console.log("    - Delete all vault content (except .obsidian/)");
	console.log("    - Reset installer state (data.json → installed: false)");
	console.log("    - Deactivate plugin");
	console.log("    - Clear workspace layout");
	console.log("    - Collapse file navigator folders\n");

	const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
	const proceed = await askYesNo(rl, "Proceed?", true);
	rl.close();

	if (!proceed) {
		console.log("\n  Teardown cancelled.\n");
		return;
	}

	console.log();
	await performTeardown();
}

// ── Journey table ───────────────────────────────────────────────────

function loadJourneyEntries() {
	const files = fs.readdirSync(JOURNEYS_DIR)
		.filter((f) => f.endsWith(".journey.json"))
		.sort();

	return files.map((f) => {
		const def = JSON.parse(fs.readFileSync(path.join(JOURNEYS_DIR, f), "utf-8"));
		const slug = f.replace(".journey.json", "");
		return {
			slug,
			name: def.journey ?? slug,
			chapter: def.chapter ?? "?",
			steps: Array.isArray(def.steps) ? def.steps.length : 0,
			description: def.description ?? "",
		};
	});
}

function printJourneyTable(entries) {
	console.log("\n  Available Journeys:\n");
	console.log("  #  Ch  Name                          Steps  Description");
	console.log("  " + "-".repeat(78));
	for (let i = 0; i < entries.length; i++) {
		const e = entries[i];
		const num = String(i + 1).padStart(2, " ");
		const ch = String(e.chapter).padStart(2, " ");
		const name = e.name.padEnd(28);
		const steps = String(e.steps).padStart(5);
		const desc = e.description.length > 40 ? e.description.slice(0, 37) + "..." : e.description;
		console.log(`  ${num}  ${ch}  ${name}  ${steps}  ${desc}`);
	}
	console.log();
}

// ── Session config prompt ───────────────────────────────────────────

async function promptSessionConfig(rl, entries, prereqResults) {
	// Journey selection first — needed for auto-generated session name
	printJourneyTable(entries);
	const journeyInput = await ask(rl, 'Enter journey numbers (e.g. "2" or "1 3 4") or "all"');

	if (!journeyInput) {
		console.log("\n  No selection — exiting.\n");
		process.exit(0);
	}

	let selectedSlugs;
	if (journeyInput.toLowerCase() === "all") {
		selectedSlugs = entries.map((e) => e.slug);
	} else {
		const indices = journeyInput.split(/[\s,]+/).map(Number).filter((n) => n >= 1 && n <= entries.length);
		if (indices.length === 0) {
			console.log("\n  Invalid selection — exiting.\n");
			process.exit(1);
		}
		selectedSlugs = indices.map((i) => entries[i - 1].slug);
	}

	console.log();

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

/**
 * Prompts the user to select steps for each journey.
 * Returns a map of { slug: "all" | string[] } where string[] contains step IDs.
 */
async function promptStepFilter(rl, selectedSlugs) {
	const stepFilter = {};

	for (const slug of selectedSlugs) {
		const journeyPath = path.join(JOURNEYS_DIR, `${slug}.journey.json`);
		if (!fs.existsSync(journeyPath)) {
			stepFilter[slug] = "all";
			continue;
		}

		const def = JSON.parse(fs.readFileSync(journeyPath, "utf-8"));
		const steps = def.steps ?? [];
		const setupSteps = def.setup ?? [];
		const teardownSteps = def.teardown ?? [];
		if (steps.length === 0) {
			stepFilter[slug] = "all";
			continue;
		}

		// Print step table with grayed-out setup/teardown
		const dim = "\x1b[2m";   // dim (gray)
		const reset = "\x1b[0m";
		console.log(`  Steps for ${def.journey} (${steps.length} steps):\n`);
		console.log("    #  ID                          Title");
		console.log("   " + "-".repeat(62));

		for (const s of setupSteps) {
			const id = (s.id ?? "setup").padEnd(26);
			console.log(`${dim}   ·  ${id}  ${s.title}  [setup]${reset}`);
		}

		for (let i = 0; i < steps.length; i++) {
			const s = steps[i];
			const num = String(i + 1).padStart(3);
			const id = (s.id ?? `step-${i + 1}`).padEnd(26);
			console.log(`  ${num}  ${id}  ${s.title}`);
		}

		for (const s of teardownSteps) {
			const id = (s.id ?? "teardown").padEnd(26);
			console.log(`${dim}   ·  ${id}  ${s.title}  [teardown]${reset}`);
		}

		console.log();

		const stepInput = await ask(rl, 'Steps (numbers/ranges, "all", or "none")', "all");
		const normalized = stepInput.trim().toLowerCase();

		if (normalized === "all" || normalized === "") {
			stepFilter[slug] = "all";
		} else if (normalized === "none") {
			stepFilter[slug] = [];
		} else {
			// Parse "1 3 5-7" into step IDs
			const ids = [];
			for (const token of stepInput.split(/[\s,]+/)) {
				const range = token.match(/^(\d+)-(\d+)$/);
				if (range) {
					const lo = Number(range[1]);
					const hi = Number(range[2]);
					for (let n = lo; n <= hi; n++) {
						if (n >= 1 && n <= steps.length) ids.push(steps[n - 1].id);
					}
				} else {
					const n = Number(token);
					if (n >= 1 && n <= steps.length) ids.push(steps[n - 1].id);
				}
			}
			stepFilter[slug] = ids.length > 0 ? ids : "all";
		}

		const sel = stepFilter[slug];
		if (sel === "all") {
			console.log(`  → All ${steps.length} steps selected\n`);
		} else {
			console.log(`  → ${sel.length} of ${steps.length} steps selected\n`);
		}
	}

	return stepFilter;
}

// ── Post-run summary ────────────────────────────────────────────────

/**
 * Reads vitest JSON report and returns test result stats.
 */
function readTestStats() {
	const reportPath = path.join(PLUGIN_ROOT, "docs", "reports", "tests", "testreport.json");
	let totalTests = 0;
	let passed = 0;
	let failed = 0;
	let skipped = 0;

	if (fs.existsSync(reportPath)) {
		try {
			const report = JSON.parse(fs.readFileSync(reportPath, "utf-8"));
			if (report.numTotalTests != null) {
				totalTests = report.numTotalTests;
				passed = report.numPassedTests ?? 0;
				failed = report.numFailedTests ?? 0;
				skipped = report.numPendingTests ?? 0;
			} else if (Array.isArray(report.testResults)) {
				// Vitest JSON reporter format
				for (const suite of report.testResults) {
					if (!Array.isArray(suite.assertionResults)) continue;
					for (const test of suite.assertionResults) {
						totalTests++;
						if (test.status === "passed") passed++;
						else if (test.status === "failed") failed++;
						else skipped++;
					}
				}
			}
		} catch {
			// Report parsing failed — show zeros
		}
	}

	return { totalTests, passed, failed, skipped };
}

function printSummary(sessionName, selectedNames, startTime, stats) {
	const duration = ((Date.now() - startTime) / 1000).toFixed(1);
	const failColor = stats.failed > 0 ? "\x1b[31m" : "\x1b[32m";
	const reset = "\x1b[0m";

	console.log(`\n  ${"=".repeat(60)}`);
	console.log(`  Session Summary: ${sessionName}`);
	console.log(`  ${"=".repeat(60)}\n`);
	console.log(`  Duration:     ${duration}s`);
	console.log(`  Journeys:     ${selectedNames.length} (${selectedNames.join(", ")})`);
	console.log(`  Tests:        ${stats.totalTests} total`);
	console.log(`  Passed:       \x1b[32m${stats.passed}${reset}`);
	console.log(`  Failed:       ${failColor}${stats.failed}${reset}`);
	console.log(`  Skipped:      ${stats.skipped}`);
	console.log(`  Report:       docs/reports/e2e/E2E Report.md`);
	console.log();
}

// ── Session note ────────────────────────────────────────────────────

/**
 * Writes a Markdown session note to the test vault at:
 *   03 - Resources/Sessions/{sessionName}/{sessionName}.md
 */
function writeSessionNote(sessionName, config, selectedNames, prereqResults, stats, startTime, exitCode) {
	const now = new Date();
	const duration = ((Date.now() - startTime) / 1000).toFixed(1);
	const status = exitCode === 0 ? "passed" : "failed";

	const lines = [
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
		`| Test vault exists | ${prereqResults.vaultExists ? "✓" : "✗"} |`,
		`| Plugin artifacts | ${prereqResults.artifactsPresent ? "✓" : "✗"} |`,
		`| Obsidian CLI responsive | ${prereqResults.cliResponsive ? "✓" : "✗"} |`,
		`| Vault installed | ${prereqResults.vaultInstalled ? "✓" : "○ not yet"} |`,
		`| Test data present | ${prereqResults.testDataPresent ? "✓" : "○ generated during setup"} |`,
		"",
		"---",
		"",
		"## Journeys",
		"",
		`| # | Journey | Steps |`,
		`|---|---|---|`,
		...config.selectedSlugs.map((slug, i) => {
			const name = selectedNames[i] || slug;
			const entry = loadJourneyEntries().find((e) => e.slug === slug);
			const steps = entry ? entry.steps : "?";
			return `| ${i + 1} | ${name} | ${steps} |`;
		}),
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
	fs.mkdirSync(sessionDir, { recursive: true });
	fs.writeFileSync(notePath, content, "utf-8");
	console.log(`[e2e] Session note written: ${notePath}`);

	// Mirror to dev vault
	const devSessionDir = path.join(PLUGIN_ROOT, "docs", "reports", "e2e", "sessions", sessionName);
	const devNotePath = path.join(devSessionDir, `${sessionName}.md`);
	fs.mkdirSync(devSessionDir, { recursive: true });
	fs.writeFileSync(devNotePath, content, "utf-8");
	console.log(`[e2e] Session note mirrored: ${devNotePath}`);

	return notePath;
}

/** YAML-safe string escaping. */
function yamlStr(value) {
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
function quickBuildAndDeploy() {
	console.log("\n  Quick build (esbuild → deploy → reload)...\n");

	// 1. Run esbuild production build
	try {
		execSync("node esbuild.config.mjs --production", { stdio: "inherit" });
		console.log("\n  \x1b[32m✓\x1b[0m Build completed");
	} catch (err) {
		console.log("\n  \x1b[31m✗\x1b[0m Build failed");
		return err.status ?? 1;
	}

	// 2. Copy artifacts from main vault to test vault
	const mainPluginDir = path.resolve(PLUGIN_ROOT, "..", "..", ".obsidian", "plugins", PLUGIN_ID);
	let copied = 0;
	for (const artifact of PLUGIN_ARTIFACTS) {
		const src = path.join(mainPluginDir, artifact);
		const dest = path.join(PLUGIN_DIR, artifact);
		if (fs.existsSync(src)) {
			fs.mkdirSync(path.dirname(dest), { recursive: true });
			fs.copyFileSync(src, dest);
			copied++;
		} else {
			console.log(`  \x1b[33m○\x1b[0m Artifact not found: ${artifact}`);
		}
	}
	console.log(`  \x1b[32m✓\x1b[0m Deployed ${copied} artifacts to test vault`);

	// 3. Reload plugin in Obsidian
	try {
		execSync(
			`obsidian vault=${VAULT_NAME} eval code="(async () => { await app.plugins.disablePlugin('${PLUGIN_ID}'); await app.plugins.enablePlugin('${PLUGIN_ID}'); return 'reloaded'; })()"`,
			{ stdio: "pipe", timeout: 15_000 },
		);
		console.log("  \x1b[32m✓\x1b[0m Plugin reloaded in Obsidian\n");
	} catch {
		console.log("  \x1b[33m○\x1b[0m Plugin reload skipped (Obsidian may not be running)\n");
	}

	return 0;
}

// ── Increment build ─────────────────────────────────────────────────

/**
 * Reads the latest build report frontmatter for summary display.
 */
function readBuildStats() {
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
		e2e: fs.existsSync(e2eFile) ? parseFrontmatter(e2eFile) : null,
		traceability: fs.existsSync(traceFile) ? parseFrontmatter(traceFile) : null,
		unitTests: readTestStats(),
	};
}

/**
 * Generates the Increment State Report — a consolidated snapshot of all
 * quality metrics at the time of the increment build.
 * Written to both the test vault root and dev vault root.
 */
function generateIncrementStateReport(exitCode, duration, stats) {
	const DEV_VAULT_ROOT = path.resolve(PLUGIN_ROOT, "..", "..");
	const now = new Date();
	const status = exitCode === 0 ? "pass" : "fail";

	const b = stats.build ?? {};
	const t = stats.test ?? {};
	const c = stats.coverage ?? {};
	const e = stats.e2e ?? {};
	const p = stats.performance ?? {};
	const cy = stats.cycle ?? {};
	const ut = stats.unitTests;

	const sizeKb = b.total_bytes ? Math.round(b.total_bytes / 1024) : 0;
	const linesPct = c.lines_pct ?? c.line_pct ?? c.line_percent ?? 0;
	const branchesPct = c.branches_pct ?? 0;
	const functionsPct = c.functions_pct ?? 0;
	const cycle = cy.cycle ?? cy.number ?? "";

	const lines = [
		"---",
		"type: IncrementStateReport",
		`date: "${now.toISOString()}"`,
		`status: ${status}`,
		`duration_s: ${duration}`,
		...(cycle ? [`cycle: ${cycle}`] : []),
		`plugin_version: ${b.plugin_version ?? "?"}`,
		"# Build",
		`bundle_size_kb: ${sizeKb}`,
		`build_duration_ms: ${b.duration_ms ?? 0}`,
		`build_warnings: ${b.warnings_count ?? 0}`,
		`build_errors: ${b.errors_count ?? 0}`,
		"# Unit Tests",
		`unit_total: ${ut.totalTests}`,
		`unit_passed: ${ut.passed}`,
		`unit_failed: ${ut.failed}`,
		`unit_skipped: ${ut.skipped}`,
		`unit_suites: ${t.suites ?? 0}`,
		"# Coverage",
		`lines_pct: ${linesPct}`,
		`branches_pct: ${branchesPct}`,
		`functions_pct: ${functionsPct}`,
		"# E2E",
		`e2e_total: ${e.total_tests ?? 0}`,
		`e2e_passed: ${e.passed ?? 0}`,
		`e2e_failed: ${e.failed ?? 0}`,
		`e2e_journeys: ${e.journeys ?? 0}`,
		`e2e_actions: ${e.total_actions ?? 0}`,
		"# Performance",
		`startup_p50_ms: ${p.startup_p50 ?? t.startup_p50 ?? 0}`,
		`startup_p95_ms: ${p.startup_p95 ?? t.startup_p95 ?? 0}`,
		"tags:",
		"  - increment",
		"  - state-report",
		"---",
		"",
		"# Increment State Report",
		"",
		`> [!${status === "pass" ? "success" : "danger"}] **${status.toUpperCase()}** — ${now.toISOString().slice(0, 16).replace("T", " ")}`,
		...(cycle ? [`> Cycle ${cycle} | ` + `v${b.plugin_version ?? "?"} | ${duration}s`] : [`> v${b.plugin_version ?? "?"} | ${duration}s`]),
		"",
		"## Build",
		"",
		"| Metric | Value |",
		"|---|---|",
		`| Bundle Size | ${sizeKb} KB |`,
		`| Build Duration | ${b.duration_ms ?? "?"} ms |`,
		`| Plugin Version | ${b.plugin_version ?? "?"} |`,
		`| Warnings | ${b.warnings_count ?? 0} |`,
		`| Errors | ${b.errors_count ?? 0} |`,
		"",
		"## Unit Tests",
		"",
	];

	if (ut.totalTests > 0) {
		const icon = ut.failed === 0 ? "success" : "danger";
		lines.push(`> [!${icon}] ${ut.passed}/${ut.totalTests} passed | ${t.suites ?? "?"} suites`);
		lines.push("");
		lines.push("| Metric | Value |");
		lines.push("|---|---|");
		lines.push(`| Total | ${ut.totalTests} |`);
		lines.push(`| Passed | ${ut.passed} |`);
		lines.push(`| Failed | ${ut.failed} |`);
		lines.push(`| Skipped | ${ut.skipped} |`);
		lines.push(`| Suites | ${t.suites ?? "?"} |`);
		if (t.duration_ms) lines.push(`| Duration | ${Math.round(t.duration_ms / 1000)}s |`);
	} else {
		lines.push("> No unit test data available.");
	}
	lines.push("");

	lines.push("## Coverage");
	lines.push("");
	if (linesPct > 0) {
		lines.push("| Metric | Value |");
		lines.push("|---|---|");
		lines.push(`| Lines | ${linesPct}% |`);
		lines.push(`| Branches | ${branchesPct}% |`);
		lines.push(`| Functions | ${functionsPct}% |`);
		if (c.files_covered) lines.push(`| Files | ${c.files_covered} |`);
	} else {
		lines.push("> No coverage data available.");
	}
	lines.push("");

	lines.push("## E2E Tests");
	lines.push("");
	if ((e.total_tests ?? 0) > 0) {
		const icon = (e.failed ?? 0) === 0 ? "success" : "danger";
		lines.push(`> [!${icon}] ${e.passed}/${e.total_tests} passed | ${e.journeys ?? "?"} journeys`);
		lines.push("");
		lines.push("| Metric | Value |");
		lines.push("|---|---|");
		lines.push(`| Total | ${e.total_tests} |`);
		lines.push(`| Passed | ${e.passed} |`);
		lines.push(`| Failed | ${e.failed} |`);
		lines.push(`| Journeys | ${e.journeys} |`);
		lines.push(`| Actions | ${e.total_actions} |`);
		lines.push(`| Screenshots | ${e.total_screenshots ?? "?"} |`);
		if (e.duration) lines.push(`| Duration | ${e.duration} |`);
	} else {
		lines.push("> No E2E data available.");
	}
	lines.push("");

	lines.push("## Performance");
	lines.push("");
	const p50 = p.startup_p50 ?? t.startup_p50;
	if (p50) {
		lines.push("| Metric | Value |");
		lines.push("|---|---|");
		lines.push(`| Startup p50 | ${p50} ms |`);
		lines.push(`| Startup p95 | ${p.startup_p95 ?? t.startup_p95 ?? "?"} ms |`);
		lines.push(`| Startup Max | ${p.startup_max ?? t.startup_max ?? "?"} ms |`);
		if (p.data_json_size_bytes || t.data_json_size_bytes) {
			const djSize = p.data_json_size_bytes ?? t.data_json_size_bytes;
			lines.push(`| data.json | ${(djSize / (1024 * 1024)).toFixed(1)} MB |`);
		}
	} else {
		lines.push("> No performance data available.");
	}
	lines.push("");

	const content = lines.join("\n");
	const filename = "Increment State Report.md";

	// Write to test vault root
	const testPath = path.join(TEST_VAULT, filename);
	fs.writeFileSync(testPath, content, "utf-8");
	console.log(`  \x1b[32m✓\x1b[0m Increment State Report: ${testPath}`);

	// Write to dev vault root
	const devPath = path.join(DEV_VAULT_ROOT, filename);
	fs.writeFileSync(devPath, content, "utf-8");
	console.log(`  \x1b[32m✓\x1b[0m Increment State Report: ${devPath}`);

	return { testPath, devPath };
}

function printIncrementSummary(exitCode, duration, stats) {
	const reset = "\x1b[0m";
	const green = "\x1b[32m";
	const red = "\x1b[31m";
	const dim = "\x1b[2m";
	const statusIcon = exitCode === 0 ? `${green}✓ PASS${reset}` : `${red}✗ FAIL${reset}`;

	console.log(`\n  ${"═".repeat(50)}`);
	console.log(`  Increment Build Results`);
	console.log(`  ${"═".repeat(50)}\n`);
	console.log(`  Status:       ${statusIcon}`);
	console.log(`  Duration:     ${duration}s`);

	if (stats.build) {
		const sizeKb = stats.build.total_bytes ? Math.round(stats.build.total_bytes / 1024) : "?";
		console.log(`  Bundle:       ${sizeKb} KB`);
		console.log(`  Version:      ${stats.build.plugin_version ?? "?"}`);
		if (stats.build.warnings_count > 0) {
			console.log(`  Warnings:     ${red}${stats.build.warnings_count}${reset}`);
		}
	}

	const ut = stats.unitTests;
	if (ut.totalTests > 0) {
		const failColor = ut.failed > 0 ? red : green;
		console.log(`  Tests:        ${green}${ut.passed}${reset} passed, ${failColor}${ut.failed}${reset} failed, ${dim}${ut.skipped} skipped${reset} ${dim}(${ut.totalTests} total)${reset}`);
	}

	if (stats.coverage) {
		const cov = stats.coverage;
		const pct = cov.line_pct ?? cov.lines_pct ?? cov.line_percent;
		if (pct != null) {
			console.log(`  Coverage:     ${pct}%`);
		}
	}

	console.log();
}

async function runIncrementBuild() {
	// Teardown test vault to fresh state so E2E runs the full journey with installer
	console.log("\n  Preparing test vault for full journey...\n");
	await performTeardown();

	console.log("  Starting increment build (check → build → test → e2e → docs → distribute)...\n");
	const startTime = Date.now();
	let exitCode;
	try {
		execSync("npm run build:increment", { stdio: "inherit" });
		exitCode = 0;
	} catch (err) {
		exitCode = err.status ?? 1;
	}
	const duration = ((Date.now() - startTime) / 1000).toFixed(1);
	const stats = readBuildStats();
	printIncrementSummary(exitCode, duration, stats);
	generateIncrementStateReport(exitCode, duration, stats);
	return exitCode;
}

// ── Publish ─────────────────────────────────────────────────────────

function printPublishSummary(exitCode, duration, stats) {
	const reset = "\x1b[0m";
	const green = "\x1b[32m";
	const red = "\x1b[31m";
	const dim = "\x1b[2m";
	const statusIcon = exitCode === 0 ? `${green}✓ PASS${reset}` : `${red}✗ FAIL${reset}`;

	console.log(`\n  ${"═".repeat(50)}`);
	console.log(`  Publish Results`);
	console.log(`  ${"═".repeat(50)}\n`);
	console.log(`  Status:       ${statusIcon}`);
	console.log(`  Duration:     ${duration}s`);

	if (stats.build) {
		const sizeKb = stats.build.total_bytes ? Math.round(stats.build.total_bytes / 1024) : "?";
		console.log(`  Bundle:       ${sizeKb} KB`);
		console.log(`  Version:      ${stats.build.plugin_version ?? "?"}`);
		if (stats.build.warnings_count > 0) {
			console.log(`  Warnings:     ${red}${stats.build.warnings_count}${reset}`);
		}
	}

	const ut = stats.unitTests;
	if (ut.totalTests > 0) {
		const failColor = ut.failed > 0 ? red : green;
		console.log(`  Tests:        ${green}${ut.passed}${reset} passed, ${failColor}${ut.failed}${reset} failed, ${dim}${ut.skipped} skipped${reset} ${dim}(${ut.totalTests} total)${reset}`);
	}

	if (stats.coverage) {
		const cov = stats.coverage;
		const pct = cov.line_pct ?? cov.lines_pct ?? cov.line_percent;
		if (pct != null) {
			console.log(`  Coverage:     ${pct}%`);
		}
	}

	console.log();
}

/**
 * Generates the Publish State Report — a consolidated snapshot of all
 * quality metrics at the time of the release publish.
 * Written to the dev vault root.
 */
function generatePublishStateReport(exitCode, duration, stats) {
	const DEV_VAULT_ROOT = path.resolve(PLUGIN_ROOT, "..", "..");
	const now = new Date();
	const status = exitCode === 0 ? "pass" : "fail";

	const b = stats.build ?? {};
	const t = stats.test ?? {};
	const c = stats.coverage ?? {};
	const p = stats.performance ?? {};
	const cy = stats.cycle ?? {};
	const tr = stats.traceability ?? {};
	const ut = stats.unitTests;

	const sizeKb = b.total_bytes ? Math.round(b.total_bytes / 1024) : 0;
	const linesPct = c.lines_pct ?? c.line_pct ?? c.line_percent ?? 0;
	const branchesPct = c.branches_pct ?? 0;
	const functionsPct = c.functions_pct ?? 0;
	const cycle = cy.cycle ?? cy.number ?? "";

	const lines = [
		"---",
		"type: PublishStateReport",
		`date: "${now.toISOString()}"`,
		`status: ${status}`,
		`duration_s: ${duration}`,
		...(cycle ? [`cycle: ${cycle}`] : []),
		`plugin_version: ${b.plugin_version ?? "?"}`,
		"# Build",
		`bundle_size_kb: ${sizeKb}`,
		`build_duration_ms: ${b.duration_ms ?? 0}`,
		`build_warnings: ${b.warnings_count ?? 0}`,
		`build_errors: ${b.errors_count ?? 0}`,
		"# Unit Tests",
		`unit_total: ${ut.totalTests}`,
		`unit_passed: ${ut.passed}`,
		`unit_failed: ${ut.failed}`,
		`unit_skipped: ${ut.skipped}`,
		`unit_suites: ${t.suites ?? 0}`,
		"# Coverage",
		`lines_pct: ${linesPct}`,
		`branches_pct: ${branchesPct}`,
		`functions_pct: ${functionsPct}`,
		"# Traceability",
		`trace_total: ${tr.total_events ?? 0}`,
		`trace_linked: ${tr.linked ?? 0}`,
		`trace_unlinked: ${tr.unlinked ?? 0}`,
		"# Performance",
		`startup_p50_ms: ${p.startup_p50 ?? t.startup_p50 ?? 0}`,
		`startup_p95_ms: ${p.startup_p95 ?? t.startup_p95 ?? 0}`,
		"tags:",
		"  - publish",
		"  - state-report",
		"---",
		"",
		"# Publish State Report",
		"",
		`> [!${status === "pass" ? "success" : "danger"}] **${status.toUpperCase()}** — ${now.toISOString().slice(0, 16).replace("T", " ")}`,
		...(cycle ? [`> Cycle ${cycle} | v${b.plugin_version ?? "?"} | ${duration}s`] : [`> v${b.plugin_version ?? "?"} | ${duration}s`]),
		"",
		"## Build",
		"",
		"| Metric | Value |",
		"|---|---|",
		`| Bundle Size | ${sizeKb} KB |`,
		`| Build Duration | ${b.duration_ms ?? "?"} ms |`,
		`| Plugin Version | ${b.plugin_version ?? "?"} |`,
		`| Warnings | ${b.warnings_count ?? 0} |`,
		`| Errors | ${b.errors_count ?? 0} |`,
		"",
		"## Unit Tests",
		"",
	];

	if (ut.totalTests > 0) {
		const icon = ut.failed === 0 ? "success" : "danger";
		lines.push(`> [!${icon}] ${ut.passed}/${ut.totalTests} passed | ${t.suites ?? "?"} suites`);
		lines.push("");
		lines.push("| Metric | Value |");
		lines.push("|---|---|");
		lines.push(`| Total | ${ut.totalTests} |`);
		lines.push(`| Passed | ${ut.passed} |`);
		lines.push(`| Failed | ${ut.failed} |`);
		lines.push(`| Skipped | ${ut.skipped} |`);
		lines.push(`| Suites | ${t.suites ?? "?"} |`);
		if (t.duration_ms) lines.push(`| Duration | ${Math.round(t.duration_ms / 1000)}s |`);
	} else {
		lines.push("> No unit test data available.");
	}
	lines.push("");

	lines.push("## Coverage");
	lines.push("");
	if (linesPct > 0) {
		lines.push("| Metric | Value |");
		lines.push("|---|---|");
		lines.push(`| Lines | ${linesPct}% |`);
		lines.push(`| Branches | ${branchesPct}% |`);
		lines.push(`| Functions | ${functionsPct}% |`);
		if (c.files_covered) lines.push(`| Files | ${c.files_covered} |`);
	} else {
		lines.push("> No coverage data available.");
	}
	lines.push("");

	lines.push("## Traceability");
	lines.push("");
	if ((tr.total_events ?? 0) > 0) {
		const pct = tr.linked && tr.total_events ? Math.round((tr.linked / tr.total_events) * 100) : 0;
		const icon = (tr.unlinked ?? 0) === 0 ? "success" : "warning";
		lines.push(`> [!${icon}] ${tr.linked}/${tr.total_events} linked (${pct}%)`);
		lines.push("");
		lines.push("| Metric | Value |");
		lines.push("|---|---|");
		lines.push(`| Total Events | ${tr.total_events} |`);
		lines.push(`| Linked | ${tr.linked} |`);
		lines.push(`| Unlinked | ${tr.unlinked} |`);
	} else {
		lines.push("> No traceability data available.");
	}
	lines.push("");

	lines.push("## Performance");
	lines.push("");
	const p50 = p.startup_p50 ?? t.startup_p50;
	if (p50) {
		lines.push("| Metric | Value |");
		lines.push("|---|---|");
		lines.push(`| Startup p50 | ${p50} ms |`);
		lines.push(`| Startup p95 | ${p.startup_p95 ?? t.startup_p95 ?? "?"} ms |`);
		lines.push(`| Startup Max | ${p.startup_max ?? t.startup_max ?? "?"} ms |`);
		if (p.data_json_size_bytes || t.data_json_size_bytes) {
			const djSize = p.data_json_size_bytes ?? t.data_json_size_bytes;
			lines.push(`| data.json | ${(djSize / (1024 * 1024)).toFixed(1)} MB |`);
		}
	} else {
		lines.push("> No performance data available.");
	}
	lines.push("");

	const content = lines.join("\n");
	const filename = "Publish State Report.md";

	// Write to dev vault root
	const devPath = path.join(DEV_VAULT_ROOT, filename);
	fs.writeFileSync(devPath, content, "utf-8");
	console.log(`  \x1b[32m✓\x1b[0m Publish State Report: ${devPath}`);

	return { devPath };
}

function runPublish() {
	console.log("\n  Starting publish (check → build → test → docs → publish)...\n");
	const startTime = Date.now();
	let exitCode;
	try {
		execSync("npm run build:release", { stdio: "inherit" });
		exitCode = 0;
	} catch (err) {
		exitCode = err.status ?? 1;
	}
	const duration = ((Date.now() - startTime) / 1000).toFixed(1);
	const stats = readBuildStats();
	printPublishSummary(exitCode, duration, stats);
	generatePublishStateReport(exitCode, duration, stats);
	return exitCode;
}

/**
 * Post-publish result view — shows after a publish completes.
 * Offers publish-specific actions before returning to the main menu.
 *
 * Returns { action, exitCode } where action is:
 *   - "main"  — return to main menu
 *   - "quit"  — exit the process
 */
async function publishResultView(exitCode) {
	// eslint-disable-next-line no-constant-condition
	while (true) {
		const statusIcon = exitCode === 0 ? "\x1b[32m✓ PASS\x1b[0m" : "\x1b[31m✗ FAIL\x1b[0m";
		console.log(`  ${"─".repeat(50)}`);
		console.log(`  Publish: ${statusIcon}`);
		console.log(`  ${"─".repeat(50)}`);
		console.log();

		const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
		console.log("    r) Re-run publish");
		console.log("    a) Generate audit");
		console.log("    m) Back to main menu");
		console.log("    q) Quit");
		console.log();
		const choice = await ask(rl, "Choice", "m");

		if (choice === "q" || choice === "Q") {
			rl.close();
			return { action: "quit", exitCode };
		}

		if (choice === "m" || choice === "M") {
			rl.close();
			return { action: "main", exitCode };
		}

		if (choice === "a" || choice === "A") {
			await generateAudit(rl);
			rl.close();
			continue;
		}

		if (choice === "r" || choice === "R") {
			rl.close();
			exitCode = runPublish();
			continue;
		}

		rl.close();
		console.log("\n  Invalid choice — try again.\n");
	}
}

/**
 * Post-increment result view — shows after an increment build completes.
 * Offers build-specific actions before returning to the main menu.
 *
 * Returns { action, exitCode } where action is:
 *   - "main"  — return to main menu
 *   - "quit"  — exit the process
 */
async function incrementResultView(exitCode) {
	// eslint-disable-next-line no-constant-condition
	while (true) {
		const dim = "\x1b[2m";
		const reset = "\x1b[0m";
		const statusIcon = exitCode === 0 ? "\x1b[32m✓ PASS\x1b[0m" : "\x1b[31m✗ FAIL\x1b[0m";
		console.log(`  ${"─".repeat(50)}`);
		console.log(`  Increment Build: ${statusIcon}`);
		console.log(`  ${"─".repeat(50)}`);
		console.log();

		const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
		console.log(exitCode === 0 ? "    p) Publish the increment" : `    ${dim}p) Publish the increment (requires successful build)${reset}`);
		console.log("    r) Re-run increment build");
		console.log("    a) Generate audit");
		console.log("    m) Back to main menu");
		console.log("    q) Quit");
		console.log();
		const choice = await ask(rl, "Choice", exitCode === 0 ? "p" : "m");

		if (choice === "q" || choice === "Q") {
			rl.close();
			return { action: "quit", exitCode };
		}

		if (choice === "m" || choice === "M") {
			rl.close();
			return { action: "main", exitCode };
		}

		if (choice === "p" || choice === "P") {
			if (exitCode !== 0) {
				rl.close();
				console.log("\n  Cannot publish — increment build did not pass.\n");
				continue;
			}
			rl.close();
			const publishExitCode = runPublish();
			const result = await publishResultView(publishExitCode);
			return result;
		}

		if (choice === "a" || choice === "A") {
			await generateAudit(rl);
			rl.close();
			continue;
		}

		if (choice === "r" || choice === "R") {
			rl.close();
			exitCode = await runIncrementBuild();
			continue;
		}

		rl.close();
		console.log("\n  Invalid choice — try again.\n");
	}
}

// ── Rebuild (teardown + prerequisites + installer) ──────────────────

async function runRebuild() {
	console.log("\n  Rebuilding vault (teardown → prerequisites → installer)...\n");

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
		console.log("\n  \x1b[32m✓\x1b[0m Rebuild completed successfully.\n");
	} else {
		console.log("\n  \x1b[31m✗\x1b[0m Rebuild failed.\n");
	}

	return exitCode;
}

// ── Audit generation ────────────────────────────────────────────────

const REPORTS_DIR = path.join(PLUGIN_ROOT, "docs", "reports");

/**
 * Parses YAML frontmatter from a markdown file.
 * Returns the frontmatter as a key-value object, or null if no frontmatter found.
 */
function parseFrontmatter(filePath) {
	try {
		const content = fs.readFileSync(filePath, "utf-8");
		const match = content.match(/^---\n([\s\S]*?)\n---/);
		if (!match) return null;
		const fm = {};
		for (const line of match[1].split("\n")) {
			const colonIdx = line.indexOf(":");
			if (colonIdx === -1) continue;
			const key = line.slice(0, colonIdx).trim();
			let value = line.slice(colonIdx + 1).trim();
			// Parse simple YAML values
			if (value === "true") value = true;
			else if (value === "false") value = false;
			else if (value === "null") value = null;
			else if (/^-?\d+(\.\d+)?$/.test(value)) value = Number(value);
			else if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
			fm[key] = value;
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
function findLatestReport(dir) {
	try {
		const files = fs.readdirSync(dir)
			.filter((f) => f.endsWith(".md"))
			.sort()
			.reverse();
		return files.length > 0 ? path.join(dir, files[0]) : null;
	} catch {
		return null;
	}
}

/**
 * Generates an audit note consolidating metrics from all available reports.
 * Creates the note in both the test vault and dev vault.
 */
async function generateAudit(rl) {
	const defaultName = new Date().toISOString().slice(0, 10) + "-audit";
	const auditName = await ask(rl, "Audit name", defaultName);

	console.log(`\n  Generating audit: ${auditName}...\n`);

	// Collect latest report data from each category
	const sources = {};

	// Build report (latest timestamped)
	const buildFile = findLatestReport(path.join(REPORTS_DIR, "builds"));
	if (buildFile) sources.build = { file: buildFile, fm: parseFrontmatter(buildFile) };

	// Test report (latest timestamped)
	const testFile = findLatestReport(path.join(REPORTS_DIR, "tests"));
	if (testFile) sources.test = { file: testFile, fm: parseFrontmatter(testFile) };

	// Coverage report (latest timestamped)
	const coverageFile = findLatestReport(path.join(REPORTS_DIR, "coverage"));
	if (coverageFile) sources.coverage = { file: coverageFile, fm: parseFrontmatter(coverageFile) };

	// Performance report (latest timestamped)
	const perfFile = findLatestReport(path.join(REPORTS_DIR, "performance"));
	if (perfFile) sources.performance = { file: perfFile, fm: parseFrontmatter(perfFile) };

	// Cycle report (latest timestamped)
	const cycleFile = findLatestReport(path.join(REPORTS_DIR, "cycles"));
	if (cycleFile) sources.cycle = { file: cycleFile, fm: parseFrontmatter(cycleFile) };

	// E2E report (stable name)
	const e2eFile = path.join(REPORTS_DIR, "e2e", "E2E Report.md");
	if (fs.existsSync(e2eFile)) sources.e2e = { file: e2eFile, fm: parseFrontmatter(e2eFile) };

	// Trace conformance report (stable name)
	const traceFile = path.join(REPORTS_DIR, "traceability", "Trace Conformance Report.md");
	if (fs.existsSync(traceFile)) sources.traceability = { file: traceFile, fm: parseFrontmatter(traceFile) };

	// Determine overall health
	const buildFm = sources.build?.fm ?? {};
	const testFm = sources.test?.fm ?? {};
	const e2eFm = sources.e2e?.fm ?? {};
	const perfFm = sources.performance?.fm ?? {};
	const cycleFm = sources.cycle?.fm ?? {};

	const hasFailures = (testFm.failed ?? 0) > 0 || (e2eFm.failed ?? 0) > 0 || (buildFm.errors_count ?? 0) > 0;
	const overallStatus = hasFailures ? "fail" : "pass";
	const currentCycle = cycleFm.cycle ?? cycleFm.number ?? "";

	const now = new Date();
	const lines = [
		"---",
		"type: E2EAudit",
		`name: ${yamlStr(auditName)}`,
		`date: "${now.toISOString()}"`,
		`overall_status: ${overallStatus}`,
		...(currentCycle ? [`cycle: ${currentCycle}`] : []),
		"# Build",
		`build_size_kb: ${buildFm.total_bytes ? Math.round(buildFm.total_bytes / 1024) : 0}`,
		`build_duration_ms: ${buildFm.duration_ms ?? 0}`,
		`build_warnings: ${buildFm.warnings_count ?? 0}`,
		`build_errors: ${buildFm.errors_count ?? 0}`,
		"# Unit Tests",
		`unit_tests_total: ${testFm.total ?? 0}`,
		`unit_tests_passed: ${testFm.passed ?? 0}`,
		`unit_tests_failed: ${testFm.failed ?? 0}`,
		`unit_tests_skipped: ${testFm.skipped ?? 0}`,
		`unit_tests_suites: ${testFm.suites ?? 0}`,
		"# E2E",
		`e2e_tests_total: ${e2eFm.total_tests ?? 0}`,
		`e2e_passed: ${e2eFm.passed ?? 0}`,
		`e2e_failed: ${e2eFm.failed ?? 0}`,
		`e2e_journeys: ${e2eFm.journeys ?? 0}`,
		`e2e_actions: ${e2eFm.total_actions ?? 0}`,
		"# Performance",
		`startup_p50_ms: ${perfFm.startup_p50 ?? testFm.startup_p50 ?? 0}`,
		"tags:",
		"  - audit",
		"  - review",
		"---",
		"",
		`# Audit: ${auditName}`,
		"",
		`> [!${overallStatus === "pass" ? "success" : "danger"}] Overall: **${overallStatus.toUpperCase()}**`,
		`> Date: ${now.toISOString().slice(0, 16).replace("T", " ")}`,
		"",
		"## Build",
		"",
	];

	if (sources.build) {
		lines.push("| Metric | Value |");
		lines.push("|---|---|");
		lines.push(`| Bundle Size | ${buildFm.total_bytes ? Math.round(buildFm.total_bytes / 1024) + " KB" : "N/A"} |`);
		lines.push(`| Build Duration | ${buildFm.duration_ms ?? "N/A"} ms |`);
		lines.push(`| Warnings | ${buildFm.warnings_count ?? 0} |`);
		lines.push(`| Errors | ${buildFm.errors_count ?? 0} |`);
		lines.push(`| Plugin Version | ${buildFm.plugin_version ?? "N/A"} |`);
	} else {
		lines.push("> No build report available.");
	}
	lines.push("");

	lines.push("---", "");
	lines.push("## Unit Tests");
	lines.push("");
	if (sources.test) {
		const icon = (testFm.failed ?? 0) === 0 ? "success" : "danger";
		lines.push(`> [!${icon}] ${testFm.passed}/${testFm.total} passed | ${testFm.suites ?? "?"} suites`);
		lines.push("");
		lines.push("| Metric | Value |");
		lines.push("|---|---|");
		lines.push(`| Total | ${testFm.total} |`);
		lines.push(`| Passed | ${testFm.passed} |`);
		lines.push(`| Failed | ${testFm.failed} |`);
		lines.push(`| Skipped | ${testFm.skipped} |`);
		lines.push(`| Suites | ${testFm.suites} |`);
		lines.push(`| Duration | ${testFm.duration_ms ? Math.round(testFm.duration_ms / 1000) + "s" : "N/A"} |`);
	} else {
		lines.push("> No test report available.");
	}
	lines.push("");

	lines.push("---", "");
	lines.push("## E2E Tests");
	lines.push("");
	if (sources.e2e) {
		const icon = (e2eFm.failed ?? 0) === 0 ? "success" : "danger";
		lines.push(`> [!${icon}] ${e2eFm.passed}/${e2eFm.total_tests} passed | ${e2eFm.journeys ?? "?"} journeys`);
		lines.push("");
		lines.push("| Metric | Value |");
		lines.push("|---|---|");
		lines.push(`| Total Tests | ${e2eFm.total_tests} |`);
		lines.push(`| Passed | ${e2eFm.passed} |`);
		lines.push(`| Failed | ${e2eFm.failed} |`);
		lines.push(`| Journeys | ${e2eFm.journeys} |`);
		lines.push(`| Actions | ${e2eFm.total_actions} |`);
		lines.push(`| Screenshots | ${e2eFm.total_screenshots} |`);
		lines.push(`| Duration | ${e2eFm.duration ?? "N/A"} |`);
	} else {
		lines.push("> No E2E report available.");
	}
	lines.push("");

	lines.push("---", "");
	lines.push("## Performance");
	lines.push("");
	if (sources.performance || testFm.startup_p50) {
		lines.push("| Metric | Value |");
		lines.push("|---|---|");
		lines.push(`| Startup p50 | ${perfFm.startup_p50 ?? testFm.startup_p50 ?? "N/A"} ms |`);
		lines.push(`| Startup p95 | ${perfFm.startup_p95 ?? testFm.startup_p95 ?? "N/A"} ms |`);
		lines.push(`| Startup Max | ${perfFm.startup_max ?? testFm.startup_max ?? "N/A"} ms |`);
	} else {
		lines.push("> No performance data available.");
	}
	lines.push("");

	lines.push("---", "");
	lines.push("## Report Sources");
	lines.push("");
	const reportLinks = [];
	if (sources.build) reportLinks.push(`- Build: \`${path.basename(sources.build.file)}\``);
	if (sources.test) reportLinks.push(`- Tests: \`${path.basename(sources.test.file)}\``);
	if (sources.coverage) reportLinks.push(`- Coverage: \`${path.basename(sources.coverage.file)}\``);
	if (sources.e2e) reportLinks.push("- E2E: [[E2E Report]]");
	if (sources.performance) reportLinks.push(`- Performance: \`${path.basename(sources.performance.file)}\``);
	if (sources.traceability) reportLinks.push("- Traceability: [[Trace Conformance Report]]");
	if (sources.cycle) reportLinks.push(`- Cycle: \`${path.basename(sources.cycle.file)}\``);
	lines.push(...(reportLinks.length > 0 ? reportLinks : ["> No reports found."]));
	lines.push("");

	const content = lines.join("\n");

	// Write to test vault
	const testAuditDir = path.join(TEST_VAULT, "03 - Resources", "Reviews", "Audits", auditName);
	const testAuditPath = path.join(testAuditDir, `${auditName}.md`);
	fs.mkdirSync(testAuditDir, { recursive: true });
	fs.writeFileSync(testAuditPath, content, "utf-8");
	console.log(`  \x1b[32m✓\x1b[0m Audit written: ${testAuditPath}`);

	// Mirror to dev vault
	const devAuditDir = path.join(PLUGIN_ROOT, "docs", "reports", "e2e", "audits", auditName);
	const devAuditPath = path.join(devAuditDir, `${auditName}.md`);
	fs.mkdirSync(devAuditDir, { recursive: true });
	fs.writeFileSync(devAuditPath, content, "utf-8");
	console.log(`  \x1b[32m✓\x1b[0m Audit mirrored: ${devAuditPath}`);

	// Open in test vault
	try {
		execSync(
			`obsidian vault=${VAULT_NAME} open "03 - Resources/Reviews/Audits/${auditName}/${auditName}.md"`,
			{ stdio: "pipe", timeout: 10_000 },
		);
		console.log("  \x1b[32m✓\x1b[0m Audit opened in Obsidian\n");
	} catch {
		console.log("  \x1b[33m○\x1b[0m Could not open audit in Obsidian\n");
	}
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
async function sessionView(config, entries, prereqResults, exitCode) {
	let currentConfig = config;
	let currentExitCode = exitCode;

	// eslint-disable-next-line no-constant-condition
	while (true) {
		const statusIcon = currentExitCode === 0 ? "\x1b[32m✓ PASS\x1b[0m" : "\x1b[31m✗ FAIL\x1b[0m";
		const journeyNames = currentConfig.selectedSlugs.map((slug) => {
			const entry = entries.find((e) => e.slug === slug);
			return entry ? entry.name : slug;
		});

		console.log(`\n  ${"─".repeat(50)}`);
		console.log(`  Session: ${currentConfig.sessionName}`);
		console.log(`  Status:  ${statusIcon}`);
		console.log(`  Tests:   ${journeyNames.join(", ")}`);
		console.log(`  ${"─".repeat(50)}`);
		console.log();

		const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
		console.log("    r) Re-run");
		console.log("    b) Build and re-run");
		console.log("    e) Edit test selection");
		console.log("    a) Generate audit");
		console.log("    m) Back to main menu");
		console.log("    q) Quit");
		console.log();
		const choice = await ask(rl, "Choice", "r");

		if (choice === "q" || choice === "Q") {
			rl.close();
			return { action: "quit", exitCode: currentExitCode };
		}

		if (choice === "m" || choice === "M") {
			rl.close();
			return { action: "main", exitCode: currentExitCode };
		}

		if (choice === "a" || choice === "A") {
			await generateAudit(rl);
			rl.close();
			continue;
		}

		if (choice === "r" || choice === "R") {
			rl.close();
			const rerunConfig = rerunWithFreshTimestamp(currentConfig, entries);
			currentExitCode = await executeSession(rerunConfig, entries, prereqResults);
			currentConfig = rerunConfig;
			continue;
		}

		if (choice === "b" || choice === "B") {
			rl.close();
			const buildResult = quickBuildAndDeploy();
			if (buildResult !== 0) {
				currentExitCode = buildResult;
				continue;
			}
			const rerunConfig = rerunWithFreshTimestamp(currentConfig, entries);
			currentExitCode = await executeSession(rerunConfig, entries, prereqResults);
			currentConfig = rerunConfig;
			continue;
		}

		if (choice === "e" || choice === "E") {
			// Re-enter test selection with current journeys pre-loaded
			const editConfig = await promptSessionConfig(rl, entries, prereqResults);
			rl.close();
			currentExitCode = await executeSession(editConfig, entries, prereqResults);
			currentConfig = editConfig;
			continue;
		}

		rl.close();
		console.log("\n  Invalid choice — try again.\n");
	}
}

async function interactiveSession() {
	let lastExitCode = 0;
	let incrementPassed = false;

	// eslint-disable-next-line no-constant-condition
	while (true) {
		console.log(`\n  ${"=".repeat(50)}`);
		console.log("  Flowti E2E Test Session");
		console.log(`  ${"=".repeat(50)}`);

		// 1. Check prerequisites
		const prereqResults = checkPrerequisites();
		printPrerequisites(prereqResults);

		if (!prereqResults.vaultExists) {
			console.log("  Cannot proceed — test vault does not exist.");
			console.log(`  Create it by running: npm run test:e2e\n`);
			process.exit(1);
		}

		if (!prereqResults.cliResponsive) {
			console.log("  Cannot proceed — Obsidian is not running or CLI not responsive.");
			console.log("  Start Obsidian with the test vault open, then try again.\n");
			process.exit(1);
		}

		// 2. Choose action
		const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
		const dim = "\x1b[2m";
		const reset = "\x1b[0m";
		console.log("  What would you like to do?");
		console.log("    1) Start test session");
		console.log("    2) Build the increment");
		console.log(incrementPassed ? "    3) Publish the increment" : `    ${dim}3) Publish the increment (requires successful build)${reset}`);
		console.log("    4) Generate audit");
		console.log("    5) Teardown test vault to fresh state");
		console.log("    6) Rebuild (teardown → prerequisites → installer)");
		console.log("    q) Quit");
		console.log();
		const choice = await ask(rl, "Choice", "1");

		if (choice === "q" || choice === "Q") {
			rl.close();
			console.log("\n  Goodbye.\n");
			process.exit(lastExitCode);
		}

		if (choice === "2") {
			rl.close();
			lastExitCode = await runIncrementBuild();
			if (lastExitCode === 0) incrementPassed = true;
			const result = await incrementResultView(lastExitCode);
			lastExitCode = result.exitCode;
			if (lastExitCode === 0) incrementPassed = true;
			if (result.action === "quit") {
				console.log("\n  Goodbye.\n");
				process.exit(lastExitCode);
			}
			continue;
		}

		if (choice === "3") {
			if (!incrementPassed) {
				rl.close();
				console.log("\n  Cannot publish — no successful increment build in this session.\n  Run option 2 first.\n");
				continue;
			}
			rl.close();
			lastExitCode = runPublish();
			const result = await publishResultView(lastExitCode);
			lastExitCode = result.exitCode;
			if (result.action === "quit") {
				console.log("\n  Goodbye.\n");
				process.exit(lastExitCode);
			}
			continue;
		}

		if (choice === "4") {
			await generateAudit(rl);
			rl.close();
			continue;
		}

		if (choice === "5") {
			rl.close();
			await teardownVault();
			continue;
		}

		if (choice === "6") {
			rl.close();
			lastExitCode = await runRebuild();
			continue;
		}

		if (choice !== "1") {
			rl.close();
			console.log("\n  Invalid choice — try again.\n");
			continue;
		}

		// 3. Load journeys and prompt for session config
		const entries = loadJourneyEntries();
		if (entries.length === 0) {
			rl.close();
			console.log("  No journey files found.\n");
			continue;
		}

		const config = await promptSessionConfig(rl, entries, prereqResults);
		rl.close();

		// 4. Execute and enter session view
		lastExitCode = await executeSession(config, entries, prereqResults);
		const result = await sessionView(config, entries, prereqResults, lastExitCode);
		lastExitCode = result.exitCode;

		if (result.action === "quit") {
			console.log("\n  Goodbye.\n");
			process.exit(lastExitCode);
		}
		// "main" → loop continues to main menu
	}
}

/**
 * Creates a re-run config from a previous config with a fresh timestamp in the session name.
 */
function rerunWithFreshTimestamp(prevConfig, entries) {
	const timestamp = new Date().toISOString().replace(/:/g, "-").slice(0, 19);
	const journeySuffix = prevConfig.selectedSlugs.length === entries.length
		? "all"
		: prevConfig.selectedSlugs.join("+");
	return {
		...prevConfig,
		sessionName: `${timestamp} ${journeySuffix}`,
	};
}

/**
 * Executes a test session: sets env vars, runs vitest, generates report, writes session note.
 * Returns the vitest exit code.
 */
async function executeSession(config, entries, prereqResults) {
	// 4. Configure env vars
	const allSlugs = [...config.selectedSlugs];
	if (config.includeInstaller && !allSlugs.includes("installer")) {
		allSlugs.unshift("installer");
	}

	process.env.E2E_JOURNEY = allSlugs.join(",");
	process.env.E2E_SESSION_NAME = config.sessionName;

	if (config.includeInstaller) {
		process.env.E2E_RUN_INSTALLER = "true";
	}
	if (config.includePrerequisites) {
		process.env.E2E_RUN_PREREQUISITES = "true";
	}

	// Step filter — encode as E2E_STEPS env var
	if (config.stepFilter) {
		const parts = [];
		for (const [slug, filter] of Object.entries(config.stepFilter)) {
			if (filter === "all") continue;
			if (Array.isArray(filter) && filter.length > 0) {
				parts.push(`${slug}:${filter.join(",")}`);
			}
		}
		if (parts.length > 0) {
			process.env.E2E_STEPS = parts.join(";");
		}
	}

	// 5. Print session banner
	const selectedNames = config.selectedSlugs.map((slug) => {
		const entry = entries.find((e) => e.slug === slug);
		return entry ? entry.name : slug;
	});

	const hasStepFilter = config.stepFilter && Object.values(config.stepFilter).some((f) => f !== "all");
	console.log(`\n  Starting session "${config.sessionName}"...`);
	console.log(`    Journeys:       ${selectedNames.join(", ")}`);
	if (hasStepFilter) {
		for (const [slug, filter] of Object.entries(config.stepFilter)) {
			if (filter !== "all" && Array.isArray(filter)) {
				console.log(`    Steps (${slug}): ${filter.join(", ")}`);
			}
		}
	}
	console.log(`    Installer:      ${config.includeInstaller ? "yes" : "no"}`);
	console.log(`    Prerequisites:  ${config.includePrerequisites ? "force" : "skip"}`);
	console.log();

	// 6. Run tests
	const startTime = Date.now();
	const exitCode = runVitest();

	// 7. Generate report and open
	generateReportAndOpen();

	// 8. Summary and session note
	const stats = readTestStats();
	printSummary(config.sessionName, selectedNames, startTime, stats);
	const notePath = writeSessionNote(config.sessionName, config, selectedNames, prereqResults, stats, startTime, exitCode);
	console.log(`  Session note: ${notePath}\n`);

	// 9. Collapse file explorer folders
	collapseFileExplorer();

	// Clean env vars for next iteration
	delete process.env.E2E_JOURNEY;
	delete process.env.E2E_SESSION_NAME;
	delete process.env.E2E_RUN_INSTALLER;
	delete process.env.E2E_RUN_PREREQUISITES;
	delete process.env.E2E_STEPS;

	return exitCode;
}

// ── Run vitest and generate report ──────────────────────────────────

function runVitest() {
	let exitCode = 0;
	try {
		execSync("npx vitest run --config tests/e2e/vitest.e2e.config.ts", {
			stdio: "inherit",
		});
	} catch (err) {
		exitCode = err.status ?? 1;
	}
	return exitCode;
}

function generateReportAndOpen() {
	console.log("\n[e2e] Generating E2E report (this may take a moment)...\n");
	let reportVaultPath = null;

	try {
		const output = execSync("node scripts/generate-e2e-report.mjs", {
			encoding: "utf-8",
		});
		console.log(output);

		const match = output.match(/E2EReport written:\s*(.+)/);
		if (match) {
			const absolutePath = match[1].trim();
			const vaultRelative = path.relative(TEST_VAULT, absolutePath).replace(/\\/g, "/");
			reportVaultPath = vaultRelative;
		}
	} catch {
		// Report generation failure shouldn't mask test failures
	}

	if (reportVaultPath) {
		console.log("[e2e] Opening report in Obsidian...");
		try {
			execSync(
				`obsidian vault=${VAULT_NAME} open path="${reportVaultPath}"`,
				{ stdio: "pipe" },
			);
		} catch {
			// best-effort
		}

		try {
			execSync(
				`obsidian vault=${VAULT_NAME} eval code="(() => { const existing = app.workspace.getLeavesOfType('outline')[0]; if (existing) { app.workspace.revealLeaf(existing); return; } const leaf = app.workspace.getRightLeaf(false); if (leaf) leaf.setViewState({ type: 'outline', active: true }); })()"`,
				{ stdio: "pipe" },
			);
		} catch {
			// best-effort
		}

		// Restore installed state before re-enabling the plugin.
		// globalTeardown resets installer.installed=false when E2E_RUN_INSTALLER
		// was set, but re-enabling the plugin with installed=false triggers the
		// installer wizard. We restore it here so the plugin loads normally.
		if (fs.existsSync(DATA_JSON_PATH)) {
			try {
				const data = JSON.parse(fs.readFileSync(DATA_JSON_PATH, "utf-8"));
				if (data.installer && data.installer.installed === false) {
					data.installer.installed = true;
					fs.writeFileSync(DATA_JSON_PATH, JSON.stringify(data), "utf-8");
				}
			} catch {
				// best-effort
			}
		}

		try {
			execSync(
				`obsidian vault=${VAULT_NAME} eval code="app.plugins.enablePlugin('${PLUGIN_ID}')"`,
				{ stdio: "pipe" },
			);
		} catch {
			// best-effort
		}

		try {
			execSync(
				`obsidian vault=${VAULT_NAME} eval code="(() => { try { app.commands.executeCommandById('${PLUGIN_ID}:flowti:open-event-log'); } catch(e) {} })()"`,
				{ stdio: "pipe" },
			);
		} catch {
			// best-effort
		}
	}
}

// ── Main ────────────────────────────────────────────────────────────

const isListMode = process.argv.includes("--list");

if (isListMode) {
	await interactiveSession();
} else {
	const journeyArg = process.argv.find((a) => a.startsWith("--journey="));
	if (journeyArg) {
		process.env.E2E_JOURNEY = journeyArg.split("=")[1];
		console.log(`[e2e] Journey filter: ${process.env.E2E_JOURNEY}`);
	}

	// When installer or prerequisites are explicitly requested, force a fresh run
	const journeys = (process.env.E2E_JOURNEY ?? "").split(",").map((j) => j.trim());
	if (journeys.includes("installer")) {
		process.env.E2E_RUN_INSTALLER = "true";
		console.log("[e2e] Installer forced (explicitly requested).");
	}
	if (journeys.includes("prerequisites")) {
		process.env.E2E_RUN_PREREQUISITES = "true";
		console.log("[e2e] Prerequisites forced (explicitly requested).");
	}

	const exitCode = runVitest();
	generateReportAndOpen();
	process.exit(exitCode);
}
