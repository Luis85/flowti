import type { WorkingMemory } from './bt-working-memory.js';
import type { BehaviorAgentDeps } from './behavior-agent-factory.js';
import type { AgentActor } from './agent-actor.js';
import type { PerceivedFacility, PerceivedAgent, PerceivedLocation } from '../../domain/systems/behavior-agent.js';
import type { WorldLocation } from '../../domain/schemas/location-schema.js';
import { NeedsComponent } from '../components/needs-component.js';
import { WalletComponent } from '../components/wallet-component.js';
import { InventoryComponent } from '../components/inventory-component.js';
import { TimeComponent } from '../components/time-component.js';
import { AttributesComponent } from '../components/attributes-component.js';
import { NEED_CRITICAL_THRESHOLDS } from '../../domain/schemas/ranges.js';
import { findFoodInInventory, FOOD_ITEMS, TRADE_GOODS } from '../../domain/systems/food-items.js';
import { isPriceStale } from '../../domain/systems/price-memory.js';
import { calculateReservationPrice } from '../../domain/systems/utility.js';
import { planSupplyRoute } from '../../domain/systems/cargo.js';
import type { FacilityData } from '../../domain/systems/cargo.js';

export interface ConditionMethods {
	IsHungry(): boolean;
	IsExhausted(): boolean;
	IsRecovering(): boolean;
	IsLonely(): boolean;
	NeedsCritical(): boolean;
	HasFood(): boolean;
	HasFoodReserve(): boolean;
	HasGold(amount: number): boolean;
	CanAffordFood(): boolean;
	AtLocation(type: string): boolean;
	NearLocation(type: string): boolean;
	NearAgent(): boolean;
	NearAgentClose(): boolean;
	IsDaytime(): boolean;
	IsNighttime(): boolean;
	IsWorkHours(): boolean;
	HasJob(): boolean;
	AtJobFacility(): boolean;
	FacilityHasStock(itemId: string): boolean;
	HasCargo(): boolean;
	CargoDestinationNearby(): boolean;
	FacilityNeedsSupply(): boolean;
	KnowsFoodSource(): boolean;
	HasNoJob(): boolean;
	OpenFacilityNearby(): boolean;
	OpenProductionFacilityNearby(): boolean;
	IsThirsty(): boolean;
	HasWater(): boolean;
	HasTradeGoods(): boolean;
	NeedsTools(): boolean;
	NeedsEquipment(): boolean;
	CanAffordItem(itemId: string): boolean;
	BetterPayAvailable(): boolean;
	KnowsSupplyRoute(): boolean;
}

