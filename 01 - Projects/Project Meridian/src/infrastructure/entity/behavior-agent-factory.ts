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
import { TimeComponent } from '../components/time-component.js';
import { EconomyComponent } from '../components/economy-component.js';
import { NEED_CRITICAL_THRESHOLDS } from '../../domain/schemas/ranges.js';
import { findFoodInInventory, removeFromInventory } from '../../domain/systems/food-items.js';
import { applyFeed } from '../../domain/systems/feed.js';
import { applyRest } from '../../domain/systems/rest.js';
import { applyTrade } from '../../domain/systems/trade.js';
import { pickupCargo, deliverCargo } from '../../domain/systems/cargo.js';
import type { AgentActor } from './agent-actor.js';
import type { WorldLocation } from '../../domain/schemas/location-schema.js';

const SUCCEEDED: ActionResult = 'mistreevous.succeeded';
const FAILED: ActionResult = 'mistreevous.failed';
const RUNNING: ActionResult = 'mistreevous.running';

const DEFAULT_HUNGER_THRESHOLD = 50;
const DEFAULT_ENERGY_THRESHOLD = 30;
const DEFAULT_SOCIAL_THRESHOLD = 40;

export interface BehaviorAgentDeps {
	actor: AgentActor;
	worldEntity: () => Actor;
	config: GameConfig;
	getLocationActors: () => Map<string, Actor>;
	getLocations: () => WorldLocation[];
	tickCount: () => number;
}

