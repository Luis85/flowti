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
import { DOMAIN_POOLS, resolveCharacter } from "./sprites/character-pool.js";
import { resolveSettingForDomain } from "./config/domain-map.js";
import { preloadSpriteRegistry } from "./sprites/sprite-loader.js";
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
import { BtSystem, createStubDeps } from "./systems/bt-system.js";
import { createPetBT } from "./brain/behavior-tree/pet-bt.js";
import { assignOpinions } from "./data/opinion-topics.js";
import { PetActor } from "./actors/pet-actor.js";
import { PET_DEFINITIONS } from "./data/pet-definitions.js";
import { CoffeeMachine } from "./actors/coffee-machine.js";
import { WhiteboardActor } from "./actors/whiteboard-actor.js";
import { SnackTable } from "./actors/snack-table.js";
import { WaterCooler } from "./actors/water-cooler.js";
import { CouchActor } from "./actors/couch-actor.js";
import { PlantActor } from "./actors/plant-actor.js";
import { NoticeBoard } from "./actors/notice-board.js";
import { DEFAULT_WORLD_CONFIG } from "./data/world-config.js";
import { SceneRegistry } from "./systems/scene-registry.js";
import { RoomSwitcher } from "./systems/room-switcher.js";
import { AgentSceneEntity } from "./actors/agent-scene-entity.js";
import { PetSceneEntity } from "./actors/pet-scene-entity.js";
import type { SceneEntity } from "./data/scene-entity.js";
import { restoreWorldState, restoreAgentState, flushWorldState, startPeriodicFlush } from "./engine-state.js";
import type { StateSystems } from "./engine-state.js";
import { wireEvents } from "./engine-events.js";
import type { EngineContext } from "./engine-types.js";
import {
	ENGINE_WIDTH, ENGINE_HEIGHT, OBJECT_POSITIONS,
	BRAIN_BOUNDS, PARTICLE_POOL_SIZE, DEFAULT_PET_ROOMS,
	AGENT_WAKE_DELAY, SCENE_TRANSITION_DURATION, LOADING_FADE_DURATION,
} from "./engine-config.js";
import { tickSimulation } from "./engine-simulation.js";

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

	// ── Engine creation ─────────────────────────────────
	// Pre-create a canvas inside the container so ExcaliburJS can measure
	// the parent for FitContainer mode during construction.
	const gameCanvas = document.createElement("canvas");
	container.appendChild(gameCanvas);

	// ── Loading overlay ──────────────────────────────────
	const loadingOverlay = document.createElement("div");
	loadingOverlay.style.cssText = `
		position: absolute; inset: 0; z-index: 9999;
		display: flex; flex-direction: column; align-items: center; justify-content: center;
		background: #0a0a0f; color: #64748b; font-family: system-ui, sans-serif;
		transition: opacity 0.6s ease-out;
	`;
	loadingOverlay.innerHTML = `
		<div style="font-size: 14px; margin-bottom: 16px; color: #94a3b8;">Loading Agent World</div>
		<div style="width: 120px; height: 4px; background: #1e293b; border-radius: 2px; overflow: hidden;">
			<div style="width: 30%; height: 100%; background: #3b82f6; border-radius: 2px; animation: loading-bar 1.2s ease-in-out infinite alternate;"></div>
		</div>
		<style>@keyframes loading-bar { from { width: 20%; margin-left: 0; } to { width: 40%; margin-left: 60%; } }</style>
	`;
	container.style.position = "relative";
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

	// ── Reactive store ──────────────────────────────────
	const store = new DashboardStore(deps.cliExecutor, deps.worldContext, deps.vaultBasePath);

	// ── Mount Lit overlay components ────────────────────
	const overlays = document.createElement("ft-game-overlays") as HTMLElement & { store: DashboardStore };
	overlays.store = store;
	container.appendChild(overlays);

	const rosterBarEl = document.createElement("ft-game-roster-bar") as HTMLElement & { store: DashboardStore };
	rosterBarEl.store = store;
	container.appendChild(rosterBarEl);

	const cameraHudEl = document.createElement("ft-game-camera-hud") as HTMLElement & { store: DashboardStore };
	cameraHudEl.store = store;
	container.appendChild(cameraHudEl);

	const agentPanelEl = document.createElement("ft-game-agent-panel") as HTMLElement & { store: DashboardStore };
	agentPanelEl.store = store;
	container.appendChild(agentPanelEl);

	const askBobEl = document.createElement("ft-game-ask-bob") as HTMLElement & { store: DashboardStore };
	askBobEl.store = store;
	container.appendChild(askBobEl);

	// ── Systems (initialised before scenes to allow wiring) ──────────
	let cameraSystem: ReturnType<typeof createCameraSystem> | null = null;

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

	// ── BT shared deps (Phase 1: stub I/O, real clock + action piping) ──
	const btWorldState = {
		emitAction: (action: { id: string; agentName: string; timestamp: string; type: string; data: Record<string, unknown> }) => {
			// Feed BT-emitted actions through the same event pipeline as SSE actions
			brainSystem.applyEvent(action.agentName, action.type);
		},
		updateEntity: () => {},
	};
	const btClock = {
		now: () => Date.now(),
		ms: () => Date.now(),
		iso: () => new Date().toISOString(),
	};
	const btNeedsBridge = {
		getNeeds: (name: string) => needsSystem.getNeeds(name),
	};
	const btBrainBridge = {
		assignWork: (name: string) => brainSystem.assignWork(name),
		releaseWork: (name: string) => brainSystem.releaseWork(name),
		applyEvent: (name: string, event: string) => brainSystem.applyEvent(name, event),
		getState: (name: string) => {
			const state = brainSystem.getState(name);
			return state?.state ?? "idle";
		},
	};
	const btDeps = createStubDeps(btWorldState, btClock, btNeedsBridge, btBrainBridge);
	const cycleConversationCounts = new Map<string, number>();
	/** Tracks which reactive triggers have fired per agent this cycle to avoid spamming. */
	const firedReactiveTriggers = new Map<string, Set<string>>();
	let prevCycleCount = 0;

	// ── Environmental objects ────────────────────────────
	const coffeeMachine = new CoffeeMachine();
	coffeeMachine.pos = ex.vec(OBJECT_POSITIONS.coffeeMachine.x, OBJECT_POSITIONS.coffeeMachine.y);
	const whiteboard = new WhiteboardActor();
	whiteboard.pos = ex.vec(OBJECT_POSITIONS.whiteboard.x, OBJECT_POSITIONS.whiteboard.y);
	const snackTable = new SnackTable();
	snackTable.pos = ex.vec(OBJECT_POSITIONS.snackTable.x, OBJECT_POSITIONS.snackTable.y);
	const waterCooler = new WaterCooler();
	waterCooler.pos = ex.vec(OBJECT_POSITIONS.waterCooler.x, OBJECT_POSITIONS.waterCooler.y);
	const couch = new CouchActor();
	couch.pos = ex.vec(OBJECT_POSITIONS.couch.x, OBJECT_POSITIONS.couch.y);
	const plant = new PlantActor();
	plant.pos = ex.vec(OBJECT_POSITIONS.plant.x, OBJECT_POSITIONS.plant.y);
	const noticeBoard = new NoticeBoard();
	noticeBoard.pos = ex.vec(OBJECT_POSITIONS.noticeBoard.x, OBJECT_POSITIONS.noticeBoard.y);

	// ── Register environmental objects in registry ──────
	registry.registerObject(coffeeMachine.objectId, "office", coffeeMachine.objectType, coffeeMachine.pos);
	registry.registerObject(whiteboard.objectId, "office", whiteboard.objectType, whiteboard.pos);
	registry.registerObject(snackTable.objectId, "village", snackTable.objectType, snackTable.pos);
	registry.registerObject(waterCooler.objectId, "village", waterCooler.objectType, waterCooler.pos);
	registry.registerObject(couch.objectId, "station", couch.objectType, couch.pos);
	registry.registerObject(plant.objectId, "hub", plant.objectType, plant.pos);
	registry.registerObject(noticeBoard.objectId, "hub", noticeBoard.objectType, noticeBoard.pos);

	// ── Office pets ──────────────────────────────────────
	const pets: PetActor[] = [];
	const catDef = PET_DEFINITIONS.find((p) => p.type === "cat")!;
	const dogDef = PET_DEFINITIONS.find((p) => p.type === "dog")!;
	const birdDef = PET_DEFINITIONS.find((p) => p.type === "bird")!;
	const fishDef = PET_DEFINITIONS.find((p) => p.type === "fish")!;

	// 3 cats, 3 dogs, 1 bird, 1 fish — distributed across rooms
	const hubCat = new PetActor(catDef, 300, 250, "cat-hub");
	const officeCat = new PetActor(catDef, 350, 300, "cat-office");
	const villageCat = new PetActor(catDef, 400, 280, "cat-village");
	const officeDog = new PetActor(dogDef, 500, 350, "dog-office");
	const villageDog = new PetActor(dogDef, 300, 200, "dog-village");
	const stationDog = new PetActor(dogDef, 450, 300, "dog-station");
	const villageBird = new PetActor(birdDef, 200, 80, "bird-village");
	const stationFish = new PetActor(fishDef, 680, 380, "fish-station");

	// Register pet BTs (skip stationary pets like fish with speed=0)
	for (const [pet, def] of [
		[hubCat, catDef], [officeCat, catDef], [villageCat, catDef],
		[officeDog, dogDef], [villageDog, dogDef], [stationDog, dogDef],
		[villageBird, birdDef],
	] as const) {
		const petId = pet.entityId;
		btSystem.registerPet(petId, createPetBT(petId, def.behaviors.sleepChance, def.behaviors.wanderRadius, def.speed, pet.petType));
	}

	// ── Agent select handler ────────────────────────────
	function handleAgentSelect(agentName: string): void {
		const actor = findAgentActor(agentName);
		if (store.selectedAgent === agentName) {
			// Same agent clicked while panel open -> close panel, stop follow
			store.selectAgent(null);
			if (cameraSystem) cameraSystem.stopFollow();
			store.stopFollow();
		} else {
			// Select agent -> center camera, follow, open panel
			if (actor) {
				brainSystem.freeze(agentName);
				actor.focus();
				if (cameraSystem) cameraSystem.startFollow(actor);
				store.startFollow(agentName);
				directorSystem.recordInteraction("click", { x: actor.pos.x, y: actor.pos.y });
			}
			store.selectAgent(agentName);
			store.selectTab("info");
			engagementSystem.clearTaskCompleted(agentName);
			// Warm up the agent process after a short delay so selection feels smooth
			setTimeout(() => void store.wakeAgent(agentName), AGENT_WAKE_DELAY);
			// Show a personality greeting via the talk engine instead of waking LLM
			const agent = store.agents.find((a) => a.name === agentName);
			if (agent) {
				const greetings = agent.personality && agent.personality.length > 0
					? ["Hey there!", "What can I help with?", "Good to see you."]
					: ["Hello!", "What's up?"];
				const greeting = greetings[Math.floor(Math.random() * greetings.length)];
				bubbleSystem.showBubble(agentName, "speech", greeting, engine.currentScene, findAgentActor, 3000);
			}
		}
	}

	// ── Scene config ────────────────────────────────────
	const sceneConfig = {
		onSceneChange: (target: string) => {
			store.selectAgent(null);
			void engine.goToScene(target, {
				destinationIn: new ex.FadeInOut({ duration: SCENE_TRANSITION_DURATION, direction: "in" }),
				sourceOut: new ex.FadeInOut({ duration: SCENE_TRANSITION_DURATION, direction: "out" }),
			}).then(() => {
				cameraSystem?.onSceneActivate(findAgentActor, engine.currentScene.camera);
			});
		},
		onAgentSelect: handleAgentSelect,
	};

	// ── Create scenes ───────────────────────────────────
	const hubScene = new GameScene(SCENE_CONFIGS.hub, sceneConfig);
	const officeScene = new GameScene(SCENE_CONFIGS.office, sceneConfig);
	const villageScene = new GameScene(SCENE_CONFIGS.village, sceneConfig);
	const stationScene = new GameScene(SCENE_CONFIGS.station, sceneConfig);

	const roomScenes: Record<string, GameScene> = {
		office: officeScene,
		village: villageScene,
		station: stationScene,
	};

	// Register scenes in SceneRegistry (GameScene implements SceneHandle)
	registry.registerScene("hub", hubScene);
	registry.registerScene("office", officeScene);
	registry.registerScene("village", villageScene);
	registry.registerScene("station", stationScene);

	engine.addScene("hub", hubScene);
	engine.addScene("office", officeScene);
	engine.addScene("village", villageScene);
	engine.addScene("station", stationScene);

	// ── Wire room scenes to brain system ────────────────
	officeScene.setBrainSystem(brainSystem);
	villageScene.setBrainSystem(brainSystem);
	stationScene.setBrainSystem(brainSystem);

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

	/** Find the position of the closest agent to `agentName` — same room only. */
	function findNearestAgent(agentName: string): { x: number; y: number } | null {
		const pos = brainSystem.getPosition(agentName);
		if (!pos) return null;
		const myRoom = registry.getEntityRoom(agentName);
		let closest: { x: number; y: number } | null = null;
		let minDist = Infinity;
		for (const [name, entry] of brainSystem.getAllEntries()) {
			if (name === agentName) continue;
			if (registry.getEntityRoom(name) !== myRoom) continue;
			const dx = pos.x - entry.position.x;
			const dy = pos.y - entry.position.y;
			const dist = dx * dx + dy * dy;
			if (dist < minDist) {
				minDist = dist;
				closest = { x: entry.position.x, y: entry.position.y };
			}
		}
		return closest;
	}

	// ── Track known entity IDs to distinguish adds from updates ──────
	const knownEntities = new Set<string>();

	// ── Register agents across all game subsystems ──────
	function registerAgents(agents: readonly DashboardAgent[]): void {
		hubScene.updateAgents(agents);
		store.setAgents(agents);

		for (const agent of agents) {
			brainSystem.register(agent.name, agent.attributes ?? {}, agent.mood, agent.domain);
			const brainState = brainSystem.getState(agent.name)!;
			bubbleSystem.register(agent.name, agent.personality ?? [], brainState.params);
			talkEngine.register(
				agent.name,
				agent.domain ?? "general",
				agent.personality ?? [],
				agent.attributes?.cha ?? 10,
			);
			emoteSystem.register(agent.name, agent.mood ?? "neutral", brainState.params.quoteFrequency);
			socialSystem.register(agent.name, {
				socialRadius: brainState.params.socialRadius,
				personality: agent.personality ?? [],
				domain: agent.domain ?? "general",
				relationships: agent.relationships ?? [],
			});
			needsSystem.register(agent.name, agent.attributes ?? {});
			sensorSystem.register(agent.name, agent.domain ?? "general");
			engagementSystem.register(agent.name, { domain: agent.domain ?? "general", cha: agent.attributes?.cha ?? 10 });
			ritualSystem.register(agent.name, { domain: agent.domain ?? "general" });
			memorySystem.register(agent.name);
			// Quirk assignment — restore from memory or roll new
			const savedQuirks = memorySystem.getMemory(agent.name).quirks;
			quirkSystem.register(agent.name, (agent.attributes ?? {}) as Record<string, number>, agent.domain ?? "general", savedQuirks);
			if (savedQuirks.length === 0) {
				memorySystem.getMemory(agent.name).quirks = quirkSystem.getQuirks(agent.name);
			}
			const overrides = quirkSystem.getOverrides(agent.name);
			if (Object.keys(overrides).length > 0) {
				brainSystem.applyQuirkOverrides(agent.name, overrides as Record<string, number>);
			}
			// Relationship opinions — restore from memory or assign new
			const savedOpinions = memorySystem.getMemory(agent.name).opinions;
			const opinions = savedOpinions.length > 0 ? savedOpinions : assignOpinions();
			if (savedOpinions.length === 0) {
				memorySystem.getMemory(agent.name).opinions = opinions;
			}
			relationshipSystem.register(agent.name, opinions);
			btSystem.register(agent, btDeps);
			knownEntities.add(agent.name);
		}
	}

	// ── Dedup guard for provider action relay ────────────
	const recentActionIds = new Set<string>();

	// ── Pre-update loop state ───────────────────────────
	let lastTime = performance.now();
	const prevWalkingState = new Map<string, boolean>();
	const lastTrailPos = new Map<string, { x: number; y: number }>();
	const petReactionCooldowns = new Map<string, number>();

	// ── Particle renderer — ex.Canvas actor added to each scene ──────
	function createParticleRenderer(): ex.Actor {
		const actor = new ex.Actor({
			pos: ex.vec(0, 0),
			anchor: ex.vec(0, 0),
			z: 50,
			collisionType: ex.CollisionType.PreventCollision,
		});
		const canvas = new ex.Canvas({
			width: ENGINE_WIDTH,
			height: ENGINE_HEIGHT,
			cache: false,
			draw: (ctx: CanvasRenderingContext2D) => {
				for (const p of particlePool.getAll()) {
					if (p.opacity <= 0.01) continue;
					ctx.globalAlpha = p.opacity;
					ctx.fillStyle = p.color;
					ctx.beginPath();
					ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
					ctx.fill();
				}
				ctx.globalAlpha = 1.0;
			},
		});
		actor.graphics.use(canvas);
		return actor;
	}
	hubScene.add(createParticleRenderer());
	officeScene.add(createParticleRenderer());
	villageScene.add(createParticleRenderer());
	stationScene.add(createParticleRenderer());

	// ── Environmental objects in scenes ─────────────────
	officeScene.add(coffeeMachine);
	officeScene.add(whiteboard);
	villageScene.add(snackTable);
	villageScene.add(waterCooler);
	stationScene.add(couch);
	hubScene.add(plant);
	hubScene.add(noticeBoard);

	// ── Office pets — scene placement deferred to start() for position restore ──
	pets.push(hubCat, officeCat, villageCat, officeDog, villageDog, stationDog, villageBird, stationFish);

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
					cameraSystem?.onSceneActivate(findAgentActor, engine.currentScene.camera);
				});
			}
		},
	});

	// ── Cursor spirit — visual director presence (one per scene) ────
	const cursorSpirits = [new CursorSpirit(), new CursorSpirit(), new CursorSpirit(), new CursorSpirit()];
	hubScene.add(cursorSpirits[0]);
	officeScene.add(cursorSpirits[1]);
	villageScene.add(cursorSpirits[2]);
	stationScene.add(cursorSpirits[3]);

	// ── Lighting overlay — full-screen tint driven by DayClock phase (smooth fade) ──
	const currentLight = { r: 0, g: 0, b: 0, opacity: 0 };
	function createLightingOverlay(): ex.Actor {
		const actor = new ex.Actor({
			pos: ex.vec(0, 0),
			anchor: ex.vec(0, 0),
			z: 500,
			collisionType: ex.CollisionType.PreventCollision,
		});
		const canvas = new ex.Canvas({
			width: ENGINE_WIDTH,
			height: ENGINE_HEIGHT,
			cache: false,
			draw: (ctx: CanvasRenderingContext2D) => {
				if (currentLight.opacity <= 0.001) return;
				ctx.fillStyle = `rgba(${Math.round(currentLight.r)}, ${Math.round(currentLight.g)}, ${Math.round(currentLight.b)}, ${currentLight.opacity.toFixed(3)})`;
				ctx.fillRect(0, 0, ENGINE_WIDTH, ENGINE_HEIGHT);
			},
		});
		actor.graphics.use(canvas);
		return actor;
	}
	hubScene.add(createLightingOverlay());
	officeScene.add(createLightingOverlay());
	villageScene.add(createLightingOverlay());
	stationScene.add(createLightingOverlay());

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
		cameraSystem,
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
	engine.on("postframe", () => {
		store.beginBatch();
		const positions = new Map<string, { x: number; y: number }>();
		const canvasRect = engine.canvas.getBoundingClientRect();

		for (const [name, entry] of brainSystem.getAllEntries()) {
			const actor = findCurrentSceneActor(name);
			if (!actor) continue;
			const pagePos = engine.screen.worldToPageCoordinates(actor.pos);
			positions.set(name, { x: pagePos.x - canvasRect.left, y: pagePos.y - canvasRect.top });

			if (entry.targetPos) {
				const targetPage = engine.screen.worldToPageCoordinates(ex.vec(entry.targetPos.x, entry.targetPos.y));
				store.setAgentTarget(name, {
					x: targetPage.x - canvasRect.left,
					y: targetPage.y - canvasRect.top,
				});
			} else {
				store.clearAgentTarget(name);
			}
			store.setAgentState(name, entry.state);
		}

		store.updatePositions(positions);
		store.endBatch();
	});

	// ── Keyboard handling ───────────────────────────────

	function isTyping(): boolean {
		// Walk the shadow DOM chain to find the deepest active element
		let el: Element | null = document.activeElement;
		while (el) {
			if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return true;
			if (el.shadowRoot?.activeElement) {
				el = el.shadowRoot.activeElement;
			} else {
				break;
			}
		}
		return false;
	}

	// Listen on document — keyboard should work whenever the game view is visible,
	// not just when the container has focus. isTyping() prevents conflicts with inputs.
	const keydownHandler = ((e: KeyboardEvent) => {
		if (isTyping()) return;
		if (e.key === "Escape" && cameraSystem?.isFollowing()) {
			cameraSystem.stopFollow();
		}
		if (e.key === "Home") {
			cameraSystem?.stopFollow();
		}
		cameraSystem?.handleKeyDown(e.key);
	}) as EventListener;

	const keyupHandler = ((e: KeyboardEvent) => {
		if (isTyping()) return;
		cameraSystem?.handleKeyUp(e.key);
	}) as EventListener;

	document.addEventListener("keydown", keydownHandler);
	document.addEventListener("keyup", keyupHandler);

	// ── Lifecycle handle ────────────────────────────────

	return {
		async start(): Promise<void> {
			// Inject pixel-art font — loaded dynamically since game may not always be active
			if (!document.querySelector('link[href*="Press+Start+2P"]')) {
				// eslint-disable-next-line obsidianmd/no-forbidden-elements -- dynamic font load for game UI only
				const fontLink = document.createElement("link");
				fontLink.rel = "stylesheet";
				fontLink.href = "https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap";
				document.head.appendChild(fontLink);
			}

			// Start engine and navigate to hub
			await engine.start();
			void engine.goToScene("hub");

			// Preload all character sprites
			const ASSET_BASE = `${spriteBasePath}/assets/Actor/Characters/`;
			const allCharacters = [
				...new Set(Object.values(DOMAIN_POOLS).flat()),
			];
			const spriteRegistry = await preloadSpriteRegistry(allCharacters, ASSET_BASE);

			// Pass sprite registry to all scenes
			hubScene.setSpriteRegistry(spriteRegistry);
			officeScene.setSpriteRegistry(spriteRegistry);
			villageScene.setSpriteRegistry(spriteRegistry);
			stationScene.setSpriteRegistry(spriteRegistry);

			// Camera system (after engine.start so camera is initialised)
			cameraSystem = createCameraSystem(
				engine.currentScene.camera,
				{ x: ENGINE_WIDTH / 2, y: ENGINE_HEIGHT / 2 },
			);
			ctx.cameraSystem = cameraSystem;

			engine.canvas.addEventListener("wheel", (e) => {
				e.preventDefault();
				cameraSystem!.handleZoom(e.deltaY);
			}, { passive: false });

			// Director mouse tracking — world-space cursor position + cursor spirit
			engine.input.pointers.primary.on("move", (evt) => {
				directorSystem.onMouseMove(evt.worldPos.x, evt.worldPos.y);
				for (const spirit of cursorSpirits) {
					spirit.show(evt.worldPos.x, evt.worldPos.y);
					spirit.moveTo(evt.worldPos.x, evt.worldPos.y);
				}
			});

			// Director mouse leave — cursor left canvas
			engine.canvas.addEventListener("mouseleave", () => {
				directorSystem.onMouseLeave();
				for (const spirit of cursorSpirits) spirit.hide();
			});

			// WorldContext updates are consumed during sendMessage serialization.
			// No need to push state to the store — WorldContext is the source of truth.

			// Restore persisted Living World state
			const { savedPositions } = deps.vaultBasePath
				? restoreWorldState(stateSystems, deps.vaultBasePath)
				: { savedPositions: null };
			ctx.prevCycleCount = dayClock.getCycleCount();

			// Initialize lighting to current phase (no pop on first frame)
			const initLight = worldAmbience.getLighting(dayClock.getPhase());
			currentLight.r = initLight.r;
			currentLight.g = initLight.g;
			currentLight.b = initLight.b;
			currentLight.opacity = initLight.opacity;

			// Start data provider and load initial data
			await provider.start();

			const initialAgents = await provider.getDashboardAgents();
			registerAgents(initialAgents);

			// Create SceneEntity wrappers for agents
			for (const agent of initialAgents) {
				const charName = resolveCharacter(agent.name, agent.domain ?? "");
				const sprites = spriteRegistry.get(charName);
				if (!sprites) continue;
				const entity = new AgentSceneEntity(agent, sprites, brainSystem, handleAgentSelect);
				allEntities.set(agent.name, entity);
			}
			// Add creature entities (wrapped — PetActor stays as state holder,
			// PetSceneEntity creates disposable visual actors per scene)
			for (const pet of pets) {
				allEntities.set(pet.entityId, new PetSceneEntity(pet));
			}

			// Route agents to room scenes — use saved positions/rooms if available
			for (const agent of initialAgents) {
				const saved = savedPositions?.[agent.name];
				const targetRoom = saved?.scene && registry.getScene(saved.scene) ? saved.scene : resolveSettingForDomain(agent.domain);

				if (targetRoom === "hub") {
					// Hub agents are already created by hubScene.updateAgents above
					registry.setEntityRoom(agent.name, "hub");
					// Restore position if saved
					if (saved) {
						const actor = hubScene.getAgentActor(agent.name);
						if (actor) {
							actor.pos.x = saved.x;
							actor.pos.y = saved.y;
						}
					}
				} else if (roomScenes[targetRoom]) {
					// Remove from hub first (hubScene.updateAgents may have created an actor)
					hubScene.removeAgent(agent.name);
					if (saved) {
						roomScenes[targetRoom].spawnAgentAtDoorway(agent);
						const actor = roomScenes[targetRoom].getAgentActor(agent.name);
						if (actor) {
							actor.pos.x = saved.x;
							actor.pos.y = saved.y;
						}
					} else {
						roomScenes[targetRoom].spawnAgent(agent);
					}
					registry.setEntityRoom(agent.name, targetRoom);
				}
			}

			// Restore or default-place creatures
			for (const pet of pets) {
				const saved = savedPositions?.[pet.entityId];
				const targetRoom = saved?.scene ?? DEFAULT_PET_ROOMS[pet.entityId] ?? "hub";
				const scene = targetRoom === "hub" ? hubScene : (roomScenes[targetRoom] ?? hubScene);
				const petEntity = allEntities.get(pet.entityId)!;

				scene.enter(petEntity as SceneEntity, null);
				// Restore saved position (enter() defaults to scene center)
				if (saved) {
					pet.pos.x = saved.x;
					pet.pos.y = saved.y;
					pet.resetHome();
					(petEntity as PetSceneEntity).syncVisual();
				}
				registry.setEntityRoom(pet.entityId, targetRoom);
			}

			// Restore needs after registration (register sets defaults, restore overrides)
			if (deps.vaultBasePath) {
				restoreAgentState(stateSystems, deps.vaultBasePath);
			}

			// Fetch initial world state for activity log
			const worldState = await provider.getWorldState();
			if (worldState?.activityLog) {
				store.setActivityLog(worldState.activityLog);
			}

			// FitContainer mode handles resize automatically — no manual
			// ResizeObserver needed. ExcaliburJS listens for window resize
			// and recalculates the viewport based on the parent container.

			// Fade out loading overlay
			loadingOverlay.style.opacity = "0";
			setTimeout(() => loadingOverlay.remove(), LOADING_FADE_DURATION);
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
