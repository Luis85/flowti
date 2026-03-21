import { describe, it, expect } from "vitest";
import {
	toNodeState,
	fromNodeState,
	createTree,
	stepTree,
	type NodeState,
} from "../../../../src/game/brain/behavior-tree/bt-service.js";

describe("bt-service", () => {
	describe("toNodeState", () => {
		it("maps succeeded", () => {
			expect(toNodeState(fromNodeState("succeeded"))).toBe("succeeded");
		});

		it("maps running", () => {
			expect(toNodeState(fromNodeState("running"))).toBe("running");
		});

		it("maps failed", () => {
			expect(toNodeState(fromNodeState("failed"))).toBe("failed");
		});
	});

	describe("fromNodeState round-trip", () => {
		it.each(["succeeded", "running", "failed"] as NodeState[])("round-trips %s", (ns) => {
			expect(toNodeState(fromNodeState(ns))).toBe(ns);
		});
	});

	describe("createTree + stepTree", () => {
		it("creates a tree that can be stepped", () => {
			const agent = {
				Succeed: () => fromNodeState("succeeded"),
			};
			const tree = createTree("root { action [Succeed] }", agent);
			expect(() => stepTree(tree)).not.toThrow();
		});
	});
});