export function createBehaviorAgent(deps: BehaviorAgentDeps): BehaviorAgent {
	const { actor, worldEntity, config, getLocationActors, getLocations, tickCount } = deps;

	// Working memory — lives on this object, not in ECS
	let movementTarget: MovementTarget | null = null;
	let journey: JourneyState | null = null;
	let atLocation: string | null = null;
	let currentRegion = '';
	let haulCargo: CargoState | null = null;
	const socialCooldowns = new Map<string, number>();
	let committedAction: string | null = null;

	// System working memory (migrated from BlackboardComponent)
	let btAction: string | null = null;
	let gossipPending: string | null = null;
	let knownLocations: string[] = [];
	let traitModifiers: ModifierMap | null = null;
	let skills: SkillEntry[] = [];
	let feedingAt: string | null = null;
	let restingAt: string | null = null;
	let arrivalSlot: number | null = null;

	// Helper: resolve nearbyFacilities from location actors with FacilityComponent
	function resolveNearbyFacilities(): PerceivedFacility[] {
		const locationActorMap = getLocationActors();
		const locationList = getLocations();
		const perception = actor.get(PerceptionComponent);
		const facilities: PerceivedFacility[] = [];

		for (const nearLoc of perception.state.nearbyLocations) {
			const locData = locationList.find(l => l.id === nearLoc.id);
			if (locData === undefined || locData.production === null) continue;
			const locActor = locationActorMap.get(nearLoc.id);
			if (locActor === undefined) continue;
			const facility = locActor.get(FacilityComponent);

			// Determine if any input is unmet
			let hasUnmetInput = false;
			if (locData.production.input !== null) {
				const needed = locData.production.input;
				const inStock = facility.state.stock.find(s => s.item_id === needed.item_id);
				hasUnmetInput = inStock === undefined || inStock.quantity < needed.quantity;
			}

			facilities.push({
				id: nearLoc.id,
				job: locData.production.job,
				stock: [...facility.state.stock],
				distance: nearLoc.distance,
				hasUnmetInput,
			});
		}
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
		set socialCooldowns(_v: Map<string, number>) { /* noop — use the map directly */ },

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

		// ── 19 Condition methods ───────────────────────────────────────────
		IsHungry(): boolean {
			return agent.hunger < DEFAULT_HUNGER_THRESHOLD;
		},

		IsExhausted(): boolean {
			return agent.energy < DEFAULT_ENERGY_THRESHOLD;
		},

		IsLonely(): boolean {
			return agent.social < DEFAULT_SOCIAL_THRESHOLD;
		},

		NeedsCritical(): boolean {
			return (
				agent.hunger < NEED_CRITICAL_THRESHOLDS.hunger ||
				agent.energy < NEED_CRITICAL_THRESHOLDS.energy ||
				agent.social < NEED_CRITICAL_THRESHOLDS.social
			);
		},

		HasFood(): boolean {
			return findFoodInInventory(agent.inventory) !== null;
		},

		HasGold(amount: number): boolean {
			return agent.gold >= amount;
		},

		CanAffordFood(): boolean {
			return agent.gold >= config.economy.food_price;
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

		HasJob(): boolean {
			return agent.job !== null;
		},

		AtJobFacility(): boolean {
			if (atLocation === null || agent.job === null) return false;
			const facilities = agent.nearbyFacilities;
			return facilities.some(f => f.id === atLocation && f.job === agent.job);
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

		// ── 16 Action methods ──────────────────────────────────────────────
		Eat(): ActionResult {
			const food = findFoodInInventory(agent.inventory);
			if (food === null) return FAILED;

			btAction = 'eat';

			const result = applyFeed(
				{ currentHunger: agent.hunger },
				{ recovery_rate: config.needs.food_recovery_rate },
			);

			const needs = actor.get(NeedsComponent);
			needs.state = { ...needs.state, hunger: result.newHunger };
			needs.markDirty();

			const inv = actor.get(InventoryComponent);
			inv.state = { ...inv.state, items: removeFromInventory(agent.inventory, food.item_id, 1) };
			inv.markDirty();

			return RUNNING;
		},

		Rest(): ActionResult {
			btAction = 'rest';
			const restTier = atLocation !== null ? 'public_shelter' as const : 'outdoors' as const;
			const result = applyRest(
				{ currentEnergy: agent.energy, restTier },
				config.rest_tiers,
			);

			const needs = actor.get(NeedsComponent);
			needs.state = { ...needs.state, energy: result.newEnergy };
			needs.markDirty();

			return RUNNING;
		},

		SeekFood(): ActionResult {
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
			if (restLocs.length === 0) return FAILED;

			btAction = 'seek_rest';
			const nearest = restLocs.reduce((a, b) => a.distance < b.distance ? a : b);
			movementTarget = { id: nearest.id, type: 'location' };

			if (atLocation === nearest.id) return SUCCEEDED;
			return RUNNING;
		},

		Buy(): ActionResult {
			btAction = 'buy';
			const facilitiesWithFood = agent.nearbyFacilities.filter(
				f => f.stock.some(s => s.item_id === 'bread' && s.quantity > 0),
			);
			if (facilitiesWithFood.length === 0) return FAILED;

			const facility = facilitiesWithFood[0]!;
			const tradeResult = applyTrade({
				agentGold: agent.gold,
				price: config.economy.food_price,
				facilityFund: facility.stock.length, // not used by applyTrade
				itemId: 'bread',
				quantity: 1,
			});

			if (!tradeResult.success) return FAILED;

			// Deduct gold from wallet
			const wallet = actor.get(WalletComponent);
			wallet.state = { ...wallet.state, gold: wallet.state.gold + tradeResult.agentGoldChange };
			wallet.markDirty();

			// Add bread to inventory
			const inv = actor.get(InventoryComponent);
			const existingBread = inv.state.items.find(i => i.item_id === 'bread');
			if (existingBread !== undefined) {
				inv.state = {
					...inv.state,
					items: inv.state.items.map(i =>
						i.item_id === 'bread' ? { ...i, quantity: i.quantity + 1 } : { ...i },
					),
				};
			} else {
				inv.state = {
					...inv.state,
					items: [...inv.state.items, { item_id: 'bread', quantity: 1 }],
				};
			}
			inv.markDirty();

			// Increment facility fund
			const locActors = getLocationActors();
			const facActor = locActors.get(facility.id);
			if (facActor !== undefined) {
				const facComp = facActor.get(FacilityComponent);
				facComp.state = { ...facComp.state, fund: facComp.state.fund + config.economy.food_price };
				facComp.markDirty();
			}

			// Record ledger entry on world economy
			const world = worldEntity();
			const econ = world.get(EconomyComponent);
			econ.state = {
				...econ.state,
				ledger: [
					...econ.state.ledger,
					{
						tick: tickCount(),
						type: 'purchase' as const,
						from: actor.agentId,
						to: facility.id,
						itemId: 'bread',
						quantity: 1,
						gold: config.economy.food_price,
					},
				],
			};
			econ.markDirty();

			return SUCCEEDED;
		},

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
			btAction = 'work';
			const facilities = agent.nearbyFacilities;
			const jobFacility = facilities.find(f => f.id === atLocation && f.job === agent.job);
			if (jobFacility === undefined) return FAILED;
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
			const allLocations = getLocations();
			const jobLoc = allLocations.find(
				l => l.production !== null && l.production.job === agent.job,
			);
			if (jobLoc === undefined) return FAILED;

			btAction = 'seek_work';
			movementTarget = { id: jobLoc.id, type: 'location' };
			if (atLocation === jobLoc.id) return SUCCEEDED;
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
	};

	return agent;
}
