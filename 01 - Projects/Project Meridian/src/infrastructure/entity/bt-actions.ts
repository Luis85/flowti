import type { WorkingMemory } from './bt-working-memory.js';
import type { BehaviorAgentDeps } from './behavior-agent-factory.js';
import type { AgentActor } from './agent-actor.js';
import type { ActionResult, PerceivedFacility, PerceivedAgent, PerceivedLocation } from '../../domain/systems/behavior-agent.js';

import { NeedsComponent } from '../components/needs-component.js';
import { WalletComponent } from '../components/wallet-component.js';
import { InventoryComponent } from '../components/inventory-component.js';
import { FacilityComponent } from '../components/facility-component.js';
import { AttributesComponent } from '../components/attributes-component.js';
import { EconomyComponent } from '../components/economy-component.js';
import { MemoryComponent } from '../components/memory-component.js';
import { QuestBoardComponent } from '../components/quest-board-component.js';
import { findFoodInInventory, FOOD_ITEMS, TRADE_GOODS } from '../../domain/systems/food-items.js';
import { pickupCargo, deliverCargo } from '../../domain/systems/cargo.js';
import { isPriceStale } from '../../domain/systems/price-memory.js';

const SUCCEEDED: ActionResult = 'mistreevous.succeeded';
const FAILED: ActionResult = 'mistreevous.failed';
const RUNNING: ActionResult = 'mistreevous.running';

export interface ActionMethods {
	Eat(): ActionResult;
	Drink(): ActionResult;
	Harvest(): ActionResult;
	Rest(): ActionResult;
	SeekWater(): ActionResult;
	FillWaterskin(): ActionResult;
	SellAtMarket(): ActionResult;
	SeekFood(): ActionResult;
	SeekRest(): ActionResult;
	Buy(): ActionResult;
	BuyItem(itemId: string): ActionResult;
	SeekBestFoodSource(): ActionResult;
	ClaimJob(): ActionResult;
	ClaimBestJob(): ActionResult;
	ReleaseJob(): ActionResult;
	SwitchJob(): ActionResult;
	Work(): ActionResult;
	Talk(): ActionResult;
	SeekWork(): ActionResult;
	SeekSocial(): ActionResult;
	SeekMarket(): ActionResult;
	PickupCargo(): ActionResult;
	DeliverCargo(): ActionResult;
	SeekDeliveryTarget(): ActionResult;
	SeekSupplySource(): ActionResult;
	ClaimQuest(): ActionResult;
	SeekQuestFacility(): ActionResult;
	WorkRepair(): ActionResult;
	CompleteQuest(): ActionResult;
	AbandonQuest(): ActionResult;
	Idle(): ActionResult;
	Wander(): ActionResult;
	ContinueCommitment(): ActionResult;
	tickUnemployment(): void;
	recordPriceObservation(itemId: string, price: number, locationId: string, tick: number): void;
}

