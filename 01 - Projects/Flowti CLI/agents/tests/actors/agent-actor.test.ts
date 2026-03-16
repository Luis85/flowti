// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";

vi.mock("excalibur", () => {
	class MockActor {
		pos = { x: 0, y: 0 };
		scale = { x: 1, y: 1 };
		width = 0;
		height = 0;
		anchor = { x: 0, y: 0 };
		graphics = {
			add: vi.fn(),
			use: vi.fn(),
		};
		on = vi.fn();
		children: unknown[] = [];
		addChild = vi.fn((c: unknown) => { this.children.push(c); });
		constructor(config: Record<string, unknown>) {
			Object.assign(this, config);
			if (config.pos) {
				this.pos = config.pos as { x: number; y: number };
			}
		}
		onInitialize = vi.fn();
		onPreUpdate = vi.fn();
		isKilled = () => false;
	}
	return {
		Actor: MockActor,
		vec: (x: number, y: number) => ({ x, y }),
		Canvas: class {
			constructor(public config: Record<string, unknown>) {}
		},
		AnimationStrategy: { Loop: 0 },
	};
});

import { AgentActor } from "../../src/actors/agent-actor.js";
import type { AgentSprites } from "../../src/sprites/sprite-loader.js";
import type { DashboardAgent } from "../../src/data/types.js";

function mockAgent(overrides: Partial<DashboardAgent> = {}): DashboardAgent {
	return {
		name: "Test Agent",
		agentType: "ai",
		status: "idle",
		domain: "engineering",
		mood: "neutral",
		persona: "Testy",
		personality: [],
		...overrides,
	} as DashboardAgent;
}

function mockSprites(): AgentSprites {
	const anim = { strategy: null, clone: function() { return this; } };
	return {
		idle: anim as never,
		walkDown: anim as never,
		walkLeft: anim as never,
		walkRight: anim as never,
		walkUp: anim as never,
	};
}

describe("AgentActor", () => {
	it("creates with idle pose", () => {
		const actor = new AgentActor({
			agent: mockAgent(),
			x: 100, y: 200,
			onSelect: vi.fn(),
			sprites: mockSprites(),
		});
		expect(actor.graphics.use).toHaveBeenCalledWith("idle");
	});

	it("registers all five animation slots plus label", () => {
		const sprites = mockSprites();
		const actor = new AgentActor({
			agent: mockAgent(),
			x: 100, y: 200,
			onSelect: vi.fn(),
			sprites,
		});
		const addCalls = (actor.graphics.add as ReturnType<typeof vi.fn>).mock.calls;
		const names = addCalls.map((c: unknown[]) => c[0]);
		expect(names).toContain("idle");
		expect(names).toContain("walk-down");
		expect(names).toContain("walk-left");
		expect(names).toContain("walk-right");
		expect(names).toContain("walk-up");
		expect(names).toContain("label");
	});

	it("switches to walk-right when walking-to with positive dx", () => {
		const actor = new AgentActor({
			agent: mockAgent(),
			x: 100, y: 200,
			onSelect: vi.fn(),
			sprites: mockSprites(),
		});
		actor.updateFromBrain("walking-to", { kind: "workstation", x: 300, y: 200 });
		expect(actor.graphics.use).toHaveBeenCalledWith("walk-right");
	});

	it("switches to walk-down when walking-to with positive dy", () => {
		const actor = new AgentActor({
			agent: mockAgent(),
			x: 100, y: 200,
			onSelect: vi.fn(),
			sprites: mockSprites(),
		});
		actor.updateFromBrain("walking-to", { kind: "workstation", x: 100, y: 400 });
		expect(actor.graphics.use).toHaveBeenCalledWith("walk-down");
	});

	it("returns to idle when brain state is working", () => {
		const actor = new AgentActor({
			agent: mockAgent(),
			x: 100, y: 200,
			onSelect: vi.fn(),
			sprites: mockSprites(),
		});
		actor.updateFromBrain("walking-to", { kind: "workstation", x: 300, y: 200 });
		actor.updateFromBrain("working", { kind: "none" });
		expect(actor.graphics.use).toHaveBeenLastCalledWith("idle");
	});
});
