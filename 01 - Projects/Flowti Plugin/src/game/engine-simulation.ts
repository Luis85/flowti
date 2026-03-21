/**
 * engine-simulation.ts — Preframe simulation loop decomposed into 12 named tick functions.
 *
 * tickSimulation() is called once per frame from engine.ts and orchestrates
 * all system updates in a precise order. Each tick function is independently
 * testable and receives the shared EngineContext.
 */

import type { EngineContext } from "./engine-types.js";
import type { InteractableActor } from "./actors/interactable-actor.js";
import type { ReactiveTrigger } from "./systems/talk/templates/reactive-phrases.js";
import { PET_DEFINITIONS } from "./data/pet-definitions.js";
import {
	DOMAIN_PARTICLE_COLORS, DEFAULT_PARTICLE_COLOR,
	LIGHT_LERP_SPEED, ENGINE_WIDTH, ENGINE_HEIGHT,
	ROOM_OFFSETS, UNKNOWN_ROOM_OFFSET,
	OBJECT_ATTRACTION_RULES,
	PET_REACTION_COOLDOWN, TRAIL_DISTANCE_SQ, TRAIL_Y_OFFSET,
	WEATHER_PARTICLE_CHANCE, WEATHER_PARTICLE_LIFETIME, WEATHER_PARTICLE_OPACITY,
	DOG_FOLLOW_CHANCE, CAT_FOLLOW_STRESSED_CHANCE, CAT_STRESS_MORALE_THRESHOLD,
	OBJECT_EFFECT_DELAY, REACTIVE_THRESHOLDS, PET_STEAL_PHRASES,
} from "./engine-config.js";
import { checkPetShareInteraction } from "./engine-pet-share.js";

// ── Composite tick — called from engine.ts preframe hook ─────────────

export function tickSimulation(ctx: EngineContext): void {
	tickClock(ctx);
	tickSensor(ctx);
	tickNeeds(ctx);
	tickReactiveTriggers(ctx);
	tickBehaviorThresholds(ctx);
	tickPets(ctx);
	tickRoomTransit(ctx);
	tickBehaviorTree(ctx);
	tickBrain(ctx);
	tickSocial(ctx);
	tickDirector(ctx);
	tickVisuals(ctx);
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
		sys.relationship.onCycleEnd();
	}

	sys.worldEvent.update(state.deltaMs);
}

// ── 2. tickSensor — sensor cooldowns and queued feedback ─────────────

export function tickSensor(ctx: EngineContext): void {
	ctx.systems.sensor.update(ctx.state.deltaMs);
}

// ── 3. tickNeeds — decay/restore needs + mood propagation ────────────

export function tickNeeds(ctx: EngineContext): void {
	const { systems: sys, state } = ctx;
	sys.needs.update(
		state.deltaMs,
		(name) => sys.brain.getState(name)?.state ?? "idle",
		(name) => getNearbyAgents(ctx, name),
		sys.dayClock.getPhaseMultipliers(),
	);

	// Mood propagation — push derived mood into brain + emote + talk systems
	for (const agentName of sys.needs.getAgentNames()) {
		const mood = sys.needs.getMood(agentName);
		sys.brain.updateMood(agentName, mood);
		sys.emote.updateMood(agentName, mood);

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
	}
}

// ── 4. tickReactiveTriggers — energy/mood/focus threshold talk ────────

export function tickReactiveTriggers(ctx: EngineContext): void {
	const { systems: sys, state } = ctx;
	for (const agentName of sys.needs.getAgentNames()) {
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
	}
}

// ── 5. tickBehaviorThresholds — needs-driven overrides + object attraction ─

export function tickBehaviorThresholds(ctx: EngineContext): void {
	const { systems: sys } = ctx;
	processThresholds(ctx);

	const objectLookup: Record<string, InteractableActor> = {
		coffeeMachine: ctx.envObjects.coffeeMachine, snackTable: ctx.envObjects.snackTable,
		waterCooler: ctx.envObjects.waterCooler, couch: ctx.envObjects.couch,
		foodBowlHub: ctx.envObjects.foodBowlHub, foodBowlVillage: ctx.envObjects.foodBowlVillage,
		waterBowlOffice: ctx.envObjects.waterBowlOffice, waterBowlStation: ctx.envObjects.waterBowlStation,
	};
	const petEntityIds = new Set(ctx.pets.map((p) => p.entityId));
	const currentPhase = sys.dayClock.getPhase();
	for (const agentName of sys.needs.getAgentNames()) {
		const state = sys.brain.getState(agentName)?.state;
		if (state !== "idle" && state !== "wandering") continue;
		const needs = sys.needs.getNeeds(agentName);
		tryObjectAttraction(ctx, agentName, needs, currentPhase, objectLookup, petEntityIds);
	}
}

