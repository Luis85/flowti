/**
 * engine-types.ts — Shared types for the decomposed engine modules.
 *
 * EngineContext is the integration seam that all extracted modules receive.
 * It captures every system reference, mutable state map, scene reference,
 * actor lookup, and callback that the monolithic createAgentWorld() used
 * to access via closure variables.
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
import type { BtSystem } from "./systems/bt-system.js";
import type { SceneRegistry } from "./systems/scene-registry.js";
import type { RoomSwitcher } from "./systems/room-switcher.js";
import type { DashboardStore } from "./store/dashboard-store.js";
import type { CameraSystem } from "./systems/camera-system.js";
import type { GameScene } from "./scenes/game-scene.js";
import type { AgentActor } from "./actors/agent-actor.js";
import type { InteractableActor } from "./actors/interactable-actor.js";
import type { PetActor } from "./actors/pet-actor.js";
import type { DataProvider } from "./config/data-provider.js";
import type { SceneEntity } from "./data/scene-entity.js";
import type { AgentToolDeps, IClock, IWorldStateManager } from "./brain/behavior-tree/bt-types.js";

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

// ── Engine context — the full integration seam ───────────────────────

export interface EngineContext {
	// ── Excalibur engine ─────────────────────────────────
	readonly engine: ex.Engine;

	// ── Data provider ────────────────────────────────────
	readonly provider: DataProvider;

	// ── Reactive store ───────────────────────────────────
	readonly store: DashboardStore;

	// ── Systems ──────────────────────────────────────────
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
	readonly bt: BtSystem;
	readonly registry: SceneRegistry;
	readonly roomSwitcher: RoomSwitcher;

	// ── Camera ───────────────────────────────────────────
	cameraSystem: CameraSystem | null;

	// ── BT dependencies ──────────────────────────────────
	readonly btWorldState: BtWorldState;
	readonly btClock: BtClock;
	readonly btDeps: AgentToolDeps;

	// ── Scenes ───────────────────────────────────────────
	readonly hubScene: GameScene;
	readonly officeScene: GameScene;
	readonly villageScene: GameScene;
	readonly stationScene: GameScene;
	readonly roomScenes: Record<string, GameScene>;

	// ── Environmental objects ─────────────────────────────
	readonly coffeeMachine: InteractableActor;
	readonly whiteboard: InteractableActor;
	readonly snackTable: InteractableActor;
	readonly waterCooler: InteractableActor;
	readonly couch: InteractableActor;
	readonly plant: InteractableActor;
	readonly noticeBoard: InteractableActor;
	readonly foodBowlHub: InteractableActor;
	readonly foodBowlVillage: InteractableActor;
	readonly waterBowlOffice: InteractableActor;
	readonly waterBowlStation: InteractableActor;

	// ── Pets ─────────────────────────────────────────────
	readonly pets: PetActor[];

	// ── Entity tracking ──────────────────────────────────
	readonly allEntities: Map<string, SceneEntity>;

	// ── Mutable state maps ───────────────────────────────
	/** Conversation count per agent in the current day cycle. */
	readonly cycleConversationCounts: Map<string, number>;
	/** Which reactive triggers have fired per agent this cycle. */
	readonly firedReactiveTriggers: Map<string, Set<string>>;
	/** Snapshot of previous walking state per agent (for trail particles). */
	readonly prevWalkingState: Map<string, boolean>;
	/** Last trail particle position per agent. */
	readonly lastTrailPos: Map<string, { x: number; y: number }>;
	/** Cooldown tracking for pet proximity reactions. */
	readonly petReactionCooldowns: Map<string, number>;
	/** Known entity IDs to distinguish initial adds from updates. */
	readonly knownEntities: Set<string>;
	/** Dedup guard for SSE/EventBus action relay. */
	readonly recentActionIds: Set<string>;

	// ── Mutable scalars ──────────────────────────────────
	/** Previous day-cycle count, for detecting cycle boundary. */
	prevCycleCount: number;
	/** Milliseconds since last frame (updated each preframe). */
	deltaMs: number;
	/** Last performance.now() value for delta calculation. */
	lastTime: number;

	// ── Lighting ─────────────────────────────────────────
	readonly currentLight: LightState;

	// ── Actor lookup functions ───────────────────────────
	readonly findAgentActor: (name: string) => AgentActor | undefined;
	readonly findCurrentSceneActor: (name: string) => AgentActor | undefined;
	readonly findNearestAgent: (agentName: string) => { x: number; y: number } | null;

	// ── Callbacks ────────────────────────────────────────
	readonly handleAgentSelect: (agentName: string) => void;
	readonly handleSceneChange: (setting: string) => void;
}
