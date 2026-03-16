/**
 * main.ts — ExcaliburJS engine setup with multi-scene navigation.
 *
 * Creates the engine with four scenes (hub, office, village, station),
 * wires up sync/brain/bubble systems and the agent detail panel, and
 * starts the game loop.
 */

import * as ex from "excalibur";
import { HubScene } from "./scenes/hub-scene.js";
import { createOfficeScene } from "./scenes/office-scene.js";
import { createVillageScene } from "./scenes/village-scene.js";
import { createStationScene } from "./scenes/station-scene.js";
import type { RoomScene } from "./scenes/room-scene.js";
import { SyncSystem } from "./systems/sync-system.js";
import { BrainSystem } from "./systems/brain-system.js";
import { BubbleSystem } from "./systems/bubble-system.js";
import { createPanelManager } from "./ui/panel-manager.js";
import { renderAgentPanel, switchToTab } from "./ui/agent-panel.js";
import { appendAgentResponse, extractAgentMessage, showThinkingIndicator, removeThinkingIndicator } from "./ui/talk-tab.js";
import { sendMessage, assignTask, grantPermission } from "./data/api-client.js";
import type { AgentAction, DashboardAgent, ActivityEntry, PermissionEntry } from "./data/types.js";
import type { AgentActor } from "./actors/agent-actor.js";
import { preferredWorkstation } from "./brain/movement.js";
import { createCameraSystem } from "./systems/camera-system.js";
import { DOMAIN_POOLS } from "./sprites/character-pool.js";
import { preloadSpriteRegistry } from "./sprites/sprite-loader.js";

// ── Constants ────────────────────────────────────────────────────────

const ENGINE_WIDTH = 1200;
const ENGINE_HEIGHT = 700;
const BASE_URL = "";

// ── Main ─────────────────────────────────────────────────────────────

