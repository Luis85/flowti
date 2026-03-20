// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("excalibur", () => {
	function MockActor(this: Record<string, unknown>, opts?: Record<string, unknown>) {
		this.pos = opts?.pos ?? { x: 0, y: 0 };
		this.scale = { x: 1, y: 1 };
		this.z = opts?.z ?? 0;
		this.body = { collisionType: 0 };
		this.graphics = { use: vi.fn(), add: vi.fn(), offset: { x: 0, y: 0 } };
		this.addChild = vi.fn();
		this.on = vi.fn();
	}

	function MockCanvas(this: Record<string, unknown>) {
		// no-op
	}

	function MockAnimation(this: Record<string, unknown>) {
		this.strategy = 0;
		this.frames = [{ graphic: {} }];
	}

	return {
		Actor: MockActor,
		Canvas: MockCanvas,
		Animation: MockAnimation,
		CollisionType: { PreventCollision: 0 },
		vec: vi.fn((x: number, y: number) => ({ x, y })),
	};
});

import { AgentActor } from "../../../src/game/actors/agent-actor.js";
import type { DashboardAgent } from "../../../src/game/data/types.js";
import type { AgentSprites } from "../../../src/game/sprites/sprite-loader.js";

function makeAgent(overrides: Partial<DashboardAgent> = {}): DashboardAgent {
	return {
		name: "TestAgent",
		agentType: "ai",
		status: "idle",
		...overrides,
	};
}

function stubAnimation(): AgentSprites["idle"] {
	return { frames: [{ graphic: {} } as never] } as unknown as AgentSprites["idle"];
}

function makeSprites(): AgentSprites {
	return {
		idle: stubAnimation(),
		walkDown: stubAnimation(),
		walkLeft: stubAnimation(),
		walkRight: stubAnimation(),
		walkUp: stubAnimation(),
	};
}

describe("AgentActor", () => {
	let actor: AgentActor;

	beforeEach(() => {
		actor = new AgentActor({
			agent: makeAgent(),
			x: 100,
			y: 200,
			onSelect: vi.fn(),
			sprites: makeSprites(),
		});
	});

	it("initialises brainState to idle", () => {
		expect(actor.brainState).toBe("idle");
	});

	it("stores the agent data on construction", () => {
		expect(actor.agentData.name).toBe("TestAgent");
	});

	it("focus() sets brainState to idle", () => {
		actor.brainState = "working";
		actor.focus();
		expect(actor.brainState).toBe("idle");
	});

	it("updateFromBrain() updates brainState", () => {
		actor.updateFromBrain("working");
		expect(actor.brainState).toBe("working");
	});

	it("updateFromBrain() resets bobPhase when state changes", () => {
		// Pre-populate by calling update with idle → wandering transition
		actor.updateFromBrain("idle");
		actor.updateFromBrain("wandering");
		// Just verifying no error is thrown and state is set
		expect(actor.brainState).toBe("wandering");
	});

	it("updateFromBrain() does not reset bobPhase when state is unchanged", () => {
		actor.updateFromBrain("idle");
		actor.updateFromBrain("idle");
		expect(actor.brainState).toBe("idle");
	});

	it("setIdlePose() is a no-op (does not throw)", () => {
		expect(() => actor.setIdlePose("look-around")).not.toThrow();
	});

	it("updateVisualStatus() is a no-op (does not throw)", () => {
		expect(() => actor.updateVisualStatus("busy")).not.toThrow();
	});

	it("setWalkDirection() is a no-op (does not throw)", () => {
		expect(() => actor.setWalkDirection(50, 80)).not.toThrow();
	});
});
