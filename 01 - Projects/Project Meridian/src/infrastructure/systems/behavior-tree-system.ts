import { SystemPriority, type GameSystem } from '../../domain/core/tick-scheduler.js';
import type { GameCoreDeps } from '../../domain/core/game-deps.js';
import type { AgentActor } from '../entity/agent-actor.js';

/** @deprecated Retained for movement-system.ts compatibility — will be removed in D3. */
export const JOURNEY_SENTINEL = '__journey__';

export function createBehaviorTreeSystem(
	agents: () => AgentActor[],
): GameSystem {
	return {
		name: 'BehaviorTreeSystem',
		priority: SystemPriority.BEHAVIOR_TREE,
		execute(_deps: GameCoreDeps): void {
			for (const agent of agents()) {
				agent.behaviorTree.step();
			}
		},
	};
}
