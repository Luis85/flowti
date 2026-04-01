import { SystemPriority, type GameSystem } from '../../domain/core/tick-scheduler.js';
import type { GameCoreDeps } from '../../domain/core/game-deps.js';
import { applyTrade, type TradeResult } from '../../domain/systems/trade.js';
import { applyRelationshipUpdate } from '../../domain/systems/relationship.js';
import { FOOD_ITEMS } from '../../domain/systems/food-items.js';
import { distance } from '../../domain/core/math-utils.js';
import type { AgentActor } from '../entity/agent-actor.js';
import type { WorldLocation } from '../../domain/schemas/location-schema.js';
import type { Actor } from 'excalibur';
import { WalletComponent } from '../components/wallet-component.js';
import { InventoryComponent } from '../components/inventory-component.js';
import { FacilityComponent } from '../components/facility-component.js';
import { EconomyComponent } from '../components/economy-component.js';
import { RelationshipComponent } from '../components/relationship-component.js';
import type { FacilityState } from '../../domain/core/component-data.js';

interface NearestFoodFacility {
	location: WorldLocation;
	actor: Actor;
	foodItemId: string;
}

function findNearestFoodFacility(
	agent: AgentActor,
	locationList: WorldLocation[],
	locationActorMap: Map<string, Actor>,
	radius: number,
): NearestFoodFacility | undefined {
	let nearest: NearestFoodFacility | undefined;
	let nearestDist = Infinity;

	for (const loc of locationList) {
		if (loc.production === null) continue;
		const locActor = locationActorMap.get(loc.id);
		if (locActor === undefined) continue;
		const dist = distance(agent.pos.x, agent.pos.y, loc.position.x, loc.position.y);
		if (dist > radius || dist >= nearestDist) continue;

		const facility = locActor.get(FacilityComponent);
		for (const stockItem of facility.state.stock) {
			if (FOOD_ITEMS.has(stockItem.item_id) && stockItem.quantity > 0) {
				nearestDist = dist;
				nearest = { location: loc, actor: locActor, foodItemId: stockItem.item_id };
				break;
			}
		}
	}
	return nearest;
}

function applySuccessfulTrade(
	agent: AgentActor,
	result: TradeResult,
	target: NearestFoodFacility,
	foodPrice: number,
	economy: EconomyComponent,
	deps: GameCoreDeps,
): void {
	// Update agent wallet
	const wallet = agent.get(WalletComponent);
	wallet.state = { ...wallet.state, gold: wallet.state.gold + result.agentGoldChange };
	wallet.markDirty();

	// Add item to agent inventory
	const inv = agent.get(InventoryComponent);
	const existingItem = inv.state.items.find(i => i.item_id === target.foodItemId);
	const updatedItems = existingItem !== undefined
		? inv.state.items.map(i => i.item_id === target.foodItemId
			? { ...i, quantity: i.quantity + 1 }
			: { ...i })
		: [...inv.state.items.map(i => ({ ...i })), { item_id: target.foodItemId, quantity: 1 }];
	inv.state = { ...inv.state, items: updatedItems };
	inv.markDirty();

	// Update facility stock and fund
	updateFacilityAfterSale(target.actor, target.foodItemId, result.facilityFundChange);

	// Record ledger entry + update daily sales summary
	economy.state = {
		...economy.state,
		ledger: [
			...economy.state.ledger,
			{
				tick: deps.tickCount,
				type: 'purchase' as const,
				from: agent.agentId,
				to: target.location.id,
				itemId: target.foodItemId,
				quantity: 1,
				gold: foodPrice,
			},
		],
		dailySummary: {
			...economy.state.dailySummary,
			totalSales: economy.state.dailySummary.totalSales + foodPrice,
		},
	};
	economy.markDirty();

	// Relationship update if facility has a worker
	const facilityComp = target.actor.get(FacilityComponent);
	if (facilityComp.state.workerId !== null) {
		applyBuyerRelationship(agent, facilityComp.state);
	}

	deps.eventBus.emit({
		type: 'PurchaseComplete',
		tick: deps.tickCount,
		wallClock: Date.now(),
		source: 'TradeSystem',
		payload: {
			agentId: agent.agentId,
			facilityId: target.location.id,
			itemId: target.foodItemId,
			price: foodPrice,
		},
	});
}

