/**
 * Derive {@link DashboardAgent} rows from CLI `world-state.json` when
 * `agent-dashboard.json` is missing or empty — fixes Agent World showing
 * no characters despite agents existing only in world entities.
 */

import type { DashboardAgent, WorldState, WorldEntity } from "../data/types.js";

/** Resolve domain from entity components, checking root and identity. */
function resolveDomain(c: Record<string, unknown>, identity: Record<string, unknown>): string | undefined {
	const fromRoot = typeof c["domain"] === "string" ? c["domain"] : undefined;
	const fromIdentity = typeof identity["domain"] === "string" ? (identity["domain"] as string) : undefined;
	return fromRoot ?? fromIdentity;
}

/** Resolve agent status from a raw status component (string or object form). */
function resolveStatus(statusRaw: unknown): DashboardAgent["status"] {
	if (typeof statusRaw === "string") {
		return statusRaw === "busy" ? "busy" : statusRaw === "unassigned" ? "unassigned" : "idle";
	}
	if (statusRaw && typeof statusRaw === "object" && statusRaw !== null && "state" in statusRaw) {
		const st = String((statusRaw as { state: string }).state);
		if (st === "busy" || st === "working" || st === "task-started") return "busy";
		if (st === "unassigned") return "unassigned";
	}
	return "idle";
}

/** Extract a string array from an unknown component value. */
function extractStringArray(raw: unknown): readonly string[] | undefined {
	if (!Array.isArray(raw)) return undefined;
	const filtered = (raw as unknown[]).filter((x): x is string => typeof x === "string");
	return filtered.length > 0 ? filtered : undefined;
}

/** Extract goals array from component, converting { name, priority } to { text, priority }. */
function extractGoals(raw: unknown): readonly { text: string; priority: string }[] | undefined {
	if (!Array.isArray(raw)) return undefined;
	const mapped = (raw as Array<{ name?: string; priority?: number }>)
		.filter((x) => typeof x.name === "string")
		.map((x) => ({ text: x.name!, priority: String(x.priority ?? 0) }));
	return mapped.length > 0 ? mapped : undefined;
}

/** Extract skills array from component. */
function extractSkills(raw: unknown): readonly { name: string; level: string }[] | undefined {
	if (!Array.isArray(raw)) return undefined;
	const mapped = (raw as Array<{ name?: string; level?: string }>)
		.filter((x) => typeof x.name === "string" && typeof x.level === "string")
		.map((x) => ({ name: x.name!, level: x.level! }));
	return mapped.length > 0 ? mapped : undefined;
}

function mapEntityToDashboardAgent(entity: WorldEntity): DashboardAgent | null {
	if (entity.type !== "agent") return null;
	const c = entity.components ?? {};
	const identity = (c["identity"] ?? {}) as Record<string, unknown>;

	const domain = resolveDomain(c, identity);
	const status = resolveStatus(c["status"]);
	const agentType = typeof c["agentType"] === "string" ? c["agentType"] : "ai";
	const persona = typeof identity["persona"] === "string" ? identity["persona"] : undefined;
	const mood = typeof identity["mood"] === "string" ? identity["mood"] : undefined;
	const behaviors = extractStringArray(c["behaviors"]);
	const goals = extractGoals(c["goals"]);
	const skills = extractSkills(c["skills"]);
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
