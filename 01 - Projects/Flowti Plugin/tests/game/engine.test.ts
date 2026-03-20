// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";

// Mock excalibur — use function constructors so `new` works
vi.mock("excalibur", () => {
	function MockEngine() {
		const self = this as Record<string, unknown>;
		self.canvas = document.createElement("canvas");
		self.screen = {
			displayMode: 0,
			viewport: {},
			applyResolutionAndViewport: vi.fn(),
			worldToPageCoordinates: vi.fn(() => ({ x: 0, y: 0 })),
		};
		self.start = vi.fn().mockResolvedValue(undefined);
		self.stop = vi.fn();
		self.dispose = vi.fn();
		self.goToScene = vi.fn().mockResolvedValue(undefined);
		self.addScene = vi.fn();
		self.on = vi.fn();
		self.currentScene = {
			camera: { move: vi.fn(), pos: { x: 0, y: 0 }, zoom: 1 },
			add: vi.fn(),
		};
		self.drawWidth = 800;
		self.drawHeight = 500;
	}

	function MockActor() {
		const self = this as Record<string, unknown>;
		self.graphics = { use: vi.fn(), add: vi.fn() };
		self.addChild = vi.fn();
		self.on = vi.fn();
		self.pos = { x: 0, y: 0 };
		self.scale = { x: 1, y: 1 };
	}

	return {
		Engine: MockEngine,
		Color: { fromHex: vi.fn() },
		DisplayMode: { Fixed: 0, FitContainer: 1, FitScreen: 2 },
		CollisionType: { PreventCollision: 0 },
		vec: vi.fn((x: number, y: number) => ({ x, y })),
		Actor: MockActor,
		Label: function MockLabel() { return; },
		Scene: function MockScene() { return; },
		Canvas: function MockCanvas() { return; },
		Font: function MockFont() { return; },
		SpriteSheet: { fromImageSource: vi.fn() },
		Animation: { fromSpriteSheet: vi.fn(() => ({ strategy: 0, frames: [{ graphic: {} }] })) },
		ImageSource: function MockImageSource() {
			(this as Record<string, unknown>).load = vi.fn().mockResolvedValue(undefined);
		},
		FadeInOut: function MockFadeInOut() { return; },
		EasingFunctions: { EaseInOutCubic: vi.fn() },
		AnimationStrategy: { Loop: 0 },
		ImageFiltering: { Pixel: 0 },
		FontUnit: { Px: 0 },
		TextAlign: { Center: 0, Right: 1 },
	};
});

// Mock all game modules that the engine imports
vi.mock("../../src/game/scenes/hub-scene.js", () => {
	function MockHubScene() {
		const self = this as Record<string, unknown>;
		self.add = vi.fn();
		self.updateAgents = vi.fn();
		self.updateConnectionStatus = vi.fn();
		self.getAgentActor = vi.fn();
		self.setSpriteRegistry = vi.fn();
		self.camera = { move: vi.fn(), pos: { x: 0, y: 0 }, zoom: 1 };
	}
	return { HubScene: MockHubScene };
});

vi.mock("../../src/game/scenes/office-scene.js", () => ({
	createOfficeScene: vi.fn(() => ({
		add: vi.fn(),
		getAgentActor: vi.fn(),
		getWorkstations: vi.fn(() => []),
		spawnAgent: vi.fn(),
		setBrainSystem: vi.fn(),
		setSpriteRegistry: vi.fn(),
	})),
}));

vi.mock("../../src/game/scenes/village-scene.js", () => ({
	createVillageScene: vi.fn(() => ({
		add: vi.fn(),
		getAgentActor: vi.fn(),
		getWorkstations: vi.fn(() => []),
		spawnAgent: vi.fn(),
		setBrainSystem: vi.fn(),
		setSpriteRegistry: vi.fn(),
	})),
}));

