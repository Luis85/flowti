import { describe, it, expect, vi } from "vitest";

vi.mock("excalibur", () => {
	const mockSprite = { clone: () => mockSprite, width: 16, height: 16 };
	const mockSpriteSheet = { getSprite: vi.fn(() => mockSprite) };
	return {
		ImageSource: class {
			constructor(public path: string, _opts?: unknown) {}
			load = vi.fn().mockResolvedValue(undefined);
			image = { width: 64, height: 64 };
		},
		SpriteSheet: {
			fromImageSource: vi.fn(() => mockSpriteSheet),
		},
		Animation: {
			fromSpriteSheet: vi.fn((_sheet: unknown, frames: number[], _duration: number) => ({
				strategy: null,
				frames,
			})),
		},
		AnimationStrategy: { Loop: 0 },
		ImageFiltering: { Pixel: 0 },
	};
});

import { loadAgentSprites, type AgentSprites } from "../../src/sprites/sprite-loader.js";
import * as ex from "excalibur";

describe("loadAgentSprites", () => {
	it("loads idle and walk images", async () => {
		const sprites = await loadAgentSprites("Boy", "assets/Actor/Characters/");
		expect(ex.SpriteSheet.fromImageSource).toHaveBeenCalledTimes(2);
	});

	it("returns all five animation slots", async () => {
		const sprites = await loadAgentSprites("Boy", "assets/Actor/Characters/");
		expect(sprites.idle).toBeDefined();
		expect(sprites.walkDown).toBeDefined();
		expect(sprites.walkLeft).toBeDefined();
		expect(sprites.walkRight).toBeDefined();
		expect(sprites.walkUp).toBeDefined();
	});

	it("creates idle spritesheet with 4 columns x 1 row", async () => {
		await loadAgentSprites("Boy", "assets/Actor/Characters/");
		const calls = (ex.SpriteSheet.fromImageSource as ReturnType<typeof vi.fn>).mock.calls;
		const idleCall = calls[0][0];
		expect(idleCall.grid.columns).toBe(4);
		expect(idleCall.grid.rows).toBe(1);
		expect(idleCall.grid.spriteWidth).toBe(16);
		expect(idleCall.grid.spriteHeight).toBe(16);
	});

	it("creates walk spritesheet with 4 columns x 4 rows", async () => {
		await loadAgentSprites("Boy", "assets/Actor/Characters/");
		const calls = (ex.SpriteSheet.fromImageSource as ReturnType<typeof vi.fn>).mock.calls;
		const walkCall = calls[1][0];
		expect(walkCall.grid.columns).toBe(4);
		expect(walkCall.grid.rows).toBe(4);
		expect(walkCall.grid.spriteWidth).toBe(16);
		expect(walkCall.grid.spriteHeight).toBe(16);
	});
});
