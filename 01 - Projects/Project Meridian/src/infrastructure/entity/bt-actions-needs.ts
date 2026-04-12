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

export function createNeedsActions(ctx: ActionContext): Pick<ActionMethods, 'Eat' | 'Drink' | 'CollectProduced' | 'RepairWithTools' | 'SeekFood' | 'SeekBestFoodSource'> {
	const { memory, actor, deps, resolveNearbyFacilities, resolveNearbyLocations } = ctx;
	const { config, getLocationActors } = deps;

	return {
		Eat(): ActionResult {
			const food = findFoodInInventory([...actor.get(InventoryComponent).state.items]);
			if (food === null) return FAILED;
			beginAction(ctx, 'eat');
			return RUNNING;
		},

		Drink(): ActionResult {
			const inv = actor.get(InventoryComponent);

			// NEW: prefer consuming a water item (quantity-based)
			const waterItem = inv.state.items.find(i => i.item_id === 'water' && i.quantity > 0);
			if (waterItem === undefined) return FAILED;
			const newItems = inv.state.items
				.map(i => {
					if (i.item_id !== 'water') return { ...i };
					const newQty = i.quantity - 1;
					return newQty > 0 ? { ...i, quantity: newQty } : null;
				})
				.filter((i): i is NonNullable<typeof i> => i !== null);
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

		CollectProduced(): ActionResult {
			if (memory.atLocation === null) return FAILED;
			const locationActorMap = getLocationActors();
			const locActor = locationActorMap.get(memory.atLocation);
			if (locActor?.has(FacilityComponent) !== true) return FAILED;
			const facility = locActor.get(FacilityComponent);

			// Take first available stock item (generic — works for food, tools, any produced good)
			const stockItem = facility.state.stock.find(s => s.quantity > 0);
			if (stockItem === undefined) return FAILED;

			// Remove from facility stock
			const newStock = facility.state.stock
				.map(s => {
					if (s.item_id !== stockItem.item_id) return { ...s };
					const newQty = s.quantity - 1;
					return newQty > 0 ? { ...s, quantity: newQty } : null;
				})
				.filter((s): s is NonNullable<typeof s> => s !== null);
			facility.state = { ...facility.state, stock: newStock };
			facility.markDirty();

			// Add to agent inventory
			const inv = actor.get(InventoryComponent);
			const existing = inv.state.items.find(i => i.item_id === stockItem.item_id);
			const itemDef = config.items[stockItem.item_id];
			const newEntry: { item_id: string; quantity: number; charges?: number } = { item_id: stockItem.item_id, quantity: 1 };
			if (itemDef?.maxCharges !== undefined) newEntry.charges = itemDef.maxCharges;
			const newItems = existing !== undefined
				? inv.state.items.map(i => i.item_id === stockItem.item_id ? { ...i, quantity: i.quantity + 1 } : { ...i })
				: [...inv.state.items.map(i => ({ ...i })), newEntry];
			inv.state = { ...inv.state, items: newItems };
			inv.markDirty();

			beginAction(ctx, 'collect');
			return SUCCEEDED;
		},

		RepairWithTools(): ActionResult {
			const inv = actor.get(InventoryComponent);
			const tools = inv.state.items.find(i => i.item_id === 'tools');
			if (tools === undefined || tools.quantity === 0) return FAILED;

			const equip = inv.state.items.find(i => i.item_id === 'equipment');
			if (equip === undefined) return FAILED;

			const repairCharges = config.economy.tool_repair_charges;
			const maxCharges = config.items['equipment']?.maxCharges ?? repairCharges;

			const newItems = inv.state.items
				.map(i => {
					if (i.item_id === 'tools') return { ...i, quantity: i.quantity - 1 };
					if (i.item_id === 'equipment') return { ...i, charges: Math.min((i.charges ?? 0) + repairCharges, maxCharges) };
					return { ...i };
				})
				.filter(i => !(i.item_id === 'tools' && i.quantity === 0));

			inv.state = { ...inv.state, items: newItems };
			inv.markDirty();

			beginAction(ctx, 'repair_equipment');

			deps.eventBus.emit({
				type: 'EquipmentRepaired',
				tick: deps.tickCount(),
				wallClock: Date.now(),
				source: 'BehaviorAgent',
				payload: { agentId: actor.agentId, chargesAdded: repairCharges },
			});

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
			// Fallback: farm facilities (facility_type === 'farm')
			const foodLocs = resolveNearbyLocations().filter(l => l.facility_type === 'farm');
			if (foodLocs.length === 0) return FAILED;
			beginAction(ctx, 'seek_food');
			const nearest = findNearest(foodLocs)!;
			memory.movementTarget = { id: nearest.id, type: 'location' };
			if (memory.atLocation === nearest.id) return SUCCEEDED;
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
