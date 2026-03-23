import { describe, it, expect } from "vitest";
import { IDLE_WANDER_SUBTREE } from "../../../../../src/game/brain/behavior-tree/subtrees/idle-wander.js";
import { BREAK_ROUTINE_SUBTREE } from "../../../../../src/game/brain/behavior-tree/subtrees/break-routine.js";
import { TALKING_TIMEOUT_SUBTREE } from "../../../../../src/game/brain/behavior-tree/subtrees/talking-timeout.js";

describe("new BT subtrees — MDSL definitions", () => {
	it("idle-wander has IsIdleLongEnough condition and CommandWander action", () => {
		expect(IDLE_WANDER_SUBTREE).toContain("condition [IsIdleLongEnough]");
		expect(IDLE_WANDER_SUBTREE).toContain("action [CommandWander]");
		expect(IDLE_WANDER_SUBTREE).toContain("root [IdleWander]");
	});

	it("break-routine has NeedsBreak condition and StartBreak action", () => {
		expect(BREAK_ROUTINE_SUBTREE).toContain("condition [NeedsBreak]");
		expect(BREAK_ROUTINE_SUBTREE).toContain("action [StartBreak]");
		expect(BREAK_ROUTINE_SUBTREE).toContain("root [BreakRoutine]");
	});

	it("talking-timeout has IsTalkingTooLong condition and StopTalking action", () => {
		expect(TALKING_TIMEOUT_SUBTREE).toContain("condition [IsTalkingTooLong]");
		expect(TALKING_TIMEOUT_SUBTREE).toContain("action [StopTalking]");
		expect(TALKING_TIMEOUT_SUBTREE).toContain("root [TalkingTimeout]");
	});
});
