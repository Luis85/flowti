/**
 * engine-simulation.ts — Preframe simulation loop with 5-stage blackboard pipeline.
 *
 * tickSimulation() is called once per frame from engine.ts and orchestrates
 * all system updates in a precise order:
 *   1. World time (clock, events)
 *   2. Sensors (needs, sensors, blackboard data gathering)
 *   3. Decisions (pet BT, agent BT — write to blackboards)
 *   4. Execution (push blackboard → components, locomotion, pull back)
 *   5. World systems + Presentation (interactions, social, director, visuals)
 */

import type { EngineContext } from "./engine-types.js";
import type { InteractableActor } from "./actors/interactable-actor.js";
import { tickSensors, type SensorDeps } from "./systems/sensor-phase.js";
import { renderInteractionActions } from "./systems/interaction/interaction-effect-renderer.js";
import { PetSceneEntity } from "./actors/pet-scene-entity.js";
import type { ReactiveTrigger } from "./systems/talk/templates/reactive-phrases.js";
import {
	DOMAIN_PARTICLE_COLORS, DEFAULT_PARTICLE_COLOR,
	LIGHT_LERP_SPEED, ENGINE_WIDTH, ENGINE_HEIGHT,
	ROOM_OFFSETS, UNKNOWN_ROOM_OFFSET,
	TRAIL_DISTANCE_SQ, TRAIL_Y_OFFSET,
	WEATHER_PARTICLE_CHANCE, WEATHER_PARTICLE_LIFETIME, WEATHER_PARTICLE_OPACITY, AMBIENT_PARTICLE_CHANCE,
	DOG_FOLLOW_CHANCE, CAT_FOLLOW_STRESSED_CHANCE, CAT_STRESS_MORALE_THRESHOLD,
	REACTIVE_THRESHOLDS,
} from "./engine-config.js";
import {
	HUNGER_PHRASES, THIRST_PHRASES,
} from "./systems/talk/templates/sustenance-phrases.js";
import { selectPetVoice } from "./systems/talk/pet-voice-selector.js";
import {
	PET_INSTINCT_FRAGMENTS, PET_ELOQUENT_FRAGMENTS, PET_GREMLIN_FRAGMENTS,
} from "./systems/talk/templates/index.js";
import type { CascadeReaction } from "./systems/echo/cascade-resolver.js";
import type { AgentBlackboard, AgentIntent, AgentNeeds } from "./systems/blackboard.js";

// ── Blackboard helpers ────────────────────────────────────────────────

/** Read agent intent from blackboard (replaces brain.getState). */
function getIntent(ctx: EngineContext, name: string): AgentIntent {
	return ctx.systems.blackboards.tryGet(name)?.intent ?? "idle";
}

/** Read agent position from blackboard (replaces brain.getPosition). */
function getPosition(ctx: EngineContext, name: string): { x: number; y: number } | null {
	return ctx.systems.blackboards.tryGet(name)?.position ?? null;
}

// ── Cascade queue — reactions enqueued by echo threshold crossings ────
const cascadeQueue: CascadeReaction[] = [];

/** Push a cascade reaction into the queue (called from EchoProducer's onCascade callback). */
export function pushCascadeReaction(reaction: CascadeReaction): void {
	cascadeQueue.push(reaction);
}

// ── Composite tick — called from engine.ts preframe hook ─────────────

/** Run one simulation phase and record duration when `ctx.state.perfSampler` is set. */
function runTimedPhase(ctx: EngineContext, phase: string, fn: (c: EngineContext) => void): void {
	const sink = ctx.state.perfSampler;
	if (!sink) {
		fn(ctx);
		return;
	}
	const t0 = performance.now();
	fn(ctx);
	sink.onPhase(phase, performance.now() - t0);
}

/** Time one agent's canvas slice for {@link perf.agentWorld.sample} `perAgentCanvas` (no-op when sampler off). */
export function runAgentSlice(ctx: EngineContext, agentName: string, slice: string, fn: () => void): void {
	const onSlice = ctx.state.perfSampler?.onAgentSlice;
	if (!onSlice) {
		fn();
		return;
	}
	const t0 = performance.now();
	fn();
	onSlice.call(ctx.state.perfSampler!, agentName, slice, performance.now() - t0);
}

/** Time a named game system for {@link perf.agentWorld.sample} `gameSystems` (no-op when sampler off). */
export function runTimedGameSystem(ctx: EngineContext, systemId: string, fn: () => void): void {
	const sink = ctx.state.perfSampler;
	if (!sink) {
		fn();
		return;
	}
	const t0 = performance.now();
	fn();
	sink.onGameSystem(systemId, performance.now() - t0);
}

export function tickSimulation(ctx: EngineContext): void {
	// ── World time ───────────────────────────────────
	runTimedPhase(ctx, "clock", tickClock);

	// ── Sensors (write to blackboard) ────────────────
	runTimedPhase(ctx, "needs", tickNeeds);
	runTimedPhase(ctx, "sensor", tickSensor);
	runTimedPhase(ctx, "sensors", tickBlackboardSensors);

	// ── Decisions (BT reads/writes blackboard) ───────
	runTimedPhase(ctx, "pets", tickPets);
	runTimedPhase(ctx, "behaviorTree", tickBehaviorTree);

	// ── Execution (blackboard → components → movement)
	runTimedPhase(ctx, "locomotion", tickLocomotion);

	// ── World systems (read intent/position) ─────────
	runTimedPhase(ctx, "roomTransit", tickRoomTransit);
	runTimedPhase(ctx, "interactions", tickInteractions);
	runTimedPhase(ctx, "social", tickSocial);

	// ── Presentation (read intent, show effects) ─────
	runTimedPhase(ctx, "director", tickDirector);
	runTimedPhase(ctx, "reactiveTriggers", tickReactiveTriggers);
	runTimedPhase(ctx, "visuals", tickVisuals);
}

