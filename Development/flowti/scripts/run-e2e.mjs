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
 *   node scripts/run-e2e.mjs --list                                     Interactive journey picker
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
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

const PLUGIN_ROOT = path.resolve(import.meta.dirname, "..");
const PROJECTS_ROOT = path.resolve(PLUGIN_ROOT, "..", "..", "..");
const TEST_VAULT = process.env.E2E_VAULT_DIR ?? path.join(PROJECTS_ROOT, "flowti-e2e");
const VAULT_NAME = path.basename(TEST_VAULT);
const JOURNEYS_DIR = path.join(PLUGIN_ROOT, "tests", "e2e", "journeys");

// ── --list: interactive journey picker ──────────────────────────────

/**
 * Scans journeys directory, presents a numbered table, and prompts
 * the user to select which journeys to run.
 * Returns a comma-separated journey slug string (e.g. "getting-started,canvas-session").
 */
async function interactiveList() {
	const files = fs.readdirSync(JOURNEYS_DIR)
		.filter((f) => f.endsWith(".journey.json"))
		.sort();

	if (files.length === 0) {
		console.log("[e2e] No journey files found.");
		process.exit(0);
	}

	const entries = files.map((f) => {
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

	console.log("\n  Available Journeys:\n");
	console.log("  #  Ch  Name                          Steps  Description");
	console.log("  " + "-".length ? "-".repeat(78) : "");
	for (let i = 0; i < entries.length; i++) {
		const e = entries[i];
		const num = String(i + 1).padStart(2, " ");
		const ch = String(e.chapter).padStart(2, " ");
		const name = e.name.padEnd(28);
		const steps = String(e.steps).padStart(5);
		const desc = e.description.length > 40 ? e.description.slice(0, 37) + "..." : e.description;
		console.log(`  ${num}  ${ch}  ${name}  ${steps}  ${desc}`);
	}

	const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
	const answer = await new Promise((resolve) => {
		rl.question('\n  Enter journey numbers (space-separated) or "all": ', resolve);
	});
	rl.close();

	const input = answer.trim().toLowerCase();
	if (!input) {
		console.log("[e2e] No selection — exiting.");
		process.exit(0);
	}

	let selectedSlugs;
	if (input === "all") {
		selectedSlugs = entries.map((e) => e.slug);
	} else {
		const indices = input.split(/[\s,]+/).map(Number).filter((n) => n >= 1 && n <= entries.length);
		if (indices.length === 0) {
			console.log("[e2e] Invalid selection — exiting.");
			process.exit(1);
		}
		selectedSlugs = indices.map((i) => entries[i - 1].slug);
	}

	console.log(`[e2e] Selected: ${selectedSlugs.join(", ")}`);
	return selectedSlugs.join(",");
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

		try {
			execSync(
				`obsidian vault=${VAULT_NAME} eval code="app.plugins.enablePlugin('flowti-ibde')"`,
				{ stdio: "pipe" },
			);
		} catch {
			// best-effort
		}

		try {
			execSync(
				`obsidian vault=${VAULT_NAME} eval code="(() => { try { app.commands.executeCommandById('flowti-ibde:flowti:open-event-log'); } catch(e) {} })()"`,
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
	const selection = await interactiveList();
	process.env.E2E_JOURNEY = selection;
	console.log(`[e2e] Journey filter: ${process.env.E2E_JOURNEY}`);
} else {
	const journeyArg = process.argv.find((a) => a.startsWith("--journey="));
	if (journeyArg) {
		process.env.E2E_JOURNEY = journeyArg.split("=")[1];
		console.log(`[e2e] Journey filter: ${process.env.E2E_JOURNEY}`);
	}
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
