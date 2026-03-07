/**
 * flowti-cli.mjs — Interactive CLI for Flowti development workflows.
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

import { parseArgs } from "./infrastructure/args.mjs";
import { printBanner, RESET, DIM, RED, YELLOW } from "./infrastructure/ui.mjs";
import { runMenu } from "./infrastructure/menu.mjs";

// ── Domain modules ──────────────────────────────────────────────────

import { checkPrerequisites, ensureDependencies, checkFirstRun } from "./domain/onboarding/onboarding.mjs";
import { showHelp, commands as helpCmds } from "./domain/help/help.mjs";
import { commands as infoCmds } from "./domain/info/info.mjs";
import { commands as buildCmds } from "./domain/build/build.mjs";
import { commands as devToolsCmds } from "./domain/devtools/devtools.mjs";
import { commands as makeCmds } from "./domain/make/make.mjs";
import { commands as reviewCmds } from "./domain/review/review.mjs";
import { commands as publishCmds } from "./domain/publish/publish.mjs";
import { commands as reportsCmds } from "./domain/reports/reports.mjs";
import { commands as captureCmds } from "./domain/capture/capture.mjs";

// ── Main menu definition ────────────────────────────────────────────

import { mainMenuItems } from "./mainMenu.mjs";

// ── Command registry ────────────────────────────────────────────────

const allCommands = {
	...helpCmds,
	...infoCmds,
	...buildCmds,
	...devToolsCmds,
	...makeCmds,
	...reviewCmds,
	...publishCmds,
	...reportsCmds,
	...captureCmds,
};

// ── Non-interactive dispatch ────────────────────────────────────────

async function handleCliArgs() {
	const rawArgs = process.argv.slice(2);
	if (!rawArgs.length) return false;

	const { command, flags } = parseArgs(rawArgs);

	// Help is special — may have a sub-section as positional arg
	if (command === "help") {
		showHelp(Object.keys(flags)[0] ?? rawArgs[1] ?? "main");
		return true;
	}

	// Direct command match
	const handler = allCommands[command];
	if (handler) {
		handler(flags, rawArgs);
		return true;
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

async function mainMenu() {
	console.log(`  ${DIM}Main Menu${RESET}\n`);
	return runMenu(null, mainMenuItems);
}

// ── Entry point ─────────────────────────────────────────────────────

async function main() {
	checkPrerequisites();
	ensureDependencies();

	if (await handleCliArgs()) return;

	printBanner();
	checkFirstRun();

	// eslint-disable-next-line no-constant-condition
	while (true) {
		const result = await mainMenu();
		if (result === "quit") {
			console.log(`\n  ${DIM}Goodbye.${RESET}\n`);
			process.exit(0);
		}
	}
}

main().catch((err) => {
	console.error(`\n  ${RED}Fatal error:${RESET}`, err);
	process.exit(1);
});
