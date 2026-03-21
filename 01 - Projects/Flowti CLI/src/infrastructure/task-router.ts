/**
 * task-router.ts — Priority-scored task-to-agent routing.
 */

import { scoreTaskFit } from "../domain/tasks/task-scoring.js";

export interface RoutingContext {
	readonly agents: readonly {
		name: string;
		domain?: string;
		agentType: string;
		attributes?: { str?: number; int?: number; wis?: number; cha?: number; dex?: number; con?: number };
	}[];
	readonly trustProfiles: Record<string, { operations: Record<string, string> }>;
	readonly ledger: { accounts: Record<string, { level: number }> };
	readonly activeTasks: Record<string, number>;
	readonly standingOrders: Record<string, number>;
}

export interface TaskRoutingRequest {
	readonly domain?: string;
	readonly requiredOperation?: string;
	readonly targetFolder?: string;
}

/** Maximum active tasks and standing orders allowed per level bracket. */
function capacityLimit(level: number): number {
	if (level <= 2) return 1;
	if (level <= 4) return 2;
	if (level <= 6) return 3;
	return 4;
}

/**
 * Return true if the agent has enough capacity to accept one more task.
 */
export function checkCapacity(agentLevel: number, activeTasks: number, activeStandingOrders: number): boolean {
	const limit = capacityLimit(agentLevel);
	return activeTasks < limit && activeStandingOrders < limit;
}

function hasTrustAuto(name: string, operation: string, ctx: RoutingContext): boolean {
	return ctx.trustProfiles[name]?.operations[operation] === "auto";
}

function freeSlots(name: string, ctx: RoutingContext): number {
	const level = ctx.ledger.accounts[name]?.level ?? 1;
	const limit = capacityLimit(level);
	return (limit - (ctx.activeTasks[name] ?? 0)) + (limit - (ctx.standingOrders[name] ?? 0));
}

function scoreAgent(
	agent: RoutingContext["agents"][number],
	task: TaskRoutingRequest,
	ctx: RoutingContext,
): number {
	let score = 0;

	if (task.domain && agent.domain === task.domain) score += 20;
	if (task.requiredOperation && hasTrustAuto(agent.name, task.requiredOperation, ctx)) score += 15;

	score += freeSlots(agent.name, ctx) * 10;
	score += scoreTaskFit(agent.attributes ?? {}, task);

	return score;
}

/**
 * Find the best eligible AI agent for a task using priority scoring.
 * Returns the agent name or null if no eligible agent exists.
 */
export function findEligibleAgent(task: TaskRoutingRequest, ctx: RoutingContext): string | null {
	const candidates = ctx.agents.filter((agent) => {
		if (agent.agentType !== "ai") return false;
		const level = ctx.ledger.accounts[agent.name]?.level ?? 1;
		const active = ctx.activeTasks[agent.name] ?? 0;
		const standing = ctx.standingOrders[agent.name] ?? 0;
		return checkCapacity(level, active, standing);
	});

	if (candidates.length === 0) return null;

	let best: { name: string; score: number } | null = null;
	for (const agent of candidates) {
		const score = scoreAgent(agent, task, ctx);
		if (best === null || score > best.score) {
			best = { name: agent.name, score };
		}
	}

	return best?.name ?? null;
}
