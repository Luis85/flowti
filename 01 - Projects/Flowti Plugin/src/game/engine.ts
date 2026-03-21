/**
 * engine.ts — ExcaliburJS Agent World engine factory.
 *
 * Exports `createAgentWorld()` which builds the full game engine with
 * four scenes (hub, office, village, station), wires sync/brain/bubble/
 * talk/particle/emote/social systems, mounts Lit overlay components,
 * and returns a lifecycle handle (start / pause / resume / dispose).
 *
 * This is the embedded-mode entry point — no bridge detection, no window
 * globals. The caller provides a container element, a DataProvider, and
 * a sprite base path.
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
import { DayClock } from "./systems/day-clock.js";
import { WorldAmbience } from "./systems/world-ambience.js";
import { MemorySystem } from "./systems/memory-system.js";
import { QuirkSystem } from "./systems/quirk-system.js";
import { RelationshipSystem } from "./systems/relationship-system.js";
import { WorldEventScheduler } from "./systems/world-event-scheduler.js";
import { BtSystem } from "./systems/bt-system.js";
import { createPetBT } from "./brain/behavior-tree/pet-bt.js";
import { createEnvironmentalObjects, registerEnvironmentalObjects, createPets, getPetBTPairs } from "./engine-objects.js";
import { DEFAULT_WORLD_CONFIG } from "./data/world-config.js";
import { SceneRegistry } from "./systems/scene-registry.js";
import { RoomSwitcher } from "./systems/room-switcher.js";
import type { SceneEntity } from "./data/scene-entity.js";
import { flushWorldState, startPeriodicFlush, type StateSystems } from "./engine-state.js";
import { wireEvents } from "./engine-events.js";
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
import { tickSimulation } from "./engine-simulation.js";
import { registerAgents, type RegistrationSystems } from "./engine-startup.js";

// Side-effect imports — register Lit custom elements
import "./ui/dashboard-overlays.js";
import "./ui/ask-bob.js";
import "./ui/roster-bar.js";
import "./ui/camera-hud.js";
import "./ui/agent-panel.js";

// ── Public interface ─────────────────────────────────────────────────

export interface AgentWorldDeps {
	container: HTMLElement;
	provider: DataProvider;
	spriteBasePath: string;
	cliExecutor?: ICliExecutor;
	worldContext?: WorldContext;
	vaultBasePath?: string;
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
	for (const tag of ["ft-game-overlays", "ft-game-roster-bar", "ft-game-camera-hud", "ft-game-agent-panel", "ft-game-ask-bob"]) {
		const el = document.createElement(tag) as HTMLElement & { store: DashboardStore };
		el.store = store;
		container.appendChild(el);
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

	const talkEngine = new TalkEngine({
		showBubble: (agentName, kind, text) => {
			const isSelected = store.selectedAgent === agentName;
			if (isSelected) {
				// Selected agent: chatter goes to chat panel only, no overhead bubble
				store.pushAgentThought(agentName, text);
			} else {
				// Unselected agent: show bubble over head as usual
				bubbleSystem.showBubble(agentName, kind, text, engine.currentScene, findAgentActor, 5000);
			}
			// Also pipe to chat if LLM is thinking (even if not selected)
			if (!isSelected) {
				const llmStatus = store.llmStatus.get(agentName);
				if (llmStatus?.state === "thinking") {
					store.pushAgentThought(agentName, text);
				}
			}
		},
		isIdle: (name) => brainSystem.getState(name)?.state === "idle",
		isOnScene: (name) => findCurrentSceneActor(name) !== undefined,
	});

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
	const registry = new SceneRegistry();
	const btSystem = new BtSystem();
	const { btWorldState, btClock, btDeps } = createBtBridges(brainSystem, needsSystem);
	const cycleConversationCounts = new Map<string, number>();
	const firedReactiveTriggers = new Map<string, Set<string>>();
	const prevCycleCount = 0;

	// ── Environmental objects ────────────────────────────
	const envObjects = createEnvironmentalObjects();
	registerEnvironmentalObjects(envObjects, registry);
	const { coffeeMachine, whiteboard, snackTable, waterCooler, couch, plant, noticeBoard } = envObjects;

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
	const sceneConfig = {
		onSceneChange: (target: string) => {
			store.selectAgent(null);
			void engine.goToScene(target, {
				destinationIn: new ex.FadeInOut({ duration: SCENE_TRANSITION_DURATION, direction: "in" }),
				sourceOut: new ex.FadeInOut({ duration: SCENE_TRANSITION_DURATION, direction: "out" }),
			}).then(() => {
				cameraRef.current?.onSceneActivate(findAgentActor, engine.currentScene.camera);
			});
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

	// ── Registration systems context ─────────────────────
	const registrationSystems: RegistrationSystems = {
		brain: brainSystem, bubble: bubbleSystem, talk: talkEngine,
		emote: emoteSystem, social: socialSystem, needs: needsSystem,
		sensor: sensorSystem, engagement: engagementSystem, ritual: ritualSystem,
		memory: memorySystem, quirk: quirkSystem, relationship: relationshipSystem,
		bt: btSystem, btDeps, knownEntities,
	};

	function doRegisterAgents(agents: readonly DashboardAgent[]): void {
		registerAgents(agents, hubScene, store, registrationSystems);
	}

	// ── Dedup guard for provider action relay ────────────
	const recentActionIds = new Set<string>();

	// ── Pre-update loop state ───────────────────────────
	const lastTime = performance.now();
	const prevWalkingState = new Map<string, boolean>();
	const lastTrailPos = new Map<string, { x: number; y: number }>(); const petReactionCooldowns = new Map<string, number>();

	// ── Particle renderers + environmental objects + lighting ────────
	for (const scene of [hubScene, officeScene, villageScene, stationScene]) {
		scene.add(createParticleRenderer(particlePool, ENGINE_WIDTH, ENGINE_HEIGHT));
	}
	officeScene.add(coffeeMachine); officeScene.add(whiteboard); villageScene.add(snackTable); villageScene.add(waterCooler);
	stationScene.add(couch); hubScene.add(plant); hubScene.add(noticeBoard);

	// ── SceneEntity registry + unified room switcher ──
	const allEntities = new Map<string, SceneEntity>();

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
			bubbleSystem.showBubble(entityId, "thought", `Visiting ${label}...`, engine.currentScene, findAgentActor, 3000);
			store.pushWorldEvent("room-switch", `${entityId} moved to ${label}`);

			// If following this entity, switch scene to follow them
			if (store.followedAgent === entityId) {
				void engine.goToScene(to, {
					destinationIn: new ex.FadeInOut({ duration: SCENE_TRANSITION_DURATION, direction: "in" }),
					sourceOut: new ex.FadeInOut({ duration: SCENE_TRANSITION_DURATION, direction: "out" }),
				}).then(() => {
					cameraRef.current?.onSceneActivate(findAgentActor, engine.currentScene.camera);
				});
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
	};

	// ── Position writer (tick-based, flushes every ~5s) ──
	let cancelPeriodicFlush: (() => void) | null = null;
	if (deps.vaultBasePath) {
		cancelPeriodicFlush = startPeriodicFlush(stateSystems, deps.vaultBasePath, engine);
	}

	// ── Build shared context ────────────────────────────
	const ctx: EngineContext = {
		engine,
		provider,
		store,
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
		bt: btSystem,
		registry,
		roomSwitcher,
		cameraSystem: cameraRef.current,
		btWorldState,
		btClock,
		btDeps,
		hubScene,
		officeScene,
		villageScene,
		stationScene,
		roomScenes,
		coffeeMachine,
		whiteboard,
		snackTable,
		waterCooler,
		couch,
		plant,
		noticeBoard,
		pets,
		allEntities,
		cycleConversationCounts,
		firedReactiveTriggers,
		prevWalkingState,
		lastTrailPos,
		petReactionCooldowns,
		knownEntities,
		recentActionIds,
		prevCycleCount,
		deltaMs: 0,
		lastTime,
		currentLight,
		findAgentActor,
		findCurrentSceneActor,
		findNearestAgent,
		handleAgentSelect,
		handleSceneChange: sceneConfig.onSceneChange,
	};
	const cleanupEvents = wireEvents(ctx);

	// ── Pre-frame hook: tick all systems ─────────────────
	engine.on("preframe", () => {
		const now = performance.now();
		ctx.deltaMs = now - ctx.lastTime;
		ctx.lastTime = now;
		tickSimulation(ctx);

	});

	// ── Post-frame adapter: push positions/targets/states to store ──
	engine.on("postframe", createPostframeHandler({
		engine, store, brainSystem, findCurrentSceneActor,
	}));

	// ── Keyboard handling ───────────────────────────────
	const { keydownHandler, keyupHandler } = setupKeyboardHandlers({
		cameraSystem: cameraRef.current,
		getCameraSystem: () => cameraRef.current,
	});
	document.addEventListener("keydown", keydownHandler);
	document.addEventListener("keyup", keyupHandler);

	// ── Lifecycle handle ────────────────────────────────

	return {
		async start(): Promise<void> {
			await startEngine({
				engine, spriteBasePath, provider, vaultBasePath: deps.vaultBasePath,
				hubScene, officeScene, villageScene, stationScene, roomScenes,
				ctx, stateSystems, dayClock, worldAmbience, currentLight,
				brainSystem, directorSystem, cursorSpirits, store,
				registrationSystems, handleAgentSelect, allEntities, pets, registry,
				loadingOverlay, doRegisterAgents,
			});
		},

		pause(): void {
			engine.stop();
		},

		resume(): void {
			void engine.start();
		},

		dispose(): void {
			// Cancel periodic position flush
			if (cancelPeriodicFlush) cancelPeriodicFlush();
			// Tear down all event subscriptions
			cleanupEvents();
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
