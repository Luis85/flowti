/**
 * engine-types.ts — Shared types for the decomposed engine modules.
 *
 * EngineContext is the integration seam that all extracted modules receive.
 * It captures every system reference, mutable state map, scene reference,
 * actor lookup, and callback that the monolithic createAgentWorld() used
 * to access via closure variables.
 *
 * Organised into semantic sub-interfaces:
 *   systems  — all game systems (brain, bubble, talk, ...)
 *   scenes   — the four room scenes + lookup map
 *   envObjects — environmental interactable objects
 *   btBridge — behavior-tree bridge types
 *   state    — mutable per-frame / per-cycle tracking maps & scalars
 *   lookups  — actor/scene lookup functions and callbacks
 */

import type * as ex from "excalibur";
import type { BrainSystem } from "./systems/brain-system.js";
import type { BubbleSystem } from "./systems/bubble-system.js";
import type { TalkEngine } from "./systems/talk/talk-engine.js";
import type { ParticlePool } from "./systems/particle-system.js";
import type { EmoteSystem } from "./systems/emote-system.js";
import type { SocialSystem } from "./systems/social-system.js";
import type { NeedsSystem } from "./systems/needs-system.js";
import type { DirectorSystem } from "./systems/director-system.js";
import type { SensorSystem } from "./systems/sensor-system.js";
import type { EngagementSystem } from "./systems/engagement-system.js";
import type { RitualSystem } from "./systems/ritual-system.js";
import type { ToolExecutor } from "./systems/tool-executor-system.js";
import type { DayClock } from "./systems/day-clock.js";
import type { WorldAmbience } from "./systems/world-ambience.js";
import type { WorldEventScheduler } from "./systems/world-event-scheduler.js";
import type { MemorySystem } from "./systems/memory-system.js";
import type { QuirkSystem } from "./systems/quirk-system.js";
import type { RelationshipSystem } from "./systems/relationship-system.js";
import type { ConversationEngine } from "./systems/talk/conversation-engine.js";
import type { BtSystem } from "./systems/bt-system.js";
import type { SceneRegistry } from "./systems/scene-registry.js";
import type { RoomSwitcher } from "./systems/room-switcher.js";
import type { NarrativeSystem } from "./systems/narrative-system.js";
import type { DashboardStore } from "./store/dashboard-store.js";
import type { CameraSystem } from "./systems/camera-system.js";
import type { InteractionSystem } from "./systems/interaction/interaction-system.js";
import type { InteractionBootstrap } from "./systems/interaction/bootstrap-interactions.js";
import type { IEchoStore } from "./systems/echo/echo-types.js";
import type { GameScene } from "./scenes/game-scene.js";
import type { AgentActor } from "./actors/agent-actor.js";
import type { InteractableActor } from "./actors/interactable-actor.js";
import type { PetActor } from "./actors/pet-actor.js";
import type { DataProvider } from "./config/data-provider.js";
import type { SceneEntity } from "./data/scene-entity.js";
import type { AgentToolDeps, IClock, IWorldStateManager } from "./brain/behavior-tree/bt-types.js";
import type { AgentWorldPerfSink } from "./performance/agent-world-perf.js";

// ── BT bridge types (defined inline in engine.ts) ────────────────────

export interface BtWorldState extends IWorldStateManager {
	emitAction: (action: {
		id: string;
		agentName: string;
		timestamp: string;
		type: string;
		data: Record<string, unknown>;
	}) => void;
	updateEntity: () => void;
}

export interface BtClock extends IClock {
	now: () => number;
	ms: () => number;
	iso: () => string;
}

// ── Lighting state ───────────────────────────────────────────────────

export interface LightState {
	r: number;
	g: number;
	b: number;
	opacity: number;
}

// ── Sub-interfaces ───────────────────────────────────────────────────

