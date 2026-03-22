/**
 * engine.ts — ExcaliburJS Agent World engine factory.
 *
 * **Scope:** everything **on the canvas** (scenes, actors, particles, local
 * simulation loops) is Excalibur + `src/game/`. **Authoritative agent/world data**
 * comes from the Flowti CLI via vault JSON and {@link ICliExecutor} — see
 * `createCliDataProvider` and `docs/agent-world-architecture.md`.
 *
 * Exports `createAgentWorld()` which builds the full game engine with
 * four scenes (hub, office, village, station), wires sync/brain/bubble/
 * talk/particle/emote/social systems, mounts Lit overlay components,
 * and returns a lifecycle handle (start / pause / resume / dispose).
 *
 * Embedded entry point: the caller provides a container, a {@link DataProvider},
 * and a sprite base path (plugin manifest dir).
 */

import * as ex from "excalibur";
import { GameScene } from "./scenes/game-scene.js";
import { SCENE_CONFIGS } from "./data/scene-configs.js";
import { BrainSystem } from "./systems/brain-system.js";
import { BubbleSystem } from "./systems/bubble-system.js";
import { TalkEngine } from "./systems/talk/talk-engine.js";
import type { DashboardAgent } from "./data/types.js";
import type { AgentActor } from "./actors/agent-actor.js";
import { preferredWorkstation } from "./brain/movement.js";
import { computeParams } from "./brain/agent-brain.js";
import { createCameraSystem } from "./systems/camera-system.js";
import { DashboardStore } from "./store/dashboard-store.js";
import { ParticlePool } from "./systems/particle-system.js";
import { EmoteSystem } from "./systems/emote-system.js";
import { SocialSystem } from "./systems/social-system.js";
import { NeedsSystem } from "./systems/needs-system.js";
import { DirectorSystem } from "./systems/director-system.js";
import { SensorSystem } from "./systems/sensor-system.js";
import { EngagementSystem } from "./systems/engagement-system.js";
import { RitualSystem } from "./systems/ritual-system.js";
import { ToolExecutor } from "./systems/tool-executor-system.js";
import { DEFAULT_TOOLS } from "./data/tool-registry.js";
import { CursorSpirit } from "./actors/cursor-spirit.js";
import type { DataProvider } from "./config/data-provider.js";
import type { WorldContext } from "../domain/agents/world-context.js";
import type { ICliExecutor } from "../infrastructure/agents/cli-executor.js";
import type { IEventBus } from "../infrastructure/events/types.js";
import type { IAgentWorldPerfDashboard } from "../infrastructure/services/perfTypes.js";
import { createAgentWorldPerfCollector, type AgentWorldPerfCollectorOptions } from "./performance/agent-world-perf.js";
import { DayClock } from "./systems/day-clock.js";
import { WorldAmbience } from "./systems/world-ambience.js";
import { MemorySystem } from "./systems/memory-system.js";
import { QuirkSystem } from "./systems/quirk-system.js";
import { RelationshipSystem } from "./systems/relationship-system.js";
import { EchoStore, EchoProducer, CascadeResolver } from "./systems/echo/index.js";
import { ConversationEngine } from "./systems/talk/conversation-engine.js";
import { FragmentComposer } from "./systems/talk/fragment-composer.js";
import {
	RIVAL_SCRIPTS, ACQUAINTANCE_SCRIPTS, COLLEAGUE_SCRIPTS, FRIEND_SCRIPTS, BESTFRIEND_SCRIPTS,
	GOSSIP_SCRIPTS, DRAMA_SCRIPTS, PET_CATALYST_SCRIPTS,
	RUNNING_JOKES,
	ALL_FRAGMENT_POOLS,
} from "./systems/talk/templates/index.js";
import { MERCHANT_SCRIPTS } from "./systems/talk/templates/conversation-scripts-merchant.js";
import { OFFLINE_RETURN_SCRIPTS } from "./systems/talk/templates/conversation-scripts-offline.js";
import { WorldEventScheduler } from "./systems/world-event-scheduler.js";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { NarrativeSystem } from "./systems/narrative-system.js";
import { bootstrapInteractionSystem, registerPetResolver, createNPCIntentResolver, createRoomIntentResolver } from "./systems/interaction/bootstrap-interactions.js";
import type { Interaction } from "../../../Flowti CLI/src/domain/interactions/interaction-types.js";
import { BtSystem } from "./systems/bt-system.js";
import { createPetBT } from "./brain/behavior-tree/pet-bt.js";
import { createEnvironmentalObjects, registerEnvironmentalObjects, createPets, getPetBTPairs } from "./engine-objects.js";
import { DEFAULT_WORLD_CONFIG } from "./data/world-config.js";
import { SceneRegistry } from "./systems/scene-registry.js";
import { RoomSwitcher } from "./systems/room-switcher.js";
import type { SceneEntity } from "./data/scene-entity.js";
import { flushWorldState, startPeriodicFlush, type StateSystems } from "./engine-state.js";
import { wireEvents } from "./engine-events.js";
import { wireDebugEvents } from "./engine-events-debug.js";
import type { EngineContext } from "./engine-types.js";
import {
	ENGINE_WIDTH, ENGINE_HEIGHT,
	BRAIN_BOUNDS, PARTICLE_POOL_SIZE,
	SCENE_TRANSITION_DURATION,
} from "./engine-config.js";
import {
	createParticleRenderer, createLightingOverlay, createLoadingOverlay,
	setupKeyboardHandlers,
	type LightState,
} from "./engine-rendering.js";
import { createBtBridges, createFindNearestAgent } from "./engine-systems-init.js";
import { createPostframeHandler } from "./engine-postframe.js";
import { startEngine, createAgentSelectHandler } from "./engine-lifecycle.js";
import { tickSimulation, pushCascadeReaction } from "./engine-simulation.js";
import { registerAgents, type RegistrationSystems } from "./engine-startup.js";

