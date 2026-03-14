/**
 * e2e-interactive.ts — Interactive menus, session views, and result views.
 *
 * Orchestrates user interaction for E2E sessions. All formatting is
 * delegated to ui/e2e/e2e-formatters.ts (DDD presentation separation).
 *
 * This is a view-controller — it lives in the UI layer because it
 * renders menus, takes user input, and dispatches to domain operations.
 */

import type { CliDeps } from "../../infrastructure/deps.js";
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
import { createE2ERenderer } from "./e2e-renderer-impl.js";

// ── Publish result view ─────────────────────────────────────────────

async function publishResultView(exitCode: number, e2e: E2EPaths, deps: CliDeps): Promise<ViewResult> {
	const { disk, paths, shell, clock, input, log } = deps;
	while (true) {
		printResultBanner("Publish", exitCode, log);
		log("    r) Re-run publish");
		log("    a) Generate audit");
		log("    m) Back to main menu");
		log("    q) Quit");
		log();
		const choice = (await input.ask("Choice", "m")).toLowerCase();

		if (choice === "q") return { action: "quit", exitCode };
		if (choice === "m") return { action: "main", exitCode };
		if (choice === "a") { await generateAudit(e2e, { disk, paths, shell, input, clock, log }); continue; }
		if (choice === "r") { exitCode = await runPublish(e2e, { shell, disk, paths, clock, log }); continue; }

		log("\n  Invalid choice — try again.\n");
	}
}

// ── Increment result view ───────────────────────────────────────────

async function handleIncrementPublish(exitCode: number, e2e: E2EPaths, deps: CliDeps): Promise<ViewResult | null> {
	const { shell, disk, paths, clock, log } = deps;
	if (exitCode !== 0) {
		log("\n  Cannot publish — increment build did not pass.\n");
		return null;
	}
	const publishExitCode = await runPublish(e2e, { shell, disk, paths, clock, log });
	return publishResultView(publishExitCode, e2e, deps);
}

async function incrementResultView(exitCode: number, e2e: E2EPaths, deps: CliDeps): Promise<ViewResult> {
	const { shell, disk, paths, clock, input, log } = deps;
	while (true) {
		printResultBanner("Increment Build", exitCode, log);
		printIncrementMenu(exitCode, log);
		const choice = (await input.ask("Choice", exitCode === 0 ? "p" : "m")).toLowerCase();

		if (choice === "q") return { action: "quit", exitCode };
		if (choice === "m") return { action: "main", exitCode };
		if (choice === "a") { await generateAudit(e2e, { disk, paths, shell, input, clock, log }); continue; }
		if (choice === "r") { exitCode = await runIncrementBuild(e2e, { shell, disk, paths, clock, log }); continue; }
		if (choice === "p") {
			const result = await handleIncrementPublish(exitCode, e2e, deps);
			if (result) return result;
			continue;
		}

		log("\n  Invalid choice — try again.\n");
	}
}

// ── Session view ────────────────────────────────────────────────────

async function handleBuildAndRerun(currentConfig: SessionConfig, entries: JourneyEntry[], prereqResults: PrerequisiteResults, e2e: E2EPaths, deps: CliDeps, render: ReturnType<typeof createE2ERenderer>): Promise<{ config: SessionConfig; exitCode: number }> {
	const { disk, paths, shell, proc, clock, log } = deps;
	const buildResult = quickBuildAndDeploy(e2e, { disk, paths, shell, log });
	if (buildResult !== 0) return { config: currentConfig, exitCode: buildResult };
	const rerunConfig = rerunWithFreshTimestamp(currentConfig, entries, { clock });
	const exitCode = await executeSession(rerunConfig, entries, prereqResults, e2e, { disk, paths, shell, proc, clock, log }, render);
	return { config: rerunConfig, exitCode };
}

async function sessionView(config: SessionConfig, entries: JourneyEntry[], prereqResults: PrerequisiteResults, exitCode: number, e2e: E2EPaths, deps: CliDeps, render: ReturnType<typeof createE2ERenderer>): Promise<ViewResult> {
	const { disk, paths, shell, proc, clock, input, log } = deps;
	let currentConfig = config;
	let currentExitCode = exitCode;

	while (true) {
		printSessionBanner(currentConfig, entries, currentExitCode, log);
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
		if (choice === "a") { await generateAudit(e2e, { disk, paths, shell, input, clock, log }); continue; }
		if (choice === "d") { quickBuildAndDeploy(e2e, { disk, paths, shell, log }); continue; }
		if (choice === "r") {
			const rerunConfig = rerunWithFreshTimestamp(currentConfig, entries, { clock });
			currentExitCode = await executeSession(rerunConfig, entries, prereqResults, e2e, { disk, paths, shell, proc, clock, log }, render);
			currentConfig = rerunConfig;
			continue;
		}
		if (choice === "b") {
			const result = await handleBuildAndRerun(currentConfig, entries, prereqResults, e2e, deps, render);
			currentConfig = result.config;
			currentExitCode = result.exitCode;
			continue;
		}
		if (choice === "e") {
			const editConfig = await promptSessionConfig(entries, prereqResults, e2e, { disk, paths, proc, input, clock, log }, render);
			currentExitCode = await executeSession(editConfig, entries, prereqResults, e2e, { disk, paths, shell, proc, clock, log }, render);
			currentConfig = editConfig;
			continue;
		}

		log("\n  Invalid choice — try again.\n");
	}
}

