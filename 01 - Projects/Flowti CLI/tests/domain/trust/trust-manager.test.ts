import { describe, it, expect } from "vitest";
import { defaultProfile, canPerform, promote, demote, checkAutoPromotion, deriveTier } from "../../../src/domain/trust/trust-manager.js";

describe("trust-manager", () => {
	describe("defaultProfile", () => {
		it("returns supervised tier", () => {
			expect(defaultProfile().tier).toBe("supervised");
		});

		it("has all 7 operations", () => {
			expect(Object.keys(defaultProfile().operations)).toHaveLength(7);
		});

		it("has empty promotion log", () => {
			expect(defaultProfile().promotionLog).toHaveLength(0);
		});
	});

	describe("canPerform", () => {
		it("auto operations are allowed", () => {
			const result = canPerform(defaultProfile(), "vault-read");
			expect(result.allowed).toBe(true);
			expect(result.level).toBe("auto");
		});

		it("review operations are allowed with reason", () => {
			const result = canPerform(defaultProfile(), "vault-tag");
			expect(result.allowed).toBe(true);
			expect(result.level).toBe("review");
			expect(result.reason).toContain("review");
		});

		it("manual operations are not allowed", () => {
			const result = canPerform(defaultProfile(), "vault-edit");
			expect(result.allowed).toBe(false);
			expect(result.level).toBe("manual");
			expect(result.reason).toContain("Director");
		});
	});

	describe("promote", () => {
		it("updates operation level", () => {
			const profile = promote(defaultProfile(), "vault-tag", "auto", "earned it", "2026-03-21T10:00:00Z");
			expect(profile.operations["vault-tag"]).toBe("auto");
		});

		it("adds to promotion log", () => {
			const profile = promote(defaultProfile(), "vault-tag", "auto", "earned it", "2026-03-21T10:00:00Z");
			expect(profile.promotionLog).toHaveLength(1);
			expect(profile.promotionLog[0].from).toBe("review");
			expect(profile.promotionLog[0].to).toBe("auto");
		});

		it("updates tier based on new operations", () => {
			let profile = defaultProfile();
			// Default: read=auto, search=auto, tag=review, create=review, edit=manual, move=manual, link=review
			// Promote tag, create, link to auto -> 5/7 auto = 71% -> trusted
			profile = promote(profile, "vault-tag", "auto", "r1", "2026-03-21T10:00:00Z");
			profile = promote(profile, "vault-create", "auto", "r2", "2026-03-21T10:01:00Z");
			profile = promote(profile, "vault-link", "auto", "r3", "2026-03-21T10:02:00Z");
			expect(profile.tier).toBe("trusted");
		});
	});

	describe("demote", () => {
		it("lowers operation level", () => {
			let profile = promote(defaultProfile(), "vault-tag", "auto", "up", "2026-03-21T10:00:00Z");
			profile = demote(profile, "vault-tag", "manual", "incident", "2026-03-21T11:00:00Z");
			expect(profile.operations["vault-tag"]).toBe("manual");
		});

		it("logs the demotion", () => {
			let profile = promote(defaultProfile(), "vault-tag", "auto", "up", "2026-03-21T10:00:00Z");
			profile = demote(profile, "vault-tag", "review", "incident", "2026-03-21T11:00:00Z");
			expect(profile.promotionLog).toHaveLength(2);
			expect(profile.promotionLog[1].from).toBe("auto");
			expect(profile.promotionLog[1].to).toBe("review");
		});
	});

	describe("checkAutoPromotion", () => {
		it("returns shouldPromote when conditions met", () => {
			const result = checkAutoPromotion(defaultProfile(), "vault-tag", 2, 20);
			expect(result.shouldPromote).toBe(true);
			expect(result.newLevel).toBe("auto");
		});

		it("does not promote if level too low", () => {
			const result = checkAutoPromotion(defaultProfile(), "vault-tag", 1, 20);
			expect(result.shouldPromote).toBe(false);
		});

		it("does not promote if not enough successes", () => {
			const result = checkAutoPromotion(defaultProfile(), "vault-tag", 2, 10);
			expect(result.shouldPromote).toBe(false);
		});

		it("does not promote if already auto", () => {
			const profile = promote(defaultProfile(), "vault-tag", "auto", "test", "2026-03-21T10:00:00Z");
			const result = checkAutoPromotion(profile, "vault-tag", 5, 100);
			expect(result.shouldPromote).toBe(false);
		});

		it("promotes manual to review first", () => {
			const result = checkAutoPromotion(defaultProfile(), "vault-edit", 5, 100);
			expect(result.shouldPromote).toBe(true);
			expect(result.newLevel).toBe("review");
		});
	});

	describe("deriveTier", () => {
		it("returns supervised for default profile", () => {
			expect(deriveTier(defaultProfile())).toBe("supervised");
		});

		it("returns autonomous when 80%+ auto", () => {
			let profile = defaultProfile();
			// Need 6/7 = 85.7% auto. Already have 2 (read, search). Need 4 more.
			profile = promote(profile, "vault-tag", "auto", "r", "t");
			profile = promote(profile, "vault-create", "auto", "r", "t");
			profile = promote(profile, "vault-edit", "auto", "r", "t");
			profile = promote(profile, "vault-link", "auto", "r", "t");
			expect(deriveTier(profile)).toBe("autonomous");
		});
	});
});
