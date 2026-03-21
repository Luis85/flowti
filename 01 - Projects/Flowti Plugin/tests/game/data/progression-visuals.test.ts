import { describe, it, expect } from "vitest";
import { LEVEL_VISUALS, getVisualForLevel } from "../../../src/game/data/progression-visuals.js";

describe("progression-visuals", () => {
	it("has 4 visual tiers", () => {
		expect(LEVEL_VISUALS).toHaveLength(4);
	});

	it("tier 1 (levels 1-2) has no glow or boost", () => {
		const visual = getVisualForLevel(1);
		expect(visual.levelRange).toEqual([1, 2]);
		expect(visual.glowColor).toBeUndefined();
		expect(visual.glowOpacity).toBeUndefined();
		expect(visual.auraParticles).toBeUndefined();
		expect(visual.walkSpeedBoost).toBeUndefined();
	});

	it("tier 1 applies to level 2", () => {
		const visual = getVisualForLevel(2);
		expect(visual.levelRange).toEqual([1, 2]);
	});

	it("tier 2 (levels 3-4) has domain glow at 0.15 opacity", () => {
		const visual = getVisualForLevel(3);
		expect(visual.levelRange).toEqual([3, 4]);
		expect(visual.glowColor).toBe("domain");
		expect(visual.glowOpacity).toBe(0.15);
		expect(visual.auraParticles).toBeUndefined();
		expect(visual.walkSpeedBoost).toBeUndefined();
	});

	it("tier 2 applies to level 4", () => {
		const visual = getVisualForLevel(4);
		expect(visual.levelRange).toEqual([3, 4]);
	});

	it("tier 3 (levels 5-6) has glow at 0.3 and walk speed boost", () => {
		const visual = getVisualForLevel(5);
		expect(visual.levelRange).toEqual([5, 6]);
		expect(visual.glowColor).toBe("domain");
		expect(visual.glowOpacity).toBe(0.3);
		expect(visual.walkSpeedBoost).toBe(0.05);
		expect(visual.auraParticles).toBeUndefined();
	});

	it("tier 3 applies to level 6", () => {
		const visual = getVisualForLevel(6);
		expect(visual.levelRange).toEqual([5, 6]);
	});

	it("tier 4 (levels 7-8) has aura particles and full boost", () => {
		const visual = getVisualForLevel(7);
		expect(visual.levelRange).toEqual([7, 8]);
		expect(visual.glowColor).toBe("domain");
		expect(visual.glowOpacity).toBe(0.4);
		expect(visual.auraParticles).toBe(true);
		expect(visual.walkSpeedBoost).toBe(0.1);
	});

	it("tier 4 applies to level 8", () => {
		const visual = getVisualForLevel(8);
		expect(visual.levelRange).toEqual([7, 8]);
	});

	it("falls back to tier 1 for level 0 (below range)", () => {
		const visual = getVisualForLevel(0);
		expect(visual.levelRange).toEqual([1, 2]);
	});

	it("falls back to tier 1 for level 99 (above all ranges)", () => {
		const visual = getVisualForLevel(99);
		expect(visual.levelRange).toEqual([1, 2]);
	});
});
