import { SystemPriority, type GameSystem } from '../../domain/core/tick-scheduler.js';
import type { GameCoreDeps } from '../../domain/core/game-deps.js';
import { resolveTraitModifiers, type TraitDefinition } from '../../domain/systems/trait-resolver.js';
import type { AgentActor } from '../entity/agent-actor.js';
import { TraitsComponent } from '../components/traits-component.js';
import { BlackboardComponent } from '../components/blackboard-component.js';

export function createTraitResolverSystem(
	entities: () => AgentActor[],
	traitDefinitions: Record<string, TraitDefinition>,
): GameSystem {
	return {
		name: 'TraitResolverSystem',
		priority: SystemPriority.TRAIT_RESOLVER,

		execute(deps: GameCoreDeps): void {
			for (const entity of entities()) {
				const traits = entity.get(TraitsComponent);
				const bb = entity.get(BlackboardComponent);

				const result = resolveTraitModifiers(traits.traitIds, traitDefinitions);
				if (result.ok) {
					bb.state.traitModifiers = result.value;
				} else {
					deps.logger.warn('TraitResolverSystem', `Agent ${entity.agentId}: ${result.error.message}`);
					bb.state.traitModifiers = new Map();
				}
				bb.markDirty();
			}
		},
	};
}
