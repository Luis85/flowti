import { describe, it, expect } from "vitest";
import { NEEDS_THIRST_SUBTREE } from "../../../../../src/game/brain/behavior-tree/subtrees/needs-thirst.js";

describe("NeedsThirst subtree", () => {
	it("exports valid MDSL subtree string", () => {
		expect(NEEDS_THIRST_SUBTREE).toContain("NeedsThirst");
		expect(NEEDS_THIRST_SUBTREE).toContain("IsThirsty");
		expect(NEEDS_THIRST_SUBTREE).toContain("SeekDrinkStation");
		expect(NEEDS_THIRST_SUBTREE).toContain("Drink");
	});
});
