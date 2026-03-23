/**
 * engine-startup.ts — Agent registration and initial placement logic.
 *
 * Extracted from engine.ts to reduce file size. Contains registerAgents()
 * and routeAgentsToRooms() which are called during engine start().
 */

import type { DashboardAgent } from "./data/types.js";
import type { SavedPosition } from "./engine-state.js";
import type { BlackboardManager } from "./systems/blackboard.js";
import { computeParams } from "./brain/agent-brain.js";
import { createBtDeps } from "./systems/bt-system.js";
import type { IClock } from "./brain/behavior-tree/bt-types.js";
import type { BubbleSystem } from "./systems/bubble-system.js";
import type { TalkEngine } from "./systems/talk/talk-engine.js";
import type { EmoteSystem } from "./systems/emote-system.js";
import type { SocialSystem } from "./systems/social-system.js";
import type { NeedsSystem } from "./systems/needs-system.js";
import type { SensorSystem } from "./systems/sensor-system.js";
import type { EngagementSystem } from "./systems/engagement-system.js";
import type { RitualSystem } from "./systems/ritual-system.js";
import type { MemorySystem } from "./systems/memory-system.js";
import type { QuirkSystem } from "./systems/quirk-system.js";
import type { RelationshipSystem } from "./systems/relationship-system.js";
import type { BtSystem } from "./systems/bt-system.js";
import type { GameScene } from "./scenes/game-scene.js";
import type { SceneRegistry } from "./systems/scene-registry.js";
import type { SceneEntity } from "./data/scene-entity.js";
import type { PetActor } from "./actors/pet-actor.js";
import type { PetSceneEntity } from "./actors/pet-scene-entity.js";
import { assignOpinions } from "./data/opinion-topics.js";
import { resolveSettingForDomain } from "./config/domain-map.js";
import { DEFAULT_PET_ROOMS } from "./engine-config.js";
import type { DashboardStore } from "./store/dashboard-store.js";
import { AgentSceneEntity } from "./actors/agent-scene-entity.js";
import { resolveCharacter } from "./sprites/character-pool.js";
import type { AgentSprites } from "./sprites/sprite-loader.js";
import type { InteractionBootstrap } from "./systems/interaction/bootstrap-interactions.js";
import { registerAgentResolver } from "./systems/interaction/bootstrap-interactions.js";
import type { InteractionHooks } from "./brain/behavior-tree/bt-types.js";

// ── Types ────────────────────────────────────────────────────────────

export interface RegistrationSystems {
	readonly blackboards: BlackboardManager;
	readonly bubble: BubbleSystem;
	readonly talk: TalkEngine;
	readonly emote: EmoteSystem;
	readonly social: SocialSystem;
	readonly needs: NeedsSystem;
	readonly sensor: SensorSystem;
	readonly engagement: EngagementSystem;
	readonly ritual: RitualSystem;
	readonly memory: MemorySystem;
	readonly quirk: QuirkSystem;
	readonly relationship: RelationshipSystem;
	readonly bt: BtSystem;
	readonly btClock: IClock;
	readonly knownEntities: Set<string>;
	readonly interactionBootstrap?: InteractionBootstrap;
}

export interface PlacementContext {
	readonly hubScene: GameScene;
	readonly roomScenes: Record<string, GameScene>;
	readonly registry: SceneRegistry;
	readonly allEntities: Map<string, SceneEntity>;
	readonly pets: readonly PetActor[];
}

// ── Agent registration ───────────────────────────────────────────────

