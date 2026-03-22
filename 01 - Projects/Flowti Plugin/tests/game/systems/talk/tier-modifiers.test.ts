import { describe, it, expect } from "vitest";
import { TIER_PREFIXES, TIER_SUFFIXES } from "../../../../src/game/systems/talk/templates/tier-modifiers.js";
import type { RelationshipTier } from "../../../../src/game/systems/relationship-system.js";

const TIERS: RelationshipTier[] = ["rival", "acquaintance", "colleague", "friend", "best-friend"];

describe("tier-modifiers", () => {
	it("every tier has at least 10 prefixes", () => {
		for (const tier of TIERS) {
			expect(TIER_PREFIXES[tier].length, `${tier} prefixes`).toBeGreaterThanOrEqual(10);
		}
	});

	it("every tier has at least 10 suffixes", () => {
		for (const tier of TIERS) {
			expect(TIER_SUFFIXES[tier].length, `${tier} suffixes`).toBeGreaterThanOrEqual(10);
		}
	});

	it("no empty strings in any pool", () => {
		for (const tier of TIERS) {
			for (const p of TIER_PREFIXES[tier]) expect(p.trim()).not.toBe("");
			for (const s of TIER_SUFFIXES[tier]) expect(s.trim()).not.toBe("");
		}
	});
});
