import type { Actor } from 'excalibur';
import type { BehaviorAgent, PerceivedAgent, PerceivedLocation, PerceivedFacility } from '../../domain/systems/behavior-agent.js';
import type { GameConfig } from '../../domain/schemas/game-config-schema.js';
import { NeedsComponent } from '../components/needs-component.js';
import { MoodComponent } from '../components/mood-component.js';
import { WalletComponent } from '../components/wallet-component.js';
import { InventoryComponent } from '../components/inventory-component.js';
import { PerceptionComponent } from '../components/perception-component.js';
import { FacilityComponent } from '../components/facility-component.js';
import { TimeComponent } from '../components/time-component.js';
import type { EventBus } from '../../domain/core/events.js';
import type { AgentActor } from './agent-actor.js';
import type { WorldLocation } from '../../domain/schemas/location-schema.js';
import { createWorkingMemory } from './bt-working-memory.js';
import { createConditions } from './bt-conditions.js';
import { createActions } from './bt-actions.js';


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
	const { actor, worldEntity, config, getLocationActors, getLocations, tickCount } = deps;
	const memory = createWorkingMemory(config.economy.price_memory_max);

	// Per-tick facility cache (internal, not on WorkingMemory)
	let cachedFacilities: PerceivedFacility[] | null = null;
	let cachedFacilitiesTick = -1;

	// Wake stagger offset
	const dawnDuration = config.day_night.dawn.end - config.day_night.dawn.start + 1;
	const staggerSeed = actor.agentId.split('').reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0);
	const wakeOffset = Math.abs(staggerSeed) % Math.floor(dawnDuration / 2);

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
			if (locActor?.has(FacilityComponent) !== true) continue;
			const facility = locActor.get(FacilityComponent);

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
				wage: locData.production?.wage ?? 0,
			});
		}

		cachedFacilities = facilities;
		cachedFacilitiesTick = currentTick;
		return facilities;
	}

	function resolveNearbyAgents(): PerceivedAgent[] {
		const perception = actor.get(PerceptionComponent);
		return perception.state.nearbyAgents.map(a => ({
			id: a.id,
			position: { x: 0, y: 0 },
			distance: a.distance,
		}));
	}

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

	function getAtLocationData(): WorldLocation | undefined {
		if (memory.atLocation === null) return undefined;
		return getLocations().find(l => l.id === memory.atLocation);
	}

	const conditions = createConditions(memory, actor, deps, resolveNearbyFacilities, resolveNearbyAgents, resolveNearbyLocations, getAtLocationData, wakeOffset);
	const actions = createActions(memory, actor, deps, resolveNearbyFacilities, resolveNearbyAgents, resolveNearbyLocations);

	const agent: BehaviorAgent = {
		// ── Read-only getters ──────────────────────────────────────────────
		get hunger(): number { return actor.get(NeedsComponent).state.hunger; },
		get energy(): number { return actor.get(NeedsComponent).state.energy; },
		get social(): number { return actor.get(NeedsComponent).state.social; },
		get thirst(): number { return actor.get(NeedsComponent).state.thirst; },
		get gold(): number { return actor.get(WalletComponent).state.gold; },
		get mood(): number { return actor.get(MoodComponent).state.value; },
		get moodBucket(): string { return actor.get(MoodComponent).state.bucket; },
		get timePhase(): string { return worldEntity().get(TimeComponent).state.phase; },
		get job(): string | null { return actor.job; },
		get position(): { x: number; y: number } { return { x: actor.pos.x, y: actor.pos.y }; },
		get inventory(): { item_id: string; quantity: number }[] { return actor.get(InventoryComponent).state.items; },
		get nearbyAgents(): PerceivedAgent[] { return resolveNearbyAgents(); },
		get nearbyLocations(): PerceivedLocation[] { return resolveNearbyLocations(); },
		get nearbyFacilities(): PerceivedFacility[] { return resolveNearbyFacilities(); },

		// ── Working memory — delegate to memory object ─────────────────────
		get movementTarget() { return memory.movementTarget; },
		set movementTarget(v) { memory.movementTarget = v; },
		get journey() { return memory.journey; },
		set journey(v) { memory.journey = v; },
		get atLocation() { return memory.atLocation; },
		set atLocation(v) { memory.atLocation = v; },
		get currentRegion() { return memory.currentRegion; },
		set currentRegion(v) { memory.currentRegion = v; },
		get haulCargo() { return memory.haulCargo; },
		set haulCargo(v) { memory.haulCargo = v; },
		get socialCooldowns() { return memory.socialCooldowns; },
		get committedAction() { return memory.committedAction; },
		set committedAction(v) { memory.committedAction = v; },
		get btAction() { return memory.btAction; },
		set btAction(v) { memory.btAction = v; },
		get gossipPending() { return memory.gossipPending; },
		set gossipPending(v) { memory.gossipPending = v; },
		get knownLocations() { return memory.knownLocations; },
		set knownLocations(v) { memory.knownLocations = v; },
		get traitModifiers() { return memory.traitModifiers; },
		set traitModifiers(v) { memory.traitModifiers = v; },
		get skills() { return memory.skills; },
		set skills(v) { memory.skills = v; },
		get feedingAt() { return memory.feedingAt; },
		set feedingAt(v) { memory.feedingAt = v; },
		get restingAt() { return memory.restingAt; },
		set restingAt(v) { memory.restingAt = v; },
		get arrivalSlot() { return memory.arrivalSlot; },
		set arrivalSlot(v) { memory.arrivalSlot = v; },
		get buyTargetItem() { return memory.buyTargetItem; },
		set buyTargetItem(v) { memory.buyTargetItem = v; },
		get unemployedTicks() { return memory.unemployedTicks; },
		set unemployedTicks(v) { memory.unemployedTicks = v; },
		get recovering() { return memory.recovering; },
		set recovering(v) { memory.recovering = v; },
		get priceMemories() { return memory.priceMemories; },

		// ── Conditions + Actions (spread from extracted modules) ───────────
		...conditions,
		...actions,
	};

	return agent;
}
