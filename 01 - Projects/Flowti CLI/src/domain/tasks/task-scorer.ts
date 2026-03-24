import type { TaskEntry, TaskHistoryEntry } from "./task-dispatcher-types.js";
import type { TrustTier } from "../trust/trust-types.js";
import type { WorkerState } from "../agents/worker-types.js";

export interface AgentInfo {
	readonly name: string;
	readonly capabilities: readonly string[];
	readonly trustTier: TrustTier;
	readonly workerState: WorkerState;
	readonly onCooldown: boolean;
	readonly history: readonly TaskHistoryEntry[];
}

const TIER_ORDER: Record<TrustTier, number> = {
	supervised: 0,
	trusted: 1,
	autonomous: 2,
};

export function computeAffinity(
	history: readonly TaskHistoryEntry[],
	tags: readonly string[],
	type: string,
): number {
	const tagSet = new Set(tags);
	let score = 0;
	for (const entry of history) {
		for (const t of entry.tags) {
			if (tagSet.has(t)) score += 2;
		}
		if (entry.type === type) score += 1;
	}
	return score;
}

export function scoreAgents(
	agents: readonly AgentInfo[],
	task: TaskEntry,
): AgentInfo | null {
	const capSet = new Set(task.requiredCapabilities);
	const requiredTierLevel = TIER_ORDER[task.requiredAgentTier];

	const candidates: Array<{ agent: AgentInfo; affinity: number }> = [];

	for (const agent of agents) {
		if ([...capSet].some((c) => !agent.capabilities.includes(c))) continue;
		if (TIER_ORDER[agent.trustTier] < requiredTierLevel) continue;
		if (agent.workerState !== "idle" || agent.onCooldown) continue;

		const affinity = computeAffinity(agent.history, [...task.tags], task.type);
		candidates.push({ agent, affinity });
	}

	if (candidates.length === 0) return null;

	candidates.sort((a, b) =>
		b.affinity - a.affinity || a.agent.name.localeCompare(b.agent.name),
	);

	return candidates[0].agent;
}
