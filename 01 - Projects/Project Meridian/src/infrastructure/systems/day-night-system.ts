import { SystemPriority, type GameSystem } from '../../domain/core/tick-scheduler.js';
import type { GameCoreDeps } from '../../domain/core/game-deps.js';
import { advanceTime } from '../../domain/systems/day-night.js';
import type { Actor } from 'excalibur';
import { TimeComponent } from '../components/time-component.js';

export function createDayNightSystem(
	worldEntity: () => Actor,
): GameSystem {
	return {
		name: 'DayNightSystem',
		priority: SystemPriority.DAY_NIGHT,

		execute(deps: GameCoreDeps): void {
			const entity = worldEntity();
			const time = entity.get(TimeComponent);

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
		},
	};
}
