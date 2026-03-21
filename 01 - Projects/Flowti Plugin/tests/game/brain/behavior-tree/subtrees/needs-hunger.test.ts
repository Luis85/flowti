import { describe, it, expect } from "vitest";
import { NEEDS_HUNGER_SUBTREE } from "../../../../../src/game/brain/behavior-tree/subtrees/needs-hunger.js";

describe("NeedsHunger subtree", () => {
	it("exports valid MDSL subtree string", () => {
		expect(NEEDS_HUNGER_SUBTREE).toContain("NeedsHunger");
		expect(NEEDS_HUNGER_SUBTREE).toContain("IsHungry");
		expect(NEEDS_HUNGER_SUBTREE).toContain("SeekFoodStation");
		expect(NEEDS_HUNGER_SUBTREE).toContain("Eat");
	});
});
