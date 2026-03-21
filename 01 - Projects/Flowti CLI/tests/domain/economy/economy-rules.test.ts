import { describe, it, expect } from "vitest";
import { calculateReward } from "../../../src/domain/economy/economy-rules.js";

describe("economy-rules", () => {
	describe("calculateReward", () => {
		it("returns base reward for auto trust tier", () => {
			const result = calculateReward({ xp: 50, coin: 25 }, { trustTier: "auto", isFirstCompletion: false, isStandingOrder: false, isDelegation: false });
			expect(result).toEqual({ xp: 50, coin: 25 });
		});

		it("applies 1.2x multiplier for review trust tier", () => {
			const result = calculateReward({ xp: 50, coin: 25 }, { trustTier: "review", isFirstCompletion: false, isStandingOrder: false, isDelegation: false });
			expect(result).toEqual({ xp: 60, coin: 30 });
		});

		it("applies 1.5x multiplier for first completion", () => {
			// 50 * 1.5 = 75, 25 * 1.5 = 37.5 → Math.round(37.5) = 38
			const result = calculateReward({ xp: 50, coin: 25 }, { trustTier: "auto", isFirstCompletion: true, isStandingOrder: false, isDelegation: false });
			expect(result).toEqual({ xp: 75, coin: 38 });
		});

		it("applies 0.3x multiplier for standing orders", () => {
			// 50 * 0.3 = 15, 25 * 0.3 = 7.5 → Math.round(7.5) = 8
			const result = calculateReward({ xp: 50, coin: 25 }, { trustTier: "auto", isFirstCompletion: false, isStandingOrder: true, isDelegation: false });
			expect(result).toEqual({ xp: 15, coin: 8 });
		});

		it("applies 0.2x multiplier for delegation cut", () => {
			const result = calculateReward({ xp: 50, coin: 25 }, { trustTier: "auto", isFirstCompletion: false, isStandingOrder: false, isDelegation: true });
			expect(result).toEqual({ xp: 10, coin: 5 });
		});

		it("multipliers stack: review + first completion", () => {
			// 100 * 1.2 * 1.5 = 180, 50 * 1.2 * 1.5 = 90
			const result = calculateReward({ xp: 100, coin: 50 }, { trustTier: "review", isFirstCompletion: true, isStandingOrder: false, isDelegation: false });
			expect(result).toEqual({ xp: 180, coin: 90 });
		});
	});
});
