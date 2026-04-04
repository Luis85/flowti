import { SystemPriority, type GameSystem } from '../../domain/core/tick-scheduler.js';
import type { GameCoreDeps } from '../../domain/core/game-deps.js';
import { advanceTime } from '../../domain/systems/day-night.js';
import type { Actor } from 'excalibur';
import { TimeComponent } from '../components/time-component.js';
import { EconomyComponent } from '../components/economy-component.js';
import type { AgentActor } from '../entity/agent-actor.js';
import type { WorldLocation } from '../../domain/schemas/location-schema.js';

export function createDayNightSystem(
	worldEntity: () => Actor,
	getAgents?: () => AgentActor[],
	_getLocationActors?: () => Map<string, Actor>,
	_getLocations?: () => WorldLocation[],
): GameSystem {
	let previousDayCount = -1;

	return {
		name: 'DayNightSystem',
		priority: SystemPriority.DAY_NIGHT,

		execute(deps: GameCoreDeps): void {
			const entity = worldEntity();
			const time = entity.get(TimeComponent);

			// Clear boundary flag at start of each tick
			if (time.state.dayBoundaryThisTick) {
				time.state = { ...time.state, dayBoundaryThisTick: false };
				time.markDirty();
			}

			const result = advanceTime(deps.tickCount, {
				ticks_per_day: deps.config.ticks_per_day,
				day_night: deps.config.day_night,
			});

			const oldPhase = time.state.phase;
			time.state = result.state;
			time.markDirty();

			if (result.phaseChanged) {
				deps.eventBus.emit({
					type: 'DayPhaseChanged',
					tick: deps.tickCount,
					wallClock: Date.now(),
					source: 'DayNightSystem',
					payload: {
						oldPhase,
						newPhase: result.state.phase,
						dayCount: result.state.dayCount,
					},
				});
			}

			// Day boundary — set flag and do treasury regen; other systems react to the flag
			const dayIncremented = result.state.dayCount > previousDayCount && previousDayCount >= 0;
			previousDayCount = result.state.dayCount;

			if (dayIncremented) {
				time.state = { ...time.state, dayBoundaryThisTick: true };
				time.markDirty();

				if (entity.has(EconomyComponent)) {
					const economy = entity.get(EconomyComponent);
					const agentList = getAgents?.() ?? [];
					const treasuryRegen = deps.config.economy.treasury_regen_per_agent_per_day * agentList.length;
					economy.state = { ...economy.state, treasury: economy.state.treasury + treasuryRegen };
					economy.markDirty();

					deps.eventBus.emit({
						type: 'GoldFlowed',
						tick: deps.tickCount,
						wallClock: Date.now(),
						source: 'DayNightSystem',
						payload: {
							category: 'faucet' as const,
							subcategory: 'treasury_regen',
							amount: treasuryRegen,
							fromEntity: null,
							toEntity: 'treasury',
						},
					});
				}
			}
		},
	};
}