async function main(): Promise<void> {
	const engine = new ex.Engine({
		width: ENGINE_WIDTH,
		height: ENGINE_HEIGHT,
		backgroundColor: ex.Color.fromHex("#0a0a0f"),
		displayMode: ex.DisplayMode.FitScreen,
		antialiasing: false,
		suppressPlayButton: true,
	});

	// ── Shared mutable state ────────────────────────────
	const canvasParent = engine.canvas.parentElement ?? document.body;
	let activityLog: readonly ActivityEntry[] = [];

	// Late-bound reference — set after SyncSystem is created.
	// All closures that reference syncRef are event callbacks, never called
	// during construction, so the value is guaranteed to be set by runtime.
	let syncRef: SyncSystem | null = null;

	// ── Panel manager (DOM overlay) ─────────────────────
	const panelManager = createPanelManager(canvasParent, {
		fetchAgent: (name) => {
			const agents = syncRef?.getAgents() ?? [];
			return agents.find((a) => a.name === name) ?? null;
		},
		fetchActivityLog: (agentName) =>
			activityLog.filter((e) => e.agentName === agentName),
		fetchPermissions: (agentName) => {
			const state = syncRef?.getStateStore().getState() ?? null;
			return state?.permissions[agentName] ?? [];
		},
		onClose: () => { /* panel closed — nothing to do */ },
		renderContent: (container, agentName, _callbacks) => {
			const agent = (syncRef?.getAgents() ?? []).find((a) => a.name === agentName);
			if (!agent) return;

			const state = syncRef?.getStateStore().getState() ?? null;
			const agentPermissions: readonly PermissionEntry[] =
				state?.permissions[agentName] ?? [];
			const agentActivity = activityLog.filter((e) => e.agentName === agentName);

			renderAgentPanel(container, agent, {
				onClose: () => panelManager.close(),
				sendMessage,
				assignTask,
				grantPermission,
				baseUrl: BASE_URL,
				activityLog: agentActivity,
				permissions: agentPermissions,
				pendingPermissions: [],
				currentPhase: undefined,
				onTaskAssigned: (name, taskName) => {
					brainSystem.applyEvent(name, "task-started");
					const currentScene = engine.currentScene;
					bubbleSystem.showBubble(name, "thought", `Starting: ${taskName}`, currentScene, findAgentActor);
				},
			});
		},
	});

	// ── Agent select handler ────────────────────────────
	function openPanelForAgent(agentName: string, screenX: number, screenY: number): void {
		panelManager.open(agentName, screenX, screenY);
	}

	function handleAgentSelect(agentName: string): void {
		const actor = findAgentActor(agentName);

		if (panelManager.isOpen() && panelManager.getAgentName() === agentName) {
			// Same agent clicked while panel open → close panel, start follow
			panelManager.close();
			if (actor && cameraSystem) {
				cameraSystem.startFollow(actor);
			}
		} else {
			// Different agent or no panel → center camera on agent, open panel
			if (cameraSystem?.isFollowing()) {
				cameraSystem.stopFollow();
			}
			// Smoothly pan camera to center on the clicked agent
			if (actor) {
				void engine.currentScene.camera.move(actor.pos, 300, ex.EasingFunctions.EaseInOutCubic);
			}
			const rect = engine.canvas.getBoundingClientRect();
			openPanelForAgent(agentName, rect.width * 0.6, rect.height * 0.15);
		}
	}

	// ── Scene config ────────────────────────────────────
	const sceneConfig = {
		onSceneChange: (target: string) => {
			panelManager.close();
			void engine.goToScene(target, {
				destinationIn: new ex.FadeInOut({ duration: 300, direction: "in" }),
				sourceOut: new ex.FadeInOut({ duration: 300, direction: "out" }),
			}).then(() => {
				cameraSystem?.onSceneActivate(findAgentActor, engine.currentScene.camera);
			});
		},
		onAgentSelect: handleAgentSelect,
	};

	// ── Create scenes ───────────────────────────────────
	const hubScene = new HubScene(sceneConfig);
	const officeScene = createOfficeScene(sceneConfig);
	const villageScene = createVillageScene(sceneConfig);
	const stationScene = createStationScene(sceneConfig);

	const roomScenes: Record<string, RoomScene> = {
		office: officeScene,
		village: villageScene,
		station: stationScene,
	};

	engine.addScene("hub", hubScene);
	engine.addScene("office", officeScene);
	engine.addScene("village", villageScene);
	engine.addScene("station", stationScene);

	// ── Systems ─────────────────────────────────────────
	const brainSystem = new BrainSystem({
		bounds: { minX: 80, maxX: ENGINE_WIDTH - 80, minY: 80, maxY: ENGINE_HEIGHT - 60 },
		onWorkstationChange: (agentName, action, position) => {
			// Find which room scene contains the agent and update its workstations
			for (const room of Object.values(roomScenes)) {
				const actor = room.getAgentActor(agentName);
				if (!actor) continue;

				if (action === "occupy") {
					// Find the nearest workstation to the agent's position
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
					// Vacate — find the workstation this agent occupies
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

	// Actor lookup across all scenes
	function findAgentActor(name: string): AgentActor | undefined {
		const hubActor = hubScene.getAgentActor(name);
		if (hubActor) return hubActor;
		for (const room of Object.values(roomScenes)) {
			const roomActor = room.getAgentActor(name);
			if (roomActor) return roomActor;
		}
		return undefined;
	}

	// ── Sync system ─────────────────────────────────────
	const syncSystem = new SyncSystem(BASE_URL, {
		onAgentAction: (action: AgentAction) => {
			// Transition brain state
			brainSystem.applyEvent(action.agentName, action.type);

			// Show bubble for certain actions
			if (action.type === "speaking") {
				const rawText = typeof action.data["text"] === "string" ? action.data["text"] : "...";
				const text = extractAgentMessage(rawText);
				const currentScene = engine.currentScene;
				bubbleSystem.showBubble(action.agentName, "speech", text, currentScene, findAgentActor);

				// If panel is open for this agent, remove thinking indicator and append response
				if (panelManager.isOpen() && panelManager.getAgentName() === action.agentName) {
					const panelEl = canvasParent.querySelector(".agent-panel");
					const contentArea = panelEl?.querySelector(".agent-panel-content");
					if (contentArea instanceof HTMLElement) {
						removeThinkingIndicator(contentArea);
						appendAgentResponse(contentArea, `${action.agentName}: ${rawText}`);
					}
				}
			} else if (action.type === "thinking") {
				const rawText = typeof action.data["text"] === "string" ? action.data["text"] : "...";
				const text = extractAgentMessage(rawText);
				const currentScene = engine.currentScene;
				bubbleSystem.showBubble(action.agentName, "thought", text, currentScene, findAgentActor);
			} else if (action.type === "asking" || action.type === "requesting-permission") {
				const currentScene = engine.currentScene;
				bubbleSystem.showBubble(action.agentName, "question", "?", currentScene, findAgentActor);

				// Auto-open panel to Permissions tab when requesting-permission
				if (action.type === "requesting-permission") {
					// Check if the agent has an actor in the current scene
					const activeScene = engine.currentScene;
					const isInCurrentScene =
						(activeScene === hubScene && hubScene.getAgentActor(action.agentName) !== undefined) ||
						Object.values(roomScenes).some((room) =>
							activeScene === room && room.getAgentActor(action.agentName) !== undefined,
						);

					if (isInCurrentScene) {
						// Open panel and switch to Permissions tab
						const rect = engine.canvas.getBoundingClientRect();
						openPanelForAgent(action.agentName, rect.width * 0.6, rect.height * 0.15);

						const panelEl = canvasParent.querySelector(".agent-panel");
						if (panelEl instanceof HTMLElement) {
							switchToTab(panelEl, "Permissions");
						}
					} else {
						// Agent is in another scene — show notification in ticker
						hubScene.updateTicker([{
							id: `perm-${Date.now()}`,
							agentName: action.agentName,
							timestamp: new Date().toISOString(),
							type: "requesting-permission",
							summary: `${action.agentName} is requesting permission`,
						}]);
					}
				}
			}
		},
		onAgentsUpdated: (agents: readonly DashboardAgent[]) => {
			// Update hub scene with all agents
			hubScene.updateAgents(agents);

			// Register agents in brain and bubble systems
			for (const agent of agents) {
				brainSystem.register(agent.name, agent.attributes ?? {}, agent.mood, agent.domain);
				bubbleSystem.register(agent.name, agent.personality ?? [], brainSystem.getState(agent.name)!.params);
			}
		},
		onActivityLog: (log) => {
			activityLog = log;
			hubScene.updateTicker(log);
		},
		onConnectionStatus: (status) => {
			hubScene.updateConnectionStatus(status);
		},
		onStateDiff: (_diff) => {
			// Entity-level sync integration pending
		},
	});
	syncRef = syncSystem;

	// ── Wire room scenes to sync and brain systems ──────
	syncSystem.setRoomScenes(roomScenes);
	officeScene.setBrainSystem(brainSystem);
	villageScene.setBrainSystem(brainSystem);
	stationScene.setBrainSystem(brainSystem);

	// ── Pre-update hook for brain, bubble, and camera systems ──
	let lastTime = performance.now();
	let cameraSystem: ReturnType<typeof createCameraSystem> | null = null;

	engine.on("preframe", () => {
		const now = performance.now();
		const deltaMs = now - lastTime;
		lastTime = now;
		brainSystem.update(deltaMs, findAgentActor);
		bubbleSystem.update(
			deltaMs,
			(name) => brainSystem.getState(name)?.state === "idle",
			engine.currentScene,
			findAgentActor,
		);
		if (cameraSystem) {
			cameraSystem.checkDespawn();
			cameraSystem.applyZoom(deltaMs);
		}
	});

	// ── Preload all character sprites ───────────────────────────────────
	const ASSET_BASE = "assets/Actor/Characters/";
	const allCharacters = [
		...new Set(Object.values(DOMAIN_POOLS).flat()),
	];
	const spriteRegistry = await preloadSpriteRegistry(allCharacters, ASSET_BASE);

	// ── Pass sprite registry to scenes ──────────────────────────────────
	hubScene.setSpriteRegistry(spriteRegistry);
	officeScene.setSpriteRegistry(spriteRegistry);
	villageScene.setSpriteRegistry(spriteRegistry);
	stationScene.setSpriteRegistry(spriteRegistry);

	// ── Start ───────────────────────────────────────────
	await engine.start();
	engine.goToScene("hub");

	// ── Camera system (after engine.start so camera is initialized) ──
	cameraSystem = createCameraSystem(engine.currentScene.camera, canvasParent);

	engine.canvas.addEventListener("wheel", (e) => {
		e.preventDefault();
		cameraSystem!.handleZoom(e.deltaY);
	}, { passive: false });

	document.addEventListener("keydown", (e) => {
		if (e.key === "Escape" && cameraSystem!.isFollowing()) {
			cameraSystem!.stopFollow();
		}
	});

	// Load initial data and start sync after engine is ready
	await syncSystem.start();
}

main().catch((err: unknown) => {
	console.error("Dashboard failed to start:", err);
});
