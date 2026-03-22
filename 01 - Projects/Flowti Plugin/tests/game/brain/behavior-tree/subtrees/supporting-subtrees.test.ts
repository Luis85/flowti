import { describe, it, expect } from "vitest";
import { IDLE_SUBTREE } from "../../../../../src/game/brain/behavior-tree/subtrees/idle.js";
import { SOCIAL_SUBTREE } from "../../../../../src/game/brain/behavior-tree/subtrees/social.js";
import { NEEDS_ENERGY_SUBTREE } from "../../../../../src/game/brain/behavior-tree/subtrees/needs-energy.js";
import { NEEDS_SOCIAL_SUBTREE } from "../../../../../src/game/brain/behavior-tree/subtrees/needs-social.js";
import { NEEDS_FOCUS_SUBTREE } from "../../../../../src/game/brain/behavior-tree/subtrees/needs-focus.js";
import { NEEDS_MORALE_SUBTREE } from "../../../../../src/game/brain/behavior-tree/subtrees/needs-morale.js";
import { WORK_CYCLE_SUBTREE } from "../../../../../src/game/brain/behavior-tree/subtrees/work-cycle.js";
import { URGENT_SUBTREE } from "../../../../../src/game/brain/behavior-tree/subtrees/urgent.js";

describe("supporting subtrees", () => {
	describe("IDLE_SUBTREE", () => {
		it("is a non-empty string", () => {
			expect(typeof IDLE_SUBTREE).toBe("string");
			expect(IDLE_SUBTREE.length).toBeGreaterThan(0);
		});

		it("has root node named IdleBehavior", () => {
			expect(IDLE_SUBTREE).toContain("root [IdleBehavior]");
		});

		it("uses EchoBiasedIdle action", () => {
			expect(IDLE_SUBTREE).toContain("action [EchoBiasedIdle]");
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

	describe("NEEDS_ENERGY_SUBTREE", () => {
		it("has root node named NeedsEnergy", () => {
			expect(NEEDS_ENERGY_SUBTREE).toContain("root [NeedsEnergy]");
		});

		it("gates on IsEnergyLow and triggers SeekRestSpot + Rest", () => {
			expect(NEEDS_ENERGY_SUBTREE).toContain("condition [IsEnergyLow]");
			expect(NEEDS_ENERGY_SUBTREE).toContain("action [SeekRestSpot]");
			expect(NEEDS_ENERGY_SUBTREE).toContain("action [Rest]");
		});
	});

	describe("NEEDS_SOCIAL_SUBTREE", () => {
		it("has root node named NeedsSocial", () => {
			expect(NEEDS_SOCIAL_SUBTREE).toContain("root [NeedsSocial]");
		});

		it("gates on IsSocialLow and triggers SeekNearbyAgent", () => {
			expect(NEEDS_SOCIAL_SUBTREE).toContain("condition [IsSocialLow]");
			expect(NEEDS_SOCIAL_SUBTREE).toContain("action [SeekNearbyAgent]");
		});
	});

	describe("NEEDS_FOCUS_SUBTREE", () => {
		it("has root node named NeedsFocus", () => {
			expect(NEEDS_FOCUS_SUBTREE).toContain("root [NeedsFocus]");
		});

		it("gates on IsFocusLow and triggers SeekQuietCorner", () => {
			expect(NEEDS_FOCUS_SUBTREE).toContain("condition [IsFocusLow]");
			expect(NEEDS_FOCUS_SUBTREE).toContain("action [SeekQuietCorner]");
		});
	});

	describe("NEEDS_MORALE_SUBTREE", () => {
		it("has root node named NeedsMorale", () => {
			expect(NEEDS_MORALE_SUBTREE).toContain("root [NeedsMorale]");
		});

		it("gates on IsMoraleLow and triggers Emote + WanderSad", () => {
			expect(NEEDS_MORALE_SUBTREE).toContain("condition [IsMoraleLow]");
			expect(NEEDS_MORALE_SUBTREE).toContain("action [Emote]");
			expect(NEEDS_MORALE_SUBTREE).toContain("action [WanderSad]");
		});
	});

	describe("WORK_CYCLE_SUBTREE", () => {
		it("has root node named WorkCycle", () => {
			expect(WORK_CYCLE_SUBTREE).toContain("root [WorkCycle]");
		});

		it("gates on HasWorkGoal and runs work sequence", () => {
			expect(WORK_CYCLE_SUBTREE).toContain("condition [HasWorkGoal]");
			expect(WORK_CYCLE_SUBTREE).toContain("action [PickGoal]");
			expect(WORK_CYCLE_SUBTREE).toContain("action [GoToWorkstation]");
			expect(WORK_CYCLE_SUBTREE).toContain("action [DoWork]");
			expect(WORK_CYCLE_SUBTREE).toContain("action [LeaveWorkstation]");
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
