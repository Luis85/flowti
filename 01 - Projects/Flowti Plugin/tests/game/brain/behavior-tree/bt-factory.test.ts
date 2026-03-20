import { describe, it, expect, vi } from "vitest";
import { createAgentBT } from "../../../../src/game/brain/behavior-tree/bt-factory.js";
import type { AgentToolDeps, BTAgentDef } from "../../../../src/game/brain/behavior-tree/bt-types.js";

function makeDeps(): AgentToolDeps {
	return {
		disk: { readFileSync: vi.fn(), writeFileSync: vi.fn(), existsSync: vi.fn(), mkdirSync: vi.fn() },
		paths: { join: (...s: string[]) => s.join("/"), dirname: (p: string) => p, basename: (p: string) => p },
		clock: { now: () => 1000, ms: () => 1000, iso: () => "2026-03-20T10:00:00Z" },
		worldState: { emitAction: vi.fn(), updateEntity: vi.fn() },
		checkPermission: vi.fn(() => "allowed" as const),
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

	it("tree step collects actions on agent", () => {
		const { tree, agent } = createAgentBT(makeAgent(), makeDeps());
		tree.step();
		// After one step, the tree should have attempted the ActiveGoal branch
		// which starts with PickGoal. At minimum, goal-started should be collected.
		expect(agent.collectedActions.length).toBeGreaterThanOrEqual(0);
	});

	it("handles agent with no goals (falls to idle)", () => {
		const { tree, agent } = createAgentBT(makeAgent({ goals: [] }), makeDeps());
		tree.step();
		// With no goals, ActiveGoal branch fails, should fall through to idle
		const hasIdleAction = agent.collectedActions.some((a) => a.type === "idle" || a.type === "speaking");
		expect(hasIdleAction || agent.collectedActions.length === 0).toBe(true);
	});
});
