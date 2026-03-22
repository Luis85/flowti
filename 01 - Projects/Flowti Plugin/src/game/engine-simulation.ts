/**
 * engine-simulation.ts — Preframe simulation loop decomposed into 12 named tick functions.
 *
 * tickSimulation() is called once per frame from engine.ts and orchestrates
 * all system updates in a precise order. Each tick function is independently
 * testable and receives the shared EngineContext.
 */

import type { EngineContext } from "./engine-types.js";
import type { InteractableActor } from "./actors/interactable-actor.js";
import { renderInteractionActions } from "./systems/interaction/interaction-effect-renderer.js";
import { PetSceneEntity } from "./actors/pet-scene-entity.js";
import type { ReactiveTrigger } from "./systems/talk/templates/reactive-phrases.js";
import {
	DOMAIN_PARTICLE_COLORS, DEFAULT_PARTICLE_COLOR,
	LIGHT_LERP_SPEED, ENGINE_WIDTH, ENGINE_HEIGHT,
	ROOM_OFFSETS, UNKNOWN_ROOM_OFFSET,
	OBJECT_ATTRACTION_RULES,
	TRAIL_DISTANCE_SQ, TRAIL_Y_OFFSET,
	WEATHER_PARTICLE_CHANCE, WEATHER_PARTICLE_LIFETIME, WEATHER_PARTICLE_OPACITY,
	DOG_FOLLOW_CHANCE, CAT_FOLLOW_STRESSED_CHANCE, CAT_STRESS_MORALE_THRESHOLD,
	OBJECT_EFFECT_DELAY, REACTIVE_THRESHOLDS,
} from "./engine-config.js";
import {
	HUNGER_PHRASES, THIRST_PHRASES, EATING_PHRASES, DRINKING_PHRASES, STEAL_REACTIONS,
} from "./systems/talk/templates/sustenance-phrases.js";
import { selectPetVoice } from "./systems/talk/pet-voice-selector.js";
import {
	PET_INSTINCT_FRAGMENTS, PET_ELOQUENT_FRAGMENTS, PET_GREMLIN_FRAGMENTS,
} from "./systems/talk/templates/index.js";
import type { CascadeReaction } from "./systems/echo/cascade-resolver.js";

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
	runTimedPhase(ctx, "clock", tickClock);
	runTimedPhase(ctx, "sensor", tickSensor);
	runTimedPhase(ctx, "needs", tickNeeds);
	runTimedPhase(ctx, "reactiveTriggers", tickReactiveTriggers);
	runTimedPhase(ctx, "behaviorThresholds", tickBehaviorThresholds);
	runTimedPhase(ctx, "pets", tickPets);
	runTimedPhase(ctx, "roomTransit", tickRoomTransit);
	runTimedPhase(ctx, "behaviorTree", tickBehaviorTree);
	runTimedPhase(ctx, "brain", tickBrain);
	runTimedPhase(ctx, "interactions", tickInteractions);
	runTimedPhase(ctx, "social", tickSocial);
	runTimedPhase(ctx, "director", tickDirector);
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

// ── 3. tickNeeds — decay/restore needs + mood propagation ────────────

