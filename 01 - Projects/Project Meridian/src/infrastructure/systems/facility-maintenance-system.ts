import { SystemPriority, type GameSystem } from '../../domain/core/tick-scheduler.js';
import type { GameCoreDeps } from '../../domain/core/game-deps.js';
import type { Actor } from 'excalibur';
import { TimeComponent } from '../components/time-component.js';
import { FacilityComponent } from '../components/facility-component.js';

const MIN_FUND_FOR_MAINTENANCE = 10;

export function createFacilityMaintenanceSystem(
	worldEntity: () => Actor,
	getLocationActors: () => Map<string, Actor>,
): GameSystem {
	return {
		name: 'FacilityMaintenanceSystem',
		priority: SystemPriority.FACILITY_MAINTENANCE,

		execute(deps: GameCoreDeps): void {
			const time = worldEntity().get(TimeComponent);
			if (!time.state.dayBoundaryThisTick) return;

			const maintenanceCost = deps.config.economy.facility_maintenance_per_day;

			for (const [locId, locActor] of getLocationActors()) {
				if (!locActor.has(FacilityComponent)) continue;
				const facility = locActor.get(FacilityComponent);
				if (facility.state.status === 'abandoned') continue;
				if (facility.state.fund <= MIN_FUND_FOR_MAINTENANCE) continue;

				const deduction = Math.min(maintenanceCost, facility.state.fund - MIN_FUND_FOR_MAINTENANCE);
				facility.state = { ...facility.state, fund: facility.state.fund - deduction };
				facility.markDirty();

				deps.eventBus.emit({
					type: 'GoldFlowed',
					tick: deps.tickCount,
					wallClock: Date.now(),
					source: 'FacilityMaintenanceSystem',
					payload: {
						category: 'sink' as const,
						subcategory: 'facility_maintenance',
						amount: deduction,
						fromEntity: locId,
						toEntity: null,
					},
				});
			}
		},
	};
}
