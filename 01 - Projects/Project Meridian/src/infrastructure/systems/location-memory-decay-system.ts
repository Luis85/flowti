import { SystemPriority, type GameSystem } from '../../domain/core/tick-scheduler.js';
import type { GameCoreDeps } from '../../domain/core/game-deps.js';
import { applyLocationMemoryDecay } from '../../domain/systems/location-memory-decay.js';
import type { AgentActor } from '../entity/agent-actor.js';

export function createLocationMemoryDecaySystem(
	agents: () => AgentActor[],
): GameSystem {
	return {
		name: 'LocationMemoryDecaySystem',
		priority: SystemPriority.LOCATION_MEMORY_DECAY,

		execute(deps: GameCoreDeps): void {
			for (const agent of agents()) {
				const ba = agent.behaviorAgent;
				const result = applyLocationMemoryDecay(
					ba.locationMemories,
					deps.tickCount,
					deps.config.location_memory,
				);

				if (result.decayedCount > 0 || result.prunedCount > 0) {
					ba.locationMemories = result.entries;

					deps.eventBus.emit({
						type: 'LocationMemoryDecayed',
						tick: deps.tickCount,
						wallClock: Date.now(),
						source: 'LocationMemoryDecaySystem',
						payload: {
							agentId: agent.agentId,
							decayedCount: result.decayedCount,
							prunedCount: result.prunedCount,
							remaining: result.entries.length,
						},
					});
				}
			}
		},
	};
}