// ── 1. tickClock — day clock, world event scheduler, cycle boundary ──

export function tickClock(ctx: EngineContext): void {
	const { systems: sys, state } = ctx;
	sys.dayClock.update(state.deltaMs);
	ctx.store.setDayProgress(sys.dayClock.getCycleProgress(), sys.dayClock.getCycleCount());

	if (sys.dayClock.getCycleCount() > state.prevCycleCount) {
		state.prevCycleCount = sys.dayClock.getCycleCount();
		sys.worldAmbience.onCycleComplete();
		for (const agentName of sys.needs.getAgentNames()) {
			sys.memory.onCycleEnd(agentName, {
				completedTask: ctx.store.taskLockedAgents.has(agentName),
				conversations: state.cycleConversationCounts.get(agentName) ?? 0,
				dominantMood: sys.needs.getMood(agentName),
			});
			state.cycleConversationCounts.set(agentName, 0);
		}
		// Bonded pet morale bonus — +5 morale per cycle to bonded agent
		for (const pet of ctx.pets) {
			const bonded = pet.getBondedAgent();
			if (bonded) {
				sys.needs.applyEffect(bonded, { morale: 5 });
			}
		}
		sys.worldEvent.onCycleReset();
		state.firedReactiveTriggers.clear();
		sys.relationship.onCycleEnd(sys.echo);

		// Echo system — decay all echoes and reset cascade budget at cycle boundary
		sys.echo.decayAll(sys.dayClock.getCycleCount());
		sys.echo.resetCascadeBudget();
		ctx.cascadeResolver.resetCycle();
	}

	sys.worldEvent.update(state.deltaMs);
}

// ── 2. tickSensor — sensor cooldowns and queued feedback ─────────────

export function tickSensor(ctx: EngineContext): void {
	runTimedGameSystem(ctx, "sensor", () => {
		ctx.systems.sensor.update(ctx.state.deltaMs);
	});
}

// ── 2b. tickBlackboardSensors — write world state to agent blackboards ──

export function tickBlackboardSensors(ctx: EngineContext): void {
	const { systems: sys } = ctx;
	const sensorDeps: SensorDeps = {
		getAgentNames: () => sys.needs.getAgentNames(),
		getNeeds: (name) => sys.needs.getNeeds(name),
		getRoom: (name) => sys.registry.getEntityRoom(name) ?? "",
		getNearbyAgents: (name) => getNearbyAgents(ctx, name),
		getNearbyEntities: (name) => [], // TODO: wire interaction entity query
		getNearestStation: (name, need) => {
			const foodStations = [ctx.envObjects.snackTable, ctx.envObjects.foodBowlHub, ctx.envObjects.foodBowlVillage];
			const drinkStations = [ctx.envObjects.coffeeMachine, ctx.envObjects.waterCooler, ctx.envObjects.waterBowlOffice, ctx.envObjects.waterBowlStation];
			const restStations = [ctx.envObjects.couch];
			const candidates = need === "food" ? foodStations : need === "drink" ? drinkStations : restStations;
			return findNearestUnoccupiedStation(ctx, name, candidates);
		},
		getNearestWorkstation: (name) => {
			// Delegate to scene workstation resolver
			for (const room of Object.values(ctx.scenes.map)) {
				const actor = room.getAgentActor(name);
				if (!actor) continue;
				const workstations = room.getWorkstations();
				let nearest: { x: number; y: number } | null = null;
				let minDist = Infinity;
				for (const ws of workstations) {
					if (ws.occupied) continue;
					const dx = ws.pos.x - actor.pos.x;
					const dy = ws.pos.y - actor.pos.y;
					const dist = dx * dx + dy * dy;
					if (dist < minDist) { minDist = dist; nearest = { x: ws.pos.x, y: ws.pos.y }; }
				}
				return nearest;
			}
			return null;
		},
		getNearestMerchantStall: (name) => findNearestUnoccupiedStation(ctx, name, [ctx.envObjects.merchantStall]),
		getWhimTarget: (name) => {
			const bond = sys.echo.getStrongest(name, "bond");
			if (!bond?.target || bond.weight <= 15) return null;
			if (!sys.blackboards.has(bond.target)) return null;
			const targetBb = sys.blackboards.get(bond.target);
			const agentRoom = sys.registry.getEntityRoom(name);
			const targetRoom = sys.registry.getEntityRoom(bond.target);
			if (agentRoom !== targetRoom) return null;
			return { x: targetBb.position.x, y: targetBb.position.y };
		},
		getWanderHint: (name) => {
			const bondTarget = sys.echo.getStrongest(name, "bond");
			if (!bondTarget?.target || Math.random() >= 0.4) return null;
			const targetPos = sys.blackboards.has(bondTarget.target) ? sys.blackboards.get(bondTarget.target).position : null;
			if (!targetPos) return null;
			return {
				x: targetPos.x + (Math.random() - 0.5) * 60,
				y: targetPos.y + (Math.random() - 0.5) * 60,
			};
		},
		getCascadeHint: () => null, // Cascades handled in tickSocial
		getRoomAvoidance: (name) => {
			const aversion = sys.echo.getStrongest(name, "aversion");
			const allRooms = sys.registry.getAllSceneIds();
			if (aversion?.target && allRooms.includes(aversion.target)) return aversion.target;
			return null;
		},
		getBreakThresholdBias: (name) => sys.echo.queryWeight(name, "mood-residue"),
	};
	tickSensors(sys.blackboards, sensorDeps);
}

