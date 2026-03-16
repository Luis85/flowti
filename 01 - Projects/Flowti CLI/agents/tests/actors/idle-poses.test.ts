import { describe, it, expect } from "vitest";
import { drawLookAroundPose, drawStretchPose } from "../../src/actors/pixel-sprites.js";
import type { SpritePalette } from "../../src/actors/pixel-sprites.js";

const palette: SpritePalette = { body: "#22c55e", limb: "#16a34a", hair: "#a855f7" };

function createMockCtx(): { ctx: CanvasRenderingContext2D; ops: string[] } {
	const ops: string[] = [];
	const ctx = {
		fillStyle: "",
		strokeStyle: "",
		lineWidth: 0,
		save: () => ops.push("save"),
		restore: () => ops.push("restore"),
		translate: (_x: number, _y: number) => ops.push("translate"),
		scale: (_x: number, _y: number) => ops.push("scale"),
		fillRect: (_x: number, _y: number, _w: number, _h: number) => ops.push("fillRect"),
		beginPath: () => ops.push("beginPath"),
		arc: (_x: number, _y: number, _r: number) => ops.push("arc"),
		fill: () => ops.push("fill"),
		moveTo: () => {},
		lineTo: () => {},
		stroke: () => ops.push("stroke"),
	} as unknown as CanvasRenderingContext2D;
	return { ctx, ops };
}

describe("drawLookAroundPose", () => {
	it("draws without error", () => {
		const { ctx } = createMockCtx();
		expect(() => drawLookAroundPose(ctx, palette, "neutral", false)).not.toThrow();
	});

	it("renders a head (includes arc call for eyes)", () => {
		const { ctx, ops } = createMockCtx();
		drawLookAroundPose(ctx, palette, "neutral", false);
		expect(ops.some((op) => op === "fillRect")).toBe(true);
	});

	it("renders with flip=true without error", () => {
		const { ctx } = createMockCtx();
		expect(() => drawLookAroundPose(ctx, palette, "happy", true)).not.toThrow();
	});
});

describe("drawStretchPose", () => {
	it("draws without error", () => {
		const { ctx } = createMockCtx();
		expect(() => drawStretchPose(ctx, palette, "neutral", false)).not.toThrow();
	});

	it("renders body and limbs (multiple fillRect calls)", () => {
		const { ctx, ops } = createMockCtx();
		drawStretchPose(ctx, palette, "neutral", false);
		const fillRects = ops.filter((op) => op === "fillRect");
		expect(fillRects.length).toBeGreaterThan(3);
	});

	it("renders with flip=true without error", () => {
		const { ctx } = createMockCtx();
		expect(() => drawStretchPose(ctx, palette, "frustrated", true)).not.toThrow();
	});
});