// ── Main menu handlers ──────────────────────────────────────────────

async function handleIncrementChoice(e2e: E2EPaths, deps: CliDeps): Promise<{ exitCode: number; incrementPassed: boolean; quit: boolean }> {
	const { shell, disk, paths, clock, log } = deps;
	const exitCode = await runIncrementBuild(e2e, { shell, disk, paths, clock, log });
	let incrementPassed = exitCode === 0;
	const result = await incrementResultView(exitCode, e2e, deps);
	if (result.exitCode === 0) incrementPassed = true;
	return { exitCode: result.exitCode, incrementPassed, quit: result.action === "quit" };
}

async function handlePublishChoice(e2e: E2EPaths, deps: CliDeps): Promise<{ exitCode: number; quit: boolean }> {
	const { shell, disk, paths, clock, log } = deps;
	const exitCode = await runPublish(e2e, { shell, disk, paths, clock, log });
	const result = await publishResultView(exitCode, e2e, deps);
	return { exitCode: result.exitCode, quit: result.action === "quit" };
}

async function handleTestSessionChoice(prereqResults: PrerequisiteResults, e2e: E2EPaths, deps: CliDeps, render: ReturnType<typeof createE2ERenderer>): Promise<{ exitCode: number; quit: boolean }> {
	const { disk, paths, shell, proc, clock, input, log } = deps;
	const entries = loadJourneyEntries(e2e, { disk, paths });
	if (entries.length === 0) {
		log("  No journey files found.\n");
		return { exitCode: 0, quit: false };
	}
	const config = await promptSessionConfig(entries, prereqResults, e2e, { disk, paths, proc, input, clock, log }, render);
	const exitCode = await executeSession(config, entries, prereqResults, e2e, { disk, paths, shell, proc, clock, log }, render);
	const result = await sessionView(config, entries, prereqResults, exitCode, e2e, deps, render);
	return { exitCode: result.exitCode, quit: result.action === "quit" };
}

async function handleMainMenuChoice(choice: string, prereqResults: PrerequisiteResults, state: InteractiveState, e2e: E2EPaths, deps: CliDeps): Promise<{ handled: boolean; state: InteractiveState }> {
	const { disk, paths, shell, proc, clock, input, log } = deps;
	if (choice === "q") { log("\n  Goodbye.\n"); proc.exit(state.lastExitCode); }
	if (choice === "4") { await generateAudit(e2e, { disk, paths, shell, input, clock, log }); return { handled: true, state }; }
	if (choice === "5") { await teardownVault(e2e, { disk, paths, shell, input, log }); return { handled: true, state }; }
	if (choice === "6") {
		const rebuildCode = await runRebuild(e2e, { disk, shell, paths, input, proc, log });
		return { handled: true, state: { ...state, lastExitCode: rebuildCode } };
	}
	return { handled: false, state };
}

async function handleBuildMenuChoice(choice: string, prereqResults: PrerequisiteResults, state: InteractiveState, e2e: E2EPaths, deps: CliDeps, render: ReturnType<typeof createE2ERenderer>): Promise<{ handled: boolean; state: InteractiveState }> {
	const { proc, log } = deps;
	if (choice === "2") {
		const result = await handleIncrementChoice(e2e, deps);
		const updated = { lastExitCode: result.exitCode, incrementPassed: state.incrementPassed || result.incrementPassed };
		if (result.quit) { log("\n  Goodbye.\n"); proc.exit(updated.lastExitCode); }
		return { handled: true, state: updated };
	}
	if (choice === "3") {
		if (!state.incrementPassed) { log("\n  Cannot publish — no successful increment build in this session.\n  Run option 2 first.\n"); return { handled: true, state }; }
		const result = await handlePublishChoice(e2e, deps);
		if (result.quit) { log("\n  Goodbye.\n"); proc.exit(result.exitCode); }
		return { handled: true, state: { ...state, lastExitCode: result.exitCode } };
	}
	if (choice === "1") {
		const result = await handleTestSessionChoice(prereqResults, e2e, deps, render);
		if (result.quit) { log("\n  Goodbye.\n"); proc.exit(result.exitCode); }
		return { handled: true, state: { ...state, lastExitCode: result.exitCode } };
	}
	return { handled: false, state };
}

// ── Public: interactive session ─────────────────────────────────────

export async function interactiveSession(e2e: E2EPaths, deps: CliDeps): Promise<void> {
	const { disk, paths, shell, proc, input, log } = deps;
	const render = createE2ERenderer(log);
	let state: InteractiveState = { lastExitCode: 0, incrementPassed: false };

	while (true) {
		log(`\n  ${"=".repeat(50)}`);
		log("  Flowti E2E Test Session");
		log(`  ${"=".repeat(50)}`);

		const prereqResults = checkPrerequisites(e2e, { disk, paths, shell });
		printPrerequisites(prereqResults, e2e, log);
		validatePrerequisites(prereqResults, { proc, log });

		printMainMenu(state.incrementPassed, log);
		const choice = (await input.ask("Choice", "1")).toLowerCase();

		const mainResult = await handleMainMenuChoice(choice, prereqResults, state, e2e, deps);
		if (mainResult.handled) { state = mainResult.state; continue; }

		const buildResult = await handleBuildMenuChoice(choice, prereqResults, state, e2e, deps, render);
		if (buildResult.handled) { state = buildResult.state; continue; }

		log("\n  Invalid choice — try again.\n");
	}
}
