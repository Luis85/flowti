/**
 * flowti-cli.ts — Interactive CLI for Flowti development workflows.
 *
 * Thin orchestrator — all business logic lives in domain modules.
 *
 * Usage:
 *   npm run flowti              Interactive menu
 *   npm run flowti help         Full man-page
 *   npm run flowti help build   Section-specific help
 *
 * Configuration: flowti-cli.config.json (CLI project configs/)
 * No external dependencies — uses only Node.js built-ins.
 */

// ── Infrastructure ──────────────────────────────────────────────────

import { parseArgs } from "./infrastructure/args.js";
import { printBanner, RESET, DIM, RED, YELLOW } from "./infrastructure/ui.js";
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
import { commands as projectCmds, projectSelectionMenu } from "./domain/project/project.js";
import { getSelectedProject } from "./infrastructure/state.js";

// ── Main menu definition ────────────────────────────────────────────

import { mainMenuItems } from "./mainMenu.js";

// ── Command registry ────────────────────────────────────────────────

import type { CommandHandler } from "./types.js";

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
	const rawArgs = process.argv.slice(2);
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
	console.log(`\n  ${YELLOW}Unknown command: ${command}${RESET}`);
	console.log(`  ${DIM}Run "npm run flowti -- help" for available commands.${RESET}\n`);
	return true;
}

// ── Interactive main menu ───────────────────────────────────────────

async function mainMenu(): Promise<void> {
	const project = getSelectedProject();
	console.log(`  ${DIM}Main Menu${RESET}  ${DIM}[${project}]${RESET}\n`);
	const result = await runMenu(null, mainMenuItems);
	if (result === "quit") {
		console.log(`\n  ${DIM}Goodbye.${RESET}\n`);
		process.exit(0);
	}
}

// ── Entry point ─────────────────────────────────────────────────────

async function main(): Promise<void> {
	checkPrerequisites();
	ensureDependencies();

	if (await handleCliArgs()) return;

	printBanner();
	checkFirstRun();

	if (!getSelectedProject()) {
		await projectSelectionMenu();
	}

	// eslint-disable-next-line no-constant-condition
	while (true) {
		await mainMenu();
	}
}

main().catch((err: unknown) => {
	console.error(`\n  ${RED}Fatal error:${RESET}`, err);
	process.exit(1);
});
