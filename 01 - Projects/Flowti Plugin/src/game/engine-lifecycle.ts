/**
 * engine-lifecycle.ts — Engine start/dispose lifecycle extracted from engine.ts.
 *
 * Contains the `startEngine` async routine that runs during the first frame,
 * and the `handleAgentSelect` interaction handler.
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import * as ex from "excalibur";
import type { BlackboardManager } from "./systems/blackboard.js";
import { resetToIdle } from "./systems/blackboard.js";
import { DEFAULT_ROOM } from "./data/scene-configs.js";
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
import { loadRoomElements } from "./sprites/animated-elements.js";
import { shouldShowBriefing, calculateOfflineProgress, type AgentOfflineInput } from "./systems/offline-progress.js";
import type { NarrativeSystem } from "./systems/narrative-system.js";
import { findNodeBinary } from "../infrastructure/agents/cli-executor.js";
import { runOneShotCommand } from "../infrastructure/agents/cli-executor-helpers.js";
import type { OfflineResults } from "./systems/offline-progress.js";

/** Per-agent `economy:reward` must not block world startup (stuck CLI = infinite loading). */
const OFFLINE_REWARD_CLI_TIMEOUT_MS = 25_000;

async function applyOfflineEconomyRewards(
	results: OfflineResults,
	store: DashboardStore,
	vaultBasePath: string,
	narrativeSystem: NarrativeSystem,
): Promise<void> {
	const nodeBin = findNodeBinary();
	const cliBin = join(vaultBasePath, ".flowti", "bin", "main.mjs");
	for (const agentResult of results.agentResults) {
		if (agentResult.xpEarned <= 0 && agentResult.coinEarned <= 0) continue;
		const current = store.getAgentEconomy(agentResult.name);
		if (!current) continue;
		let usedCliTotals = false;
		if (nodeBin && existsSync(cliBin)) {
			try {
				const output = await runOneShotCommand(
					nodeBin, cliBin,
					["economy:reward", `--agent=${agentResult.name}`, `--xp=${agentResult.xpEarned}`, `--coin=${agentResult.coinEarned}`, "--format=json"],
					vaultBasePath,
					OFFLINE_REWARD_CLI_TIMEOUT_MS,
				);
				const reward = output as {
					totalXp?: number; totalCoin?: number; level?: number;
				};
				if (reward.totalXp !== undefined && reward.totalCoin !== undefined) {
					store.setAgentEconomy(agentResult.name, {
						coin: reward.totalCoin,
						xp: reward.totalXp,
						level: reward.level ?? agentResult.currentLevel,
					});
					usedCliTotals = true;
				}
			} catch {
				// CLI not available or timed out — fall through to store-only update
			}
		}
		if (!usedCliTotals) {
			store.setAgentEconomy(agentResult.name, {
				coin: current.coin + agentResult.coinEarned,
				xp: current.xp + agentResult.xpEarned,
				level: agentResult.currentLevel,
			});
		}
		narrativeSystem.recordBeat({
			timestamp: Date.now(),
			phase: "morning-arrival",
			category: "economy",
			actors: [agentResult.name],
			event: "reward-earned",
			detail: {
				agent: agentResult.name,
				coin: agentResult.coinEarned,
				xp: agentResult.xpEarned,
				reason: `offline progress (${results.cyclesSimulated} cycle${results.cyclesSimulated === 1 ? "" : "s"})`,
			},
		});
	}
}

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
	blackboards: BlackboardManager;
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
	narrativeSystem: NarrativeSystem;
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
		blackboards, directorSystem, cursorSpirits, store,
		handleAgentSelect, allEntities, pets, registry,
		loadingOverlay, doRegisterAgents, cameraRef, narrativeSystem,
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
	void engine.goToScene(DEFAULT_ROOM);

	// Parallel asset loading — sprites, room elements, and data provider are independent
	const ASSET_BASE = `${spriteBasePath}/assets/Actor/Characters/`;
	const ANIM_BASE = `${spriteBasePath}/assets`;
	const allCharacters = [...new Set(Object.values(DOMAIN_POOLS).flat())];
	const sceneByRoom: Record<string, GameScene> = { hub: hubScene, office: officeScene, village: villageScene, station: stationScene };

	const [spriteRegistry, , ] = await Promise.all([
		preloadSpriteRegistry(allCharacters, ASSET_BASE),
		Promise.all(
			Object.entries(sceneByRoom).map(async ([roomId, scene]) => {
				const actors = await loadRoomElements(roomId, ANIM_BASE);
				for (const actor of actors) scene.add(actor);
			}),
		),
		provider.start(),
	]);

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
	const { savedPositions, clockLastUpdated } = vaultBasePath
		? restoreWorldState(stateSystems, vaultBasePath)
		: { savedPositions: null, clockLastUpdated: null as number | null };
	ctx.state.prevCycleCount = dayClock.getCycleCount();

	// Initialize lighting to current phase (no pop on first frame)
	const initLight = worldAmbience.getLighting(dayClock.getPhase());
	currentLight.r = initLight.r;
	currentLight.g = initLight.g;
	currentLight.b = initLight.b;
	currentLight.opacity = initLight.opacity;

	const initialAgents = await provider.getDashboardAgents();
	doRegisterAgents(initialAgents);

	// Create SceneEntity wrappers
	for (const agent of initialAgents) {
		const charName = resolveCharacter(agent.name, agent.domain ?? "");
		const sprites = spriteRegistry.get(charName);
		if (!sprites) continue;
		const entity = new AgentSceneEntity(agent, sprites, blackboards, handleAgentSelect);
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

	// ── Enrich agents with CLI economy data ──────────────
	if (vaultBasePath) {
		try {
			const economyPath = join(vaultBasePath, ".flowti", "var", "economy.json");
			if (existsSync(economyPath)) {
				const raw = readFileSync(economyPath, "utf-8");
				const ledger = JSON.parse(raw) as {
					accounts?: Record<string, { xp?: number; level?: number; coin?: number; tokens?: number }>;
				};
				if (ledger.accounts) {
					for (const [name, account] of Object.entries(ledger.accounts)) {
						store.setAgentEconomy(name, {
							xp: account.xp,
							level: account.level,
							coin: account.coin,
							tokens: account.tokens,
						});
					}
				}
			}
		} catch {
			// economy.json may not exist or be malformed — continue without it
		}
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
				blackboards,
				handleAgentSelect,
				allEntities,
			},
		);
	});

	const dismissLoadingOverlay = (): void => {
		loadingOverlay.classList.add("ft-world-fade-out");
		setTimeout(() => loadingOverlay.remove(), LOADING_FADE_DURATION);
	};

	// ── Offline progress briefing ────────────────────────
	if (clockLastUpdated !== null) {
		const elapsedMs = Date.now() - clockLastUpdated;
		if (shouldShowBriefing(elapsedMs)) {
			const agentInputs: AgentOfflineInput[] = initialAgents.map((a) => ({
				name: a.name,
				level: a.level ?? 1,
				xp: a.xp ?? 0,
				coin: a.coin ?? 0,
				assignedTasks: (a.suggestedTasks?.length ?? 0),
				avgTasksPerCycle: 1,
			}));

			const results = calculateOfflineProgress(elapsedMs, agentInputs);
			const narrativeText = narrativeSystem.composeOfflineNarrative(results);

			// Route briefing through the sidebar via store
			store.briefingData = { results, narrativeText };
			store.setActivePanel("briefing");

			// Dismiss loading before CLI work: `economy:reward` can hang if the CLI never exits.
			dismissLoadingOverlay();

			if (vaultBasePath) {
				void applyOfflineEconomyRewards(results, store, vaultBasePath, narrativeSystem);
			}
		} else {
			dismissLoadingOverlay();
		}
	} else {
		dismissLoadingOverlay();
	}

	return () => { rosterUnsub(); };
}

export interface AgentSelectDeps {
	store: DashboardStore;
	blackboards: BlackboardManager;
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
	const { store, blackboards, bubbleSystem, directorSystem, engagementSystem, engine, findAgentActor, getCameraSystem } = deps;

	return (agentName: string) => {
		const actor = findAgentActor(agentName);
		const cameraSystem = getCameraSystem();
		if (store.selectedAgent === agentName) {
			store.selectAgent(null);
			if (cameraSystem) cameraSystem.stopFollow();
			store.stopFollow();
		} else {
			// 1) Update dashboard store in one batch so the agent panel can render without waiting
			//    on Excalibur camera/blackboard work in the same task.
			store.beginBatch();
			store.selectAgent(agentName);
			store.selectTab("profile");
			store.endBatch();

			// 2) After the next paint, apply canvas-side selection (idle, follow, bubble, wake).
			afterNextPaint(() => {
				if (store.selectedAgent !== agentName) return;
				if (actor) {
					const bb = blackboards.tryGet(agentName);
					if (bb) resetToIdle(bb);
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