vi.mock("../../src/game/scenes/station-scene.js", () => ({
	createStationScene: vi.fn(() => ({
		add: vi.fn(),
		getAgentActor: vi.fn(),
		getWorkstations: vi.fn(() => []),
		spawnAgent: vi.fn(),
		setBrainSystem: vi.fn(),
		setSpriteRegistry: vi.fn(),
	})),
}));

vi.mock("../../src/game/systems/brain-system.js", () => {
	function MockBrainSystem() {
		const self = this as Record<string, unknown>;
		self.register = vi.fn();
		self.applyEvent = vi.fn();
		self.freeze = vi.fn();
		self.assignWork = vi.fn();
		self.releaseWork = vi.fn();
		self.getState = vi.fn(() => ({ state: "idle", params: { quoteFrequency: 0.1, socialRadius: 100 } }));
		self.getPosition = vi.fn();
		self.getAllEntries = vi.fn(() => new Map());
		self.update = vi.fn();
	}
	return { BrainSystem: MockBrainSystem };
});

vi.mock("../../src/game/systems/bubble-system.js", () => {
	function MockBubbleSystem() {
		const self = this as Record<string, unknown>;
		self.register = vi.fn();
		self.showBubble = vi.fn();
		self.update = vi.fn();
	}
	return { BubbleSystem: MockBubbleSystem };
});

vi.mock("../../src/game/systems/talk/talk-engine.js", () => {
	function MockTalkEngine() {
		const self = this as Record<string, unknown>;
		self.register = vi.fn();
		self.activate = vi.fn();
		self.silence = vi.fn();
		self.update = vi.fn();
	}
	return { TalkEngine: MockTalkEngine };
});

vi.mock("../../src/game/systems/particle-system.js", () => {
	function MockParticlePool() {
		const self = this as Record<string, unknown>;
		self.getAll = vi.fn(() => []);
		self.spawnTrail = vi.fn();
		self.spawnDustBurst = vi.fn();
		self.update = vi.fn();
	}
	return { ParticlePool: MockParticlePool };
});

vi.mock("../../src/game/systems/emote-system.js", () => {
	function MockEmoteSystem() {
		const self = this as Record<string, unknown>;
		self.register = vi.fn();
		self.onEmote = vi.fn();
		self.update = vi.fn();
	}
	return { EmoteSystem: MockEmoteSystem };
});

vi.mock("../../src/game/systems/social-system.js", () => {
	function MockSocialSystem() {
		const self = this as Record<string, unknown>;
		self.register = vi.fn();
		self.onConversation = vi.fn();
		self.onCluster = vi.fn();
		self.update = vi.fn();
	}
	return { SocialSystem: MockSocialSystem };
});

vi.mock("../../src/game/systems/camera-system.js", () => ({
	createCameraSystem: vi.fn(() => ({
		startFollow: vi.fn(),
		stopFollow: vi.fn(),
		isFollowing: vi.fn(() => false),
		onSceneActivate: vi.fn(),
		handleZoom: vi.fn(),
		handleKeyDown: vi.fn(),
		handleKeyUp: vi.fn(),
		checkDespawn: vi.fn(),
		applyZoom: vi.fn(),
		updatePan: vi.fn(),
	})),
}));

vi.mock("../../src/game/data/message-utils.js", () => ({
	extractAgentMessage: vi.fn((s: string) => s),
}));

vi.mock("../../src/game/brain/movement.js", () => ({
	preferredWorkstation: vi.fn(),
}));

vi.mock("../../src/game/sprites/character-pool.js", () => ({
	DOMAIN_POOLS: { engineering: ["char1"], design: ["char2"] },
}));

vi.mock("../../src/game/config/domain-map.js", () => ({
	resolveSettingForDomain: vi.fn(() => "hub"),
}));

vi.mock("../../src/game/sprites/sprite-loader.js", () => ({
	preloadSpriteRegistry: vi.fn().mockResolvedValue(new Map()),
}));

