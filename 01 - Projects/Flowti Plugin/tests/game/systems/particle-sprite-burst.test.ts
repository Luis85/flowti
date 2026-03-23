import { describe, it, expect } from "vitest";
import { ParticlePool } from "../../../src/game/systems/particle-system.js";

describe("ParticlePool — spriteBurst", () => {
	it("spawns sprite particles", () => {
		const pool = new ParticlePool();
		pool.spriteBurst({ preset: "sprite-sparkle", x: 100, y: 200 });
		const spriteParticles = pool.getAll().filter((p) => p.sprite !== undefined);
		expect(spriteParticles.length).toBeGreaterThan(0);
		expect(spriteParticles.length).toBeLessThanOrEqual(8);
	});

	it("sprite particles have correct sprite path", () => {
		const pool = new ParticlePool();
		pool.spriteBurst({ preset: "sprite-heart", x: 50, y: 50 });
		const spriteParticles = pool.getAll().filter((p) => p.sprite !== undefined);
		expect(spriteParticles.every((p) => p.sprite === "assets/Items/Potion/Heart.png")).toBe(true);
	});

	it("respects global sprite particle cap of 30", () => {
		const pool = new ParticlePool();
		for (let i = 0; i < 10; i++) {
			pool.spriteBurst({ preset: "sprite-sparkle", x: i * 10, y: 0 });
		}
		const spriteParticles = pool.getAll().filter((p) => p.sprite !== undefined);
		expect(spriteParticles.length).toBeLessThanOrEqual(30);
	});

	it("supports all sprite preset names", () => {
		const pool = new ParticlePool();
		const presets = ["sprite-sparkle", "sprite-smoke", "sprite-heart", "sprite-aura", "sprite-leaf"] as const;
		for (const preset of presets) {
			expect(() => pool.spriteBurst({ preset, x: 50, y: 50 })).not.toThrow();
		}
	});

	it("sprite particles are cleaned up in update", () => {
		const pool = new ParticlePool();
		pool.spriteBurst({ preset: "sprite-smoke", x: 0, y: 0 });
		expect(pool.getAll().length).toBeGreaterThan(0);

		// Advance past lifetime (300ms for smoke)
		pool.update(500);
		const remaining = pool.getAll().filter((p) => p.sprite !== undefined);
		expect(remaining.length).toBe(0);
	});

	it("sprite count frees up after particles expire", () => {
		const pool = new ParticlePool();
		// Fill to cap
		for (let i = 0; i < 10; i++) {
			pool.spriteBurst({ preset: "sprite-sparkle", x: 0, y: 0 });
		}
		// Expire all
		pool.update(1000);
		// Should be able to spawn again
		pool.spriteBurst({ preset: "sprite-sparkle", x: 0, y: 0 });
		const spriteParticles = pool.getAll().filter((p) => p.sprite !== undefined);
		expect(spriteParticles.length).toBeGreaterThan(0);
	});
});
