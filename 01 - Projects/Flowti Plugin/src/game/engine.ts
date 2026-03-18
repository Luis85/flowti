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
import type { DataProvider } from "./config/data-provider.js";

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
	const store = new DashboardStore("");

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
			bubbleSystem.showBubble(agentName, kind, text, engine.currentScene, findAgentActor, 5000);
		},
		isIdle: (name) => brainSystem.getState(name)?.state === "idle",
	});

	const particlePool = new ParticlePool(200);
	const emoteSystem = new EmoteSystem();
	const socialSystem = new SocialSystem();

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
				// Stop the agent immediately and face the user
				brainSystem.freeze(agentName);
				actor.focus();
				void engine.currentScene.camera.move(actor.pos, 300, ex.EasingFunctions.EaseInOutCubic);
			}
			store.selectAgent(agentName);
			store.selectTab("info");
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
				relationships: agent.relationships ?? [],
			});
			knownEntities.add(agent.name);
		}
	}

	// ── Wire provider action events ─────────────────────
	provider.onAction((action: AgentAction) => {
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
			// Existing agent entity changed — apply state update
			const statusComp = entity.components["status"];
			if (typeof statusComp === "object" && statusComp !== null && "state" in statusComp) {
				const state = (statusComp as { state: string }).state;
				brainSystem.applyEvent(entity.id, state as AgentAction["type"]);
				bubbleSystem.showBubble(entity.id, "speech", `I'm now ${state}!`, engine.currentScene, findAgentActor, 3000);
			}
		}
	});

	// ── Wire emote callback ─────────────────────────────
	emoteSystem.onEmote((name, _emoteIndex) => {
		const actor = findAgentActor(name);
		if (!actor) return;
		const agent = store.agents.find((a) => a.name === name);
		const moodTexts: Record<string, string[]> = {
			happy: ["Life is good.", "Feeling great!"],
			frustrated: ["Hmm...", "This is tricky."],
			focused: ["Deep in thought...", "Concentrating..."],
			neutral: ["...", "Hmm."],
			empathetic: ["I understand.", "How are you?"],
			inspired: ["I have an idea!", "What if..."],
			aesthetic: ["Beautiful.", "So elegant."],
			playful: ["Hehe.", "Fun times!"],
		};
		const mood = agent?.mood ?? "neutral";
		const texts = moodTexts[mood] ?? moodTexts["neutral"]!;
		const text = texts[Math.floor(Math.random() * texts.length)];
		bubbleSystem.showBubble(name, "thought", text, engine.currentScene, findAgentActor, 2500);
	});

	// ── Wire social conversation callback ────────────────
	socialSystem.onConversation((nameA, nameB, lineA, lineB) => {
		brainSystem.applyEvent(nameA, "speaking");
		brainSystem.applyEvent(nameB, "speaking");
		bubbleSystem.showBubble(nameA, "speech", lineA, engine.currentScene, findAgentActor, 4000);
		setTimeout(() => {
			bubbleSystem.showBubble(nameB, "speech", lineB, engine.currentScene, findAgentActor, 4000);
		}, 800);
		setTimeout(() => {
			brainSystem.applyEvent(nameA, "idle");
			brainSystem.applyEvent(nameB, "idle");
		}, 5000);
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

	// ── Pre-frame hook: tick all systems ─────────────────
	engine.on("preframe", () => {
		const now = performance.now();
		const deltaMs = now - lastTime;
		lastTime = now;

		// Snapshot walking states before brain update
		for (const [name, entry] of brainSystem.getAllEntries()) {
			prevWalkingState.set(name, entry.state === "wandering" || entry.state === "walking-to");
		}

		brainSystem.update(deltaMs, findAgentActor);

		// Particle trails: spawn trail dots every ~8px of movement, dust on arrival
		for (const [name, entry] of brainSystem.getAllEntries()) {
			const wasWalking = prevWalkingState.get(name) ?? false;
			const isWalking = entry.state === "wandering" || entry.state === "walking-to";

			if (isWalking) {
				const actor = findAgentActor(name);
				if (actor) {
					const prev = lastTrailPos.get(name);
					const x = actor.pos.x;
					const y = actor.pos.y + 28;
					if (prev) {
						const dx = x - prev.x;
						const dy = y - prev.y;
						if (dx * dx + dy * dy >= 64) { // 8px^2
							const agent = store.agents.find((a) => a.name === name);
							const color = DOMAIN_PARTICLE_COLORS[agent?.domain ?? ""] ?? "#64748b";
							particlePool.spawnTrail(x, y, color, entry.state === "walking-to");
							lastTrailPos.set(name, { x, y });
						}
					} else {
						lastTrailPos.set(name, { x, y });
					}
				}
			} else {
				lastTrailPos.delete(name);
				if (wasWalking) {
					// Just arrived — dust burst
					const actor = findAgentActor(name);
					if (actor) {
						const agent = store.agents.find((a) => a.name === name);
						const color = DOMAIN_PARTICLE_COLORS[agent?.domain ?? ""] ?? "#64748b";
						particlePool.spawnDustBurst(actor.pos.x, actor.pos.y + 28, color);
					}
				}
			}
		}

		particlePool.update(deltaMs);

		// Emote system
		emoteSystem.update(deltaMs, (name) => brainSystem.getState(name)?.state ?? "idle");

		// Social system
		socialSystem.update(
			deltaMs,
			(name) => brainSystem.getPosition(name) ?? { x: 0, y: 0 },
			(name) => brainSystem.getState(name)?.state ?? "idle",
		);

		// Workstation glow updates
		for (const room of Object.values(roomScenes)) {
			for (const ws of room.getWorkstations()) {
				ws.updateGlow(deltaMs);
			}
		}

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
				if (actor && cameraSystem) cameraSystem.startFollow(actor);
			} else {
				if (cameraSystem) cameraSystem.stopFollow();
			}
		}
	});

	// ── Keyboard handling ───────────────────────────────

	function isTyping(): boolean {
		const el = document.activeElement;
		if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return true;
		const inner = el?.shadowRoot?.activeElement;
		return inner instanceof HTMLInputElement || inner instanceof HTMLTextAreaElement;
	}

	container.setAttribute("tabindex", "0");

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

	container.addEventListener("keydown", keydownHandler);
	container.addEventListener("keyup", keyupHandler);

	// ── ResizeObserver (connected during start) ─────────
	let resizeObserver: ResizeObserver | null = null;

	// ── Lifecycle handle ────────────────────────────────

	return {
		async start(): Promise<void> {
			// Inject pixel-art font link if not already present
			if (!document.querySelector('link[href*="Press+Start+2P"]')) {
				const fontLink = document.createElement("link");
				fontLink.rel = "stylesheet";
				fontLink.href = "https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap";
				document.head.appendChild(fontLink);
			}

			// Start engine and navigate to hub
			await engine.start();
			engine.goToScene("hub");

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

			// Observe container resizes
			resizeObserver = new ResizeObserver(() => {
				const rect = container.getBoundingClientRect();
				engine.screen.viewport = { width: rect.width, height: rect.height };
			});
			resizeObserver.observe(container);
		},

		pause(): void {
			engine.stop();
		},

		resume(): void {
			engine.start();
		},

		dispose(): void {
			engine.stop();
			engine.dispose();
			provider.stop();
			if (resizeObserver) {
				resizeObserver.disconnect();
				resizeObserver = null;
			}
			container.removeEventListener("keydown", keydownHandler);
			container.removeEventListener("keyup", keyupHandler);
		},
	};
}
