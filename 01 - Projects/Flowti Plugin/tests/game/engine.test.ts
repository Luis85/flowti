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

	it("sets tabindex on container for keyboard focus", () => {
		const container = document.createElement("div");
		createAgentWorld({ container, provider: createMockProvider(), spriteBasePath: "/test" });
		expect(container.getAttribute("tabindex")).toBe("0");
	});

	it("dispose removes keyboard listeners", () => {
		const container = document.createElement("div");
		const removeSpy = vi.spyOn(container, "removeEventListener");
		const handle = createAgentWorld({ container, provider: createMockProvider(), spriteBasePath: "/test" });

		handle.dispose();

		const removedEvents = removeSpy.mock.calls.map((c) => c[0]);
		expect(removedEvents).toContain("keydown");
		expect(removedEvents).toContain("keyup");
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
