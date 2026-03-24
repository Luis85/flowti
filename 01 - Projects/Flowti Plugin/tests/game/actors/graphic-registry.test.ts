// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";

vi.mock("excalibur", () => {
	return {
		Canvas: vi.fn().mockImplementation(function (this: Record<string, unknown>, opts: { width: number; height: number; draw: Function }) {
			this._draw = opts.draw;
			this.width = opts.width;
			this.height = opts.height;
		}),
	};
});

import { getGraphic, getGraphicNames } from "../../../src/game/actors/graphic-registry.js";

describe("graphic-registry", () => {
	const expectedNames = [
		"food-bowl", "water-bowl", "coffee-machine", "snack-table",
		"water-cooler", "couch", "plant", "notice-board", "whiteboard", "merchant-stall",
	];

	it("all 10 named graphics resolve", () => {
		for (const name of expectedNames) {
			expect(getGraphic(name), `${name} should resolve`).toBeDefined();
		}
	});

	it("getGraphicNames returns all 10", () => {
		const names = getGraphicNames();
		expect(names).toHaveLength(10);
		for (const name of expectedNames) {
			expect(names).toContain(name);
		}
	});

	it("each draw function returns ex.Canvas", () => {
		for (const name of expectedNames) {
			const fn = getGraphic(name)!;
			const canvas = fn(32, 32, false);
			expect(canvas).toBeDefined();
		}
	});

	it("unknown graphic name returns undefined", () => {
		expect(getGraphic("nonexistent")).toBeUndefined();
	});

	it("merchant-stall accepts hovered parameter", () => {
		const fn = getGraphic("merchant-stall")!;
		const normal = fn(48, 48, false);
		const hovered = fn(48, 48, true);
		expect(normal).toBeDefined();
		expect(hovered).toBeDefined();
	});
});
