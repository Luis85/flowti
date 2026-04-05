import { SystemPriority, type GameSystem } from '../../domain/core/tick-scheduler.js';
import type { GameCoreDeps } from '../../domain/core/game-deps.js';
import type { AgentActor } from '../entity/agent-actor.js';

export function createBehaviorTreeSystem(
	agents: () => AgentActor[],
): GameSystem {
	return {
		name: 'BehaviorTreeSystem',
		priority: SystemPriority.BEHAVIOR_TREE,
		execute(_deps: GameCoreDeps): void {
			for (const agent of agents()) {
				agent.behaviorAgent.tickUnemployment();
				agent.behaviorAgent.btAction = null;
				// Reset before step — forces re-evaluation from root so higher-priority
				// branches (P0 critical needs) can preempt lower ones (P2 work).
				// Skip reset when committed — let P-1 guard handle continuation.
				if (agent.behaviorAgent.commitmentTicks <= 0) {
					agent.behaviorTree.reset();
				}
				agent.behaviorTree.step();
			}
		},
	};
}
