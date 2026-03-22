import { describe, it, expect, vi, beforeEach } from "vitest";
import { TalkEngine } from "../../../../src/game/systems/talk/talk-engine.js";
import type { TalkEngineCallbacks } from "../../../../src/game/systems/talk/talk-engine.js";
import { FragmentComposer, type FragmentPool } from "../../../../src/game/systems/talk/fragment-composer.js";
import type { RelationshipTier } from "../../../../src/game/systems/relationship-system.js";

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

	it("registers a pet entity with pet-specific vars", () => {
		engine.register("cat-whiskers", "pet", [], 5);
		engine.updateVars("cat-whiskers", {
			pet_name: "Whiskers",
			pet_type: "cat",
			hunger_level: "70",
		});
		// No error means pet registration works
	});

	it("silence prevents chatter", () => {
		engine.register("Atlas", "engineering", ["Focused"], 10);
		engine.silence("Atlas");
		engine.update(10000);
		expect(showBubble).not.toHaveBeenCalled();
	});

	it("accepts a FragmentComposer for composed phrase resolution", () => {
		const pool: FragmentPool = {
			id: "test", slot: "core", filters: {},
			fragments: ["test phrase"],
		};
		const composer = new FragmentComposer([pool]);
		const getTier = vi.fn((): RelationshipTier => "colleague");
		const engine2 = new TalkEngine({ showBubble, isIdle }, { composer, getTier });
		engine2.register("Atlas", "engineering", [], 10);
		// Should not throw — enrichment accepted
	});
});
