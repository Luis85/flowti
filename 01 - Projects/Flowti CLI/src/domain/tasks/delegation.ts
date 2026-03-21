import type { EconomyLedger } from "../economy/economy-types.js";
import type { TaskDefinition } from "./task-types.js";
import { getAccount, creditReward } from "../economy/economy-ledger.js";

const DELEGATION_CUT = 0.2;

/**
 * Check whether an agent can afford to delegate a task.
 * Returns allowed=true if the agent's coin balance covers the fee.
 */
export function canDelegate(
	ledger: EconomyLedger,
	agentName: string,
	delegationFee: number,
): { allowed: boolean; reason?: string } {
	const account = getAccount(ledger, agentName);
	if (account.coin < delegationFee) {
		return {
			allowed: false,
			reason: `Insufficient coin: ${account.coin} available, ${delegationFee} required`,
		};
	}
	return { allowed: true };
}

function pickOptionalTaskFields(baseDef: Partial<TaskDefinition>): Pick<TaskDefinition, "journeyId" | "completedAt"> {
	return {
		journeyId: baseDef.journeyId,
		completedAt: baseDef.completedAt,
	};
}

/**
 * Create a delegated task definition.
 * Sets type="delegated", creator=fromAgent, assignee=toAgent.
 */
export function createDelegatedTask(
	baseDef: Partial<TaskDefinition>,
	fromAgent: string,
	toAgent: string,
	clock: { iso(): string },
): TaskDefinition {
	return {
		id: baseDef.id ?? `delegated-${Date.now()}`,
		type: "delegated",
		title: baseDef.title ?? "Delegated task",
		creator: fromAgent,
		assignee: toAgent,
		priority: baseDef.priority ?? "normal",
		trustTier: baseDef.trustTier ?? "review",
		status: baseDef.status ?? "pending",
		reward: baseDef.reward ?? { xp: 0, coin: 0 },
		tags: baseDef.tags ?? [],
		createdAt: baseDef.createdAt ?? clock.iso(),
		...pickOptionalTaskFields(baseDef),
	};
}

/**
 * Award a management cut (20%) of the assignee's reward to the assigner.
 * Returns the updated ledger and the cut amount credited to the assigner.
 */
export function awardDelegationCut(
	ledger: EconomyLedger,
	assignerName: string,
	assigneeReward: { xp: number; coin: number },
): { ledger: EconomyLedger; cut: { xp: number; coin: number } } {
	const cut = {
		xp: Math.floor(assigneeReward.xp * DELEGATION_CUT),
		coin: Math.floor(assigneeReward.coin * DELEGATION_CUT),
	};
	const { ledger: updated } = creditReward(ledger, assignerName, cut);
	return { ledger: updated, cut };
}
