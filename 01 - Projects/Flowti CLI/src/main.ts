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
import { printBanner, clearScreen, RESET, DIM, RED, YELLOW, CYAN } from "./infrastructure/ui.js";
import { runMenu } from "./infrastructure/menu.js";
import { createDefaultDeps } from "./infrastructure/deps.js";
import { initializeDeps } from "./infrastructure/request-response.js";

// ── Domain modules (pure business logic) ────────────────────────────

import { checkPrerequisites } from "./domain/onboarding/onboarding.js";
import { startMenu, listProjects } from "./ui/menus/project-menu.js";
import { loadPlugins, detectCollisions } from "./domain/plugins/plugins.js";

// ── Controllers (command handlers) ──────────────────────────────────

import { showHelp } from "./ui/help.js";
import { commands as helpCmds } from "./controller/help.controller.js";
import { commands as infoCmds } from "./controller/info.controller.js";
import { commands as buildCmds } from "./controller/build.controller.js";
import { commands as devToolsCmds } from "./controller/devtools.controller.js";
import { commands as makeCmds } from "./controller/make.controller.js";
import { commands as reviewCmds } from "./controller/review.controller.js";
import { commands as publishCmds } from "./controller/publish.controller.js";
import { commands as reportsCmds } from "./controller/reports.controller.js";
import { commands as captureCmds } from "./controller/capture.controller.js";
import { commands as healthCmds } from "./controller/health.controller.js";
import { commands as eventsCmds } from "./controller/events.controller.js";
import { commands as scaffoldCmds } from "./controller/scaffold.controller.js";
import { commands as resourcesCmds } from "./controller/resources.controller.js";
import { commands as timelogCmds } from "./controller/timelog.controller.js";
import { commands as deliverablesCmds } from "./controller/deliverables.controller.js";
import { commands as raidCmds } from "./controller/raid.controller.js";
import { commands as requirementsCmds } from "./controller/requirements.controller.js";
import { commands as capaCmds } from "./controller/capa.controller.js";
import { commands as lifecycleCmds } from "./controller/lifecycle.controller.js";
import { commands as projectCmds } from "./controller/project.controller.js";
import { commands as projectDepsCmds } from "./ui/deps-display.js";
import { commands as pluginCmds } from "./controller/plugins.controller.js";
import { commands as aiToolsCmds } from "./controller/ai-tools.controller.js";
import { disk } from "./infrastructure/filesystem.js";
import { shell } from "./infrastructure/shell.js";
import { paths } from "./infrastructure/paths.js";
import { VAULT_ROOT } from "./infrastructure/config.js";
import { getSelectedProject, clearSelectedProject } from "./infrastructure/state.js";
import { initializeProject } from "./domain/project/project-config.js";

// ── Main menu builder ───────────────────────────────────────────────

import { buildProjectDetailMenu } from "./ui/mainMenu.js";
import { printProjectStatusBanner } from "./ui/project-status-banner.js";

// ── Command registry ────────────────────────────────────────────────

import type { ProjectContext } from "./infrastructure/types.js";
import { log, error, setLogLevel, setColorEnabled } from "./infrastructure/logger.js";
import { resolveCommand } from "./infrastructure/dispatch.js";
import { CommandRegistry } from "./infrastructure/command-registry.js";
import { CliError, formatError } from "./infrastructure/errors.js";
import { generateCompletions } from "./infrastructure/completions.js";

