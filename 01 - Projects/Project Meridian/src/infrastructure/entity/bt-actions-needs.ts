import type { ActionResult } from '../../domain/systems/behavior-agent.js';
import type { ActionMethods } from './bt-actions.js';
import type { ActionContext } from './bt-action-helpers.js';
import { SUCCEEDED, FAILED, RUNNING, beginAction } from './bt-action-helpers.js';
import { NeedsComponent } from '../components/needs-component.js';
import { InventoryComponent } from '../components/inventory-component.js';
import { FacilityComponent } from '../components/facility-component.js';
import { findFoodInInventory, FOOD_ITEMS } from '../../domain/systems/food-items.js';
import { isPriceStale } from '../../domain/systems/price-memory.js';
import { findNearest } from '../../domain/core/array-utils.js';

export function createNeedsActions(ctx: ActionContext): Pick<ActionMethods, 'Eat' | 'Drink' | 'Harvest' | 'Rest' | 'SeekWater' | 'FillWaterskin' | 'SeekFood' | 'SeekRest' | 'SeekBestFoodSource'> {
	const { memory, actor, deps, resolveNearbyFacilities, resolveNearbyLocations } = ctx;
	const { config, getLocationActors, getLocations } = deps;

	return {
		Eat(): ActionResult {
			const food = findFoodInInventory([...actor.get(InventoryComponent).state.items]);
			if (food === null) return FAILED;
			beginAction(ctx, 'eat');
			return RUNNING;
		},

		Drink(): ActionResult {
			const inv = actor.get(InventoryComponent);
			const waterskin = inv.state.items.find(i => i.item_id === 'waterskin' && (i.charges ?? 0) > 0);
			if (waterskin === undefined) return FAILED;
			const newItems = inv.state.items.map(i => {
				if (i.item_id !== 'waterskin') return { ...i };
				return { ...i, charges: (i.charges ?? 0) - 1 };
			});
			inv.state = { ...inv.state, items: newItems };
			inv.markDirty();
			const needs = actor.get(NeedsComponent);
			const recovery = config.needs.drink_recovery;
			const newThirst = Math.min(100, needs.state.thirst + recovery);
			needs.state = { ...needs.state, thirst: newThirst };
			needs.markDirty();
			beginAction(ctx, 'drink');
			return SUCCEEDED;
		},

		Harvest(): ActionResult {
			if (memory.atLocation === null) return FAILED;
			const locationActorMap = getLocationActors();
			const locActor = locationActorMap.get(memory.atLocation);
			if (locActor?.has(FacilityComponent) !== true) return FAILED;
			const facility = locActor.get(FacilityComponent);
			const foodStock = facility.state.stock.find(s => FOOD_ITEMS.has(s.item_id) && s.quantity > 0);
			if (foodStock === undefined) return FAILED;
			// Move food from facility stock to agent inventory
			const newStock = facility.state.stock
				.map(s => {
					if (s.item_id !== foodStock.item_id) return { ...s };
					const newQty = s.quantity - 1;
					return newQty > 0 ? { ...s, quantity: newQty } : null;
				})
				.filter((s): s is NonNullable<typeof s> => s !== null);
			facility.state = { ...facility.state, stock: newStock };
			facility.markDirty();
			const inv = actor.get(InventoryComponent);
			const existingItem = inv.state.items.find(i => i.item_id === foodStock.item_id);
			const newItems = existingItem !== undefined
				? inv.state.items.map(i => i.item_id === foodStock.item_id ? { ...i, quantity: i.quantity + 1 } : { ...i })
				: [...inv.state.items.map(i => ({ ...i })), { item_id: foodStock.item_id, quantity: 1 }];
			inv.state = { ...inv.state, items: newItems };
			inv.markDirty();
			beginAction(ctx, 'harvest');
			return SUCCEEDED;
		},

		Rest(): ActionResult {
			beginAction(ctx, 'rest');
			return RUNNING;
		},

		SeekWater(): ActionResult {
			const waterLocs = resolveNearbyLocations().filter(l => l.type === 'water');
			if (waterLocs.length === 0) return FAILED;
			beginAction(ctx, 'seek_water');
			const nearest = findNearest(waterLocs)!;
			memory.movementTarget = { id: nearest.id, type: 'location' };
			if (memory.atLocation === nearest.id) return SUCCEEDED;
			return RUNNING;
		},

		FillWaterskin(): ActionResult {
			const locData = memory.atLocation !== null ? getLocations().find(l => l.id === memory.atLocation) : undefined;
			if (locData?.type !== 'water') return FAILED;
			const inv = actor.get(InventoryComponent);
			const waterskin = inv.state.items.find(i => i.item_id === 'waterskin');
			if (waterskin === undefined) return FAILED;
			const maxCharges = 3; // Hardcoded until itemRegistry is available in BehaviorAgentDeps
			const newItems = inv.state.items.map(i => {
				if (i.item_id !== 'waterskin') return { ...i };
				return { ...i, charges: maxCharges };
			});
			inv.state = { ...inv.state, items: newItems };
			inv.markDirty();
			beginAction(ctx, 'fill_waterskin');
			return SUCCEEDED;
		},

		SeekFood(): ActionResult {
			// Prefer locations with food in stock (market, stocked farm)
			const stockedFacilities = resolveNearbyFacilities().filter(f =>
				f.stock.some(s => FOOD_ITEMS.has(s.item_id) && s.quantity > 0),
			);
			if (stockedFacilities.length > 0) {
				const nearest = findNearest(stockedFacilities)!;
				beginAction(ctx, 'seek_food');
				memory.movementTarget = { id: nearest.id, type: 'location' };
				if (memory.atLocation === nearest.id) return SUCCEEDED;
				return RUNNING;
			}
			// Fallback: food-type locations (farms)
			const foodLocs = resolveNearbyLocations().filter(l => l.type === 'food');
			if (foodLocs.length === 0) return FAILED;
			beginAction(ctx, 'seek_food');
			const nearest = findNearest(foodLocs)!;
			memory.movementTarget = { id: nearest.id, type: 'location' };
			if (memory.atLocation === nearest.id) return SUCCEEDED;
			return RUNNING;
		},

		SeekRest(): ActionResult {
			const restLocs = resolveNearbyLocations().filter(l => l.type === 'rest');
			if (restLocs.length > 0) {
				beginAction(ctx, 'seek_rest');
				const nearest = findNearest(restLocs)!;
				memory.movementTarget = { id: nearest.id, type: 'location' };
				if (memory.atLocation === nearest.id) return SUCCEEDED;
				return RUNNING;
			}

			// Fallback: search all locations (rest outside perception range, e.g. at night)
			const allLocations = getLocations();
			const restLoc = allLocations
				.filter(l => l.type === 'rest')
				.map(l => ({ id: l.id, dist: Math.hypot(l.position.x - actor.pos.x, l.position.y - actor.pos.y) }))
				.sort((a, b) => a.dist - b.dist)[0];
			if (restLoc === undefined) return FAILED;

			beginAction(ctx, 'seek_rest');
			memory.movementTarget = { id: restLoc.id, type: 'location' };
			if (memory.atLocation === restLoc.id) return SUCCEEDED;
			return RUNNING;
		},

		SeekBestFoodSource(): ActionResult {
			const staleTicks = config.economy.price_memory_stale_ticks;
			const tick = deps.tickCount();
			let cheapestLocation: string | null = null;
			let cheapestPrice = Infinity;

			// Single pass over memories — find cheapest non-stale food price across all items
			for (const mem of memory.priceMemories) {
				if (!FOOD_ITEMS.has(mem.itemId)) continue;
				if (isPriceStale(mem, tick, staleTicks)) continue;
				if (mem.price < cheapestPrice) {
					cheapestPrice = mem.price;
					cheapestLocation = mem.locationId;
				}
			}

			if (cheapestLocation === null) return FAILED;
			beginAction(ctx, 'seek_food');
			memory.movementTarget = { id: cheapestLocation, type: 'location' };
			if (memory.atLocation === cheapestLocation) return SUCCEEDED;
			return RUNNING;
		},
	};
}
