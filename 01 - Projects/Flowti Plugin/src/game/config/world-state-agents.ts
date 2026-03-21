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

	// Behaviors
	let behaviors: readonly string[] | undefined;
	if (Array.isArray(c["behaviors"])) {
		const b = (c["behaviors"] as unknown[]).filter((x): x is string => typeof x === "string");
		if (b.length > 0) behaviors = b;
	}

	// Goals — world-state uses { name, priority } → DashboardAgent uses { text, priority: string }
	let goals: readonly { text: string; priority: string }[] | undefined;
	if (Array.isArray(c["goals"])) {
		const g = (c["goals"] as Array<{ name?: string; priority?: number }>)
			.filter((x) => typeof x.name === "string")
			.map((x) => ({ text: x.name!, priority: String(x.priority ?? 0) }));
		if (g.length > 0) goals = g;
	}

	// Skills
	let skills: readonly { name: string; level: string }[] | undefined;
	if (Array.isArray(c["skills"])) {
		const s = (c["skills"] as Array<{ name?: string; level?: string }>)
			.filter((x) => typeof x.name === "string" && typeof x.level === "string")
			.map((x) => ({ name: x.name!, level: x.level! }));
		if (s.length > 0) skills = s;
	}

	// Experience
	const experience = typeof c["experience"] === "number" ? c["experience"] : undefined;

	return {
		name: entity.id,
		agentType,
		domain,
		status,
		persona,
		mood,
		...(behaviors && { behaviors }),
		...(goals && { goals }),
		...(skills && { skills }),
		...(experience !== undefined && { experience }),
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
