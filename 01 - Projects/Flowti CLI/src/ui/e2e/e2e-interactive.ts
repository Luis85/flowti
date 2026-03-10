/**
 * e2e-interactive.ts — Interactive menus, session views, and result views.
 *
 * Orchestrates user interaction for E2E sessions. All formatting is
 * delegated to ui/e2e/e2e-formatters.ts (DDD presentation separation).
 *
 * This is a view-controller — it lives in the UI layer because it
 * renders menus, takes user input, and dispatches to domain operations.
 */

import { proc } from "../../infrastructure/proc.js";
import { input } from "../../infrastructure/input.js";
import { log } from "../../infrastructure/logger.js";
import type { E2EPaths } from "../../domain/e2e/e2e-paths.js";
import type { SessionConfig, JourneyEntry, PrerequisiteResults, ViewResult, InteractiveState } from "../../domain/e2e/e2e-types.js";
import { checkPrerequisites, validatePrerequisites } from "../../domain/e2e/e2e-prerequisites.js";
import { teardownVault, runRebuild } from "../../domain/e2e/e2e-teardown.js";
import { loadJourneyEntries, promptSessionConfig, rerunWithFreshTimestamp } from "../../domain/e2e/e2e-session.js";
import { quickBuildAndDeploy, runIncrementBuild, runPublish } from "../../domain/e2e/e2e-build.js";
import { generateAudit } from "../../domain/e2e/e2e-audit.js";
import { executeSession } from "../../domain/e2e/e2e-runner.js";
import {
	printPrerequisites,
	printResultBanner,
	printSessionBanner,
	printMainMenu,
	printIncrementMenu,
} from "./e2e-formatters.js";

// ── Publish result view ─────────────────────────────────────────────

async function publishResultView(exitCode: number, e2e: E2EPaths): Promise<ViewResult> {
	while (true) {
		printResultBanner("Publish", exitCode);
		log("    r) Re-run publish");
		log("    a) Generate audit");
		log("    m) Back to main menu");
		log("    q) Quit");
		log();
		const choice = (await input.ask("Choice", "m")).toLowerCase();

		if (choice === "q") return { action: "quit", exitCode };
		if (choice === "m") return { action: "main", exitCode };
		if (choice === "a") { await generateAudit(e2e); continue; }
		if (choice === "r") { exitCode = await runPublish(e2e); continue; }

		log("\n  Invalid choice — try again.\n");
	}
}

// ── Increment result view ───────────────────────────────────────────

async function handleIncrementPublish(exitCode: number, e2e: E2EPaths): Promise<ViewResult | null> {
	if (exitCode !== 0) {
		log("\n  Cannot publish — increment build did not pass.\n");
		return null;
	}
	const publishExitCode = await runPublish(e2e);
	return publishResultView(publishExitCode, e2e);
}

async function incrementResultView(exitCode: number, e2e: E2EPaths): Promise<ViewResult> {
	while (true) {
		printResultBanner("Increment Build", exitCode);
		printIncrementMenu(exitCode);
		const choice = (await input.ask("Choice", exitCode === 0 ? "p" : "m")).toLowerCase();

		if (choice === "q") return { action: "quit", exitCode };
		if (choice === "m") return { action: "main", exitCode };
		if (choice === "a") { await generateAudit(e2e); continue; }
		if (choice === "r") { exitCode = await runIncrementBuild(e2e); continue; }
		if (choice === "p") {
			const result = await handleIncrementPublish(exitCode, e2e);
			if (result) return result;
			continue;
		}

		log("\n  Invalid choice — try again.\n");
	}
}

// ── Session view ────────────────────────────────────────────────────

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
		log("    r) Re-run");
		log("    b) Build and re-run");
		log("    d) Build only (no re-run)");
		log("    e) Edit test selection");
		log("    a) Generate audit");
		log("    m) Back to main menu");
		log("    q) Quit");
		log();
		const choice = (await input.ask("Choice", "r")).toLowerCase();

		if (choice === "q") return { action: "quit", exitCode: currentExitCode };
		if (choice === "m") return { action: "main", exitCode: currentExitCode };
		if (choice === "a") { await generateAudit(e2e); continue; }
		if (choice === "d") { quickBuildAndDeploy(e2e); continue; }
		if (choice === "r") {
			const rerunConfig = rerunWithFreshTimestamp(currentConfig, entries);
			currentExitCode = await executeSession(rerunConfig, entries, prereqResults, e2e);
			currentConfig = rerunConfig;
			continue;
		}
		if (choice === "b") {
			const result = await handleBuildAndRerun(currentConfig, entries, prereqResults, e2e);
			currentConfig = result.config;
			currentExitCode = result.exitCode;
			continue;
		}
		if (choice === "e") {
			const editConfig = await promptSessionConfig(entries, prereqResults, e2e);
			currentExitCode = await executeSession(editConfig, entries, prereqResults, e2e);
			currentConfig = editConfig;
			continue;
		}

		log("\n  Invalid choice — try again.\n");
	}
}

