/**
 * e2e-interactive.ts — Interactive menus, session views, and result views.
 */

import { log } from "../../infrastructure/logger.js";
import { proc } from "../../infrastructure/proc.js";
import { createRL } from "../../infrastructure/readline.js";
import type { E2EPaths } from "./e2e-paths.js";
import type { SessionConfig, JourneyEntry, PrerequisiteResults, ViewResult, InteractiveState } from "./e2e-types.js";
import { ask } from "./e2e-helpers.js";
import { checkPrerequisites, printPrerequisites, validatePrerequisites } from "./e2e-prerequisites.js";
import { teardownVault, runRebuild } from "./e2e-teardown.js";
import { loadJourneyEntries, promptSessionConfig, rerunWithFreshTimestamp } from "./e2e-session.js";
import { quickBuildAndDeploy, runIncrementBuild, runPublish } from "./e2e-build.js";
import { generateAudit } from "./e2e-audit.js";
import { runVitest, generateReportAndOpen, executeSession } from "./e2e-runner.js";

// ── Result banners ──────────────────────────────────────────────────

function printResultBanner(label: string, exitCode: number): void {
	const statusIcon = exitCode === 0 ? "\x1b[32m✓ PASS\x1b[0m" : "\x1b[31m✗ FAIL\x1b[0m";
	log(`  ${"─".repeat(50)}`);
	log(`  ${label}: ${statusIcon}`);
	log(`  ${"─".repeat(50)}`);
	log();
}

// ── Publish result view ─────────────────────────────────────────────

async function publishResultView(exitCode: number, e2e: E2EPaths): Promise<ViewResult> {
	while (true) {
		printResultBanner("Publish", exitCode);
		const rl = createRL();
		log("    r) Re-run publish");
		log("    a) Generate audit");
		log("    m) Back to main menu");
		log("    q) Quit");
		log();
		const choice = (await ask(rl, "Choice", "m")).toLowerCase();

		if (choice === "q") { rl.close(); return { action: "quit", exitCode }; }
		if (choice === "m") { rl.close(); return { action: "main", exitCode }; }
		if (choice === "a") { await generateAudit(rl, e2e); rl.close(); continue; }
		if (choice === "r") { rl.close(); exitCode = runPublish(e2e); continue; }

		rl.close();
		log("\n  Invalid choice — try again.\n");
	}
}

// ── Increment result view ───────────────────────────────────────────

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

async function handleIncrementPublish(exitCode: number, e2e: E2EPaths): Promise<ViewResult | null> {
	if (exitCode !== 0) {
		log("\n  Cannot publish — increment build did not pass.\n");
		return null;
	}
	const publishExitCode = runPublish(e2e);
	return publishResultView(publishExitCode, e2e);
}

async function incrementResultView(exitCode: number, e2e: E2EPaths): Promise<ViewResult> {
	while (true) {
		printResultBanner("Increment Build", exitCode);
		const rl = createRL();
		printIncrementMenu(exitCode);
		const choice = (await ask(rl, "Choice", exitCode === 0 ? "p" : "m")).toLowerCase();

		if (choice === "q") { rl.close(); return { action: "quit", exitCode }; }
		if (choice === "m") { rl.close(); return { action: "main", exitCode }; }
		if (choice === "a") { await generateAudit(rl, e2e); rl.close(); continue; }
		if (choice === "r") { rl.close(); exitCode = await runIncrementBuild(e2e); continue; }
		if (choice === "p") {
			rl.close();
			const result = await handleIncrementPublish(exitCode, e2e);
			if (result) return result;
			continue;
		}

		rl.close();
		log("\n  Invalid choice — try again.\n");
	}
}

// ── Session view ────────────────────────────────────────────────────

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

async function handleBuildAndRerun(currentConfig: SessionConfig, entries: JourneyEntry[], prereqResults: PrerequisiteResults, e2e: E2EPaths): Promise<{ config: SessionConfig; exitCode: number }> {
	const buildResult = quickBuildAndDeploy(e2e);
	if (buildResult !== 0) return { config: currentConfig, exitCode: buildResult };
	const rerunConfig = rerunWithFreshTimestamp(currentConfig, entries);
	const exitCode = await executeSession(rerunConfig, entries, prereqResults, e2e);
	return { config: rerunConfig, exitCode };
}

async function sessionView(config: SessionConfig, entries: JourneyEntry[], prereqResults: PrerequisiteResults, exitCode: number, e2e: E2EPaths): Promise<ViewResult> {
	let currentConfig = config;
	let currentExitCode = exitCode;

	while (true) {
		printSessionBanner(currentConfig, entries, currentExitCode);
		const rl = createRL();
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
		if (choice === "a") { await generateAudit(rl, e2e); rl.close(); continue; }
		if (choice === "d") { rl.close(); quickBuildAndDeploy(e2e); continue; }
		if (choice === "r") {
			rl.close();
			const rerunConfig = rerunWithFreshTimestamp(currentConfig, entries);
			currentExitCode = await executeSession(rerunConfig, entries, prereqResults, e2e);
			currentConfig = rerunConfig;
			continue;
		}
		if (choice === "b") {
			rl.close();
			const result = await handleBuildAndRerun(currentConfig, entries, prereqResults, e2e);
			currentConfig = result.config;
			currentExitCode = result.exitCode;
			continue;
		}
		if (choice === "e") {
			const editConfig = await promptSessionConfig(rl, entries, prereqResults, e2e);
			rl.close();
			currentExitCode = await executeSession(editConfig, entries, prereqResults, e2e);
			currentConfig = editConfig;
			continue;
		}

		rl.close();
		log("\n  Invalid choice — try again.\n");
	}
}

