/**
 * dashboard-service.ts — Agent dashboard lifecycle management.
 *
 * Manages the background HTTP server for the ExcaliburJS agent dashboard.
 * Follows the storybook-browser.ts pattern: module-level singleton for
 * the active server handle, with start/stop/isRunning functions.
 */

import type { CliDeps } from "../../infrastructure/deps.js";
import type { AgentsDashboardConfig, AgentsConfig, ProjectConfig } from "../../infrastructure/types.js";
import { startServer, openInBrowser } from "./static-server.js";
import type { ServerHandle } from "./static-server.js";
import { exportAgentDashboardData, writeDashboardData } from "../agents/agent-export.js";
import type { ProjectEntry } from "../agents/agent-export.js";
import { listProjects } from "../project/project.js";
import { readProjectConfig } from "../project/project-config.js";

// ── Types ────────────────────────────────────────────────────────────

export interface DashboardState {
	readonly url: string;
	readonly port: number;
	readonly dir: string;
}

export type DashboardDeps = Pick<CliDeps, "disk" | "paths" | "shell" | "log">;

// ── Singleton ────────────────────────────────────────────────────────

let activeHandle: ServerHandle | null = null;
let activeState: DashboardState | null = null;

export function isDashboardRunning(): boolean {
	return activeHandle !== null;
}

export function getDashboardState(): DashboardState | null {
	return activeState;
}

export function stopDashboard(log: (msg: string) => void): void {
	if (activeHandle) {
		activeHandle.close();
		activeHandle = null;
		activeState = null;
		log("\n  Dashboard server stopped.\n");
	} else {
		log("\n  Dashboard is not running.\n");
	}
}

// ── Build + data generation ──────────────────────────────────────────

const DEFAULT_DASHBOARD_DIR = "agents";
const DATA_FILE = "data/agent-dashboard.json";

export interface BuildResult {
	readonly ok: boolean;
	readonly error?: string;
}

/** Check whether the build output is present in the output directory. */
function hasBuildOutput(outDir: string, deps: DashboardDeps): boolean {
	return deps.disk.existsSync(deps.paths.join(outDir, "index.html"))
		&& deps.disk.existsSync(deps.paths.join(outDir, "dashboard.js"));
}

/** Install npm dependencies if node_modules is missing. Returns true on success. */
function ensureDependencies(dashboardPath: string, deps: DashboardDeps): boolean {
	const nodeModules = deps.paths.join(dashboardPath, "node_modules");
	if (deps.disk.existsSync(nodeModules)) return true;

	deps.log("  Installing dashboard dependencies...");
	const exitCode = deps.shell.run("npm install", { cwd: dashboardPath, label: "dashboard install" });
	return exitCode === 0;
}

/** Build the ExcaliburJS dashboard if enabled and source exists. */
export function buildDashboard(
	cliProjectPath: string,
	outDir: string,
	agentsConfig: AgentsDashboardConfig | undefined,
	deps: DashboardDeps,
): BuildResult {
	if (!agentsConfig?.dashboard) return { ok: false, error: "Agent dashboard is not enabled." };

	// If build output already exists, skip rebuild
	if (hasBuildOutput(outDir, deps)) return { ok: true };

	const dashboardDir = agentsConfig.dashboardDir ?? DEFAULT_DASHBOARD_DIR;
	const dashboardPath = deps.paths.join(cliProjectPath, dashboardDir);
	const buildScript = deps.paths.join(dashboardPath, "build.mjs");

	if (!deps.disk.existsSync(buildScript)) {
		return { ok: false, error: `Dashboard source not found at ${dashboardPath}. Cannot build.` };
	}

	if (!ensureDependencies(dashboardPath, deps)) {
		return { ok: false, error: "Failed to install dashboard dependencies." };
	}

	deps.log("  Building agent dashboard...");
	const exitCode = deps.shell.run(`node build.mjs --outdir="${outDir}"`, { cwd: dashboardPath, label: "dashboard build" });
	if (exitCode !== 0) {
		return { ok: false, error: "Dashboard build failed." };
	}

	return { ok: true };
}

/** Regenerate agent-dashboard.json from vault state. */
export function regenerateDashboardData(
	rootDir: string,
	projectsDir: string,
	vaultRoot: string,
	vaultAgentsConfig: AgentsConfig | undefined,
	deps: Pick<CliDeps, "disk" | "paths" | "log">,
): void {
	const projectNames = listProjects(projectsDir, deps);
	const entries: ProjectEntry[] = [];
	for (const name of projectNames) {
		const projectPath = deps.paths.join(projectsDir, name);
		const { config } = readProjectConfig(projectPath, deps);
		if (config) entries.push({ name, path: projectPath, config });
	}

	const data = exportAgentDashboardData(vaultRoot, vaultAgentsConfig, entries, deps);
	const outPath = deps.paths.join(rootDir, DATA_FILE);
	writeDashboardData(data, outPath, deps);
	deps.log(`Regenerated ${DATA_FILE} (${data.agents.length} agents, ${data.projects.length} projects)`);
}

// ── Start ────────────────────────────────────────────────────────────

export interface StartDashboardOptions {
	readonly port: number;
	readonly rootDir: string;
	readonly cliProjectPath: string;
	readonly projectsDir: string;
	readonly vaultRoot: string;
	readonly projectConfig: ProjectConfig | undefined;
	readonly vaultAgentsConfig: AgentsConfig | undefined;
}

/** Start the dashboard server. Returns the dashboard state or null on failure. */
export async function startDashboardServer(opts: StartDashboardOptions, deps: DashboardDeps): Promise<DashboardState | null> {
	if (activeHandle) {
		deps.log(`\n  Dashboard already running at ${activeState?.url}\n`);
		return activeState;
	}

	const buildResult = buildDashboard(opts.cliProjectPath, opts.rootDir, opts.projectConfig?.agents, deps);
	if (!buildResult.ok) {
		deps.log(`\n  ${buildResult.error}\n`);
		return null;
	}

	regenerateDashboardData(opts.rootDir, opts.projectsDir, opts.vaultRoot, opts.vaultAgentsConfig, deps);

	const handle = await startServer({ port: opts.port, dir: opts.rootDir }, {
		disk: deps.disk,
		paths: deps.paths,
		shell: deps.shell,
		log: deps.log,
	});

	activeHandle = handle;
	activeState = { url: handle.url, port: opts.port, dir: opts.rootDir };

	openInBrowser(handle.url, deps.shell);

	return activeState;
}
