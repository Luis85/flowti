// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";

vi.mock("excalibur", () => {
	function MockActor(this: Record<string, unknown>) {
		this.pos = { x: 0, y: 0 };
		this.on = vi.fn();
		this.graphics = { use: vi.fn(), opacity: 1 };
	}
	return {
		Actor: MockActor,
		vec: vi.fn((x: number, y: number) => ({ x, y })),
		CollisionType: { PreventCollision: 0 },
		Canvas: function MockCanvas() { return; },
	};
});

import { InteractableActor } from "../../../src/game/actors/interactable-actor.js";

describe("InteractableActor", () => {
	it("stores interaction point offset", () => {
		const actor = new InteractableActor({
			width: 48, height: 48,
			interactionOffset: { x: 0, y: 30 },
			needsEffects: { energy: 10 },
		});
		expect(actor.getInteractionPoint()).toEqual({ x: 0, y: 30 });
	});

	it("returns needs effects", () => {
		const actor = new InteractableActor({
			width: 48, height: 48,
			interactionOffset: { x: 0, y: 0 },
			needsEffects: { energy: 15, focus: 5 },
		});
		expect(actor.getNeedsEffects()).toEqual({ energy: 15, focus: 5 });
	});

	it("tracks occupied state", () => {
		const actor = new InteractableActor({
			width: 48, height: 48,
			interactionOffset: { x: 0, y: 0 },
			needsEffects: {},
		});
		expect(actor.isOccupied()).toBe(false);
		actor.occupy("Atlas");
		expect(actor.isOccupied()).toBe(true);
		expect(actor.getOccupant()).toBe("Atlas");
		actor.vacate();
		expect(actor.isOccupied()).toBe(false);
	});
});
