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
 *
 * npm script presets:
 *   npm run test:e2e                   Full suite
 *   npm run test:e2e:installer         Installer only
 *   npm run test:e2e:getting-started   Getting Started only
 *   npm run test:e2e:components        Component Library only
 *   npm run test:e2e:tool-showcase      Tool Showcase only
 *   npm run test:e2e:journeys          All journeys (no installer)
 *   npm run test:e2e:quick             Installer + Getting Started (fast)
 */
import { execSync } from "node:child_process";
import path from "node:path";

const PLUGIN_ROOT = path.resolve(import.meta.dirname, "..");
const PROJECTS_ROOT = path.resolve(PLUGIN_ROOT, "..", "..", "..");
const TEST_VAULT = process.env.E2E_VAULT_DIR ?? path.join(PROJECTS_ROOT, "flowti-e2e");
const VAULT_NAME = path.basename(TEST_VAULT);

// Parse --journey= argument: run one or more journeys by name (comma-separated)
const journeyArg = process.argv.find((a) => a.startsWith("--journey="));
if (journeyArg) {
	process.env.E2E_JOURNEY = journeyArg.split("=")[1];
	console.log(`[e2e] Journey filter: ${process.env.E2E_JOURNEY}`);
}

// When installer or prerequisites are explicitly requested, force a fresh run
// (override the default skip-when-passed behavior)
const journeys = (process.env.E2E_JOURNEY ?? "").split(",").map((j) => j.trim());
if (journeys.includes("installer")) {
	process.env.E2E_RUN_INSTALLER = "true";
	console.log("[e2e] Installer forced (explicitly requested).");
}
if (journeys.includes("prerequisites")) {
	process.env.E2E_RUN_PREREQUISITES = "true";
	console.log("[e2e] Prerequisites forced (explicitly requested).");
}

let exitCode = 0;

try {
	execSync("npx vitest run --config tests/e2e/vitest.e2e.config.ts", {
		stdio: "inherit",
	});
} catch (err) {
	exitCode = err.status ?? 1;
}

// Always generate the report, even when tests fail
let reportVaultPath = null;

try {
	const output = execSync("node scripts/generate-e2e-report.mjs", {
		encoding: "utf-8",
	});
	console.log(output);

	// Extract the absolute path from "[report] E2EReport written: <path>"
	const match = output.match(/E2EReport written:\s*(.+)/);
	if (match) {
		const absolutePath = match[1].trim();
		// Convert absolute path to vault-relative path
		const vaultRelative = path.relative(TEST_VAULT, absolutePath).replace(/\\/g, "/");
		reportVaultPath = vaultRelative;
	}
} catch {
	// Report generation failure shouldn't mask test failures
}

// Open the report in the test vault
if (reportVaultPath) {
	try {
		execSync(
			`obsidian vault=${VAULT_NAME} open path="${reportVaultPath}"`,
			{ stdio: "pipe" },
		);
	} catch {
		// Opening the report is best-effort
	}

	// Open the Outline panel in the right sidebar so the report's
	// structure is immediately visible alongside the content.
	try {
		execSync(
			`obsidian vault=${VAULT_NAME} eval code="(() => { const leaf = app.workspace.getRightLeaf(false); if (leaf) leaf.setViewState({ type: 'outline', active: true }); })()"`,
			{ stdio: "pipe" },
		);
	} catch {
		// Outline opening is best-effort
	}

	// Open the Activity Log if available
	try {
		execSync(
			`obsidian vault=${VAULT_NAME} eval code="(() => { try { app.commands.executeCommandById('flowti-ibde:open-activity-log'); } catch(e) {} })()"`,
			{ stdio: "pipe" },
		);
	} catch {
		// Activity Log may not be available — best effort
	}
}

process.exit(exitCode);
