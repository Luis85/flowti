import { SystemPriority, type GameSystem } from '../../domain/core/tick-scheduler.js';
import type { GameCoreDeps } from '../../domain/core/game-deps.js';
import { applyNeedsDecay, type NeedsModifiers } from '../../domain/systems/needs-decay.js';
import type { AgentActor } from '../entity/agent-actor.js';
import { NeedsComponent } from '../components/needs-component.js';
import { AttributesComponent } from '../components/attributes-component.js';
import { SocialComponent } from '../components/social-component.js';
import { InventoryComponent } from '../components/inventory-component.js';

function getActivityModifiers(
	btAction: string | null,
	activityCosts: Record<string, { hunger: number; thirst: number; energy: number }>,
): NeedsModifiers {
	const costs = btAction !== null ? activityCosts[btAction] : undefined;
	if (costs === undefined) return {};
	return {
		hungerDecayScale: costs.hunger,
		thirstDecayScale: costs.thirst,
		energyDecayScale: costs.energy,
	};
}

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
				const ba = entity.behaviorAgent;

				// Merge trait modifiers with activity modifiers (activity takes precedence)
				const traitMods = ba.traitModifiers?.['NeedsDecaySystem'] as NeedsModifiers | undefined;
				const activityMods = getActivityModifiers(ba.btAction, deps.config.needs.activity_costs);
				const mergedMods: NeedsModifiers = {
					hungerDecayScale: activityMods.hungerDecayScale ?? traitMods?.hungerDecayScale,
					thirstDecayScale: activityMods.thirstDecayScale ?? traitMods?.thirstDecayScale,
					energyDecayScale: activityMods.energyDecayScale ?? traitMods?.energyDecayScale,
				};

				// Equipment decay reduction
				const inv = entity.get(InventoryComponent);
				const hasEquipment = inv.state.items.some(i => i.item_id === 'equipment' && (i.charges ?? 0) > 0);
				if (hasEquipment) {
					const reduction = 1 - deps.config.economy.equipment_decay_reduction;
					mergedMods.hungerDecayScale = (mergedMods.hungerDecayScale ?? 1) * reduction;
					mergedMods.thirstDecayScale = (mergedMods.thirstDecayScale ?? 1) * reduction;
					mergedMods.energyDecayScale = (mergedMods.energyDecayScale ?? 1) * reduction;
				}

				const result = applyNeedsDecay(
					{
						state: needs.state,
						hungerAttribute: attrs.state.HT,
						energyAttribute: attrs.state.HT,
						socialAttribute: social.state.charisma,
						thirstAttribute: attrs.state.HT,
						modifiers: mergedMods,
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
