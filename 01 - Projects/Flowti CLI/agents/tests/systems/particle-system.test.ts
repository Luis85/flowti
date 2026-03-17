import { describe, it, expect } from "vitest";
import { ParticlePool } from "../../src/systems/particle-system.js";

describe("ParticlePool", () => {
	it("spawns a particle with position, color, and lifetime", () => {
		const pool = new ParticlePool(200);
		pool.spawn({ x: 100, y: 200, color: "#3b82f6", lifetime: 2000, opacity: 0.5, radius: 1 });
		expect(pool.active).toBe(1);
	});

	it("fades particles over time and removes expired", () => {
		const pool = new ParticlePool(200);
		pool.spawn({ x: 0, y: 0, color: "#fff", lifetime: 1000, opacity: 1, radius: 1 });
		pool.update(500);
		const particles = pool.getAll();
		expect(particles[0].opacity).toBeCloseTo(0.5, 1);
		pool.update(600);
		expect(pool.active).toBe(0);
	});

	it("enforces max pool size by killing oldest", () => {
		const pool = new ParticlePool(3);
		pool.spawn({ x: 0, y: 0, color: "#fff", lifetime: 5000, opacity: 1, radius: 1 });
		pool.spawn({ x: 1, y: 0, color: "#fff", lifetime: 5000, opacity: 1, radius: 1 });
		pool.spawn({ x: 2, y: 0, color: "#fff", lifetime: 5000, opacity: 1, radius: 1 });
		pool.spawn({ x: 3, y: 0, color: "#fff", lifetime: 5000, opacity: 1, radius: 1 });
		expect(pool.active).toBe(3);
	});

	it("spawns dust burst with multiple particles", () => {
		const pool = new ParticlePool(200);
		pool.spawnDustBurst(100, 200, "#3b82f6");
		expect(pool.active).toBeGreaterThanOrEqual(4);
		expect(pool.active).toBeLessThanOrEqual(6);
	});

	it("spawns trail particle with domain color and opacity", () => {
		const pool = new ParticlePool(200);
		pool.spawnTrail(50, 60, "#a855f7", false);
		const p = pool.getAll()[0];
		expect(p.color).toBe("#a855f7");
		expect(p.opacity).toBe(0.3);
	});

	it("walking-to trail has higher opacity than wandering trail", () => {
		const pool = new ParticlePool(200);
		pool.spawnTrail(0, 0, "#fff", true);
		const p = pool.getAll()[0];
		expect(p.opacity).toBe(0.6);
	});

	it("moves particles with velocity during update", () => {
		const pool = new ParticlePool(200);
		pool.spawn({ x: 0, y: 0, color: "#fff", lifetime: 2000, opacity: 1, radius: 1, vx: 100, vy: 50 });
		pool.update(1000);
		const p = pool.getAll()[0];
		expect(p.x).toBeCloseTo(100, 0);
		expect(p.y).toBeCloseTo(50, 0);
	});

	it("clears all particles", () => {
		const pool = new ParticlePool(200);
		pool.spawn({ x: 0, y: 0, color: "#fff", lifetime: 5000, opacity: 1, radius: 1 });
		pool.spawn({ x: 1, y: 1, color: "#fff", lifetime: 5000, opacity: 1, radius: 1 });
		pool.clear();
		expect(pool.active).toBe(0);
	});
});
