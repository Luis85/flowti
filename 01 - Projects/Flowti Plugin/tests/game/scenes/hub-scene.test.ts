// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Excalibur mock ────────────────────────────────────────────────────

vi.mock("excalibur", () => {
	function MockActor(this: Record<string, unknown>, opts?: Record<string, unknown>) {
		this.pos = opts?.pos ?? { x: 0, y: 0 };
		this.scale = { x: 1, y: 1 };
		this.z = opts?.z ?? 0;
		this.body = { collisionType: 0 };
		this.graphics = { use: vi.fn(), add: vi.fn(), offset: { x: 0, y: 0 } };
		this.addChild = vi.fn();
		this.on = vi.fn();
		this.kill = vi.fn();
	}

	function MockScene(this: Record<string, unknown>) {
		this.add = vi.fn();
		this.engine = null;
		this.camera = { move: vi.fn(), pos: { x: 0, y: 0 }, zoom: 1 };
	}

	function MockLabel(this: Record<string, unknown>) {
		this.text = "";
		this.font = null;
		this.body = { collisionType: 0 };
		this.add = vi.fn();
	}

	function MockCanvas(this: Record<string, unknown>) {
		// no-op
	}

	function MockFont(this: Record<string, unknown>) {
		// no-op
	}

	return {
		Scene: MockScene,
		Actor: MockActor,
		Label: MockLabel,
		Canvas: MockCanvas,
		Font: MockFont,
		Color: { fromHex: vi.fn(() => ({})) },
		CollisionType: { PreventCollision: 0 },
		FontUnit: { Px: 0 },
		TextAlign: { Center: 0, Right: 1 },
		vec: vi.fn((x: number, y: number) => ({ x, y })),
	};
});

// ── Dependency mocks ──────────────────────────────────────────────────

vi.mock("../../../src/game/actors/agent-actor.js", () => {
	function MockAgentActor(this: Record<string, unknown>, opts: Record<string, unknown>) {
		this.agentData = opts.agent;
		this.brainState = "idle";
		this.z = 0;
		this.pos = { x: opts.x ?? 0, y: opts.y ?? 0 };
		this.graphics = { use: vi.fn() };
		this.updateVisualStatus = vi.fn();
		this.kill = vi.fn();
	}
	return { AgentActor: MockAgentActor };
});

vi.mock("../../../src/game/actors/doorway-actor.js", () => {
	function MockDoorwayActor(this: Record<string, unknown>) {
		this.z = 0;
	}
	return { DoorwayActor: MockDoorwayActor };
});

vi.mock("../../../src/game/config/settings.js", () => ({
	SCENE_THEMES: {
		office: { label: "Office" },
		village: { label: "Village" },
		station: { label: "Station" },
		hub: { label: "Hub" },
	},
}));

vi.mock("../../../src/game/config/domain-map.js", () => ({
	resolveSettingForDomain: vi.fn((domain: string) => {
		if (domain === "engineering") return "office";
		return "hub";
	}),
}));

vi.mock("../../../src/game/sprites/character-pool.js", () => ({
	resolveCharacter: vi.fn(() => "knight"),
}));

import { HubScene } from "../../../src/game/scenes/hub-scene.js";
import type { DashboardAgent } from "../../../src/game/data/types.js";
import type { AgentSprites } from "../../../src/game/sprites/sprite-loader.js";

function makeAgent(name: string, domain?: string): DashboardAgent {
	return { name, agentType: "ai", status: "idle", domain };
}

describe("HubScene", () => {
	let scene: HubScene;

	beforeEach(() => {
		scene = new HubScene({
			onSceneChange: vi.fn(),
			onAgentSelect: vi.fn(),
		});
	});

	it("getAgentActor() returns undefined for an unknown agent", () => {
		expect(scene.getAgentActor("nobody")).toBeUndefined();
	});

	it("updateAgents() with empty agent list does not throw", () => {
		expect(() => scene.updateAgents([])).not.toThrow();
	});

	it("updateAgents() with empty sprite registry skips actor creation", () => {
		scene.setSpriteRegistry(new Map<string, AgentSprites>());
		const agent = makeAgent("Alice");
		scene.updateAgents([agent]);
		// No sprites registered, so no actor should be created
		expect(scene.getAgentActor("Alice")).toBeUndefined();
	});

	it("updateAgents() with a sprite entry creates an actor", () => {
		const sprites = {
			idle: { frames: [{ graphic: {} }] },
		} as unknown as AgentSprites;
		const registry = new Map<string, AgentSprites>([["knight", sprites]]);
		scene.setSpriteRegistry(registry);

		const agent = makeAgent("Alice"); // resolves to hub
		scene.updateAgents([agent]);

		// Actor should now be registered and retrievable
		expect(scene.getAgentActor("Alice")).toBeDefined();
	});

	it("updateAgents() removes stale actors when an agent disappears", () => {
		const sprites = {
			idle: { frames: [{ graphic: {} }] },
		} as unknown as AgentSprites;
		const registry = new Map<string, AgentSprites>([["knight", sprites]]);
		scene.setSpriteRegistry(registry);

		scene.updateAgents([makeAgent("Alice")]);
		expect(scene.getAgentActor("Alice")).toBeDefined();

		// Remove Alice from the list — should be killed and removed
		scene.updateAgents([]);
		expect(scene.getAgentActor("Alice")).toBeUndefined();
	});

	it("updateIterationBadge() does not throw when label is not initialised", () => {
		expect(() => scene.updateIterationBadge("Iteration 5")).not.toThrow();
	});

	it("updateConnectionStatus() does not throw when connectionLabel is not initialised", () => {
		expect(() => scene.updateConnectionStatus("connected")).not.toThrow();
	});
});
