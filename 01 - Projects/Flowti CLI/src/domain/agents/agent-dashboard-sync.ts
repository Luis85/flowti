/**
 * agent-dashboard-sync.ts — Regenerate agent-dashboard.json and optionally build static dashboard assets.
 *
 * Replaces the former `flowti serve` preflight (no HTTP server).
 */

import type { CliDeps } from "../../infrastructure/deps.js";
import type { AgentsConfig, AgentsDashboardConfig } from "../../infrastructure/types.js";
import { exportAgentDashboardData, writeDashboardData } from "./agent-export.js";
import type { ProjectEntry } from "./agent-export.js";
import { listProjects } from "../project/project.js";
import { readProjectConfig } from "../project/project-config.js";

const DEFAULT_DASHBOARD_DIR = "agents";
const DATA_FILE = "data/agent-dashboard.json";

export type DashboardSyncDeps = Pick<CliDeps, "disk" | "paths" | "shell" | "log">;

export interface BuildResult {
	readonly ok: boolean;
	readonly error?: string;
}

export interface SyncAgentDashboardResult {
	readonly jsonPath: string;
	readonly agentCount: number;
	readonly projectCount: number;
	readonly staticBundle: "ok" | "skipped" | "failed";
	readonly staticError?: string;
}

function hasBuildOutput(outDir: string, deps: DashboardSyncDeps): boolean {
	return deps.disk.existsSync(deps.paths.join(outDir, "index.html"))
		&& deps.disk.existsSync(deps.paths.join(outDir, "dashboard.js"));
}

function ensureDependencies(dashboardPath: string, deps: DashboardSyncDeps): boolean {
	const nodeModules = deps.paths.join(dashboardPath, "node_modules");
	if (deps.disk.existsSync(nodeModules)) return true;

	deps.log("  Installing dashboard dependencies...");
	const exitCode = deps.shell.run("npm install", { cwd: dashboardPath, label: "dashboard install" });
	return exitCode === 0;
}

/** Build the ExcaliburJS dashboard bundle into `outDir` when enabled in project config (or output already exists). */
export function buildAgentDashboardStatic(
	cliProjectPath: string,
	outDir: string,
	agentsConfig: AgentsDashboardConfig | undefined,
	deps: DashboardSyncDeps,
): BuildResult {
	if (hasBuildOutput(outDir, deps)) return { ok: true };

	if (!agentsConfig?.dashboard) {
		return { ok: false, error: "Agent dashboard is not enabled in project config (agents.dashboard)." };
	}

	const dashboardDir = agentsConfig.dashboardDir ?? DEFAULT_DASHBOARD_DIR;
	const dashboardPath = deps.paths.join(cliProjectPath, dashboardDir);
	const buildScript = deps.paths.join(dashboardPath, "build.mjs");

	if (!deps.disk.existsSync(buildScript)) {
		return { ok: false, error: `Dashboard source not found at ${dashboardPath}. Cannot build.` };
	}

	if (!ensureDependencies(dashboardPath, deps)) {
		return { ok: false, error: "Failed to install dashboard dependencies." };
	}

	deps.log("  Building agent dashboard static bundle...");
	const exitCode = deps.shell.run(`node build.mjs --outdir="${outDir}"`, { cwd: dashboardPath, label: "dashboard build" });
	if (exitCode !== 0) {
		return { ok: false, error: "Dashboard build failed." };
	}

	return { ok: true };
}

/** Write `.flowti/agents/data/agent-dashboard.json` from current vault / project state. */
export function regenerateAgentDashboardJsonFile(
	rootDir: string,
	projectsDir: string,
	vaultRoot: string,
	vaultAgentsConfig: AgentsConfig | undefined,
	deps: Pick<CliDeps, "disk" | "paths" | "log">,
): { path: string; agentCount: number; projectCount: number } {
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
	return { path: outPath, agentCount: data.agents.length, projectCount: data.projects.length };
}

/** Regenerate JSON and best-effort static bundle (bundle skipped when not configured). */
export function syncAgentDashboardAssets(
	opts: {
		readonly rootDir: string;
		readonly cliProjectPath: string;
		readonly projectsDir: string;
		readonly vaultRoot: string;
		readonly projectAgentsConfig: AgentsDashboardConfig | undefined;
		readonly vaultAgentsConfig: AgentsConfig | undefined;
	},
	deps: DashboardSyncDeps,
): SyncAgentDashboardResult {
	const json = regenerateAgentDashboardJsonFile(
		opts.rootDir,
		opts.projectsDir,
		opts.vaultRoot,
		opts.vaultAgentsConfig,
		deps,
	);

	const build = buildAgentDashboardStatic(
		opts.cliProjectPath,
		opts.rootDir,
		opts.projectAgentsConfig,
		deps,
	);

	let staticBundle: SyncAgentDashboardResult["staticBundle"] = "ok";
	let staticError: string | undefined;
	if (!build.ok) {
		if (!opts.projectAgentsConfig?.dashboard && !hasBuildOutput(opts.rootDir, deps)) {
			staticBundle = "skipped";
		} else {
			staticBundle = "failed";
			staticError = build.error;
		}
	}

	return {
		jsonPath: json.path,
		agentCount: json.agentCount,
		projectCount: json.projectCount,
		staticBundle,
		staticError,
	};
}
