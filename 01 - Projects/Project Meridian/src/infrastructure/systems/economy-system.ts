import { SystemPriority, type GameSystem } from '../../domain/core/tick-scheduler.js';
import type { GameCoreDeps } from '../../domain/core/game-deps.js';
import { shouldRecalculate, recalculateFacilityPrices, type FacilityItemContext } from '../../domain/systems/economy.js';
import { getDemandRate, createDemandTracker, recordConsumption, type DemandTracker } from '../../domain/systems/demand-tracker.js';
import { FacilityComponent } from '../components/facility-component.js';
import type { WorldLocation } from '../../domain/schemas/location-schema.js';
import type { Item } from '../../domain/schemas/item-schema.js';
import type { Actor } from 'excalibur';
import FlatQueue from 'flatqueue';

export function createEconomySystem(
	locations: () => WorldLocation[],
	getLocationActors: () => Map<string, Actor>,
	itemRegistry: () => Map<string, Item>,
): GameSystem {
	const demandTracker: DemandTracker = createDemandTracker(0);
	const recalcQueue = new FlatQueue<string>();
	let initialized = false;

	return {
		name: 'EconomySystem',
		priority: SystemPriority.ECONOMY,

		execute(deps: GameCoreDeps): void {
			const locationList = locations();
			const locationActorMap = getLocationActors();
			const items = itemRegistry();
			const config = deps.config.economy;

			if (!initialized) {
				for (const loc of locationList) {
					const ft = loc.facility_type !== undefined ? deps.getFacilityTypeRegistry().get(loc.facility_type) : undefined;
					if (loc.production !== null || loc.type === 'market' || ft?.kind === 'production' || ft?.id === 'market_stall') {
						recalcQueue.push(loc.id, deps.tickCount);
					}
				}
				demandTracker.windowSize = config.demand_window_ticks;
				initialized = true;
			}

			// Record consumption from completed purchases for demand tracking
			const purchases = deps.eventBus.history({ type: 'PurchaseComplete' })
				.filter(e => e.tick === deps.tickCount);
			for (const e of purchases) {
				const itemId = e.payload.itemId;
				if (typeof itemId === 'string') {
					recordConsumption(demandTracker, itemId, 1, deps.tickCount);
				}
			}

			while (recalcQueue.peek() !== undefined && shouldRecalculate(deps.tickCount, recalcQueue.peekValue()!)) {
				const facilityId = recalcQueue.pop()!;
				const locActor = locationActorMap.get(facilityId);
				if (locActor === undefined) {
					recalcQueue.push(facilityId, deps.tickCount + config.recalculation_interval_ticks);
					continue;
				}

				const facility = locActor.get(FacilityComponent);
				const facilityItems: FacilityItemContext[] = facility.state.stock.map(s => {
					const item = items.get(s.item_id);
					return {
						itemId: s.item_id,
						baseValue: item?.baseValue ?? 5,
						category: item?.category ?? 'trade_goods',
						stock: s.quantity,
					};
				});

				const demandRates: Record<string, number> = {};
				for (const fi of facilityItems) {
					demandRates[fi.itemId] = getDemandRate(demandTracker, fi.itemId, deps.tickCount);
				}

				const prices = recalculateFacilityPrices({
					facilityId,
					items: facilityItems,
					demandRates,
					locationHops: 0,
					pipelineModifiers: [],
					elasticityMap: config.elasticity,
					clampMin: config.price_clamp_min,
					clampMax: config.price_clamp_max,
				});

				facility.state = { ...facility.state, currentPrices: prices };
				facility.markDirty();

				recalcQueue.push(facilityId, deps.tickCount + config.recalculation_interval_ticks);
			}
		},
	};
}