vi.mock("../../src/game/store/dashboard-store.js", () => {
	function MockDashboardStore() {
		const self = this as Record<string, unknown>;
		self.agents = [];
		self.selectedAgent = null;
		self.followedAgent = null;
		self.selectAgent = vi.fn();
		self.selectTab = vi.fn();
		self.startFollow = vi.fn();
		self.stopFollow = vi.fn();
		self.setAgents = vi.fn();
		self.setConnectionStatus = vi.fn();
		self.setActivityLog = vi.fn();
		self.pushAgentResponse = vi.fn();
		self.setLlmStatus = vi.fn();
		self.beginBatch = vi.fn();
		self.endBatch = vi.fn();
		self.updatePositions = vi.fn();
		self.setAgentTarget = vi.fn();
		self.clearAgentTarget = vi.fn();
		self.setAgentState = vi.fn();
		self.addEventListener = vi.fn();
		self.removeEventListener = vi.fn();
	}
	return { DashboardStore: MockDashboardStore };
});

vi.mock("../../src/game/actors/cursor-spirit.js", () => {
	function MockCursorSpirit() {
		const self = this as Record<string, unknown>;
		self.show = vi.fn();
		self.hide = vi.fn();
		self.moveTo = vi.fn();
		self.graphics = { opacity: 0, use: vi.fn() };
		self.pos = { x: 0, y: 0 };
		self.z = 999;
	}
	return { CursorSpirit: MockCursorSpirit };
});

vi.mock("../../src/game/data/huddle-templates.js", () => ({
	HUDDLE_TEMPLATES: [{ text: "Test huddle line about {domain}" }],
}));

vi.mock("../../src/game/data/engagement-templates.js", () => ({
	TIER1_TEMPLATES: [{ text: "test" }],
	TIER2_TEMPLATES: [{ text: "test" }],
	TIER3_TEMPLATES: [{ text: "test" }],
	interpolateTemplate: vi.fn((text: string) => text),
}));

vi.mock("../../src/game/systems/day-clock.js", () => {
	function MockDayClock() {
		const self = this as Record<string, unknown>;
		self.update = vi.fn();
		self.getPhase = vi.fn(() => "morning-arrival");
		self.getPhaseMultipliers = vi.fn(() => ({ energy: 1, social: 1, focus: 1, morale: 1 }));
		self.getCycleCount = vi.fn(() => 0);
		self.getCycleProgress = vi.fn(() => 0);
		self.getTimeOfDay = vi.fn(() => "morning");
		self.onPhaseChange = vi.fn();
		self.serialize = vi.fn(() => ({}));
		self.restore = vi.fn();
	}
	return { DayClock: MockDayClock };
});

vi.mock("../../src/game/systems/world-ambience.js", () => {
	function MockWorldAmbience() {
		const self = this as Record<string, unknown>;
		self.getLighting = vi.fn(() => ({ r: 0, g: 0, b: 0, opacity: 0 }));
		self.getWeather = vi.fn(() => "clear");
		self.getWeatherVisuals = vi.fn(() => ({ particleCount: 0 }));
		self.onCycleComplete = vi.fn();
		self.serialize = vi.fn(() => ({}));
		self.restore = vi.fn();
	}
	return { WorldAmbience: MockWorldAmbience };
});

vi.mock("../../src/game/systems/memory-system.js", () => {
	function MockMemorySystem() {
		const self = this as Record<string, unknown>;
		self.register = vi.fn();
		self.getMemory = vi.fn(() => ({ milestones: [], recentEvents: [], moodLog: [] }));
		self.recordEvent = vi.fn();
		self.recordVisit = vi.fn();
		self.onCycleEnd = vi.fn();
		self.onMilestone = vi.fn();
		self.serialize = vi.fn(() => ({}));
		self.restore = vi.fn();
	}
	return { MemorySystem: MockMemorySystem };
});