function findNearestUnoccupiedStation(ctx: EngineContext, agentName: string, candidates: InteractableActor[]): { x: number; y: number } | null {
	const agentRoom = ctx.systems.registry.getEntityRoom(agentName);
	let agentPos: { x: number; y: number } | null = null;

	// Find agent position from any room they're in
	for (const room of Object.values(ctx.scenes.map)) {
		const actor = room.getAgentActor(agentName);
		if (actor) { agentPos = { x: actor.pos.x, y: actor.pos.y }; break; }
	}
	if (!agentPos) return null;

	// First pass: prefer stations in the agent's current room
	let nearest: { x: number; y: number } | null = null;
	let minDist = Infinity;
	for (const station of candidates) {
		if (!station || station.isOccupied()) continue;
		const stationRoom = ctx.systems.registry.getObjectRoom(station.objectId);
		if (stationRoom && stationRoom !== agentRoom) continue;
		const point = station.getInteractionPoint();
		const dx = point.x - agentPos.x;
		const dy = point.y - agentPos.y;
		const dist = dx * dx + dy * dy;
		if (dist < minDist) { minDist = dist; nearest = point; }
	}
	if (nearest) return nearest;

	// Second pass: fall back to any unoccupied station in any room
	for (const station of candidates) {
		if (!station || station.isOccupied()) continue;
		const point = station.getInteractionPoint();
		const dx = point.x - agentPos.x;
		const dy = point.y - agentPos.y;
		const dist = dx * dx + dy * dy;
		if (dist < minDist) { minDist = dist; nearest = point; }
	}
	return nearest;
}

// ── 3. tickNeeds — decay/restore needs + mood propagation ────────────

export function tickNeeds(ctx: EngineContext): void {
	const { systems: sys, state } = ctx;
	runTimedGameSystem(ctx, "needs", () => {
		sys.needs.update(
			state.deltaMs,
			(name) => getIntent(ctx, name),
			(name) => getNearbyAgents(ctx, name),
			sys.dayClock.getPhaseMultipliers(),
		);
	});

	// Mood propagation — push derived mood into emote + talk systems
	// Echo hints (wander, break bias, room avoidance) are handled by tickBlackboardSensors.
	for (const agentName of sys.needs.getAgentNames()) {
		runAgentSlice(ctx, agentName, "needs", () => {
			const mood = sys.needs.getMood(agentName);
			sys.emote.updateMood(agentName, mood);

			// Echo producer — morale threshold echo generation
			const morale = sys.needs.getNeeds(agentName).morale;
			ctx.echoProducer.onMorale(agentName, morale, sys.dayClock.getCycleCount());

			// Room avoidance — if agent is in the avoided room, request a transfer
			if (sys.blackboards.has(agentName)) {
				const bb = sys.blackboards.get(agentName);
				if (bb.roomAvoidance) {
					const currentRoom = sys.registry.getEntityRoom(agentName);
					const allRooms = sys.registry.getAllSceneIds();
					if (currentRoom === bb.roomAvoidance && allRooms.length > 1) {
						const otherRooms = allRooms.filter((r) => r !== currentRoom);
						const targetRoom = otherRooms[Math.floor(Math.random() * otherRooms.length)];
						sys.roomSwitcher.requestTransfer({ entityId: agentName, targetRoom, reason: "purpose" });
					}
				}
			}

			// Feed rich context to talk engine
			const nearby = getNearbyAgents(ctx, agentName);
			const nearbyAgent = nearby[0] ?? "";
			const nearbyDomain = nearbyAgent ? (ctx.store.agents.find((a) => a.name === nearbyAgent)?.domain ?? "") : "";
			sys.talk.updateVars(agentName, {
				mood,
				mood_adj: mood === "neutral" ? "focused" : mood,
				phase: sys.dayClock.getPhase(),
				weather: sys.worldAmbience.getWeather(),
				streak: String(sys.memory.getMemory(agentName).workStreak),
				nearby_agent: nearbyAgent,
				nearby_domain: nearbyDomain,
			});
		});
	}
}

// ── 4. tickReactiveTriggers — energy/mood/focus threshold talk ────────

export function tickReactiveTriggers(ctx: EngineContext): void {
	const { systems: sys, state } = ctx;
	runTimedGameSystem(ctx, "reactiveTriggers", () => {
		for (const agentName of sys.needs.getAgentNames()) {
			runAgentSlice(ctx, agentName, "reactive", () => {
				const needs = sys.needs.getNeeds(agentName);
				const mood = sys.needs.getMood(agentName);
				let fired = state.firedReactiveTriggers.get(agentName);
				if (!fired) { fired = new Set(); state.firedReactiveTriggers.set(agentName, fired); }
				const tryTrigger = (trigger: ReactiveTrigger) => {
					if (!fired!.has(trigger)) {
						fired!.add(trigger);
						sys.talk.triggerReactive(agentName, trigger);
					}
				};
				if (needs.energy < REACTIVE_THRESHOLDS.energyCritical) tryTrigger("energy-critical");
				else if (needs.energy > REACTIVE_THRESHOLDS.energyRestored && fired.has("energy-critical")) { fired.delete("energy-critical"); tryTrigger("energy-restored"); }
				if (mood === "lonely") tryTrigger("lonely");
				if (needs.focus > REACTIVE_THRESHOLDS.focusDeep) tryTrigger("focus-deep");
				else if (needs.focus < REACTIVE_THRESHOLDS.focusLost) tryTrigger("focus-lost");
				if (needs.morale > REACTIVE_THRESHOLDS.moraleBoost && !fired.has("morale-boost")) tryTrigger("morale-boost");
				// Hunger/thirst — low-probability thought bubbles while below threshold.
				// Quirk modulation: snacker gets hungry earlier, coffee-addict gets thirsty earlier.
				const hungerThreshold = sys.quirk.hasQuirk(agentName, "snacker") ? 50 : 40;
				const thirstThreshold = sys.quirk.hasQuirk(agentName, "coffee-addict") ? 45 : 30;
				if (needs.hunger < hungerThreshold && Math.random() < 0.001) {
					const phrase = HUNGER_PHRASES[Math.floor(Math.random() * HUNGER_PHRASES.length)];
					sys.bubble.showBubble(agentName, "thought", phrase, ctx.engine.currentScene, ctx.lookups.findBubbleAnchor, 3000);
				}
				if (needs.thirst < thirstThreshold && Math.random() < 0.001) {
					const phrase = THIRST_PHRASES[Math.floor(Math.random() * THIRST_PHRASES.length)];
					sys.bubble.showBubble(agentName, "thought", phrase, ctx.engine.currentScene, ctx.lookups.findBubbleAnchor, 3000);
				}
			});
		}
	});
}