export function createConditions(
	memory: WorkingMemory,
	actor: AgentActor,
	deps: BehaviorAgentDeps,
	resolveNearbyFacilities: () => PerceivedFacility[],
	resolveNearbyAgents: () => PerceivedAgent[],
	resolveNearbyLocations: () => PerceivedLocation[],
	getAtLocationData: () => WorldLocation | undefined,
	wakeOffset: number,
): ConditionMethods {
	const { config, worldEntity, tickCount } = deps;

	return {
		IsHungry(): boolean {
			return actor.get(NeedsComponent).state.hunger < config.needs.hunger_threshold;
		},

		IsExhausted(): boolean {
			const exhausted = actor.get(NeedsComponent).state.energy < config.needs.energy_threshold;
			if (exhausted) memory.recovering = true;
			return exhausted;
		},

		IsRecovering(): boolean {
			if (!memory.recovering) return false;
			const recoveredThreshold = config.needs.energy_threshold + config.needs.recovery_hysteresis;
			if (actor.get(NeedsComponent).state.energy >= recoveredThreshold) {
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

		HasFood(): boolean {
			return findFoodInInventory(actor.get(InventoryComponent).state.items) !== null;
		},

		HasFoodReserve(): boolean {
			const food = findFoodInInventory(actor.get(InventoryComponent).state.items);
			if (food === null) return false;
			return food.quantity > config.needs.food_reserve;
		},

		HasGold(amount: number): boolean {
			return actor.get(WalletComponent).state.gold >= amount;
		},

		CanAffordFood(): boolean {
			const staleTicks = config.economy.price_memory_stale_ticks;
			const tick = tickCount();
			let cheapestPrice = config.economy.food_price;
			for (const mem of memory.priceMemories) {
				if (FOOD_ITEMS.has(mem.itemId) && !isPriceStale(mem, tick, staleTicks)) {
					if (mem.price < cheapestPrice) cheapestPrice = mem.price;
				}
			}
			const gold = actor.get(WalletComponent).state.gold;
			if (gold < cheapestPrice) return false;

			const inventory = actor.get(InventoryComponent).state.items;
			const foodCount = inventory
				.filter(i => FOOD_ITEMS.has(i.item_id))
				.reduce((sum, i) => sum + i.quantity, 0);

			const reservationPrice = calculateReservationPrice({
				baseValue: config.economy.food_price,
				needLevel: actor.get(NeedsComponent).state.hunger,
				needThreshold: config.needs.hunger_threshold,
				currentStock: foodCount,
				walletGold: gold,
				urgencyMax: config.economy.reservation_urgency_max,
				stockFactor: config.economy.reservation_stock_factor,
				budgetCap: config.economy.reservation_budget_cap,
				budgetCapCritical: config.economy.reservation_budget_cap_critical,
			});
			return cheapestPrice <= reservationPrice;
		},

		AtLocation(type: string): boolean {
			const locData = getAtLocationData();
			return locData?.type === type;
		},

		NearLocation(type: string): boolean {
			return resolveNearbyLocations().some(l => l.type === type);
		},

		NearAgent(): boolean {
			return resolveNearbyAgents().length > 0;
		},

		NearAgentClose(): boolean {
			return resolveNearbyAgents().some(a => a.distance < config.perception.interaction_radius);
		},

		IsDaytime(): boolean {
			return worldEntity().get(TimeComponent).state.phase === 'day';
		},

		IsNighttime(): boolean {
			const phase = worldEntity().get(TimeComponent).state.phase;
			return phase === 'night' || phase === 'dusk';
		},

		IsWorkHours(): boolean {
			const phase = worldEntity().get(TimeComponent).state.phase;
			if (phase === 'day') return true;
			if (phase === 'dawn') {
				const time = worldEntity().get(TimeComponent).state;
				return time.tickInCycle >= config.day_night.dawn.start + wakeOffset;
			}
			return false;
		},

		HasJob(): boolean {
			return actor.job !== null;
		},

		AtJobFacility(): boolean {
			if (memory.atLocation === null || actor.job === null) return false;
			const facilities = resolveNearbyFacilities();
			return facilities.some(f =>
				f.id === memory.atLocation &&
				f.job === actor.job &&
				(f.workerId === null || f.workerId === actor.agentId),
			);
		},

		FacilityHasStock(itemId: string): boolean {
			return resolveNearbyFacilities().some(
				f => f.stock.some(s => s.item_id === itemId && s.quantity > 0),
			);
		},

		HasCargo(): boolean {
			return memory.haulCargo !== null;
		},

		CargoDestinationNearby(): boolean {
			if (memory.haulCargo === null) return false;
			return resolveNearbyLocations().some(l => l.id === memory.haulCargo!.destination);
		},

		FacilityNeedsSupply(): boolean {
			return resolveNearbyFacilities().some(f => f.hasUnmetInput);
		},

		KnowsFoodSource(): boolean {
			const staleTicks = config.economy.price_memory_stale_ticks;
			const tick = tickCount();
			for (const mem of memory.priceMemories) {
				if (FOOD_ITEMS.has(mem.itemId) && !isPriceStale(mem, tick, staleTicks)) {
					return true;
				}
			}
			return false;
		},

		HasNoJob(): boolean {
			return actor.job === null;
		},

		OpenFacilityNearby(): boolean {
			return resolveNearbyFacilities().some(f => f.workerId === null);
		},

		OpenProductionFacilityNearby(): boolean {
			return resolveNearbyFacilities().some(f => f.workerId === null && f.job !== '');
		},

		IsThirsty(): boolean {
			return actor.get(NeedsComponent).state.thirst < config.needs.thirst_threshold;
		},

		HasWater(): boolean {
			const inv = actor.get(InventoryComponent).state.items;
			return inv.some(i => i.item_id === 'waterskin' && (i.charges ?? 0) > 0);
		},

		HasTradeGoods(): boolean {
			return actor.get(InventoryComponent).state.items.some(i => TRADE_GOODS.has(i.item_id) && i.quantity > 0);
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

		CanAffordItem(itemId: string): boolean {
			const staleTicks = config.economy.price_memory_stale_ticks;
			const tick = tickCount();
			let cheapestPrice = Infinity;
			for (const mem of memory.priceMemories) {
				if (mem.itemId === itemId && !isPriceStale(mem, tick, staleTicks)) {
					if (mem.price < cheapestPrice) cheapestPrice = mem.price;
				}
			}
			if (cheapestPrice === Infinity) {
				cheapestPrice = config.economy.food_price; // fallback
			}
			return actor.get(WalletComponent).state.gold >= cheapestPrice;
		},

		BetterPayAvailable(): boolean {
			if (actor.job === null) return false;
			const facilities = resolveNearbyFacilities();
			const { jobs: jobsConfig } = deps.config;
			const baseline = jobsConfig.aptitude_baseline;
			const attrs = actor.get(AttributesComponent).state as unknown as Record<string, number>;

			// Current job effective wage
			const currentFacility = facilities.find(f => f.workerId === actor.agentId);
			const currentWage = currentFacility?.wage ?? 0;
			const currentJobDef = jobsConfig.definitions[actor.job];
			const currentApt = currentJobDef !== undefined ? (attrs[currentJobDef.primary_attribute] ?? baseline) : baseline;
			const currentEffective = currentWage * (currentApt / baseline);

			// Best available open position
			for (const f of facilities) {
				if (f.workerId !== null || f.job === '') continue;
				const jobDef = jobsConfig.definitions[f.job];
				const apt = jobDef !== undefined ? (attrs[jobDef.primary_attribute] ?? baseline) : baseline;
				if (f.wage * (apt / baseline) > currentEffective) return true;
			}
			return false;
		},

		KnowsSupplyRoute(): boolean {
			const locations = deps.getLocations();
			const facilityData = new Map<string, FacilityData>();
			for (const loc of locations) {
				if (loc.production === null) continue;
				facilityData.set(loc.id, {
					id: loc.id,
					output: loc.production.output,
					input: loc.production.input,
					region: loc.position.region ?? '',
				});
			}

			const route = planSupplyRoute(
				memory.knownLocations,
				facilityData,
				memory.currentRegion,
				new Map(), // regionGraph — empty for now, single-region maps
			);

			memory.supplyRoute = route;
			return route !== null;
		},
	};
}
