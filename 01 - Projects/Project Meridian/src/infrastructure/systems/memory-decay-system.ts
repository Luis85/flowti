import { SystemPriority, type GameSystem } from '../../domain/core/tick-scheduler.js';
import type { GameCoreDeps } from '../../domain/core/game-deps.js';
import { applyMemoryDecay } from '../../domain/systems/memory-decay.js';
import type { AgentActor } from '../entity/agent-actor.js';
import { MemoryComponent } from '../components/memory-component.js';

export function createMemoryDecaySystem(
	entities: () => AgentActor[],
): GameSystem {
	return {
		name: 'MemoryDecaySystem',
		priority: SystemPriority.MEMORY,

		execute(deps: GameCoreDeps): void {
			for (const entity of entities()) {
				const memory = entity.get(MemoryComponent);
				const result = applyMemoryDecay(memory.state, deps.tickCount, deps.config.memory);

				if (result.decayedCount > 0 || result.prunedCount > 0) {
					memory.state = result.state;
					memory.markDirty();

					deps.eventBus.emit({
						type: 'MemoryDecayed',
						tick: deps.tickCount,
						wallClock: Date.now(),
						source: 'MemoryDecaySystem',
						payload: {
							agentId: entity.agentId,
							decayedCount: result.decayedCount,
							prunedCount: result.prunedCount,
						},
					});
				}
			}
		},
	};
}