export interface EngineSystems {
	readonly brain: BrainSystem;
	readonly bubble: BubbleSystem;
	readonly talk: TalkEngine;
	readonly particlePool: ParticlePool;
	readonly emote: EmoteSystem;
	readonly social: SocialSystem;
	readonly needs: NeedsSystem;
	readonly director: DirectorSystem;
	readonly sensor: SensorSystem;
	readonly engagement: EngagementSystem;
	readonly ritual: RitualSystem;
	readonly tool: ToolExecutor;
	readonly dayClock: DayClock;
	readonly worldAmbience: WorldAmbience;
	readonly worldEvent: WorldEventScheduler;
	readonly memory: MemorySystem;
	readonly quirk: QuirkSystem;
	readonly relationship: RelationshipSystem;
	readonly conversation: ConversationEngine;
	readonly bt: BtSystem;
	readonly registry: SceneRegistry;
	readonly roomSwitcher: RoomSwitcher;
	readonly narrative: NarrativeSystem;
	cameraSystem: CameraSystem | null;
	readonly interactions?: InteractionSystem;
	readonly echo: IEchoStore;
}

export interface EngineScenes {
	readonly hub: GameScene;
	readonly office: GameScene;
	readonly village: GameScene;
	readonly station: GameScene;
	readonly map: Record<string, GameScene>;
}

export interface EngineEnvObjects {
	readonly coffeeMachine: InteractableActor;
	readonly whiteboard: InteractableActor;
	readonly snackTable: InteractableActor;
	readonly waterCooler: InteractableActor;
	readonly couch: InteractableActor;
	readonly plant: InteractableActor;
	readonly noticeBoard: InteractableActor;
	readonly merchantStall: InteractableActor;
	readonly foodBowlHub: InteractableActor;
	readonly foodBowlVillage: InteractableActor;
	readonly waterBowlOffice: InteractableActor;
	readonly waterBowlStation: InteractableActor;
}

export interface BtBridge {
	readonly worldState: BtWorldState;
	readonly clock: BtClock;
	readonly deps: AgentToolDeps;
}

export interface EngineMutableState {
	/** Conversation count per agent in the current day cycle. */
	readonly cycleConversationCounts: Map<string, number>;
	/** Which reactive triggers have fired per agent this cycle. */
	readonly firedReactiveTriggers: Map<string, Set<string>>;
	/** Snapshot of previous walking state per agent (for trail particles). */
	readonly prevWalkingState: Map<string, boolean>;
	/** Last trail particle position per agent. */
	readonly lastTrailPos: Map<string, { x: number; y: number }>;
	/** Known entity IDs to distinguish initial adds from updates. */
	readonly knownEntities: Set<string>;
	/** Dedup guard for EventBus / external action relay. */
	readonly recentActionIds: Set<string>;
	/** All scene entities (agent + pet wrappers). */
	readonly allEntities: Map<string, SceneEntity>;

	/** Optional perf sampler for `perf.agentWorld.*` events (null when disabled). */
	perfSampler: AgentWorldPerfSink | null;

	// ── Mutable scalars ──────────────────────────────────
	/** Previous day-cycle count, for detecting cycle boundary. */
	prevCycleCount: number;
	/** Milliseconds since last frame (updated each preframe). */
	deltaMs: number;
	/** Last performance.now() value for delta calculation. */
	lastTime: number;
	/** Lighting state (lerped toward target each frame). */
	readonly currentLight: LightState;
}

export interface EngineLookups {
	readonly findAgentActor: (name: string) => AgentActor | undefined;
	readonly findCurrentSceneActor: (name: string) => AgentActor | undefined;
	readonly findNearestAgent: (agentName: string) => { x: number; y: number } | null;
	readonly handleAgentSelect: (agentName: string) => void;
	readonly handleSceneChange: (setting: string) => void;
}

// ── Engine context — the full integration seam ───────────────────────

export interface EngineContext {
	// ── Core singletons ─────────────────────────────────
	readonly engine: ex.Engine;
	readonly provider: DataProvider;
	readonly store: DashboardStore;

	// ── Semantic groups ─────────────────────────────────
	readonly systems: EngineSystems;
	readonly scenes: EngineScenes;
	readonly envObjects: EngineEnvObjects;
	readonly pets: PetActor[];
	readonly interactionBootstrap?: InteractionBootstrap;
	readonly btBridge: BtBridge;
	readonly state: EngineMutableState;
	readonly lookups: EngineLookups;
}