// Side-effect imports — register Lit custom elements
import "./ui/dashboard-overlays.js";
import "./ui/ask-bob.js";
import "./ui/roster-bar.js";
import "./ui/camera-hud.js";
import "./ui/agent-panel.js";
import "./ui/merchant-panel.js";

// ── Public interface ─────────────────────────────────────────────────

export interface AgentWorldDeps {
	container: HTMLElement;
	provider: DataProvider;
	spriteBasePath: string;
	cliExecutor?: ICliExecutor;
	worldContext?: WorldContext;
	vaultBasePath?: string;
	/** When set, emits `perf.agentWorld.sample` / `perf.agentWorld.slowFrame` for analysis. */
	eventBus?: IEventBus;
	/** Optional tuning for agent-world perf sampling (ignored without `eventBus`). */
	agentWorldPerf?: AgentWorldPerfCollectorOptions;
	/** Static reference for Ask Bob (tests); production often uses {@link getPerfDashboard} instead. */
	perfDashboard?: IAgentWorldPerfDashboard;
	/** Lazy resolver — e.g. plugin `getPerfDashboard()` after `onLayoutReady`. */
	getPerfDashboard?: () => IAgentWorldPerfDashboard | undefined;
}

export interface AgentWorldHandle {
	start(): Promise<void>;
	pause(): void;
	resume(): void;
	dispose(): void;
}

