/**
 * agent-export.ts — Export agent dashboard data as JSON.
 *
 * Produces a self-contained data file that the ExcaliburJS dashboard
 * consumes to render agents, project environments, and their state.
 */

import type { CliDeps } from "../../infrastructure/deps.js";
import type { AgentsConfig, ProjectConfig } from "../../infrastructure/types.js";
import type { AgentSummary, AgentAttributes, AgentSkill, AgentRelationship, SuggestedTask } from "./agent-types.js";
import type { IterationSummary } from "../iterations/iteration-types.js";
import { agentStore } from "./agent-store.js";
import { listIterations } from "../iterations/iteration-store.js";
import { listProjectComponents } from "../make/component/component-list.js";
import { listEvents } from "../events/event-catalog.js";
import { resourceStore } from "../resources/resource-store.js";
import { deliverableStore } from "../deliverables/deliverable-store.js";
import { raidStore } from "../raid/raid-store.js";
import { readLedger, getAccount } from "../economy/economy-ledger.js";
import { loadTrustProfile, deriveTier } from "../trust/trust-manager.js";
import { capabilitiesForLevel } from "../economy/leveling.js";

// ── Export types ─────────────────────────────────────────────────────

export type AgentStatus = "busy" | "idle" | "unassigned";

interface EconomySnapshot {
	readonly level: number;
	readonly xp: number;
	readonly coin: number;
	readonly tokens: number;
	readonly trustTier: "supervised" | "trusted" | "autonomous";
	readonly capabilities: readonly string[];
}

export interface DashboardAgent {
	readonly name: string;
	readonly agentType: string;
	readonly domain?: string;
	readonly status: AgentStatus;
	readonly project?: string;
	readonly iteration?: string;
	readonly phase?: string;
	readonly persona?: string;
	readonly mood?: string;
	readonly personality?: readonly string[];
	readonly attributes?: AgentAttributes;
	readonly skills?: readonly AgentSkill[];
	readonly relationships?: readonly AgentRelationship[];
	readonly suggestedTasks?: readonly SuggestedTask[];
	readonly goals?: readonly { name: string; text: string; priority: string }[];
	readonly behaviors?: readonly string[];
	readonly level?: number;
	readonly xp?: number;
	readonly coin?: number;
	readonly tokens?: number;
	readonly trustTier?: "supervised" | "trusted" | "autonomous";
	readonly capabilities?: readonly string[];
}

/** Lightweight component snapshot for the dashboard environment. */
export interface EnvComponent {
	readonly name: string;
	readonly kind: string;
	readonly status: string;
	readonly domain?: string;
}

/** Lightweight event snapshot for the dashboard environment. */
export interface EnvEvent {
	readonly name: string;
	readonly domain: string;
}

/** Iteration snapshot including scope items and assigned agents. */
export interface EnvIteration {
	readonly name: string;
	readonly number: number;
	readonly status: string;
	readonly goal: string;
	readonly startDate: string;
	readonly endDate: string;
	readonly agents: string[];
	readonly scopeItems: readonly { text: string; done: boolean }[];
}

/** Resource snapshot for the dashboard environment. */
export interface EnvResource {
	readonly name: string;
	readonly resourceType: string;
	readonly amount: number;
	readonly consumed: number;
}

/** Deliverable snapshot for the dashboard environment. */
export interface EnvDeliverable {
	readonly name: string;
	readonly status: string;
	readonly completionPct: number;
}

/** RAID item snapshot for the dashboard environment. */
export interface EnvRAIDItem {
	readonly name: string;
	readonly itemType: string;
	readonly status: string;
	readonly severity: string;
}

/** The full project world that agents live in. */
export interface ProjectEnvironment {
	readonly components: EnvComponent[];
	readonly events: EnvEvent[];
	readonly iterations: EnvIteration[];
	readonly resources: EnvResource[];
	readonly deliverables: EnvDeliverable[];
	readonly raidItems: EnvRAIDItem[];
}

