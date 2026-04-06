import type { ActionResult } from '../../domain/systems/behavior-agent.js';
import type { ActionMethods } from './bt-actions.js';
import type { ActionContext } from './bt-action-helpers.js';
import { SUCCEEDED, FAILED, RUNNING, beginAction } from './bt-action-helpers.js';
import { WalletComponent } from '../components/wallet-component.js';
import { NeedsComponent } from '../components/needs-component.js';
import { MoodComponent } from '../components/mood-component.js';
import { AttributesComponent } from '../components/attributes-component.js';

export function createLeisureActions(ctx: ActionContext): Pick<ActionMethods, 'ChooseLeisure' | 'SeekLeisureTarget' | 'Leisure' | 'Idle' | 'Wander'> {
	const { memory, actor, deps, resolveNearbyLocations } = ctx;
	const { getLocations } = deps;

	return {
		ChooseLeisure(): ActionResult {
			const locations = getLocations();
			const gold = actor.get(WalletComponent).state.gold;
			const needs = actor.get(NeedsComponent).state;
			const moodValue = actor.get(MoodComponent).state.value;
			const attrComp = actor.get(AttributesComponent);
			const baseline = deps.config.jobs.aptitude_baseline;
			const knownSet = new Set(memory.knownLocations);
			const nearbyIds = new Set(resolveNearbyLocations().map(l => l.id));

			const candidates: { id: string; score: number }[] = [];

			for (const loc of locations) {
				if (loc.leisure === null) continue;
				if (!knownSet.has(loc.id) && !nearbyIds.has(loc.id)) continue;
				if (loc.leisure.cost > gold) continue;

				let needWeight = 0;
				if (loc.leisure.effects.social > 0) {
					needWeight += (100 - needs.social) / 100 * loc.leisure.effects.social;
				}
				if (loc.leisure.effects.mood > 0) {
					const moodNeed = (100 - Math.max(0, Math.min(200, moodValue + 100)) / 2) / 100;
					needWeight += moodNeed * loc.leisure.effects.mood;
				}
				if (loc.leisure.effects.energy > 0) {
					needWeight += (100 - needs.energy) / 100 * loc.leisure.effects.energy;
				}
				if (loc.leisure.effects.skill_xp > 0) {
					needWeight += loc.leisure.effects.skill_xp * 5;
				}

				let attrBonus = 0;
				if (loc.leisure.attribute_bonus !== null) {
					attrBonus = attrComp.getByName(loc.leisure.attribute_bonus) / baseline * 3;
				}

				const dist = Math.hypot(loc.position.x - actor.pos.x, loc.position.y - actor.pos.y);
				const distPenalty = dist / 100;

				candidates.push({ id: loc.id, score: needWeight + attrBonus - distPenalty });
			}

			if (candidates.length === 0) return FAILED;
			candidates.sort((a, b) => b.score - a.score);
			memory.leisureTarget = candidates[0]!.id;
			beginAction(ctx, 'choose_leisure');
			return SUCCEEDED;
		},

		SeekLeisureTarget(): ActionResult {
			if (memory.leisureTarget === null) return FAILED;
			beginAction(ctx, 'seek_leisure');
			memory.movementTarget = { id: memory.leisureTarget, type: 'location' };
			if (memory.atLocation === memory.leisureTarget) return SUCCEEDED;
			return RUNNING;
		},

		Leisure(): ActionResult {
			if (memory.leisureTarget === null || memory.atLocation !== memory.leisureTarget) return FAILED;
			const loc = getLocations().find(l => l.id === memory.leisureTarget);
			if (loc?.leisure === null || loc?.leisure === undefined) return FAILED;

			// Use beginAction first (sets btAction, clears stale commitment from other actions)
			beginAction(ctx, 'leisure');
			// Override commitment with location-specific duration (not config-driven — varies per location)
			if (memory.commitmentTicks <= 0) {
				memory.commitmentTicks = loc.leisure.ticks_per_visit;
				memory.committedAction = 'leisure';
			}
			return RUNNING;
		},

		/** Available for custom BTs — not used in the default tree set. */
		Idle(): ActionResult {
			beginAction(ctx, 'idle');
			return RUNNING;
		},

		Wander(): ActionResult {
			beginAction(ctx, 'wander');
			// Pick a random location to wander toward — enables exploration and discovery
			if (memory.movementTarget === null) {
				const allLocs = getLocations();
				if (allLocs.length > 0) {
					const idx = Math.floor(Math.random() * allLocs.length);
					const target = allLocs[idx];
					if (target !== undefined) {
						memory.movementTarget = { id: target.id, type: 'location' };
					}
				}
			}
			return RUNNING;
		},
	};
}
