// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";

vi.mock("excalibur", () => {
	function MockActor(this: Record<string, unknown>, config?: { width?: number; height?: number }) {
		this.pos = { x: 0, y: 0 };
		this.width = config?.width ?? 0;
		this.height = config?.height ?? 0;
		this.on = vi.fn();
		this.graphics = { use: vi.fn(), opacity: 1 };
	}
	return {
		Actor: MockActor,
		vec: vi.fn((x: number, y: number) => ({ x, y })),
		CollisionType: { PreventCollision: 0 },
		Canvas: vi.fn(function MockCanvas() { return {}; }),
	};
});

vi.mock("../../../src/game/actors/graphic-registry.js", () => ({
	getGraphic: vi.fn((name: string) => {
		if (name === "test-graphic") return vi.fn(() => ({ _mock: "canvas" }));
		return undefined;
	}),
}));

import { GenericInteractable } from "../../../src/game/actors/generic-interactable.js";
import { getGraphic } from "../../../src/game/actors/graphic-registry.js";
import type { SceneObjectConfig } from "../../../src/game/data/scene-object-schema.js";

const baseConfig: SceneObjectConfig = {
	id: "test-obj",
	type: "food",
	room: "hub",
	position: { x: 100, y: 200 },
	size: { width: 32, height: 32 },
	graphic: "test-graphic",
};

describe("GenericInteractable", () => {
	it("stores objectId and objectType from config", () => {
		const actor = new GenericInteractable(baseConfig);
		expect(actor.objectId).toBe("test-obj");
		expect(actor.objectType).toBe("food");
	});

	it("defaults interactionOffset to {0,0} when not provided", () => {
		const actor = new GenericInteractable(baseConfig);
		expect(actor.getInteractionPoint()).toEqual({ x: 0, y: 0 });
	});

	it("applies interactionOffset from config", () => {
		const actor = new GenericInteractable({ ...baseConfig, interactionOffset: { x: 5, y: 10 } });
		expect(actor.getInteractionPoint()).toEqual({ x: 5, y: 10 });
	});

	it("defaults needsEffects to {} when not provided", () => {
		const actor = new GenericInteractable(baseConfig);
		expect(actor.getNeedsEffects()).toEqual({});
	});

	it("applies needsEffects from config", () => {
		const actor = new GenericInteractable({ ...baseConfig, needsEffects: { hunger: 30 } });
		expect(actor.getNeedsEffects()).toEqual({ hunger: 30 });
	});

	it("calls getGraphic and applies canvas on construction", () => {
		new GenericInteractable(baseConfig);
		expect(getGraphic).toHaveBeenCalledWith("test-graphic");
	});

	it("setHovered rebuilds graphic", () => {
		const drawFn = vi.fn(() => ({ _mock: "canvas" }));
		vi.mocked(getGraphic).mockReturnValue(drawFn as never);
		const actor = new GenericInteractable(baseConfig);
		drawFn.mockClear();
		actor.setHovered(true);
		expect(drawFn).toHaveBeenCalledWith(32, 32, true);
	});

	it("setHovered(false) rebuilds with false", () => {
		const drawFn = vi.fn(() => ({ _mock: "canvas" }));
		vi.mocked(getGraphic).mockReturnValue(drawFn as never);
		const actor = new GenericInteractable(baseConfig);
		actor.setHovered(true);
		drawFn.mockClear();
		actor.setHovered(false);
		expect(drawFn).toHaveBeenCalledWith(32, 32, false);
	});

	it("setHovered skips rebuild when state unchanged", () => {
		const drawFn = vi.fn(() => ({ _mock: "canvas" }));
		vi.mocked(getGraphic).mockReturnValue(drawFn as never);
		const actor = new GenericInteractable(baseConfig);
		drawFn.mockClear();
		actor.setHovered(false); // already false
		expect(drawFn).not.toHaveBeenCalled();
	});
});
