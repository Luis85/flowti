import { SystemPriority, type GameSystem } from '../../domain/core/tick-scheduler.js';
import type { GameCoreDeps } from '../../domain/core/game-deps.js';
import { applyTrade, type TradeResult } from '../../domain/systems/trade.js';
import { applyRelationshipUpdate } from '../../domain/systems/relationship.js';
import { distance } from '../../domain/core/math-utils.js';
import type { AgentActor } from '../entity/agent-actor.js';
import type { WorldLocation } from '../../domain/schemas/location-schema.js';
import type { Actor } from 'excalibur';
import { WalletComponent } from '../components/wallet-component.js';
import { InventoryComponent } from '../components/inventory-component.js';
import { FacilityComponent } from '../components/facility-component.js';
import { EconomyComponent } from '../components/economy-component.js';
import { RelationshipComponent } from '../components/relationship-component.js';
import { MemoryComponent } from '../components/memory-component.js';
import type { FacilityState } from '../../domain/core/component-data.js';
import type { Item } from '../../domain/schemas/item-schema.js';

export interface NearestFacility {
	location: WorldLocation;
	actor: Actor;
	itemId: string;
}

export function findNearestFacilityWithItem(
	agent: AgentActor,
	locationList: WorldLocation[],
	locationActorMap: Map<string, Actor>,
	radius: number,
	itemId: string,
): NearestFacility | undefined {
	let nearest: NearestFacility | undefined;
	let nearestDist = Infinity;

	for (const loc of locationList) {
		const locActor = locationActorMap.get(loc.id);
		if (locActor?.has(FacilityComponent) !== true) continue;
		const dist = distance(agent.pos.x, agent.pos.y, loc.position.x, loc.position.y);
		if (dist > radius || dist >= nearestDist) continue;

		const facility = locActor.get(FacilityComponent);
		for (const stockItem of facility.state.stock) {
			if (stockItem.item_id === itemId && stockItem.quantity > 0) {
				nearestDist = dist;
				nearest = { location: loc, actor: locActor, itemId: stockItem.item_id };
				break;
			}
		}
	}
	return nearest;
}

function applySuccessfulTrade(
	agent: AgentActor,
	result: TradeResult,
	target: NearestFacility,
	foodPrice: number,
	economy: EconomyComponent,
	deps: GameCoreDeps,
	itemDef?: Item,
): void {
	// Update agent wallet
	const wallet = agent.get(WalletComponent);
	wallet.state = { ...wallet.state, gold: wallet.state.gold + result.agentGoldChange };
	wallet.markDirty();

	// Add item to agent inventory (initialize charges from item def if applicable)
	const inv = agent.get(InventoryComponent);
	const existingItem = inv.state.items.find(i => i.item_id === target.itemId);
	const maxCharges = itemDef?.maxCharges;
	let updatedItems;
	if (existingItem !== undefined) {
		updatedItems = inv.state.items.map(i => i.item_id === target.itemId
			? { ...i, quantity: i.quantity + 1 }
			: { ...i });
	} else {
		const newItem: { item_id: string; quantity: number; charges?: number } = { item_id: target.itemId, quantity: 1 };
		if (maxCharges !== undefined) newItem.charges = maxCharges;
		updatedItems = [...inv.state.items.map(i => ({ ...i })), newItem];
	}
	inv.state = { ...inv.state, items: updatedItems };
	inv.markDirty();

	// Update facility stock and fund
	updateFacilityAfterSale(target.actor, target.itemId, result.facilityFundChange);

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
				itemId: target.itemId,
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
		applyBuyerRelationship(agent, facilityComp.state, deps.tickCount);
	}

	deps.eventBus.emit({
		type: 'PurchaseComplete',
		tick: deps.tickCount,
		wallClock: Date.now(),
		source: 'TradeSystem',
		payload: {
			agentId: agent.agentId,
			facilityId: target.location.id,
			itemId: target.itemId,
			price: foodPrice,
		},
	});

	// Emit GoldFlowed for monetary policy tracking
	deps.eventBus.emit({
		type: 'GoldFlowed',
		tick: deps.tickCount,
		wallClock: Date.now(),
		source: 'TradeSystem',
		payload: {
			category: 'transfer' as const,
			subcategory: 'purchase',
			amount: foodPrice,
			fromEntity: agent.agentId,
			toEntity: target.location.id,
		},
	});

	// Create purchase memory for mood pipeline
	const memComp = agent.get(MemoryComponent);
	memComp.state = {
		...memComp.state,
		entries: [...memComp.state.entries, {
			tick: deps.tickCount,
			type: `purchase_${target.itemId}`,
			description: `Bought ${target.itemId} for ${foodPrice}g`,
			participants: [target.location.id],
			outcome: 'positive' as const,
			significance: 3,
			mood_impact: 2,
		}],
	};
	memComp.markDirty();

	// Record price observation — agent learns current price
	agent.behaviorAgent.recordPriceObservation(
		target.itemId,
		foodPrice,
		target.location.id,
		deps.tickCount,
	);
}

