/**
 * main.ts — Flowti CLI entrypoint (command-only, non-interactive).
 *
 * Invoke as:
 *   node <vault>/.flowti/bin/main.mjs <command> [flags...]
 *
 * Empty argv prints a short hint and exits with code 1.
 * See `docs/cli-command-surface.md` (regenerate via `flowti docs:cli-surface`).
 */

// ── Infrastructure ──────────────────────────────────────────────────

import { parseArgs } from "./infrastructure/args.js";
import { proc } from "./infrastructure/proc.js";
import { RESET, DIM, RED, YELLOW } from "./infrastructure/ui.js";
import { createDefaultDeps } from "./infrastructure/deps.js";
import { initializeDeps } from "./infrastructure/command-engine.js";

// ── Domain modules (pure business logic) ────────────────────────────

import { checkPrerequisites } from "./domain/onboarding/onboarding.js";
import { listProjects } from "./domain/project/project.js";
import { loadPlugins, detectCollisions } from "./domain/plugins/plugins.js";

import { showHelp } from "./ui/help.js";
import { disk } from "./infrastructure/filesystem.js";
import { shell } from "./infrastructure/shell.js";
import { paths } from "./infrastructure/paths.js";
import { VAULT_ROOT, PROJECTS_DIR, cliConfig } from "./infrastructure/config.js";
import { getSelectedProject } from "./infrastructure/state.js";
import { initializeProject } from "./domain/project/project-config.js";

// ── Command registry ────────────────────────────────────────────────

import type { ProjectContext } from "./infrastructure/types.js";
import { log, error, setLogLevel, setColorEnabled } from "./infrastructure/logger.js";
import { resolveCommand } from "./infrastructure/dispatch.js";
import { CommandRegistry } from "./infrastructure/command-registry.js";
import { CliError, formatError } from "./infrastructure/errors.js";
import { registerBuiltinDomains } from "./cli/register-builtin-domains.js";

const registry = new CommandRegistry();
registerBuiltinDomains(registry);

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

	const builtinKeys = new Set(registry.keys());
	const pluginHandlers: Record<string, (flags: Record<string, string | boolean>, rawArgs: string[], command?: string, project?: ProjectContext) => void> = {};
	const projectFreeKeys: string[] = [];

	for (const plugin of validPlugins) {
		for (const [key, handler] of Object.entries(plugin.commands)) {
			if (builtinKeys.has(key)) continue;
			pluginHandlers[key] = handler;
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

	if (explicit) {
		const available = listProjects(PROJECTS_DIR, { disk });
		if (!available.includes(explicit)) {
			return { ok: false, name: explicit, available };
		}
	}

	const project = initializeProject(projectName, PROJECTS_DIR, { disk, paths });
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

function printCommandOnlyHint(): void {
	log(`\n  ${YELLOW}Flowti CLI is command-only (no interactive menu).${RESET}`);
	log(`  ${DIM}Run:${RESET} flowti help`);
	log(`  ${DIM}Or:${RESET}  node .flowti/bin/main.mjs help\n`);
}

async function handleCliArgs(deps: import("./infrastructure/deps.js").CliDeps): Promise<boolean> {
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

	if (command === "agent:start") {
		const agentFlag = flags.agent ?? rawArgs[1];
		const agentName = String(agentFlag ?? "");
		if (!agentName) {
			log(`\n  ${RED}Error: --agent is required${RESET}\n`);
			proc.exit(1);
			return true;
		}

		const { createAgentProcessLoop } = await import("./domain/agents/agent-process-loop.js");
		const { createStdinLineReader, createStdoutLineWriter, getProcessPid, exitProcess } = await import("./infrastructure/agent-process-io.js");
		const session = createAgentProcessLoop({
			workerManager: deps.workerManager,
			worldState: deps.worldState,
			disk,
			paths,
			clock: deps.clock,
			vaultRoot: VAULT_ROOT,
			agentName,
			pid: getProcessPid(),
			lineReader: createStdinLineReader(),
			lineWriter: createStdoutLineWriter(),
			exit: exitProcess,
			dispatcher: deps.dispatcher,
		});
		session.start();
		return true;
	}

	const project = resolution.project;
	const result = resolveCommand(command, flags, rawArgs, registry.handlers, registry.projectFreeSet, registry.wildcard, project, registry.wildcardPrefix);

	switch (result.action) {
		case "help":
			showHelp(result.section, { disk, paths, log });
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

// ── Entry point ─────────────────────────────────────────────────────

async function main(): Promise<void> {
	const deps = createDefaultDeps(cliConfig.agents, VAULT_ROOT);
	initializeDeps(deps);

	deps.workerManager.spawnAll();

	checkPrerequisites(cliConfig.onboarding?.nodeMinVersion ?? 16, { shell, proc });

	const rawArgs = proc.argv();
	if (rawArgs.length === 0) {
		printCommandOnlyHint();
		proc.exit(1);
		return;
	}

	if (await handleCliArgs(deps)) return;

	printCommandOnlyHint();
	log(`  ${DIM}(No command matched your arguments.)${RESET}\n`);
	proc.exit(1);
}

main().catch((err: unknown) => {
	if (err instanceof CliError) {
		error(`\n  ${RED}${formatError(err)}${RESET}\n`);
	} else {
		error(`\n  ${RED}Fatal error:${RESET}`, err);
	}
	proc.exit(1);
});
