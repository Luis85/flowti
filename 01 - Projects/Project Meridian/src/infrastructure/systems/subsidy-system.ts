import { SystemPriority, type GameSystem } from '../../domain/core/tick-scheduler.js';
import type { GameCoreDeps } from '../../domain/core/game-deps.js';
import type { Actor } from 'excalibur';
import { TimeComponent } from '../components/time-component.js';
import { EconomyComponent } from '../components/economy-component.js';
import { FacilityComponent } from '../components/facility-component.js';
import type { WorldLocation } from '../../domain/schemas/location-schema.js';

export function createSubsidySystem(
	worldEntity: () => Actor,
	getLocationActors: () => Map<string, Actor>,
	getLocations: () => WorldLocation[],
): GameSystem {
	return {
		name: 'SubsidySystem',
		priority: SystemPriority.SUBSIDY,
		execute(deps: GameCoreDeps): void {
			const entity = worldEntity();
			const time = entity.get(TimeComponent);
			if (!time.state.dayBoundaryThisTick) return;
			if (!entity.has(EconomyComponent)) return;

			const economy = entity.get(EconomyComponent);
			const locationActors = getLocationActors();
			const locationData = getLocations();

			const threshold = deps.config.economy.facility_subsidy_threshold;
			const subsidyAmount = deps.config.economy.facility_subsidy_per_day;

			for (const loc of locationData) {
				const locActor = locationActors.get(loc.id);
				if (locActor === undefined) continue;
				if (!locActor.has(FacilityComponent)) continue;
				const facility = locActor.get(FacilityComponent);
				if (facility.state.fund >= threshold) continue;
				if (economy.state.treasury < subsidyAmount) continue;

				facility.state = { ...facility.state, fund: facility.state.fund + subsidyAmount };
				facility.markDirty();

				economy.state = {
					...economy.state,
					treasury: economy.state.treasury - subsidyAmount,
					ledger: [
						...economy.state.ledger,
						{
							tick: deps.tickCount,
							type: 'subsidy' as const,
							from: 'treasury',
							to: loc.id,
							itemId: null,
							quantity: 0,
							gold: subsidyAmount,
						},
					],
				};
				economy.markDirty();

				deps.eventBus.emit({
					type: 'FacilitySubsidised',
					tick: deps.tickCount,
					wallClock: Date.now(),
					source: 'SubsidySystem',
					payload: { facilityId: loc.id, amount: subsidyAmount, newFund: facility.state.fund, treasuryRemaining: economy.state.treasury },
				});

				deps.eventBus.emit({
					type: 'GoldFlowed',
					tick: deps.tickCount,
					wallClock: Date.now(),
					source: 'SubsidySystem',
					payload: {
						category: 'transfer' as const,
						subcategory: 'subsidy',
						amount: subsidyAmount,
						fromEntity: 'treasury',
						toEntity: loc.id,
					},
				});
			}
		},
	};
}
