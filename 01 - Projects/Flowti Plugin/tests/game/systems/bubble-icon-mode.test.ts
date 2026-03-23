import { describe, it, expect, vi } from "vitest";

vi.mock("excalibur", () => ({
	Actor: class MockActor {
		pos = { x: 0, y: 0 };
		graphics = { use: vi.fn(), opacity: 1, offset: { x: 0, y: 0 } };
		actions = { fade: vi.fn().mockReturnThis(), die: vi.fn().mockReturnThis() };
		scene = {};
		kill = vi.fn();
		addChild = vi.fn();
		children = [];
		constructor(opts?: Record<string, unknown>) {
			if (opts) {
				this.pos.x = (opts.x as number) ?? 0;
				this.pos.y = (opts.y as number) ?? 0;
			}
		}
	},
	Canvas: class MockCanvas {
		constructor() { /* noop */ }
	},
	vec: (x: number, y: number) => ({ x, y }),
	Color: { fromHex: () => ({}) },
}));

import { BubbleActor, type BubbleActorConfig } from "../../../src/game/actors/bubble-actor.js";

describe("BubbleActor — icon mode", () => {
	it("accepts optional iconPath in config", () => {
		const config: BubbleActorConfig = {
			text: "food",
			kind: "thought",
			x: 0,
			y: 0,
			iconPath: "assets/Items/Food/Onigiri.png",
		};
		expect(config.iconPath).toBe("assets/Items/Food/Onigiri.png");
	});

	it("config without iconPath is valid", () => {
		const config: BubbleActorConfig = {
			text: "hello",
			kind: "speech",
			x: 0,
			y: 0,
		};
		expect(config.iconPath).toBeUndefined();
	});
});