// tickBehaviorThresholds + processThresholds + tryObjectAttraction — DELETED
// Replaced by BT needs subtrees + sensor phase station resolution.
// Food/drink station interaction now handled by BT seek actions + locomotion arrival.

// ── 6. tickPets — pet behavior, follow, proximity reactions ──────────

export function tickPets(ctx: EngineContext): void {
	runTimedGameSystem(ctx, "pets", () => {
		for (const pet of ctx.pets) {
			pet.updateBehavior(ctx.state.deltaMs);

			// Tick pet interaction resolver
			if (ctx.interactionBootstrap) {
				const petResolver = ctx.interactionBootstrap.resolvers.entities.get(pet.entityId);
				if (petResolver) {
					const petInteractions = petResolver.resolve();
					const bus = ctx.interactionBootstrap.system.getBus();
					for (const interaction of petInteractions) {
						bus.submit(interaction);
					}
				}
			}

			const petRoom = ctx.systems.registry.getEntityRoom(pet.entityId);

			// Update pet voice based on state — drives persona_quirk for talk engine
			updatePetVoice(ctx, pet, petRoom);

			updatePetFollow(ctx, pet, petRoom);
			tryPetAutoFollow(ctx, pet, petRoom);

			// Pet echo production — napping or wandering near agents
			if (petRoom) {
				const petState = pet.getState();
				if (petState === "sleeping" || petState === "wandering") {
					const cycle = ctx.systems.dayClock.getCycleCount();
					for (const agentName of ctx.systems.needs.getAgentNames()) {
						if (ctx.systems.registry.getEntityRoom(agentName) !== petRoom) continue;
						if (petState === "sleeping") {
							ctx.echoProducer.onPetNapNearby(agentName, pet.entityId, cycle);
						} else {
							ctx.echoProducer.onPetWanderNearby(agentName, pet.entityId, cycle);
						}
					}
				}
			}

			// PetSceneEntity draws a proxy Actor; PetActor.pos is updated here. Without syncing,
			// sprites stay at spawn until a room transfer recenters them at the door.
			if (petRoom) {
				const sceneForPet = ctx.scenes.map[petRoom];
				if (sceneForPet === ctx.engine.currentScene) {
					const wrapper = ctx.state.allEntities.get(pet.entityId);
					if (wrapper instanceof PetSceneEntity) wrapper.syncVisual();
				}
			}
		}
	});
}

/** Select pet voice based on state and update talk engine persona_quirk. */
function updatePetVoice(ctx: EngineContext, pet: import("./actors/pet-actor.js").PetActor, petRoom: string | undefined): void {
	const { systems: sys } = ctx;
	// Find nearest agent morale for empathy check
	let nearbyMorale: number | undefined;
	if (petRoom) {
		for (const agentName of sys.needs.getAgentNames()) {
			if (sys.registry.getEntityRoom(agentName) !== petRoom) continue;
			nearbyMorale = sys.needs.getNeeds(agentName).morale;
			break;
		}
	}

	const voice = selectPetVoice({
		hunger: pet.getHunger(),
		thirst: pet.getThirst(),
		nearbyAgentMorale: nearbyMorale,
		state: pet.getState(),
	});
	const voicePhrases = voice === "instinct" ? PET_INSTINCT_FRAGMENTS
		: voice === "eloquent" ? PET_ELOQUENT_FRAGMENTS
		: PET_GREMLIN_FRAGMENTS;
	sys.talk.updateVars(pet.entityId, {
		persona_quirk: voicePhrases[Math.floor(Math.random() * voicePhrases.length)],
	});
}

/** Move pet toward its follow target (only if same room). */
function updatePetFollow(ctx: EngineContext, pet: import("./actors/pet-actor.js").PetActor, petRoom: string | undefined): void {
	const target = pet.getFollowTarget();
	if (!target) return;
	const targetRoom = ctx.systems.registry.getEntityRoom(target);
	if (targetRoom === petRoom) {
		const targetPos = getPosition(ctx, target);
		if (targetPos) pet.moveToward(targetPos.x, targetPos.y, ctx.state.deltaMs);
	} else {
		pet.setFollowTarget(null);
	}
}

/** Dog/cat auto-follow idle or stressed agents in same room. */
function tryPetAutoFollow(ctx: EngineContext, pet: import("./actors/pet-actor.js").PetActor, petRoom: string | undefined): void {
	const { systems: sys } = ctx;
	if (pet.getState() !== "idle") return;

	if (pet.petType === "dog" && Math.random() < DOG_FOLLOW_CHANCE) {
		const candidates = sys.needs.getAgentNames().filter((n) =>
			sys.registry.getEntityRoom(n) === petRoom && getIntent(ctx, n) === "idle",
		);
		if (candidates.length > 0) {
			pet.setFollowTarget(candidates[Math.floor(Math.random() * candidates.length)]);
		}
	}

	if (pet.petType === "cat" && Math.random() < CAT_FOLLOW_STRESSED_CHANCE) {
		const candidates = sys.needs.getAgentNames().filter((n) =>
			sys.registry.getEntityRoom(n) === petRoom && sys.needs.getNeeds(n).morale < CAT_STRESS_MORALE_THRESHOLD,
		);
		if (candidates.length > 0) {
			pet.setFollowTarget(candidates[Math.floor(Math.random() * candidates.length)]);
		}
	}
}

