import { SystemPriority, type GameSystem } from '../../domain/core/tick-scheduler.js';
import type { GameCoreDeps } from '../../domain/core/game-deps.js';
import type { AgentActor } from '../entity/agent-actor.js';
import { extractLeafNode } from '../ui/bt-active-path.js';

export function createBehaviorTreeSystem(
	agents: () => AgentActor[],
): GameSystem {
	const previousActions = new Map<string, string | null>();
	const previousLeaves = new Map<string, string>();

	return {
		name: 'BehaviorTreeSystem',
		priority: SystemPriority.BEHAVIOR_TREE,
		execute(deps: GameCoreDeps): void {
			const agentList = agents();
			const currentAgentIds = new Set<string>();

			for (const agent of agentList) {
				currentAgentIds.add(agent.agentId);
				agent.behaviorAgent.tickUnemployment();
				agent.behaviorAgent.btAction = null;
				// Always reset — forces evaluation from root every tick.
				// P-1 commitment guard catches committed agents before they re-evaluate work.
				agent.behaviorTree.reset();
				agent.behaviorTree.step();

				// ── ActionChanged ──────────────────────────────────
				const newAction = agent.behaviorAgent.btAction;
				const prevAction = previousActions.get(agent.agentId) ?? null;
				if (newAction !== prevAction) {
					deps.eventBus.emit({
						type: 'ActionChanged',
						tick: deps.tickCount,
						wallClock: Date.now(),
						source: 'BehaviorTreeSystem',
						payload: {
							agentId: agent.agentId,
							previousAction: prevAction,
							newAction,
							preempted: prevAction !== null && newAction !== null && prevAction !== newAction,
							committedAction: agent.behaviorAgent.committedAction,
							commitmentTicks: agent.behaviorAgent.commitmentTicks,
						},
					});
				}
				previousActions.set(agent.agentId, newAction);

				// ── BtEvaluated (throttled — leaf change only) ────
				let leaf = 'unknown';
				let leafStatus = 'unknown';
				try {
					const details = agent.behaviorTree.getTreeNodeDetails();
					const result = extractLeafNode(details);
					leaf = result.name;
					leafStatus = result.state;
				} catch {
					// Tree may throw during initialization
				}

				const prevLeaf = previousLeaves.get(agent.agentId);
				if (leaf !== prevLeaf) {
					deps.eventBus.emit({
						type: 'BtEvaluated',
						tick: deps.tickCount,
						wallClock: Date.now(),
						source: 'BehaviorTreeSystem',
						payload: {
							agentId: agent.agentId,
							leaf,
							leafStatus,
							action: newAction,
							committedAction: agent.behaviorAgent.committedAction,
							commitmentTicks: agent.behaviorAgent.commitmentTicks,
						},
					});
				}
				previousLeaves.set(agent.agentId, leaf);
			}

			// Cleanup stale entries for removed agents
			for (const id of previousActions.keys()) {
				if (!currentAgentIds.has(id)) {
					previousActions.delete(id);
					previousLeaves.delete(id);
				}
			}
		},
	};
}