vi.mock("../../src/game/systems/quirk-system.js", () => {
	function MockQuirkSystem() {
		const self = this as Record<string, unknown>;
		self.register = vi.fn();
		self.getQuirks = vi.fn(() => []);
		self.getOverrides = vi.fn(() => ({}));
		self.getQuirkPhrases = vi.fn(() => []);
		self.hasQuirk = vi.fn(() => false);
	}
	return { QuirkSystem: MockQuirkSystem };
});

vi.mock("../../src/game/systems/world-event-scheduler.js", () => {
	function MockWorldEventScheduler() {
		const self = this as Record<string, unknown>;
		self.registerHandler = vi.fn();
		self.recordSensorEvent = vi.fn();
		self.onPhaseChange = vi.fn();
		self.onCycleReset = vi.fn();
		self.update = vi.fn();
		self.isEventActive = vi.fn(() => false);
	}
	return { WorldEventScheduler: MockWorldEventScheduler };
});

vi.mock("../../src/game/systems/relationship-system.js", () => {
	function MockRelationshipSystem() {
		const self = this as Record<string, unknown>;
		self.register = vi.fn();
		self.recordConversation = vi.fn();
		self.recordCluster = vi.fn();
		self.recordBicker = vi.fn();
		self.shouldBicker = vi.fn(() => false);
		self.getAffinity = vi.fn(() => 0);
		self.getTier = vi.fn(() => "acquaintance");
		self.onCycleEnd = vi.fn();
		self.onTierChange = vi.fn();
		self.addSharedMemory = vi.fn();
		self.serialize = vi.fn(() => ({ relationships: [], opinions: {} }));
		self.restore = vi.fn();
	}
	return { RelationshipSystem: MockRelationshipSystem };
});

vi.mock("../../src/game/data/relationship-templates.js", () => ({
	BICKER_TEMPLATES: [{ text: "test bicker", weight: 1 }],
	COLLEAGUE_TEMPLATES: [{ text: "test", weight: 1 }],
	FRIEND_TEMPLATES: [{ text: "test", weight: 1 }],
	BEST_FRIEND_TEMPLATES: [{ text: "test", weight: 1 }],
	AGREEMENT_TEMPLATES: [{ text: "test", weight: 1 }],
	getTemplatesForTier: vi.fn(() => []),
}));

vi.mock("../../src/game/data/micro-event-templates.js", () => ({
	pickTemplate: vi.fn(() => "test event line"),
	STANDUP_TEMPLATES: [{ text: "test", weight: 1 }],
	DEPLOY_SUCCESS_TEMPLATES: [{ text: "test", weight: 1 }],
	END_OF_DAY_TEMPLATES: [{ text: "test", weight: 1 }],
	EUREKA_TEMPLATES: [{ text: "test", weight: 1 }],
	BUILD_BREAK_REACTION_TEMPLATES: [{ text: "test", weight: 1 }],
	BUILD_BREAK_RESOLVE_TEMPLATES: [{ text: "test", weight: 1 }],
	BIRTHDAY_TEMPLATES: [{ text: "test", weight: 1 }],
	POWER_FLICKER_REACTION_TEMPLATES: [{ text: "test", weight: 1 }],
	POWER_FLICKER_RESOLVE_TEMPLATES: [{ text: "test", weight: 1 }],
	NEW_PR_TEMPLATES: [{ text: "test", weight: 1 }],
	TEA_TIME_TEMPLATES: [{ text: "test", weight: 1 }],
}));

vi.mock("../../src/game/data/opinion-topics.js", () => ({
	assignOpinions: vi.fn(() => []),
	checkOpinionClash: vi.fn(() => false),
	checkOpinionAgreement: vi.fn(() => false),
	OPINION_TOPICS: [],
}));

