import { describe, it, expect, vi, beforeEach } from "vitest";
import {
	tickSimulation,
	tickClock,
	tickSensor,
	tickNeeds,
	tickReactiveTriggers,
	tickBehaviorThresholds,
	tickPets,
	tickRoomTransit,
	tickBehaviorTree,
	tickBrain,
	tickSocial,
	tickDirector,
	tickVisuals,
	getNearbyAgents,
} from "../../src/game/engine-simulation.js";
import type { EngineContext } from "../../src/game/engine-types.js";
import type { BTAgentObject } from "../../src/game/brain/behavior-tree/bt-agent.js";

// ── Helpers ──────────────────────────────────────────────────────────

function createMockContext(): EngineContext {
	const brainEntries = new Map([
		["alice", {
			state: "idle",
			position: { x: 100, y: 100 },
			targetPos: null,
			params: { socialRadius: 100, quoteFrequency: 0.5 },
		}],
		["bob", {
			state: "wandering",
			position: { x: 200, y: 200 },
			targetPos: null,
			params: { socialRadius: 100, quoteFrequency: 0.5 },
		}],
	]);

	return {
		engine: {
			currentScene: {
				camera: { pos: { x: 400, y: 250 } },
			},
		},
		provider: {},
		store: {
			agents: [
				{ name: "alice", domain: "engineering", mood: "happy" },
				{ name: "bob", domain: "design", mood: "neutral" },
			],
			taskLockedAgents: new Set<string>(),
			setDayProgress: vi.fn(),
			setDayPhase: vi.fn(),
			pushWorldEvent: vi.fn(),
		},
		systems: {
			brain: {
				getState: vi.fn((name: string) => brainEntries.get(name)),
				getPosition: vi.fn((name: string) => brainEntries.get(name)?.position),
				getAllEntries: vi.fn(() => brainEntries),
				update: vi.fn(),
				updateMood: vi.fn(),
				applyEvent: vi.fn(),
				walkTo: vi.fn(),
				assignWork: vi.fn(),
				releaseWork: vi.fn(),
			},
			bubble: {
				showBubble: vi.fn(),
				update: vi.fn(),
			},
			talk: {
				update: vi.fn(),
				updateVars: vi.fn(),
				triggerReactive: vi.fn(),
			},
			particlePool: {
				update: vi.fn(),
				spawn: vi.fn(),
				spawnTrail: vi.fn(),
				spawnDustBurst: vi.fn(),
				spawnPreset: vi.fn(),
			},
			emote: {
				update: vi.fn(),
				updateMood: vi.fn(),
			},
			social: {
				update: vi.fn(),
			},
			needs: {
				getAgentNames: vi.fn(() => ["alice", "bob"]),
				update: vi.fn(),
				getNeeds: vi.fn(() => ({ energy: 50, social: 50, focus: 50, morale: 50 })),
				getMood: vi.fn(() => "neutral"),
				applyEffect: vi.fn(),
				checkThresholds: vi.fn(() => []),
			},
			director: {
				update: vi.fn(),
				getPresence: vi.fn(() => ({ idleMs: 0, present: true })),
			},
			sensor: {
				update: vi.fn(),
			},
			engagement: {
				update: vi.fn(),
				setContext: vi.fn(),
			},
			ritual: {
				update: vi.fn(),
			},
			tool: {
				update: vi.fn(),
			},
			dayClock: {
				update: vi.fn(),
				getCycleProgress: vi.fn(() => 0.5),
				getCycleCount: vi.fn(() => 0),
				getPhase: vi.fn(() => "morning"),
				getPhaseMultipliers: vi.fn(() => ({})),
			},
			worldAmbience: {
				onCycleComplete: vi.fn(),
				getWeather: vi.fn(() => "clear"),
				getWeatherVisuals: vi.fn(() => ({ particleCount: 0, particleAngle: 0, particleSpeed: 0, particleColor: "#fff" })),
				getLighting: vi.fn(() => ({ r: 0, g: 0, b: 0, opacity: 0 })),
			},
			worldEvent: {
				update: vi.fn(),
				onCycleReset: vi.fn(),
			},
			memory: {
				onCycleEnd: vi.fn(),
				getMemory: vi.fn(() => ({ workStreak: 0, quirks: [], opinions: [] })),
			},
			quirk: { hasQuirk: vi.fn(() => false) },
			relationship: {
				onCycleEnd: vi.fn(),
			},
			bt: {
				getAgent: vi.fn(() => null),
				update: vi.fn(() => []),
			},
			registry: {
				getEntityRoom: vi.fn(() => "office"),
				isInTransit: vi.fn(() => false),
			},
			roomSwitcher: {
				update: vi.fn(),
			},
			cameraSystem: null,
		},
		scenes: {
			hub: {},
			office: {},
			village: {},
			station: {},
			map: {
				office: { getWorkstations: vi.fn(() => []) },
				village: { getWorkstations: vi.fn(() => []) },
				station: { getWorkstations: vi.fn(() => []) },
			},
		},
		envObjects: {
			coffeeMachine: {
				pos: { x: 680, y: 120 },
				objectType: "appliance",
				isOccupied: vi.fn(() => false),
				getOccupant: vi.fn(() => null),
				getInteractionPoint: vi.fn(() => ({ x: 680, y: 140 })),
				occupy: vi.fn(),
				vacate: vi.fn(),
				getNeedsEffects: vi.fn(() => ({ energy: 10 })),
			},
			whiteboard: { pos: { x: 400, y: 60 }, objectType: "furniture" },
			snackTable: {
				pos: { x: 400, y: 380 },
				objectType: "furniture",
				isOccupied: vi.fn(() => false),
				getOccupant: vi.fn(() => null),
				getInteractionPoint: vi.fn(() => ({ x: 400, y: 400 })),
				occupy: vi.fn(),
				vacate: vi.fn(),
				getNeedsEffects: vi.fn(() => ({ energy: 5 })),
			},
			waterCooler: {
				pos: { x: 600, y: 380 },
				objectType: "appliance",
				isOccupied: vi.fn(() => false),
				getOccupant: vi.fn(() => null),
				getInteractionPoint: vi.fn(() => ({ x: 600, y: 400 })),
				occupy: vi.fn(),
				vacate: vi.fn(),
				getNeedsEffects: vi.fn(() => ({ social: 5 })),
			},
			couch: {
				pos: { x: 400, y: 380 },
				objectType: "furniture",
				isOccupied: vi.fn(() => false),
				getOccupant: vi.fn(() => null),
				getInteractionPoint: vi.fn(() => ({ x: 400, y: 400 })),
				occupy: vi.fn(),
				vacate: vi.fn(),
				getNeedsEffects: vi.fn(() => ({ energy: 8 })),
			},
			plant: { pos: { x: 100, y: 60 } },
			noticeBoard: { pos: { x: 680, y: 60 } },
			merchantStall: { pos: { x: 500, y: 60 } },
			foodBowlHub: {
				pos: { x: 200, y: 380 },
				objectType: "food",
				isOccupied: vi.fn(() => false),
				getOccupant: vi.fn(() => null),
				getInteractionPoint: vi.fn(() => ({ x: 200, y: 400 })),
				occupy: vi.fn(),
				vacate: vi.fn(),
				getNeedsEffects: vi.fn(() => ({ hunger: 30 })),
			},
			foodBowlVillage: {
				pos: { x: 250, y: 350 },
				objectType: "food",
				isOccupied: vi.fn(() => false),
				getOccupant: vi.fn(() => null),
				getInteractionPoint: vi.fn(() => ({ x: 250, y: 370 })),
				occupy: vi.fn(),
				vacate: vi.fn(),
				getNeedsEffects: vi.fn(() => ({ hunger: 30 })),
			},
			waterBowlOffice: {
				pos: { x: 580, y: 120 },
				objectType: "drink",
				isOccupied: vi.fn(() => false),
				getOccupant: vi.fn(() => null),
				getInteractionPoint: vi.fn(() => ({ x: 580, y: 140 })),
				occupy: vi.fn(),
				vacate: vi.fn(),
				getNeedsEffects: vi.fn(() => ({ thirst: 25 })),
			},
			waterBowlStation: {
				pos: { x: 550, y: 350 },
				objectType: "drink",
				isOccupied: vi.fn(() => false),
				getOccupant: vi.fn(() => null),
				getInteractionPoint: vi.fn(() => ({ x: 550, y: 370 })),
				occupy: vi.fn(),
				vacate: vi.fn(),
				getNeedsEffects: vi.fn(() => ({ thirst: 25 })),
			},
		},
		pets: [],
		btBridge: {
			worldState: {
				emitAction: vi.fn(),
				updateEntity: vi.fn(),
			},
			clock: {
				now: vi.fn(() => Date.now()),
				ms: vi.fn(() => Date.now()),
				iso: vi.fn(() => new Date().toISOString()),
			},
			deps: {},
		},
		state: {
			allEntities: new Map(),
			cycleConversationCounts: new Map<string, number>(),
			firedReactiveTriggers: new Map<string, Set<string>>(),
			prevWalkingState: new Map<string, boolean>(),
			lastTrailPos: new Map<string, { x: number; y: number }>(),
			petReactionCooldowns: new Map<string, number>(),
			petShareCooldowns: new Map<string, number>(),
			knownEntities: new Set<string>(),
			recentActionIds: new Set<string>(),
			prevCycleCount: 0,
			deltaMs: 16,
			lastTime: 0,
			currentLight: { r: 0, g: 0, b: 0, opacity: 0 },
		},
		lookups: {
			findAgentActor: vi.fn(),
			findCurrentSceneActor: vi.fn(),
			findNearestAgent: vi.fn(() => null),
			handleAgentSelect: vi.fn(),
			handleSceneChange: vi.fn(),
		},
	} as unknown as EngineContext;
}