// ── 7. tickRoomTransit — room switching via RoomSwitcher ─────────────

export function tickRoomTransit(ctx: EngineContext): void {
	runTimedGameSystem(ctx, "roomSwitcher", () => {
		ctx.systems.roomSwitcher.update(ctx.state.deltaMs);
	});
}

// ── 8. tickBehaviorTree — BT needs refresh + tick + action processing ─

export function tickBehaviorTree(ctx: EngineContext): void {
	const { systems: sys, state } = ctx;

	// Refresh BT agent context from blackboard (sensor phase already wrote needs/room/nearby)
	for (const agentName of sys.needs.getAgentNames()) {
		const btAgent = sys.bt.getAgent(agentName);
		if (!btAgent || !sys.blackboards.has(agentName)) continue;
		const bb = sys.blackboards.get(agentName);
		btAgent.context.needs.energy = bb.needs.energy;
		btAgent.context.needs.social = bb.needs.social;
		btAgent.context.needs.focus = bb.needs.focus;
		btAgent.context.needs.morale = bb.needs.morale;
		btAgent.context.needs.hunger = bb.needs.hunger;
		btAgent.context.needs.thirst = bb.needs.thirst;
		btAgent.context.echoStore = sys.echo;
		btAgent.context.currentRoom = bb.currentRoom;
		(btAgent.context as { nearbyAgents: readonly string[] }).nearbyAgents = bb.nearbyAgents;
	}

	// Refresh pet BT echo context
	for (const petName of sys.bt.getPetNames()) {
		const petCtx = sys.bt.getPetContext(petName);
		if (petCtx) {
			petCtx.echoStore = sys.echo;
			petCtx.currentRoom = sys.registry.getEntityRoom(petName);
		}
	}

	// BT tick — actions write directly to blackboards during tree evaluation
	sys.bt.update(state.deltaMs, sys.blackboards);
	sys.bt.updatePets(state.deltaMs);

	// Process speech requests from blackboards → presentation
	for (const [name, bb] of sys.blackboards.getAll()) {
		if (bb.speechRequest) {
			sys.bubble.showBubble(name, bb.speechRequest.kind, bb.speechRequest.text, ctx.engine.currentScene, ctx.lookups.findBubbleAnchor, 4000);
			bb.speechRequest = null;
		}

		// Show seek thoughts sparingly
		if (bb.intent === "seeking" && bb.intentDetail && Math.random() < 0.15) {
			const SEEK_PHRASES: Record<string, string> = {
				"seek-rest": "Need a break...",
				"seek-merchant": "Off to the shop...",
				"seek-food": "Getting hungry...",
				"seek-drink": "Need something to drink...",
				"seek-agent": "Looking for company...",
				"seek-quiet": "Need some quiet...",
			};
			const phrase = SEEK_PHRASES[bb.intentDetail];
			if (phrase) sys.bubble.showBubble(name, "thought", phrase, ctx.engine.currentScene, ctx.lookups.findBubbleAnchor, 2500);
		}
	}
}

// ── 4. tickLocomotion — push blackboard → locomotion → pull ──────────

export function tickLocomotion(ctx: EngineContext): void {
	const { systems: sys, state } = ctx;

	// Snapshot walking states before locomotion (for particle trails in tickVisuals)
	for (const [name, bb] of sys.blackboards.getAll()) {
		state.prevWalkingState.set(name, bb.isMoving);
	}

	// Push blackboard → ECS components
	sys.blackboards.push(ctx.lookups.findAgentActor);

	// Run locomotion for each agent
	runTimedGameSystem(ctx, "locomotion", () => {
		for (const [name, bb] of sys.blackboards.getAll()) {
			const actor = ctx.lookups.findAgentActor(name);
			if (!actor) continue;

			// Build locomotion entry from blackboard data
			const entry = {
				command: bb.movementCommand,
				target: bb.movementTarget,
				arrived: bb.arrived,
				speed: 40,
				movementStyle: "brisk" as const,
				position: { x: actor.pos.x, y: actor.pos.y },
				socialDrift: 0.3,
				focusDrift: 0.1,
				idleStyle: "restless" as const,
				idlePoseTimer: 0,
				idlePoseIndex: 0,
				urgencySpeedBoost: bb.urgencySpeedBoost,
			};

			sys.locomotion.updateAgent(entry, state.deltaMs);

			// Write locomotion results back to actor + blackboard
			actor.pos.x = entry.position.x;
			actor.pos.y = entry.position.y;
			bb.movementCommand = entry.command;
			bb.movementTarget = entry.target;
			bb.arrived = entry.arrived;
			bb.isMoving = entry.command !== "none";
			actor.updateIntent(bb.intent);
		}
	});

	// Pull ECS components → blackboard
	sys.blackboards.pull(ctx.lookups.findAgentActor);

	// Standing order indicator — show loop icon when agent is working
	for (const [name, bb] of sys.blackboards.getAll()) {
		const actor = ctx.lookups.findAgentActor(name);
		if (!actor) continue;
		const isActive = bb.intent === "working";
		if (actor.isStandingOrderActive() !== isActive) {
			actor.setStandingOrderActive(isActive);
		}
	}
}

// ── 9b. tickInteractions — interaction bus processing ─────────────────
// OPTIONAL: only runs when ctx.systems.interactions is wired up.

