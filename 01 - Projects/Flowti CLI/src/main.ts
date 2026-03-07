/**
 * main.ts — Interactive CLI for Flowti development workflows.
 *
 * Thin orchestrator — all business logic lives in domain modules.
 *
 * Flow:
 *   Start Menu (Load/Create/Import) → Project Detail Menu → ...
 *
 * Usage:
 *   npm run flowti              Interactive menu
 *   npm run flowti help         Full man-page
 *   npm run flowti help build   Section-specific help
 *
 * Configuration: configs/flowti-cli.config.json
 * No external dependencies — uses only Node.js built-ins.
 */

// ── Infrastructure ──────────────────────────────────────────────────

import { parseArgs } from "./infrastructure/args.js";
import { proc } from "./infrastructure/proc.js";
import { printBanner, RESET, DIM, RED, YELLOW, CYAN } from "./infrastructure/ui.js";
import { runMenu } from "./infrastructure/menu.js";

// ── Domain modules ──────────────────────────────────────────────────

import { checkPrerequisites, ensureDependencies, checkFirstRun } from "./domain/onboarding/onboarding.js";
import { showHelp, commands as helpCmds } from "./domain/help/help.js";
import { commands as infoCmds } from "./domain/info/info.js";
import { commands as buildCmds } from "./domain/build/build.js";
import { commands as devToolsCmds } from "./domain/devtools/devtools.js";
import { commands as makeCmds } from "./domain/make/make.js";
import { commands as reviewCmds } from "./domain/review/review.js";
import { commands as publishCmds } from "./domain/publish/publish.js";
import { commands as reportsCmds } from "./domain/reports/reports.js";
import { commands as captureCmds } from "./domain/capture/capture.js";
import { commands as projectCmds, startMenu } from "./domain/project/project.js";
import { getSelectedProject, getProjectSource, clearSelectedProject } from "./infrastructure/state.js";
import { initializeProject } from "./domain/project/project-config.js";

// ── Main menu builder ───────────────────────────────────────────────

import { buildProjectDetailMenu } from "./mainMenu.js";

// ── Command registry ────────────────────────────────────────────────

import type { CommandHandler } from "./types.js";
import { log } from "./infrastructure/logger.js";

const allCommands: Record<string, CommandHandler> = {
	...helpCmds,
	...infoCmds,
	...buildCmds,
	...devToolsCmds,
	...makeCmds,
	...reviewCmds,
	...publishCmds,
	...reportsCmds,
	...captureCmds,
	...projectCmds,
};

// ── Non-interactive dispatch ────────────────────────────────────────

async function handleCliArgs(): Promise<boolean> {
	const rawArgs = proc.argv();
	if (!rawArgs.length) return false;

	const { command, flags } = parseArgs(rawArgs);

	// Help is special — may have a sub-section as positional arg
	if (command === "help") {
		showHelp(Object.keys(flags)[0] ?? rawArgs[1] ?? "main");
		return true;
	}

	// Direct command match
	if (command) {
		const handler = allCommands[command];
		if (handler) {
			handler(flags, rawArgs, command);
			return true;
		}
	}

	// Wildcard report commands (report:test, report:coverage, etc.)
	if (command?.startsWith("report:")) {
		const reportHandler = reportsCmds["report:*"];
		if (reportHandler) {
			reportHandler(flags, rawArgs, command);
			return true;
		}
	}

	// Unknown command
	log(`\n  ${YELLOW}Unknown command: ${command}${RESET}`);
	log(`  ${DIM}Run "npm run flowti -- help" for available commands.${RESET}\n`);
	return true;
}

// ── Project detail menu (inner loop) ────────────────────────────────

function printProjectBanner(): void {
	const project = getSelectedProject();
	const source = getProjectSource();
	const ctx = project ? initializeProject(project) : null;
	const label = ctx?.config.name ?? project ?? "Unknown";
	const sourceLabel = source === "development" ? `${DIM}Development/${RESET}` : "";

	log(`  ${DIM}Project:${RESET} ${sourceLabel}${CYAN}${label}${RESET}`);
	if (ctx?.pkg) {
		log(`  ${DIM}${ctx.pkg.name ?? ""}@${ctx.pkg.version ?? "?"}${RESET}`);
	}
	log();
}

async function projectDetailLoop(): Promise<"start" | "quit"> {

	while (true) {
		printProjectBanner();
		const result = await runMenu(null, buildProjectDetailMenu());
		if (result === "quit") return "quit";
		if (result === "start") return "start";
	}
}

// ── Entry point ─────────────────────────────────────────────────────

async function main(): Promise<void> {
	checkPrerequisites();
	ensureDependencies();

	if (await handleCliArgs()) return;

	printBanner();
	checkFirstRun();

	// Outer loop: Start Menu → Project Detail → back to Start Menu
	 
	while (true) {
		if (!getSelectedProject()) {
			const startResult = await startMenu();
			if (startResult === "quit") {
				log(`\n  ${DIM}Goodbye.${RESET}\n`);
				proc.exit(0);
			}
		}

		const detailResult = await projectDetailLoop();
		if (detailResult === "quit") {
			log(`\n  ${DIM}Goodbye.${RESET}\n`);
			proc.exit(0);
		}
		// detailResult === "start" → clear project and loop back to start menu
		clearSelectedProject();
	}
}

main().catch((err: unknown) => {
	console.error(`\n  ${RED}Fatal error:${RESET}`, err);
	proc.exit(1);
});
