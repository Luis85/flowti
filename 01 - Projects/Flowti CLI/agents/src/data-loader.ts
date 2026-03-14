/**
 * data-loader.ts — Fetch and parse agent-dashboard.json.
 */

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

// ── Project environment types ───────────────────────────────────────

export interface EnvComponent {
	readonly name: string;
	readonly kind: string;
	readonly status: string;
	readonly domain?: string;
}

export interface EnvEvent {
	readonly name: string;
	readonly domain: string;
}

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

export interface EnvResource {
	readonly name: string;
	readonly resourceType: string;
	readonly amount: number;
	readonly consumed: number;
}

export interface EnvDeliverable {
	readonly name: string;
	readonly status: string;
	readonly completionPct: number;
}

export interface EnvRAIDItem {
	readonly name: string;
	readonly itemType: string;
	readonly status: string;
	readonly severity: string;
}

export interface ProjectEnvironment {
	readonly components: EnvComponent[];
	readonly events: EnvEvent[];
	readonly iterations: EnvIteration[];
	readonly resources: EnvResource[];
	readonly deliverables: EnvDeliverable[];
	readonly raidItems: EnvRAIDItem[];
}

// ── Dashboard types ─────────────────────────────────────────────────

export interface DashboardProject {
	readonly name: string;
	readonly agents: string[];
	readonly environment: ProjectEnvironment;
}

export interface DashboardData {
	readonly agents: DashboardAgent[];
	readonly projects: DashboardProject[];
}

const DATA_URL = "data/agent-dashboard.json";

const EMPTY_ENVIRONMENT: ProjectEnvironment = {
	components: [], events: [], iterations: [],
	resources: [], deliverables: [], raidItems: [],
};

/** Fetch dashboard data from the server. Returns empty data on failure. */
export async function loadDashboardData(): Promise<DashboardData> {
	try {
		const response = await fetch(DATA_URL);
		if (!response.ok) return { agents: [], projects: [] };
		return await response.json() as DashboardData;
	} catch {
		return { agents: [], projects: [] };
	}
}

/** Get the environment for a project, with fallback for missing data. */
export function getProjectEnvironment(project: DashboardProject): ProjectEnvironment {
	return project.environment ?? EMPTY_ENVIRONMENT;
}
