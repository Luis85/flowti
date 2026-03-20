import { describe, it, expect, vi } from "vitest";
import { btTick } from "../../../../src/domain/agents/behavior-tree/bt-tick.js";
import type { BTAgentObject } from "../../../../src/domain/agents/behavior-tree/bt-agent.js";
import type { IWorldStateManager, AgentAction } from "../../../../src/domain/agents/world-state-types.js";
import type { IClock } from "../../../../src/domain/agents/behavior-tree/bt-types.js";

function makeClock(): IClock {
	return { now: () => 1000, ms: () => 1000, iso: () => "2026-03-20T10:00:00Z" };
}

function makeWorldState(): IWorldStateManager {
	return {
		emitAction: vi.fn(),
		updateEntity: vi.fn(),
		getState: vi.fn() as never,
		getEntity: vi.fn(),
		flush: vi.fn(),
		addActionListener: vi.fn(),
		removeActionListener: vi.fn(),
	};
}

describe("btTick", () => {
	it("calls tree.step() once", () => {
		const step = vi.fn();
		const tree = { step } as never;
		const agent = { collectedActions: [], context: { name: "Atlas" } } as unknown as BTAgentObject;
		btTick(tree, agent, makeWorldState(), makeClock());
		expect(step).toHaveBeenCalledOnce();
	});

	it("emits collected actions as AgentActions to world state", () => {
		const step = vi.fn();
		const tree = { step } as never;
		const ws = makeWorldState();
		const agent = {
			collectedActions: [
				{ type: "goal-started", data: { goalName: "review plan" } },
				{ type: "speaking", data: { text: "Hello" } },
			],
			context: { name: "Atlas" },
		} as unknown as BTAgentObject;

		btTick(tree, agent, ws, makeClock());

		expect(ws.emitAction).toHaveBeenCalledTimes(2);
		const firstCall = (ws.emitAction as ReturnType<typeof vi.fn>).mock.calls[0][0] as AgentAction;
		expect(firstCall.type).toBe("goal-started");
		expect(firstCall.agentName).toBe("Atlas");
	});

	it("drains collected actions after emitting", () => {
		const step = vi.fn();
		const tree = { step } as never;
		const agent = {
			collectedActions: [{ type: "idle", data: {} }],
			context: { name: "Atlas" },
		} as unknown as BTAgentObject;

		btTick(tree, agent, makeWorldState(), makeClock());
		expect(agent.collectedActions).toHaveLength(0);
	});

	it("returns the emitted actions for caller inspection", () => {
		const step = vi.fn();
		const tree = { step } as never;
		const agent = {
			collectedActions: [{ type: "idle", data: {} }],
			context: { name: "Atlas" },
		} as unknown as BTAgentObject;

		const result = btTick(tree, agent, makeWorldState(), makeClock());
		expect(result).toHaveLength(1);
		expect(result[0].type).toBe("idle");
	});
});
