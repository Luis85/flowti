// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";

// Mock excalibur — use function constructors so `new` works
vi.mock("excalibur", () => {
	const MockEngine = vi.fn(function (this: Record<string, unknown>) {
		const self = this;
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
		self.input = {
			pointers: { primary: { on: vi.fn() } },
		};
	});

	function MockActor(this: Record<string, unknown>) {
		const self = this;
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
		ImageSource: function MockImageSource(this: Record<string, unknown>) {
			this.load = vi.fn().mockResolvedValue(undefined);
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

// ── Scene mocks ─────────────────────────────────────────────────────
vi.mock("../../src/game/scenes/game-scene.js", () => {
	function MockGameScene(this: Record<string, unknown>) {
		const self = this;
		self.add = vi.fn();
		self.updateAgents = vi.fn();
		self.removeAgent = vi.fn();
		self.getAgentActor = vi.fn();
		self.getWorkstations = vi.fn(() => []);
		self.spawnAgent = vi.fn();
		self.spawnAgentAtDoorway = vi.fn();
		self.setBrainSystem = vi.fn();
		self.setSpriteRegistry = vi.fn();
		self.registerEntity = vi.fn();
		self.camera = { move: vi.fn(), pos: { x: 0, y: 0 }, zoom: 1 };
	}
	return { GameScene: MockGameScene };
});

vi.mock("../../src/game/data/scene-configs.js", () => ({
	SCENE_CONFIGS: {
		hub: { name: "hub", bgColor: "#000" },
		office: { name: "office", bgColor: "#000" },
		village: { name: "village", bgColor: "#000" },
		station: { name: "station", bgColor: "#000" },
	},
}));

// ── Engine extraction mocks ─────────────────────────────────────────
vi.mock("../../src/game/engine-state.js", () => ({
	restoreWorldState: vi.fn(() => ({ savedPositions: null })),
	restoreAgentState: vi.fn(),
	flushWorldState: vi.fn(),
	startPeriodicFlush: vi.fn(() => vi.fn()),
}));

vi.mock("../../src/game/engine-events.js", () => ({
	wireEvents: vi.fn(() => vi.fn()),
}));

vi.mock("../../src/game/engine-simulation.js", () => ({
	tickSimulation: vi.fn(),
}));

vi.mock("../../src/game/engine-config.js", () => ({
	ENGINE_WIDTH: 800,
	ENGINE_HEIGHT: 500,
	OBJECT_POSITIONS: {
		coffeeMachine: { x: 200, y: 300 },
		whiteboard: { x: 400, y: 200 },
		snackTable: { x: 300, y: 350 },
		waterCooler: { x: 500, y: 250 },
		couch: { x: 600, y: 300 },
		plant: { x: 100, y: 200 },
		noticeBoard: { x: 700, y: 150 },
		merchantStall: { x: 300, y: 60 },
		foodBowlHub: { x: 200, y: 380 },
		foodBowlVillage: { x: 250, y: 350 },
		waterBowlOffice: { x: 580, y: 120 },
		waterBowlStation: { x: 550, y: 350 },
	},
	BRAIN_BOUNDS: { x: 0, y: 0, width: 800, height: 500 },
	PARTICLE_POOL_SIZE: 100,
	DEFAULT_PET_ROOMS: {},
	AGENT_WAKE_DELAY: 100,
	SCENE_TRANSITION_DURATION: 300,
	LOADING_FADE_DURATION: 300,
}));

// ── Scene registry and room switcher ────────────────────────────────
vi.mock("../../src/game/systems/scene-registry.js", () => {
	function MockSceneRegistry(this: Record<string, unknown>) {
		const self = this;
		self.registerScene = vi.fn();
		self.registerObject = vi.fn();
		self.getScene = vi.fn();
		self.setEntityRoom = vi.fn();
		self.getEntityRoom = vi.fn();
		self.isInTransit = vi.fn(() => false);
	}
	return { SceneRegistry: MockSceneRegistry };
});

vi.mock("../../src/game/systems/room-switcher.js", () => {
	const MockRoomSwitcher = vi.fn(function (this: Record<string, unknown>) {
		const self = this;
		self.update = vi.fn();
	});
	return { RoomSwitcher: MockRoomSwitcher };
});

vi.mock("../../src/game/actors/agent-scene-entity.js", () => ({
	AgentSceneEntity: vi.fn(),
}));

// ── Core system mocks ───────────────────────────────────────────────
vi.mock("../../src/game/systems/brain-system.js", () => {
	function MockBrainSystem(this: Record<string, unknown>) {
		const self = this;
		self.register = vi.fn();
		self.applyEvent = vi.fn();
		self.freeze = vi.fn();
		self.assignWork = vi.fn();
		self.releaseWork = vi.fn();
		self.getState = vi.fn(() => ({ state: "idle", params: { quoteFrequency: 0.1, socialRadius: 100 } }));
		self.getPosition = vi.fn();
		self.getAllEntries = vi.fn(() => new Map());
		self.update = vi.fn();
		self.applyQuirkOverrides = vi.fn();
	}
	return { BrainSystem: MockBrainSystem };
});

vi.mock("../../src/game/systems/bubble-system.js", () => {
	function MockBubbleSystem(this: Record<string, unknown>) {
		const self = this;
		self.register = vi.fn();
		self.showBubble = vi.fn();
		self.update = vi.fn();
	}
	return { BubbleSystem: MockBubbleSystem };
});

vi.mock("../../src/game/systems/talk/talk-engine.js", () => {
	function MockTalkEngine(this: Record<string, unknown>) {
		const self = this;
		self.register = vi.fn();
		self.activate = vi.fn();
		self.silence = vi.fn();
		self.update = vi.fn();
	}
	return { TalkEngine: MockTalkEngine };
});

vi.mock("../../src/game/systems/particle-system.js", () => {
	function MockParticlePool(this: Record<string, unknown>) {
		const self = this;
		self.getAll = vi.fn(() => []);
		self.spawnTrail = vi.fn();
		self.spawnDustBurst = vi.fn();
		self.update = vi.fn();
	}
	return { ParticlePool: MockParticlePool };
});

vi.mock("../../src/game/systems/emote-system.js", () => {
	function MockEmoteSystem(this: Record<string, unknown>) {
		const self = this;
		self.register = vi.fn();
		self.onEmote = vi.fn();
		self.update = vi.fn();
	}
	return { EmoteSystem: MockEmoteSystem };
});

vi.mock("../../src/game/systems/social-system.js", () => {
	function MockSocialSystem(this: Record<string, unknown>) {
		const self = this;
		self.register = vi.fn();
		self.onConversation = vi.fn();
		self.onCluster = vi.fn();
		self.update = vi.fn();
	}
	return { SocialSystem: MockSocialSystem };
});

vi.mock("../../src/game/systems/needs-system.js", () => {
	function MockNeedsSystem(this: Record<string, unknown>) {
		const self = this;
		self.register = vi.fn();
		self.getNeeds = vi.fn(() => ({ energy: 1, social: 1, focus: 1, morale: 1 }));
		self.update = vi.fn();
		self.serialize = vi.fn(() => ({}));
		self.restore = vi.fn();
	}
	return { NeedsSystem: MockNeedsSystem };
});

vi.mock("../../src/game/systems/director-system.js", () => {
	function MockDirectorSystem(this: Record<string, unknown>) {
		const self = this;
		self.onMouseMove = vi.fn();
		self.onMouseLeave = vi.fn();
		self.recordInteraction = vi.fn();
		self.update = vi.fn();
	}
	return { DirectorSystem: MockDirectorSystem };
});

vi.mock("../../src/game/systems/sensor-system.js", () => {
	function MockSensorSystem(this: Record<string, unknown>) {
		const self = this;
		self.register = vi.fn();
		self.update = vi.fn();
	}
	return { SensorSystem: MockSensorSystem };
});

vi.mock("../../src/game/systems/engagement-system.js", () => {
	function MockEngagementSystem(this: Record<string, unknown>) {
		const self = this;
		self.register = vi.fn();
		self.clearTaskCompleted = vi.fn();
		self.update = vi.fn();
	}
	return { EngagementSystem: MockEngagementSystem };
});

vi.mock("../../src/game/systems/ritual-system.js", () => {
	function MockRitualSystem(this: Record<string, unknown>) {
		const self = this;
		self.register = vi.fn();
		self.update = vi.fn();
	}
	return { RitualSystem: MockRitualSystem };
});

vi.mock("../../src/game/systems/tool-executor-system.js", () => {
	function MockToolExecutor(this: Record<string, unknown>) {
		const self = this;
		self.registerTools = vi.fn();
		self.update = vi.fn();
	}
	return { ToolExecutor: MockToolExecutor };
});

vi.mock("../../src/game/data/tool-registry.js", () => ({
	DEFAULT_TOOLS: [],
}));

vi.mock("../../src/game/systems/bt-system.js", () => {
	function MockBtSystem(this: Record<string, unknown>) {
		const self = this;
		self.register = vi.fn();
		self.registerPet = vi.fn();
		self.update = vi.fn(() => []);
		self.getAgent = vi.fn();
	}
	return { BtSystem: MockBtSystem, createStubDeps: vi.fn(() => ({})) };
});

vi.mock("../../src/game/brain/behavior-tree/pet-bt.js", () => ({
	createPetBT: vi.fn(() => ({ tree: {}, agent: {} })),
}));

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
	resolveCharacter: vi.fn(() => "char1"),
}));

vi.mock("../../src/game/config/domain-map.js", () => ({
	resolveSettingForDomain: vi.fn(() => "hub"),
}));

vi.mock("../../src/game/sprites/sprite-loader.js", () => ({
	preloadSpriteRegistry: vi.fn().mockResolvedValue(new Map()),
}));

vi.mock("../../src/game/store/dashboard-store.js", () => {
	const MockDashboardStore = vi.fn(function (this: Record<string, unknown>) {
		const self = this;
		self.agents = [];
		self.selectedAgent = null;
		self.followedAgent = null;
		self.llmStatus = new Map();
		self.taskLockedAgents = new Set();
		self.selectAgent = vi.fn();
		self.selectTab = vi.fn();
		self.startFollow = vi.fn();
		self.stopFollow = vi.fn();
		self.setAgents = vi.fn();
		self.setConnectionStatus = vi.fn();
		self.setActivityLog = vi.fn();
		self.pushAgentResponse = vi.fn();
		self.pushAgentThought = vi.fn();
		self.pushWorldEvent = vi.fn();
		self.setLlmStatus = vi.fn();
		self.wakeAgent = vi.fn().mockResolvedValue(undefined);
		self.beginBatch = vi.fn();
		self.endBatch = vi.fn();
		self.updatePositions = vi.fn();
		self.setAgentTarget = vi.fn();
		self.clearAgentTarget = vi.fn();
		self.setAgentState = vi.fn();
		self.addEventListener = vi.fn();
		self.removeEventListener = vi.fn();
		self.syncCliSessionFromEnvironment = vi.fn();
	});
	return { DashboardStore: MockDashboardStore };
});

vi.mock("../../src/game/actors/cursor-spirit.js", () => {
	function MockCursorSpirit(this: Record<string, unknown>) {
		const self = this;
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
	function MockDayClock(this: Record<string, unknown>) {
		const self = this;
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
	function MockWorldAmbience(this: Record<string, unknown>) {
		const self = this;
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
	function MockMemorySystem(this: Record<string, unknown>) {
		const self = this;
		self.register = vi.fn();
		self.getMemory = vi.fn(() => ({ milestones: [], recentEvents: [], moodLog: [], quirks: [], opinions: [] }));
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
	function MockQuirkSystem(this: Record<string, unknown>) {
		const self = this;
		self.register = vi.fn();
		self.getQuirks = vi.fn(() => []);
		self.getOverrides = vi.fn(() => ({}));
		self.getQuirkPhrases = vi.fn(() => []);
		self.hasQuirk = vi.fn(() => false);
	}
	return { QuirkSystem: MockQuirkSystem };
});

vi.mock("../../src/game/systems/world-event-scheduler.js", () => {
	function MockWorldEventScheduler(this: Record<string, unknown>) {
		const self = this;
		self.setInteractionSubmitter = vi.fn();
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
	function MockRelationshipSystem(this: Record<string, unknown>) {
		const self = this;
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
	let petCounter = 0;
	function MockPetActor(this: Record<string, unknown>) {
		const self = this;
		self.entityId = `pet-${petCounter++}`;
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
		{ type: "cat", speed: 0.4, phrases: ["meow"], behaviors: { interactRadius: 50, needsEffect: {}, sleepChance: 0.008, wanderRadius: 120 } },
		{ type: "dog", speed: 0.5, phrases: ["woof"], behaviors: { interactRadius: 60, needsEffect: {}, sleepChance: 0.005, wanderRadius: 150 } },
		{ type: "bird", speed: 0.3, phrases: ["chirp"], behaviors: { interactRadius: 40, needsEffect: {}, sleepChance: 0.01, wanderRadius: 80 } },
		{ type: "fish", speed: 0, phrases: ["blub"], behaviors: { interactRadius: 60, needsEffect: {}, sleepChance: 0, wanderRadius: 0 } },
	],
	getPetDefinition: vi.fn(),
}));

vi.mock("../../src/game/actors/coffee-machine.js", () => {
	function MockCoffeeMachine(this: Record<string, unknown>) { const s = this; s.objectId = "coffee-machine"; s.objectType = "appliance"; s.pos = { x: 0, y: 0 }; s.getInteractionPoint = vi.fn(() => ({ x: 0, y: 0 })); }
	return { CoffeeMachine: MockCoffeeMachine };
});
vi.mock("../../src/game/actors/whiteboard-actor.js", () => {
	function MockWhiteboardActor(this: Record<string, unknown>) { const s = this; s.objectId = "whiteboard"; s.objectType = "furniture"; s.pos = { x: 0, y: 0 }; s.getInteractionPoint = vi.fn(() => ({ x: 0, y: 0 })); }
	return { WhiteboardActor: MockWhiteboardActor };
});
vi.mock("../../src/game/actors/snack-table.js", () => {
	function MockSnackTable(this: Record<string, unknown>) { const s = this; s.objectId = "snack-table"; s.objectType = "furniture"; s.pos = { x: 0, y: 0 }; s.getInteractionPoint = vi.fn(() => ({ x: 0, y: 0 })); }
	return { SnackTable: MockSnackTable };
});
vi.mock("../../src/game/actors/water-cooler.js", () => {
	function MockWaterCooler(this: Record<string, unknown>) { const s = this; s.objectId = "water-cooler"; s.objectType = "appliance"; s.pos = { x: 0, y: 0 }; s.getInteractionPoint = vi.fn(() => ({ x: 0, y: 0 })); }
	return { WaterCooler: MockWaterCooler };
});
vi.mock("../../src/game/actors/couch-actor.js", () => {
	function MockCouchActor(this: Record<string, unknown>) { const s = this; s.objectId = "couch"; s.objectType = "furniture"; s.pos = { x: 0, y: 0 }; s.getInteractionPoint = vi.fn(() => ({ x: 0, y: 0 })); }
	return { CouchActor: MockCouchActor };
});
vi.mock("../../src/game/actors/plant-actor.js", () => {
	function MockPlantActor(this: Record<string, unknown>) { const s = this; s.objectId = "plant"; s.objectType = "decoration"; s.pos = { x: 0, y: 0 }; s.getInteractionPoint = vi.fn(() => ({ x: 0, y: 0 })); }
	return { PlantActor: MockPlantActor };
});
vi.mock("../../src/game/actors/notice-board.js", () => {
	function MockNoticeBoard(this: Record<string, unknown>) { const s = this; s.objectId = "notice-board"; s.objectType = "furniture"; s.pos = { x: 0, y: 0 }; s.getInteractionPoint = vi.fn(() => ({ x: 0, y: 0 })); }
	return { NoticeBoard: MockNoticeBoard };
});
vi.mock("../../src/game/actors/food-bowl.js", () => {
	function MockFoodBowl(this: Record<string, unknown>, objectId?: string) { const s = this; s.objectId = objectId ?? "food-bowl"; s.objectType = "food"; s.pos = { x: 0, y: 0 }; s.getInteractionPoint = vi.fn(() => ({ x: 0, y: 0 })); }
	return { FoodBowl: MockFoodBowl };
});
vi.mock("../../src/game/actors/water-bowl.js", () => {
	function MockWaterBowl(this: Record<string, unknown>, objectId?: string) { const s = this; s.objectId = objectId ?? "water-bowl"; s.objectType = "drink"; s.pos = { x: 0, y: 0 }; s.getInteractionPoint = vi.fn(() => ({ x: 0, y: 0 })); }
	return { WaterBowl: MockWaterBowl };
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
import { wireEvents } from "../../src/game/engine-events.js";
import { RoomSwitcher } from "../../src/game/systems/room-switcher.js";
import { DashboardStore } from "../../src/game/store/dashboard-store.js";
import * as ex from "excalibur";

function createMockProvider(): DataProvider {
	return {
		start: vi.fn().mockResolvedValue(undefined),
		stop: vi.fn(),
		getWorldState: vi.fn().mockResolvedValue(null),
		getDashboardAgents: vi.fn().mockResolvedValue([]),
		reloadDashboardAgents: vi.fn().mockResolvedValue([]),
		onAction: vi.fn().mockReturnValue(() => {}),
		onEntityUpdate: vi.fn().mockReturnValue(() => {}),
		onConnectionStatus: vi.fn().mockReturnValue(() => {}),
		onDashboardAgentsChange: vi.fn().mockReturnValue(() => {}),
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
		// Canvas + loading overlay + 5 Lit overlays + council sidebar + detail modal = 9 children
		expect(container.children.length).toBe(9);
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

		// Event wiring is now delegated to wireEvents()
		expect(wireEvents).toHaveBeenCalled();
	});

	describe("follow across rooms", () => {
		function getTransferCallback(): (entityId: string, from: string, to: string, reason: string) => void {
			const calls = vi.mocked(RoomSwitcher).mock.calls;
			const config = calls[calls.length - 1][0] as unknown as Record<string, unknown>;
			return config.onTransferComplete as (entityId: string, from: string, to: string, reason: string) => void;
		}

		function getStoreInstance(): Record<string, unknown> {
			const instances = vi.mocked(DashboardStore).mock.instances;
			return instances[instances.length - 1] as unknown as Record<string, unknown>;
		}

		function getEngineInstance(): Record<string, unknown> {
			const instances = vi.mocked(ex.Engine).mock.instances;
			return instances[instances.length - 1] as unknown as Record<string, unknown>;
		}

		it("switches scene when followed agent transfers rooms", () => {
			createAgentWorld({
				container: document.createElement("div"),
				provider: createMockProvider(),
				spriteBasePath: "/test",
			});
			const store = getStoreInstance();
			store.followedAgent = "alice";

			getTransferCallback()("alice", "hub", "office", "transfer");

			expect(getEngineInstance().goToScene).toHaveBeenCalledWith("office", expect.any(Object));
		});

		it("does NOT switch scene when a different agent transfers", () => {
			createAgentWorld({
				container: document.createElement("div"),
				provider: createMockProvider(),
				spriteBasePath: "/test",
			});
			const store = getStoreInstance();
			store.followedAgent = "alice";
			(getEngineInstance().goToScene as ReturnType<typeof vi.fn>).mockClear();

			getTransferCallback()("bob", "hub", "office", "transfer");

			expect(getEngineInstance().goToScene).not.toHaveBeenCalledWith("office", expect.any(Object));
		});

		it("does NOT switch scene when no agent is followed", () => {
			createAgentWorld({
				container: document.createElement("div"),
				provider: createMockProvider(),
				spriteBasePath: "/test",
			});
			(getEngineInstance().goToScene as ReturnType<typeof vi.fn>).mockClear();

			getTransferCallback()("alice", "hub", "office", "transfer");

			expect(getEngineInstance().goToScene).not.toHaveBeenCalledWith("office", expect.any(Object));
		});

		it("does NOT call selectAgent during follow-triggered scene switch", () => {
			createAgentWorld({
				container: document.createElement("div"),
				provider: createMockProvider(),
				spriteBasePath: "/test",
			});
			const store = getStoreInstance();
			store.followedAgent = "alice";
			(store.selectAgent as ReturnType<typeof vi.fn>).mockClear();

			getTransferCallback()("alice", "hub", "office", "transfer");

			expect(store.selectAgent).not.toHaveBeenCalled();
		});
	});
});