export function tickInteractions(ctx: EngineContext): void {
	const interactionSystem = ctx.systems.interactions;
	if (!interactionSystem) return;

	runTimedGameSystem(ctx, "interactions", () => {
		const { actions, state: effectState } = interactionSystem.tick(ctx.state.deltaMs);
		const { systems: sys } = ctx;

		// ── Apply affinity changes ─────────────────────────────────
		// RelationshipSystem has no public adjustAffinity(a, b, amount) method.
		// Use recordConversation (+2) for positive and recordBicker (-3) for negative
		// as best-fit proxies; fine-grained per-amount adjustment deferred until
		// RelationshipSystem exposes a public adjustAffinity API.
		for (const change of effectState.affinityChanges) {
			if (change.amount > 0) {
				sys.relationship.recordConversation(change.from, change.to);
			} else if (change.amount < 0) {
				sys.relationship.recordBicker(change.from, change.to);
			}
		}

		// ── Apply need changes ─────────────────────────────────────
		for (const change of effectState.needChanges) {
			const needEffect: Partial<AgentNeeds> = { [change.need]: change.amount } as Partial<AgentNeeds>;
			sys.needs.applyEffect(change.entityId, needEffect);
		}

		// ── Apply mood changes ─────────────────────────────────────
		// NeedsSystem derives mood from needs state; no setMood API exists.
		// Mood changes from interactions are skipped — mood will shift
		// organically as need effects propagate.

		// ── Record memories ────────────────────────────────────────
		for (const record of effectState.memoryRecords) {
			sys.memory.recordEvent(record.entityId, {
				cycle: sys.dayClock.getCycleCount(),
				type: "interaction",
				summary: record.memory,
			});
		}

		// ── Route actions to effect renderer ───────────────────────
		if (actions.length > 0) {
			renderInteractionActions(actions, {
				talk: {
					triggerReactive(entityId: string, trigger: string) {
						sys.talk.triggerReactive(entityId, trigger as ReactiveTrigger);
					},
				},
				bubble: {
					showBubble(entityId: string, kind: string, text: string) {
						sys.bubble.showBubble(
							entityId,
							kind as "speech" | "thought" | "question",
							text,
							ctx.engine.currentScene,
							ctx.lookups.findAgentActor,
						);
					},
				},
			});
		}

		// ── Tick NPC/room resolvers and submit results ────────────
		if (ctx.interactionBootstrap) {
			for (const [id, resolver] of ctx.interactionBootstrap.resolvers.entities) {
				if (id.startsWith("npc-") || id.startsWith("room-")) {
					const interactions = resolver.resolve();
					const bus = ctx.interactionBootstrap.system.getBus();
					for (const interaction of interactions) {
						bus.submit(interaction);
					}
				}
			}
		}
	});
}

// ── 10. tickSocial — ritual + social + talk ──────────────────────────

export function tickSocial(ctx: EngineContext): void {
	const { systems: sys, state } = ctx;

	// ── Process cascade queue — reactions queued by echo threshold crossings ──
	const currentCycle = sys.dayClock.getCycleCount();
	while (cascadeQueue.length > 0) {
		const reaction = cascadeQueue.shift()!;
		switch (reaction.type) {
			case "vent": {
				if (reaction.target) {
					const targetActor = ctx.lookups.findAgentActor(reaction.target);
					if (targetActor) {
						const domainA = ctx.store.agents.find((a) => a.name === reaction.agent)?.domain ?? "";
						const domainB = ctx.store.agents.find((a) => a.name === reaction.target)?.domain ?? "";
						sys.conversation.tryScript(reaction.agent, reaction.target, "proximity", { domainA, domainB });
					}
				}
				break;
			}
			case "seek-proximity": {
				// Write seek hint to blackboard — BT will pick it up as cascadeHint
				if (reaction.target && sys.blackboards.has(reaction.agent)) {
					const bb = sys.blackboards.get(reaction.agent);
					const targetBb = sys.blackboards.has(reaction.target) ? sys.blackboards.get(reaction.target) : null;
					if (targetBb) {
						bb.cascadeHint = "seek-proximity";
						bb.cascadeTarget = { x: targetBb.position.x, y: targetBb.position.y };
					}
				}
				break;
			}
			case "force-break":
				// Write break hint to blackboard — BT NeedsBreak subtree handles it
				if (sys.blackboards.has(reaction.agent)) {
					sys.blackboards.get(reaction.agent).cascadeHint = "force-break";
				}
				break;
			case "avoid-room":
				if (reaction.target && sys.blackboards.has(reaction.agent)) {
					sys.blackboards.get(reaction.agent).roomAvoidance = reaction.target;
				}
				break;
			case "adjust-opinion":
				if (reaction.target) {
					sys.echo.addEcho(reaction.agent, {
						kind: "opinion", source: "reputation", target: reaction.target,
						weight: reaction.weight, decay: 2, tags: ["social", "gossip"],
					}, currentCycle);
					// Gossip forwarding: 30% chance to pass gossip along to another agent
					if (ctx.cascadeResolver.shouldForwardGossip()) {
						const room = sys.registry.getEntityRoom(reaction.agent);
						if (room) {
							const roommates = sys.needs.getAgentNames().filter(
								(n) => n !== reaction.agent && n !== reaction.target
									&& sys.registry.getEntityRoom(n) === room,
							);
							if (roommates.length > 0) {
								const forwarder = roommates[Math.floor(Math.random() * roommates.length)];
								ctx.echoProducer.onGossipHeard(forwarder, reaction.agent, reaction.target, currentCycle);
							}
						}
					}
				}
				break;
			default:
				// Unhandled reaction type — silently skip
				break;
		}
	}

	runTimedGameSystem(ctx, "ritual", () => {
		sys.ritual.update(state.deltaMs, (name) => getIntent(ctx, name));
	});

	runTimedGameSystem(ctx, "social", () => {
		sys.social.update(
			state.deltaMs,
			(name) => {
				const pos = getPosition(ctx, name) ?? { x: 0, y: 0 };
				const room = sys.registry.getEntityRoom(name) ?? "";
				const offset = ROOM_OFFSETS[room] ?? UNKNOWN_ROOM_OFFSET;
				return { x: pos.x + offset, y: pos.y + offset };
			},
			(name) => getIntent(ctx, name),
			(name) => sys.needs.getNeeds(name),
		);
	});

	// Gossip chance: when 2+ agents cluster in the same room and a 3rd is elsewhere
	if (Math.random() < 0.0015) {
		tryGossipTrigger(ctx);
	}

	runTimedGameSystem(ctx, "conversation", () => {
		sys.conversation.update(state.deltaMs);
	});

	const onSlice = ctx.state.perfSampler?.onAgentSlice;
	runTimedGameSystem(ctx, "talk", () => {
		sys.talk.update(
			state.deltaMs,
			onSlice ? (name, ms) => onSlice.call(ctx.state.perfSampler!, name, "talk", ms) : undefined,
		);
	});
}

