/**
 * Derive {@link DashboardAgent} rows from CLI `world-state.json` when
 * `agent-dashboard.json` is missing or empty — fixes Agent World showing
 * no characters despite agents existing only in world entities.
 */

import type { DashboardAgent, WorldState, WorldEntity } from "../data/types.js";

function mapEntityToDashboardAgent(entity: WorldEntity): DashboardAgent | null {
	if (entity.type !== "agent") return null;
	const c = entity.components ?? {};
	const identity = (c["identity"] ?? {}) as Record<string, unknown>;

	const domainFromRoot = typeof c["domain"] === "string" ? c["domain"] : undefined;
	const domainFromIdentity = typeof identity["domain"] === "string" ? (identity["domain"] as string) : undefined;
	const domain = domainFromRoot ?? domainFromIdentity;

	const statusRaw = c["status"];
	let status: DashboardAgent["status"] = "idle";
	if (typeof statusRaw === "string") {
		status = statusRaw === "busy" ? "busy" : statusRaw === "unassigned" ? "unassigned" : "idle";
	} else if (statusRaw && typeof statusRaw === "object" && statusRaw !== null && "state" in statusRaw) {
		const st = String((statusRaw as { state: string }).state);
		if (st === "busy" || st === "working" || st === "task-started") status = "busy";
		else if (st === "unassigned") status = "unassigned";
		else status = "idle";
	}

	const agentType = typeof c["agentType"] === "string" ? c["agentType"] : "ai";
	const persona = typeof identity["persona"] === "string" ? identity["persona"] : undefined;
	const mood = typeof identity["mood"] === "string" ? identity["mood"] : undefined;

	return {
		name: entity.id,
		agentType,
		domain,
		status,
		persona,
		mood,
	};
}

/** Build dashboard agents from world-state entities (type === "agent"). */
export function dashboardAgentsFromWorldState(state: WorldState | null | undefined): DashboardAgent[] {
	if (!state || typeof state !== "object" || !state.entities) return [];
	const list: DashboardAgent[] = [];
	for (const entity of Object.values(state.entities)) {
		const row = mapEntityToDashboardAgent(entity);
		if (row) list.push(row);
	}
	return list;
}