let ctx: EngineContext;

beforeEach(() => {
	vi.clearAllMocks();
	ctx = createMockContext();
});

// ── tickSimulation ───────────────────────────────────────────────────

describe("tickSimulation", () => {
	it("calls all 12 tick functions without errors", () => {
		expect(() => tickSimulation(ctx)).not.toThrow();
	});

	it("updates sensor, needs, brain, and social systems", () => {
		tickSimulation(ctx);
		expect(ctx.systems.sensor.update).toHaveBeenCalledWith(16);
		expect(ctx.systems.needs.update).toHaveBeenCalled();
		expect(ctx.systems.brain.update).toHaveBeenCalled();
		expect(ctx.systems.social.update).toHaveBeenCalled();
	});
});

// ── tickClock ────────────────────────────────────────────────────────

describe("tickClock", () => {
	it("advances day clock by deltaMs", () => {
		tickClock(ctx);
		expect(ctx.systems.dayClock.update).toHaveBeenCalledWith(16);
	});

	it("updates store day progress", () => {
		tickClock(ctx);
		expect(ctx.store.setDayProgress).toHaveBeenCalledWith(0.5, 0);
	});

	it("ticks world event scheduler", () => {
		tickClock(ctx);
		expect(ctx.systems.worldEvent.update).toHaveBeenCalledWith(16);
	});

	it("handles cycle boundary when cycle count increases", () => {
		vi.mocked(ctx.systems.dayClock.getCycleCount).mockReturnValue(1);
		ctx.state.prevCycleCount = 0;

		tickClock(ctx);

		expect(ctx.state.prevCycleCount).toBe(1);
		expect(ctx.systems.worldAmbience.onCycleComplete).toHaveBeenCalled();
		expect(ctx.systems.memory.onCycleEnd).toHaveBeenCalled();
		expect(ctx.systems.worldEvent.onCycleReset).toHaveBeenCalled();
		expect(ctx.systems.relationship.onCycleEnd).toHaveBeenCalled();
	});

	it("clears fired reactive triggers on cycle boundary", () => {
		ctx.state.firedReactiveTriggers.set("alice", new Set(["energy-critical"]));
		vi.mocked(ctx.systems.dayClock.getCycleCount).mockReturnValue(1);
		ctx.state.prevCycleCount = 0;

		tickClock(ctx);

		expect(ctx.state.firedReactiveTriggers.size).toBe(0);
	});

	it("resets conversation counts on cycle boundary", () => {
		ctx.state.cycleConversationCounts.set("alice", 5);
		vi.mocked(ctx.systems.dayClock.getCycleCount).mockReturnValue(1);
		ctx.state.prevCycleCount = 0;

		tickClock(ctx);

		expect(ctx.state.cycleConversationCounts.get("alice")).toBe(0);
	});
});