// ── 11. tickDirector — director + engagement + tool executor ─────────

export function tickDirector(ctx: EngineContext): void {
	const { systems: sys, state } = ctx;
	sys.director.update(state.deltaMs);

	sys.engagement.update(
		state.deltaMs,
		() => sys.director.getPresence(),
		(name) => sys.needs.getNeeds(name),
		(name) => getIntent(ctx, name),
		(name) => sys.sensor.hasPendingReaction(name),
	);

	sys.engagement.setContext({
		agentCount: String(sys.blackboards.size),
	});

	sys.tool.update(state.deltaMs);
}

// ── 12. tickVisuals — emote, particles, weather, lighting, bubbles, camera ─

export function tickVisuals(ctx: EngineContext): void {
	const { systems: sys, state } = ctx;

	// Visual feedback system — intent telegraphs, arrival payoff, idle micro-actions
	// Only tick agents in the current scene to avoid cross-room visual bleed
	if (sys.visualFeedback) {
		runTimedGameSystem(ctx, "visualFeedback", () => {
			const now = performance.now();
			let currentRoom = "";
			for (const [id, scene] of Object.entries(ctx.scenes.map)) {
				if (scene === ctx.engine.currentScene) { currentRoom = id; break; }
			}
			for (const [name, bb] of sys.blackboards.getAll()) {
				if (currentRoom && bb.currentRoom !== currentRoom) continue;
				sys.visualFeedback!.tick(name, bb, now, state.deltaMs);
			}
		});
	}

	runTimedGameSystem(ctx, "emote", () => {
		sys.emote.update(state.deltaMs, (name) => getIntent(ctx, name));
	});

	runTimedGameSystem(ctx, "particlePool", () => {
		sys.particlePool.update(state.deltaMs);
		updateParticleTrails(ctx);
	});

	runTimedGameSystem(ctx, "worldAmbience.visuals", () => {
		const weatherVisuals = sys.worldAmbience.getWeatherVisuals();
		if (weatherVisuals.particleCount > 0) {
			if (Math.random() < WEATHER_PARTICLE_CHANCE) {
				const x = Math.random() * ENGINE_WIDTH;
				const y = weatherVisuals.particleAngle > 0 ? 0 : Math.random() * ENGINE_HEIGHT;
				sys.particlePool.spawn({
					x, y,
					vx: Math.sin(weatherVisuals.particleAngle) * weatherVisuals.particleSpeed,
					vy: Math.cos(weatherVisuals.particleAngle) * weatherVisuals.particleSpeed,
					color: weatherVisuals.particleColor,
					lifetime: WEATHER_PARTICLE_LIFETIME,
					opacity: WEATHER_PARTICLE_OPACITY,
					radius: weatherVisuals.particleAngle > 0 ? 0.5 : 1,
				});
			}
		}

		const targetLight = sys.worldAmbience.getLighting(sys.dayClock.getPhase());
		const lerpT = Math.min(1, LIGHT_LERP_SPEED * state.deltaMs);
		state.currentLight.r += (targetLight.r - state.currentLight.r) * lerpT;
		state.currentLight.g += (targetLight.g - state.currentLight.g) * lerpT;
		state.currentLight.b += (targetLight.b - state.currentLight.b) * lerpT;
		state.currentLight.opacity += (targetLight.opacity - state.currentLight.opacity) * lerpT;

		// Ambient room particles
		if (Math.random() < AMBIENT_PARTICLE_CHANCE) {
			const cur = ctx.engine.currentScene;
			if (cur === ctx.scenes.hub) {
				sys.particlePool.spawnPreset("dust-motes", Math.random() * ENGINE_WIDTH, Math.random() * ENGINE_HEIGHT);
			} else if (cur === ctx.scenes.office) {
				sys.particlePool.spawnPreset("dust-motes", Math.random() * ENGINE_WIDTH, 60 + Math.random() * 380);
			} else if (cur === ctx.scenes.village) {
				sys.particlePool.spawnPreset("leaf-drift", Math.random() * ENGINE_WIDTH, Math.random() * ENGINE_HEIGHT);
			} else if (cur === ctx.scenes.station) {
				sys.particlePool.spawnPreset("embers", 560 + Math.random() * 120, 160 + Math.random() * 100);
			}
		}
	});

	runTimedGameSystem(ctx, "workstations", () => {
		for (const room of Object.values(ctx.scenes.map)) {
			for (const ws of room.getWorkstations()) {
				ws.updateGlow(state.deltaMs);
			}
		}
	});

	runTimedGameSystem(ctx, "bubble", () => {
		sys.bubble.update(
			state.deltaMs,
			(name) => getIntent(ctx, name) === "idle",
			ctx.engine.currentScene,
			ctx.lookups.findBubbleAnchor,
		);
	});

	if (sys.cameraSystem) {
		runTimedGameSystem(ctx, "camera", () => {
			sys.cameraSystem!.checkDespawn();
			sys.cameraSystem!.applyZoom(state.deltaMs);
			sys.cameraSystem!.updatePan(state.deltaMs);
		});
	}
}