// ── Main menu handlers ──────────────────────────────────────────────

async function handleIncrementChoice(e2e: E2EPaths): Promise<{ exitCode: number; incrementPassed: boolean; quit: boolean }> {
	const exitCode = await runIncrementBuild(e2e);
	let incrementPassed = exitCode === 0;
	const result = await incrementResultView(exitCode, e2e);
	if (result.exitCode === 0) incrementPassed = true;
	return { exitCode: result.exitCode, incrementPassed, quit: result.action === "quit" };
}

async function handlePublishChoice(e2e: E2EPaths): Promise<{ exitCode: number; quit: boolean }> {
	const exitCode = await runPublish(e2e);
	const result = await publishResultView(exitCode, e2e);
	return { exitCode: result.exitCode, quit: result.action === "quit" };
}

async function handleTestSessionChoice(prereqResults: PrerequisiteResults, e2e: E2EPaths): Promise<{ exitCode: number; quit: boolean }> {
	const entries = loadJourneyEntries(e2e);
	if (entries.length === 0) {
		log("  No journey files found.\n");
		return { exitCode: 0, quit: false };
	}
	const config = await promptSessionConfig(entries, prereqResults, e2e);
	const exitCode = await executeSession(config, entries, prereqResults, e2e);
	const result = await sessionView(config, entries, prereqResults, exitCode, e2e);
	return { exitCode: result.exitCode, quit: result.action === "quit" };
}

async function handleMainMenuChoice(choice: string, prereqResults: PrerequisiteResults, state: InteractiveState, e2e: E2EPaths): Promise<{ handled: boolean; state: InteractiveState }> {
	if (choice === "q") { log("\n  Goodbye.\n"); proc.exit(state.lastExitCode); }
	if (choice === "4") { await generateAudit(e2e); return { handled: true, state }; }
	if (choice === "5") { await teardownVault(e2e); return { handled: true, state }; }
	if (choice === "6") {
		const rebuildCode = await runRebuild(e2e);
		return { handled: true, state: { ...state, lastExitCode: rebuildCode } };
	}
	return { handled: false, state };
}

async function handleBuildMenuChoice(choice: string, prereqResults: PrerequisiteResults, state: InteractiveState, e2e: E2EPaths): Promise<{ handled: boolean; state: InteractiveState }> {
	if (choice === "2") {
		const result = await handleIncrementChoice(e2e);
		const updated = { lastExitCode: result.exitCode, incrementPassed: state.incrementPassed || result.incrementPassed };
		if (result.quit) { log("\n  Goodbye.\n"); proc.exit(updated.lastExitCode); }
		return { handled: true, state: updated };
	}
	if (choice === "3") {
		if (!state.incrementPassed) { log("\n  Cannot publish — no successful increment build in this session.\n  Run option 2 first.\n"); return { handled: true, state }; }
		const result = await handlePublishChoice(e2e);
		if (result.quit) { log("\n  Goodbye.\n"); proc.exit(result.exitCode); }
		return { handled: true, state: { ...state, lastExitCode: result.exitCode } };
	}
	if (choice === "1") {
		const result = await handleTestSessionChoice(prereqResults, e2e);
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

		printMainMenu(state.incrementPassed);
		const choice = (await input.ask("Choice", "1")).toLowerCase();

		const mainResult = await handleMainMenuChoice(choice, prereqResults, state, e2e);
		if (mainResult.handled) { state = mainResult.state; continue; }

		const buildResult = await handleBuildMenuChoice(choice, prereqResults, state, e2e);
		if (buildResult.handled) { state = buildResult.state; continue; }

		log("\n  Invalid choice — try again.\n");
	}
}
