/**
 * bt-tick.ts — Tick orchestration for behavior tree agents.
 *
 * Steps the tree once, collects emitted actions, forwards them
 * as AgentActions to the world state manager.
 * Domain-layer pure — receives all deps as arguments.
 */

import { stepTree, type BehaviourTree } from "./bt-service.js";
import type { AgentAction } from "../../data/types.js";
import type { BTAgentObject } from "./bt-agent.js";
import type { IClock, IWorldStateManager } from "./bt-types.js";

let tickSeq = 0;

export function btTick(
	tree: BehaviourTree,
	agent: BTAgentObject,
	worldState: IWorldStateManager,
	clock: IClock,
): AgentAction[] {
	stepTree(tree);
	tickSeq++;

	const emitted: AgentAction[] = [];

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
