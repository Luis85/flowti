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
	OBJECT_EFFECT_DELAY, REACTIVE_THRESHOLDS,
} from "./engine-config.js";

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
	ctx.dayClock.update(ctx.deltaMs);
	ctx.store.setDayProgress(ctx.dayClock.getCycleProgress(), ctx.dayClock.getCycleCount());

	if (ctx.dayClock.getCycleCount() > ctx.prevCycleCount) {
		ctx.prevCycleCount = ctx.dayClock.getCycleCount();
		ctx.worldAmbience.onCycleComplete();
		for (const agentName of ctx.needs.getAgentNames()) {
			ctx.memory.onCycleEnd(agentName, {
				completedTask: ctx.store.taskLockedAgents.has(agentName),
				conversations: ctx.cycleConversationCounts.get(agentName) ?? 0,
				dominantMood: ctx.needs.getMood(agentName),
			});
			ctx.cycleConversationCounts.set(agentName, 0);
		}
		ctx.worldEvent.onCycleReset();
		ctx.firedReactiveTriggers.clear();
		ctx.relationship.onCycleEnd();
	}

	ctx.worldEvent.update(ctx.deltaMs);
}

// ── 2. tickSensor — sensor cooldowns and queued feedback ─────────────

export function tickSensor(ctx: EngineContext): void {
	ctx.sensor.update(ctx.deltaMs);
}

// ── 3. tickNeeds — decay/restore needs + mood propagation ────────────

export function tickNeeds(ctx: EngineContext): void {
	ctx.needs.update(
		ctx.deltaMs,
		(name) => ctx.brain.getState(name)?.state ?? "idle",
		(name) => getNearbyAgents(ctx, name),
		ctx.dayClock.getPhaseMultipliers(),
	);

	// Mood propagation — push derived mood into brain + emote + talk systems
	for (const agentName of ctx.needs.getAgentNames()) {
		const mood = ctx.needs.getMood(agentName);
		ctx.brain.updateMood(agentName, mood);
		ctx.emote.updateMood(agentName, mood);

		// Feed rich context to talk engine
		const nearby = getNearbyAgents(ctx, agentName);
		const nearbyAgent = nearby[0] ?? "";
		const nearbyDomain = nearbyAgent ? (ctx.store.agents.find((a) => a.name === nearbyAgent)?.domain ?? "") : "";
		ctx.talk.updateVars(agentName, {
			mood,
			mood_adj: mood === "neutral" ? "focused" : mood,
			phase: ctx.dayClock.getPhase(),
			weather: ctx.worldAmbience.getWeather(),
			streak: String(ctx.memory.getMemory(agentName).workStreak),
			nearby_agent: nearbyAgent,
			nearby_domain: nearbyDomain,
		});
	}
}

// ── 4. tickReactiveTriggers — energy/mood/focus threshold talk ────────