function updateFacilityAfterSale(facilityActor: Actor, itemId: string, fundChange: number): void {
	const facilityComp = facilityActor.get(FacilityComponent);
	const newStock = facilityComp.state.stock
		.map(item => {
			if (item.item_id !== itemId) return { ...item };
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

function applyBuyerRelationship(agent: AgentActor, facilityState: FacilityState, tickCount: number): void {
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
		lastInteractionTick: tickCount,
	};
	const updatedEntries = existingRel !== undefined
		? agentRelComp.state.entries.map(e => e.agentId === workerId ? newEntry : { ...e })
		: [...agentRelComp.state.entries.map(e => ({ ...e })), newEntry];
	agentRelComp.state = { ...agentRelComp.state, entries: updatedEntries };
	agentRelComp.markDirty();
}

export interface PurchaseResult {
	success: boolean;
	failReason?: string | null;
	price?: number;
}

/**
 * Execute a purchase: wallet + inventory + stock + fund transfers,
 * ledger, buyer relationship, purchase memory, price observation.
 * Called by both TradeSystem's buy loop AND composite BT actions
 * (BuyAndDrink / BuyAndEat) that need to transact inline.
 */
export function executePurchase(
	agent: AgentActor,
	target: NearestFacility,
	economy: EconomyComponent,
	deps: GameCoreDeps,
	itemDef: Item | undefined,
	configFallbackPrice: number,
): PurchaseResult {
	const facility = target.actor.get(FacilityComponent);
	const price = facility.state.currentPrices?.[target.itemId]
		?? itemDef?.baseValue
		?? configFallbackPrice;

	const wallet = agent.get(WalletComponent);
	const result = applyTrade({
		agentGold: wallet.state.gold,
		price,
		facilityFund: facility.state.fund,
		itemId: target.itemId,
		quantity: 1,
	});

	if (!result.success) {
		// Agent still learns the price on failure
		agent.behaviorAgent.recordPriceObservation(target.itemId, price, target.location.id, deps.tickCount);
		return { success: false, failReason: result.failReason, price };
	}

	applySuccessfulTrade(agent, result, target, price, economy, deps, itemDef);
	return { success: true, price };
}

export function createTradeSystem(
	agents: () => AgentActor[],
	locations: () => WorldLocation[],
	getLocationActors: () => Map<string, Actor>,
	worldEntity: () => Actor,
	itemRegistry: () => Map<string, Item>,
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

			for (const agent of agentList) {
				const btAction = agent.behaviorAgent.btAction;
				const pendingBuy = agent.behaviorAgent.buyTargetItem;
				if (btAction !== 'buy' && pendingBuy === null) continue;

				const targetItem = pendingBuy ?? 'food';
				const target = findNearestFacilityWithItem(agent, locationList, locationActorMap, radius, targetItem);
				if (target === undefined) {
					deps.eventBus.emit({
						type: 'TradeAttempted',
						tick: deps.tickCount,
						wallClock: Date.now(),
						source: 'TradeSystem',
						payload: { agentId: agent.agentId, item: targetItem, result: 'no_facility' },
					});
					agent.behaviorAgent.buyTargetItem = null;
					continue;
				}

				const item = itemRegistry().get(target.itemId);
				const result = executePurchase(agent, target, economy, deps, item, deps.config.economy.food_price);
				agent.behaviorAgent.buyTargetItem = null;

				if (result.success) {
					deps.eventBus.emit({
						type: 'TradeAttempted',
						tick: deps.tickCount,
						wallClock: Date.now(),
						source: 'TradeSystem',
						payload: { agentId: agent.agentId, item: targetItem, result: 'purchased', amount: result.price, facilityId: target.location.id },
					});
				} else {
					deps.eventBus.emit({
						type: 'TradeAttempted',
						tick: deps.tickCount,
						wallClock: Date.now(),
						source: 'TradeSystem',
						payload: { agentId: agent.agentId, item: targetItem, result: 'insufficient_gold', facilityId: target.location.id },
					});
					deps.eventBus.emit({
						type: 'PurchaseFailed',
						tick: deps.tickCount,
						wallClock: Date.now(),
						source: 'TradeSystem',
						payload: { agentId: agent.agentId, reason: result.failReason },
					});
				}
			}
		},
	};
}
