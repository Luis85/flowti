import { describe, it, expect } from "vitest";
import { QUIRK_DEFINITIONS, getEligibleQuirks } from "../../../src/game/data/quirk-definitions.js";

describe("quirk-definitions", () => {
	it("has 15 quirk definitions", () => {
		expect(QUIRK_DEFINITIONS).toHaveLength(15);
	});

	it("every quirk has a unique id", () => {
		const ids = QUIRK_DEFINITIONS.map((q) => q.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it("every quirk has phrases", () => {
		for (const q of QUIRK_DEFINITIONS) {
			expect(q.phrases.length).toBeGreaterThanOrEqual(3);
		}
	});

	it("getEligibleQuirks filters by attributes", () => {
		const eligible = getEligibleQuirks({ dex: 15, con: 5 }, "engineering");
		const ids = eligible.map((q) => q.id);
		expect(ids).toContain("pacer");       // DEX > 13
		expect(ids).toContain("coffee-addict"); // CON < 8
		expect(ids).toContain("fidgeter");     // DEX > 14 + CON < 10
	});

	it("getEligibleQuirks includes random quirks for any agent", () => {
		const eligible = getEligibleQuirks({}, "general");
		const ids = eligible.map((q) => q.id);
		// Random quirks (snacker, music-lover, plant-parent) are always eligible
		expect(ids).toContain("snacker");
		expect(ids).toContain("music-lover");
		expect(ids).toContain("plant-parent");
	});

	it("getEligibleQuirks respects domain filter", () => {
		const designEligible = getEligibleQuirks({ cha: 15 }, "design");
		const opsEligible = getEligibleQuirks({ cha: 15 }, "operations");
		const designIds = designEligible.map((q) => q.id);
		const opsIds = opsEligible.map((q) => q.id);
		expect(designIds).toContain("doodler");       // CHA > 12 + design
		expect(opsIds).not.toContain("doodler");       // not ops domain
	});
});