// ── tickSensor ───────────────────────────────────────────────────────

describe("tickSensor", () => {
	it("updates sensor system with deltaMs", () => {
		tickSensor(ctx);
		expect(ctx.systems.sensor.update).toHaveBeenCalledWith(16);
	});
});

// ── tickNeeds ────────────────────────────────────────────────────────

describe("tickNeeds", () => {
	it("updates needs system", () => {
		tickNeeds(ctx);
		expect(ctx.systems.needs.update).toHaveBeenCalled();
		const call = vi.mocked(ctx.systems.needs.update).mock.calls[0];
		expect(call[0]).toBe(16);
	});

	it("propagates mood to brain and emote systems", () => {
		vi.mocked(ctx.systems.needs.getMood).mockReturnValue("happy");
		tickNeeds(ctx);
		expect(ctx.systems.brain.updateMood).toHaveBeenCalledWith("alice", "happy");
		expect(ctx.systems.emote.updateMood).toHaveBeenCalledWith("alice", "happy");
	});

	it("feeds talk engine context variables", () => {
		tickNeeds(ctx);
		expect(ctx.systems.talk.updateVars).toHaveBeenCalled();
		const call = vi.mocked(ctx.systems.talk.updateVars).mock.calls[0];
		expect(call[0]).toBe("alice");
		expect(call[1]).toHaveProperty("mood");
		expect(call[1]).toHaveProperty("phase");
		expect(call[1]).toHaveProperty("weather");
	});
});

