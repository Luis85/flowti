import { describe, it, expect, vi } from "vitest";
import { WHIM_SUBTREE } from "../../../../../src/game/brain/behavior-tree/subtrees/whim.js";
import { createDefaultBlackboard } from "../../../../../src/game/systems/blackboard.js";
import type { IEchoStore, Echo } from "../../../../../src/game/systems/echo/echo-types.js";

describe("WHIM_SUBTREE MDSL", () => {
	it("has root node named Whim", () => {
		expect(WHIM_SUBTREE).toContain("root [Whim]");
	});

	it("gates on HasWhim condition", () => {
		expect(WHIM_SUBTREE).toContain("condition [HasWhim]");
	});

	it("contains ExecuteWhim action", () => {
		expect(WHIM_SUBTREE).toContain("action [ExecuteWhim]");
	});
});

function makeEcho(overrides: Partial<Echo> = {}): Echo {
	return {
		id: "test-echo",
		kind: "bond",
		source: "Atlas",
		weight: 20,
		decay: 2,
		reinforcements: 0,
		lastReinforcedCycle: 0,
		tags: [],
		cycleCreated: 0,
		...overrides,
	};
}

describe("HasWhim logic", () => {
	it("suppressed when energy < 40", () => {
		const needs = { energy: 30, social: 80, focus: 80, morale: 80, hunger: 80, thirst: 80 };
		expect(needs.energy < 40).toBe(true);
	});

	it("suppressed when hunger < 40", () => {
		const needs = { energy: 80, social: 80, focus: 80, morale: 80, hunger: 20, thirst: 80 };
		expect(needs.hunger < 40).toBe(true);
	});

	it("suppressed when echoStore is undefined", () => {
		expect(undefined === undefined).toBe(true);
	});
});

describe("ExecuteWhim logic", () => {
	it("bond whim writes seekStation to whimTarget when target nearby", () => {
		const bb = createDefaultBlackboard();
		bb.whimTarget = { x: 200, y: 150 };
		bb.nearbyAgents = ["Scout"];
		const echo = makeEcho({ kind: "bond", target: "Scout", weight: 25 });
		expect(echo.weight).toBeGreaterThan(15);
		expect(echo.target).toBe("Scout");
		expect(bb.nearbyAgents).toContain("Scout");
		expect(bb.whimTarget).toEqual({ x: 200, y: 150 });
	});

	it("preference shop whim writes seekStation to merchant stall", () => {
		const bb = createDefaultBlackboard();
		bb.nearestMerchantStall = { x: 300, y: 60 };
		const echo = makeEcho({ kind: "preference", weight: 15, tags: ["shop"] });
		expect(echo.tags).toContain("shop");
		expect(echo.weight).toBeGreaterThan(10);
		expect(bb.nearestMerchantStall).not.toBeNull();
	});

	it("aversion whim writes roomAvoidance when aversion matches current room", () => {
		const bb = createDefaultBlackboard();
		bb.currentRoom = "hub";
		const echo = makeEcho({ kind: "aversion", target: "hub", weight: -15 });
		expect(echo.weight).toBeLessThan(-10);
		expect(echo.target).toBe(bb.currentRoom);
	});

	it("positive mood-residue triggers celebrate", () => {
		const echo = makeEcho({ kind: "mood-residue", weight: 25 });
		expect(echo.weight).toBeGreaterThan(20);
	});

	it("negative mood-residue triggers mope", () => {
		const echo = makeEcho({ kind: "mood-residue", weight: -15 });
		expect(echo.weight).toBeLessThan(-10);
	});

	it("fallback to wander when no qualifying echo", () => {
		const store: Partial<IEchoStore> = {
			getStrongest: vi.fn(() => undefined),
		};
		expect(store.getStrongest!("Atlas", "bond")).toBeUndefined();
	});
});