vi.mock("../../src/game/actors/pet-actor.js", () => {
	function MockPetActor() {
		const self = this as Record<string, unknown>;
		self.pos = { x: 0, y: 0 };
		self.petType = "cat";
		self.getState = vi.fn(() => "idle");
		self.getFollowTarget = vi.fn(() => null);
		self.setFollowTarget = vi.fn();
		self.updateBehavior = vi.fn();
		self.moveToward = vi.fn();
		self.getInteractRadius = vi.fn(() => 50);
		self.getNeedsEffects = vi.fn(() => ({}));
		self.isSleeping = vi.fn(() => false);
	}
	return { PetActor: MockPetActor };
});

vi.mock("../../src/game/data/pet-definitions.js", () => ({
	PET_DEFINITIONS: [
		{ type: "cat", phrases: ["meow"], behaviors: { interactRadius: 50, needsEffect: {} } },
		{ type: "dog", phrases: ["woof"], behaviors: { interactRadius: 60, needsEffect: {} } },
		{ type: "bird", phrases: ["chirp"], behaviors: { interactRadius: 40, needsEffect: {} } },
		{ type: "fish", phrases: ["blub"], behaviors: { interactRadius: 60, needsEffect: {} } },
	],
	getPetDefinition: vi.fn(),
}));

vi.mock("../../src/game/actors/coffee-machine.js", () => {
	function MockCoffeeMachine() { const s = this as Record<string, unknown>; s.pos = { x: 0, y: 0 }; s.getInteractionPoint = vi.fn(() => ({ x: 0, y: 0 })); }
	return { CoffeeMachine: MockCoffeeMachine };
});
vi.mock("../../src/game/actors/whiteboard-actor.js", () => {
	function MockWhiteboardActor() { const s = this as Record<string, unknown>; s.pos = { x: 0, y: 0 }; s.getInteractionPoint = vi.fn(() => ({ x: 0, y: 0 })); }
	return { WhiteboardActor: MockWhiteboardActor };
});
vi.mock("../../src/game/actors/snack-table.js", () => {
	function MockSnackTable() { const s = this as Record<string, unknown>; s.pos = { x: 0, y: 0 }; s.getInteractionPoint = vi.fn(() => ({ x: 0, y: 0 })); }
	return { SnackTable: MockSnackTable };
});
vi.mock("../../src/game/actors/water-cooler.js", () => {
	function MockWaterCooler() { const s = this as Record<string, unknown>; s.pos = { x: 0, y: 0 }; s.getInteractionPoint = vi.fn(() => ({ x: 0, y: 0 })); }
	return { WaterCooler: MockWaterCooler };
});
vi.mock("../../src/game/actors/couch-actor.js", () => {
	function MockCouchActor() { const s = this as Record<string, unknown>; s.pos = { x: 0, y: 0 }; s.getInteractionPoint = vi.fn(() => ({ x: 0, y: 0 })); }
	return { CouchActor: MockCouchActor };
});
vi.mock("../../src/game/actors/plant-actor.js", () => {
	function MockPlantActor() { const s = this as Record<string, unknown>; s.pos = { x: 0, y: 0 }; s.getInteractionPoint = vi.fn(() => ({ x: 0, y: 0 })); }
	return { PlantActor: MockPlantActor };
});
vi.mock("../../src/game/actors/notice-board.js", () => {
	function MockNoticeBoard() { const s = this as Record<string, unknown>; s.pos = { x: 0, y: 0 }; s.getInteractionPoint = vi.fn(() => ({ x: 0, y: 0 })); }
	return { NoticeBoard: MockNoticeBoard };
});

vi.mock("../../src/game/data/world-config.js", () => ({
	DEFAULT_WORLD_CONFIG: {
		engagement: { tiers: { ambient: { idleThresholdMs: 30000, durationMs: 45000 }, nudge: { idleThresholdMs: 90000, durationMs: 90000 }, offer: { idleThresholdMs: 180000, durationMs: 180000 } }, engagementDuration: 10000 },
		dayCycle: { durationMs: 1500000 },
		weather: { cycleLengthInDayCycles: 2 },
		relationships: { affinityDecayPerCycle: 1, bickerChance: 0.3, maxSharedMemories: 5 },
	},
}));