export function tickNeeds(ctx: EngineContext): void {
	const { systems: sys, state } = ctx;
	runTimedGameSystem(ctx, "needs", () => {
		sys.needs.update(
			state.deltaMs,
			(name) => sys.brain.getState(name)?.state ?? "idle",
			(name) => getNearbyAgents(ctx, name),
			sys.dayClock.getPhaseMultipliers(),
		);
	});

	// Mood propagation — push derived mood into brain + emote + talk systems
	for (const agentName of sys.needs.getAgentNames()) {
		runAgentSlice(ctx, agentName, "needs", () => {
			const mood = sys.needs.getMood(agentName);
			sys.brain.updateMood(agentName, mood);
			sys.emote.updateMood(agentName, mood);

			// Echo spatial preference: idle agents gravitate toward bonded agents
			const bondTarget = sys.echo.getStrongest(agentName, "bond");
			if (bondTarget?.target && Math.random() < 0.4) {
				const targetActor = ctx.lookups.findAgentActor(bondTarget.target);
				if (targetActor) {
					sys.brain.setWanderHint(agentName, {
						x: targetActor.pos.x + (Math.random() - 0.5) * 60,
						y: targetActor.pos.y + (Math.random() - 0.5) * 60,
					});
				}
			} else {
				sys.brain.setWanderHint(agentName, null);
			}

			// Echo producer — morale threshold echo generation
			const morale = sys.needs.getNeeds(agentName).morale;
			ctx.echoProducer.onMorale(agentName, morale, sys.dayClock.getCycleCount());

			// Echo break threshold — negative mood-residue lowers breakThreshold
			const moodResidueWeight = sys.echo.queryWeight(agentName, "mood-residue");
			sys.brain.setBreakThresholdBias(agentName, moodResidueWeight);

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

// ── 5. tickBehaviorThresholds — needs-driven overrides + object attraction ─

export function tickBehaviorThresholds(ctx: EngineContext): void {
	const { systems: sys } = ctx;
	runTimedGameSystem(ctx, "behaviorThresholds", () => {
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
	});
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
			const phrase = STEAL_REACTIONS[Math.floor(Math.random() * STEAL_REACTIONS.length)];
			sys.bubble.showBubble(agentName, "thought", phrase, ctx.engine.currentScene, ctx.lookups.findBubbleAnchor, 2500);
			break;
		}
		if (obj.isOccupied() || !ruleMatches || Math.random() >= rule.chance) continue;
		const point = obj.getInteractionPoint();
		sys.brain.walkTo(agentName, point);
		obj.occupy(agentName);
		const isFoodStation = rule.objectKey === "snackTable" || rule.objectKey === "foodBowlHub" || rule.objectKey === "foodBowlVillage";
		const isDrinkStation = rule.objectKey === "coffeeMachine" || rule.objectKey === "waterCooler" || rule.objectKey === "waterBowlOffice" || rule.objectKey === "waterBowlStation";
		setTimeout(() => {
			sys.needs.applyEffect(agentName, obj.getNeedsEffects());
			obj.vacate();
			if (obj === ctx.envObjects.coffeeMachine) sys.particlePool.spawnPreset("steam", point.x, point.y - 20);
			// Show eating/drinking completion bubble
			if (isFoodStation) {
				const phrase = EATING_PHRASES[Math.floor(Math.random() * EATING_PHRASES.length)];
				sys.bubble.showBubble(agentName, "thought", phrase, ctx.engine.currentScene, ctx.lookups.findBubbleAnchor, 2500);
			} else if (isDrinkStation) {
				const phrase = DRINKING_PHRASES[Math.floor(Math.random() * DRINKING_PHRASES.length)];
				sys.bubble.showBubble(agentName, "thought", phrase, ctx.engine.currentScene, ctx.lookups.findBubbleAnchor, 2500);
			}
		}, OBJECT_EFFECT_DELAY);
		break;
	}
}

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

			// PetSceneEntity draws a proxy Actor; PetActor.pos is updated here. Without syncing,
			// sprites stay at spawn until a room transfer recenters them at the door.
			if (petRoom) {
				const sceneForPet = ctx.scenes.map[petRoom] ?? (petRoom === "hub" ? ctx.scenes.hub : undefined);
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

// ── 7. tickRoomTransit — room switching via RoomSwitcher ─────────────

export function tickRoomTransit(ctx: EngineContext): void {
	runTimedGameSystem(ctx, "roomSwitcher", () => {
		ctx.systems.roomSwitcher.update(ctx.state.deltaMs);
	});
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
			btAgent.context.echoStore = sys.echo;
			btAgent.context.currentRoom = sys.registry.getEntityRoom(agentName);
		}
	}

	// Refresh pet BT echo context
	for (const petName of sys.bt.getPetNames()) {
		const petCtx = sys.bt.getPetContext(petName);
		if (petCtx) {
			petCtx.echoStore = sys.echo;
			petCtx.currentRoom = sys.registry.getEntityRoom(petName);
		}
	}

	const btActions = sys.bt.update(state.deltaMs, ctx.btBridge.worldState, ctx.btBridge.clock);
	for (const action of btActions) {
		if (action.type === "goal-started") {
			sys.brain.assignWork(action.agentName);
		} else if (action.type === "goal-completed" || action.type === "artifact-dropped") {
			sys.brain.releaseWork(action.agentName);
		} else if (action.type === "speaking") {
			const source = String(action.data.source ?? "");
			const text = String(action.data.text ?? "");
			if (source === "social") {
				// Route social interactions through ConversationEngine first
				const target = String(action.data.target ?? "");
				if (target) {
					const domainA = ctx.store.agents.find((a) => a.name === action.agentName)?.domain ?? "";
					const domainB = ctx.store.agents.find((a) => a.name === target)?.domain ?? "";
					const started = sys.conversation.tryScript(action.agentName, target, "proximity", {
						domainA, domainB,
					});
					if (!started && text) {
						sys.bubble.showBubble(action.agentName, "speech", text, ctx.engine.currentScene, ctx.lookups.findBubbleAnchor, 4000);
					}
				}
			} else if (text) {
				sys.bubble.showBubble(action.agentName, "speech", text, ctx.engine.currentScene, ctx.lookups.findBubbleAnchor, 4000);
			}
		} else if (action.type === "seek-preferred-food" || action.type === "seek-preferred-drink") {
			const station = String(action.data.station ?? "");
			if (station) {
				ctx.echoProducer.onPreferredStation(action.agentName, station, sys.dayClock.getCycleCount());
			}
		} else if (action.type === "error") {
			const summary = String(action.data.summary ?? "Something went wrong in my behavior.");
			const detail = String(action.data.detail ?? "");
			const maxDetail = 140;
			const snippet = detail.length > maxDetail ? `${detail.slice(0, maxDetail)}…` : detail;
			const text = snippet ? `${summary} (${snippet})` : summary;
			sys.bubble.showBubble(action.agentName, "thought", text, ctx.engine.currentScene, ctx.lookups.findBubbleAnchor, 6500);
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

	const onSlice = ctx.state.perfSampler?.onAgentSlice;
	const recordBrain = onSlice
		? (name: string, ms: number) => {
			onSlice.call(ctx.state.perfSampler!, name, "brain", ms);
		}
		: undefined;

	runTimedGameSystem(ctx, "brain", () => {
		// Brain system — movement, state machine
		sys.brain.update(state.deltaMs, ctx.lookups.findAgentActor, (name) => sys.registry.getEntityRoom(name), recordBrain);

		// Standing order indicator — show loop icon when agent is working and task-locked
		for (const [name, entry] of sys.brain.getAllEntries()) {
			const actor = ctx.lookups.findAgentActor(name);
			if (!actor) continue;
			const isActive = entry.state === "working" && entry.taskLocked;
			if (actor.isStandingOrderActive() !== isActive) {
				actor.setStandingOrderActive(isActive);
			}
		}
	});
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
				// Frustrated conversation with nearest agent
				const nearest = ctx.lookups.findNearestAgent(reaction.agent);
				if (nearest && reaction.target) {
					const domainA = ctx.store.agents.find((a) => a.name === reaction.agent)?.domain ?? "";
					const domainB = ctx.store.agents.find((a) => a.name === reaction.target)?.domain ?? "";
					sys.conversation.tryScript(reaction.agent, reaction.target, "proximity", { domainA, domainB });
				}
				break;
			}
			case "seek-proximity": {
				// Walk toward bond target
				if (reaction.target) {
					const targetPos = sys.brain.getPosition(reaction.target);
					if (targetPos) sys.brain.walkTo(reaction.agent, targetPos);
				}
				break;
			}
			case "force-break":
				if (sys.brain.getState(reaction.agent)?.state !== "on-break") {
					sys.brain.applyEvent(reaction.agent, "break");
				}
				break;
			case "avoid-room":
				// Handled passively by echo preferences — no active action needed
				break;
			case "adjust-opinion":
				if (reaction.target) {
					sys.echo.addEcho(reaction.agent, {
						kind: "opinion", source: "reputation", target: reaction.target,
						weight: reaction.weight, decay: 2, tags: ["social", "gossip"],
					}, currentCycle);
				}
				break;
		}
	}

	runTimedGameSystem(ctx, "ritual", () => {
		sys.ritual.update(state.deltaMs, (name) => sys.brain.getState(name)?.state ?? "idle");
	});

	runTimedGameSystem(ctx, "social", () => {
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
	runTimedGameSystem(ctx, "emote", () => {
		sys.emote.update(state.deltaMs, (name) => sys.brain.getState(name)?.state ?? "idle");
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
			(name) => sys.brain.getState(name)?.state === "idle",
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
