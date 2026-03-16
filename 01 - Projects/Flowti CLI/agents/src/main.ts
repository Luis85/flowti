/**
 * main.ts — ExcaliburJS engine setup with multi-scene navigation.
 *
 * Creates the engine with four scenes (hub, office, village, station),
 * wires up sync/brain/bubble systems, and starts the game loop.
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
import type { AgentAction, DashboardAgent } from "./data/types.js";
import type { AgentActor } from "./actors/agent-actor.js";

// ── Constants ────────────────────────────────────────────────────────

const ENGINE_WIDTH = 1200;
const ENGINE_HEIGHT = 700;
const BASE_URL = "";

// ── Scene navigation helpers ─────────────────────────────────────────

function handleSceneChange(engine: ex.Engine, targetScene: string): void {
	engine.goToScene(targetScene);
}

function handleAgentSelect(_agentName: string): void {
	// Agent detail panel integration pending
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
			} else if (action.type === "thinking") {
				const text = typeof action.data["text"] === "string" ? action.data["text"] : "...";
				const currentScene = engine.currentScene;
				bubbleSystem.showBubble(action.agentName, "thought", text, currentScene, findAgentActor);
			} else if (action.type === "asking" || action.type === "requesting-permission") {
				const currentScene = engine.currentScene;
				bubbleSystem.showBubble(action.agentName, "question", "?", currentScene, findAgentActor);
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
			hubScene.updateTicker(log);
		},
		onConnectionStatus: (_status) => {
			// Connection indicator integration pending
		},
		onStateDiff: (_diff) => {
			// Entity-level sync integration pending
		},
	});

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
	engine.goToScene("hub");

	// Load initial data and start sync
	await syncSystem.start();

	await engine.start();
}

main().catch((err: unknown) => {
	console.error("Dashboard failed to start:", err);
});
