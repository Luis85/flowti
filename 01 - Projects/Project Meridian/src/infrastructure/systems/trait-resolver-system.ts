import { SystemPriority, type GameSystem } from '../../domain/core/tick-scheduler.js';
import type { GameCoreDeps } from '../../domain/core/game-deps.js';
import { resolveTraitModifiers, type TraitDefinition } from '../../domain/systems/trait-resolver.js';
import type { AgentActor } from '../entity/agent-actor.js';
import { TraitsComponent } from '../components/traits-component.js';

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
				const ba = entity.behaviorAgent;

				const result = resolveTraitModifiers(traits.traitIds, traitDefinitions);
				if (result.ok) {
					ba.traitModifiers = result.value;
				} else {
					deps.logger.warn('TraitResolverSystem', `Agent ${entity.agentId}: ${result.error.message}`);
					ba.traitModifiers = {};
				}
			}
		},
	};
}
