// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("excalibur", () => {
	function MockActor(this: Record<string, unknown>, opts?: Record<string, unknown>) {
		this.pos = opts?.pos ?? { x: 0, y: 0 };
		this.scale = { x: 1, y: 1 };
		this.z = opts?.z ?? 0;
		this.body = { collisionType: 0 };
		this.graphics = { use: vi.fn(), add: vi.fn(), offset: { x: 0, y: 0 }, flipHorizontal: false };
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

	function MockColor(this: Record<string, unknown>, r: number, g: number, b: number, a: number) {
		this.r = r; this.g = g; this.b = b; this.a = a;
	}
	(MockColor as unknown as Record<string, unknown>).Transparent = new (MockColor as unknown as new (r: number, g: number, b: number, a: number) => unknown)(0, 0, 0, 0);

	return {
		Actor: MockActor,
		Canvas: MockCanvas,
		Animation: MockAnimation,
		CollisionType: { PreventCollision: 0 },
		vec: vi.fn((x: number, y: number) => ({ x, y })),
		Color: MockColor,
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

	it("initialises intent to idle", () => {
		expect(actor.intent).toBe("idle");
	});

	it("stores the agent data on construction", () => {
		expect(actor.agentData.name).toBe("TestAgent");
	});

	it("focus() sets intent to idle", () => {
		actor.intent = "working";
		actor.focus();
		expect(actor.intent).toBe("idle");
	});

	it("updateIntent() updates intent", () => {
		actor.updateIntent("working");
		expect(actor.intent).toBe("working");
	});

	it("updateIntent() resets bobPhase when intent changes", () => {
		actor.updateIntent("idle");
		actor.updateIntent("seeking");
		expect(actor.intent).toBe("seeking");
	});

	it("updateIntent() does not reset bobPhase when intent is unchanged", () => {
		actor.updateIntent("idle");
		actor.updateIntent("idle");
		expect(actor.intent).toBe("idle");
	});

	it("setIdlePose() is a no-op (does not throw)", () => {
		expect(() => actor.setIdlePose("look-around")).not.toThrow();
	});

	it("updateVisualStatus() is a no-op (does not throw)", () => {
		expect(() => actor.updateVisualStatus("busy")).not.toThrow();
	});

	describe("facingDirection", () => {
		it("applyFacing left flips sprite horizontally", () => {
			actor.applyFacing("left");
			expect(actor.graphics.flipHorizontal).toBe(true);
		});

		it("applyFacing right does not flip sprite", () => {
			actor.applyFacing("right");
			expect(actor.graphics.flipHorizontal).toBe(false);
		});

		it("applyFacing toggles between directions", () => {
			actor.applyFacing("left");
			expect(actor.graphics.flipHorizontal).toBe(true);
			actor.applyFacing("right");
			expect(actor.graphics.flipHorizontal).toBe(false);
		});
	});

	describe("standing order indicator", () => {
		it("isStandingOrderActive() defaults to false", () => {
			expect(actor.isStandingOrderActive()).toBe(false);
		});

		it("setStandingOrderActive(true) activates the indicator", () => {
			actor.setStandingOrderActive(true);
			expect(actor.isStandingOrderActive()).toBe(true);
		});

		it("setStandingOrderActive(false) deactivates the indicator", () => {
			actor.setStandingOrderActive(true);
			actor.setStandingOrderActive(false);
			expect(actor.isStandingOrderActive()).toBe(false);
		});
	});

	describe("capability unlock", () => {
		it("getCapabilityIcon() defaults to empty string", () => {
			expect(actor.getCapabilityIcon()).toBe("");
		});

		it("showCapabilityUnlock() sets the icon", () => {
			actor.showCapabilityUnlock("🔓");
			expect(actor.getCapabilityIcon()).toBe("🔓");
		});

		it("showCapabilityUnlock() accepts a custom duration", () => {
			actor.showCapabilityUnlock("✨", 5000);
			expect(actor.getCapabilityIcon()).toBe("✨");
		});

		it("icon clears after timer expires via onPreUpdate", () => {
			actor.showCapabilityUnlock("🔓", 100);
			// Simulate a delta that exceeds the timer
			(actor as unknown as { onPreUpdate: (_e: unknown, d: number) => void }).onPreUpdate(null, 200);
			expect(actor.getCapabilityIcon()).toBe("");
		});
	});
});
