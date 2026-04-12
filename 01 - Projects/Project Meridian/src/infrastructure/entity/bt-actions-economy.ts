import type { ActionResult } from '../../domain/systems/behavior-agent.js';
import type { ActionMethods } from './bt-actions.js';
import type { ActionContext } from './bt-action-helpers.js';
import { SUCCEEDED, FAILED, RUNNING, beginAction } from './bt-action-helpers.js';
import { WalletComponent } from '../components/wallet-component.js';
import { InventoryComponent } from '../components/inventory-component.js';
import { FacilityComponent } from '../components/facility-component.js';
import { FOOD_ITEMS, TRADE_GOODS } from '../../domain/systems/food-items.js';
import { findNearest } from '../../domain/core/array-utils.js';

export function createEconomyActions(ctx: ActionContext): Pick<ActionMethods, 'SellAtMarket' | 'Buy' | 'BuyItem' | 'SeekMarket' | 'SeekWell'> {
	const { memory, actor, deps, resolveNearbyFacilities, resolveNearbyLocations } = ctx;
	const { config, getLocationActors, getLocations, tickCount, eventBus } = deps;

	return {
		SellAtMarket(): ActionResult {
			if (memory.atLocation === null) return FAILED;
			const locData = getLocations().find(l => l.id === memory.atLocation);
			if (locData?.facility_type !== 'market_stall') return FAILED;
			const inv = actor.get(InventoryComponent);
			// Prefer the most-overloaded sellable item — dump the excess first.
			// Previously `find` picked the first sellable (usually food) even when
			// the agent was actually overloaded on tools or equipment.
			const foodThreshold = config.needs.overload_food_threshold;
			const goodsThreshold = config.economy.overload_goods_threshold;
			const candidates = inv.state.items.filter(i =>
				(FOOD_ITEMS.has(i.item_id) || TRADE_GOODS.has(i.item_id)) && i.quantity > 0,
			);
			if (candidates.length === 0) return FAILED;
			const overloadAmount = (itemId: string, qty: number): number =>
				FOOD_ITEMS.has(itemId) ? qty - foodThreshold : qty - goodsThreshold;
			// Sort by overload amount descending — most overloaded first
			candidates.sort((a, b) => overloadAmount(b.item_id, b.quantity) - overloadAmount(a.item_id, a.quantity));
			const sellable = candidates[0]!;
			const locationActorMap = getLocationActors();
			const marketActor = locationActorMap.get(memory.atLocation);
			if (marketActor === undefined) return FAILED;
			const facility = marketActor.get(FacilityComponent);
			const price = facility.state.currentPrices?.[sellable.item_id] ?? config.economy.food_price;
			if (facility.state.fund < price) return FAILED;
			const newItems = inv.state.items
				.map(i => {
					if (i.item_id !== sellable.item_id) return { ...i };
					const newQty = i.quantity - 1;
					return newQty > 0 ? { ...i, quantity: newQty } : null;
				})
				.filter((i): i is NonNullable<typeof i> => i !== null);
			inv.state = { ...inv.state, items: newItems };
			inv.markDirty();
			const hasItem = facility.state.stock.some(s => s.item_id === sellable.item_id);
			const newStock = hasItem
				? facility.state.stock.map(s => s.item_id === sellable.item_id ? { ...s, quantity: s.quantity + 1 } : { ...s })
				: [...facility.state.stock.map(s => ({ ...s })), { item_id: sellable.item_id, quantity: 1 }];
			facility.state = { ...facility.state, stock: newStock, fund: facility.state.fund - price };
			facility.markDirty();
			const wallet = actor.get(WalletComponent);
			wallet.state = { ...wallet.state, gold: wallet.state.gold + price };
			wallet.markDirty();

			// Emit GoldFlowed for monetary policy tracking
			eventBus.emit({
				type: 'GoldFlowed',
				tick: tickCount(),
				wallClock: Date.now(),
				source: 'SellAtMarket',
				payload: {
					category: 'transfer' as const,
					subcategory: 'sale',
					amount: price,
					fromEntity: memory.atLocation,
					toEntity: actor.agentId,
				},
			});

			beginAction(ctx, 'sell');
			return SUCCEEDED;
		},

		Buy(): ActionResult {
			if (memory.atLocation === null) return FAILED;
			const atFacility = resolveNearbyFacilities().find(f =>
				f.id === memory.atLocation && f.stock.some(s => FOOD_ITEMS.has(s.item_id) && s.quantity > 0),
			);
			if (atFacility === undefined) return FAILED;
			beginAction(ctx, 'buy');
			memory.buyTargetItem = null;
			return SUCCEEDED;
		},

		BuyItem(itemId: string): ActionResult {
			if (memory.atLocation === null) return FAILED;
			const atFacility = resolveNearbyFacilities().find(f =>
				f.id === memory.atLocation && f.stock.some(s => s.item_id === itemId && s.quantity > 0),
			);
			if (atFacility === undefined) return FAILED;
			beginAction(ctx, 'buy');
			memory.buyTargetItem = itemId;
			return SUCCEEDED;
		},

		SeekMarket(): ActionResult {
			const marketLocs = resolveNearbyLocations().filter(l => l.facility_type === 'market_stall');
			if (marketLocs.length === 0) return FAILED;

			beginAction(ctx, 'seek_market');
			const nearest = findNearest(marketLocs)!;
			memory.movementTarget = { id: nearest.id, type: 'location' };

			if (memory.atLocation === nearest.id) return SUCCEEDED;
			return RUNNING;
		},

		SeekWell(): ActionResult {
			// Prefer a well in the agent's current perception range with water in stock.
			const nearbyWells = resolveNearbyLocations().filter(l => l.facility_type === 'well');
			if (nearbyWells.length > 0) {
				// Cross-reference with nearby facilities to check stock.
				const stockedWells = nearbyWells.filter(l => {
					const fac = resolveNearbyFacilities().find(f => f.id === l.id);
					return fac?.stock.some(s => s.item_id === 'water' && s.quantity > 0) === true;
				});
				const target = stockedWells.length > 0 ? stockedWells : nearbyWells;
				beginAction(ctx, 'seek_well');
				const nearest = findNearest(target)!;
				memory.movementTarget = { id: nearest.id, type: 'location' };
				if (memory.atLocation === nearest.id) return SUCCEEDED;
				return RUNNING;
			}

			// Fallback: full-map search for any well (water sources are rare)
			const allWells = getLocations().filter(l => l.facility_type === 'well');
			if (allWells.length === 0) return FAILED;
			const agentX = actor.pos.x;
			const agentY = actor.pos.y;
			let best = allWells[0]!;
			let bestDistSq = (best.position.x - agentX) ** 2 + (best.position.y - agentY) ** 2;
			for (const w of allWells) {
				const d = (w.position.x - agentX) ** 2 + (w.position.y - agentY) ** 2;
				if (d < bestDistSq) { best = w; bestDistSq = d; }
			}
			beginAction(ctx, 'seek_well');
			memory.movementTarget = { id: best.id, type: 'location' };
			if (memory.atLocation === best.id) return SUCCEEDED;
			return RUNNING;
		},
	};
}
