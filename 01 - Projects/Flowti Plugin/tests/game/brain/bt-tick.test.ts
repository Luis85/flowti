import { describe, expect, it, vi } from "vitest";
import { btTick } from "../../../src/game/brain/behavior-tree/bt-tick.js";
import type { BehaviourTree } from "../../../src/game/brain/behavior-tree/bt-service.js";

describe("btTick", () => {
	it("recovers when tree.step throws: reset tree, emit error, clear collected actions", () => {
		const reset = vi.fn();
		const tree = {
			step: vi.fn(() => {
				throw new Error("error stepping tree: action function 'X' threw: oops");
			}),
			reset,
		} as Pick<BehaviourTree, "step" | "reset"> as BehaviourTree;

		const kill = vi.fn();
		const agent = {
			context: {
				name: "Ada",
				llmSlot: { state: "pending" as const, process: { kill, result: Promise.resolve({ text: "" }) }, result: null },
			},
			collectedActions: [{ type: "speaking", data: { text: "stale" } }],
		};

		const emitAction = vi.fn();
		const worldState = { emitAction, updateEntity: vi.fn() };
		const clock = { now: () => 0, ms: () => 0, iso: () => "2020-01-01T00:00:00.000Z" };

		const out = btTick(tree, agent, worldState, clock);

		expect(reset).toHaveBeenCalledTimes(1);
		expect(agent.collectedActions).toHaveLength(0);
		expect(kill).toHaveBeenCalledTimes(1);
		expect(emitAction).toHaveBeenCalledTimes(1);
		expect(out).toHaveLength(1);
		expect(out[0].type).toBe("error");
		expect(String(out[0].data.detail ?? "")).toContain("oops");
		expect(agent.context.llmSlot.state).toBe("idle");
		expect(agent.context.llmSlot.process).toBeNull();
	});

	it("forwards collected actions when step succeeds", () => {
		const tree = {
			step: vi.fn(),
			reset: vi.fn(),
		} as Pick<BehaviourTree, "step" | "reset"> as BehaviourTree;

		const agent = {
			context: { name: "Bob" },
			collectedActions: [{ type: "speaking", data: { text: "hi" } }],
		};

		const emitAction = vi.fn();
		const worldState = { emitAction, updateEntity: vi.fn() };
		const clock = { now: () => 0, ms: () => 0, iso: () => "2020-01-01T00:00:00.000Z" };

		const out = btTick(tree, agent, worldState, clock);

		expect(emitAction).toHaveBeenCalledTimes(1);
		expect(out[0].type).toBe("speaking");
		expect(agent.collectedActions).toHaveLength(0);
	});
});
