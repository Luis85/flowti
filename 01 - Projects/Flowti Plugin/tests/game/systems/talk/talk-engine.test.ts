import { describe, it, expect, vi, beforeEach } from "vitest";
import { TalkEngine } from "../../../../src/game/systems/talk/talk-engine.js";
import type { TalkEngineCallbacks } from "../../../../src/game/systems/talk/talk-engine.js";

describe("TalkEngine", () => {
	let showBubble: TalkEngineCallbacks["showBubble"];
	let isIdle: TalkEngineCallbacks["isIdle"];
	let engine: TalkEngine;

	beforeEach(() => {
		showBubble = vi.fn();
		isIdle = vi.fn(() => true);
		engine = new TalkEngine({ showBubble, isIdle });
	});

	it("registers an agent without error", () => {
		engine.register("Atlas", "engineering", ["Focused"], 10);
	});

	it("silence prevents chatter", () => {
		engine.register("Atlas", "engineering", ["Focused"], 10);
		engine.silence("Atlas");
		engine.update(10000);
		expect(showBubble).not.toHaveBeenCalled();
	});
});
