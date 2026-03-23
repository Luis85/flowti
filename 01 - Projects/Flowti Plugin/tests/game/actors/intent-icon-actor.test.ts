import { describe, it, expect, vi } from "vitest";

vi.mock("excalibur", () => ({
	Actor: class MockActor {
		pos = { x: 0, y: 0 };
		z = 0;
		graphics = { opacity: 1, use: vi.fn(), flipHorizontal: false };
		actions = { fade: vi.fn().mockReturnThis(), die: vi.fn().mockReturnThis() };
		kill = vi.fn();
		constructor(opts?: Record<string, unknown>) {
			if (opts) {
				this.pos.x = (opts.x as number) ?? 0;
				this.pos.y = (opts.y as number) ?? 0;
				if (opts.z) this.z = opts.z as number;
			}
		}
	},
	vec: (x: number, y: number) => ({ x, y }),
}));

import { IntentIconActor } from "../../../src/game/actors/intent-icon-actor.js";

describe("IntentIconActor", () => {
	it("creates at the specified offset position", () => {
		const icon = new IntentIconActor("assets/Items/Food/Onigiri.png");
		expect(icon.pos.x).toBe(8);
		expect(icon.pos.y).toBe(-14);
	});

	it("starts with zero opacity for fade-in", () => {
		const icon = new IntentIconActor("assets/Items/Food/Onigiri.png");
		expect(icon.graphics.opacity).toBe(0);
	});

	it("stores the sprite path", () => {
		const icon = new IntentIconActor("assets/Items/Food/Onigiri.png");
		expect(icon.spritePath).toBe("assets/Items/Food/Onigiri.png");
	});

	it("updates bob offset over time", () => {
		const icon = new IntentIconActor("assets/Items/Food/Onigiri.png");
		const initialY = icon.pos.y;
		icon.tickBob(500); // quarter period: sin(pi/2) = 1
		expect(icon.pos.y).not.toBe(initialY);
	});

	it("fadeIn calls actions.fade", () => {
		const icon = new IntentIconActor("assets/Items/Food/Onigiri.png");
		icon.fadeIn();
		expect(icon.actions.fade).toHaveBeenCalledWith(1, 200);
	});

	it("fadeOut calls actions.fade then die", () => {
		const icon = new IntentIconActor("assets/Items/Food/Onigiri.png");
		icon.fadeOut(true);
		expect(icon.actions.fade).toHaveBeenCalledWith(0, 200);
		expect(icon.actions.die).toHaveBeenCalled();
	});

	it("fadeOut without kill skips die", () => {
		const icon = new IntentIconActor("assets/Items/Food/Onigiri.png");
		icon.fadeOut(false);
		expect(icon.actions.fade).toHaveBeenCalledWith(0, 200);
		expect(icon.actions.die).not.toHaveBeenCalled();
	});
});
