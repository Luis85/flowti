import { describe, it, expect } from "vitest";
import {
	PET_INSTINCT_FRAGMENTS, PET_ELOQUENT_FRAGMENTS, PET_GREMLIN_FRAGMENTS,
} from "../../../../src/game/systems/talk/templates/pet-phrases.js";

describe("pet-phrases", () => {
	it("instinct pool has at least 50 fragments", () => {
		expect(PET_INSTINCT_FRAGMENTS.length).toBeGreaterThanOrEqual(50);
	});

	it("eloquent pool has at least 50 fragments", () => {
		expect(PET_ELOQUENT_FRAGMENTS.length).toBeGreaterThanOrEqual(50);
	});

	it("gremlin pool has at least 50 fragments", () => {
		expect(PET_GREMLIN_FRAGMENTS.length).toBeGreaterThanOrEqual(50);
	});

	it("no duplicate phrases within a pool", () => {
		for (const pool of [PET_INSTINCT_FRAGMENTS, PET_ELOQUENT_FRAGMENTS, PET_GREMLIN_FRAGMENTS]) {
			const unique = new Set(pool);
			expect(unique.size, "duplicates found").toBe(pool.length);
		}
	});

	it("no empty strings", () => {
		for (const pool of [PET_INSTINCT_FRAGMENTS, PET_ELOQUENT_FRAGMENTS, PET_GREMLIN_FRAGMENTS]) {
			for (const phrase of pool) {
				expect(phrase.trim()).not.toBe("");
			}
		}
	});
});