// ── tickReactiveTriggers ─────────────────────────────────────────────

describe("tickReactiveTriggers", () => {
	it("fires energy-critical trigger when energy is low", () => {
		vi.mocked(ctx.systems.needs.getNeeds).mockReturnValue({ energy: 10, social: 50, focus: 50, morale: 50, hunger: 80, thirst: 80 });
		tickReactiveTriggers(ctx);
		expect(ctx.systems.talk.triggerReactive).toHaveBeenCalledWith("alice", "energy-critical");
	});

	it("does not fire same trigger twice", () => {
		vi.mocked(ctx.systems.needs.getNeeds).mockReturnValue({ energy: 10, social: 50, focus: 50, morale: 50, hunger: 80, thirst: 80 });
		tickReactiveTriggers(ctx);
		tickReactiveTriggers(ctx);
		// Should be called once per agent, not twice
		const aliceCalls = vi.mocked(ctx.systems.talk.triggerReactive).mock.calls
			.filter(([name]) => name === "alice");
		expect(aliceCalls.filter(([, trigger]) => trigger === "energy-critical")).toHaveLength(1);
	});

	it("fires lonely trigger when mood is lonely", () => {
		vi.mocked(ctx.systems.needs.getMood).mockReturnValue("lonely");
		tickReactiveTriggers(ctx);
		expect(ctx.systems.talk.triggerReactive).toHaveBeenCalledWith("alice", "lonely");
	});
});

// ── tickBehaviorThresholds ───────────────────────────────────────────

