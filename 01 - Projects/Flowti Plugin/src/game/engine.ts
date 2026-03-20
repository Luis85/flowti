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
import { HubScene } from "./scenes/hub-scene.js";
import { createOfficeScene } from "./scenes/office-scene.js";
import { createVillageScene } from "./scenes/village-scene.js";
import { createStationScene } from "./scenes/station-scene.js";
import type { RoomScene } from "./scenes/room-scene.js";
import { BrainSystem } from "./systems/brain-system.js";
import { BubbleSystem } from "./systems/bubble-system.js";
import { TalkEngine } from "./systems/talk/talk-engine.js";
import { extractAgentMessage } from "./data/message-utils.js";
import type { AgentAction, DashboardAgent, WorldEntity } from "./data/types.js";
import type { AgentActor } from "./actors/agent-actor.js";
import { preferredWorkstation } from "./brain/movement.js";
import { createCameraSystem } from "./systems/camera-system.js";
import { DOMAIN_POOLS } from "./sprites/character-pool.js";
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
import { HUDDLE_TEMPLATES } from "./data/huddle-templates.js";
import { interpolateTemplate } from "./data/engagement-templates.js";
import type { DataProvider } from "./config/data-provider.js";
import type { WorldContext } from "../domain/agents/world-context.js";
import type { ICliExecutor } from "../infrastructure/agents/cli-executor.js";
import { DayClock } from "./systems/day-clock.js";
import { WorldAmbience } from "./systems/world-ambience.js";
import { MemorySystem } from "./systems/memory-system.js";
import { QuirkSystem } from "./systems/quirk-system.js";
import { WorldEventScheduler } from "./systems/world-event-scheduler.js";
import { CoffeeMachine } from "./actors/coffee-machine.js";
import { WhiteboardActor } from "./actors/whiteboard-actor.js";
import { SnackTable } from "./actors/snack-table.js";
import { WaterCooler } from "./actors/water-cooler.js";
import { CouchActor } from "./actors/couch-actor.js";
import { PlantActor } from "./actors/plant-actor.js";
import { NoticeBoard } from "./actors/notice-board.js";
import { DEFAULT_WORLD_CONFIG } from "./data/world-config.js";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

// Side-effect imports — register Lit custom elements
import "./ui/dashboard-overlays.js";
import "./ui/ask-bob.js";
import "./ui/roster-bar.js";
import "./ui/camera-hud.js";
import "./ui/agent-panel.js";

// ── Constants ────────────────────────────────────────────────────────

const ENGINE_WIDTH = 800;
const ENGINE_HEIGHT = 500;

