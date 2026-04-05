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
				// Always reset — forces evaluation from root every tick.
				// P-1 commitment guard catches committed agents before they re-evaluate work.
				agent.behaviorTree.reset();
				agent.behaviorTree.step();
			}
		},
	};
}
