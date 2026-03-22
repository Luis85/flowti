/**
 * engine-lifecycle.ts — Engine start/dispose lifecycle extracted from engine.ts.
 *
 * Contains the `startEngine` async routine that runs during the first frame,
 * and the `handleAgentSelect` interaction handler.
 */

import * as ex from "excalibur";
import type { BrainSystem } from "./systems/brain-system.js";
import type { BubbleSystem } from "./systems/bubble-system.js";
import type { DirectorSystem } from "./systems/director-system.js";
import type { EngagementSystem } from "./systems/engagement-system.js";
import type { DashboardStore } from "./store/dashboard-store.js";
import type { AgentActor } from "./actors/agent-actor.js";
import type { GameScene } from "./scenes/game-scene.js";
import type { CursorSpirit } from "./actors/cursor-spirit.js";
import type { DataProvider } from "./config/data-provider.js";
import type { DashboardAgent } from "./data/types.js";
import type { EngineContext } from "./engine-types.js";
import type { StateSystems } from "./engine-state.js";
import type { LightState } from "./engine-rendering.js";
import type { RegistrationSystems, PlacementContext } from "./engine-startup.js";
import type { SceneEntity } from "./data/scene-entity.js";
import { createCameraSystem, type CameraSystem } from "./systems/camera-system.js";
import { DOMAIN_POOLS, resolveCharacter } from "./sprites/character-pool.js";
import { preloadSpriteRegistry } from "./sprites/sprite-loader.js";
import { restoreWorldState, restoreAgentState } from "./engine-state.js";
import { ENGINE_WIDTH, ENGINE_HEIGHT, LOADING_FADE_DURATION } from "./engine-config.js";
import { routeAgentsToRooms, placePets, reconcileSimulationRoster } from "./engine-startup.js";
import { AgentSceneEntity } from "./actors/agent-scene-entity.js";
import { PetSceneEntity } from "./actors/pet-scene-entity.js";
import type { PetActor } from "./actors/pet-actor.js";
import type { WorldAmbience } from "./systems/world-ambience.js";
import type { DayClock } from "./systems/day-clock.js";
import type { SceneRegistry } from "./systems/scene-registry.js";
import { AGENT_WAKE_DELAY } from "./engine-config.js";
import { afterNextPaint } from "./after-next-paint.js";

export interface StartEngineDeps {
	engine: ex.Engine;
	spriteBasePath: string;
	provider: DataProvider;
	vaultBasePath?: string;
	hubScene: GameScene;
	officeScene: GameScene;
	villageScene: GameScene;
	stationScene: GameScene;
	roomScenes: Record<string, GameScene>;
	ctx: EngineContext;
	stateSystems: StateSystems;
	dayClock: DayClock;
	worldAmbience: WorldAmbience;
	currentLight: LightState;
	brainSystem: BrainSystem;
	directorSystem: DirectorSystem;
	cursorSpirits: CursorSpirit[];
	store: DashboardStore;
	registrationSystems: RegistrationSystems;
	handleAgentSelect: (agentName: string) => void;
	allEntities: Map<string, SceneEntity>;
	pets: PetActor[];
	registry: SceneRegistry;
	loadingOverlay: HTMLElement;
	doRegisterAgents: (agents: readonly DashboardAgent[]) => void;
	cameraRef: { current: CameraSystem | null };
}

/**
 * Performs async engine startup: sprite preload, camera init, state restore,
 * agent registration, and loading overlay fade-out.
 * @returns Cleanup for roster subscription (call before provider.stop in dispose).
 */