/** Register a single agent across all game subsystems. */
function registerSingleAgent(agent: DashboardAgent, sys: RegistrationSystems): void {
	const name = agent.name;
	const domain = agent.domain ?? "general";
	const attrs = agent.attributes ?? {};
	const personality = agent.personality ?? [];

	sys.blackboards.register(name);
	const params = computeParams(attrs);

	sys.bubble.register(name, personality, params);
	sys.talk.register(name, domain, personality, attrs.cha ?? 10);
	sys.emote.register(name, agent.mood ?? "neutral", params.quoteFrequency);
	sys.social.register(name, {
		socialRadius: params.socialRadius,
		personality,
		domain,
		relationships: agent.relationships ?? [],
	});
	sys.needs.register(name, attrs);
	sys.sensor.register(name, domain);
	sys.engagement.register(name, { domain, cha: attrs.cha ?? 10 });
	sys.ritual.register(name, { domain });
	sys.memory.register(name);

	registerQuirksAndOpinions(agent, sys);
	const btDeps = createBtDeps(sys.blackboards.get(name), sys.btClock);
	sys.bt.register(agent, btDeps, sys.quirk.getQuirks(agent.name));

	// Wire interaction resolver + BT hooks
	if (sys.interactionBootstrap) {
		const resolver = registerAgentResolver(sys.interactionBootstrap, name, {
			social: {
				getNearbyEntities: (entityId: string) => [...sys.social.getNearbyEntities(entityId)],
			},
			relationship: sys.relationship,
			needs: sys.needs,
			dayClock: { getPhase: () => "" },
			conversation: { isLocked: () => false },
		});

		const btAgent = sys.bt.getAgent(name);
		if (btAgent) {
			const bus = sys.interactionBootstrap.system.getBus();
			const hooks: InteractionHooks = {
				getNearby: () => sys.social.getNearbyEntities(name).map(e => ({
					id: e.id,
					entityType: e.entityType,
					distance: e.distance,
				})),
				resolve: () => resolver.resolve().map(i => ({ id: i.id, action: i.action })),
				submit: (interaction) => {
					const full = resolver.resolve().find(i => i.id === interaction.id);
					if (!full) return false;
					return bus.submit(full).status === "enqueued";
				},
			};
			btAgent.context.interactionHooks = hooks;
		}
	}

	sys.knownEntities.add(name);
}

/** Register quirk overrides and relationship opinions from memory. */
function registerQuirksAndOpinions(agent: DashboardAgent, sys: RegistrationSystems): void {
	const name = agent.name;
	const domain = agent.domain ?? "general";
	const savedQuirks = sys.memory.getMemory(name).quirks;
	sys.quirk.register(name, (agent.attributes ?? {}) as Record<string, number>, domain, savedQuirks);
	if (savedQuirks.length === 0) {
		sys.memory.getMemory(name).quirks = sys.quirk.getQuirks(name);
	}
	// Quirk overrides → blackboard wiring deferred to P2 (quirk multipliers
	// like socialRadiusMultiplier / moveSpeedMultiplier will be applied to
	// blackboard fields once the locomotion layer consumes them).
	sys.quirk.getOverrides(name);

	const savedOpinions = sys.memory.getMemory(name).opinions;
	const opinions = savedOpinions.length > 0 ? savedOpinions : assignOpinions();
	if (savedOpinions.length === 0) {
		sys.memory.getMemory(name).opinions = opinions;
	}
	sys.relationship.register(name, opinions);
}

/** Register all agents across all game subsystems. */
export function registerAgents(agents: readonly DashboardAgent[], hubScene: GameScene, store: { setAgents: (a: readonly DashboardAgent[]) => void }, sys: RegistrationSystems): void {
	hubScene.updateAgents(agents);
	store.setAgents(agents);
	for (const agent of agents) {
		registerSingleAgent(agent, sys);
	}
}

/** Tear down one agent across simulation systems (roster removal). */
export function unregisterAgentFromSimulation(name: string, sys: RegistrationSystems): void {
	sys.blackboards.unregister(name);
	sys.bubble.unregister(name);
	sys.talk.unregister(name);
	sys.emote.unregister(name);
	sys.social.unregister(name);
	sys.needs.remove(name);
	sys.sensor.unregister(name);
	sys.engagement.unregister(name);
	sys.ritual.unregister(name);
	sys.memory.unregister(name);
	sys.quirk.unregister(name);
	sys.relationship.unregister(name);
	sys.bt.unregister(name);
	sys.knownEntities.delete(name);
}

export interface RosterReconcileExtras {
	readonly spriteRegistry: ReadonlyMap<string, AgentSprites>;
	readonly blackboards: BlackboardManager;
	readonly handleAgentSelect: (name: string) => void;
	readonly allEntities: Map<string, SceneEntity>;
}

/**
 * Apply a new dashboard roster while the world is running: remove dropped agents,
 * register and place newcomers, refresh hub grid.
 */
