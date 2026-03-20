import { describe, it, expect } from "vitest";
import { IDLE_SUBTREE } from "../../../../../src/domain/agents/behavior-tree/subtrees/idle.js";
import { SOCIAL_SUBTREE } from "../../../../../src/domain/agents/behavior-tree/subtrees/social.js";
import { NEEDS_SUBTREE } from "../../../../../src/domain/agents/behavior-tree/subtrees/needs.js";
import { URGENT_SUBTREE } from "../../../../../src/domain/agents/behavior-tree/subtrees/urgent.js";

describe("supporting subtrees", () => {
	describe("IDLE_SUBTREE", () => {
		it("is a non-empty string", () => {
			expect(typeof IDLE_SUBTREE).toBe("string");
			expect(IDLE_SUBTREE.length).toBeGreaterThan(0);
		});

		it("has root node named IdleBehavior", () => {
			expect(IDLE_SUBTREE).toContain("root [IdleBehavior]");
		});

		it("uses a lotto node for random selection", () => {
			expect(IDLE_SUBTREE).toContain("lotto [1,1,1]");
		});

		it("contains all three idle actions", () => {
			expect(IDLE_SUBTREE).toContain("action [Wander]");
			expect(IDLE_SUBTREE).toContain("action [Emote]");
			expect(IDLE_SUBTREE).toContain("action [Chatter]");
		});
	});

	describe("SOCIAL_SUBTREE", () => {
		it("is a non-empty string", () => {
			expect(typeof SOCIAL_SUBTREE).toBe("string");
			expect(SOCIAL_SUBTREE.length).toBeGreaterThan(0);
		});

		it("has root node named SocialBehavior", () => {
			expect(SOCIAL_SUBTREE).toContain("root [SocialBehavior]");
		});

		it("gates on HasNearbyAgent condition", () => {
			expect(SOCIAL_SUBTREE).toContain("condition [HasNearbyAgent]");
		});

		it("contains Socialize and SpeakBubble actions", () => {
			expect(SOCIAL_SUBTREE).toContain("action [Socialize]");
			expect(SOCIAL_SUBTREE).toContain("action [SpeakBubble]");
		});
	});

	describe("NEEDS_SUBTREE", () => {
		it("is a non-empty string", () => {
			expect(typeof NEEDS_SUBTREE).toBe("string");
			expect(NEEDS_SUBTREE.length).toBeGreaterThan(0);
		});

		it("has root node named NeedsSatisfaction", () => {
			expect(NEEDS_SUBTREE).toContain("root [NeedsSatisfaction]");
		});

		it("inverts HasEnoughEnergy with flip", () => {
			expect(NEEDS_SUBTREE).toContain("flip");
			expect(NEEDS_SUBTREE).toContain("condition [HasEnoughEnergy]");
		});

		it("contains Rest action", () => {
			expect(NEEDS_SUBTREE).toContain("action [Rest]");
		});
	});

	describe("URGENT_SUBTREE", () => {
		it("is a non-empty string", () => {
			expect(typeof URGENT_SUBTREE).toBe("string");
			expect(URGENT_SUBTREE.length).toBeGreaterThan(0);
		});

		it("has root node named UrgentReaction", () => {
			expect(URGENT_SUBTREE).toContain("root [UrgentReaction]");
		});

		it("gates on HasPendingEvent condition", () => {
			expect(URGENT_SUBTREE).toContain("condition [HasPendingEvent]");
		});

		it("contains HandleEvent and SpeakBubble actions", () => {
			expect(URGENT_SUBTREE).toContain("action [HandleEvent]");
			expect(URGENT_SUBTREE).toContain("action [SpeakBubble]");
		});
	});
});
