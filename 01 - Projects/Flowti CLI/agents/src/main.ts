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
import { renderAgentPanel } from "./ui/agent-panel.js";
import { appendAgentResponse } from "./ui/talk-tab.js";
import { sendMessage, assignTask, grantPermission } from "./data/api-client.js";
import type { AgentAction, DashboardAgent, ActivityEntry, PermissionEntry } from "./data/types.js";
import type { AgentActor } from "./actors/agent-actor.js";

// ── Constants ────────────────────────────────────────────────────────

const ENGINE_WIDTH = 1200;
const ENGINE_HEIGHT = 700;
const BASE_URL = "";

// ── Scene navigation helpers ─────────────────────────────────────────

function handleSceneChange(engine: ex.Engine, targetScene: string): void {
	engine.goToScene(targetScene);
}

// ── Main ─────────────────────────────────────────────────────────────

async function main(): Promise<void> {
	const engine = new ex.Engine({
		width: ENGINE_WIDTH,
		height: ENGINE_HEIGHT,
		backgroundColor: ex.Color.fromHex("#0a0a0f"),
		displayMode: ex.DisplayMode.FitScreen,
		antialiasing: true,
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
			});
		},
	});

	// ── Agent select handler ────────────────────────────
	function openPanelForAgent(agentName: string, screenX: number, screenY: number): void {
		panelManager.open(agentName, screenX, screenY);
	}

	function handleAgentSelect(agentName: string): void {
		// Open panel near center-right of the canvas
		const rect = engine.canvas.getBoundingClientRect();
		const screenX = rect.width * 0.6;
		const screenY = rect.height * 0.15;
		openPanelForAgent(agentName, screenX, screenY);
	}

	// ── Scene config ────────────────────────────────────
	const sceneConfig = {
		onSceneChange: (target: string) => handleSceneChange(engine, target),
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
				const text = typeof action.data["text"] === "string" ? action.data["text"] : "...";
				const currentScene = engine.currentScene;
				bubbleSystem.showBubble(action.agentName, "speech", text, currentScene, findAgentActor);

				// If panel is open for this agent, append to the talk thread
				if (panelManager.isOpen() && panelManager.getAgentName() === action.agentName) {
					const panelEl = canvasParent.querySelector(".agent-panel");
					const contentArea = panelEl?.querySelector(".agent-panel-content");
					if (contentArea instanceof HTMLElement) {
						appendAgentResponse(contentArea, `${action.agentName}: ${text}`);
					}
				}
			} else if (action.type === "thinking") {
				const text = typeof action.data["text"] === "string" ? action.data["text"] : "...";
				const currentScene = engine.currentScene;
				bubbleSystem.showBubble(action.agentName, "thought", text, currentScene, findAgentActor);
			} else if (action.type === "asking" || action.type === "requesting-permission") {
				const currentScene = engine.currentScene;
				bubbleSystem.showBubble(action.agentName, "question", "?", currentScene, findAgentActor);

				// Auto-open panel to Permissions tab when requesting-permission
				if (action.type === "requesting-permission") {
					const actor = findAgentActor(action.agentName);
					if (actor) {
						// Open or refresh the panel for this agent
						const rect = engine.canvas.getBoundingClientRect();
						openPanelForAgent(action.agentName, rect.width * 0.6, rect.height * 0.15);

						// Click the Permissions tab
						const panelEl = canvasParent.querySelector(".agent-panel");
						const permTab = panelEl?.querySelector('[data-tab="Permissions"]');
						if (permTab instanceof HTMLElement) {
							permTab.click();
						}
					}
				}
			}
		},
		onAgentsUpdated: (agents: readonly DashboardAgent[]) => {
			// Update hub scene with all agents
			hubScene.updateAgents(agents);

			// Register agents in brain and bubble systems
			for (const agent of agents) {
				brainSystem.register(agent.name, agent.attributes ?? {});
				bubbleSystem.register(agent.name, agent.personality ?? [], brainSystem.getState(agent.name)!.params);
			}
		},
		onActivityLog: (log) => {
			activityLog = log;
			hubScene.updateTicker(log);
		},
		onConnectionStatus: (_status) => {
			// Connection indicator integration pending
		},
		onStateDiff: (_diff) => {
			// Entity-level sync integration pending
		},
	});
	syncRef = syncSystem;

	// ── Pre-update hook for brain and bubble systems ────
	let lastTime = performance.now();
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
	});

	// ── Start ───────────────────────────────────────────
	await engine.start();
	engine.goToScene("hub");

	// Load initial data and start sync after engine is ready
	await syncSystem.start();
}

main().catch((err: unknown) => {
	console.error("Dashboard failed to start:", err);
});
