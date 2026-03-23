/**
 * bt-tick.ts — Tick orchestration for behavior tree agents.
 *
 * Steps the tree once. BT actions write directly to the agent's
 * blackboard during tree evaluation — no collected actions, no
 * worldState bridge. Error recovery resets the tree and LLM slot.
 */

import { resetTree, stepTree, type BehaviourTree } from "./bt-service.js";
import type { BTAgentContext, BtAgentBase } from "./bt-types.js";
import type { AgentBlackboard } from "../../systems/blackboard.js";

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

/**
 * Step the behavior tree once. BT actions write to the blackboard
 * during evaluation. On error, the tree is reset and the blackboard
 * gets an error speech request.
 */
export function btTick(
	tree: BehaviourTree,
	agent: BtAgentBase,
	blackboard?: AgentBlackboard,
): void {
	try {
		stepTree(tree);
	} catch (err) {
		const raw = err instanceof Error ? err.message : String(err);
		console.warn(`[BT] ${agent.context.name}: ${raw}`);

		resetLlmSlotIfPresent(agent.context);

		try {
			resetTree(tree);
		} catch {
			/* mistreevous reset should not throw; ignore if it does */
		}

		// Write error to blackboard for presentation
		if (blackboard) {
			blackboard.intent = "idle";
			blackboard.intentDetail = "";
			const detail = raw.replace(/^error stepping tree:\s*/i, "").trim();
			const maxDetail = 140;
			const snippet = detail.length > maxDetail ? `${detail.slice(0, maxDetail)}…` : detail;
			blackboard.speechRequest = {
				text: `I hit a snag — ${snippet}`,
				kind: "thought",
			};
		}
	}
}
