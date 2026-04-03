import type { Actor } from 'excalibur';
import type { BehaviorAgent, ActionResult, PerceivedAgent, PerceivedLocation, PerceivedFacility, MovementTarget, SkillEntry, ModifierMap } from '../../domain/systems/behavior-agent.js';
import type { JourneyState, CargoState } from '../../domain/core/component-data.js';
import type { GameConfig } from '../../domain/schemas/game-config-schema.js';
import { NeedsComponent } from '../components/needs-component.js';
import { MoodComponent } from '../components/mood-component.js';
import { WalletComponent } from '../components/wallet-component.js';
import { InventoryComponent } from '../components/inventory-component.js';
import { PerceptionComponent } from '../components/perception-component.js';
import { FacilityComponent } from '../components/facility-component.js';
import { AttributesComponent } from '../components/attributes-component.js';
import { TimeComponent } from '../components/time-component.js';
import { NEED_CRITICAL_THRESHOLDS } from '../../domain/schemas/ranges.js';
import { findFoodInInventory, FOOD_ITEMS, TRADE_GOODS } from '../../domain/systems/food-items.js';
import { pickupCargo, deliverCargo } from '../../domain/systems/cargo.js';
import { CircularBuffer } from 'mnemonist';
import { isPriceStale, type PriceMemory } from '../../domain/systems/price-memory.js';
import { calculateReservationPrice } from '../../domain/systems/utility.js';
import type { EventBus } from '../../domain/core/events.js';
import type { AgentActor } from './agent-actor.js';
import type { WorldLocation } from '../../domain/schemas/location-schema.js';

const SUCCEEDED: ActionResult = 'mistreevous.succeeded';
const FAILED: ActionResult = 'mistreevous.failed';
const RUNNING: ActionResult = 'mistreevous.running';


export interface BehaviorAgentDeps {
	actor: AgentActor;
	worldEntity: () => Actor;
	config: GameConfig;
	getLocationActors: () => Map<string, Actor>;
	getLocations: () => WorldLocation[];
	tickCount: () => number;
	eventBus: EventBus;
	swapBehaviorTree?: (jobName: string | null) => void;
	jobsConfig?: GameConfig['jobs'];
}