export function tickReactiveTriggers(ctx: EngineContext): void {
	for (const agentName of ctx.needs.getAgentNames()) {
		const needs = ctx.needs.getNeeds(agentName);
		const mood = ctx.needs.getMood(agentName);
		let fired = ctx.firedReactiveTriggers.get(agentName);
		if (!fired) { fired = new Set(); ctx.firedReactiveTriggers.set(agentName, fired); }
		const tryTrigger = (trigger: ReactiveTrigger) => {
			if (!fired!.has(trigger)) {
				fired!.add(trigger);
				ctx.talk.triggerReactive(agentName, trigger);
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
	processThresholds(ctx);

	// Object attraction — agents navigate to environmental objects when needs/phase trigger
	const objectLookup: Record<string, InteractableActor> = {
		coffeeMachine: ctx.coffeeMachine,
		snackTable: ctx.snackTable,
		waterCooler: ctx.waterCooler,
		couch: ctx.couch,
	};
	const currentPhase = ctx.dayClock.getPhase();
	for (const agentName of ctx.needs.getAgentNames()) {
		const state = ctx.brain.getState(agentName)?.state;
		if (state !== "idle" && state !== "wandering") continue;
		const needs = ctx.needs.getNeeds(agentName);
		for (const rule of OBJECT_ATTRACTION_RULES) {
			const obj = objectLookup[rule.objectKey];
			if (!obj || obj.isOccupied()) continue;
			const phaseMatch = rule.phases.includes(currentPhase);
			const needMatch = rule.needCheck(needs);
			if ((phaseMatch || needMatch) && Math.random() < rule.chance) {
				const point = obj.getInteractionPoint();
				ctx.brain.walkTo(agentName, point);
				obj.occupy(agentName);
				// Apply needs effects on arrival (delayed)
				setTimeout(() => {
					const effects = obj.getNeedsEffects();
					ctx.needs.applyEffect(agentName, effects);
					obj.vacate();
					// Spawn interaction particles
					if (obj === ctx.coffeeMachine) ctx.particlePool.spawnPreset("steam", point.x, point.y - 20);
				}, OBJECT_EFFECT_DELAY);
				break; // one attraction per agent per frame
			}
		}
	}
}

// ── 6. tickPets — pet behavior, follow, proximity reactions ──────────

export function tickPets(ctx: EngineContext): void {
	for (const pet of ctx.pets) {
		pet.updateBehavior(ctx.deltaMs);
		const petRoom = ctx.registry.getEntityRoom(pet.entityId);

		// Follow behavior — move toward target agent (only if same room)
		if (pet.getFollowTarget()) {
			const targetRoom = ctx.registry.getEntityRoom(pet.getFollowTarget()!);
			if (targetRoom === petRoom) {
				const targetPos = ctx.brain.getPosition(pet.getFollowTarget()!);
				if (targetPos) pet.moveToward(targetPos.x, targetPos.y, ctx.deltaMs);
			} else {
				pet.setFollowTarget(null); // lost target — different room
			}
		}

		// Dog follows nearest idle agent in same room
		if (pet.petType === "dog" && pet.getState() === "idle" && Math.random() < DOG_FOLLOW_CHANCE) {
			const sameRoomAgents = ctx.needs.getAgentNames().filter((n) =>
				ctx.registry.getEntityRoom(n) === petRoom && ctx.brain.getState(n)?.state === "idle",
			);
			if (sameRoomAgents.length > 0) {
				pet.setFollowTarget(sameRoomAgents[Math.floor(Math.random() * sameRoomAgents.length)]);
			}
		}

		// Cat follows stressed agents in same room (low morale)
		if (pet.petType === "cat" && pet.getState() === "idle" && Math.random() < CAT_FOLLOW_STRESSED_CHANCE) {
			const sameRoomStressed = ctx.needs.getAgentNames().filter((n) =>
				ctx.registry.getEntityRoom(n) === petRoom && ctx.needs.getNeeds(n).morale < CAT_STRESS_MORALE_THRESHOLD,
			);
			if (sameRoomStressed.length > 0) {
				pet.setFollowTarget(sameRoomStressed[Math.floor(Math.random() * sameRoomStressed.length)]);
			}
		}

		// Agent proximity reactions — only agents in the same room
		if (pet.getState() !== "sleeping" && petRoom) {
			for (const agentName of ctx.needs.getAgentNames()) {
				if (ctx.registry.getEntityRoom(agentName) !== petRoom) continue;
				const agentPos = ctx.brain.getPosition(agentName);
				if (!agentPos) continue;
				const dx = pet.pos.x - agentPos.x;
				const dy = pet.pos.y - agentPos.y;
				const dist = Math.sqrt(dx * dx + dy * dy);
				if (dist < pet.getInteractRadius()) {
					const cooldownKey = `${agentName}:${pet.petType}`;
					const lastReaction = ctx.petReactionCooldowns.get(cooldownKey) ?? 0;
					if (performance.now() - lastReaction > PET_REACTION_COOLDOWN) {
						ctx.petReactionCooldowns.set(cooldownKey, performance.now());
						ctx.needs.applyEffect(agentName, pet.getNeedsEffects());
						const def = PET_DEFINITIONS.find((d) => d.type === pet.petType);
						if (def && def.phrases.length > 0) {
							const phrase = def.phrases[Math.floor(Math.random() * def.phrases.length)];
							ctx.bubble.showBubble(agentName, "thought", phrase, ctx.engine.currentScene, ctx.findAgentActor, 3000);
						}
						ctx.particlePool.spawnPreset("hearts", (pet.pos.x + agentPos.x) / 2, (pet.pos.y + agentPos.y) / 2);
					}
				}
			}
		}
	}
}

// ── 7. tickRoomTransit — room switching via RoomSwitcher ─────────────

export function tickRoomTransit(ctx: EngineContext): void {
	ctx.roomSwitcher.update(ctx.deltaMs);
}

// ── 8. tickBehaviorTree — BT needs refresh + tick + action processing ─

export function tickBehaviorTree(ctx: EngineContext): void {
	// Refresh BT agent needs snapshots from the live needs system
	for (const agentName of ctx.needs.getAgentNames()) {
		const btAgent = ctx.bt.getAgent(agentName);
		if (btAgent) {
			const live = ctx.needs.getNeeds(agentName);
			btAgent.context.needs.energy = live.energy;
			btAgent.context.needs.social = live.social;
			btAgent.context.needs.focus = live.focus;
			btAgent.context.needs.morale = live.morale;
		}
	}

	const btActions = ctx.bt.update(ctx.deltaMs, ctx.btWorldState, ctx.btClock);
	for (const action of btActions) {
		if (action.type === "goal-started") {
			ctx.brain.assignWork(action.agentName);
		} else if (action.type === "goal-completed" || action.type === "artifact-dropped") {
			ctx.brain.releaseWork(action.agentName);
		} else if (action.type === "speaking") {
			const text = String(action.data.text ?? "");
			if (text) {
				ctx.bubble.showBubble(action.agentName, "speech", text, ctx.engine.currentScene, ctx.findAgentActor, 4000);
			}
		}
	}
}

// ── 9. tickBrain — snapshot walking state THEN update brain ──────────
// LOAD-BEARING ORDER: prevWalkingState MUST be captured before brainSystem.update()
// so that particle trail detection in tickVisuals can detect transitions.

export function tickBrain(ctx: EngineContext): void {
	// Snapshot walking states before brain update
	for (const [name, entry] of ctx.brain.getAllEntries()) {
		ctx.prevWalkingState.set(name, entry.state === "wandering" || entry.state === "walking-to");
	}

	// Brain system — movement, state machine
	ctx.brain.update(ctx.deltaMs, ctx.findAgentActor, (name) => ctx.registry.getEntityRoom(name));
}

// ── 10. tickSocial — ritual + social + talk ──────────────────────────

export function tickSocial(ctx: EngineContext): void {
	// Ritual system — ceremonial choreography
	ctx.ritual.update(ctx.deltaMs, (name) => ctx.brain.getState(name)?.state ?? "idle");

	// Social system — proximity conversations (room-isolated: offset positions by room)
	ctx.social.update(
		ctx.deltaMs,
		(name) => {
			const pos = ctx.brain.getPosition(name) ?? { x: 0, y: 0 };
			const room = ctx.registry.getEntityRoom(name) ?? "";
			const offset = ROOM_OFFSETS[room] ?? UNKNOWN_ROOM_OFFSET;
			return { x: pos.x + offset, y: pos.y + offset };
		},
		(name) => ctx.brain.getState(name)?.state ?? "idle",
		(name) => ctx.needs.getNeeds(name),
	);

	// Talk engine — ambient chatter
	ctx.talk.update(ctx.deltaMs);
}

// ── 11. tickDirector — director + engagement + tool executor ─────────

export function tickDirector(ctx: EngineContext): void {
	ctx.director.update(ctx.deltaMs);

	ctx.engagement.update(
		ctx.deltaMs,
		() => ctx.director.getPresence(),
		(name) => ctx.needs.getNeeds(name),
		(name) => ctx.brain.getState(name)?.state ?? "idle",
		(_name) => false,
	);

	ctx.engagement.setContext({
		agentCount: String(ctx.brain.getAllEntries().size),
	});

	ctx.tool.update(ctx.deltaMs);
}

// ── 12. tickVisuals — emote, particles, weather, lighting, bubbles, camera ─

export function tickVisuals(ctx: EngineContext): void {
	// Emote system — mood-driven emotes
	ctx.emote.update(ctx.deltaMs, (name) => ctx.brain.getState(name)?.state ?? "idle");

	// Particle pool update
	ctx.particlePool.update(ctx.deltaMs);

	// Particle trails — walking dust trails + arrival bursts
	updateParticleTrails(ctx);

	// Weather ambient particles
	const weatherVisuals = ctx.worldAmbience.getWeatherVisuals();
	if (weatherVisuals.particleCount > 0) {
		if (Math.random() < WEATHER_PARTICLE_CHANCE) {
			const x = Math.random() * ENGINE_WIDTH;
			const y = weatherVisuals.particleAngle > 0 ? 0 : Math.random() * ENGINE_HEIGHT;
			ctx.particlePool.spawn({
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
	const targetLight = ctx.worldAmbience.getLighting(ctx.dayClock.getPhase());
	const lerpT = Math.min(1, LIGHT_LERP_SPEED * ctx.deltaMs);
	ctx.currentLight.r += (targetLight.r - ctx.currentLight.r) * lerpT;
	ctx.currentLight.g += (targetLight.g - ctx.currentLight.g) * lerpT;
	ctx.currentLight.b += (targetLight.b - ctx.currentLight.b) * lerpT;
	ctx.currentLight.opacity += (targetLight.opacity - ctx.currentLight.opacity) * lerpT;

	// Workstation glow updates
	for (const room of Object.values(ctx.roomScenes)) {
		for (const ws of room.getWorkstations()) {
			ws.updateGlow(ctx.deltaMs);
		}
	}

	// Bubble system — overhead speech/thought bubbles
	ctx.bubble.update(
		ctx.deltaMs,
		(name) => ctx.brain.getState(name)?.state === "idle",
		ctx.engine.currentScene,
		ctx.findAgentActor,
	);

	// Camera system
	if (ctx.cameraSystem) {
		ctx.cameraSystem.checkDespawn();
		ctx.cameraSystem.applyZoom(ctx.deltaMs);
		ctx.cameraSystem.updatePan(ctx.deltaMs);
	}
}

// ── Helper: getNearbyAgents ──────────────────────────────────────────

/** Get names of agents within social radius of `name` — same room only. */
export function getNearbyAgents(ctx: EngineContext, name: string): string[] {
	const pos = ctx.brain.getPosition(name);
	if (!pos) return [];
	const myRoom = ctx.registry.getEntityRoom(name);
	const params = ctx.brain.getState(name);
	const radius = params?.params.socialRadius ?? 100;
	return [...ctx.brain.getAllEntries()]
		.filter(([n]) => {
			if (n === name) return false;
			if (ctx.registry.getEntityRoom(n) !== myRoom) return false;
			const otherPos = ctx.brain.getPosition(n);
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
	for (const agentName of ctx.needs.getAgentNames()) {
		if (ctx.registry.isInTransit(agentName)) continue;
		const actions = ctx.needs.checkThresholds(agentName);
		for (const action of actions) {
			switch (action.type) {
				case "force-break":
					if (ctx.brain.getState(agentName)?.state !== "on-break") {
						ctx.brain.applyEvent(agentName, "break");
					}
					break;
				case "seek-agent": {
					const nearest = ctx.findNearestAgent(agentName);
					if (nearest) ctx.brain.walkTo(agentName, nearest);
					break;
				}
				case "seek-quiet":
				case "demoralized":
					ctx.brain.applyEvent(agentName, "idle");
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
	for (const [name, entry] of ctx.brain.getAllEntries()) {
		const wasWalking = ctx.prevWalkingState.get(name) ?? false;
		const isWalking = entry.state === "wandering" || entry.state === "walking-to";

		if (isWalking) {
			const actor = ctx.findCurrentSceneActor(name);
			if (!actor) continue;
			const x = actor.pos.x;
			const y = actor.pos.y + TRAIL_Y_OFFSET;
			const prev = ctx.lastTrailPos.get(name);
			if (!prev) {
				ctx.lastTrailPos.set(name, { x, y });
				continue;
			}
			const dx = x - prev.x;
			const dy = y - prev.y;
			if (dx * dx + dy * dy >= TRAIL_DISTANCE_SQ) {
				ctx.particlePool.spawnTrail(x, y, agentParticleColor(ctx, name), entry.state === "walking-to");
				ctx.lastTrailPos.set(name, { x, y });
			}
		} else {
			ctx.lastTrailPos.delete(name);
			if (wasWalking) {
				const actor = ctx.findCurrentSceneActor(name);
				if (actor) ctx.particlePool.spawnDustBurst(actor.pos.x, actor.pos.y + TRAIL_Y_OFFSET, agentParticleColor(ctx, name));
			}
		}
	}
}