// ── Factory ──────────────────────────────────────────────────────────
export function createAgentWorld(deps: AgentWorldDeps): AgentWorldHandle {
	const { container, provider, spriteBasePath } = deps;

	// Pre-create canvas + loading overlay
	const gameCanvas = document.createElement("canvas");
	container.appendChild(gameCanvas);
	const loadingOverlay = createLoadingOverlay();
	container.appendChild(loadingOverlay);

	const engine = new ex.Engine({
		canvasElement: gameCanvas,
		width: ENGINE_WIDTH,
		height: ENGINE_HEIGHT,
		backgroundColor: ex.Color.fromHex("#0a0a0f"),
		displayMode: ex.DisplayMode.FitContainer,
		pixelArt: true,
		suppressPlayButton: true,
	});

	// ── Reactive store + Lit overlays ─────────────────────
	const store = new DashboardStore(deps.cliExecutor, deps.worldContext, deps.vaultBasePath);
	store.syncCliSessionFromEnvironment();
	for (const tag of ["ft-game-overlays", "ft-game-roster-bar", "ft-game-camera-hud", "ft-game-agent-panel", "ft-game-ask-bob"]) {
		const el = document.createElement(tag) as HTMLElement & { store: DashboardStore };
		el.store = store;
		if (tag === "ft-game-agent-panel" && deps.eventBus) {
			(el as HTMLElement & { eventBus?: IEventBus }).eventBus = deps.eventBus;
		}
		if (tag === "ft-game-ask-bob") {
			const bob = el as HTMLElement & {
				store: DashboardStore;
				eventBus?: IEventBus;
				perfDashboard?: IAgentWorldPerfDashboard;
				getPerfDashboard?: () => IAgentWorldPerfDashboard | undefined;
			};
			if (deps.eventBus) bob.eventBus = deps.eventBus;
			if (deps.perfDashboard) bob.perfDashboard = deps.perfDashboard;
			if (deps.getPerfDashboard) bob.getPerfDashboard = deps.getPerfDashboard;
		}
		container.appendChild(el);
	}

	let cancelAgentResourcePoll: (() => void) | null = null;
	if (deps.cliExecutor) {
		/** Less aggressive than 2s to reduce alignment with perf windows and main-thread stalls from CLI sampling. */
		const pollMs = 4000;
		const id = window.setInterval(() => {
			const run = () => {
				try {
					void store.refreshAgentResources();
				} catch {
					/* ignore sampling errors */
				}
			};
			// Defer off the interval tick. Avoid requestIdleCallback: sampling uses sync OS calls (e.g. PowerShell)
			// and violates the idle deadline (~50ms), spamming DevTools with long-handler warnings.
			window.setTimeout(run, 0);
		}, pollMs);
		cancelAgentResourcePoll = () => {
			window.clearInterval(id);
			cancelAgentResourcePoll = null;
		};
	}

	// ── Systems ─────────────────────────────────────────
	const cameraRef: { current: ReturnType<typeof createCameraSystem> | null } = { current: null };
	const brainSystem = new BrainSystem({
		bounds: BRAIN_BOUNDS,
		onWorkstationChange: (agentName, action, position) => {
			for (const room of Object.values(roomScenes)) {
				const actor = room.getAgentActor(agentName);
				if (!actor) continue;

				if (action === "occupy") {
					const workstations = room.getWorkstations();
					let nearest = workstations[0];
					let minDist = Infinity;
					for (const ws of workstations) {
						const dx = ws.pos.x - position.x;
						const dy = ws.pos.y - position.y;
						const dist = dx * dx + dy * dy;
						if (dist < minDist && !ws.occupied) {
							minDist = dist;
							nearest = ws;
						}
					}
					if (nearest && !nearest.occupied) {
						nearest.occupy(agentName);
					}
				} else {
					const workstations = room.getWorkstations();
					const ws = workstations.find((w) => w.occupantName === agentName);
					if (ws) ws.vacate();
				}
				break;
			}
		},
		onWorkstationResolve: (agentName, preferredId) => {
			for (const room of Object.values(roomScenes)) {
				const actor = room.getAgentActor(agentName);
				if (!actor) continue;
				const workstations = room.getWorkstations().map((ws) => ({
					id: ws.workstationId, x: ws.pos.x, y: ws.pos.y, occupied: ws.occupied,
				}));
				return preferredWorkstation({ x: actor.pos.x, y: actor.pos.y }, workstations, preferredId);
			}
			return null;
		},
	});

	const bubbleSystem = new BubbleSystem();
	const particlePool = new ParticlePool(PARTICLE_POOL_SIZE);
	const emoteSystem = new EmoteSystem();
	const socialSystem = new SocialSystem();
	const needsSystem = new NeedsSystem();
	const directorSystem = new DirectorSystem();
	const sensorSystem = new SensorSystem();
	const engagementSystem = new EngagementSystem();
	const ritualSystem = new RitualSystem();
	const toolExecutor = new ToolExecutor();
	toolExecutor.registerTools(DEFAULT_TOOLS);
	const dayClock = new DayClock(DEFAULT_WORLD_CONFIG.dayCycle.durationMs);
	const worldAmbience = new WorldAmbience(DEFAULT_WORLD_CONFIG.weather.cycleLengthInDayCycles);
	const memorySystem = new MemorySystem();
	const quirkSystem = new QuirkSystem();
	const worldEventScheduler = new WorldEventScheduler();
	const relationshipSystem = new RelationshipSystem(DEFAULT_WORLD_CONFIG.relationships.bickerChance);

	// ── Echo system ──────────────────────────────────
	const echoStore = new EchoStore();
	const cascadeResolver = new CascadeResolver(echoStore);
	const echoProducer = new EchoProducer(echoStore, (agent, result) => {
		if (!cascadeResolver.shouldCascade(agent, result.echo)) return;
		if (!echoStore.consumeCascade()) return;
		const reaction = cascadeResolver.selectReaction(agent, result.echo);
		if (!reaction) return;
		cascadeResolver.recordAgentCascade(agent);
		pushCascadeReaction(reaction);
	});

	// ── Narrative system ──────────────────────────────
	const narrativeDir = deps.vaultBasePath
		? join(deps.vaultBasePath, "03 - Resources", "Narrative")
		: "";
	const narrativeSystem = new NarrativeSystem({
		writeFile: (path, content) => {
			try {
				const dir = dirname(path);
				if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
				writeFileSync(path, content, "utf-8");
			} catch {
				// Non-critical — skip silently
			}
		},
		narrativeDir,
		currentDate: () => new Date().toISOString().slice(0, 10),
	});

	// Register narrative flush at end of each day cycle
	if (deps.vaultBasePath) {
		dayClock.onCycleEnd(() => {
			narrativeSystem.flushToVault(dayClock.getCycleCount() + 1);
		});
	}

	const registry = new SceneRegistry();
	registry.setEntityRoom("npc-merchant", "hub");

	const btSystem = new BtSystem();
	const { btWorldState, btClock, btDeps } = createBtBridges(brainSystem, needsSystem);
	const cycleConversationCounts = new Map<string, number>();
	const firedReactiveTriggers = new Map<string, Set<string>>();
	const prevCycleCount = 0;

	// ── Environmental objects ────────────────────────────
	const envObjects = createEnvironmentalObjects();
	registerEnvironmentalObjects(envObjects, registry);
	const { coffeeMachine, whiteboard, snackTable, waterCooler, couch, plant, noticeBoard, merchantStall, foodBowlHub, foodBowlVillage, waterBowlOffice, waterBowlStation } = envObjects;

	// ── Office pets ──────────────────────────────────────
	const pets = createPets();
	for (const [pet, def] of getPetBTPairs(pets)) {
		btSystem.registerPet(pet.entityId, createPetBT(pet.entityId, def.behaviors.sleepChance, def.behaviors.wanderRadius, def.speed, pet.petType));
	}

	// ── Agent select handler ────────────────────────────
	const handleAgentSelect = createAgentSelectHandler({
		store, brainSystem, bubbleSystem, directorSystem, engagementSystem, engine,
		findAgentActor, getCameraSystem: () => cameraRef.current,
	});

	// ── Scene config ────────────────────────────────────
	const reattachCameraAfterSceneChange = (): void => {
		const cam = cameraRef.current;
		const sceneCam = engine.currentScene.camera;
		if (!cam) return;
		// Must resolve the actor in the *active* scene — hub-first findAgentActor can attach the wrong
		// instance or miss the entity for one frame after a room transfer.
		cam.onSceneActivate(findCurrentSceneActor, sceneCam);
		const followed = store.followedAgent;
		if (!followed) return;
		requestAnimationFrame(() => {
			if (store.followedAgent !== followed) return;
			if (cam.isFollowing()) return;
			const actor = findCurrentSceneActor(followed);
			if (actor) cam.startFollow(actor);
		});
	};

	const sceneConfig = {
		onSceneChange: (target: string) => {
			// User picked a room (door / roster) — stop following so an agent's autonomous room change
			// cannot pull the camera to another scene afterward.
			store.selectAgent(null);
			store.stopFollow();
			cameraRef.current?.stopFollow();
			void engine.goToScene(target, {
				destinationIn: new ex.FadeInOut({ duration: SCENE_TRANSITION_DURATION, direction: "in" }),
				sourceOut: new ex.FadeInOut({ duration: SCENE_TRANSITION_DURATION, direction: "out" }),
			}).then(reattachCameraAfterSceneChange);
		},
		onAgentSelect: handleAgentSelect,
	};

	// ── Create scenes ───────────────────────────────────
	const hubScene = new GameScene(SCENE_CONFIGS.hub, sceneConfig);
	const officeScene = new GameScene(SCENE_CONFIGS.office, sceneConfig);
	const villageScene = new GameScene(SCENE_CONFIGS.village, sceneConfig);
	const stationScene = new GameScene(SCENE_CONFIGS.station, sceneConfig);

	const roomScenes: Record<string, GameScene> = { office: officeScene, village: villageScene, station: stationScene };
	const sceneEntries: [string, GameScene][] = [["hub", hubScene], ["office", officeScene], ["village", villageScene], ["station", stationScene]];
	for (const [name, scene] of sceneEntries) { registry.registerScene(name, scene); engine.addScene(name, scene); }
	for (const room of Object.values(roomScenes)) room.setBrainSystem(brainSystem);

	// ── Actor lookups ───────────────────────────────────

	/** Perf / Ask Bob monitor — `Scene.name` is not the `addScene` key in Excalibur; use instance identity. */
	function getCurrentSceneIdForPerf(): string {
		const cur = engine.currentScene;
		if (cur === hubScene) return "hub";
		if (cur === officeScene) return "office";
		if (cur === villageScene) return "village";
		if (cur === stationScene) return "station";
		const n = (cur as unknown as { name?: string })?.name;
		return typeof n === "string" && n.length > 0 ? n : "unknown";
	}

	function findAgentActor(name: string): AgentActor | undefined {
		const hubActor = hubScene.getAgentActor(name);
		if (hubActor) return hubActor;
		for (const room of Object.values(roomScenes)) {
			const roomActor = room.getAgentActor(name);
			if (roomActor) return roomActor;
		}
		return undefined;
	}

	function findCurrentSceneActor(name: string): AgentActor | undefined {
		const current = engine.currentScene;
		if (current === hubScene) return hubScene.getAgentActor(name);
		for (const [, room] of Object.entries(roomScenes)) {
			if (current === room) return room.getAgentActor(name);
		}
		return undefined;
	}

	const findNearestAgent = createFindNearestAgent(brainSystem, registry);
	const knownEntities = new Set<string>();

	// ── Dedup guard for provider action relay ────────────
	const recentActionIds = new Set<string>();

	// ── Pre-update loop state ───────────────────────────
	const lastTime = performance.now();
	const prevWalkingState = new Map<string, boolean>();
	const lastTrailPos = new Map<string, { x: number; y: number }>();

	// ── Particle renderers + environmental objects + lighting ────────
	for (const scene of [hubScene, officeScene, villageScene, stationScene]) {
		scene.add(createParticleRenderer(particlePool, ENGINE_WIDTH, ENGINE_HEIGHT));
	}
	officeScene.add(coffeeMachine); officeScene.add(whiteboard); villageScene.add(snackTable); villageScene.add(waterCooler);
	stationScene.add(couch); hubScene.add(plant); hubScene.add(noticeBoard); hubScene.add(merchantStall);
	hubScene.add(foodBowlHub); villageScene.add(foodBowlVillage); officeScene.add(waterBowlOffice); stationScene.add(waterBowlStation);

	// ── SceneEntity registry + unified room switcher ──
	const allEntities = new Map<string, SceneEntity>();

	/** Resolve roster {@link AgentActor} or pet scene proxy for bubble attachment. */
	function findBubbleAnchor(name: string): ex.Actor | undefined {
		const agent = findAgentActor(name);
		if (agent) return agent;
		return allEntities.get(name)?.getActor() ?? undefined;
	}

	const petBubbleParams = computeParams({
		str: 10, dex: 10, con: 10, int: 10, wis: 12, cha: 10,
	});

	const fragmentComposer = new FragmentComposer(ALL_FRAGMENT_POOLS);

	function isEntityIdleForTalk(name: string): boolean {
		const pet = pets.find((p) => p.entityId === name);
		if (pet) {
			const s = pet.getState();
			return s === "idle" || s === "wandering" || s === "following";
		}
		return brainSystem.getState(name)?.state === "idle";
	}

	function isEntityOnCurrentScene(name: string): boolean {
		if (findCurrentSceneActor(name)) return true;
		const pet = pets.find((p) => p.entityId === name);
		if (!pet) return false;
		const room = registry.getEntityRoom(name);
		if (!room) return false;
		const cur = engine.currentScene;
		if (room === "hub") return cur === hubScene;
		const rs = roomScenes[room];
		return rs !== undefined && cur === rs;
	}

	const talkEngine = new TalkEngine({
		showBubble: (agentName, kind, text) => {
			const isSelected = store.selectedAgent === agentName;
			if (isSelected) {
				store.pushAgentThought(agentName, text);
			} else {
				bubbleSystem.showBubble(agentName, kind, text, engine.currentScene, findBubbleAnchor, 5000);
			}
			if (!isSelected) {
				const llmStatus = store.llmStatus.get(agentName);
				if (llmStatus?.state === "thinking") {
					store.pushAgentThought(agentName, text);
				}
			}
		},
		isIdle: isEntityIdleForTalk,
		isOnScene: isEntityOnCurrentScene,
	}, {
		composer: fragmentComposer,
		getTier: (a, b) => relationshipSystem.getTier(a, b),
		getEchoBias: (agent) => echoStore.getDialogueBias(agent),
	});

	bubbleSystem.setSceneFilter(isEntityOnCurrentScene);

	for (const pet of pets) {
		if (pet.petType === "fish") continue; // fish don't think or talk
		bubbleSystem.register(pet.entityId, [], petBubbleParams);
		talkEngine.register(pet.entityId, "pet", [], 10);
	}

	const interactionLockBridge: { query?: (entityId: string) => boolean } = {};

	const conversationEngine = new ConversationEngine({
		showBubble: (agentName, kind, text) => {
			bubbleSystem.showBubble(agentName, kind, text, engine.currentScene, findBubbleAnchor, 5000);
		},
		getTier: (a, b) => relationshipSystem.getTier(a, b),
		silenceTalk: (agentName) => talkEngine.silence(agentName),
		recordConversation: (a, b) => {
			relationshipSystem.recordConversation(a, b);
			const tier = relationshipSystem.getTier(a, b);
			echoProducer.onConversation(a, b, tier, dayClock.getCycleCount());
		},
		getJokePlayCount: (a, b, jokeId) => relationshipSystem.getJokePlayCount(a, b, jokeId),
		incrementJokePlayCount: (a, b, jokeId) => relationshipSystem.incrementJokePlayCount(a, b, jokeId),
		externalLockQuery: (entityId) => interactionLockBridge.query?.(entityId) ?? false,
	});
	conversationEngine.registerScripts([
		...RIVAL_SCRIPTS, ...ACQUAINTANCE_SCRIPTS, ...COLLEAGUE_SCRIPTS,
		...FRIEND_SCRIPTS, ...BESTFRIEND_SCRIPTS,
		...GOSSIP_SCRIPTS, ...DRAMA_SCRIPTS, ...PET_CATALYST_SCRIPTS,
		...MERCHANT_SCRIPTS, ...OFFLINE_RETURN_SCRIPTS,
	]);
	conversationEngine.registerJokes([...RUNNING_JOKES]);

	const interactionBootstrap = bootstrapInteractionSystem({
		social: {
			getNearbyEntities: (entityId: string) => [...socialSystem.getNearbyEntities(entityId)],
		},
		relationship: relationshipSystem,
		needs: needsSystem,
		dayClock,
		conversation: conversationEngine,
		talk: talkEngine,
		bubble: bubbleSystem,
	});
	interactionLockBridge.query = (entityId) => interactionBootstrap.system.isEntityLocked(entityId);

	// Wire world events to interaction bus — after bootstrap so the bus exists
	worldEventScheduler.setInteractionSubmitter((raw) => {
		const hubAgents = registry.getEntitiesInRoom("hub")
			.filter(id => !id.startsWith("npc-") && !id.startsWith("room-"))
			.map(id => ({ id, entityType: "agent" as const }));
		if (hubAgents.length === 0) return;
		const interaction: Interaction = {
			id: raw.id as string,
			initiator: raw.initiator as Interaction["initiator"],
			targets: hubAgents,
			cardinality: "one-to-many",
			category: "reactive",
			action: raw.action as string,
			priority: 70,
			context: { templateId: raw.action as string },
			cooldownMs: 300000,
			effects: [],
			timestamp: Date.now(),
		};
		interactionBootstrap.system.getBus().submit(interaction);
	});

	// ── Pet interaction resolvers ──────────────────────────
	for (const pet of pets) {
		if (pet.petType === "fish") continue;
		registerPetResolver(interactionBootstrap, pet.entityId, {
			social: {
				getNearbyEntities: (entityId: string) => [...socialSystem.getNearbyEntities(entityId)],
			},
			relationship: relationshipSystem,
			needs: needsSystem,
			dayClock,
			conversation: conversationEngine,
		}, () => ({
			hunger: pet.getHunger(),
			thirst: pet.getThirst(),
			energy: 80,
			affinity: new Map(pet.getBondedAgent() ? [[pet.getBondedAgent()!, pet.getAffection()]] : []),
		}));
	}

	// ── NPC interaction resolver (merchant) ────────────
	const merchantResolver = createNPCIntentResolver({
		npcId: "npc-merchant",
		npcRole: "merchant",
		rules: [
			{
				npcRole: "merchant",
				trigger: "proximity" as const,
				conditions: [],
				interaction: {
					category: "commerce" as const,
					action: "merchant-pitch",
					cardinality: "one-to-one" as const,
					effects: [{ type: "bubble" as const, target: "initiator" as const, bubbleKind: "speech", phrasePool: "merchant-pitch" }],
					cooldownMs: 60000,
				},
				weight: 50,
				cooldownMs: 60000,
			},
			{
				npcRole: "merchant",
				trigger: "idle-timeout" as const,
				conditions: [],
				interaction: {
					category: "reactive" as const,
					action: "merchant-idle-grumble",
					cardinality: "entity-to-environment" as const,
					effects: [{ type: "bubble" as const, target: "initiator" as const, bubbleKind: "thought", phrasePool: "merchant-idle-grumble" }],
					cooldownMs: 45000,
				},
				weight: 30,
				cooldownMs: 45000,
			},
			{
				npcRole: "merchant", trigger: "proximity" as const, conditions: [],
				interaction: { category: "social" as const, action: "merchant-comment-on-pair", cardinality: "one-to-many" as const, effects: [], cooldownMs: 90000 },
				weight: 15, cooldownMs: 90000,
			},
			{
				npcRole: "merchant", trigger: "proximity" as const, conditions: [],
				interaction: { category: "commerce" as const, action: "merchant-special-offer", cardinality: "one-to-one" as const, effects: [], cooldownMs: 300000 },
				weight: 5, cooldownMs: 300000,
			},
			{
				npcRole: "merchant", trigger: "proximity" as const, conditions: [],
				interaction: { category: "commerce" as const, action: "merchant-haggle", cardinality: "one-to-one" as const, effects: [], cooldownMs: 120000 },
				weight: 20, cooldownMs: 120000,
			},
			{
				npcRole: "merchant", trigger: "proximity" as const, conditions: [],
				interaction: { category: "commerce" as const, action: "merchant-show-new-stock", cardinality: "one-to-one" as const, effects: [], cooldownMs: 180000 },
				weight: 15, cooldownMs: 180000,
			},
			{
				npcRole: "merchant", trigger: "event" as const, conditions: [],
				interaction: { category: "social" as const, action: "merchant-loyalty-thanks", cardinality: "one-to-one" as const, effects: [], cooldownMs: 600000 },
				weight: 5, cooldownMs: 600000,
			},
			{
				npcRole: "merchant", trigger: "event" as const, conditions: [],
				interaction: { category: "reactive" as const, action: "merchant-warn-of-danger", cardinality: "one-to-one" as const, effects: [], cooldownMs: 300000 },
				weight: 3, cooldownMs: 300000,
			},
		],
		getNearby: () => {
			// Merchant is not a SocialSystem entity — find agents in hub room instead
			const hubAgents = registry.getEntitiesInRoom("hub");
			return hubAgents
				.filter(id => !id.startsWith("npc-") && !id.startsWith("room-"))
				.map(id => ({ id, entityType: "agent", distance: 3 }));
		},
		getCooldown: () => interactionBootstrap.system.getBus().getCooldown("npc-merchant", "npc", "merchant-pitch"),
		now: () => Date.now(),
	});
	interactionBootstrap.resolvers.entities.set("npc-merchant", merchantResolver);

	// ── Room interaction resolvers ─────────────────────
	const ROOM_CONFIGS = [
		{ id: "room-hub", roomName: "hub", type: "break-room" },
		{ id: "room-office", roomName: "office", type: "office" },
		{ id: "room-village", roomName: "village", type: "village" },
		{ id: "room-station", roomName: "station", type: "station" },
	];
	for (const roomCfg of ROOM_CONFIGS) {
		const roomResolver = createRoomIntentResolver({
			roomId: roomCfg.id,
			roomType: roomCfg.type,
			rules: [
				{
					roomType: roomCfg.type, layer: "reactive" as const, cooldownMs: 300000,
					conditions: [{ type: "occupancy" as const, op: ">" as const, value: 4 }],
					interaction: { category: "reactive" as const, action: "crowded-room-tension", cardinality: "one-to-many" as const, effects: [], cooldownMs: 300000 },
				},
				{
					roomType: roomCfg.type, layer: "reactive" as const, cooldownMs: 240000,
					conditions: [{ type: "occupancy" as const, op: "<" as const, value: 2 }],
					interaction: { category: "environmental" as const, action: "empty-room-peace", cardinality: "one-to-many" as const, effects: [], cooldownMs: 240000 },
				},
				{
					roomType: roomCfg.type, layer: "reactive" as const, cooldownMs: 300000,
					conditions: [{ type: "collective-mood" as const, mood: "stressed", threshold: 40 }],
					interaction: { category: "environmental" as const, action: "crunch-time-pressure", cardinality: "one-to-many" as const, effects: [], cooldownMs: 300000 },
				},
			],
			getOccupancy: () => registry.getEntitiesInRoom(roomCfg.roomName).length,
			getOccupantIds: () => registry.getEntitiesInRoom(roomCfg.roomName),
			getCollectiveMood: () => {
				const occupants = registry.getEntitiesInRoom(roomCfg.roomName);
				if (occupants.length === 0) return { mood: "neutral", intensity: 50 };
				let totalMorale = 0;
				let count = 0;
				for (const id of occupants) {
					try {
						totalMorale += needsSystem.getNeeds(id).morale;
						count++;
					} catch {
						// pet/npc entities don't have needs — skip
					}
				}
				const avg = count > 0 ? totalMorale / count : 50;
				const mood = avg < 30 ? "stressed" : avg > 80 ? "energized" : avg > 60 ? "relaxed" : "neutral";
				return { mood, intensity: avg };
			},
			getPhase: () => dayClock.getPhase(),
		});
		interactionBootstrap.resolvers.entities.set(roomCfg.id, roomResolver);
	}

	const registrationSystems: RegistrationSystems = {
		brain: brainSystem, bubble: bubbleSystem, talk: talkEngine,
		emote: emoteSystem, social: socialSystem, needs: needsSystem,
		sensor: sensorSystem, engagement: engagementSystem, ritual: ritualSystem,
		memory: memorySystem, quirk: quirkSystem, relationship: relationshipSystem,
		bt: btSystem, btDeps, knownEntities, interactionBootstrap,
	};

	function doRegisterAgents(agents: readonly DashboardAgent[]): void {
		registerAgents(agents, hubScene, store, registrationSystems);
	}

	const roomSwitcher = new RoomSwitcher({
		registry,
		getEntity: (id) => allEntities.get(id),
		getEntityState: (id) => {
			const brainState = brainSystem.getState(id)?.state;
			if (brainState) return brainState;
			const pet = pets.find((p) => p.entityId === id);
			return pet?.getState() ?? "idle";
		},
		isTaskLocked: (id) => store.taskLockedAgents.has(id),
		onTransferComplete: (entityId, _from, to) => {
			const label = to.charAt(0).toUpperCase() + to.slice(1);
			bubbleSystem.showBubble(entityId, "thought", `Visiting ${label}...`, engine.currentScene, findBubbleAnchor, 3000);
			store.pushWorldEvent("room-switch", `${entityId} moved to ${label}`);

			// If following this entity, switch scene to follow them
			if (store.followedAgent === entityId) {
				void engine.goToScene(to, {
					destinationIn: new ex.FadeInOut({ duration: SCENE_TRANSITION_DURATION, direction: "in" }),
					sourceOut: new ex.FadeInOut({ duration: SCENE_TRANSITION_DURATION, direction: "out" }),
				}).then(reattachCameraAfterSceneChange);
			}
		},
	});

	// ── Cursor spirit — visual director presence (one per scene) ────
	const cursorSpirits = sceneEntries.map(([, scene]) => { const s = new CursorSpirit(); scene.add(s); return s; });

	// ── Lighting overlay — full-screen tint driven by DayClock phase (smooth fade) ──
	const currentLight: LightState = { r: 0, g: 0, b: 0, opacity: 0 };
	for (const scene of [hubScene, officeScene, villageScene, stationScene]) {
		scene.add(createLightingOverlay(currentLight, ENGINE_WIDTH, ENGINE_HEIGHT));
	}

	// ── State persistence context ────────────────────────
	const stateSystems: StateSystems = {
		dayClock,
		worldAmbience,
		memory: memorySystem,
		relationship: relationshipSystem,
		needs: needsSystem,
		brain: brainSystem,
		registry,
		pets,
		echo: echoStore,
	};

	// ── Position writer (tick-based, flushes every ~5s) ──
	let cancelPeriodicFlush: (() => void) | null = null;
	if (deps.vaultBasePath) {
		cancelPeriodicFlush = startPeriodicFlush(stateSystems, deps.vaultBasePath, engine);
	}

	const perfSampler = deps.eventBus
		? createAgentWorldPerfCollector(deps.eventBus, deps.agentWorldPerf)
		: null;

	// ── Build shared context ────────────────────────────
	const ctx: EngineContext = {
		engine,
		provider,
		store,
		systems: {
			brain: brainSystem,
			bubble: bubbleSystem,
			talk: talkEngine,
			particlePool,
			emote: emoteSystem,
			social: socialSystem,
			needs: needsSystem,
			director: directorSystem,
			sensor: sensorSystem,
			engagement: engagementSystem,
			ritual: ritualSystem,
			tool: toolExecutor,
			dayClock,
			worldAmbience,
			worldEvent: worldEventScheduler,
			memory: memorySystem,
			quirk: quirkSystem,
			relationship: relationshipSystem,
			conversation: conversationEngine,
			bt: btSystem,
			registry,
			roomSwitcher,
			narrative: narrativeSystem,
			cameraSystem: cameraRef.current,
			interactions: interactionBootstrap.system,
			echo: echoStore,
		},
		scenes: {
			hub: hubScene,
			office: officeScene,
			village: villageScene,
			station: stationScene,
			map: roomScenes,
		},
		envObjects: {
			coffeeMachine,
			whiteboard,
			snackTable,
			waterCooler,
			couch,
			plant,
			noticeBoard,
			merchantStall,
			foodBowlHub,
			foodBowlVillage,
			waterBowlOffice,
			waterBowlStation,
		},
		pets,
		interactionBootstrap,
		btBridge: {
			worldState: btWorldState,
			clock: btClock,
			deps: btDeps,
		},
		state: {
			allEntities,
			cycleConversationCounts,
			firedReactiveTriggers,
			prevWalkingState,
			lastTrailPos,
			knownEntities,
			recentActionIds,
			perfSampler,
			prevCycleCount,
			deltaMs: 0,
			lastTime,
			currentLight,
		},
		lookups: {
			findAgentActor,
			findBubbleAnchor,
			findCurrentSceneActor,
			findNearestAgent,
			handleAgentSelect,
			handleSceneChange: sceneConfig.onSceneChange,
		},
		echoProducer,
		cascadeResolver,
	};
	const cleanupEvents = wireEvents(ctx);
	const cleanupDebugEvents = wireDebugEvents(ctx, deps.vaultBasePath);

	// ── Pre-frame hook: tick all systems ─────────────────
	engine.on("preframe", () => {
		const now = performance.now();
		ctx.state.deltaMs = now - ctx.state.lastTime;
		ctx.state.lastTime = now;
		const simStart = performance.now();
		tickSimulation(ctx);
		const simMs = performance.now() - simStart;
		if (perfSampler) {
			const sceneName = getCurrentSceneIdForPerf();
			perfSampler.onFrameMeta({
				deltaMs: ctx.state.deltaMs,
				agentCount: brainSystem.getAllEntries().size,
				sceneName,
			});
			perfSampler.onSimulationEnd(simMs);
		}
	});

	// ── Post-frame adapter: push positions/targets/states to store ──
	const postframeHandler = createPostframeHandler({
		engine, store, brainSystem, needsSystem, findCurrentSceneActor,
		perfSampler,
	});
	engine.on("postframe", () => {
		if (!perfSampler) {
			postframeHandler();
			return;
		}
		const t0 = performance.now();
		postframeHandler();
		perfSampler.onPostframe(performance.now() - t0);
		perfSampler.afterFullFrame();
	});

	// ── Keyboard handling ───────────────────────────────
	const { keydownHandler, keyupHandler } = setupKeyboardHandlers({
		cameraSystem: cameraRef.current,
		getCameraSystem: () => cameraRef.current,
	});
	document.addEventListener("keydown", keydownHandler);
	document.addEventListener("keyup", keyupHandler);

	// ── Lifecycle handle ────────────────────────────────

	let rosterReconcileUnsub: (() => void) | null = null;

	return {
		async start(): Promise<void> {
			const t0 = performance.now();
			rosterReconcileUnsub = await startEngine({
				engine, spriteBasePath, provider, vaultBasePath: deps.vaultBasePath,
				hubScene, officeScene, villageScene, stationScene, roomScenes,
				ctx, stateSystems, dayClock, worldAmbience, currentLight,
				brainSystem, directorSystem, cursorSpirits, store,
				registrationSystems, handleAgentSelect, allEntities, pets, registry,
				loadingOverlay, doRegisterAgents,
				cameraRef, narrativeSystem,
			});
			if (deps.eventBus) {
				void deps.eventBus.emit("perf.agentWorld.engine.start", {
					durationMs: performance.now() - t0,
				});
			}
		},

		pause(): void {
			engine.stop();
		},

		resume(): void {
			void engine.start();
		},

		dispose(): void {
			perfSampler?.dispose();
			rosterReconcileUnsub?.();
			rosterReconcileUnsub = null;
			// Cancel periodic position flush
			if (cancelPeriodicFlush) cancelPeriodicFlush();
			if (cancelAgentResourcePoll) cancelAgentResourcePoll();
			// Tear down all event subscriptions
			cleanupEvents();
			cleanupDebugEvents();
			// Flush persistent state before shutdown
			if (deps.vaultBasePath) {
				flushWorldState(stateSystems, deps.vaultBasePath);
			}
			engine.stop();
			engine.dispose();
			provider.stop();
			document.removeEventListener("keydown", keydownHandler);
			document.removeEventListener("keyup", keyupHandler);
		},
	};
}