export async function startEngine(deps: StartEngineDeps): Promise<() => void> {
	const {
		engine, spriteBasePath, provider, vaultBasePath,
		hubScene, officeScene, villageScene, stationScene, roomScenes,
		ctx, stateSystems, dayClock, worldAmbience, currentLight,
		brainSystem, directorSystem, cursorSpirits, store,
		handleAgentSelect, allEntities, pets, registry,
		loadingOverlay, doRegisterAgents, cameraRef,
		registrationSystems,
	} = deps;

	// Inject pixel-art font — loaded dynamically since game may not always be active
	if (!document.querySelector('link[href*="Press+Start+2P"]')) {
		// eslint-disable-next-line obsidianmd/no-forbidden-elements -- dynamic font load for game UI only
		const fontLink = document.createElement("link");
		fontLink.rel = "stylesheet";
		fontLink.href = "https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap";
		document.head.appendChild(fontLink);
	}

	await engine.start();
	void engine.goToScene("hub");

	// Preload all character sprites
	const ASSET_BASE = `${spriteBasePath}/assets/Actor/Characters/`;
	const allCharacters = [...new Set(Object.values(DOMAIN_POOLS).flat())];
	const spriteRegistry = await preloadSpriteRegistry(allCharacters, ASSET_BASE);

	hubScene.setSpriteRegistry(spriteRegistry);
	officeScene.setSpriteRegistry(spriteRegistry);
	villageScene.setSpriteRegistry(spriteRegistry);
	stationScene.setSpriteRegistry(spriteRegistry);

	// Camera system (after engine.start so camera is initialised)
	const cameraSystem = createCameraSystem(
		engine.currentScene.camera,
		{ x: ENGINE_WIDTH / 2, y: ENGINE_HEIGHT / 2 },
	);
	cameraRef.current = cameraSystem;
	ctx.systems.cameraSystem = cameraSystem;

	engine.canvas.addEventListener("wheel", (e) => {
		e.preventDefault();
		cameraSystem.handleZoom(e.deltaY);
	}, { passive: false });

	engine.input.pointers.primary.on("move", (evt) => {
		directorSystem.onMouseMove(evt.worldPos.x, evt.worldPos.y);
		for (const spirit of cursorSpirits) {
			spirit.show(evt.worldPos.x, evt.worldPos.y);
			spirit.moveTo(evt.worldPos.x, evt.worldPos.y);
		}
	});

	engine.canvas.addEventListener("mouseleave", () => {
		directorSystem.onMouseLeave();
		for (const spirit of cursorSpirits) spirit.hide();
	});

	// Restore persisted Living World state
	const { savedPositions } = vaultBasePath
		? restoreWorldState(stateSystems, vaultBasePath)
		: { savedPositions: null };
	ctx.state.prevCycleCount = dayClock.getCycleCount();

	// Initialize lighting to current phase (no pop on first frame)
	const initLight = worldAmbience.getLighting(dayClock.getPhase());
	currentLight.r = initLight.r;
	currentLight.g = initLight.g;
	currentLight.b = initLight.b;
	currentLight.opacity = initLight.opacity;

	await provider.start();
	const initialAgents = await provider.getDashboardAgents();
	doRegisterAgents(initialAgents);

	// Create SceneEntity wrappers
	for (const agent of initialAgents) {
		const charName = resolveCharacter(agent.name, agent.domain ?? "");
		const sprites = spriteRegistry.get(charName);
		if (!sprites) continue;
		const entity = new AgentSceneEntity(agent, sprites, brainSystem, handleAgentSelect);
		allEntities.set(agent.name, entity);
	}
	for (const pet of pets) {
		allEntities.set(pet.entityId, new PetSceneEntity(pet));
	}

	// Route agents and pets to room scenes
	const placementCtx: PlacementContext = { hubScene, roomScenes, registry, allEntities, pets };
	routeAgentsToRooms(initialAgents, savedPositions, placementCtx);
	placePets(savedPositions, placementCtx);

	if (vaultBasePath) {
		restoreAgentState(stateSystems, vaultBasePath);
	}

	const worldState = await provider.getWorldState();
	if (worldState?.activityLog) {
		store.setActivityLog(worldState.activityLog);
	}

	let rosterSnapshot = [...initialAgents];
	const rosterUnsub = provider.onDashboardAgentsChange((next) => {
		const prev = rosterSnapshot;
		rosterSnapshot = [...next];
		reconcileSimulationRoster(
			prev,
			next,
			hubScene,
			roomScenes,
			store,
			registrationSystems,
			placementCtx,
			{
				spriteRegistry,
				brainSystem,
				handleAgentSelect,
				allEntities,
			},
		);
	});

	loadingOverlay.classList.add("ft-world-fade-out");
	setTimeout(() => loadingOverlay.remove(), LOADING_FADE_DURATION);

	return () => { rosterUnsub(); };
}

export interface AgentSelectDeps {
	store: DashboardStore;
	brainSystem: BrainSystem;
	bubbleSystem: BubbleSystem;
	directorSystem: DirectorSystem;
	engagementSystem: EngagementSystem;
	engine: ex.Engine;
	findAgentActor: (name: string) => AgentActor | undefined;
	getCameraSystem: () => ReturnType<typeof createCameraSystem> | null;
}

/**
 * Creates the handleAgentSelect callback for agent click interactions.
 */
export function createAgentSelectHandler(deps: AgentSelectDeps): (agentName: string) => void {
	const { store, brainSystem, bubbleSystem, directorSystem, engagementSystem, engine, findAgentActor, getCameraSystem } = deps;

	return (agentName: string) => {
		const actor = findAgentActor(agentName);
		const cameraSystem = getCameraSystem();
		if (store.selectedAgent === agentName) {
			store.selectAgent(null);
			if (cameraSystem) cameraSystem.stopFollow();
			store.stopFollow();
		} else {
			// 1) Update dashboard store in one batch so the agent panel can render without waiting
			//    on Excalibur camera/brain/bubble work in the same task.
			store.beginBatch();
			store.selectAgent(agentName);
			store.selectTab("info");
			store.endBatch();

			// 2) After the next paint, apply canvas-side selection (freeze, follow, bubble, wake).
			afterNextPaint(() => {
				if (store.selectedAgent !== agentName) return;
				if (actor) {
					brainSystem.freeze(agentName);
					actor.focus();
					if (cameraSystem) cameraSystem.startFollow(actor);
					store.startFollow(agentName);
					directorSystem.recordInteraction("click", { x: actor.pos.x, y: actor.pos.y });
				}
				engagementSystem.clearTaskCompleted(agentName);
				globalThis.setTimeout(() => void store.wakeAgent(agentName), AGENT_WAKE_DELAY);
				const agent = store.agents.find((a) => a.name === agentName);
				if (agent) {
					const greetings = agent.personality && agent.personality.length > 0
						? ["Hey there!", "What can I help with?", "Good to see you."]
						: ["Hello!", "What's up?"];
					const greeting = greetings[Math.floor(Math.random() * greetings.length)];
					bubbleSystem.showBubble(agentName, "speech", greeting, engine.currentScene, findAgentActor, 3000);
				}
			});
		}
	};
}
