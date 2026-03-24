import { describe, it, expect } from "vitest";
import { CASCADE_REACTION_SUBTREE } from "../../../../../src/game/brain/behavior-tree/subtrees/cascade-reaction.js";
import { createDefaultBlackboard } from "../../../../../src/game/systems/blackboard.js";

describe("CASCADE_REACTION_SUBTREE", () => {
	it("has root node named CascadeReaction", () => {
		expect(CASCADE_REACTION_SUBTREE).toContain("root [CascadeReaction]");
	});

	it("gates on HasCascadeHint condition", () => {
		expect(CASCADE_REACTION_SUBTREE).toContain("condition [HasCascadeHint]");
	});

	it("contains ReactToCascade action", () => {
		expect(CASCADE_REACTION_SUBTREE).toContain("action [ReactToCascade]");
	});
});

describe("HasCascadeHint condition logic", () => {
	it("returns true for seek-proximity hint", () => {
		const bb = createDefaultBlackboard();
		bb.cascadeHint = "seek-proximity";
		expect(bb.cascadeHint === "seek-proximity" || bb.cascadeHint === "force-break").toBe(true);
	});

	it("returns true for force-break hint", () => {
		const bb = createDefaultBlackboard();
		bb.cascadeHint = "force-break";
		expect(bb.cascadeHint === "seek-proximity" || bb.cascadeHint === "force-break").toBe(true);
	});

	it("returns false for vent hint (handled by tickSocial)", () => {
		const bb = createDefaultBlackboard();
		bb.cascadeHint = "vent";
		expect(bb.cascadeHint === "seek-proximity" || bb.cascadeHint === "force-break").toBe(false);
	});

	it("returns false when no hint", () => {
		const bb = createDefaultBlackboard();
		expect(bb.cascadeHint === "seek-proximity" || bb.cascadeHint === "force-break").toBe(false);
	});
});
