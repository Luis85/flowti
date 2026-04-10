import type { ConditionContext } from './bt-action-helpers.js';
import type { ConditionMethods } from './bt-conditions.js';
import { NeedsComponent } from '../components/needs-component.js';
import { InventoryComponent } from '../components/inventory-component.js';
import { NEED_CRITICAL_THRESHOLDS } from '../../domain/schemas/ranges.js';

type SurvivalKeys = 'IsHungry' | 'IsThirsty' | 'IsExhausted' | 'IsRecovering' | 'IsLonely' | 'NeedsCritical' | 'NeedsTools' | 'NeedsEquipment' | 'IsSociallyCritical';

export function createSurvivalConditions(ctx: ConditionContext): Pick<ConditionMethods, SurvivalKeys> {
	const { actor, deps, memory } = ctx;
	const { config } = deps;

	return {
		IsHungry(): boolean {
			return actor.get(NeedsComponent).state.hunger < memory.personalThresholds.hunger;
		},

		IsExhausted(): boolean {
			const exhausted = actor.get(NeedsComponent).state.energy < memory.personalThresholds.energy;
			if (exhausted) memory.recovering = true;
			return exhausted;
		},

		IsRecovering(): boolean {
			if (!memory.recovering) return false;
			// Survival trumps recovery — let agent travel to find food/water
			const needs = actor.get(NeedsComponent).state;
			if (needs.hunger < NEED_CRITICAL_THRESHOLDS.hunger) return false;
			if (needs.thirst < NEED_CRITICAL_THRESHOLDS.thirst) return false;
			const recoveredThreshold = Math.min(memory.personalThresholds.energy + config.needs.recovery_hysteresis, 100);
			if (needs.energy >= recoveredThreshold) {
				memory.recovering = false;
				return false;
			}
			return true;
		},

		IsLonely(): boolean {
			return actor.get(NeedsComponent).state.social < config.needs.social_threshold;
		},

		NeedsCritical(): boolean {
			const needs = actor.get(NeedsComponent).state;
			return (
				needs.hunger < NEED_CRITICAL_THRESHOLDS.hunger ||
				needs.energy < NEED_CRITICAL_THRESHOLDS.energy ||
				needs.thirst < NEED_CRITICAL_THRESHOLDS.thirst
			);
		},

		IsSociallyCritical(): boolean {
			return actor.get(NeedsComponent).state.social < NEED_CRITICAL_THRESHOLDS.social;
		},

		IsThirsty(): boolean {
			return actor.get(NeedsComponent).state.thirst < memory.personalThresholds.thirst;
		},

		NeedsTools(): boolean {
			const inv = actor.get(InventoryComponent).state.items;
			const tools = inv.find(i => i.item_id === 'tools');
			return tools === undefined || tools.quantity === 0 || (tools.charges ?? 0) === 0;
		},

		NeedsEquipment(): boolean {
			const inv = actor.get(InventoryComponent).state.items;
			const equip = inv.find(i => i.item_id === 'equipment');
			return equip === undefined || equip.quantity === 0 || (equip.charges ?? 0) === 0;
		},
	};
}
