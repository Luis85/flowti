import { SystemPriority, type GameSystem } from '../../domain/core/tick-scheduler.js';
import type { GameCoreDeps } from '../../domain/core/game-deps.js';
import type { AgentActor } from '../entity/agent-actor.js';
import { extractLeafNode } from '../ui/bt-active-path.js';

export function createBehaviorTreeSystem(
	agents: () => AgentActor[],
): GameSystem {
	return {
		name: 'BehaviorTreeSystem',
		priority: SystemPriority.BEHAVIOR_TREE,
		execute(deps: GameCoreDeps): void {
			for (const agent of agents()) {
				agent.behaviorAgent.tickUnemployment();
				agent.behaviorAgent.btAction = null;
				// Always reset — forces evaluation from root every tick.
				// P-1 commitment guard catches committed agents before they re-evaluate work.
				agent.behaviorTree.reset();
				agent.behaviorTree.step();

				// Emit BT evaluation result for recording/debugging
				let leaf = 'unknown';
				let leafStatus = 'unknown';
				try {
					const details = agent.behaviorTree.getTreeNodeDetails();
					const result = extractLeafNode(details);
					leaf = result.name;
					leafStatus = result.state;
				} catch {
					// Tree may throw during initialization — use fallback values
				}
				deps.eventBus.emit({
					type: 'BtEvaluated',
					tick: deps.tickCount,
					wallClock: Date.now(),
					source: 'BehaviorTreeSystem',
					payload: {
						agentId: agent.agentId,
						leaf,
						leafStatus,
						action: agent.behaviorAgent.btAction,
						committedAction: agent.behaviorAgent.committedAction,
						commitmentTicks: agent.behaviorAgent.commitmentTicks,
					},
				});
			}
		},
	};
}