const registry = new CommandRegistry();
registry.registerDomain({ domain: "help",     commands: helpCmds,     projectFree: ["help"] });
registry.registerDomain({ domain: "completions", commands: {
	completions: (flags, rawArgs) => {
		const shellName = rawArgs[1] ?? (typeof flags.shell === "string" ? flags.shell : "bash");
		const script = generateCompletions(shellName, registry.keys());
		if (script) { log(script); } else { log(`Unknown shell: ${shellName}. Supported: bash, zsh, fish, powershell`); }
	},
}, projectFree: ["completions"] });
registry.registerDomain({ domain: "info",     commands: infoCmds });
registry.registerDomain({ domain: "build",    commands: buildCmds });
registry.registerDomain({ domain: "devtools", commands: devToolsCmds });
registry.registerDomain({ domain: "make",     commands: makeCmds });
registry.registerDomain({ domain: "review",   commands: reviewCmds });
registry.registerDomain({ domain: "publish",  commands: publishCmds });
registry.registerDomain({ domain: "reports",  commands: reportsCmds });
registry.registerDomain({ domain: "capture",  commands: captureCmds,  projectFree: ["capture:idea", "capture:note", "capture:search", "capture:import"] });
registry.registerDomain({ domain: "events",   commands: eventsCmds });
registry.registerDomain({ domain: "health",       commands: healthCmds });
registry.registerDomain({ domain: "resources",    commands: resourcesCmds });
registry.registerDomain({ domain: "timelog",      commands: timelogCmds });
registry.registerDomain({ domain: "deliverables", commands: deliverablesCmds });
registry.registerDomain({ domain: "raid",         commands: raidCmds });
registry.registerDomain({ domain: "requirements", commands: requirementsCmds });
registry.registerDomain({ domain: "capa",         commands: capaCmds });
registry.registerDomain({ domain: "lifecycle",     commands: lifecycleCmds });
registry.registerDomain({ domain: "scaffold", commands: scaffoldCmds, projectFree: ["scaffold:new", "scaffold:list", "scaffold:marketplace", "marketplace:export", "marketplace:import-bundle"] });
registry.registerDomain({ domain: "project",  commands: { ...projectCmds, ...projectDepsCmds },  projectFree: ["project", "project:deps"] });
registry.registerDomain({ domain: "plugins",  commands: pluginCmds,  projectFree: ["plugin:list", "plugin:validate", "plugin:new", "plugin:reference"] });
registry.registerDomain({ domain: "ai-tools", commands: aiToolsCmds, projectFree: ["ai:list", "ai:validate", "ai:new", "ai:reference", "ai:run"] });
registry.setWildcard("reports", reportsCmds["report:*"]);

let pluginsRegistered = false;

// ── Plugin loading ──────────────────────────────────────────────────

function registerProjectPlugins(_project: ProjectContext): void {
	const plugins = loadPlugins({ paths }, VAULT_ROOT, disk, shell);
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
		const available = listProjects({ disk });
		if (!available.includes(explicit)) {
			return { ok: false, name: explicit, available };
		}
	}

	const project = initializeProject(projectName, { disk, paths });
	if (project && !pluginsRegistered) {
		registerProjectPlugins(project);
		pluginsRegistered = true;
	}
	return { ok: true, project };
}

// ── Non-interactive dispatch ────────────────────────────────────────

function applyGlobalFlags(flags: Record<string, string | boolean>): void {
	if (flags.quiet) setLogLevel("quiet");
	else if (flags.verbose) setLogLevel("debug");
	if (flags["no-color"]) setColorEnabled(false);
}

async function handleCliArgs(): Promise<boolean> {
	const rawArgs = proc.argv();
	if (!rawArgs.length) return false;

	const { command, flags } = parseArgs(rawArgs);
	applyGlobalFlags(flags);
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
	clearScreen();
	const project = getSelectedProject();
	const ctx = project ? initializeProject(project, { disk, paths }) : null;
	const label = ctx?.config.name ?? project ?? "Unknown";

	log(`  ${DIM}Project:${RESET} ${CYAN}${label}${RESET}`);
	if (ctx?.pkg) {
		log(`  ${DIM}${ctx.pkg.name ?? ""}@${ctx.pkg.version ?? "?"}${RESET}`);
	}
	if (ctx) printProjectStatusBanner(ctx);
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
	// Initialize shared deps — controllers access them via req.deps
	initializeDeps(createDefaultDeps());

	checkPrerequisites({ shell, proc });

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
