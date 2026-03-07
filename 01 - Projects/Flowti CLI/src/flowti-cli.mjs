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
import { printBanner, printMenu, RESET, DIM, RED, YELLOW } from "./infrastructure/ui.mjs";
import { createRL, ask } from "./infrastructure/readline.mjs";

// ── Domain modules ──────────────────────────────────────────────────

import { checkPrerequisites, ensureDependencies, checkFirstRun } from "./domain/onboarding/onboarding.mjs";
import { showHelp, commands as helpCmds } from "./domain/help/help.mjs";
import { showInfo, commands as infoCmds } from "./domain/info/info.mjs";
import { menu as buildMenu, commands as buildCmds } from "./domain/build/build.mjs";
import { menu as devToolsMenu, commands as devToolsCmds } from "./domain/devtools/devtools.mjs";
import { menu as makeMenu, commands as makeCmds } from "./domain/make/make.mjs";
import { menu as reviewMenu, commands as reviewCmds } from "./domain/review/review.mjs";
import { menu as publishMenu, commands as publishCmds } from "./domain/publish/publish.mjs";
import { menu as reportsMenu, commands as reportsCmds } from "./domain/reports/reports.mjs";
import { captureIdea, captureNote, commands as captureCmds } from "./domain/capture/capture.mjs";

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
	console.log(`  ${DIM}Main Menu${RESET}`);
	console.log();
	printMenu([
		{ key: "1", label: "Make" },
		{ key: "2", label: "Build" },
		{ key: "3", label: "Review" },
		{ key: "4", label: "Publish" },
		{ key: "5", label: "Reports" },
		{ key: "6", label: "Dev Tools" },
		{ key: "7", label: "Info" },
		{ separator: true },
		{ key: "8", label: "Capture Idea" },
		{ key: "9", label: "Capture Note" },
		{ separator: true },
		{ key: "?", label: "Help" },
		{ key: "q", label: "Quit" },
	]);

	const rl = createRL();
	const choice = await ask(rl, "Choice", "1");
	rl.close();

	switch (choice.toLowerCase()) {
		case "1": return await makeMenu();
		case "2": return await buildMenu();
		case "3": return await reviewMenu();
		case "4": return await publishMenu();
		case "5": return await reportsMenu();
		case "6": return await devToolsMenu();
		case "7": showInfo(); return "main";
		case "8": return await captureIdea();
		case "9": return await captureNote();
		case "?": showHelp("main"); return "main";
		case "q": return "quit";
		default:
			console.log("\n  Invalid choice — try again.\n");
			return "main";
	}
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
