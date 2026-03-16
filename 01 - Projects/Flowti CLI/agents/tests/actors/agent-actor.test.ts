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
	const frame = { graphic: { name: "idle-frame-0" } };
	const anim = { frames: [frame] };
	return {
		idle: anim as never,
	};
}

describe("AgentActor", () => {
	it("uses frame 0 of idle spritesheet as static graphic on construction", () => {
		const sprites = mockSprites();
		const actor = new AgentActor({
			agent: mockAgent(),
			x: 100, y: 200,
			onSelect: vi.fn(),
			sprites,
		});
		expect(actor.graphics.use).toHaveBeenCalledWith(sprites.idle.frames[0].graphic);
	});

	it("adds label child actor on construction", () => {
		const actor = new AgentActor({
			agent: mockAgent(),
			x: 100, y: 200,
			onSelect: vi.fn(),
			sprites: mockSprites(),
		});
		// label + badge children are added
		expect((actor.addChild as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThanOrEqual(1);
	});

	it("updateFromBrain updates brainState without switching animations", () => {
		const actor = new AgentActor({
			agent: mockAgent(),
			x: 100, y: 200,
			onSelect: vi.fn(),
			sprites: mockSprites(),
		});
		actor.updateFromBrain("working");
		expect(actor.brainState).toBe("working");
		// graphics.use was called only once during construction
		expect((actor.graphics.use as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1);
	});

	it("focus() sets brainState to idle", () => {
		const actor = new AgentActor({
			agent: mockAgent(),
			x: 100, y: 200,
			onSelect: vi.fn(),
			sprites: mockSprites(),
		});
		actor.updateFromBrain("walking-to");
		expect(actor.brainState).toBe("walking-to");
		actor.focus();
		expect(actor.brainState).toBe("idle");
	});

	it("setWalkDirection is a no-op and does not throw", () => {
		const actor = new AgentActor({
			agent: mockAgent(),
			x: 100, y: 200,
			onSelect: vi.fn(),
			sprites: mockSprites(),
		});
		expect(() => actor.setWalkDirection(300, 200)).not.toThrow();
	});
});