describe("tickBehaviorThresholds", () => {
	it("calls checkThresholds for each agent", () => {
		tickBehaviorThresholds(ctx);
		expect(ctx.systems.needs.checkThresholds).toHaveBeenCalledWith("alice");
		expect(ctx.systems.needs.checkThresholds).toHaveBeenCalledWith("bob");
	});

	it("applies force-break when threshold triggers", () => {
		vi.mocked(ctx.systems.needs.checkThresholds).mockReturnValue([{ type: "force-break" }]);
		tickBehaviorThresholds(ctx);
		expect(ctx.systems.brain.applyEvent).toHaveBeenCalledWith("alice", "break");
	});

	it("skips in-transit agents for thresholds", () => {
		vi.mocked(ctx.systems.registry.isInTransit).mockReturnValue(true);
		vi.mocked(ctx.systems.needs.checkThresholds).mockReturnValue([{ type: "force-break" }]);
		tickBehaviorThresholds(ctx);
		expect(ctx.systems.brain.applyEvent).not.toHaveBeenCalled();
	});
});

// ── tickPets ─────────────────────────────────────────────────────────

describe("tickPets", () => {
	it("does nothing when no pets exist", () => {
		expect(() => tickPets(ctx)).not.toThrow();
	});

	it("updates pet behavior with deltaMs", () => {
		const mockPet = {
			entityId: "cat-hub",
			petType: "cat",
			pos: { x: 300, y: 250 },
			updateBehavior: vi.fn(),
			getFollowTarget: vi.fn(() => null),
			getState: vi.fn(() => "idle"),
			getInteractRadius: vi.fn(() => 50),
			getNeedsEffects: vi.fn(() => ({ morale: 5 })),
			setFollowTarget: vi.fn(),
			moveToward: vi.fn(),
		};
		(ctx as { pets: unknown[] }).pets = [mockPet];
		tickPets(ctx);
		expect(mockPet.updateBehavior).toHaveBeenCalledWith(16);
	});
});

// ── tickRoomTransit ──────────────────────────────────────────────────

describe("tickRoomTransit", () => {
	it("updates room switcher with deltaMs", () => {
		tickRoomTransit(ctx);
		expect(ctx.systems.roomSwitcher.update).toHaveBeenCalledWith(16);
	});
});

// ── tickBehaviorTree ─────────────────────────────────────────────────

describe("tickBehaviorTree", () => {
	it("refreshes BT needs snapshots before update", () => {
		const mockBtAgent = {
			context: {
				needs: { energy: 0, social: 0, focus: 0, morale: 0 },
			},
		};
		vi.mocked(ctx.systems.bt.getAgent).mockReturnValue(mockBtAgent as unknown as BTAgentObject);
		vi.mocked(ctx.systems.needs.getNeeds).mockReturnValue({ energy: 75, social: 60, focus: 80, morale: 90, hunger: 80, thirst: 80 });

		tickBehaviorTree(ctx);

		expect(mockBtAgent.context.needs.energy).toBe(75);
		expect(mockBtAgent.context.needs.social).toBe(60);
		expect(mockBtAgent.context.needs.focus).toBe(80);
		expect(mockBtAgent.context.needs.morale).toBe(90);
	});

	it("ticks BT system", () => {
		tickBehaviorTree(ctx);
		expect(ctx.systems.bt.update).toHaveBeenCalledWith(16, ctx.btBridge.worldState, ctx.btBridge.clock);
	});

	it("assigns work on goal-started action", () => {
		vi.mocked(ctx.systems.bt.update).mockReturnValue([
			{ type: "goal-started", agentName: "alice", data: {}, id: "1", timestamp: "2026-01-01" },
		]);
		tickBehaviorTree(ctx);
		expect(ctx.systems.brain.assignWork).toHaveBeenCalledWith("alice");
	});

	it("releases work on goal-completed action", () => {
		vi.mocked(ctx.systems.bt.update).mockReturnValue([
			{ type: "goal-completed", agentName: "alice", data: {}, id: "1", timestamp: "2026-01-01" },
		]);
		tickBehaviorTree(ctx);
		expect(ctx.systems.brain.releaseWork).toHaveBeenCalledWith("alice");
	});

	it("shows bubble on speaking action", () => {
		vi.mocked(ctx.systems.bt.update).mockReturnValue([
			{ type: "speaking", agentName: "alice", data: { text: "Hello world" }, id: "1", timestamp: "2026-01-01" },
		]);
		tickBehaviorTree(ctx);
		expect(ctx.systems.bubble.showBubble).toHaveBeenCalledWith(
			"alice", "speech", "Hello world",
			ctx.engine.currentScene, ctx.lookups.findAgentActor, 4000,
		);
	});
});

