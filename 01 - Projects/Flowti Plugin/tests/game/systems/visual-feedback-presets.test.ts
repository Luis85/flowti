import { describe, it, expect } from "vitest";
import {
	URGENCY_THRESHOLDS,
	TIMING,
	COOLDOWNS,
	INTENT_SPRITES,
	ITEM_POP_SPRITES,
	URGENCY_SPEED_MULTIPLIERS,
	resolveThreshold,
	computeUrgency,
	classifyUrgency,
} from "../../../src/game/systems/visual-feedback-presets.js";

describe("visual-feedback-presets", () => {
	it("URGENCY_THRESHOLDS defines hunger and thirst with base values", () => {
		expect(URGENCY_THRESHOLDS.hunger.base).toBe(35);
		expect(URGENCY_THRESHOLDS.thirst.base).toBe(30);
	});

	it("URGENCY_THRESHOLDS includes quirk overrides", () => {
		expect(URGENCY_THRESHOLDS.hunger.quirks?.snacker).toBe(50);
		expect(URGENCY_THRESHOLDS.thirst.quirks?.["coffee-addict"]).toBe(45);
	});

	it("resolveThreshold returns base when no matching quirk", () => {
		expect(resolveThreshold("hunger", [])).toBe(35);
		expect(resolveThreshold("hunger", ["coffee-addict"])).toBe(35);
	});

	it("resolveThreshold returns quirk override when matched", () => {
		expect(resolveThreshold("hunger", ["snacker"])).toBe(50);
		expect(resolveThreshold("thirst", ["coffee-addict"])).toBe(45);
	});

	it("resolveThreshold returns 50 for unknown need", () => {
		expect(resolveThreshold("unknown", [])).toBe(50);
	});

	it("computeUrgency returns 0 when need equals threshold", () => {
		expect(computeUrgency(35, 35)).toBe(0);
	});

	it("computeUrgency returns 1 when need is 0", () => {
		expect(computeUrgency(0, 35)).toBe(1);
	});

	it("computeUrgency clamps to 0-1 range", () => {
		expect(computeUrgency(50, 35)).toBe(0);
	});

	it("classifyUrgency returns correct tiers", () => {
		expect(classifyUrgency(0.1)).toBe("low");
		expect(classifyUrgency(0.4)).toBe("medium");
		expect(classifyUrgency(0.8)).toBe("high");
	});

	it("classifyUrgency boundary: 0.3 is medium", () => {
		expect(classifyUrgency(0.3)).toBe("medium");
	});

	it("classifyUrgency boundary: 0.6 is high", () => {
		expect(classifyUrgency(0.6)).toBe("high");
	});

	it("TIMING defines telegraph durations", () => {
		expect(TIMING.thoughtBubbleDuration).toBe(1500);
		expect(TIMING.intentIconFadeMs).toBe(200);
		expect(TIMING.itemPopDurationMs).toBe(600);
		expect(TIMING.satisfactionEmoteDurationMs).toBe(1500);
		expect(TIMING.satisfactionDelayMs).toBe(400);
		expect(TIMING.sparkBurstDurationMs).toBe(500);
	});

	it("COOLDOWNS defines all cooldown values", () => {
		expect(COOLDOWNS.payoffCooldownMs).toBe(3000);
		expect(COOLDOWNS.ambientEmoteMinMs).toBe(8000);
		expect(COOLDOWNS.ambientEmoteMaxMs).toBe(15000);
		expect(COOLDOWNS.proximityPairCooldownMs).toBe(15000);
		expect(COOLDOWNS.longIdleThresholdMs).toBe(60000);
		expect(COOLDOWNS.roomEntryLookDurationMs).toBe(600);
		expect(COOLDOWNS.facingTransitionDelayMs).toBe(200);
	});

	it("INTENT_SPRITES maps intent details to sprite paths", () => {
		expect(INTENT_SPRITES["seek-food"]).toBe("assets/Items/Food/Onigiri.png");
		expect(INTENT_SPRITES["seek-drink"]).toBe("assets/Items/Potion/WaterPot.png");
		expect(INTENT_SPRITES["seek-merchant"]).toBe("assets/Items/Treasure/GoldCoin.png");
	});

	it("INTENT_SPRITES includes preferred variants", () => {
		expect(INTENT_SPRITES["seek-preferred-food"]).toBe("assets/Items/Food/Onigiri.png");
		expect(INTENT_SPRITES["seek-preferred-drink"]).toBe("assets/Items/Potion/WaterPot.png");
	});

	it("ITEM_POP_SPRITES provides arrays for random selection", () => {
		expect(ITEM_POP_SPRITES.hunger.length).toBeGreaterThanOrEqual(3);
		expect(ITEM_POP_SPRITES.thirst.length).toBeGreaterThanOrEqual(2);
	});

	it("URGENCY_SPEED_MULTIPLIERS defines low/medium/high", () => {
		expect(URGENCY_SPEED_MULTIPLIERS.low).toBe(1.0);
		expect(URGENCY_SPEED_MULTIPLIERS.medium).toBe(1.2);
		expect(URGENCY_SPEED_MULTIPLIERS.high).toBe(1.4);
	});
});
