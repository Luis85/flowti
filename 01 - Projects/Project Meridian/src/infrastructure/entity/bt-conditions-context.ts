import type { ConditionContext } from './bt-action-helpers.js';
import type { ConditionMethods } from './bt-conditions.js';
import { TimeComponent } from '../components/time-component.js';
import { MoodComponent } from '../components/mood-component.js';

type ContextKeys =
	| 'NearAgent' | 'NearAgentClose' | 'AtLocation' | 'NearLocation'
	| 'IsAtLeisure' | 'IsUsingService' | 'IsDaytime' | 'IsNighttime' | 'IsWorkHours'
	| 'ShouldSleep' | 'IsRestDay' | 'IsMoodLow' | 'IsDusk';

export function createContextConditions(ctx: ConditionContext): Pick<ConditionMethods, ContextKeys> {
	const { actor, deps, memory, resolveNearbyAgents, resolveNearbyLocations, getAtLocationData, wakeOffset, personalSleepOffset } = ctx;
	const { config, worldEntity } = deps;

	return {
		NearAgent(): boolean {
			return resolveNearbyAgents().length > 0;
		},

		NearAgentClose(): boolean {
			return resolveNearbyAgents().some(a => a.distance < config.perception.interaction_radius);
		},

		AtLocation(type: string): boolean {
			const locData = getAtLocationData();
			return locData?.facility_type === type;
		},

		NearLocation(type: string): boolean {
			return resolveNearbyLocations().some(l => l.facility_type === type);
		},

		IsAtLeisure(): boolean {
			return memory.btAction === 'leisure' && memory.atLocation === memory.leisureTarget;
		},

		IsUsingService(): boolean {
			return memory.currentServiceVisit !== null;
		},

		IsDaytime(): boolean {
			return worldEntity().get(TimeComponent).state.phase === 'day';
		},

		IsDusk(): boolean {
			return worldEntity().get(TimeComponent).state.phase === 'dusk';
		},

		IsNighttime(): boolean {
			const phase = worldEntity().get(TimeComponent).state.phase;
			return phase === 'night' || phase === 'dusk';
		},

		IsWorkHours(): boolean {
			if (this.IsRestDay()) return false;
			const time = worldEntity().get(TimeComponent).state;
			if (time.phase === 'day') return true;
			if (time.phase === 'dawn') {
				return time.tickInCycle >= config.day_night.dawn.start + wakeOffset;
			}
			return false;
		},

		ShouldSleep(): boolean {
			const time = worldEntity().get(TimeComponent).state;
			if (time.phase === 'night') return true;
			if (time.phase === 'dusk') {
				// High sleep debt: sleep immediately at dusk start (no offset)
				if (memory.sleepDebt > config.sleep_debt_max * 0.5) return true;
				return time.tickInCycle >= config.day_night.dusk.start + personalSleepOffset;
			}
			return false;
		},

		IsRestDay(): boolean {
			const time = worldEntity().get(TimeComponent).state;
			return time.dayCount > 0 && time.dayCount % config.rest_day_interval === 0;
		},

		IsMoodLow(): boolean {
			return actor.get(MoodComponent).state.value < config.leisure_mood_threshold;
		},
	};
}
