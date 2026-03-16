import { describe, it, expect, vi } from "vitest";
import { hashColor, statusPalette, drawIdlePose } from "../../src/actors/pixel-sprites.js";
import type { SpritePalette } from "../../src/actors/pixel-sprites.js";

// ── Mock CanvasRenderingContext2D ────────────────────────────────────

interface FillRectCall {
	readonly x: number;
	readonly y: number;
	readonly w: number;
	readonly h: number;
}

function createMockCtx() {
	const fillRectCalls: FillRectCall[] = [];
	const ctx = {
		fillStyle: "",
		fillRect: vi.fn((x: number, y: number, w: number, h: number) => {
			fillRectCalls.push({ x, y, w, h });
		}),
		save: vi.fn(),
		restore: vi.fn(),
		translate: vi.fn(),
		scale: vi.fn(),
		beginPath: vi.fn(),
		arc: vi.fn(),
		fill: vi.fn(),
		_fillRectCalls: fillRectCalls,
	};
	return ctx as unknown as CanvasRenderingContext2D & { _fillRectCalls: FillRectCall[] };
}

// ── hashColor ────────────────────────────────────────────────────────

describe("hashColor", () => {
	it("returns a hex color string", () => {
		const color = hashColor("Alice");
		expect(color).toMatch(/^#[0-9a-f]{6}$/);
	});

	it("returns consistent results for the same name", () => {
		expect(hashColor("Bob")).toBe(hashColor("Bob"));
	});

	it("returns different colors for different names", () => {
		expect(hashColor("Alice")).not.toBe(hashColor("Bob"));
	});

	it("handles empty string", () => {
		const color = hashColor("");
		expect(color).toMatch(/^#[0-9a-f]{6}$/);
	});
});

// ── statusPalette ────────────────────────────────────────────────────

describe("statusPalette", () => {
	it("returns busy palette", () => {
		const p = statusPalette("busy");
		expect(p.body).toBe("#22c55e");
		expect(p.limb).toBe("#16a34a");
	});

	it("returns idle palette", () => {
		const p = statusPalette("idle");
		expect(p.body).toBe("#3b82f6");
		expect(p.limb).toBe("#2563eb");
	});

	it("returns unassigned palette", () => {
		const p = statusPalette("unassigned");
		expect(p.body).toBe("#6b7280");
		expect(p.limb).toBe("#4b5563");
	});

	it("returns waiting palette", () => {
		const p = statusPalette("waiting");
		expect(p.body).toBe("#f59e0b");
		expect(p.limb).toBe("#d97706");
	});

	it("defaults to unassigned for unknown status", () => {
		const p = statusPalette("unknown-status");
		expect(p.body).toBe("#6b7280");
		expect(p.limb).toBe("#4b5563");
	});
});

// ── drawIdlePose ─────────────────────────────────────────────────────

describe("drawIdlePose", () => {
	const palette: SpritePalette = {
		body: "#3b82f6",
		limb: "#2563eb",
		hair: "#a855f7",
	};

	it("calls fillRect multiple times without throwing", () => {
		const ctx = createMockCtx();
		expect(() => drawIdlePose(ctx, palette, "neutral", false)).not.toThrow();
		expect(ctx._fillRectCalls.length).toBeGreaterThan(0);
	});

	it("draws head at y=2 region", () => {
		const ctx = createMockCtx();
		drawIdlePose(ctx, palette, "neutral", false);
		// Hair block at (10, 2, 4, 2)
		const hairCall = ctx._fillRectCalls.find(
			(c) => c.x === 10 && c.y === 2 && c.w === 4 && c.h === 2,
		);
		expect(hairCall).toBeDefined();
	});

	it("draws body at y=7 region", () => {
		const ctx = createMockCtx();
		drawIdlePose(ctx, palette, "neutral", false);
		const bodyCall = ctx._fillRectCalls.find(
			(c) => c.x === 9 && c.y === 7 && c.w === 6 && c.h === 8,
		);
		expect(bodyCall).toBeDefined();
	});

	it("draws legs below body", () => {
		const ctx = createMockCtx();
		drawIdlePose(ctx, palette, "neutral", false);
		const leftLeg = ctx._fillRectCalls.find(
			(c) => c.x === 9 && c.y === 15 && c.w === 2 && c.h === 6,
		);
		const rightLeg = ctx._fillRectCalls.find(
			(c) => c.x === 13 && c.y === 15 && c.w === 2 && c.h === 6,
		);
		expect(leftLeg).toBeDefined();
		expect(rightLeg).toBeDefined();
	});

	it("uses save/translate/scale/restore when flipped", () => {
		const ctx = createMockCtx();
		drawIdlePose(ctx, palette, "neutral", true);
		expect(ctx.save).toHaveBeenCalled();
		expect(ctx.translate).toHaveBeenCalledWith(24, 0);
		expect(ctx.scale).toHaveBeenCalledWith(-1, 1);
		expect(ctx.restore).toHaveBeenCalled();
	});

	it("does not call save/restore when not flipped", () => {
		const ctx = createMockCtx();
		drawIdlePose(ctx, palette, "neutral", false);
		expect(ctx.save).not.toHaveBeenCalled();
		expect(ctx.restore).not.toHaveBeenCalled();
	});

	it("renders happy mouth differently from neutral", () => {
		const ctxNeutral = createMockCtx();
		drawIdlePose(ctxNeutral, palette, "neutral", false);
		const neutralCalls = ctxNeutral._fillRectCalls.length;

		const ctxHappy = createMockCtx();
		drawIdlePose(ctxHappy, palette, "happy", false);
		const happyCalls = ctxHappy._fillRectCalls.length;

		// Happy mouth has 3 calls vs neutral mouth has 1 call, so totals differ
		expect(happyCalls).not.toBe(neutralCalls);
	});
});