const DOMAIN_PARTICLE_COLORS: Record<string, string> = {
	engineering: "#3b82f6",
	design: "#a855f7",
	product: "#f59e0b",
	management: "#10b981",
	quality: "#ef4444",
	operations: "#06b6d4",
};

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

	const particlePool = new ParticlePool(200);
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
	const cycleConversationCounts = new Map<string, number>();
	let prevCycleCount = 0;

	// ── Environmental objects ────────────────────────────
	const coffeeMachine = new CoffeeMachine();
	coffeeMachine.pos = ex.vec(680, 120);
	const whiteboard = new WhiteboardActor();
	whiteboard.pos = ex.vec(400, 60);
	const snackTable = new SnackTable();
	snackTable.pos = ex.vec(400, 380);
	const waterCooler = new WaterCooler();
	waterCooler.pos = ex.vec(600, 380);
	const couch = new CouchActor();
	couch.pos = ex.vec(400, 380);
	const plant = new PlantActor();
	plant.pos = ex.vec(100, 60);
	const noticeBoard = new NoticeBoard();
	noticeBoard.pos = ex.vec(680, 60);

	// Wire DayClock phase changes to store + scheduler
	dayClock.onPhaseChange((phase) => {
		store.setDayPhase(phase);
		store.setWeatherState(worldAmbience.getWeather());
		worldEventScheduler.onPhaseChange(phase);
	});

	// ── Micro-event handlers ─────────────────────────────
	worldEventScheduler.registerHandler("standup", () => {
		const agents = needsSystem.getAgentNames();
		for (const name of agents) {
			const state = brainSystem.getState(name)?.state;
			if (state === "idle" || state === "wandering") brainSystem.applyEvent(name, "speaking");
		}
		agents.forEach((name, i) => {
			setTimeout(() => {
				bubbleSystem.showBubble(name, "thought", "Status update...", engine.currentScene, findAgentActor, 3000);
			}, i * 2000);
		});
		setTimeout(() => {
			for (const name of agents) brainSystem.applyEvent(name, "idle");
		}, agents.length * 2000 + 2000);
	});

	worldEventScheduler.registerHandler("deploy-success", () => {
		const agents = needsSystem.getAgentNames();
		const celebrant = agents[Math.floor(Math.random() * agents.length)];
		if (celebrant) {
			bubbleSystem.showBubble(celebrant, "speech", "Deploy is green! Ship it!", engine.currentScene, findAgentActor, 4000);
			const actor = findAgentActor(celebrant);
			if (actor) particlePool.spawnPreset("confetti", actor.pos.x, actor.pos.y - 20);
			needsSystem.applyEffect(celebrant, { morale: 5 });
		}
	});

	worldEventScheduler.registerHandler("tea-time", () => {
		const idle = needsSystem.getAgentNames().filter((n) => brainSystem.getState(n)?.state === "idle");
		for (const name of idle.slice(0, 3)) {
			brainSystem.walkTo(name, coffeeMachine.getInteractionPoint());
		}
	});

	worldEventScheduler.registerHandler("end-of-day", () => {
		for (const name of needsSystem.getAgentNames()) {
			bubbleSystem.showBubble(name, "thought", "Wrapping up for the day...", engine.currentScene, findAgentActor, 3000);
		}
	});

	worldEventScheduler.registerHandler("eureka", () => {
		const working = needsSystem.getAgentNames().filter((n) => brainSystem.getState(n)?.state === "working");
		if (working.length > 0) {
			const agent = working[Math.floor(Math.random() * working.length)];
			bubbleSystem.showBubble(agent, "speech", "Wait... I've got it!", engine.currentScene, findAgentActor, 4000);
			const actor = findAgentActor(agent);
			if (actor) particlePool.spawnPreset("sparkle", actor.pos.x, actor.pos.y - 20);
			needsSystem.applyEffect(agent, { morale: 8, focus: 5 });
		}
	});

	worldEventScheduler.registerHandler("build-break", () => {
		for (const name of needsSystem.getAgentNames()) {
			bubbleSystem.showBubble(name, "thought", "Uh oh...", engine.currentScene, findAgentActor, 2000);
			needsSystem.applyEffect(name, { morale: -3 });
		}
		particlePool.spawnPreset("alert", 400, 250);
		setTimeout(() => {
			const resolver = needsSystem.getAgentNames()[0];
			if (resolver) bubbleSystem.showBubble(resolver, "speech", "Fixed it. We're back.", engine.currentScene, findAgentActor, 4000);
		}, 10_000);
	});

	worldEventScheduler.registerHandler("birthday", () => {
		const agents = needsSystem.getAgentNames();
		const birthdayAgent = agents[Math.floor(Math.random() * agents.length)];
		if (birthdayAgent) {
			bubbleSystem.showBubble(birthdayAgent, "speech", "Wait, is that cake?!", engine.currentScene, findAgentActor, 4000);
			particlePool.spawnPreset("confetti", snackTable.pos.x, snackTable.pos.y - 20);
			for (const name of agents) needsSystem.applyEffect(name, { morale: 3 });
		}
	});

	worldEventScheduler.registerHandler("power-flicker", () => {
		for (const name of needsSystem.getAgentNames()) {
			bubbleSystem.showBubble(name, "thought", "?", engine.currentScene, findAgentActor, 1500);
		}
		setTimeout(() => {
			const ops = needsSystem.getAgentNames()[0];
			if (ops) bubbleSystem.showBubble(ops, "speech", "Just a blip. All good.", engine.currentScene, findAgentActor, 3000);
		}, 2000);
	});

	worldEventScheduler.registerHandler("new-pr", () => {
		const agents = needsSystem.getAgentNames();
		const author = agents[Math.floor(Math.random() * agents.length)];
		if (author) {
			brainSystem.walkTo(author, whiteboard.getInteractionPoint());
			setTimeout(() => {
				bubbleSystem.showBubble(author, "thought", "New PR ready for review", engine.currentScene, findAgentActor, 3000);
				particlePool.spawnPreset("scribble", whiteboard.pos.x, whiteboard.pos.y);
			}, 3000);
		}
	});

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
			setTimeout(() => void store.wakeAgent(agentName), 600);
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

	/** Find the position of the closest agent to `agentName` (for seek-agent threshold). */
	function findNearestAgent(agentName: string): { x: number; y: number } | null {
		const pos = brainSystem.getPosition(agentName);
		if (!pos) return null;
		let closest: { x: number; y: number } | null = null;
		let minDist = Infinity;
		for (const [name, entry] of brainSystem.getAllEntries()) {
			if (name === agentName) continue;
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
			knownEntities.add(agent.name);
		}
	}

	// ── Wire provider action events ─────────────────────
	// Dedup guard: SSE + EventBus can relay the same action twice
	const recentActionIds = new Set<string>();
	provider.onAction((action: AgentAction) => {
		try {
		if (action.id && recentActionIds.has(action.id)) return;
		if (action.id) {
			recentActionIds.add(action.id);
			setTimeout(() => recentActionIds.delete(action.id), 5000);
		}

		// Transition brain state
		brainSystem.applyEvent(action.agentName, action.type);

		// Silence talk engine and hide lightbulb when LLM responds
		if (action.type === "speaking" || action.type === "asking") {
			talkEngine.silence(action.agentName);
			const actor = findAgentActor(action.agentName);
			if (actor) actor.hideLlmIndicator();
		}

		// Show bubble for certain actions
		if (action.type === "speaking" || action.type === "asking") {
			const rawText = typeof action.data["text"] === "string" ? action.data["text"] : "...";
			const text = extractAgentMessage(rawText);
			const bubbleKind = action.type === "asking" ? "question" : "speech";
			const currentScene = engine.currentScene;
			bubbleSystem.showBubble(action.agentName, bubbleKind, text, currentScene, findAgentActor);
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
		} catch (err) {
			console.warn("[game] Error handling action:", action.type, action.agentName, err);
		}
	});

	// ── Wire provider connection status ─────────────────
	provider.onConnectionStatus((status) => {
		hubScene.updateConnectionStatus(status);
		store.setConnectionStatus(status);
	});

	// ── Wire provider entity updates (add / change) ─────
	provider.onEntityUpdate((entity: WorldEntity) => {
		if (entity.type !== "agent") return;

		if (!knownEntities.has(entity.id)) {
			// New agent entity — spawn into game
			if (store.agents.find((a) => a.name === entity.id)) return;

			const agentData: DashboardAgent = {
				name: entity.id,
				agentType: "ai",
				status: ((entity.components["status"] as string) ?? "idle") as DashboardAgent["status"],
				domain: entity.components["domain"] as string | undefined,
			};
			const setting = resolveSettingForDomain(agentData.domain);
			if (setting !== "hub" && roomScenes[setting]) {
				roomScenes[setting].spawnAgent(agentData);
			}
			store.setAgents([...store.agents, agentData]);
			hubScene.updateAgents([...store.agents]);
			brainSystem.register(agentData.name, {}, undefined, agentData.domain);
			knownEntities.add(entity.id);
			bubbleSystem.showBubble(entity.id, "speech", "Hello! I just arrived.", engine.currentScene, findAgentActor, 3000);
		} else {
			// Existing agent entity changed — only react if state actually changed
			const statusComp = entity.components["status"];
			if (typeof statusComp === "object" && statusComp !== null && "state" in statusComp) {
				const newState = (statusComp as { state: string }).state;
				const currentState = brainSystem.getState(entity.id)?.state;
				if (newState !== currentState) {
					brainSystem.applyEvent(entity.id, newState as AgentAction["type"]);
				}
			}
		}
	});

	// ── Wire emote callback ─────────────────────────────
	emoteSystem.onEmote((name, _emoteIndex) => {
		const actor = findAgentActor(name);
		if (!actor) return;
		const agent = store.agents.find((a) => a.name === name);
		const moodTexts: Record<string, string[]> = {
			happy: [
				"\u{1F60A} Life is good.", "\u{2728} Feeling great!", "\u{1F389} Yes!",
				"\u{1F31F} What a day!", "\u{1F44D} Love it.", "\u{1F60E} Smooth sailing.",
				"\u{1F496} Grateful for this team.", "\u{1F3B5} Humming along.",
			],
			enthusiastic: [
				"\u{1F525} Let's go!", "\u{1F680} Launching!", "\u{1F4AA} Pumped!",
				"\u{26A1} Energy!", "\u{1F3AF} Locked in!", "\u{1F4A5} Boom!",
			],
			frustrated: [
				"\u{1F914} Hmm...", "\u{1F615} This is tricky.", "\u{1F62E}\u200D\u{1F4A8} Come on...",
				"\u{1F9D0} Let me look at this differently.", "\u{1F616} Stuck for a moment.",
				"\u{1F612} Not clicking yet.", "\u{1F4AD} There's gotta be a way...",
			],
			focused: [
				"\u{1F9D0} Deep in thought...", "\u{1F3AF} Concentrating...", "\u{1F4A1} Almost got it.",
				"\u{1F52C} Zooming in.", "\u{1F9E0} Brain at full capacity.", "\u{1F4DD} Taking notes.",
				"\u{23F3} Just need a bit more time.", "\u{1F50D} Investigating.",
			],
			neutral: [
				"\u{1F4AD} ...", "\u{1F914} Hmm.", "\u{2615} Sip.",
				"\u{1F440} Looking around.", "\u{1F6B6} Just vibing.", "\u{1F324}\uFE0F Nice day.",
			],
			contemplative: [
				"\u{1F30C} Big picture thinking.", "\u{1F4AD} What if...", "\u{1F52D} Seeing patterns.",
				"\u{1F9D8} Reflecting.", "\u{1F31F} There's something here.",
			],
			empathetic: [
				"\u{1F49B} I understand.", "\u{1F917} How are you?", "\u{1F64F} I appreciate you.",
				"\u{1F4AC} Tell me more.", "\u{1F91D} We're in this together.",
				"\u{2764}\uFE0F The team matters.", "\u{1F60C} Take your time.",
			],
			inspired: [
				"\u{1F4A1} I have an idea!", "\u{2728} What if...", "\u{1F680} This could be big!",
				"\u{1F31F} Eureka moment.", "\u{1F525} The spark is there!",
				"\u{1F3A8} Creative juices flowing.", "\u{1F4AB} Breakthrough incoming.",
			],
			aesthetic: [
				"\u{2728} Beautiful.", "\u{1F3A8} So elegant.", "\u{1F308} Harmony.",
				"\u{1F338} Clean and refined.", "\u{1F5BC}\uFE0F Art.", "\u{1F48E} Polished.",
			],
			playful: [
				"\u{1F604} Hehe.", "\u{1F389} Fun times!", "\u{1F60E} Cool cool cool.",
				"\u{1F3AE} Game on.", "\u{1F938} Plot twist!", "\u{1F47E} Beep boop.",
				"\u{1F609} You know it.", "\u{1F942} Cheers!",
			],
			skeptical: [
				"\u{1F928} Really though?", "\u{1F9D0} Let me verify.", "\u{1F914} Show me the data.",
				"\u{1F50D} Prove it.", "\u{1F4CA} Numbers don't lie.", "\u{2753} But why?",
			],
		};
		const mood = agent?.mood ?? "neutral";
		const texts = moodTexts[mood] ?? moodTexts["neutral"]!;
		const text = texts[Math.floor(Math.random() * texts.length)];
		bubbleSystem.showBubble(name, "thought", text, engine.currentScene, findAgentActor, 2500);
	});

	// ── Wire social conversation callback ────────────────
	const SOCIAL_EMOJIS = [
		"\u{1F44B}", "\u{1F60A}", "\u{1F4AC}", "\u{2728}", "\u{1F91D}", "\u{1F4A1}", "\u{1F44D}", "\u{1F914}",
		"\u{1F60E}", "\u{1F525}", "\u{1F389}", "\u{1F64C}", "\u{1F4AA}", "\u{1F942}", "\u{2615}", "\u{1F31F}",
		"\u{1F44F}", "\u{1F60D}", "\u{1F929}", "\u{1F4AF}", "\u{1F680}", "\u{1F3AF}", "\u{2764}\uFE0F", "\u{1F917}",
	];
	const REACTION_EMOJIS = ["\u{1F44D}", "\u{1F60A}", "\u{2728}", "\u{1F4AF}", "\u{1F44F}", "\u{1F64C}", "\u{2764}\uFE0F", "\u{1F525}"];
	const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

	socialSystem.onConversation((nameA, nameB, lineA, lineB) => {
		// Track conversations for memory streaks
		cycleConversationCounts.set(nameA, (cycleConversationCounts.get(nameA) ?? 0) + 1);
		cycleConversationCounts.set(nameB, (cycleConversationCounts.get(nameB) ?? 0) + 1);
		brainSystem.applyEvent(nameA, "speaking");
		brainSystem.applyEvent(nameB, "speaking");

		// Face each other
		const actorA = findAgentActor(nameA);
		const actorB = findAgentActor(nameB);
		if (actorA) actorA.focus();
		if (actorB) actorB.focus();

		// Agent A speaks first
		bubbleSystem.showBubble(nameA, "speech", lineA, engine.currentScene, findAgentActor, 4000);

		// Agent B responds with delay + occasional emoji
		const bDelay = 1000 + Math.random() * 800;
		setTimeout(() => {
			const prefix = Math.random() < 0.5 ? `${pick(SOCIAL_EMOJIS)} ` : "";
			bubbleSystem.showBubble(nameB, "speech", `${prefix}${lineB}`, engine.currentScene, findAgentActor, 4000);
		}, bDelay);

		// 50% chance: Agent A reacts with an emoji thought bubble
		if (Math.random() < 0.5) {
			setTimeout(() => {
				bubbleSystem.showBubble(nameA, "thought", pick(REACTION_EMOJIS), engine.currentScene, findAgentActor, 2000);
			}, bDelay + 1500 + Math.random() * 1000);
		}

		// 30% chance: One more exchange (A or B adds a follow-up)
		if (Math.random() < 0.3) {
			const follower = Math.random() < 0.5 ? nameA : nameB;
			const followUps = [
				"Totally.", "Right?", "Exactly.", "Ha, yeah.", "For sure.",
				"Good point.", "Agreed.", "Makes sense.", "Love that.",
				"Same here.", "You said it.", "100%.", "Can't argue with that.",
			];
			setTimeout(() => {
				bubbleSystem.showBubble(follower, "speech", pick(followUps), engine.currentScene, findAgentActor, 2500);
			}, bDelay + 2500 + Math.random() * 1000);
		}

		setTimeout(() => {
			brainSystem.applyEvent(nameA, "idle");
			brainSystem.applyEvent(nameB, "idle");
		}, 6000 + Math.random() * 2000);
	});

	// ── Wire cluster huddle conversations ────────────────
	socialSystem.onCluster((members) => {
		const speakCount = Math.min(members.length, 3);
		const lines = members.slice(0, speakCount).map(() => {
			const template = HUDDLE_TEMPLATES[Math.floor(Math.random() * HUDDLE_TEMPLATES.length)];
			return template.text;
		});

		members.slice(0, speakCount).forEach((name, i) => {
			const agent = store.agents.find((a) => a.name === name);
			const domain = agent?.domain ?? "general";
			const mood = needsSystem.getMood(name);
			const moodAdj = mood === "neutral" ? "optimistic" : mood;
			const text = interpolateTemplate(lines[i], { domain, mood_adj: moodAdj });

			brainSystem.applyEvent(name, "speaking");
			setTimeout(() => {
				bubbleSystem.showBubble(name, "speech", text, engine.currentScene, findAgentActor, 4000);
			}, i * 1500);
		});

		setTimeout(() => {
			for (const name of members) brainSystem.applyEvent(name, "idle");
		}, speakCount * 1500 + 3000);
	});

	// ── Wire sensor reactions → bubble + needs ──────────
	sensorSystem.onReaction((reaction) => {
		if (reaction.bubble) {
			bubbleSystem.showBubble(reaction.agentName, reaction.bubble.kind, reaction.bubble.text, engine.currentScene, findAgentActor, 5000, true);
		}
		if (reaction.needsEffect) {
			needsSystem.applyEffect(reaction.agentName, reaction.needsEffect);
		}
	});

	// ── Wire engagement → walk toward camera + bubble ───
	engagementSystem.onEngagement((e) => {
		if (e.tier >= 2) {
			const cam = engine.currentScene.camera;
			brainSystem.walkTo(e.agentName, { x: cam.pos.x - 50, y: cam.pos.y });
		}
		bubbleSystem.showBubble(e.agentName, e.bubbleKind, e.text, engine.currentScene, findAgentActor, 5000, true);
	});

	// ── Wire ritual phases → brain + bubble + needs ─────
	ritualSystem.onPhase((phase) => {
		if (phase.kind === "gather") {
			for (const name of phase.participants) {
				brainSystem.applyEvent(name, "speaking");
			}
		}
		if (phase.kind === "line") {
			bubbleSystem.showBubble(phase.agentName, "speech", phase.text, engine.currentScene, findAgentActor, 4000, true);
		}
		if (phase.kind === "disperse") {
			for (const name of phase.participants) {
				brainSystem.applyEvent(name, "idle");
				needsSystem.applyEffect(name, { social: 8, morale: 5 });
			}
		}
	});

	// ── Wire tool results → sensor feedback + needs + bubble ──
	toolExecutor.onResult((result) => {
		const eventType = result.success ? "test-pass" : "test-fail";
		sensorSystem.pushFeedback({ type: eventType, data: { output: result.output } });
		needsSystem.applyEffect(result.agentName, { morale: result.success ? 3 : -2, energy: -5 });
		bubbleSystem.showBubble(result.agentName, "speech", result.success ? "Done! All good." : "Something went wrong...", engine.currentScene, findAgentActor, 5000, true);
	});

	// ── Pre-update loop state ───────────────────────────
	let lastTime = performance.now();
	const prevWalkingState = new Map<string, boolean>();
	const lastTrailPos = new Map<string, { x: number; y: number }>();

	// ── Particle renderer — ex.Canvas actor added to each scene ──────
	function createParticleRenderer(): ex.Actor {
		const actor = new ex.Actor({
			pos: ex.vec(0, 0),
			anchor: ex.vec(0, 0),
			z: -10,
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

	// ── Cursor spirit — visual director presence (one per scene) ────
	const cursorSpirits = [new CursorSpirit(), new CursorSpirit(), new CursorSpirit(), new CursorSpirit()];
	hubScene.add(cursorSpirits[0]);
	officeScene.add(cursorSpirits[1]);
	villageScene.add(cursorSpirits[2]);
	stationScene.add(cursorSpirits[3]);

	/** Get names of agents within social radius of `name`. */
	function getNearbyAgents(name: string): string[] {
		const pos = brainSystem.getPosition(name);
		if (!pos) return [];
		const params = brainSystem.getState(name);
		const radius = params?.params.socialRadius ?? 100;
		return [...brainSystem.getAllEntries()]
			.filter(([n]) => {
				if (n === name) return false;
				const otherPos = brainSystem.getPosition(n);
				if (!otherPos) return false;
				const dx = pos.x - otherPos.x;
				const dy = pos.y - otherPos.y;
				return Math.sqrt(dx * dx + dy * dy) < radius;
			})
			.map(([n]) => n);
	}

	/** Process behavior thresholds — needs-driven state overrides. */
	function processThresholds(): void {
		for (const agentName of needsSystem.getAgentNames()) {
			const actions = needsSystem.checkThresholds(agentName);
			for (const action of actions) {
				switch (action.type) {
					case "force-break":
						if (brainSystem.getState(agentName)?.state !== "on-break") {
							brainSystem.applyEvent(agentName, "break");
						}
						break;
					case "seek-agent": {
						const nearest = findNearestAgent(agentName);
						if (nearest) brainSystem.walkTo(agentName, nearest);
						break;
					}
					case "seek-quiet":
					case "demoralized":
						brainSystem.applyEvent(agentName, "idle");
						break;
				}
			}
		}
	}

	/** Resolve domain particle color for an agent. */
	function agentParticleColor(name: string): string {
		const agent = store.agents.find((a) => a.name === name);
		return DOMAIN_PARTICLE_COLORS[agent?.domain ?? ""] ?? "#64748b";
	}

	/** Spawn particle trails for walking agents, dust bursts on arrival. */
	function updateParticleTrails(): void {
		for (const [name, entry] of brainSystem.getAllEntries()) {
			const wasWalking = prevWalkingState.get(name) ?? false;
			const isWalking = entry.state === "wandering" || entry.state === "walking-to";

			if (isWalking) {
				const actor = findAgentActor(name);
				if (!actor) continue;
				const x = actor.pos.x;
				const y = actor.pos.y + 28;
				const prev = lastTrailPos.get(name);
				if (!prev) {
					lastTrailPos.set(name, { x, y });
					continue;
				}
				const dx = x - prev.x;
				const dy = y - prev.y;
				if (dx * dx + dy * dy >= 64) {
					particlePool.spawnTrail(x, y, agentParticleColor(name), entry.state === "walking-to");
					lastTrailPos.set(name, { x, y });
				}
			} else {
				lastTrailPos.delete(name);
				if (wasWalking) {
					const actor = findAgentActor(name);
					if (actor) particlePool.spawnDustBurst(actor.pos.x, actor.pos.y + 28, agentParticleColor(name));
				}
			}
		}
	}

	// ── Pre-frame hook: tick all systems ─────────────────
	engine.on("preframe", () => {
		const now = performance.now();
		const deltaMs = now - lastTime;
		lastTime = now;

		// 0. Day clock — advance phase
		dayClock.update(deltaMs);
		if (dayClock.getCycleCount() > prevCycleCount) {
			prevCycleCount = dayClock.getCycleCount();
			worldAmbience.onCycleComplete();
			for (const agentName of needsSystem.getAgentNames()) {
				memorySystem.onCycleEnd(agentName, {
					completedTask: store.taskLockedAgents.has(agentName),
					conversations: cycleConversationCounts.get(agentName) ?? 0,
					dominantMood: needsSystem.getMood(agentName),
				});
				cycleConversationCounts.set(agentName, 0);
			}
			worldEventScheduler.onCycleReset();
		}

		// 0b. World event scheduler — tick active events and fire queued
		worldEventScheduler.update(deltaMs);

		// 1. Sensor system — drain cooldowns, process queued feedback
		sensorSystem.update(deltaMs);

		// 2. Needs system — decay/restore all agent needs
		needsSystem.update(
			deltaMs,
			(name) => brainSystem.getState(name)?.state ?? "idle",
			getNearbyAgents,
			dayClock.getPhaseMultipliers(),
		);

		// 3. Mood propagation — push derived mood into brain + emote systems
		for (const agentName of needsSystem.getAgentNames()) {
			const mood = needsSystem.getMood(agentName);
			brainSystem.updateMood(agentName, mood);
			emoteSystem.updateMood(agentName, mood);
		}

		// 3b. Behavior thresholds — needs-driven state overrides
		processThresholds();

		// 4. Director system — advance idle timer
		directorSystem.update(deltaMs);

		// 5. Engagement system — director idle escalation
		engagementSystem.update(
			deltaMs,
			() => directorSystem.getPresence(),
			(name) => needsSystem.getNeeds(name),
			(name) => brainSystem.getState(name)?.state ?? "idle",
			(_name) => false,
		);

		// 5b. Feed workspace context to engagement system
		engagementSystem.setContext({
			agentCount: String(brainSystem.getAllEntries().size),
		});

		// Snapshot walking states before brain update
		for (const [name, entry] of brainSystem.getAllEntries()) {
			prevWalkingState.set(name, entry.state === "wandering" || entry.state === "walking-to");
		}

		// 6. Brain system — movement, state machine
		brainSystem.update(deltaMs, findAgentActor);

		// 7. Ritual system — ceremonial choreography
		ritualSystem.update(deltaMs, (name) => brainSystem.getState(name)?.state ?? "idle");

		// 8. Social system — proximity conversations (extended with needs callback)
		socialSystem.update(
			deltaMs,
			(name) => brainSystem.getPosition(name) ?? { x: 0, y: 0 },
			(name) => brainSystem.getState(name)?.state ?? "idle",
			(name) => needsSystem.getNeeds(name),
		);

		// 9. Talk engine — ambient chatter
		talkEngine.update(deltaMs);

		// 10. Emote system — mood-driven emotes
		emoteSystem.update(deltaMs, (name) => brainSystem.getState(name)?.state ?? "idle");

		// 11. Tool executor — drain cooldowns, run approved tools
		toolExecutor.update(deltaMs);

		// Particle trails
		updateParticleTrails();
		particlePool.update(deltaMs);

		// Workstation glow updates
		for (const room of Object.values(roomScenes)) {
			for (const ws of room.getWorkstations()) {
				ws.updateGlow(deltaMs);
			}
		}

		// 12. Bubble system — overhead speech/thought bubbles
		bubbleSystem.update(
			deltaMs,
			(name) => brainSystem.getState(name)?.state === "idle",
			engine.currentScene,
			findAgentActor,
		);

		if (cameraSystem) {
			cameraSystem.checkDespawn();
			cameraSystem.applyZoom(deltaMs);
			cameraSystem.updatePan(deltaMs);
		}
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

	// ── Position writer (tick-based, flushes every ~5s) ──
	const POSITION_FLUSH_INTERVAL = 5_000;
	let positionFlushTimer = 0;

	if (deps.vaultBasePath) {
		const positionsPath = join(deps.vaultBasePath, ".flowti", "var", "world-positions.json");
		const positionsDir = join(deps.vaultBasePath, ".flowti", "var");

		engine.on("postupdate", (evt) => {
			positionFlushTimer += evt.elapsed;
			if (positionFlushTimer < POSITION_FLUSH_INTERVAL) return;
			positionFlushTimer = 0;

			const positions: Record<string, { x: number; y: number; scene: string; state: string }> = {};
			for (const [name, entry] of brainSystem.getAllEntries()) {
				positions[name] = {
					x: Math.round(entry.position.x),
					y: Math.round(entry.position.y),
					scene: store.currentScene,
					state: entry.state,
				};
			}

			try {
				if (!existsSync(positionsDir)) mkdirSync(positionsDir, { recursive: true });
				writeFileSync(positionsPath, JSON.stringify({ updatedAt: new Date().toISOString(), positions }, null, "\t"), "utf-8");
			} catch {
				// Non-critical — skip silently
			}
		});
	}

	// ── Store event listeners for engine-side effects ────
	store.addEventListener("scene-change", ((e: CustomEvent) => {
		sceneConfig.onSceneChange(e.detail.setting);
	}) as EventListener);

	store.addEventListener("agent-message-sent", ((e: CustomEvent) => {
		const { agentName } = e.detail;
		// Activate rapid chatter while waiting for LLM
		talkEngine.activate(agentName);
		// Show lightbulb indicator
		const actor = findAgentActor(agentName);
		if (actor) {
			actor.showLlmIndicator();
			const signal = directorSystem.recordInteraction("message", { x: actor.pos.x, y: actor.pos.y });
			if (signal.moraleEffect) needsSystem.applyEffect(agentName, { morale: signal.moraleEffect });
		}
	}) as EventListener);

	store.addEventListener("agent-response-received", ((e: CustomEvent) => {
		const { agentName, text, type } = e.detail;
		// Silence talk engine + hide lightbulb
		talkEngine.silence(agentName);
		const actor = findAgentActor(agentName);
		if (actor) actor.hideLlmIndicator();
		// Show bubble
		const bubbleKind = type === "asking" ? "question" : "speech";
		bubbleSystem.showBubble(agentName, bubbleKind, text, engine.currentScene, findAgentActor);
	}) as EventListener);

	store.addEventListener("task-assigned", ((e: CustomEvent) => {
		const { agentName, task } = e.detail;
		brainSystem.applyEvent(agentName, "task-started");
		brainSystem.assignWork(agentName);
		store.taskLockedAgents.add(agentName);
		talkEngine.activate(agentName);
		bubbleSystem.showBubble(agentName, "thought", `Starting: ${task}`, engine.currentScene, findAgentActor);
		// Show lightbulb — agent is working on the task
		const actor = findAgentActor(agentName);
		if (actor) actor.showLlmIndicator();
	}) as EventListener);

	store.addEventListener("task-completed", ((e: CustomEvent) => {
		const { agentName, result } = e.detail;
		brainSystem.releaseWork(agentName);
		store.taskLockedAgents.delete(agentName);
		talkEngine.silence(agentName);
		engagementSystem.markTaskCompleted(agentName);
		const actor = findAgentActor(agentName);
		if (actor) { actor.hideLlmIndicator(); actor.hideToolIndicator(); }
		// Show completion bubble
		bubbleSystem.showBubble(agentName, "speech", typeof result === "string" ? result.slice(0, 80) : "Task complete.", engine.currentScene, findAgentActor, 5000);
	}) as EventListener);

	// ── Permission decision → director signal + morale ──
	store.addEventListener("permission-decided", ((e: CustomEvent) => {
		const { agentName, signalType } = e.detail;
		const signal = directorSystem.recordInteraction(signalType);
		if (signal.moraleEffect) needsSystem.applyEffect(agentName, { morale: signal.moraleEffect });
	}) as EventListener);

	// ── Tool usage indicators ──────────────────────────
	store.addEventListener("agent-using-tool", ((e: CustomEvent) => {
		const actor = findAgentActor(e.detail.agentName);
		if (actor) actor.showToolIndicator();
	}) as EventListener);

	store.addEventListener("agent-tool-complete", ((e: CustomEvent) => {
		const actor = findAgentActor(e.detail.agentName);
		if (actor) actor.hideToolIndicator();
	}) as EventListener);

	// ── Camera follow via store state ───────────────────
	let prevFollowed: string | null = null;
	store.addEventListener("state-changed", () => {
		if (store.followedAgent !== prevFollowed) {
			prevFollowed = store.followedAgent;
			if (store.followedAgent) {
				const actor = findAgentActor(store.followedAgent);
				if (actor && cameraSystem) cameraSystem.startFollow(actor);
			} else {
				if (cameraSystem) cameraSystem.stopFollow();
			}
		}
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
			if (deps.vaultBasePath) {
				try {
					const varDir = join(deps.vaultBasePath, ".flowti", "var");
					const clockPath = join(varDir, "world-clock.json");
					const weatherPath = join(varDir, "world-weather.json");
					const memoryPath = join(varDir, "world-memory.json");
					if (existsSync(clockPath)) dayClock.restore(JSON.parse(readFileSync(clockPath, "utf-8")));
					if (existsSync(weatherPath)) worldAmbience.restore(JSON.parse(readFileSync(weatherPath, "utf-8")));
					if (existsSync(memoryPath)) memorySystem.restore(JSON.parse(readFileSync(memoryPath, "utf-8")));
				} catch { /* non-critical — start fresh */ }
			}
			prevCycleCount = dayClock.getCycleCount();

			// Start data provider and load initial data
			await provider.start();

			const initialAgents = await provider.getDashboardAgents();
			registerAgents(initialAgents);

			// Route agents to room scenes by domain
			for (const agent of initialAgents) {
				const setting = resolveSettingForDomain(agent.domain);
				if (setting !== "hub" && roomScenes[setting]) {
					roomScenes[setting].spawnAgent(agent);
				}
			}

			// Fetch initial world state for activity log
			const worldState = await provider.getWorldState();
			if (worldState?.activityLog) {
				store.setActivityLog(worldState.activityLog);
			}

			// FitContainer mode handles resize automatically — no manual
			// ResizeObserver needed. ExcaliburJS listens for window resize
			// and recalculates the viewport based on the parent container.
		},

		pause(): void {
			engine.stop();
		},

		resume(): void {
			void engine.start();
		},

		dispose(): void {
			// Flush persistent state before shutdown
			if (deps.vaultBasePath) {
				try {
					const varDir = join(deps.vaultBasePath, ".flowti", "var");
					if (!existsSync(varDir)) mkdirSync(varDir, { recursive: true });
					writeFileSync(join(varDir, "world-clock.json"), JSON.stringify(dayClock.serialize(), null, "\t"), "utf-8");
					writeFileSync(join(varDir, "world-weather.json"), JSON.stringify(worldAmbience.serialize(), null, "\t"), "utf-8");
					writeFileSync(join(varDir, "world-memory.json"), JSON.stringify(memorySystem.serialize(), null, "\t"), "utf-8");
				} catch { /* non-critical — skip silently */ }
			}
			engine.stop();
			engine.dispose();
			provider.stop();
			document.removeEventListener("keydown", keydownHandler);
			document.removeEventListener("keyup", keyupHandler);
		},
	};
}
