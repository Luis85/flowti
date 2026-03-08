/**
 * main.ts — Interactive CLI for Flowti development workflows.
 *
 * Thin orchestrator — all business logic lives in domain modules.
 *
 * Flow:
 *   Start Menu (Open/Create) → Project Detail Menu → ...
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

import { checkPrerequisites } from "./domain/onboarding/onboarding.js";
import { showHelp, commands as helpCmds } from "./domain/help/help.js";
import { commands as infoCmds } from "./domain/info/info.js";
import { commands as buildCmds } from "./domain/build/build.js";
import { commands as devToolsCmds } from "./domain/devtools/devtools.js";
import { commands as makeCmds } from "./domain/make/make.js";
import { commands as reviewCmds } from "./domain/review/review.js";
import { commands as publishCmds } from "./domain/publish/publish.js";
import { commands as reportsCmds } from "./domain/reports/reports.js";
import { commands as captureCmds } from "./domain/capture/capture.js";
import { commands as scaffoldCmds } from "./domain/scaffold/scaffold.js";
import { commands as projectCmds, startMenu } from "./domain/project/project.js";
import { getSelectedProject, clearSelectedProject } from "./infrastructure/state.js";
import { initializeProject } from "./domain/project/project-config.js";

// ── Main menu builder ───────────────────────────────────────────────

import { buildProjectDetailMenu } from "./domain/mainMenu.js";

// ── Command registry ────────────────────────────────────────────────

import type { ProjectContext } from "./infrastructure/types.js";
import { log, error } from "./infrastructure/logger.js";
import { resolveCommand } from "./infrastructure/dispatch.js";

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
	...scaffoldCmds,
	...projectCmds,
};

/** Commands that work without a project context. */
const PROJECT_FREE = new Set(["help", "project", "capture:idea", "capture:note", "scaffold:new", "scaffold:list"]);

function resolveProjectContext(flags: Record<string, string | boolean>): ProjectContext | null {
	const projectName = typeof flags.project === "string" ? flags.project : getSelectedProject();
	if (!projectName) return null;
	return initializeProject(projectName);
}

// ── Non-interactive dispatch ────────────────────────────────────────

async function handleCliArgs(): Promise<boolean> {
	const rawArgs = proc.argv();
	if (!rawArgs.length) return false;

	const { command, flags } = parseArgs(rawArgs);
	const project = resolveProjectContext(flags);

	const result = resolveCommand(command, flags, rawArgs, allCommands, PROJECT_FREE, reportsCmds["report:*"], project);

	switch (result.action) {
		case "help":
			showHelp(result.section);
			return true;
		case "run":
			await result.handler(flags, rawArgs, result.command, result.project);
			return true;
		case "no-project":
			log(`\n  ${RED}No project selected.${RESET}`);
			log(`  ${DIM}Select a project first: npm run flowti -- project${RESET}`);
			log(`  ${DIM}Or specify one:          npm run flowti -- ${result.command} --project=<name>${RESET}\n`);
			return true;
		case "unknown":
			log(`\n  ${YELLOW}Unknown command: ${result.command}${RESET}`);
			log(`  ${DIM}Run "npm run flowti -- help" for available commands.${RESET}\n`);
			return true;
		case "none":
			return false;
	}
}

// ── Project detail menu (inner loop) ────────────────────────────────

function printProjectBanner(): void {
	const project = getSelectedProject();
	const ctx = project ? initializeProject(project) : null;
	const label = ctx?.config.name ?? project ?? "Unknown";

	log(`  ${DIM}Project:${RESET} ${CYAN}${label}${RESET}`);
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

	if (await handleCliArgs()) return;

	printBanner();

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
	error(`\n  ${RED}Fatal error:${RESET}`, err);
	proc.exit(1);
});
