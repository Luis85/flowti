import { describe, it, expect } from "vitest";
import { ECONOMY_CUES, getCueForTrigger, formatBubbleText } from "../../../src/game/systems/economy-visuals.js";

describe("economy-visuals", () => {
	describe("ECONOMY_CUES", () => {
		it("has 6 cue definitions", () => {
			expect(ECONOMY_CUES).toHaveLength(6);
		});

		it("each cue has a trigger", () => {
			for (const cue of ECONOMY_CUES) {
				expect(typeof cue.trigger).toBe("string");
				expect(cue.trigger.length).toBeGreaterThan(0);
			}
		});
	});

	describe("getCueForTrigger", () => {
		it("returns task-completed cue with bubble text", () => {
			const cue = getCueForTrigger("task-completed");
			expect(cue).toBeDefined();
			expect(cue!.bubbleText).toBe("+{xp}XP +{coin}C");
			expect(cue!.duration).toBe(2000);
		});

		it("returns level-up cue with firework particle preset", () => {
			const cue = getCueForTrigger("level-up");
			expect(cue).toBeDefined();
			expect(cue!.particlePreset).toBe("firework");
			expect(cue!.bubbleText).toBe("Level {level}!");
			expect(cue!.duration).toBe(3000);
		});

		it("returns trust-promoted cue", () => {
			const cue = getCueForTrigger("trust-promoted");
			expect(cue).toBeDefined();
			expect(cue!.bubbleText).toBe("Trust promoted!");
			expect(cue!.duration).toBe(2000);
		});

		it("returns purchase cue with sparkle particle preset", () => {
			const cue = getCueForTrigger("purchase");
			expect(cue).toBeDefined();
			expect(cue!.particlePreset).toBe("sparkle");
			expect(cue!.bubbleText).toBe("Purchased!");
			expect(cue!.duration).toBe(1500);
		});

		it("returns token-spend cue (no bubble text, short duration)", () => {
			const cue = getCueForTrigger("token-spend");
			expect(cue).toBeDefined();
			expect(cue!.bubbleText).toBeUndefined();
			expect(cue!.duration).toBe(500);
		});

		it("returns low-tokens cue with warning text", () => {
			const cue = getCueForTrigger("low-tokens");
			expect(cue).toBeDefined();
			expect(cue!.bubbleText).toBe("Running low on tokens...");
			expect(cue!.duration).toBe(3000);
		});

		it("returns undefined for unknown trigger", () => {
			expect(getCueForTrigger("unknown-trigger")).toBeUndefined();
		});

		it("returns undefined for empty string", () => {
			expect(getCueForTrigger("")).toBeUndefined();
		});
	});

	describe("formatBubbleText", () => {
		it("replaces {xp} and {coin} placeholders", () => {
			const result = formatBubbleText("+{xp}XP +{coin}C", { xp: 50, coin: 10 });
			expect(result).toBe("+50XP +10C");
		});

		it("replaces {level} placeholder", () => {
			const result = formatBubbleText("Level {level}!", { level: 5 });
			expect(result).toBe("Level 5!");
		});

		it("leaves unknown placeholders as-is using the key as fallback", () => {
			const result = formatBubbleText("Hello {name}!", {});
			expect(result).toBe("Hello name!");
		});

		it("handles string values", () => {
			const result = formatBubbleText("Agent {agent} is ready", { agent: "Atlas" });
			expect(result).toBe("Agent Atlas is ready");
		});

		it("handles template with no placeholders", () => {
			const result = formatBubbleText("Trust promoted!", { xp: 100 });
			expect(result).toBe("Trust promoted!");
		});

		it("handles multiple replacements of same key", () => {
			const result = formatBubbleText("{val} and {val}", { val: 42 });
			expect(result).toBe("42 and 42");
		});
	});
});
