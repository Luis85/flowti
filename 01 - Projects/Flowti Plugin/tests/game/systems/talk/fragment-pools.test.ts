import { describe, it, expect } from "vitest";
import { ALL_FRAGMENT_POOLS } from "../../../../src/game/systems/talk/templates/fragment-pools.js";

describe("fragment-pools", () => {
	it("has at least 15 pools", () => {
		expect(ALL_FRAGMENT_POOLS.length).toBeGreaterThanOrEqual(15);
	});

	it("all pools have unique IDs", () => {
		const ids = ALL_FRAGMENT_POOLS.map((p) => p.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it("covers all 5 slot types", () => {
		const slots = new Set(ALL_FRAGMENT_POOLS.map((p) => p.slot));
		expect(slots).toContain("opener");
		expect(slots).toContain("core");
		expect(slots).toContain("closer");
		expect(slots).toContain("qualifier");
		expect(slots).toContain("interjection");
	});

	it("opener pools have at least 60 total fragments", () => {
		const count = ALL_FRAGMENT_POOLS
			.filter((p) => p.slot === "opener")
			.reduce((sum, p) => sum + p.fragments.length, 0);
		expect(count).toBeGreaterThanOrEqual(60);
	});

	it("core pools have at least 200 total fragments", () => {
		const count = ALL_FRAGMENT_POOLS
			.filter((p) => p.slot === "core")
			.reduce((sum, p) => sum + p.fragments.length, 0);
		expect(count).toBeGreaterThanOrEqual(200);
	});

	it("closer pools have at least 80 total fragments", () => {
		const count = ALL_FRAGMENT_POOLS
			.filter((p) => p.slot === "closer")
			.reduce((sum, p) => sum + p.fragments.length, 0);
		expect(count).toBeGreaterThanOrEqual(80);
	});

	it("no empty fragments in any pool", () => {
		for (const pool of ALL_FRAGMENT_POOLS) {
			for (const f of pool.fragments) {
				expect(f.trim(), `empty in ${pool.id}`).not.toBe("");
			}
		}
	});
});