// ── Helper: getNearbyAgents ──────────────────────────────────────────

/** Get names of agents within social radius of `name` — same room only. */
export function getNearbyAgents(ctx: EngineContext, name: string): string[] {
	const { systems: sys } = ctx;
	if (!sys.blackboards.has(name)) return [];
	const pos = sys.blackboards.get(name).position;
	const myRoom = sys.registry.getEntityRoom(name);
	const radius = 100; // Default social radius
	return [...sys.blackboards.getAll()]
		.filter(([n]) => {
			if (n === name) return false;
			if (sys.registry.getEntityRoom(n) !== myRoom) return false;
			const otherPos = sys.blackboards.get(n).position;
			const dx = pos.x - otherPos.x;
			const dy = pos.y - otherPos.y;
			return Math.sqrt(dx * dx + dy * dy) < radius;
		})
		.map(([n]) => n);
}

// processThresholds — DELETED. Replaced by BT needs subtrees.

// ── Helper: agentParticleColor ───────────────────────────────────────

/** Resolve domain particle color for an agent. */
function agentParticleColor(ctx: EngineContext, name: string): string {
	const agent = ctx.store.agents.find((a) => a.name === name);
	return DOMAIN_PARTICLE_COLORS[agent?.domain ?? ""] ?? DEFAULT_PARTICLE_COLOR;
}

// ── Helper: updateParticleTrails ─────────────────────────────────────

/** Spawn particle trails for walking agents, dust bursts on arrival. Only for current scene. */
function updateParticleTrails(ctx: EngineContext): void {
	const { systems: sys, state } = ctx;
	for (const [name, bb] of sys.blackboards.getAll()) {
		const wasWalking = state.prevWalkingState.get(name) ?? false;
		const isWalking = bb.isMoving;

		if (isWalking) {
			const actor = ctx.lookups.findCurrentSceneActor(name);
			if (!actor) continue;
			const x = actor.pos.x;
			const y = actor.pos.y + TRAIL_Y_OFFSET;
			const prev = state.lastTrailPos.get(name);
			if (!prev) {
				state.lastTrailPos.set(name, { x, y });
				continue;
			}
			const dx = x - prev.x;
			const dy = y - prev.y;
			if (dx * dx + dy * dy >= TRAIL_DISTANCE_SQ) {
				sys.particlePool.spawnTrail(x, y, agentParticleColor(ctx, name), bb.movementCommand === "walk-to");
				state.lastTrailPos.set(name, { x, y });
			}
		} else {
			state.lastTrailPos.delete(name);
			if (wasWalking) {
				const actor = ctx.lookups.findCurrentSceneActor(name);
				if (actor) sys.particlePool.spawnDustBurst(actor.pos.x, actor.pos.y + TRAIL_Y_OFFSET, agentParticleColor(ctx, name));
			}
		}
	}
}

// ── Helper: tryGossipTrigger ─────────────────────────────────────────

/** When 2+ agents share a room and a 3rd is elsewhere, trigger gossip about the absent agent. */
function tryGossipTrigger(ctx: EngineContext): void {
	const { systems: sys } = ctx;
	const allAgents = sys.needs.getAgentNames();
	if (allAgents.length < 3) return;

	// Build room → agent[] map
	const roomAgents = new Map<string, string[]>();
	for (const name of allAgents) {
		const room = sys.registry.getEntityRoom(name) ?? "";
		const list = roomAgents.get(room);
		if (list) list.push(name);
		else roomAgents.set(room, [name]);
	}

	// Find a room with 2+ agents
	for (const [room, agents] of roomAgents) {
		if (agents.length < 2) continue;
		// Find an agent NOT in this room
		const absent = allAgents.find((n) => (sys.registry.getEntityRoom(n) ?? "") !== room);
		if (!absent) continue;
		const agentA = agents[0];
		const agentB = agents[1];
		const domainA = ctx.store.agents.find((a) => a.name === agentA)?.domain ?? "";
		const domainB = ctx.store.agents.find((a) => a.name === agentB)?.domain ?? "";
		const gossipStarted = sys.conversation.gossipAbout(agentA, agentB, absent, { domainA, domainB });
		if (gossipStarted) {
			const cycle = sys.dayClock.getCycleCount();
			// Both agents hear gossip about the absent agent
			ctx.echoProducer.onGossipHeard(agentA, agentB, absent, cycle);
			ctx.echoProducer.onGossipHeard(agentB, agentA, absent, cycle);
		}
		break;
	}
}

// ── CLI ↔ Blackboard bridge — subscribe store cli-brain-event to blackboard ──

/** Wire CLI events from the store to the blackboard. Call once during engine init. */
export function wireCliBrainBridge(ctx: EngineContext): () => void {
	const INTENT_MAP: Record<string, string> = {
		"task-started": "working",
		"thinking": "working",
		"speaking": "talking",
		"asking": "waiting",
		"using-tool": "working",
		"task-completed": "idle",
		"done": "idle",
		"error": "idle",
		"idle": "idle",
	};
	const handler = ((e: CustomEvent) => {
		const { agent, action } = e.detail as { agent: string; action: string };
		if (!ctx.systems.blackboards.has(agent)) return;
		const bb = ctx.systems.blackboards.get(agent);
		const intent = INTENT_MAP[action];
		if (intent) {
			bb.intent = intent as typeof bb.intent;
			bb.intentDetail = action;
		}
	}) as EventListener;
	ctx.store.addEventListener("cli-brain-event", handler);
	return () => ctx.store.removeEventListener("cli-brain-event", handler);
}
