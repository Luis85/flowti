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

export interface DashboardProject {
	readonly name: string;
	readonly agents: string[];
}

export interface DashboardData {
	readonly agents: DashboardAgent[];
	readonly projects: DashboardProject[];
}

const DATA_URL = "data/agent-dashboard.json";

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
