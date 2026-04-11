import type { ConditionContext } from './bt-action-helpers.js';
import type { ConditionMethods } from './bt-conditions.js';
import { NeedsComponent } from '../components/needs-component.js';
import { WalletComponent } from '../components/wallet-component.js';
import { InventoryComponent } from '../components/inventory-component.js';
import { findFoodInInventory, FOOD_ITEMS, TRADE_GOODS } from '../../domain/systems/food-items.js';
import { isPriceStale } from '../../domain/systems/price-memory.js';
import { calculateReservationPrice } from '../../domain/systems/utility.js';
import { planSupplyRoute } from '../../domain/systems/cargo.js';
import type { FacilityData } from '../../domain/systems/cargo.js';

type EconomyKeys =
	| 'HasGold' | 'HasFood' | 'HasFoodReserve' | 'HasWater' | 'HasTradeGoods'
	| 'CanAffordFood' | 'CanAffordItem' | 'KnowsFoodSource' | 'FacilityHasStock'
	| 'KnowsSupplyRoute' | 'HasCargo' | 'CargoDestinationNearby' | 'FacilityNeedsSupply' | 'IsOverloaded'
	| 'NeedsRepair' | 'HasTools';

export function createEconomyConditions(ctx: ConditionContext): Pick<ConditionMethods, EconomyKeys> {
	const { actor, deps, memory, resolveNearbyFacilities, resolveNearbyLocations } = ctx;
	const { config, tickCount } = deps;

	return {
		HasGold(amount: number): boolean {
			return actor.get(WalletComponent).state.gold >= amount;
		},

		HasFood(): boolean {
			return findFoodInInventory(actor.get(InventoryComponent).state.items) !== null;
		},

		HasFoodReserve(): boolean {
			const food = findFoodInInventory(actor.get(InventoryComponent).state.items);
			if (food === null) return false;
			return food.quantity > config.needs.food_reserve;
		},

		HasWater(): boolean {
			const inv = actor.get(InventoryComponent).state.items;
			// NEW: check water item first
			const waterItem = inv.find(i => i.item_id === 'water');
			if (waterItem !== undefined && waterItem.quantity > 0) return true;
			// LEGACY: fall back to waterskin charges
			return inv.some(i => i.item_id === 'waterskin' && (i.charges ?? 0) > 0);
		},

		HasTradeGoods(): boolean {
			return actor.get(InventoryComponent).state.items.some(i => TRADE_GOODS.has(i.item_id) && i.quantity > 0);
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
				const itemDef = config.items[itemId];
				cheapestPrice = itemDef?.baseValue ?? config.economy.food_price;
			}
			return actor.get(WalletComponent).state.gold >= cheapestPrice;
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

		FacilityHasStock(itemId: string): boolean {
			return resolveNearbyFacilities().some(
				f => f.stock.some(s => s.item_id === itemId && s.quantity > 0),
			);
		},

		KnowsSupplyRoute(): boolean {
			const locations = deps.getLocations();
			const knownSet = new Set(memory.knownLocations);
			const recipeRegistry = deps.getRecipeRegistry?.();
			const facilityData = new Map<string, FacilityData>();
			for (const loc of locations) {
				if (loc.active_recipe === null) continue;
				if (!knownSet.has(loc.id)) continue;
				const recipe = recipeRegistry?.get(loc.active_recipe);
				if (recipe === undefined) continue;
				const firstOutput = recipe.outputs[0];
				const firstInput = recipe.inputs[0];
				facilityData.set(loc.id, {
					id: loc.id,
					output: firstOutput !== undefined ? { item_id: firstOutput.item_id } : undefined,
					input: firstInput !== undefined ? { item_id: firstInput.item_id } : null,
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

		IsOverloaded(): boolean {
			const inv = actor.get(InventoryComponent).state.items;
			// Check EVERY item — using `find` would miss a stockpile if an earlier
			// trade-good entry (e.g. equipment) was under threshold while a later
			// entry (e.g. tools) is over. Recording 2026-04-11-1339 had Celia with
			// equipment(1) + tools(84) and the condition silently returned false.
			for (const item of inv) {
				if (FOOD_ITEMS.has(item.item_id) && item.quantity > config.needs.overload_food_threshold) return true;
				if (TRADE_GOODS.has(item.item_id) && item.quantity > config.economy.overload_goods_threshold) return true;
			}
			return false;
		},

		NeedsRepair(): boolean {
			const inv = actor.get(InventoryComponent).state.items;
			const equip = inv.find(i => i.item_id === 'equipment');
			if (equip === undefined || equip.quantity === 0) return false;
			return (equip.charges ?? 0) > 0 && (equip.charges ?? 0) < config.economy.equipment_repair_threshold;
		},

		HasTools(): boolean {
			const inv = actor.get(InventoryComponent).state.items;
			const tools = inv.find(i => i.item_id === 'tools');
			return tools !== undefined && tools.quantity > 0;
		},
	};
}