function updateFacilityAfterSale(facilityActor: Actor, foodItemId: string, fundChange: number): void {
	const facilityComp = facilityActor.get(FacilityComponent);
	const newStock = facilityComp.state.stock
		.map(item => {
			if (item.item_id !== foodItemId) return { ...item };
			const newQty = item.quantity - 1;
			return newQty > 0 ? { ...item, quantity: newQty } : null;
		})
		.filter((item): item is { item_id: string; quantity: number } => item !== null);
	facilityComp.state = {
		...facilityComp.state,
		stock: newStock,
		fund: facilityComp.state.fund + fundChange,
	};
	facilityComp.markDirty();
}

function applyBuyerRelationship(agent: AgentActor, facilityState: FacilityState): void {
	if (facilityState.workerId === null) return;
	const agentRelComp = agent.get(RelationshipComponent);
	const workerId = facilityState.workerId;
	const existingRel = agentRelComp.state.entries.find(e => e.agentId === workerId);
	const relResult = applyRelationshipUpdate({
		currentDisposition: existingRel?.disposition ?? 0,
		currentFamiliarity: existingRel?.familiarity ?? 0,
		dispositionChange: 0,
		familiarityChange: 0.5,
	});
	const existingTags = existingRel?.tags ?? [];
	const newEntry = {
		agentId: workerId,
		disposition: relResult.newDisposition,
		familiarity: relResult.newFamiliarity,
		tags: existingTags.includes('traded_with') ? [...existingTags] : [...existingTags, 'traded_with'],
		lastInteractionTick: 0,
	};
	const updatedEntries = existingRel !== undefined
		? agentRelComp.state.entries.map(e => e.agentId === workerId ? newEntry : { ...e })
		: [...agentRelComp.state.entries.map(e => ({ ...e })), newEntry];
	agentRelComp.state = { ...agentRelComp.state, entries: updatedEntries };
	agentRelComp.markDirty();
}

export function createTradeSystem(
	agents: () => AgentActor[],
	locations: () => WorldLocation[],
	getLocationActors: () => Map<string, Actor>,
	worldEntity: () => Actor,
): GameSystem {
	return {
		name: 'TradeSystem',
		priority: SystemPriority.TRADE,

		execute(deps: GameCoreDeps): void {
			const agentList = agents();
			const locationList = locations();
			const locationActorMap = getLocationActors();
			const world = worldEntity();
			const economy = world.get(EconomyComponent);
			const radius = deps.config.perception.interaction_radius;
			const foodPrice = deps.config.economy.food_price;

			for (const agent of agentList) {
				const btAction = agent.behaviorAgent.btAction;
				if (btAction !== 'buy') continue;

				const target = findNearestFoodFacility(agent, locationList, locationActorMap, radius);
				if (target === undefined) continue;

				const wallet = agent.get(WalletComponent);
				const result = applyTrade({
					agentGold: wallet.state.gold,
					price: foodPrice,
					facilityFund: target.actor.get(FacilityComponent).state.fund,
					itemId: target.foodItemId,
					quantity: 1,
				});

				if (result.success) {
					applySuccessfulTrade(agent, result, target, foodPrice, economy, deps);
				} else {
					deps.eventBus.emit({
						type: 'PurchaseFailed',
						tick: deps.tickCount,
						wallClock: Date.now(),
						source: 'TradeSystem',
						payload: {
							agentId: agent.agentId,
							reason: result.failReason,
						},
					});
				}
			}
		},
	};
}