export function createBehaviorAgent(deps: BehaviorAgentDeps): BehaviorAgent {
	const { actor, worldEntity, config, getLocationActors, getLocations, tickCount, eventBus } = deps;

	// Working memory — lives on this object, not in ECS
	let movementTarget: MovementTarget | null = null;
	let journey: JourneyState | null = null;
	let atLocation: string | null = null;
	let currentRegion = '';
	let haulCargo: CargoState | null = null;
	const socialCooldowns = new Map<string, number>();
	let committedAction: string | null = null;

	// Per-tick cache for nearbyFacilities — avoids redundant computation within a single tick
	let cachedFacilities: PerceivedFacility[] | null = null;
	let cachedFacilitiesTick = -1;

	// System working memory (migrated from BlackboardComponent)
	let btAction: string | null = null;
	let gossipPending: string | null = null;
	let knownLocations: string[] = [];
	let traitModifiers: ModifierMap | null = null;
	let skills: SkillEntry[] = [];
	let feedingAt: string | null = null;
	let restingAt: string | null = null;
	let arrivalSlot: number | null = null;
	let buyTargetItem: string | null = null;
	let unemployedTicks = 0;
	let recovering = false;

	// Per-agent work stagger — offset into dawn before agent considers it "work hours"
	// Uses a simple hash of agentId to spread agents across the first half of dawn
	const dawnDuration = config.day_night.dawn.end - config.day_night.dawn.start + 1;
	const staggerSeed = actor.agentId.split('').reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0);
	const wakeOffset = Math.abs(staggerSeed) % Math.floor(dawnDuration / 2);

	// Price memory
	const priceMemories = new CircularBuffer<PriceMemory>(Array, config.economy.price_memory_max);

	// Helper: resolve nearbyFacilities from location actors with FacilityComponent
	function resolveNearbyFacilities(): PerceivedFacility[] {
		const currentTick = tickCount();
		if (currentTick === cachedFacilitiesTick && cachedFacilities !== null) {
			return cachedFacilities;
		}

		const locationActorMap = getLocationActors();
		const locationList = getLocations();
		const perception = actor.get(PerceptionComponent);
		const facilities: PerceivedFacility[] = [];

		for (const nearLoc of perception.state.nearbyLocations) {
			const locData = locationList.find(l => l.id === nearLoc.id);
			if (locData === undefined) continue;
			const locActor = locationActorMap.get(nearLoc.id);
			if (locActor === undefined || !locActor.has(FacilityComponent)) continue;
			const facility = locActor.get(FacilityComponent);

			// Determine if any input is unmet
			let hasUnmetInput = false;
			if (locData.production?.input !== null && locData.production?.input !== undefined) {
				const needed = locData.production.input;
				const inStock = facility.state.stock.find(s => s.item_id === needed.item_id);
				hasUnmetInput = inStock === undefined || inStock.quantity < needed.quantity;
			}

			facilities.push({
				id: nearLoc.id,
				job: locData.production?.job ?? '',
				stock: [...facility.state.stock],
				distance: nearLoc.distance,
				hasUnmetInput,
				workerId: facility.state.workerId,
			});
		}

		cachedFacilities = facilities;
		cachedFacilitiesTick = currentTick;
		return facilities;
	}

	// Helper: resolve nearbyAgents with positions from perception
	function resolveNearbyAgents(): PerceivedAgent[] {
		const perception = actor.get(PerceptionComponent);
		return perception.state.nearbyAgents.map(a => ({
			id: a.id,
			position: { x: 0, y: 0 }, // Position not stored in PerceptionState; callers use distance
			distance: a.distance,
		}));
	}

	// Helper: resolve nearbyLocations from perception
	function resolveNearbyLocations(): PerceivedLocation[] {
		const perception = actor.get(PerceptionComponent);
		const locationList = getLocations();
		return perception.state.nearbyLocations.map(nl => {
			const locData = locationList.find(l => l.id === nl.id);
			return {
				id: nl.id,
				type: locData?.type ?? nl.type,
				position: locData !== undefined
					? { x: locData.position.x, y: locData.position.y }
					: { x: 0, y: 0 },
				distance: nl.distance,
			};
		});
	}

	// Helper: find location data for atLocation
	function getAtLocationData(): WorldLocation | undefined {
		if (atLocation === null) return undefined;
		return getLocations().find(l => l.id === atLocation);
	}

	const agent: BehaviorAgent = {
		// ── Read-only getters ──────────────────────────────────────────────
		get hunger(): number {
			return actor.get(NeedsComponent).state.hunger;
		},
		get energy(): number {
			return actor.get(NeedsComponent).state.energy;
		},
		get social(): number {
			return actor.get(NeedsComponent).state.social;
		},
		get thirst(): number {
			return actor.get(NeedsComponent).state.thirst;
		},
		get gold(): number {
			return actor.get(WalletComponent).state.gold;
		},
		get mood(): number {
			return actor.get(MoodComponent).state.value;
		},
		get moodBucket(): string {
			return actor.get(MoodComponent).state.bucket;
		},
		get timePhase(): string {
			return worldEntity().get(TimeComponent).state.phase;
		},
		get job(): string | null {
			return actor.job;
		},
		get position(): { x: number; y: number } {
			return { x: actor.pos.x, y: actor.pos.y };
		},
		get inventory(): { item_id: string; quantity: number }[] {
			return actor.get(InventoryComponent).state.items;
		},
		get nearbyAgents(): PerceivedAgent[] {
			return resolveNearbyAgents();
		},
		get nearbyLocations(): PerceivedLocation[] {
			return resolveNearbyLocations();
		},
		get nearbyFacilities(): PerceivedFacility[] {
			return resolveNearbyFacilities();
		},

		// ── Working memory ─────────────────────────────────────────────────
		get movementTarget() { return movementTarget; },
		set movementTarget(v: MovementTarget | null) { movementTarget = v; },

		get journey() { return journey; },
		set journey(v: JourneyState | null) { journey = v; },

		get atLocation() { return atLocation; },
		set atLocation(v: string | null) { atLocation = v; },

		get currentRegion() { return currentRegion; },
		set currentRegion(v: string) { currentRegion = v; },

		get haulCargo() { return haulCargo; },
		set haulCargo(v: CargoState | null) { haulCargo = v; },

		get socialCooldowns() { return socialCooldowns; },

		get committedAction() { return committedAction; },
		set committedAction(v: string | null) { committedAction = v; },

		get btAction() { return btAction; },
		set btAction(v: string | null) { btAction = v; },

		get gossipPending() { return gossipPending; },
		set gossipPending(v: string | null) { gossipPending = v; },

		get knownLocations() { return knownLocations; },
		set knownLocations(v: string[]) { knownLocations = v; },

		get traitModifiers() { return traitModifiers; },
		set traitModifiers(v: ModifierMap | null) { traitModifiers = v; },

		get skills() { return skills; },
		set skills(v: SkillEntry[]) { skills = v; },

		get feedingAt() { return feedingAt; },
		set feedingAt(v: string | null) { feedingAt = v; },

		get restingAt() { return restingAt; },
		set restingAt(v: string | null) { restingAt = v; },

		get arrivalSlot() { return arrivalSlot; },
		set arrivalSlot(v: number | null) { arrivalSlot = v; },

		get buyTargetItem() { return buyTargetItem; },
		set buyTargetItem(v: string | null) { buyTargetItem = v; },

		get unemployedTicks() { return unemployedTicks; },
		set unemployedTicks(v: number) { unemployedTicks = v; },

		get recovering() { return recovering; },
		set recovering(v: boolean) { recovering = v; },

		get priceMemories() { return priceMemories; },

		// ── 25 Condition methods ───────────────────────────────────────────
		IsHungry(): boolean {
			return agent.hunger < config.needs.hunger_threshold;
		},

		IsExhausted(): boolean {
			const exhausted = agent.energy < config.needs.energy_threshold;
			if (exhausted) recovering = true;
			return exhausted;
		},

		IsRecovering(): boolean {
			if (!recovering) return false;
			const recoveredThreshold = config.needs.energy_threshold + config.needs.recovery_hysteresis;
			if (agent.energy >= recoveredThreshold) {
				recovering = false;
				return false;
			}
			return true;
		},

		IsLonely(): boolean {
			return agent.social < config.needs.social_threshold;
		},

		NeedsCritical(): boolean {
			// Social excluded: no recovery mechanism in single-agent mode (social_decay=0).
			// Re-add when multi-agent social interactions are implemented.
			return (
				agent.hunger < NEED_CRITICAL_THRESHOLDS.hunger ||
				agent.energy < NEED_CRITICAL_THRESHOLDS.energy ||
				agent.thirst < NEED_CRITICAL_THRESHOLDS.thirst
			);
		},

		HasFood(): boolean {
			return findFoodInInventory(agent.inventory) !== null;
		},

		HasFoodReserve(): boolean {
			const food = findFoodInInventory(agent.inventory);
			if (food === null) return false;
			return food.quantity > config.needs.food_reserve;
		},

		HasGold(amount: number): boolean {
			return agent.gold >= amount;
		},

		CanAffordFood(): boolean {
			const staleTicks = config.economy.price_memory_stale_ticks;
			const tick = tickCount();
			let cheapestPrice = config.economy.food_price;
			for (const mem of priceMemories) {
				if (FOOD_ITEMS.has(mem.itemId) && !isPriceStale(mem, tick, staleTicks)) {
					if (mem.price < cheapestPrice) cheapestPrice = mem.price;
				}
			}
			if (agent.gold < cheapestPrice) return false;

			const foodCount = agent.inventory
				.filter(i => FOOD_ITEMS.has(i.item_id))
				.reduce((sum, i) => sum + i.quantity, 0);

			const reservationPrice = calculateReservationPrice({
				baseValue: config.economy.food_price,
				needLevel: agent.hunger,
				needThreshold: config.needs.hunger_threshold,
				currentStock: foodCount,
				walletGold: agent.gold,
				urgencyMax: config.economy.reservation_urgency_max,
				stockFactor: config.economy.reservation_stock_factor,
				budgetCap: config.economy.reservation_budget_cap,
				budgetCapCritical: config.economy.reservation_budget_cap_critical,
			});
			return cheapestPrice <= reservationPrice;
		},

		AtLocation(type: string): boolean {
			const locData = getAtLocationData();
			return locData !== undefined && locData.type === type;
		},

		NearLocation(type: string): boolean {
			return agent.nearbyLocations.some(l => l.type === type);
		},

		NearAgent(): boolean {
			return agent.nearbyAgents.length > 0;
		},

		NearAgentClose(): boolean {
			return agent.nearbyAgents.some(a => a.distance < config.perception.interaction_radius);
		},

		IsDaytime(): boolean {
			return agent.timePhase === 'day';
		},

		IsNighttime(): boolean {
			return agent.timePhase === 'night' || agent.timePhase === 'dusk';
		},

		IsWorkHours(): boolean {
			if (agent.timePhase === 'day') return true;
			if (agent.timePhase === 'dawn') {
				const time = worldEntity().get(TimeComponent).state;
				return time.tickInCycle >= config.day_night.dawn.start + wakeOffset;
			}
			return false;
		},

		HasJob(): boolean {
			return agent.job !== null;
		},

		AtJobFacility(): boolean {
			if (atLocation === null || agent.job === null) return false;
			const facilities = agent.nearbyFacilities;
			return facilities.some(f =>
				f.id === atLocation &&
				f.job === agent.job &&
				(f.workerId === null || f.workerId === actor.agentId),
			);
		},

		FacilityHasStock(itemId: string): boolean {
			return agent.nearbyFacilities.some(
				f => f.stock.some(s => s.item_id === itemId && s.quantity > 0),
			);
		},

		HasCargo(): boolean {
			return haulCargo !== null;
		},

		CargoDestinationNearby(): boolean {
			if (haulCargo === null) return false;
			return agent.nearbyLocations.some(l => l.id === haulCargo!.destination);
		},

		FacilityNeedsSupply(): boolean {
			return agent.nearbyFacilities.some(f => f.hasUnmetInput);
		},

		KnowsFoodSource(): boolean {
			const staleTicks = config.economy.price_memory_stale_ticks;
			const tick = tickCount();
			for (const mem of priceMemories) {
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
			return agent.nearbyFacilities.some(f => f.workerId === null);
		},

		OpenProductionFacilityNearby(): boolean {
			return agent.nearbyFacilities.some(f => f.workerId === null && f.job !== '');
		},

		IsThirsty(): boolean {
			return agent.thirst < config.needs.thirst_threshold;
		},

		HasWater(): boolean {
			const inv = actor.get(InventoryComponent).state.items;
			return inv.some(i => i.item_id === 'waterskin' && (i.charges ?? 0) > 0);
		},

		HasTradeGoods(): boolean {
			return agent.inventory.some(i => TRADE_GOODS.has(i.item_id) && i.quantity > 0);
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
			for (const mem of priceMemories) {
				if (mem.itemId === itemId && !isPriceStale(mem, tick, staleTicks)) {
					if (mem.price < cheapestPrice) cheapestPrice = mem.price;
				}
			}
			if (cheapestPrice === Infinity) {
				cheapestPrice = config.economy.food_price; // fallback
			}
			return agent.gold >= cheapestPrice;
		},

		// ── 22 Action methods ──────────────────────────────────────────────
		Eat(): ActionResult {
			const food = findFoodInInventory([...actor.get(InventoryComponent).state.items]);
			if (food === null) return FAILED;
			btAction = 'eat';
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
			btAction = 'drink';
			return SUCCEEDED;
		},

		Harvest(): ActionResult {
			if (atLocation === null) return FAILED;
			const locationActorMap = getLocationActors();
			const locActor = locationActorMap.get(atLocation);
			if (locActor === undefined || !locActor.has(FacilityComponent)) return FAILED;
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
			btAction = 'harvest';
			return SUCCEEDED;
		},

		Rest(): ActionResult {
			btAction = 'rest';
			return RUNNING;
		},

		SeekWater(): ActionResult {
			const waterLocs = agent.nearbyLocations.filter(l => l.type === 'water');
			if (waterLocs.length === 0) return FAILED;
			btAction = 'seek_water';
			const nearest = waterLocs.reduce((a, b) => a.distance < b.distance ? a : b);
			movementTarget = { id: nearest.id, type: 'location' };
			if (atLocation === nearest.id) return SUCCEEDED;
			return RUNNING;
		},

		FillWaterskin(): ActionResult {
			const locData = atLocation !== null ? getLocations().find(l => l.id === atLocation) : undefined;
			if (locData === undefined || locData.type !== 'water') return FAILED;
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
			btAction = 'fill_waterskin';
			return SUCCEEDED;
		},

		SellAtMarket(): ActionResult {
			if (atLocation === null) return FAILED;
			const locData = getLocations().find(l => l.id === atLocation);
			if (locData === undefined || locData.type !== 'market') return FAILED;
			const inv = actor.get(InventoryComponent);
			const sellable = inv.state.items.find(i =>
				(FOOD_ITEMS.has(i.item_id) || TRADE_GOODS.has(i.item_id)) && i.quantity > 0,
			);
			if (sellable === undefined) return FAILED;
			const locationActorMap = getLocationActors();
			const marketActor = locationActorMap.get(atLocation);
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
					fromEntity: atLocation,
					toEntity: actor.agentId,
				},
			});

			btAction = 'sell';
			return SUCCEEDED;
		},

		SeekFood(): ActionResult {
			// Prefer locations with food in stock (market, stocked farm)
			const stockedFacilities = agent.nearbyFacilities.filter(f =>
				f.stock.some(s => FOOD_ITEMS.has(s.item_id) && s.quantity > 0),
			);
			if (stockedFacilities.length > 0) {
				const nearest = stockedFacilities.reduce((a, b) => a.distance < b.distance ? a : b);
				btAction = 'seek_food';
				movementTarget = { id: nearest.id, type: 'location' };
				if (atLocation === nearest.id) return SUCCEEDED;
				return RUNNING;
			}
			// Fallback: food-type locations (farms)
			const foodLocs = agent.nearbyLocations.filter(l => l.type === 'food');
			if (foodLocs.length === 0) return FAILED;
			btAction = 'seek_food';
			const nearest = foodLocs.reduce((a, b) => a.distance < b.distance ? a : b);
			movementTarget = { id: nearest.id, type: 'location' };
			if (atLocation === nearest.id) return SUCCEEDED;
			return RUNNING;
		},

		SeekRest(): ActionResult {
			const restLocs = agent.nearbyLocations.filter(l => l.type === 'rest');
			if (restLocs.length > 0) {
				btAction = 'seek_rest';
				const nearest = restLocs.reduce((a, b) => a.distance < b.distance ? a : b);
				movementTarget = { id: nearest.id, type: 'location' };
				if (atLocation === nearest.id) return SUCCEEDED;
				return RUNNING;
			}

			// Fallback: search all locations (rest outside perception range, e.g. at night)
			const allLocations = getLocations();
			const restLoc = allLocations
				.filter(l => l.type === 'rest')
				.map(l => ({ id: l.id, dist: Math.hypot(l.position.x - actor.pos.x, l.position.y - actor.pos.y) }))
				.sort((a, b) => a.dist - b.dist)[0];
			if (restLoc === undefined) return FAILED;

			btAction = 'seek_rest';
			movementTarget = { id: restLoc.id, type: 'location' };
			if (atLocation === restLoc.id) return SUCCEEDED;
			return RUNNING;
		},

		Buy(): ActionResult {
			if (atLocation === null) return FAILED;
			const atFacility = agent.nearbyFacilities.find(f =>
				f.id === atLocation && f.stock.some(s => FOOD_ITEMS.has(s.item_id) && s.quantity > 0),
			);
			if (atFacility === undefined) return FAILED;
			btAction = 'buy';
			buyTargetItem = null;
			return SUCCEEDED;
		},

		BuyItem(itemId: string): ActionResult {
			if (atLocation === null) return FAILED;
			const atFacility = agent.nearbyFacilities.find(f =>
				f.id === atLocation && f.stock.some(s => s.item_id === itemId && s.quantity > 0),
			);
			if (atFacility === undefined) return FAILED;
			btAction = 'buy';
			buyTargetItem = itemId;
			return SUCCEEDED;
		},

		SeekBestFoodSource(): ActionResult {
			const staleTicks = config.economy.price_memory_stale_ticks;
			const tick = tickCount();
			let cheapestLocation: string | null = null;
			let cheapestPrice = Infinity;

			// Single pass over memories — find cheapest non-stale food price across all items
			for (const mem of priceMemories) {
				if (!FOOD_ITEMS.has(mem.itemId)) continue;
				if (isPriceStale(mem, tick, staleTicks)) continue;
				if (mem.price < cheapestPrice) {
					cheapestPrice = mem.price;
					cheapestLocation = mem.locationId;
				}
			}

			if (cheapestLocation === null) return FAILED;
			btAction = 'seek_food';
			movementTarget = { id: cheapestLocation, type: 'location' };
			if (atLocation === cheapestLocation) return SUCCEEDED;
			return RUNNING;
		},

		ClaimJob(): ActionResult {
			const agentKind = actor.kind;
			const openFacilities = agent.nearbyFacilities.filter(f =>
				f.workerId === null && f.job !== '' && f.job === agentKind,
			);
			if (openFacilities.length === 0) return FAILED;
			const nearest = openFacilities.reduce((a, b) => a.distance < b.distance ? a : b);
			actor.job = nearest.job;
			btAction = 'claim_job';
			return SUCCEEDED;
		},

		ClaimBestJob(): ActionResult {
			const jobsConfig = deps.jobsConfig ?? deps.config.jobs;
			const openFacilities = agent.nearbyFacilities.filter(f =>
				f.workerId === null && f.job !== '',
			);
			if (openFacilities.length === 0) return FAILED;

			let chosen: typeof openFacilities[0];
			if (unemployedTicks >= jobsConfig.desperation_ticks) {
				// Desperate — take nearest regardless of fit
				chosen = openFacilities.reduce((a, b) => a.distance < b.distance ? a : b);
			} else {
				// Score by primary attribute aptitude, tiebreak by distance
				const attrs = actor.get(AttributesComponent).state as unknown as Record<string, number>;
				chosen = openFacilities.reduce((best, f) => {
					const jobDef = jobsConfig.definitions[f.job];
					const fScore = jobDef !== undefined
						? attrs[jobDef.primary_attribute] ?? 0
						: 0;
					const bestDef = jobsConfig.definitions[best.job];
					const bestScore = bestDef !== undefined
						? attrs[bestDef.primary_attribute] ?? 0
						: 0;
					if (fScore > bestScore) return f;
					if (fScore === bestScore && f.distance < best.distance) return f;
					return best;
				});
			}

			actor.job = chosen.job;
			unemployedTicks = 0;
			btAction = 'claim_job';
			deps.swapBehaviorTree?.(chosen.job);
			return SUCCEEDED;
		},

		ReleaseJob(): ActionResult {
			actor.job = null;
			unemployedTicks = 0;
			btAction = null;
			deps.swapBehaviorTree?.(null);
			return SUCCEEDED;
		},

		/** Available for custom BTs — not used in the default tree set. */
		Idle(): ActionResult {
			btAction = 'idle';
			return RUNNING;
		},

		Wander(): ActionResult {
			btAction = 'wander';
			return RUNNING;
		},

		// ── C3: Work + merchant actions ────────────────────────────────────
		Work(): ActionResult {
			if (atLocation === null || agent.job === null) return FAILED;
			const facilities = agent.nearbyFacilities;
			const jobFacility = facilities.find(f =>
				f.id === atLocation &&
				f.job === agent.job &&
				(f.workerId === null || f.workerId === actor.agentId),
			);
			if (jobFacility === undefined) return FAILED;
			btAction = 'work';
			return RUNNING;
		},

		Talk(): ActionResult {
			const closeAgents = agent.nearbyAgents.filter(
				a => a.distance < config.perception.interaction_radius,
			);
			if (closeAgents.length === 0) return FAILED;
			btAction = 'talk';
			return RUNNING;
		},

		SeekWork(): ActionResult {
			if (agent.job === null) return FAILED;

			// Only target facilities that are unoccupied or already assigned to this agent
			const availableFacility = agent.nearbyFacilities.find(f =>
				f.job === agent.job && (f.workerId === null || f.workerId === actor.agentId),
			);
			if (availableFacility !== undefined) {
				btAction = 'seek_work';
				movementTarget = { id: availableFacility.id, type: 'location' };
				if (atLocation === availableFacility.id) return SUCCEEDED;
				return RUNNING;
			}

			// Fallback: search all locations (for facilities outside perception range)
			const allLocations = getLocations();
			const jobLoc = allLocations.find(
				l => l.production !== null && l.production.job === agent.job,
			);
			if (jobLoc === undefined) return FAILED;

			// If already at the facility but it's occupied, don't re-target — fail gracefully
			if (atLocation === jobLoc.id) return FAILED;

			btAction = 'seek_work';
			movementTarget = { id: jobLoc.id, type: 'location' };
			return RUNNING;
		},

		SeekSocial(): ActionResult {
			const nearby = agent.nearbyAgents;
			if (nearby.length === 0) return FAILED;

			btAction = 'seek_social';
			const nearest = nearby.reduce((a, b) => a.distance < b.distance ? a : b);
			movementTarget = { id: nearest.id, type: 'agent' };

			if (nearest.distance < config.perception.interaction_radius) return SUCCEEDED;
			return RUNNING;
		},

		SeekMarket(): ActionResult {
			const marketLocs = agent.nearbyLocations.filter(l => l.type === 'market');
			if (marketLocs.length === 0) return FAILED;

			btAction = 'seek_market';
			const nearest = marketLocs.reduce((a, b) => a.distance < b.distance ? a : b);
			movementTarget = { id: nearest.id, type: 'location' };

			if (atLocation === nearest.id) return SUCCEEDED;
			return RUNNING;
		},

		PickupCargo(): ActionResult {
			btAction = 'pickup_cargo';
			// Find nearest facility with output stock
			const facilitiesWithOutput = agent.nearbyFacilities.filter(
				f => f.stock.some(s => s.quantity > 0),
			);
			if (facilitiesWithOutput.length === 0) return FAILED;

			const source = facilitiesWithOutput.reduce((a, b) => a.distance < b.distance ? a : b);
			const stockItem = source.stock.find(s => s.quantity > 0);
			if (stockItem === undefined) return FAILED;

			// Find destination facility that needs this item as input
			const allLocations = getLocations();
			const destLoc = allLocations.find(l => {
				if (l.id === source.id || l.production === null || l.production.input === null) return false;
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

			haulCargo = result.cargo;
			return SUCCEEDED;
		},

		DeliverCargo(): ActionResult {
			if (haulCargo === null) return FAILED;
			if (atLocation !== haulCargo.destination) return FAILED;
			btAction = 'deliver_cargo';

			const locActors = getLocationActors();
			const destActor = locActors.get(haulCargo.destination);
			if (destActor === undefined) return FAILED;

			const destFac = destActor.get(FacilityComponent);
			const result = deliverCargo({
				cargo: haulCargo,
				destinationStock: destFac.state.stock,
			});

			destFac.state = { ...destFac.state, stock: result.newStock };
			destFac.markDirty();

			haulCargo = null;
			return SUCCEEDED;
		},

		SeekDeliveryTarget(): ActionResult {
			if (haulCargo === null) return FAILED;
			btAction = 'seek_delivery';
			movementTarget = { id: haulCargo.destination, type: 'location' };
			if (atLocation === haulCargo.destination) return SUCCEEDED;
			return RUNNING;
		},

		SeekSupplySource(): ActionResult {
			// Find nearest facility with unmet input
			const needyFacilities = agent.nearbyFacilities.filter(f => f.hasUnmetInput);
			if (needyFacilities.length === 0) return FAILED;
			btAction = 'seek_supply';

			const needy = needyFacilities.reduce((a, b) => a.distance < b.distance ? a : b);

			// Find the PRODUCING facility (source) for the needed item
			const allLocations = getLocations();
			const needyLoc = allLocations.find(l => l.id === needy.id);
			if (needyLoc === undefined || needyLoc.production === null || needyLoc.production.input === null) return FAILED;

			const neededItemId = needyLoc.production.input.item_id;
			const sourceLoc = allLocations.find(l => {
				if (l.id === needy.id || l.production === null) return false;
				return l.production.output.item_id === neededItemId;
			});
			if (sourceLoc === undefined) return FAILED;

			movementTarget = { id: sourceLoc.id, type: 'location' };
			if (atLocation === sourceLoc.id) return SUCCEEDED;
			return RUNNING;
		},

		// ── Utility methods ────────────────────────────────────────────────
		tickUnemployment(): void {
			if (actor.job === null) {
				unemployedTicks++;
			} else {
				unemployedTicks = 0;
			}
		},

		recordPriceObservation(itemId: string, price: number, locationId: string, tick: number): void {
			priceMemories.push({ itemId, price, locationId, tick });
		},
	};

	return agent;
}