export function createActions(
	memory: WorkingMemory,
	actor: AgentActor,
	deps: BehaviorAgentDeps,
	resolveNearbyFacilities: () => PerceivedFacility[],
	resolveNearbyAgents: () => PerceivedAgent[],
	resolveNearbyLocations: () => PerceivedLocation[],
	commitmentMultiplier = 1.0,
): ActionMethods {
	const { config, getLocationActors, getLocations, tickCount, eventBus } = deps;

	function beginAction(actionName: string): void {
		memory.btAction = actionName;
		// If a different action overrides an existing commitment (e.g., P0 critical needs
		// preempting P-1), clear the stale commitment so the new action owns the timer.
		if (memory.commitmentTicks > 0 && memory.committedAction !== actionName) {
			memory.commitmentTicks = 0;
			memory.committedAction = null;
		}
		if (memory.commitmentTicks <= 0) {
			const duration = Math.round((config.commitment_ticks[actionName] ?? 0) * commitmentMultiplier);
			if (duration > 0) {
				memory.commitmentTicks = duration;
				memory.committedAction = actionName;
			}
		}
	}

	return {
		Eat(): ActionResult {
			const food = findFoodInInventory([...actor.get(InventoryComponent).state.items]);
			if (food === null) return FAILED;
			beginAction('eat');
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
			beginAction('drink');
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
			beginAction('harvest');
			return SUCCEEDED;
		},

		Rest(): ActionResult {
			beginAction('rest');
			return RUNNING;
		},

		SeekWater(): ActionResult {
			const waterLocs = resolveNearbyLocations().filter(l => l.type === 'water');
			if (waterLocs.length === 0) return FAILED;
			beginAction('seek_water');
			const nearest = waterLocs.reduce((a, b) => a.distance < b.distance ? a : b);
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
			beginAction('fill_waterskin');
			return SUCCEEDED;
		},

		SellAtMarket(): ActionResult {
			if (memory.atLocation === null) return FAILED;
			const locData = getLocations().find(l => l.id === memory.atLocation);
			if (locData?.type !== 'market') return FAILED;
			const inv = actor.get(InventoryComponent);
			const sellable = inv.state.items.find(i =>
				(FOOD_ITEMS.has(i.item_id) || TRADE_GOODS.has(i.item_id)) && i.quantity > 0,
			);
			if (sellable === undefined) return FAILED;
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

			beginAction('sell');
			return SUCCEEDED;
		},

		SeekFood(): ActionResult {
			// Prefer locations with food in stock (market, stocked farm)
			const stockedFacilities = resolveNearbyFacilities().filter(f =>
				f.stock.some(s => FOOD_ITEMS.has(s.item_id) && s.quantity > 0),
			);
			if (stockedFacilities.length > 0) {
				const nearest = stockedFacilities.reduce((a, b) => a.distance < b.distance ? a : b);
				beginAction('seek_food');
				memory.movementTarget = { id: nearest.id, type: 'location' };
				if (memory.atLocation === nearest.id) return SUCCEEDED;
				return RUNNING;
			}
			// Fallback: food-type locations (farms)
			const foodLocs = resolveNearbyLocations().filter(l => l.type === 'food');
			if (foodLocs.length === 0) return FAILED;
			beginAction('seek_food');
			const nearest = foodLocs.reduce((a, b) => a.distance < b.distance ? a : b);
			memory.movementTarget = { id: nearest.id, type: 'location' };
			if (memory.atLocation === nearest.id) return SUCCEEDED;
			return RUNNING;
		},

		SeekRest(): ActionResult {
			const restLocs = resolveNearbyLocations().filter(l => l.type === 'rest');
			if (restLocs.length > 0) {
				beginAction('seek_rest');
				const nearest = restLocs.reduce((a, b) => a.distance < b.distance ? a : b);
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

			beginAction('seek_rest');
			memory.movementTarget = { id: restLoc.id, type: 'location' };
			if (memory.atLocation === restLoc.id) return SUCCEEDED;
			return RUNNING;
		},

		Buy(): ActionResult {
			if (memory.atLocation === null) return FAILED;
			const atFacility = resolveNearbyFacilities().find(f =>
				f.id === memory.atLocation && f.stock.some(s => FOOD_ITEMS.has(s.item_id) && s.quantity > 0),
			);
			if (atFacility === undefined) return FAILED;
			beginAction('buy');
			memory.buyTargetItem = null;
			return SUCCEEDED;
		},

		BuyItem(itemId: string): ActionResult {
			if (memory.atLocation === null) return FAILED;
			const atFacility = resolveNearbyFacilities().find(f =>
				f.id === memory.atLocation && f.stock.some(s => s.item_id === itemId && s.quantity > 0),
			);
			if (atFacility === undefined) return FAILED;
			beginAction('buy');
			memory.buyTargetItem = itemId;
			return SUCCEEDED;
		},

		SeekBestFoodSource(): ActionResult {
			const staleTicks = config.economy.price_memory_stale_ticks;
			const tick = tickCount();
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
			beginAction('seek_food');
			memory.movementTarget = { id: cheapestLocation, type: 'location' };
			if (memory.atLocation === cheapestLocation) return SUCCEEDED;
			return RUNNING;
		},

		ClaimJob(): ActionResult {
			const agentKind = actor.kind;
			const openFacilities = resolveNearbyFacilities().filter(f =>
				f.workerId === null && f.job !== '' && f.job === agentKind,
			);
			if (openFacilities.length === 0) return FAILED;
			const nearest = openFacilities.reduce((a, b) => a.distance < b.distance ? a : b);
			actor.job = nearest.job;
			if (!deps.claimFacility!(nearest.id)) {
				actor.job = null;
				return FAILED;
			}
			beginAction('claim_job');
			return SUCCEEDED;
		},

		ClaimBestJob(): ActionResult {
			const jobsConfig = deps.jobsConfig ?? deps.config.jobs;
			const openFacilities = resolveNearbyFacilities().filter(f =>
				f.workerId === null && f.job !== '',
			);
			if (openFacilities.length === 0) return FAILED;

			let chosen: typeof openFacilities[0];
			if (memory.unemployedTicks >= jobsConfig.desperation_ticks) {
				// Desperate — take nearest regardless of fit
				chosen = openFacilities.reduce((a, b) => a.distance < b.distance ? a : b);
			} else {
				// Score by primary attribute aptitude, tiebreak by distance
				const attrComp = actor.get(AttributesComponent);
				chosen = openFacilities.reduce((best, f) => {
					const jobDef = jobsConfig.definitions[f.job];
					const fScore = jobDef !== undefined
						? attrComp.getByName(jobDef.primary_attribute)
						: 0;
					const bestDef = jobsConfig.definitions[best.job];
					const bestScore = bestDef !== undefined
						? attrComp.getByName(bestDef.primary_attribute)
						: 0;
					if (fScore > bestScore) return f;
					if (fScore === bestScore && f.distance < best.distance) return f;
					return best;
				});
			}

			actor.job = chosen.job;
			if (!deps.claimFacility!(chosen.id)) {
				actor.job = null;
				return FAILED;
			}
			memory.unemployedTicks = 0;
			beginAction('claim_job');
			deps.swapBehaviorTree?.(chosen.job);
			return SUCCEEDED;
		},

		ReleaseJob(): ActionResult {
			deps.releaseFacility!();
			actor.job = null;
			memory.unemployedTicks = 0;
			memory.btAction = null;
			deps.swapBehaviorTree?.(null);
			return SUCCEEDED;
		},

		SwitchJob(): ActionResult {
			const facilities = resolveNearbyFacilities();
			const { jobs: jobsConfig } = deps.config;
			const baseline = jobsConfig.aptitude_baseline;
			const switchAttrComp = actor.get(AttributesComponent);

			const currentWage = facilities.find(f => f.workerId === actor.agentId)?.wage ?? 0;
			const currentJobDef = actor.job !== null ? jobsConfig.definitions[actor.job] : undefined;
			const currentApt = currentJobDef !== undefined ? (switchAttrComp.getByName(currentJobDef.primary_attribute) || baseline) : baseline;
			const currentEffective = currentWage * (currentApt / baseline);

			let bestFacility: PerceivedFacility | null = null;
			let bestEffective = currentEffective;
			for (const f of facilities) {
				if (f.workerId !== null || f.job === '') continue;
				const jobDef = jobsConfig.definitions[f.job];
				const apt = jobDef !== undefined ? (switchAttrComp.getByName(jobDef.primary_attribute) || baseline) : baseline;
				const effective = f.wage * (apt / baseline);
				if (effective > bestEffective) { bestFacility = f; bestEffective = effective; }
			}

			if (bestFacility === null) return FAILED;
			// Don't switch to the same job at the same facility
			if (bestFacility.job === actor.job && bestFacility.wage <= currentWage) return FAILED;

			const oldJob = actor.job;
			deps.releaseFacility!();
			actor.job = bestFacility.job;
			if (!deps.claimFacility!(bestFacility.id)) {
				actor.job = oldJob;
				return FAILED;
			}
			beginAction('switch_job');
			deps.eventBus.emit({
				type: 'JobSwitched',
				tick: deps.tickCount(),
				wallClock: Date.now(),
				source: 'BehaviorAgent',
				payload: { agentId: actor.agentId, oldJob, newJob: bestFacility.job, oldWage: currentWage, newWage: bestFacility.wage },
			});
			deps.swapBehaviorTree?.(bestFacility.job);
			return SUCCEEDED;
		},

		/** Available for custom BTs — not used in the default tree set. */
		Idle(): ActionResult {
			beginAction('idle');
			return RUNNING;
		},

		Wander(): ActionResult {
			beginAction('wander');
			// Pick a random location to wander toward — enables exploration and discovery
			if (memory.movementTarget === null) {
				const allLocs = getLocations();
				if (allLocs.length > 0) {
					const idx = Math.floor(Math.random() * allLocs.length);
					const target = allLocs[idx];
					if (target !== undefined) {
						memory.movementTarget = { id: target.id, type: 'location' };
					}
				}
			}
			return RUNNING;
		},

		// ── C3: Work + merchant actions ────────────────────────────────────
		Work(): ActionResult {
			if (memory.atLocation === null || actor.job === null) return FAILED;
			const facilities = resolveNearbyFacilities();
			const jobFacility = facilities.find(f =>
				f.id === memory.atLocation &&
				f.job === actor.job &&
				f.workerId === actor.agentId,
			);
			if (jobFacility === undefined) return FAILED;
			beginAction('work');
			return RUNNING;
		},

		Talk(): ActionResult {
			const closeAgents = resolveNearbyAgents().filter(
				a => a.distance < config.perception.interaction_radius,
			);
			if (closeAgents.length === 0) return FAILED;
			beginAction('talk');
			return RUNNING;
		},

		SeekWork(): ActionResult {
			if (actor.job === null) return FAILED;

			// Only target facilities reserved by this agent
			const availableFacility = resolveNearbyFacilities().find(f =>
				f.job === actor.job && f.workerId === actor.agentId,
			);
			if (availableFacility !== undefined) {
				beginAction('seek_work');
				memory.movementTarget = { id: availableFacility.id, type: 'location' };
				if (memory.atLocation === availableFacility.id) return SUCCEEDED;
				return RUNNING;
			}

			// Fallback: search all locations (for facilities outside perception range)
			const allLocations = getLocations();
			const locationActorMap = getLocationActors();
			const jobLoc = allLocations.find(l => {
				if (l.production?.job !== actor.job) return false;
				const locActor = locationActorMap.get(l.id);
				if (locActor?.has(FacilityComponent) !== true) return false;
				return locActor.get(FacilityComponent).state.workerId === actor.agentId;
			});
			if (jobLoc === undefined) return FAILED;

			// If already at the facility but it's occupied, don't re-target — fail gracefully
			if (memory.atLocation === jobLoc.id) return FAILED;

			beginAction('seek_work');
			memory.movementTarget = { id: jobLoc.id, type: 'location' };
			return RUNNING;
		},

		SeekSocial(): ActionResult {
			const nearby = resolveNearbyAgents();
			if (nearby.length === 0) return FAILED;

			beginAction('seek_social');
			const nearest = nearby.reduce((a, b) => a.distance < b.distance ? a : b);
			memory.movementTarget = { id: nearest.id, type: 'agent' };

			if (nearest.distance < config.perception.interaction_radius) return SUCCEEDED;
			return RUNNING;
		},

		SeekMarket(): ActionResult {
			const marketLocs = resolveNearbyLocations().filter(l => l.type === 'market');
			if (marketLocs.length === 0) return FAILED;

			beginAction('seek_market');
			const nearest = marketLocs.reduce((a, b) => a.distance < b.distance ? a : b);
			memory.movementTarget = { id: nearest.id, type: 'location' };

			if (memory.atLocation === nearest.id) return SUCCEEDED;
			return RUNNING;
		},

		PickupCargo(): ActionResult {
			beginAction('pickup_cargo');
			// Find nearest facility with output stock
			const facilitiesWithOutput = resolveNearbyFacilities().filter(
				f => f.stock.some(s => s.quantity > 0),
			);
			if (facilitiesWithOutput.length === 0) return FAILED;

			const source = facilitiesWithOutput.reduce((a, b) => a.distance < b.distance ? a : b);
			const stockItem = source.stock.find(s => s.quantity > 0);
			if (stockItem === undefined) return FAILED;

			// Find destination facility that needs this item as input
			const allLocations = getLocations();
			const destLoc = allLocations.find(l => {
				if (l.id === source.id || l.production?.input === null || l.production?.input === undefined) return false;
				return l.production.input.item_id === stockItem.item_id;
			});
			if (destLoc === undefined) return FAILED;

			const result = pickupCargo({
				itemId: stockItem.item_id,
				agentId: actor.agentId,
				facilityId: source.id,
				destinationId: destLoc.id,
				stock: source.stock,
			});

			if (result.cargo === null) return FAILED;

			// Update facility stock
			const locActors = getLocationActors();
			const sourceActor = locActors.get(source.id);
			if (sourceActor !== undefined) {
				const facComp = sourceActor.get(FacilityComponent);
				facComp.state = { ...facComp.state, stock: result.newStock };
				facComp.markDirty();
			}

			memory.haulCargo = result.cargo;
			return SUCCEEDED;
		},

		DeliverCargo(): ActionResult {
			if (memory.haulCargo === null) return FAILED;
			if (memory.atLocation !== memory.haulCargo.destination) return FAILED;
			beginAction('deliver_cargo');

			const locActors = getLocationActors();
			const destActor = locActors.get(memory.haulCargo.destination);
			if (destActor === undefined) return FAILED;

			const destFac = destActor.get(FacilityComponent);
			const result = deliverCargo({
				cargo: memory.haulCargo,
				destinationStock: destFac.state.stock,
			});

			destFac.state = { ...destFac.state, stock: result.newStock };
			destFac.markDirty();

			const cargo = memory.haulCargo;
			memory.haulCargo = null;

			eventBus.emit({
				type: 'SupplyDelivered',
				tick: tickCount(),
				wallClock: Date.now(),
				source: 'BehaviorAgent',
				payload: { agentId: actor.agentId, itemId: cargo.itemId, quantity: cargo.quantity, sourceId: cargo.source, destinationId: cargo.destination },
			});

			return SUCCEEDED;
		},

		SeekDeliveryTarget(): ActionResult {
			if (memory.haulCargo === null) return FAILED;
			beginAction('seek_delivery');
			memory.movementTarget = { id: memory.haulCargo.destination, type: 'location' };
			if (memory.atLocation === memory.haulCargo.destination) return SUCCEEDED;
			return RUNNING;
		},

		SeekSupplySource(): ActionResult {
			// Find nearest facility with unmet input
			const needyFacilities = resolveNearbyFacilities().filter(f => f.hasUnmetInput);
			if (needyFacilities.length === 0) return FAILED;
			beginAction('seek_supply');

			const needy = needyFacilities.reduce((a, b) => a.distance < b.distance ? a : b);

			// Find the PRODUCING facility (source) for the needed item
			const allLocations = getLocations();
			const needyLoc = allLocations.find(l => l.id === needy.id);
			if (needyLoc?.production?.input === null || needyLoc?.production?.input === undefined) return FAILED;

			const neededItemId = needyLoc.production.input.item_id;
			const sourceLoc = allLocations.find(l => {
				if (l.id === needy.id || l.production === null) return false;
				return l.production.output.item_id === neededItemId;
			});
			if (sourceLoc === undefined) return FAILED;

			memory.movementTarget = { id: sourceLoc.id, type: 'location' };
			if (memory.atLocation === sourceLoc.id) return SUCCEEDED;
			return RUNNING;
		},

		// ── Quest actions ──────────────────────────────────────────────────
		ClaimQuest(): ActionResult {
			if (memory.cachedAvailableQuest === null) return FAILED;

			// Re-read quest state from board (race condition guard)
			const board = deps.getQuestBoard?.();
			if (board === undefined) return FAILED;
			const cachedId = memory.cachedAvailableQuest.id;
			const quest = board.quests.find(q => q.id === cachedId);
			if (quest?.state !== 'open') {
				memory.cachedAvailableQuest = null;
				return FAILED;
			}

			quest.state = 'claimed';
			quest.claimedBy = actor.agentId;
			deps.worldEntity().get(QuestBoardComponent).markDirty();
			memory.activeQuest = quest;
			memory.cachedAvailableQuest = null;
			beginAction('claim_quest');

			deps.eventBus.emit({
				type: 'QuestClaimed',
				tick: deps.tickCount(),
				wallClock: Date.now(),
				source: 'BehaviorAgent',
				payload: { agentId: actor.agentId, questId: quest.id, questType: quest.type, facilityId: quest.facilityId },
			});

			return SUCCEEDED;
		},

		SeekQuestFacility(): ActionResult {
			if (memory.activeQuest === null) return FAILED;
			beginAction('seek_quest');
			memory.movementTarget = { id: memory.activeQuest.facilityId, type: 'location' };
			if (memory.atLocation === memory.activeQuest.facilityId) return SUCCEEDED;
			return RUNNING;
		},

		WorkRepair(): ActionResult {
			if (memory.activeQuest?.type !== 'repair') return FAILED;
			beginAction('repair');
			return RUNNING;
		},

		CompleteQuest(): ActionResult {
			if (memory.activeQuest === null) return FAILED;
			const quest = memory.activeQuest;

			if (quest.type === 'supply' || quest.type === 'restock') {
				// Check agent has required item
				if (quest.itemId === null) return FAILED;
				const inv = actor.get(InventoryComponent);
				const item = inv.state.items.find(i => i.item_id === quest.itemId);
				if (item === undefined || item.quantity < quest.quantity) return FAILED;

				// Transfer item from agent to facility
				const newItems = inv.state.items
					.map(i => {
						if (i.item_id !== quest.itemId) return { ...i };
						const newQty = i.quantity - quest.quantity;
						return newQty > 0 ? { ...i, quantity: newQty } : null;
					})
					.filter((i): i is NonNullable<typeof i> => i !== null);
				inv.state = { ...inv.state, items: newItems };
				inv.markDirty();

				// Add to facility stock
				const locActors = getLocationActors();
				const facActor = locActors.get(quest.facilityId);
				if (facActor !== undefined) {
					const fac = facActor.get(FacilityComponent);
					const hasItem = fac.state.stock.some(s => s.item_id === quest.itemId);
					const newStock = hasItem
						? fac.state.stock.map(s => s.item_id === quest.itemId ? { ...s, quantity: s.quantity + quest.quantity } : { ...s })
						: [...fac.state.stock.map(s => ({ ...s })), { item_id: quest.itemId, quantity: quest.quantity }];
					fac.state = { ...fac.state, stock: newStock };
					fac.markDirty();
				}
			} else {
				// Check repair progress
				if (quest.repairProgress < config.quests.repair_ticks) return FAILED;

				// Restore facility
				const locActors = getLocationActors();
				const facActor = locActors.get(quest.facilityId);
				if (facActor !== undefined) {
					const fac = facActor.get(FacilityComponent);
					const injection = config.quests.repair_fund_injection;
					fac.state = { ...fac.state, status: 'idle', fund: fac.state.fund + injection };
					fac.markDirty();
				}
			}

			// Pay reward from treasury
			const worldEnt = deps.worldEntity();
			if (worldEnt.has(EconomyComponent)) {
				const economy = worldEnt.get(EconomyComponent);
				if (economy.state.treasury >= quest.reward) {
					const wallet = actor.get(WalletComponent);
					wallet.state = { ...wallet.state, gold: wallet.state.gold + quest.reward };
					wallet.markDirty();
					economy.state = {
						...economy.state,
						treasury: economy.state.treasury - quest.reward,
						ledger: [...economy.state.ledger, {
							tick: tickCount(),
							type: 'quest_reward' as const,
							from: 'treasury',
							to: actor.agentId,
							itemId: null,
							quantity: 0,
							gold: quest.reward,
						}],
					};
					economy.markDirty();

					eventBus.emit({
						type: 'GoldFlowed',
						tick: tickCount(),
						wallClock: Date.now(),
						source: 'BehaviorAgent',
						payload: { category: 'transfer' as const, subcategory: 'quest_reward', amount: quest.reward, fromEntity: 'treasury', toEntity: actor.agentId },
					});
				} else {
					eventBus.emit({
						type: 'QuestRewardSkipped',
						tick: tickCount(),
						wallClock: Date.now(),
						source: 'BehaviorAgent',
						payload: { agentId: actor.agentId, questId: quest.id, reason: 'treasury_empty' },
					});
				}
			}

			// Create positive memory
			const mem = actor.get(MemoryComponent);
			mem.state = {
				...mem.state,
				entries: [...mem.state.entries, {
					tick: tickCount(),
					type: 'quest_completed',
					description: `Completed a ${quest.type} quest at ${quest.facilityId}`,
					participants: [quest.facilityId],
					outcome: 'positive' as const,
					significance: 8,
					mood_impact: 15,
				}],
			};
			mem.markDirty();

			// Mark quest completed
			quest.state = 'completed';
			deps.worldEntity().get(QuestBoardComponent).markDirty();
			memory.activeQuest = null;

			eventBus.emit({
				type: 'QuestCompleted',
				tick: tickCount(),
				wallClock: Date.now(),
				source: 'BehaviorAgent',
				payload: { agentId: actor.agentId, questId: quest.id, questType: quest.type, facilityId: quest.facilityId, reward: quest.reward },
			});

			return SUCCEEDED;
		},

		AbandonQuest(): ActionResult {
			if (memory.activeQuest === null) return FAILED;
			const quest = memory.activeQuest;

			// Create negative memory
			const abandonMem = actor.get(MemoryComponent);
			abandonMem.state = {
				...abandonMem.state,
				entries: [...abandonMem.state.entries, {
					tick: tickCount(),
					type: 'quest_failed',
					description: `Failed a ${quest.type} quest at ${quest.facilityId}`,
					participants: [quest.facilityId],
					outcome: 'negative' as const,
					significance: 5,
					mood_impact: -10,
				}],
			};
			abandonMem.markDirty();

			// Reset quest to open
			quest.state = 'open';
			quest.claimedBy = null;
			quest.repairProgress = 0;
			deps.worldEntity().get(QuestBoardComponent).markDirty();
			memory.activeQuest = null;

			eventBus.emit({
				type: 'QuestAbandoned',
				tick: tickCount(),
				wallClock: Date.now(),
				source: 'BehaviorAgent',
				payload: { agentId: actor.agentId, questId: quest.id, reason: 'abandoned' },
			});

			return SUCCEEDED;
		},

		ContinueCommitment(): ActionResult {
			memory.commitmentTicks--;
			if (memory.commitmentTicks <= 0) {
				memory.committedAction = null;
				return FAILED;
			}
			// Break consumption commitments when the need is satisfied — prevents waste
			const ca = memory.committedAction;
			const needs = actor.get(NeedsComponent).state;
			if (ca === 'eat' && needs.hunger >= memory.personalThresholds.hunger) {
				memory.commitmentTicks = 0;
				memory.committedAction = null;
				return FAILED;
			}
			if (ca === 'drink' && needs.thirst >= memory.personalThresholds.thirst) {
				memory.commitmentTicks = 0;
				memory.committedAction = null;
				return FAILED;
			}
			if (ca === 'rest' && needs.energy >= memory.personalThresholds.energy + config.needs.recovery_hysteresis) {
				memory.commitmentTicks = 0;
				memory.committedAction = null;
				return FAILED;
			}
			if (ca === 'buy' && needs.hunger >= memory.personalThresholds.hunger) {
				memory.commitmentTicks = 0;
				memory.committedAction = null;
				return FAILED;
			}
			// Restore btAction so downstream systems (rest, needs-decay) see the correct activity
			memory.btAction = memory.committedAction;
			return RUNNING;
		},

		// ── Utility methods ────────────────────────────────────────────────
		tickUnemployment(): void {
			if (actor.job === null) {
				memory.unemployedTicks++;
			} else {
				memory.unemployedTicks = 0;
			}
		},

		recordPriceObservation(itemId: string, price: number, locationId: string, tick: number): void {
			memory.priceMemories.push({ itemId, price, locationId, tick });
		},
	};
}