// ── Main menu ───────────────────────────────────────────────────────

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

async function handleIncrementChoice(e2e: E2EPaths): Promise<{ exitCode: number; incrementPassed: boolean; quit: boolean }> {
	const exitCode = await runIncrementBuild(e2e);
	let incrementPassed = exitCode === 0;
	const result = await incrementResultView(exitCode, e2e);
	if (result.exitCode === 0) incrementPassed = true;
	return { exitCode: result.exitCode, incrementPassed, quit: result.action === "quit" };
}

async function handlePublishChoice(e2e: E2EPaths): Promise<{ exitCode: number; quit: boolean }> {
	const exitCode = runPublish(e2e);
	const result = await publishResultView(exitCode, e2e);
	return { exitCode: result.exitCode, quit: result.action === "quit" };
}

async function handleTestSessionChoice(rl: ReturnType<typeof createRL>, prereqResults: PrerequisiteResults, e2e: E2EPaths): Promise<{ exitCode: number; quit: boolean }> {
	const entries = loadJourneyEntries(e2e);
	if (entries.length === 0) {
		rl.close();
		log("  No journey files found.\n");
		return { exitCode: 0, quit: false };
	}
	const config = await promptSessionConfig(rl, entries, prereqResults, e2e);
	rl.close();
	const exitCode = await executeSession(config, entries, prereqResults, e2e);
	const result = await sessionView(config, entries, prereqResults, exitCode, e2e);
	return { exitCode: result.exitCode, quit: result.action === "quit" };
}

async function handleMainMenuChoice(choice: string, rl: ReturnType<typeof createRL>, prereqResults: PrerequisiteResults, state: InteractiveState, e2e: E2EPaths): Promise<{ handled: boolean; state: InteractiveState }> {
	if (choice === "q") { rl.close(); log("\n  Goodbye.\n"); proc.exit(state.lastExitCode); }
	if (choice === "4") { await generateAudit(rl, e2e); rl.close(); return { handled: true, state }; }
	if (choice === "5") { rl.close(); await teardownVault(e2e); return { handled: true, state }; }
	if (choice === "6") {
		rl.close();
		const rebuildCode = await runRebuild(e2e, () => runVitest(e2e), () => generateReportAndOpen(e2e));
		return { handled: true, state: { ...state, lastExitCode: rebuildCode } };
	}
	return { handled: false, state };
}

async function handleBuildMenuChoice(choice: string, rl: ReturnType<typeof createRL>, prereqResults: PrerequisiteResults, state: InteractiveState, e2e: E2EPaths): Promise<{ handled: boolean; state: InteractiveState }> {
	if (choice === "2") {
		rl.close();
		const result = await handleIncrementChoice(e2e);
		const updated = { lastExitCode: result.exitCode, incrementPassed: state.incrementPassed || result.incrementPassed };
		if (result.quit) { log("\n  Goodbye.\n"); proc.exit(updated.lastExitCode); }
		return { handled: true, state: updated };
	}
	if (choice === "3") {
		rl.close();
		if (!state.incrementPassed) { log("\n  Cannot publish — no successful increment build in this session.\n  Run option 2 first.\n"); return { handled: true, state }; }
		const result = await handlePublishChoice(e2e);
		if (result.quit) { log("\n  Goodbye.\n"); proc.exit(result.exitCode); }
		return { handled: true, state: { ...state, lastExitCode: result.exitCode } };
	}
	if (choice === "1") {
		const result = await handleTestSessionChoice(rl, prereqResults, e2e);
		if (result.quit) { log("\n  Goodbye.\n"); proc.exit(result.exitCode); }
		return { handled: true, state: { ...state, lastExitCode: result.exitCode } };
	}
	return { handled: false, state };
}

// ── Public: interactive session ─────────────────────────────────────

export async function interactiveSession(e2e: E2EPaths): Promise<void> {
	let state: InteractiveState = { lastExitCode: 0, incrementPassed: false };

	while (true) {
		log(`\n  ${"=".repeat(50)}`);
		log("  Flowti E2E Test Session");
		log(`  ${"=".repeat(50)}`);

		const prereqResults = checkPrerequisites(e2e);
		printPrerequisites(prereqResults, e2e);
		validatePrerequisites(prereqResults);

		const rl = createRL();
		printMainMenu(state.incrementPassed);
		const choice = (await ask(rl, "Choice", "1")).toLowerCase();

		const mainResult = await handleMainMenuChoice(choice, rl, prereqResults, state, e2e);
		if (mainResult.handled) { state = mainResult.state; continue; }

		const buildResult = await handleBuildMenuChoice(choice, rl, prereqResults, state, e2e);
		if (buildResult.handled) { state = buildResult.state; continue; }

		rl.close();
		log("\n  Invalid choice — try again.\n");
	}
}