// Mock all side-effect Lit UI imports
vi.mock("../../src/game/ui/dashboard-overlays.js", () => ({}));
vi.mock("../../src/game/ui/ask-bob.js", () => ({}));
vi.mock("../../src/game/ui/roster-bar.js", () => ({}));
vi.mock("../../src/game/ui/camera-hud.js", () => ({}));
vi.mock("../../src/game/ui/agent-panel.js", () => ({}));

import { createAgentWorld } from "../../src/game/engine.js";
import type { DataProvider } from "../../src/game/config/data-provider.js";

function createMockProvider(): DataProvider {
	return {
		start: vi.fn().mockResolvedValue(undefined),
		stop: vi.fn(),
		getWorldState: vi.fn().mockResolvedValue(null),
		getDashboardAgents: vi.fn().mockResolvedValue([]),
		onAction: vi.fn().mockReturnValue(() => {}),
		onEntityUpdate: vi.fn().mockReturnValue(() => {}),
		onConnectionStatus: vi.fn().mockReturnValue(() => {}),
		sendCommand: vi.fn().mockResolvedValue(undefined),
		assetBasePath: "",
	};
}

describe("createAgentWorld", () => {
	it("returns handle with start, pause, resume, dispose", () => {
		const handle = createAgentWorld({
			container: document.createElement("div"),
			provider: createMockProvider(),
			spriteBasePath: "/test",
		});
		expect(handle.start).toBeInstanceOf(Function);
		expect(handle.pause).toBeInstanceOf(Function);
		expect(handle.resume).toBeInstanceOf(Function);
		expect(handle.dispose).toBeInstanceOf(Function);
	});

	it("mounts canvas into container", () => {
		const container = document.createElement("div");
		createAgentWorld({ container, provider: createMockProvider(), spriteBasePath: "/test" });
		expect(container.querySelector("canvas")).toBeTruthy();
	});

	it("mounts overlay elements into container", () => {
		const container = document.createElement("div");
		createAgentWorld({ container, provider: createMockProvider(), spriteBasePath: "/test" });
		// Canvas + 5 overlay elements = 6 children
		expect(container.children.length).toBe(6);
	});

	it("keyboard listeners are on document (not container)", () => {
		const addSpy = vi.spyOn(document, "addEventListener");
		createAgentWorld({ container: document.createElement("div"), provider: createMockProvider(), spriteBasePath: "/test" });
		const addedEvents = addSpy.mock.calls.map((c) => c[0]);
		expect(addedEvents).toContain("keydown");
		expect(addedEvents).toContain("keyup");
		addSpy.mockRestore();
	});

	it("dispose removes keyboard listeners from document", () => {
		const removeSpy = vi.spyOn(document, "removeEventListener");
		const handle = createAgentWorld({ container: document.createElement("div"), provider: createMockProvider(), spriteBasePath: "/test" });

		handle.dispose();

		const removedEvents = removeSpy.mock.calls.map((c) => c[0]);
		expect(removedEvents).toContain("keydown");
		expect(removedEvents).toContain("keyup");
		removeSpy.mockRestore();
	});

	it("dispose calls provider.stop()", () => {
		const provider = createMockProvider();
		const handle = createAgentWorld({
			container: document.createElement("div"),
			provider,
			spriteBasePath: "/test",
		});

		handle.dispose();

		expect(provider.stop).toHaveBeenCalled();
	});

	it("subscribes to provider events during construction", () => {
		const provider = createMockProvider();
		createAgentWorld({ container: document.createElement("div"), provider, spriteBasePath: "/test" });

		expect(provider.onAction).toHaveBeenCalled();
		expect(provider.onEntityUpdate).toHaveBeenCalled();
		expect(provider.onConnectionStatus).toHaveBeenCalled();
	});
});
