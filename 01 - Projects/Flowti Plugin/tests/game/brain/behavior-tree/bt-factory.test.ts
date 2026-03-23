import { describe, it, expect, vi } from "vitest";
import { createAgentBT } from "../../../../src/game/brain/behavior-tree/bt-factory.js";
import type { AgentToolDeps, BTAgentDef } from "../../../../src/game/brain/behavior-tree/bt-types.js";
import { createDefaultBlackboard } from "../../../../src/game/systems/blackboard.js";

function makeDeps(): AgentToolDeps {
	return {
		disk: { readFileSync: vi.fn(), writeFileSync: vi.fn(), existsSync: vi.fn(), mkdirSync: vi.fn() },
		paths: { join: (...s: string[]) => s.join("/"), dirname: (p: string) => p, basename: (p: string) => p },
		clock: { now: () => 1000, ms: () => 1000, iso: () => "2026-03-20T10:00:00Z" },
		checkPermission: vi.fn(() => "allowed" as const),
		blackboard: createDefaultBlackboard(),
	};
}

function makeAgent(overrides: Partial<BTAgentDef> = {}): BTAgentDef {
	return {
		name: "Atlas",
		agentType: "ai",
		goals: [{ name: "review iteration plan", priority: 10 }],
		...overrides,
	};
}

describe("createAgentBT", () => {
	it("returns a tree and agent object", () => {
		const result = createAgentBT(makeAgent(), makeDeps());
		expect(result).toHaveProperty("tree");
		expect(result).toHaveProperty("agent");
	});

	it("tree can be stepped without error", () => {
		const { tree } = createAgentBT(makeAgent(), makeDeps());
		expect(() => tree.step()).not.toThrow();
	});

	it("agent context has correct identity", () => {
		const { agent } = createAgentBT(makeAgent(), makeDeps());
		expect(agent.context.name).toBe("Atlas");
		expect(agent.context.goals).toHaveLength(1);
	});

	it("tree step runs without error", () => {
		const { tree } = createAgentBT(makeAgent(), makeDeps());
		tree.step();
		// After one step, the tree should have attempted the ActiveGoal branch
		// which starts with PickGoal — no error means the BT evaluated correctly.
	});

	it("handles agent with no goals (falls to idle)", () => {
		const { tree, agent } = createAgentBT(makeAgent({ goals: [] }), makeDeps());
		tree.step();
		// With no goals, ActiveGoal branch fails, should fall through to idle behavior
		// The agent context should remain valid after the tick
		expect(agent.context.name).toBe("Atlas");
	});
});