type AgentNeeds = ReturnType<EngineContext["systems"]["needs"]["getNeeds"]>;
type DayPhase = ReturnType<EngineContext["systems"]["dayClock"]["getPhase"]>;

function tryObjectAttraction(ctx: EngineContext, agentName: string, needs: AgentNeeds, currentPhase: DayPhase, objectLookup: Record<string, InteractableActor>, petEntityIds: Set<string>): void {
	const { systems: sys } = ctx;
	for (const rule of OBJECT_ATTRACTION_RULES) {
		const obj = objectLookup[rule.objectKey];
		if (!obj) continue;
		const ruleMatches = rule.phases.includes(currentPhase) || rule.needCheck(needs);
		// Steal mechanic: pet occupying a station blocks agent — show frustrated bubble, skip this station
		if (obj.isOccupied() && petEntityIds.has(obj.getOccupant()!)) {
			if (!ruleMatches || Math.random() >= rule.chance) continue;
			const phrase = PET_STEAL_PHRASES[Math.floor(Math.random() * PET_STEAL_PHRASES.length)];
			sys.bubble.showBubble(agentName, "thought", phrase, ctx.engine.currentScene, ctx.lookups.findAgentActor, 2500);
			break;
		}
		if (obj.isOccupied() || !ruleMatches || Math.random() >= rule.chance) continue;
		const point = obj.getInteractionPoint();
		sys.brain.walkTo(agentName, point);
		obj.occupy(agentName);
		setTimeout(() => {
			sys.needs.applyEffect(agentName, obj.getNeedsEffects());
			obj.vacate();
			if (obj === ctx.envObjects.coffeeMachine) sys.particlePool.spawnPreset("steam", point.x, point.y - 20);
		}, OBJECT_EFFECT_DELAY);
		break;
	}
}

// ── 6. tickPets — pet behavior, follow, proximity reactions ──────────

export function tickPets(ctx: EngineContext): void {
	for (const pet of ctx.pets) {
		pet.updateBehavior(ctx.state.deltaMs);
		const petRoom = ctx.systems.registry.getEntityRoom(pet.entityId);

		updatePetFollow(ctx, pet, petRoom);
		tryPetAutoFollow(ctx, pet, petRoom);
		checkPetProximityReactions(ctx, pet, petRoom);
		checkPetShareInteraction(ctx, pet, petRoom);
	}
}

