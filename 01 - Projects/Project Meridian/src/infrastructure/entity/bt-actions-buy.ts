import type { ActionResult } from '../../domain/systems/behavior-agent.js';
import type { ActionMethods } from './bt-actions.js';
import type { ActionContext } from './bt-action-helpers.js';
import { SUCCEEDED, FAILED, RUNNING, beginAction } from './bt-action-helpers.js';
import { NeedsComponent } from '../components/needs-component.js';
import { InventoryComponent } from '../components/inventory-component.js';
import { FacilityComponent } from '../components/facility-component.js';
import { EconomyComponent } from '../components/economy-component.js';
import { findFoodInInventory, FOOD_ITEMS } from '../../domain/systems/food-items.js';
import { executePurchase } from '../systems/trade-system.js';
import type { GameCoreDeps } from '../../domain/core/game-deps.js';
import type { AgentActor } from './agent-actor.js';

/**
 * Composite BT actions that travel to a source, buy inline on arrival,
 * and consume in the same tick. Bypasses the broken multi-step BT
 * sequence pattern (SeekWell → BuyItem → Drink) that suffered from
 * commitment preemption and BT reset-every-tick.
 */
export function createBuyActions(ctx: ActionContext): Pick<ActionMethods, 'BuyAndDrink' | 'BuyAndEat'> {
	const { memory, actor, deps } = ctx;
	const { config, getLocations, getLocationActors, worldEntity } = deps;

	function findSourceWithItem(itemPredicate: (itemId: string) => boolean): string | null {
		const locationActorMap = getLocationActors();
		const locations = getLocations();
		const agentX = actor.pos.x;
		const agentY = actor.pos.y;
		let bestId: string | null = null;
		let bestDistSq = Infinity;
		for (const loc of locations) {
			const locActor = locationActorMap.get(loc.id);
			if (locActor?.has(FacilityComponent) !== true) continue;
			const facility = locActor.get(FacilityComponent);
			const hasItem = facility.state.stock.some(s => itemPredicate(s.item_id) && s.quantity > 0);
			if (!hasItem) continue;
			const dx = loc.position.x - agentX;
			const dy = loc.position.y - agentY;
			const d = dx * dx + dy * dy;
			if (d < bestDistSq) {
				bestDistSq = d;
				bestId = loc.id;
			}
		}
		return bestId;
	}

	/** Shared deps-adapter: BehaviorAgentDeps has `tickCount: () => number`, GameCoreDeps has `tickCount: number`. */
	function gameCoreDeps(): GameCoreDeps {
		return {
			logger: { debug() {}, info() {}, warn() {}, error() {} },
			eventBus: deps.eventBus,
			config: deps.config,
			performanceTracker: { start() { return () => {}; }, getStats() { return {}; }, reset() {} } as unknown as GameCoreDeps['performanceTracker'],
			tickCount: deps.tickCount(),
			writeFile: null,
			dataRoot: '',
			getRecipeRegistry: deps.getRecipeRegistry ?? (() => new Map()),
			getFacilityTypeRegistry: deps.getFacilityTypeRegistry ?? (() => new Map()),
		};
	}

	function runComposite(
		actionName: 'buy_and_drink' | 'buy_and_eat',
		itemPredicate: (itemId: string) => boolean,
		onConsume: (a: AgentActor, itemId: string) => void,
	): ActionResult {
		// Reuse existing serviceTarget ONLY if it stocks the required item.
		// serviceTarget is shared with service-visit branches (rest_inn, tavern,
		// etc.) — a leftover ID from a service visit would cause this action
		// to travel to a facility with no water/food.
		let targetId: string | null = memory.serviceTarget;
		if (targetId !== null) {
			const cachedActor = getLocationActors().get(targetId);
			const cachedStock = cachedActor?.has(FacilityComponent) === true
				? cachedActor.get(FacilityComponent).state.stock
				: [];
			const stillValid = cachedStock.some(s => itemPredicate(s.item_id) && s.quantity > 0);
			if (!stillValid) targetId = null;
		}
		if (targetId === null) {
			targetId = findSourceWithItem(itemPredicate);
			if (targetId === null) {
				memory.serviceTarget = null;
				return FAILED;
			}
			memory.serviceTarget = targetId;
		}

		// Travel phase
		if (memory.atLocation !== targetId) {
			beginAction(ctx, actionName);
			memory.movementTarget = { id: targetId, type: 'location' };
			return RUNNING;
		}

		// Arrival: buy + consume inline
		const locationActorMap = getLocationActors();
		const targetActor = locationActorMap.get(targetId);
		const locations = getLocations();
		const targetLoc = locations.find(l => l.id === targetId);
		if (targetActor === undefined || targetLoc === undefined || !targetActor.has(FacilityComponent)) {
			memory.serviceTarget = null;
			return FAILED;
		}

		const facility = targetActor.get(FacilityComponent);
		const stockItem = facility.state.stock.find(s => itemPredicate(s.item_id) && s.quantity > 0);
		if (stockItem === undefined) {
			memory.serviceTarget = null;
			return FAILED;
		}

		const target = { location: targetLoc, actor: targetActor, itemId: stockItem.item_id };
		const world = worldEntity();
		const economy = world.get(EconomyComponent);
		// Config items is partial (no water/food by default) — pass undefined;
		// executePurchase falls back to facility currentPrices or config.economy.food_price.
		const purchaseResult = executePurchase(
			actor,
			target,
			economy,
			gameCoreDeps(),
			undefined,
			config.economy.food_price,
		);

		if (!purchaseResult.success) {
			memory.serviceTarget = null;
			return FAILED;
		}

		onConsume(actor, stockItem.item_id);
		memory.serviceTarget = null;
		return SUCCEEDED;
	}

	return {
		BuyAndDrink(): ActionResult {
			return runComposite(
				'buy_and_drink',
				(id) => id === 'water',
				(a) => {
					const inv = a.get(InventoryComponent);
					const newItems = inv.state.items
						.map(i => {
							if (i.item_id !== 'water') return { ...i };
							const newQty = i.quantity - 1;
							return newQty > 0 ? { ...i, quantity: newQty } : null;
						})
						.filter((i): i is NonNullable<typeof i> => i !== null);
					inv.state = { ...inv.state, items: newItems };
					inv.markDirty();
					const needs = a.get(NeedsComponent);
					needs.state = { ...needs.state, thirst: Math.min(100, needs.state.thirst + config.needs.drink_recovery) };
					needs.markDirty();
				},
			);
		},

		BuyAndEat(): ActionResult {
			return runComposite(
				'buy_and_eat',
				(id) => FOOD_ITEMS.has(id),
				(a) => {
					const inv = a.get(InventoryComponent);
					const food = findFoodInInventory([...inv.state.items]);
					if (food === null) return;
					const newItems = inv.state.items
						.map(i => {
							if (i.item_id !== food.item_id) return { ...i };
							const newQty = i.quantity - 1;
							return newQty > 0 ? { ...i, quantity: newQty } : null;
						})
						.filter((i): i is NonNullable<typeof i> => i !== null);
					inv.state = { ...inv.state, items: newItems };
					inv.markDirty();
					const needs = a.get(NeedsComponent);
					needs.state = { ...needs.state, hunger: Math.min(100, needs.state.hunger + config.needs.food_recovery_rate) };
					needs.markDirty();
				},
			);
		},
	};
}
