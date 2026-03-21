/**
 * engine-startup.ts — Agent registration and initial placement logic.
 *
 * Extracted from engine.ts to reduce file size. Contains registerAgents()
 * and routeAgentsToRooms() which are called during engine start().
 */

import type { DashboardAgent } from "./data/types.js";
import type { BrainSystem } from "./systems/brain-system.js";
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

// ── Types ────────────────────────────────────────────────────────────

export interface RegistrationSystems {
	readonly brain: BrainSystem;
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
	readonly btDeps: Parameters<BtSystem["register"]>[1];
	readonly knownEntities: Set<string>;
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

	sys.brain.register(name, attrs, agent.mood, domain);
	const brainState = sys.brain.getState(name)!;

	sys.bubble.register(name, personality, brainState.params);
	sys.talk.register(name, domain, personality, attrs.cha ?? 10);
	sys.emote.register(name, agent.mood ?? "neutral", brainState.params.quoteFrequency);
	sys.social.register(name, {
		socialRadius: brainState.params.socialRadius,
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
	sys.bt.register(agent, sys.btDeps);
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
	const overrides = sys.quirk.getOverrides(name);
	if (Object.keys(overrides).length > 0) {
		sys.brain.applyQuirkOverrides(name, overrides as Record<string, number>);
	}

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

// ── Agent routing ────────────────────────────────────────────────────

/** Route agents to their target rooms, restoring saved positions if available. */
export function routeAgentsToRooms(
	agents: readonly DashboardAgent[],
	savedPositions: Record<string, { x: number; y: number; scene: string }> | null,
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
	saved: { x: number; y: number } | undefined,
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
	savedPositions: Record<string, { x: number; y: number; scene: string }> | null,
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
		}
		ctx.registry.setEntityRoom(pet.entityId, targetRoom);
	}
}
