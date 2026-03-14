/**
 * agent-export.ts — Export agent dashboard data as JSON.
 *
 * Produces a self-contained data file that the ExcaliburJS dashboard
 * consumes to render agents with their status and project assignments.
 *
 * Status derivation:
 *   busy       — agent is referenced in an active iteration (in-progress or in-review)
 *   idle       — agent is on a project roster but has no active iteration work
 *   unassigned — agent exists in vault but is not on any project roster
 */

import type { CliDeps } from "../../infrastructure/deps.js";
import type { AgentsConfig, ProjectConfig } from "../../infrastructure/types.js";
import type { AgentSummary } from "./agent-types.js";
import type { IterationSummary } from "../iterations/iteration-types.js";
import { listAgents } from "./agent-store.js";
import { listIterations } from "../iterations/iteration-store.js";

// ── Export types ─────────────────────────────────────────────────────

export type AgentStatus = "busy" | "idle" | "unassigned";

export interface DashboardAgent {
	readonly name: string;
	readonly agentType: string;
	readonly domain?: string;
	readonly status: AgentStatus;
	readonly project?: string;
	readonly iteration?: string;
	readonly phase?: string;
}

export interface DashboardProject {
	readonly name: string;
	readonly agents: string[];
}

export interface DashboardData {
	readonly agents: DashboardAgent[];
	readonly projects: DashboardProject[];
}

// ── Deps ─────────────────────────────────────────────────────────────

export type AgentExportDeps = Pick<CliDeps, "disk" | "paths">;

export interface ProjectEntry {
	readonly name: string;
	readonly path: string;
	readonly config: ProjectConfig;
}

// ── Status derivation ────────────────────────────────────────────────

const BUSY_STATUSES = new Set(["in-progress", "in-review"]);

/** Derive the status for a single agent given project rosters and active iterations. */
export function deriveAgentStatus(
	agentName: string,
	projectRosters: Map<string, string[]>,
	activeIterations: Map<string, IterationSummary[]>,
): { status: AgentStatus; project?: string; iteration?: string; phase?: string } {
	const lower = agentName.toLowerCase();

	for (const [projectName, roster] of projectRosters) {
		if (!roster.some((r) => r.toLowerCase() === lower)) continue;

		const iterations = activeIterations.get(projectName) ?? [];
		for (const iter of iterations) {
			if (!BUSY_STATUSES.has(iter.status)) continue;
			const referenced = iter.agents.some((a) => a.name.toLowerCase() === lower);
			if (referenced) {
				return { status: "busy", project: projectName, iteration: iter.name, phase: iter.status };
			}
		}

		return { status: "idle", project: projectName };
	}

	return { status: "unassigned" };
}

// ── Export ────────────────────────────────────────────────────────────

/**
 * Build the full dashboard data structure from vault agents and project configs.
 *
 * @param vaultRoot - Root path of the vault (for loading agents)
 * @param vaultAgentsConfig - Vault-level agents config (dir override)
 * @param projects - All project entries with their configs
 * @param deps - File system and path deps
 */
export function exportAgentDashboardData(
	vaultRoot: string,
	vaultAgentsConfig: AgentsConfig | undefined,
	projects: ProjectEntry[],
	deps: AgentExportDeps,
): DashboardData {
	const allAgents = listAgents(deps, vaultRoot, vaultAgentsConfig);

	const projectRosters = new Map<string, string[]>();
	const activeIterations = new Map<string, IterationSummary[]>();
	const dashboardProjects: DashboardProject[] = [];

	for (const project of projects) {
		const roster = project.config.management?.agents?.roster ?? [];
		if (roster.length > 0) {
			projectRosters.set(project.name, roster);
		}

		const iterations = listIterations(deps, project.path, project.config.management?.iterations);
		const active = iterations.filter((it) => BUSY_STATUSES.has(it.status));
		if (active.length > 0) {
			activeIterations.set(project.name, active);
		}

		dashboardProjects.push({ name: project.name, agents: roster });
	}

	const dashboardAgents: DashboardAgent[] = allAgents.map((agent) => {
		const derived = deriveAgentStatus(agent.name, projectRosters, activeIterations);
		return buildDashboardAgent(agent, derived);
	});

	return { agents: dashboardAgents, projects: dashboardProjects };
}

function buildDashboardAgent(
	agent: AgentSummary,
	derived: { status: AgentStatus; project?: string; iteration?: string; phase?: string },
): DashboardAgent {
	const entry: DashboardAgent = {
		name: agent.name,
		agentType: agent.agentType,
		domain: agent.domain,
		status: derived.status,
		project: derived.project,
		iteration: derived.iteration,
		phase: derived.phase,
	};
	return entry;
}

/** Write the dashboard JSON file to the given path. */
export function writeDashboardData(data: DashboardData, filePath: string, deps: Pick<AgentExportDeps, "disk" | "paths">): void {
	const dir = deps.paths.dirname(filePath);
	deps.disk.mkdirSync(dir, { recursive: true });
	deps.disk.writeFileSync(filePath, JSON.stringify(data, null, "\t"), "utf-8");
}
