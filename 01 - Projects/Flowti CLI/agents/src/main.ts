/**
 * main.ts — ExcaliburJS engine setup with multi-scene navigation.
 *
 * Creates the engine with four scenes (hub, office, village, station),
 * wires up sync/brain/bubble/talk systems and Lit overlay components,
 * and starts the game loop.
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
import { TalkEngine } from "./systems/talk-engine.js";
import { extractAgentMessage } from "./data/message-utils.js";
import type { AgentAction, DashboardAgent } from "./data/types.js";
import type { AgentActor } from "./actors/agent-actor.js";
import { preferredWorkstation } from "./brain/movement.js";
import { createCameraSystem } from "./systems/camera-system.js";
import { DOMAIN_POOLS } from "./sprites/character-pool.js";
import { preloadSpriteRegistry } from "./sprites/sprite-loader.js";
import { DashboardStore } from "./store/dashboard-store.js";

// Side-effect imports — register Lit custom elements
import "./ui/dashboard-overlays.js";
import "./ui/roster-bar.js";
import "./ui/camera-hud.js";
import "./ui/agent-panel.js";

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
		antialiasing: true,
		suppressPlayButton: true,
	});

	// ── Shared mutable state ────────────────────────────
	const canvasParent = engine.canvas.parentElement ?? document.body;

	// ── Reactive store ──────────────────────────────────
	const store = new DashboardStore(BASE_URL);

	// ── Mount Lit overlay components ────────────────────
	const overlays = document.createElement("dashboard-overlays") as any;
	overlays.store = store;
	canvasParent.appendChild(overlays);

	const rosterBarEl = document.createElement("roster-bar") as any;
	rosterBarEl.store = store;
	canvasParent.appendChild(rosterBarEl);

	const cameraHudEl = document.createElement("camera-hud") as any;
	cameraHudEl.store = store;
	canvasParent.appendChild(cameraHudEl);

	const agentPanelEl = document.createElement("agent-panel") as any;
	agentPanelEl.store = store;
	canvasParent.appendChild(agentPanelEl);

	// ── Agent select handler ────────────────────────────
	function handleAgentSelect(agentName: string): void {
		const actor = findAgentActor(agentName);
		if (store.selectedAgent === agentName) {
			// Same agent clicked while panel open -> close panel, start follow
			store.selectAgent(null);
			if (actor && cameraSystem) {
				cameraSystem.startFollow(actor);
			}
			store.startFollow(agentName);
		} else {
			// Different agent or no panel -> center camera on agent, open panel
			if (cameraSystem?.isFollowing()) {
				cameraSystem.stopFollow();
				store.stopFollow();
			}
			if (actor) {
				actor.focus();
				void engine.currentScene.camera.move(actor.pos, 300, ex.EasingFunctions.EaseInOutCubic);
			}
			store.selectAgent(agentName);
			void store.wakeAgent(agentName);
		}
	}

	// ── Scene config ────────────────────────────────────
	const sceneConfig = {
		onSceneChange: (target: string) => {
			store.selectAgent(null);
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

	// ── Talk engine (ambient chatter) ───────────────────
	const talkEngine = new TalkEngine({
		showBubble: (agentName, kind, text) => {
			bubbleSystem.showBubble(agentName, kind, text, engine.currentScene, findAgentActor, 5000);
		},
		isIdle: (name) => brainSystem.getState(name)?.state === "idle",
	});

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

			// Silence talk engine when LLM responds
			if (action.type === "speaking" || action.type === "asking") {
				talkEngine.silence(action.agentName);
			}

			// Show bubble for certain actions
			if (action.type === "speaking" || action.type === "asking") {
				const rawText = typeof action.data["text"] === "string" ? action.data["text"] : "...";
				const text = extractAgentMessage(rawText);
				const bubbleKind = action.type === "asking" ? "question" : "speech";
				const currentScene = engine.currentScene;
				bubbleSystem.showBubble(action.agentName, bubbleKind, text, currentScene, findAgentActor);

				// Push response to store for panel-talk component
				store.pushAgentResponse(action.agentName, text);
				store.setLlmStatus(action.agentName, { state: "idle", since: Date.now() });
			} else if (action.type === "thinking") {
				const rawText = typeof action.data["text"] === "string" ? action.data["text"] : "...";
				const text = extractAgentMessage(rawText);
				const currentScene = engine.currentScene;
				bubbleSystem.showBubble(action.agentName, "thought", text, currentScene, findAgentActor);
			} else if (action.type === "requesting-permission") {
				const currentScene = engine.currentScene;
				bubbleSystem.showBubble(action.agentName, "question", "?", currentScene, findAgentActor);

				// Auto-open panel to Permissions tab via store
				store.selectAgent(action.agentName);
				store.selectTab("permissions");
			}
		},
		onAgentsUpdated: (agents: readonly DashboardAgent[]) => {
			// Update hub scene and store
			hubScene.updateAgents(agents);
			store.setAgents(agents);

			// Register agents in brain, bubble, and talk systems
			for (const agent of agents) {
				brainSystem.register(agent.name, agent.attributes ?? {}, agent.mood, agent.domain);
				bubbleSystem.register(agent.name, agent.personality ?? [], brainSystem.getState(agent.name)!.params);
				talkEngine.register(
					agent.name,
					agent.domain ?? "general",
					agent.personality ?? [],
					agent.attributes?.cha ?? 10,
				);
			}
		},
		onActivityLog: (log) => {
			store.setActivityLog(log);
		},
		onConnectionStatus: (status) => {
			hubScene.updateConnectionStatus(status);
			store.setConnectionStatus(status);
		},
		onStateDiff: (_diff) => {
			// Entity-level sync integration pending
		},
	});
	// ── Wire room scenes to sync and brain systems ──────
	syncSystem.setRoomScenes(roomScenes);
	officeScene.setBrainSystem(brainSystem);
	villageScene.setBrainSystem(brainSystem);
	stationScene.setBrainSystem(brainSystem);

	// ── Pre-update hook for brain, bubble, talk, and camera systems ──
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
		talkEngine.update(deltaMs);
		if (cameraSystem) {
			cameraSystem.checkDespawn();
			cameraSystem.applyZoom(deltaMs);
			cameraSystem.updatePan(deltaMs);
		}
	});

	// ── Post-frame adapter: push positions/targets/states to store ──
	engine.on("postframe", () => {
		const positions = new Map<string, { x: number; y: number }>();

		for (const [name, entry] of brainSystem.getAllEntries()) {
			const actor = findAgentActor(name);
			if (!actor) continue;
			const screenPos = engine.worldToScreenCoordinates(actor.pos);
			positions.set(name, { x: screenPos.x, y: screenPos.y });

			if (entry.targetPos) {
				const targetScreen = engine.worldToScreenCoordinates(ex.vec(entry.targetPos.x, entry.targetPos.y));
				store.setAgentTarget(name, { x: targetScreen.x, y: targetScreen.y });
			}
			store.setAgentState(name, entry.state);
		}

		store.updatePositions(positions);
	});

	// ── Store event listeners for engine-side effects ────
	store.addEventListener("scene-change", ((e: CustomEvent) => {
		sceneConfig.onSceneChange(e.detail.setting);
	}) as EventListener);

	store.addEventListener("agent-message-sent", ((e: CustomEvent) => {
		const { agentName } = e.detail;
		const fillers = ["Let me think...", "One moment...", "Processing..."];
		const filler = fillers[Math.floor(Math.random() * fillers.length)];
		bubbleSystem.showBubble(agentName, "thought", filler, engine.currentScene, findAgentActor, 4000);
		talkEngine.silence(agentName);
	}) as EventListener);

	store.addEventListener("task-assigned", ((e: CustomEvent) => {
		const { agentName, task } = e.detail;
		brainSystem.applyEvent(agentName, "task-started");
		bubbleSystem.showBubble(agentName, "thought", `Starting: ${task}`, engine.currentScene, findAgentActor);
	}) as EventListener);

	// ── Camera follow via store state ───────────────────
	let prevFollowed: string | null = null;
	store.addEventListener("state-changed", () => {
		if (store.followedAgent !== prevFollowed) {
			prevFollowed = store.followedAgent;
			if (store.followedAgent) {
				const actor = findAgentActor(store.followedAgent);
				if (actor) cameraSystem!.startFollow(actor);
			} else {
				cameraSystem!.stopFollow();
			}
		}
	});

	// ── Start engine first (WebGL context needed for textures) ──────────
	await engine.start();
	engine.goToScene("hub");
	console.log("[dashboard] Engine started, hub scene active");

	// ── Preload all character sprites ───────────────────────────────────
	const ASSET_BASE = "assets/Actor/Characters/";
	const allCharacters = [
		...new Set(Object.values(DOMAIN_POOLS).flat()),
	];
	console.log("[dashboard] Preloading sprites for", allCharacters.length, "characters...");
	const spriteRegistry = await preloadSpriteRegistry(allCharacters, ASSET_BASE);
	console.log("[dashboard] Sprites loaded:", spriteRegistry.size, "of", allCharacters.length);

	// ── Pass sprite registry to scenes ──────────────────────────────────
	hubScene.setSpriteRegistry(spriteRegistry);
	officeScene.setSpriteRegistry(spriteRegistry);
	villageScene.setSpriteRegistry(spriteRegistry);
	stationScene.setSpriteRegistry(spriteRegistry);

	// ── Camera system (after engine.start so camera is initialized) ──
	cameraSystem = createCameraSystem(
		engine.currentScene.camera,
		{ x: ENGINE_WIDTH / 2, y: ENGINE_HEIGHT / 2 },
	);

	engine.canvas.addEventListener("wheel", (e) => {
		e.preventDefault();
		cameraSystem!.handleZoom(e.deltaY);
	}, { passive: false });

	function isTyping(): boolean {
		const el = document.activeElement;
		if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return true;
		const inner = el?.shadowRoot?.activeElement;
		return inner instanceof HTMLInputElement || inner instanceof HTMLTextAreaElement;
	}

	document.addEventListener("keydown", (e) => {
		if (isTyping()) return;
		if (e.key === "Escape" && cameraSystem!.isFollowing()) {
			cameraSystem!.stopFollow();
		}
		if (e.key === "Home") {
			cameraSystem!.stopFollow();
		}
		cameraSystem!.handleKeyDown(e.key);
	});

	document.addEventListener("keyup", (e) => {
		if (isTyping()) return;
		cameraSystem!.handleKeyUp(e.key);
	});

	// Load initial data and start sync after engine is ready
	await syncSystem.start();
}

main().catch((err: unknown) => {
	console.error("Dashboard failed to start:", err);
});