/** Move pet toward its follow target (only if same room). */
function updatePetFollow(ctx: EngineContext, pet: import("./actors/pet-actor.js").PetActor, petRoom: string | undefined): void {
	const target = pet.getFollowTarget();
	if (!target) return;
	const targetRoom = ctx.systems.registry.getEntityRoom(target);
	if (targetRoom === petRoom) {
		const targetPos = ctx.systems.brain.getPosition(target);
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
			sys.registry.getEntityRoom(n) === petRoom && sys.brain.getState(n)?.state === "idle",
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

/** Check agent proximity reactions for a pet (thought bubbles + needs effects). */
function checkPetProximityReactions(ctx: EngineContext, pet: import("./actors/pet-actor.js").PetActor, petRoom: string | undefined): void {
	const { systems: sys, state } = ctx;
	if (pet.getState() === "sleeping" || !petRoom) return;

	for (const agentName of sys.needs.getAgentNames()) {
		if (sys.registry.getEntityRoom(agentName) !== petRoom) continue;
		const agentPos = sys.brain.getPosition(agentName);
		if (!agentPos) continue;
		const dx = pet.pos.x - agentPos.x;
		const dy = pet.pos.y - agentPos.y;
		const dist = Math.sqrt(dx * dx + dy * dy);
		if (dist >= pet.getInteractRadius()) continue;

		// Track proximity time for bonding — always accumulate, not gated by reaction cooldown
		pet.trackProximity(agentName, state.deltaMs);

		const cooldownKey = `${agentName}:${pet.petType}`;
		const lastReaction = state.petReactionCooldowns.get(cooldownKey) ?? 0;
		if (performance.now() - lastReaction <= PET_REACTION_COOLDOWN) continue;

		state.petReactionCooldowns.set(cooldownKey, performance.now());
		sys.needs.applyEffect(agentName, pet.getNeedsEffects());
		const def = PET_DEFINITIONS.find((d) => d.type === pet.petType);
		if (def && def.phrases.length > 0) {
			const phrase = def.phrases[Math.floor(Math.random() * def.phrases.length)];
			sys.bubble.showBubble(agentName, "thought", phrase, ctx.engine.currentScene, ctx.lookups.findAgentActor, 3000);
		}
		sys.particlePool.spawnPreset("hearts", (pet.pos.x + agentPos.x) / 2, (pet.pos.y + agentPos.y) / 2);
	}
}

// ── 7. tickRoomTransit — room switching via RoomSwitcher ─────────────

export function tickRoomTransit(ctx: EngineContext): void {
	ctx.systems.roomSwitcher.update(ctx.state.deltaMs);
}

// ── 8. tickBehaviorTree — BT needs refresh + tick + action processing ─

export function tickBehaviorTree(ctx: EngineContext): void {
	const { systems: sys, state } = ctx;
	// Refresh BT agent needs snapshots from the live needs system
	for (const agentName of sys.needs.getAgentNames()) {
		const btAgent = sys.bt.getAgent(agentName);
		if (btAgent) {
			const live = sys.needs.getNeeds(agentName);
			btAgent.context.needs.energy = live.energy;
			btAgent.context.needs.social = live.social;
			btAgent.context.needs.focus = live.focus;
			btAgent.context.needs.morale = live.morale;
		}
	}

	const btActions = sys.bt.update(state.deltaMs, ctx.btBridge.worldState, ctx.btBridge.clock);
	for (const action of btActions) {
		if (action.type === "goal-started") {
			sys.brain.assignWork(action.agentName);
		} else if (action.type === "goal-completed" || action.type === "artifact-dropped") {
			sys.brain.releaseWork(action.agentName);
		} else if (action.type === "speaking") {
			const text = String(action.data.text ?? "");
			if (text) {
				sys.bubble.showBubble(action.agentName, "speech", text, ctx.engine.currentScene, ctx.lookups.findAgentActor, 4000);
			}
		}
	}
}

// ── 9. tickBrain — snapshot walking state THEN update brain ──────────
// LOAD-BEARING ORDER: prevWalkingState MUST be captured before brainSystem.update()
// so that particle trail detection in tickVisuals can detect transitions.

export function tickBrain(ctx: EngineContext): void {
	const { systems: sys, state } = ctx;
	// Snapshot walking states before brain update
	for (const [name, entry] of sys.brain.getAllEntries()) {
		state.prevWalkingState.set(name, entry.state === "wandering" || entry.state === "walking-to");
	}

	// Brain system — movement, state machine
	sys.brain.update(state.deltaMs, ctx.lookups.findAgentActor, (name) => sys.registry.getEntityRoom(name));

	// Standing order indicator — show loop icon when agent is working and task-locked
	for (const [name, entry] of sys.brain.getAllEntries()) {
		const actor = ctx.lookups.findAgentActor(name);
		if (!actor) continue;
		const isActive = entry.state === "working" && entry.taskLocked;
		if (actor.isStandingOrderActive() !== isActive) {
			actor.setStandingOrderActive(isActive);
		}
	}
}

// ── 10. tickSocial — ritual + social + talk ──────────────────────────

export function tickSocial(ctx: EngineContext): void {
	const { systems: sys, state } = ctx;
	// Ritual system — ceremonial choreography
	sys.ritual.update(state.deltaMs, (name) => sys.brain.getState(name)?.state ?? "idle");

	// Social system — proximity conversations (room-isolated: offset positions by room)
	sys.social.update(
		state.deltaMs,
		(name) => {
			const pos = sys.brain.getPosition(name) ?? { x: 0, y: 0 };
			const room = sys.registry.getEntityRoom(name) ?? "";
			const offset = ROOM_OFFSETS[room] ?? UNKNOWN_ROOM_OFFSET;
			return { x: pos.x + offset, y: pos.y + offset };
		},
		(name) => sys.brain.getState(name)?.state ?? "idle",
		(name) => sys.needs.getNeeds(name),
	);

	// Talk engine — ambient chatter
	sys.talk.update(state.deltaMs);
}

// ── 11. tickDirector — director + engagement + tool executor ─────────

export function tickDirector(ctx: EngineContext): void {
	const { systems: sys, state } = ctx;
	sys.director.update(state.deltaMs);

	sys.engagement.update(
		state.deltaMs,
		() => sys.director.getPresence(),
		(name) => sys.needs.getNeeds(name),
		(name) => sys.brain.getState(name)?.state ?? "idle",
		(_name) => false,
	);

	sys.engagement.setContext({
		agentCount: String(sys.brain.getAllEntries().size),
	});

	sys.tool.update(state.deltaMs);
}

// ── 12. tickVisuals — emote, particles, weather, lighting, bubbles, camera ─

export function tickVisuals(ctx: EngineContext): void {
	const { systems: sys, state } = ctx;
	// Emote system — mood-driven emotes
	sys.emote.update(state.deltaMs, (name) => sys.brain.getState(name)?.state ?? "idle");

	// Particle pool update
	sys.particlePool.update(state.deltaMs);

	// Particle trails — walking dust trails + arrival bursts
	updateParticleTrails(ctx);

	// Weather ambient particles
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

	// Smooth lighting transition — lerp toward target phase lighting
	const targetLight = sys.worldAmbience.getLighting(sys.dayClock.getPhase());
	const lerpT = Math.min(1, LIGHT_LERP_SPEED * state.deltaMs);
	state.currentLight.r += (targetLight.r - state.currentLight.r) * lerpT;
	state.currentLight.g += (targetLight.g - state.currentLight.g) * lerpT;
	state.currentLight.b += (targetLight.b - state.currentLight.b) * lerpT;
	state.currentLight.opacity += (targetLight.opacity - state.currentLight.opacity) * lerpT;

	// Workstation glow updates
	for (const room of Object.values(ctx.scenes.map)) {
		for (const ws of room.getWorkstations()) {
			ws.updateGlow(state.deltaMs);
		}
	}

	// Bubble system — overhead speech/thought bubbles
	sys.bubble.update(
		state.deltaMs,
		(name) => sys.brain.getState(name)?.state === "idle",
		ctx.engine.currentScene,
		ctx.lookups.findAgentActor,
	);

	// Camera system
	if (sys.cameraSystem) {
		sys.cameraSystem.checkDespawn();
		sys.cameraSystem.applyZoom(state.deltaMs);
		sys.cameraSystem.updatePan(state.deltaMs);
	}
}

// ── Helper: getNearbyAgents ──────────────────────────────────────────

/** Get names of agents within social radius of `name` — same room only. */
export function getNearbyAgents(ctx: EngineContext, name: string): string[] {
	const { systems: sys } = ctx;
	const pos = sys.brain.getPosition(name);
	if (!pos) return [];
	const myRoom = sys.registry.getEntityRoom(name);
	const params = sys.brain.getState(name);
	const radius = params?.params.socialRadius ?? 100;
	return [...sys.brain.getAllEntries()]
		.filter(([n]) => {
			if (n === name) return false;
			if (sys.registry.getEntityRoom(n) !== myRoom) return false;
			const otherPos = sys.brain.getPosition(n);
			if (!otherPos) return false;
			const dx = pos.x - otherPos.x;
			const dy = pos.y - otherPos.y;
			return Math.sqrt(dx * dx + dy * dy) < radius;
		})
		.map(([n]) => n);
}

// ── Helper: processThresholds ────────────────────────────────────────

/** Process behavior thresholds — needs-driven state overrides. */
function processThresholds(ctx: EngineContext): void {
	const { systems: sys } = ctx;
	for (const agentName of sys.needs.getAgentNames()) {
		if (sys.registry.isInTransit(agentName)) continue;
		const actions = sys.needs.checkThresholds(agentName);
		for (const action of actions) {
			switch (action.type) {
				case "force-break":
					if (sys.brain.getState(agentName)?.state !== "on-break") {
						sys.brain.applyEvent(agentName, "break");
					}
					break;
				case "seek-agent": {
					const nearest = ctx.lookups.findNearestAgent(agentName);
					if (nearest) sys.brain.walkTo(agentName, nearest);
					break;
				}
				case "seek-quiet":
				case "demoralized":
					sys.brain.applyEvent(agentName, "idle");
					break;
			}
		}
	}
}

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
	for (const [name, entry] of sys.brain.getAllEntries()) {
		const wasWalking = state.prevWalkingState.get(name) ?? false;
		const isWalking = entry.state === "wandering" || entry.state === "walking-to";

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
				sys.particlePool.spawnTrail(x, y, agentParticleColor(ctx, name), entry.state === "walking-to");
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
