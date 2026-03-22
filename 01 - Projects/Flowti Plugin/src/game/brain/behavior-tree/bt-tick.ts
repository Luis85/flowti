/**
 * bt-tick.ts — Tick orchestration for behavior tree agents.
 *
 * Steps the tree once, collects emitted actions, forwards them
 * as AgentActions to the world state manager.
 * Domain-layer pure — receives all deps as arguments.
 */

import { resetTree, stepTree, type BehaviourTree } from "./bt-service.js";
import type { AgentAction } from "../../data/types.js";
import type { BTAgentContext, BtAgentBase, IClock, IWorldStateManager } from "./bt-types.js";

let tickSeq = 0;

function normalizeStepErrorMessage(message: string): string {
	return message.replace(/^error stepping tree:\s*/i, "").trim();
}

function resetLlmSlotIfPresent(context: BtAgentBase["context"]): void {
	if (!("llmSlot" in context)) return;
	const ctx = context as BTAgentContext;
	const slot = ctx.llmSlot;
	if (slot.process) {
		try {
			slot.process.kill();
		} catch {
			/* ignore */
		}
	}
	slot.state = "idle";
	slot.process = null;
	slot.result = null;
}

export function btTick(
	tree: BehaviourTree,
	agent: BtAgentBase,
	worldState: IWorldStateManager,
	clock: IClock,
): AgentAction[] {
	tickSeq++;

	const emitted: AgentAction[] = [];

	try {
		stepTree(tree);
	} catch (err) {
		const raw = err instanceof Error ? err.message : String(err);
		const detail = normalizeStepErrorMessage(raw);

		console.warn(`[BT] ${agent.context.name}: ${raw}`);

		agent.collectedActions.length = 0;
		resetLlmSlotIfPresent(agent.context);

		try {
			resetTree(tree);
		} catch {
			/* mistreevous reset should not throw; ignore if it does */
		}

		const action: AgentAction = {
			id: `bt-${agent.context.name}-${tickSeq}-err`,
			agentName: agent.context.name,
			timestamp: clock.iso(),
			type: "error",
			data: {
				summary: "I hit a snag in my plan — I'll try again next tick.",
				detail,
			},
		};
		worldState.emitAction(action);
		emitted.push(action);
		return emitted;
	}

	for (const collected of agent.collectedActions) {
		const action: AgentAction = {
			id: `bt-${agent.context.name}-${tickSeq}-${emitted.length}`,
			agentName: agent.context.name,
			timestamp: clock.iso(),
			type: collected.type as AgentAction["type"],
			data: collected.data,
		};
		worldState.emitAction(action);
		emitted.push(action);
	}

	agent.collectedActions.length = 0;
	return emitted;
}
