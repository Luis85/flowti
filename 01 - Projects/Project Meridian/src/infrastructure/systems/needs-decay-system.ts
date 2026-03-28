import { SystemPriority, type GameSystem } from '../../domain/core/tick-scheduler.js';
import type { GameCoreDeps } from '../../domain/core/game-deps.js';
import { applyNeedsDecay, type NeedsModifiers } from '../../domain/systems/needs-decay.js';
import type { AgentActor } from '../entity/agent-actor.js';
import type { ModifierMap } from '../../domain/systems/trait-resolver.js';
import { NeedsComponent } from '../components/needs-component.js';
import { AttributesComponent } from '../components/attributes-component.js';
import { SocialComponent } from '../components/social-component.js';
import { BlackboardComponent } from '../components/blackboard-component.js';

export function createNeedsDecaySystem(
	entities: () => AgentActor[],
): GameSystem {
	return {
		name: 'NeedsDecaySystem',
		priority: SystemPriority.NEEDS_DECAY,

		execute(deps: GameCoreDeps): void {
			for (const entity of entities()) {
				const needs = entity.get(NeedsComponent);
				const attrs = entity.get(AttributesComponent);
				const social = entity.get(SocialComponent);
				const bb = entity.get(BlackboardComponent);

				const traitModifiers = bb.state.traitModifiers as ModifierMap | undefined;
				const needsMods = traitModifiers?.get('NeedsDecaySystem') as NeedsModifiers | undefined;

				const result = applyNeedsDecay(
					{
						state: needs.state,
						hungerAttribute: attrs.state.HT,
						energyAttribute: attrs.state.HT,
						socialAttribute: social.state.charisma,
						modifiers: needsMods ?? null,
					},
					deps.config.needs,
				);

				needs.state = result.state;
				needs.markDirty();

				for (const event of result.events) {
					deps.eventBus.emit({
						type: event.type,
						tick: deps.tickCount,
						wallClock: Date.now(),
						source: 'NeedsDecaySystem',
						payload: { agentId: entity.agentId, ...event },
					});
				}
			}
		},
	};
}