export function reconcileSimulationRoster(
	prev: readonly DashboardAgent[],
	next: readonly DashboardAgent[],
	hubScene: GameScene,
	roomScenes: Record<string, GameScene>,
	store: DashboardStore,
	sys: RegistrationSystems,
	ctx: PlacementContext,
	extras: RosterReconcileExtras,
): void {
	const prevNames = new Set(prev.map((a) => a.name));
	const nextNames = new Set(next.map((a) => a.name));
	for (const name of prevNames) {
		if (nextNames.has(name)) continue;
		unregisterAgentFromSimulation(name, sys);
		hubScene.removeAgent(name);
		for (const room of Object.values(roomScenes)) {
			room.removeAgent(name);
		}
		extras.allEntities.delete(name);
	}
	const newcomers = next.filter((a) => !prevNames.has(a.name));
	for (const agent of newcomers) {
		registerSingleAgent(agent, sys);
		const charName = resolveCharacter(agent.name, agent.domain ?? "");
		const sprites = extras.spriteRegistry.get(charName);
		if (sprites) {
			const entity = new AgentSceneEntity(agent, sprites, extras.blackboards, extras.handleAgentSelect);
			extras.allEntities.set(agent.name, entity);
		}
	}
	store.setAgents(next);
	hubScene.updateAgents(next);
	routeAgentsToRooms(newcomers, null, ctx);
}

// ── Agent routing ────────────────────────────────────────────────────

/** Route agents to their target rooms, restoring saved positions if available. */
export function routeAgentsToRooms(
	agents: readonly DashboardAgent[],
	savedPositions: Record<string, SavedPosition> | null,
	ctx: PlacementContext,
): void {
	for (const agent of agents) {
		const saved = savedPositions?.[agent.name];
		const targetRoom = saved?.scene && ctx.registry.getScene(saved.scene) ? saved.scene : resolveSettingForDomain(agent.domain);
		placeAgentInRoom(agent, targetRoom, saved, ctx);
	}
}

/** Place a single agent in its target room with optional saved position. */
function placeAgentInRoom(
	agent: DashboardAgent,
	targetRoom: string,
	saved: SavedPosition | undefined,
	ctx: PlacementContext,
): void {
	if (targetRoom === "hub") {
		ctx.registry.setEntityRoom(agent.name, "hub");
		if (saved) {
			const actor = ctx.hubScene.getAgentActor(agent.name);
			if (actor) { actor.pos.x = saved.x; actor.pos.y = saved.y; }
		}
	} else if (ctx.roomScenes[targetRoom]) {
		ctx.hubScene.removeAgent(agent.name);
		if (saved) {
			ctx.roomScenes[targetRoom].spawnAgentAtDoorway(agent);
			const actor = ctx.roomScenes[targetRoom].getAgentActor(agent.name);
			if (actor) { actor.pos.x = saved.x; actor.pos.y = saved.y; }
		} else {
			ctx.roomScenes[targetRoom].spawnAgent(agent);
		}
		ctx.registry.setEntityRoom(agent.name, targetRoom);
	}
}

/** Restore or default-place pet creatures into scenes. */
export function placePets(
	savedPositions: Record<string, SavedPosition> | null,
	ctx: PlacementContext,
): void {
	for (const pet of ctx.pets) {
		const saved = savedPositions?.[pet.entityId];
		const targetRoom = saved?.scene ?? DEFAULT_PET_ROOMS[pet.entityId] ?? "hub";
		const scene = targetRoom === "hub" ? ctx.hubScene : (ctx.roomScenes[targetRoom] ?? ctx.hubScene);
		const petEntity = ctx.allEntities.get(pet.entityId)!;

		scene.enter(petEntity as SceneEntity, null);
		if (saved) {
			pet.pos.x = saved.x;
			pet.pos.y = saved.y;
			pet.resetHome();
			(petEntity as PetSceneEntity).syncVisual();
			if (typeof saved.hunger === "number") pet.setHunger(saved.hunger);
			if (typeof saved.thirst === "number") pet.setThirst(saved.thirst);
		}
		ctx.registry.setEntityRoom(pet.entityId, targetRoom);
	}
}