// ── tickBrain ────────────────────────────────────────────────────────

describe("tickBrain", () => {
	it("snapshots walking state before brain update", () => {
		// Verify prevWalkingState is captured BEFORE brainSystem.update
		const updateOrder: string[] = [];

		// Override brain.update to record when it's called
		vi.mocked(ctx.systems.brain.update).mockImplementation(() => {
			updateOrder.push("brain-update");
			// At this point, prevWalkingState should already be set
			expect(ctx.state.prevWalkingState.get("bob")).toBe(true); // bob is "wandering"
			expect(ctx.state.prevWalkingState.get("alice")).toBe(false); // alice is "idle"
		});

		tickBrain(ctx);

		expect(updateOrder).toEqual(["brain-update"]);
		expect(ctx.systems.brain.update).toHaveBeenCalledWith(16, ctx.lookups.findAgentActor, expect.any(Function));
	});

	it("detects walking state for wandering agents", () => {
		tickBrain(ctx);
		expect(ctx.state.prevWalkingState.get("bob")).toBe(true);
	});

	it("detects non-walking state for idle agents", () => {
		tickBrain(ctx);
		expect(ctx.state.prevWalkingState.get("alice")).toBe(false);
	});
});

// ── tickSocial ───────────────────────────────────────────────────────

describe("tickSocial", () => {
	it("updates ritual, social, and talk systems", () => {
		tickSocial(ctx);
		expect(ctx.systems.ritual.update).toHaveBeenCalled();
		expect(ctx.systems.social.update).toHaveBeenCalled();
		expect(ctx.systems.talk.update).toHaveBeenCalledWith(16);
	});

	it("applies room offsets for social system positions", () => {
		tickSocial(ctx);
		const positionFn = vi.mocked(ctx.systems.social.update).mock.calls[0][1] as (name: string) => { x: number; y: number };
		vi.mocked(ctx.systems.registry.getEntityRoom).mockReturnValue("office");
		vi.mocked(ctx.systems.brain.getPosition).mockReturnValue({ x: 100, y: 200 });
		const pos = positionFn("alice");
		// Office offset is 10000
		expect(pos.x).toBe(10100);
		expect(pos.y).toBe(10200);
	});
});

// ── tickDirector ─────────────────────────────────────────────────────

describe("tickDirector", () => {
	it("updates director, engagement, and tool systems", () => {
		tickDirector(ctx);
		expect(ctx.systems.director.update).toHaveBeenCalledWith(16);
		expect(ctx.systems.engagement.update).toHaveBeenCalled();
		expect(ctx.systems.tool.update).toHaveBeenCalledWith(16);
	});

	it("sets engagement context with agent count", () => {
		tickDirector(ctx);
		expect(ctx.systems.engagement.setContext).toHaveBeenCalledWith({ agentCount: "2" });
	});
});

// ── tickVisuals ──────────────────────────────────────────────────────

