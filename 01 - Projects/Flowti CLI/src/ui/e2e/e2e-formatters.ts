/**
 * e2e-formatters.ts — Presentation-layer formatting for E2E operations.
 *
 * Extracted from domain files (e2e-prerequisites, e2e-session, e2e-build)
 * to enforce DDD boundary: domain logic has no knowledge of display.
 */

import { log } from "../../infrastructure/logger.js";
import type { E2EPaths } from "../../domain/e2e/e2e-paths.js";
import type { PrerequisiteResults, TestStats, BuildStats, JourneyEntry, SessionConfig } from "../../domain/e2e/e2e-types.js";

// ── ANSI helpers ────────────────────────────────────────────────────

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

const ok = (msg: string): void => log(`  ${GREEN}✓${RESET} ${msg}`);
const fail = (msg: string): void => log(`  ${RED}✗${RESET} ${msg}`);
const info = (msg: string): void => log(`  ${YELLOW}○${RESET} ${msg}`);

// ── Prerequisites ───────────────────────────────────────────────────

export function printPrerequisites(results: PrerequisiteResults, e2e: E2EPaths): void {
	log("\n  Prerequisites (local):\n");

	if (results.vaultExists) ok(`Test vault exists: ${e2e.testVault}`);
	else fail(`Test vault missing: ${e2e.testVault}`);

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

// ── Journey table ───────────────────────────────────────────────────

export function printJourneyTable(entries: JourneyEntry[]): void {
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

// ── Step table ──────────────────────────────────────────────────────

export function printStepTable(def: Record<string, unknown>, steps: Array<Record<string, unknown>>): void {
	const setupSteps = (def.setup as Array<Record<string, unknown>>) ?? [];
	const teardownSteps = (def.teardown as Array<Record<string, unknown>>) ?? [];
	log(`  Steps for ${def.journey} (${steps.length} steps):\n`);
	log("    #  ID                          Title");
	log("   " + "-".repeat(62));

	for (const s of setupSteps) {
		const id = ((s.id as string) ?? "setup").padEnd(26);
		log(`${DIM}   ·  ${id}  ${s.title}  [setup]${RESET}`);
	}
	for (let i = 0; i < steps.length; i++) {
		const s = steps[i];
		const num = String(i + 1).padStart(3);
		const id = ((s.id as string) ?? `step-${i + 1}`).padEnd(26);
		log(`  ${num}  ${id}  ${s.title}`);
	}
	for (const s of teardownSteps) {
		const id = ((s.id as string) ?? "teardown").padEnd(26);
		log(`${DIM}   ·  ${id}  ${s.title}  [teardown]${RESET}`);
	}
	log();
}

// ── Execution banner ────────────────────────────────────────────────

export function printExecutionBanner(config: SessionConfig, selectedNames: string[]): void {
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

// ── Session summary ─────────────────────────────────────────────────

export function printSessionSummary(sessionName: string, selectedNames: string[], startTime: number, stats: TestStats): void {
	const duration = ((Date.now() - startTime) / 1000).toFixed(1);
	const failColor = stats.failed > 0 ? RED : GREEN;

	log(`\n  ${"=".repeat(60)}`);
	log(`  Session Summary: ${sessionName}`);
	log(`  ${"=".repeat(60)}\n`);
	log(`  Duration:     ${duration}s`);
	log(`  Journeys:     ${selectedNames.length} (${selectedNames.join(", ")})`);
	log(`  Tests:        ${stats.totalTests} total`);
	log(`  Passed:       ${GREEN}${stats.passed}${RESET}`);
	log(`  Failed:       ${failColor}${stats.failed}${RESET}`);
	log(`  Skipped:      ${stats.skipped}`);
	log(`  Report:       docs/reports/e2e/E2E Report.md`);
	log();
}

// ── Build info helpers ──────────────────────────────────────────────

function printBuildInfo(build: Record<string, unknown>): void {
	const sizeKb = build.total_bytes ? Math.round(build.total_bytes as number / 1024) : "?";
	log(`  Bundle:       ${sizeKb} KB`);
	log(`  Version:      ${build.plugin_version ?? "?"}`);
	if ((build.warnings_count as number) > 0) {
		log(`  Warnings:     ${RED}${build.warnings_count}${RESET}`);
	}
}

function printTestStatsLine(ut: TestStats): void {
	const failColor = ut.failed > 0 ? RED : GREEN;
	log(`  Tests:        ${GREEN}${ut.passed}${RESET} passed, ${failColor}${ut.failed}${RESET} failed, ${DIM}${ut.skipped} skipped${RESET} ${DIM}(${ut.totalTests} total)${RESET}`);
}

function printCoverageLine(coverage: Record<string, unknown>): void {
	const pct = coverage.line_pct ?? coverage.lines_pct ?? coverage.line_percent;
	if (pct != null) {
		log(`  Coverage:     ${pct}%`);
	}
}

// ── Increment / Publish summaries ───────────────────────────────────

export function printIncrementSummary(exitCode: number, duration: string, stats: BuildStats): void {
	const statusIcon = exitCode === 0 ? `${GREEN}✓ PASS${RESET}` : `${RED}✗ FAIL${RESET}`;
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

export function printPublishSummary(exitCode: number, duration: string, stats: BuildStats): void {
	const statusIcon = exitCode === 0 ? `${GREEN}✓ PASS${RESET}` : `${RED}✗ FAIL${RESET}`;
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

// ── Result banners ──────────────────────────────────────────────────

export function printResultBanner(label: string, exitCode: number): void {
	const statusIcon = exitCode === 0 ? `${GREEN}✓ PASS${RESET}` : `${RED}✗ FAIL${RESET}`;
	log(`  ${"─".repeat(50)}`);
	log(`  ${label}: ${statusIcon}`);
	log(`  ${"─".repeat(50)}`);
	log();
}

export function printSessionBanner(config: SessionConfig, entries: JourneyEntry[], exitCode: number): void {
	const statusIcon = exitCode === 0 ? `${GREEN}✓ PASS${RESET}` : `${RED}✗ FAIL${RESET}`;
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

export function printMainMenu(incrementPassed: boolean): void {
	log("  What would you like to do?");
	log("    1) Start test session");
	log("    2) Build the increment");
	log(incrementPassed ? "    3) Publish the increment" : `    ${DIM}3) Publish the increment (requires successful build)${RESET}`);
	log("    4) Generate audit");
	log("    5) Teardown test vault to fresh state");
	log("    6) Rebuild (teardown → prerequisites → installer)");
	log("    q) Quit");
	log();
}

export function printIncrementMenu(exitCode: number): void {
	log(exitCode === 0 ? "    p) Publish the increment" : `    ${DIM}p) Publish the increment (requires successful build)${RESET}`);
	log("    r) Re-run increment build");
	log("    a) Generate audit");
	log("    m) Back to main menu");
	log("    q) Quit");
	log();
}
