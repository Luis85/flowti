import { describe, it, expect, vi } from "vitest";

vi.mock("excalibur", () => ({
	Actor: class MockActor {
		pos = { x: 0, y: 0 };
		z = 0;
		graphics = { opacity: 1, use: vi.fn() };
		actions = {
			moveBy: vi.fn().mockReturnThis(),
			fade: vi.fn().mockReturnThis(),
			die: vi.fn().mockReturnThis(),
		};
		kill = vi.fn();
		constructor(opts?: Record<string, unknown>) {
			if (opts) {
				this.pos.x = (opts.x as number) ?? 0;
				this.pos.y = (opts.y as number) ?? 0;
			}
		}
	},
	vec: (x: number, y: number) => ({ x, y }),
}));

import { ItemPopActor } from "../../../src/game/actors/item-pop-actor.js";

describe("ItemPopActor", () => {
	it("creates at specified station position", () => {
		const pop = new ItemPopActor("assets/Items/Food/Onigiri.png", 100, 200);
		expect(pop.pos.x).toBe(100);
		expect(pop.pos.y).toBe(200);
	});

	it("stores the sprite path", () => {
		const pop = new ItemPopActor("assets/Items/Food/Fish.png", 0, 0);
		expect(pop.spritePath).toBe("assets/Items/Food/Fish.png");
	});

	it("play() starts the float-and-fade animation", () => {
		const pop = new ItemPopActor("assets/Items/Food/Onigiri.png", 50, 50);
		pop.play();
		expect(pop.actions.moveBy).toHaveBeenCalled();
		expect(pop.actions.fade).toHaveBeenCalled();
	});

	it("self-destructs after animation", () => {
		const pop = new ItemPopActor("assets/Items/Food/Onigiri.png", 50, 50);
		pop.play();
		expect(pop.actions.die).toHaveBeenCalled();
	});
});