describe("tickVisuals", () => {
	it("updates emote system", () => {
		tickVisuals(ctx);
		expect(ctx.systems.emote.update).toHaveBeenCalled();
	});

	it("updates particle pool", () => {
		tickVisuals(ctx);
		expect(ctx.systems.particlePool.update).toHaveBeenCalledWith(16);
	});

	it("updates bubble system", () => {
		tickVisuals(ctx);
		expect(ctx.systems.bubble.update).toHaveBeenCalled();
	});

	it("lerps lighting toward target", () => {
		vi.mocked(ctx.systems.worldAmbience.getLighting).mockReturnValue({ r: 100, g: 50, b: 25, opacity: 0.5 });
		ctx.state.currentLight.r = 0;
		ctx.state.currentLight.g = 0;
		ctx.state.currentLight.b = 0;
		ctx.state.currentLight.opacity = 0;
		ctx.state.deltaMs = 100; // Large deltaMs for visible lerp

		tickVisuals(ctx);

		expect(ctx.state.currentLight.r).toBeGreaterThan(0);
		expect(ctx.state.currentLight.g).toBeGreaterThan(0);
		expect(ctx.state.currentLight.b).toBeGreaterThan(0);
		expect(ctx.state.currentLight.opacity).toBeGreaterThan(0);
	});

	it("updates workstation glow in all rooms", () => {
		const mockWs = { updateGlow: vi.fn() };
		(ctx.scenes.map as unknown as Record<string, { getWorkstations: ReturnType<typeof vi.fn> }>).office.getWorkstations.mockReturnValue([mockWs]);

		tickVisuals(ctx);

		expect(mockWs.updateGlow).toHaveBeenCalledWith(16);
	});

	it("does not crash when cameraSystem is null", () => {
		ctx.systems.cameraSystem = null;
		expect(() => tickVisuals(ctx)).not.toThrow();
	});

	it("updates camera system when present", () => {
		const mockCamera = {
			checkDespawn: vi.fn(),
			applyZoom: vi.fn(),
			updatePan: vi.fn(),
		};
		(ctx.systems as { cameraSystem: unknown }).cameraSystem = mockCamera;
		tickVisuals(ctx);
		expect(mockCamera.checkDespawn).toHaveBeenCalled();
		expect(mockCamera.applyZoom).toHaveBeenCalledWith(16);
		expect(mockCamera.updatePan).toHaveBeenCalledWith(16);
	});

	it("spawns weather particles when weather has particles", () => {
		vi.mocked(ctx.systems.worldAmbience.getWeatherVisuals).mockReturnValue({
			particleCount: 5,
			particleAngle: 1.5,
			particleSpeed: 100,
			particleColor: "#aabbcc",
			tintColor: null,
			tintOpacity: 0,
		});
		// Force Math.random to return a value that passes the chance check
		const origRandom = Math.random;
		Math.random = () => 0.1; // Below WEATHER_PARTICLE_CHANCE (0.3)
		try {
			tickVisuals(ctx);
			expect(ctx.systems.particlePool.spawn).toHaveBeenCalled();
		} finally {
			Math.random = origRandom;
		}
	});
});

// ── getNearbyAgents ──────────────────────────────────────────────────

describe("getNearbyAgents", () => {
	it("returns agents within social radius in same room", () => {
		// Both alice and bob are in "office" (mock returns "office" for all)
		// alice is at (100,100), bob at (200,200) — distance ~141
		const nearby = getNearbyAgents(ctx, "alice");
		// socialRadius is 100, but sqrt(100^2 + 100^2) ≈ 141 > 100
		expect(nearby).toEqual([]);
	});

	it("returns empty when no agents within radius", () => {
		const nearby = getNearbyAgents(ctx, "alice");
		expect(nearby).toEqual([]);
	});

	it("returns empty when agent has no position", () => {
		vi.mocked(ctx.systems.brain.getPosition).mockReturnValue(undefined);
		const nearby = getNearbyAgents(ctx, "alice");
		expect(nearby).toEqual([]);
	});

	it("excludes agents in different rooms", () => {
		vi.mocked(ctx.systems.registry.getEntityRoom).mockImplementation((name: string) =>
			name === "alice" ? "office" : "village",
		);
		const nearby = getNearbyAgents(ctx, "alice");
		expect(nearby).toEqual([]);
	});
});
