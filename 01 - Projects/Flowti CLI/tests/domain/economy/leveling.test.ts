import { describe, it, expect } from "vitest";
import { levelForXp, xpForLevel, titleForLevel, isEligible, capabilitiesForLevel, LEVEL_TABLE } from "../../../src/domain/economy/leveling.js";

describe("leveling", () => {
	describe("levelForXp", () => {
		it("returns level 1 for 0 XP", () => {
			expect(levelForXp(0)).toBe(1);
		});

		it("returns level 2 for 100 XP", () => {
			expect(levelForXp(100)).toBe(2);
		});

		it("returns level 2 for 299 XP", () => {
			expect(levelForXp(299)).toBe(2);
		});

		it("returns level 3 for 300 XP", () => {
			expect(levelForXp(300)).toBe(3);
		});

		it("returns level 5 for 1000 XP", () => {
			expect(levelForXp(1000)).toBe(5);
		});

		it("returns level 8 for 3000+ XP", () => {
			expect(levelForXp(5000)).toBe(8);
		});
	});

	describe("xpForLevel", () => {
		it("returns 0 for level 1", () => {
			expect(xpForLevel(1)).toBe(0);
		});

		it("returns 300 for level 3", () => {
			expect(xpForLevel(3)).toBe(300);
		});

		it("returns 3000 for level 8", () => {
			expect(xpForLevel(8)).toBe(3000);
		});
	});

	describe("titleForLevel", () => {
		it("returns Novice for level 1", () => {
			expect(titleForLevel(1)).toBe("Novice");
		});

		it("returns Grandmaster for level 8", () => {
			expect(titleForLevel(8)).toBe("Grandmaster");
		});
	});

	describe("isEligible", () => {
		it("level 3 is eligible for vault-write purchase", () => {
			expect(isEligible(3, "vault-write")).toBe(true);
		});

		it("level 2 is not eligible for vault-write purchase", () => {
			expect(isEligible(2, "vault-write")).toBe(false);
		});

		it("level 4 is eligible for delegation", () => {
			expect(isEligible(4, "delegation")).toBe(true);
		});
	});

	describe("LEVEL_TABLE", () => {
		it("has 8 levels", () => {
			expect(LEVEL_TABLE).toHaveLength(8);
		});
	});

	describe("capabilitiesForLevel", () => {
		it("returns vault-read and simple-tasks for level 1", () => {
			expect(capabilitiesForLevel(1)).toEqual(["vault-read", "simple-tasks"]);
		});

		it("returns cumulative unlocks for level 4", () => {
			expect(capabilitiesForLevel(4)).toEqual([
				"vault-read", "simple-tasks",
				"standing-orders",
				"vault-write", "self-proposed",
				"delegation", "journey",
			]);
		});

		it("returns all unlocks for level 8", () => {
			expect(capabilitiesForLevel(8)).toHaveLength(13);
			expect(capabilitiesForLevel(8)).toContain("full-autonomy");
			expect(capabilitiesForLevel(8)).toContain("economy-influence");
		});

		it("returns empty for level 0", () => {
			expect(capabilitiesForLevel(0)).toEqual([]);
		});
	});
});
