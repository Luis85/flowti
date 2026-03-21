// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";

vi.mock("excalibur", () => {
	function MockActor(this: Record<string, unknown>) {
		this.pos = { x: 0, y: 0 };
		this.width = 0;
		this.height = 0;
		this.on = vi.fn();
		this.graphics = { use: vi.fn(), opacity: 1 };
	}
	return {
		Actor: MockActor,
		vec: vi.fn((x: number, y: number) => ({ x, y })),
		CollisionType: { PreventCollision: 0 },
		Canvas: function MockCanvas(this: unknown, opts: { width: number; height: number; draw: (ctx: unknown) => void }) {
			// call draw immediately so coverage is exercised
			const ctx = {
				fillStyle: "",
				font: "",
				textAlign: "",
				fillRect: vi.fn(),
				fillText: vi.fn(),
				beginPath: vi.fn(),
				arc: vi.fn(),
				fill: vi.fn(),
				stroke: vi.fn(),
				strokeStyle: "",
				lineWidth: 0,
				moveTo: vi.fn(),
				quadraticCurveTo: vi.fn(),
			};
			opts.draw(ctx);
			return this;
		},
	};
});

import { MerchantStall } from "../../../src/game/actors/merchant-stall.js";

describe("MerchantStall", () => {
	it("has objectType 'shop'", () => {
		const stall = new MerchantStall();
		expect(stall.objectType).toBe("shop");
	});

	it("has objectId 'merchant-stall'", () => {
		const stall = new MerchantStall();
		expect(stall.objectId).toBe("merchant-stall");
	});

	it("has empty needsEffects", () => {
		const stall = new MerchantStall();
		expect(stall.getNeedsEffects()).toEqual({});
	});

	it("is not occupied on creation", () => {
		const stall = new MerchantStall();
		expect(stall.isOccupied()).toBe(false);
	});

	it("interaction offset places agent below the stall", () => {
		const stall = new MerchantStall();
		const point = stall.getInteractionPoint();
		expect(point.y).toBe(24);
	});
});
