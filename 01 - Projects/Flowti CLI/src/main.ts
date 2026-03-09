/**
 * main.ts — Interactive CLI for Flowti development workflows.
 *
 * Thin orchestrator — all business logic lives in domain modules.
 *
 * Flow:
 *   Start Menu (Open/Create) → Project Detail Menu → ...
 *
 * Usage:
 *   flowti              Interactive menu
 *   flowti help         Full man-page
 *   flowti help build   Section-specific help
 *
 * Configuration: .flowti/config.json
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
import { commands as eventsCmds } from "./domain/events/events.js";
import { commands as scaffoldCmds } from "./domain/scaffold/scaffold.js";
import { commands as projectCmds, startMenu, listProjects } from "./domain/project/project.js";
import { commands as projectDepsCmds } from "./domain/project/project-deps.js";
import { commands as pluginCmds, loadPlugins, detectCollisions } from "./domain/plugins/plugins.js";
import { commands as aiToolsCmds } from "./domain/ai-tools/ai-tools.js";
import { disk } from "./infrastructure/filesystem.js";
import { shell } from "./infrastructure/shell.js";
import { VAULT_ROOT } from "./infrastructure/config.js";
import { getSelectedProject, clearSelectedProject } from "./infrastructure/state.js";
import { initializeProject } from "./domain/project/project-config.js";

// ── Main menu builder ───────────────────────────────────────────────

import { buildProjectDetailMenu } from "./domain/mainMenu.js";

// ── Command registry ────────────────────────────────────────────────

import type { ProjectContext } from "./infrastructure/types.js";
import { log, error } from "./infrastructure/logger.js";
import { resolveCommand } from "./infrastructure/dispatch.js";
import { CommandRegistry } from "./infrastructure/command-registry.js";
import { CliError, formatError } from "./infrastructure/errors.js";

const registry = new CommandRegistry();
registry.registerDomain({ domain: "help",     commands: helpCmds,     projectFree: ["help"] });
registry.registerDomain({ domain: "info",     commands: infoCmds });
registry.registerDomain({ domain: "build",    commands: buildCmds });
registry.registerDomain({ domain: "devtools", commands: devToolsCmds });
registry.registerDomain({ domain: "make",     commands: makeCmds });
registry.registerDomain({ domain: "review",   commands: reviewCmds });
registry.registerDomain({ domain: "publish",  commands: publishCmds });
registry.registerDomain({ domain: "reports",  commands: reportsCmds });
registry.registerDomain({ domain: "capture",  commands: captureCmds,  projectFree: ["capture:idea", "capture:note"] });
registry.registerDomain({ domain: "events",   commands: eventsCmds });
registry.registerDomain({ domain: "scaffold", commands: scaffoldCmds, projectFree: ["scaffold:new", "scaffold:list", "scaffold:marketplace"] });
registry.registerDomain({ domain: "project",  commands: { ...projectCmds, ...projectDepsCmds },  projectFree: ["project", "project:deps"] });
registry.registerDomain({ domain: "plugins",  commands: pluginCmds,  projectFree: ["plugin:list", "plugin:validate", "plugin:new", "plugin:reference"] });
registry.registerDomain({ domain: "ai-tools", commands: aiToolsCmds, projectFree: ["ai:list", "ai:validate", "ai:new", "ai:reference"] });
registry.setWildcard("reports", reportsCmds["report:*"]);

let pluginsRegistered = false;

// ── Plugin loading ──────────────────────────────────────────────────

function registerProjectPlugins(_project: ProjectContext): void {
	const plugins = loadPlugins(VAULT_ROOT, disk, shell);
	const validPlugins = plugins.filter((p) => p.valid);
	if (validPlugins.length === 0) return;

	const collisions = detectCollisions(validPlugins, new Set(registry.keys()));
	for (const msg of collisions) {
		log(`  ${YELLOW}Plugin warning: ${msg}${RESET}`);
	}

	// Collect all non-colliding plugin commands
	const builtinKeys = new Set(registry.keys());
	const pluginHandlers: Record<string, (flags: Record<string, string | boolean>, rawArgs: string[], command?: string, project?: ProjectContext) => void> = {};
	const projectFreeKeys: string[] = [];

	for (const plugin of validPlugins) {
		for (const [key, handler] of Object.entries(plugin.commands)) {
			if (builtinKeys.has(key)) continue; // skip collisions
			pluginHandlers[key] = handler;
			// Check if command is marked projectFree in manifest
			const cmdName = key.replace(`plugin:${plugin.manifest.name}:`, "");
			if (plugin.manifest.commands[cmdName]?.projectFree) {
				projectFreeKeys.push(key);
			}
		}
	}

	if (Object.keys(pluginHandlers).length > 0) {
		registry.registerDomain({
			domain: "plugins:project",
			commands: pluginHandlers,
			projectFree: projectFreeKeys,
		});
	}
}

type ProjectResolution =
	| { ok: true; project: ProjectContext | null }
	| { ok: false; name: string; available: string[] };

function resolveProjectContext(flags: Record<string, string | boolean>): ProjectResolution {
	const explicit = typeof flags.project === "string" ? flags.project : null;
	const projectName = explicit ?? getSelectedProject();
	if (!projectName) return { ok: true, project: null };

	// Validate explicit --project flag against known projects
	if (explicit) {
		const available = listProjects();
		if (!available.includes(explicit)) {
			return { ok: false, name: explicit, available };
		}
	}

	const project = initializeProject(projectName);
	if (project && !pluginsRegistered) {
		registerProjectPlugins(project);
		pluginsRegistered = true;
	}
	return { ok: true, project };
}

// ── Non-interactive dispatch ────────────────────────────────────────

async function handleCliArgs(): Promise<boolean> {
	const rawArgs = proc.argv();
	if (!rawArgs.length) return false;

	const { command, flags } = parseArgs(rawArgs);
	const resolution = resolveProjectContext(flags);

	if (!resolution.ok) {
		log(`\n  ${RED}Unknown project: "${resolution.name}"${RESET}`);
		if (resolution.available.length > 0) {
			log(`  ${DIM}Available projects:${RESET}`);
			for (const p of resolution.available) log(`    ${DIM}•${RESET} ${p}`);
		} else {
			log(`  ${DIM}No projects found. Run "flowti project" to create one.${RESET}`);
		}
		log();
		return true;
	}

	const project = resolution.project;
	const result = resolveCommand(command, flags, rawArgs, registry.handlers, registry.projectFreeSet, registry.wildcard, project);

	switch (result.action) {
		case "help":
			showHelp(result.section);
			return true;
		case "run":
			await result.handler(flags, rawArgs, result.command, result.project);
			return true;
		case "no-project":
			log(`\n  ${RED}No project selected.${RESET}`);
			log(`  ${DIM}Select a project first: flowti project${RESET}`);
			log(`  ${DIM}Or specify one:          flowti ${result.command} --project=<name>${RESET}\n`);
			return true;
		case "unknown":
			log(`\n  ${YELLOW}Unknown command: ${result.command}${RESET}`);
			log(`  ${DIM}Run "flowti help" for available commands.${RESET}\n`);
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
		pluginsRegistered = false;
	}
}

main().catch((err: unknown) => {
	if (err instanceof CliError) {
		error(`\n  ${RED}${formatError(err)}${RESET}\n`);
	} else {
		error(`\n  ${RED}Fatal error:${RESET}`, err);
	}
	proc.exit(1);
});