export interface DashboardProject {
	readonly name: string;
	readonly agents: string[];
	readonly environment: ProjectEnvironment;
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

// ── Environment builder ──────────────────────────────────────────────

/** Build a ProjectEnvironment snapshot for a single project. */
export function buildProjectEnvironment(project: ProjectEntry, deps: AgentExportDeps): ProjectEnvironment {
	const mgmt = project.config.management;

	const components = listProjectComponents(project.path, deps).map((c) => ({
		name: c.name, kind: c.kind, status: c.status, domain: c.domain,
	}));

	const events = listEvents(deps, project.path).map((e) => ({
		name: e.name, domain: e.domain,
	}));

	const iterations = listIterations(deps, project.path, mgmt?.iterations).map((it) => ({
		name: it.name, number: it.number, status: it.status, goal: it.goal,
		startDate: it.startDate, endDate: it.endDate,
		agents: it.agents.map((a) => a.name),
		scopeItems: it.scopeItems.map((s) => ({ text: s.text, done: s.done })),
	}));

	const resources = resourceStore.list(deps, project.path, mgmt?.resources ? { dir: mgmt.resources.dir } : undefined).map((r) => ({
		name: r.name, resourceType: r.resourceType, amount: r.amount, consumed: r.consumed,
	}));

	const deliverables = deliverableStore.list(deps, project.path, mgmt?.deliverables ? { dir: mgmt.deliverables.dir } : undefined).map((d) => ({
		name: d.name, status: d.status, completionPct: d.completionPct,
	}));

	const raidItems = raidStore.list(deps, project.path, mgmt?.raid ? { dir: mgmt.raid.dir } : undefined).map((r) => ({
		name: r.name, itemType: r.itemType, status: r.status, severity: r.severity,
	}));

	return { components, events, iterations, resources, deliverables, raidItems };
}

// ── Export ────────────────────────────────────────────────────────────

/** Build the full dashboard data structure from vault agents and project configs. */
export function exportAgentDashboardData(
	vaultRoot: string,
	vaultAgentsConfig: AgentsConfig | undefined,
	projects: ProjectEntry[],
	deps: AgentExportDeps,
): DashboardData {
	const allAgents = agentStore.list(deps, vaultRoot, vaultAgentsConfig ? { dir: vaultAgentsConfig.dir } : undefined);

	const ledger = readLedger(deps, vaultRoot);

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

		const environment = buildProjectEnvironment(project, deps);
		dashboardProjects.push({ name: project.name, agents: roster, environment });
	}

	const dashboardAgents: DashboardAgent[] = allAgents.map((agent) => {
		const derived = deriveAgentStatus(agent.name, projectRosters, activeIterations);
		const account = getAccount(ledger, agent.name);
		const trust = loadTrustProfile(deps, vaultRoot, agent.name);
		const tier = deriveTier(trust);
		const caps = capabilitiesForLevel(account.level);
		const economy: EconomySnapshot = {
			level: account.level,
			xp: account.xp,
			coin: account.coin,
			tokens: account.tokens,
			trustTier: tier,
			capabilities: caps,
		};
		return buildDashboardAgent(agent, derived, economy);
	});

	return { agents: dashboardAgents, projects: dashboardProjects };
}

export function buildDashboardAgent(
	agent: AgentSummary,
	derived: { status: AgentStatus; project?: string; iteration?: string; phase?: string },
	economy?: EconomySnapshot,
): DashboardAgent {
	return {
		name: agent.name,
		agentType: agent.agentType,
		domain: agent.domain,
		status: derived.status,
		project: derived.project,
		iteration: derived.iteration,
		phase: derived.phase,
		persona: agent.persona,
		mood: agent.mood,
		personality: agent.personality,
		attributes: agent.attributes,
		skills: agent.skills.length > 0 ? agent.skills : undefined,
		relationships: agent.relationships,
		suggestedTasks: agent.suggestedTasks,
		goals: agent.goals?.map(g => ({ name: g.name, text: g.name, priority: String(g.priority ?? 0) })),
		behaviors: agent.behaviors,
		level: economy?.level,
		xp: economy?.xp,
		coin: economy?.coin,
		tokens: economy?.tokens,
		trustTier: economy?.trustTier,
		capabilities: economy?.capabilities ? [...economy.capabilities] : undefined,
	};
}

/** Write the dashboard JSON file to the given path. */
export function writeDashboardData(data: DashboardData, filePath: string, deps: Pick<AgentExportDeps, "disk" | "paths">): void {
	const dir = deps.paths.dirname(filePath);
	deps.disk.mkdirSync(dir, { recursive: true });
	deps.disk.writeFileSync(filePath, JSON.stringify(data, null, "\t"), "utf-8");
}
