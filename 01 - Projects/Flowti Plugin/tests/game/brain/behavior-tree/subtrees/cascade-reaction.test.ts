import { describe, it, expect, vi } from "vitest";
import { CASCADE_REACTION_SUBTREE } from "../../../../../src/game/brain/behavior-tree/subtrees/cascade-reaction.js";
import { createAgentBT } from "../../../../../src/game/brain/behavior-tree/bt-factory.js";
import { btTick } from "../../../../../src/game/brain/behavior-tree/bt-tick.js";
import type { AgentToolDeps, BTAgentDef } from "../../../../../src/game/brain/behavior-tree/bt-types.js";
import { createDefaultBlackboard } from "../../../../../src/game/systems/blackboard.js";

function makeDeps(overrides: Partial<AgentToolDeps> = {}): AgentToolDeps {
	return {
		disk: { readFileSync: vi.fn(() => ""), writeFileSync: vi.fn(), existsSync: vi.fn(() => false), mkdirSync: vi.fn() },
		paths: { join: (...s: string[]) => s.join("/"), dirname: (p: string) => p, basename: (p: string) => p },
		clock: { now: () => 1000, ms: () => 1000, iso: () => "2026-03-24T10:00:00Z" },
		checkPermission: vi.fn(() => "allowed" as const),
		blackboard: createDefaultBlackboard(),
		...overrides,
	};
}

const baseAgent: BTAgentDef = { name: "Scout", agentType: "ai", goals: [] };

describe("CASCADE_REACTION_SUBTREE MDSL", () => {
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

describe("CascadeReaction — full BT tick", () => {
	it("seek-proximity hint triggers walk-to cascade target", () => {
		const bb = createDefaultBlackboard();
		bb.cascadeHint = "seek-proximity";
		bb.cascadeTarget = { x: 200, y: 150 };
		const deps = makeDeps({ blackboard: bb });
		const { tree, agent } = createAgentBT(baseAgent, deps);

		btTick(tree, agent, bb);

		expect(bb.intent).toBe("seeking");
		expect(bb.intentDetail).toBe("cascade-seek");
		expect(bb.movementCommand).toBe("walk-to");
		expect(bb.movementTarget).toEqual({ x: 200, y: 150 });
	});

	it("force-break hint triggers walk-to rest station", () => {
		const bb = createDefaultBlackboard();
		bb.cascadeHint = "force-break";
		bb.nearestRestStation = { x: 50, y: 50 };
		const deps = makeDeps({ blackboard: bb });
		const { tree, agent } = createAgentBT(baseAgent, deps);

		btTick(tree, agent, bb);

		expect(bb.intent).toBe("on-break");
		expect(bb.intentDetail).toBe("cascade-break");
		expect(bb.movementCommand).toBe("walk-to");
		expect(bb.movementTarget).toEqual({ x: 50, y: 50 });
	});

	it("clears cascadeHint and cascadeTarget after acting", () => {
		const bb = createDefaultBlackboard();
		bb.cascadeHint = "seek-proximity";
		bb.cascadeTarget = { x: 100, y: 100 };
		const deps = makeDeps({ blackboard: bb });
		const { tree, agent } = createAgentBT(baseAgent, deps);

		btTick(tree, agent, bb);

		expect(bb.cascadeHint).toBeNull();
		expect(bb.cascadeTarget).toBeNull();
	});

	it("force-break with no rest station fails gracefully (falls through)", () => {
		const bb = createDefaultBlackboard();
		bb.cascadeHint = "force-break";
		bb.nearestRestStation = null;
		const deps = makeDeps({ blackboard: bb });
		const { tree, agent } = createAgentBT(baseAgent, deps);

		btTick(tree, agent, bb);

		// ReactToCascade returns failed → hint cleared, BT falls through to idle
		expect(bb.cascadeHint).toBeNull();
		expect(bb.intent).toBe("idle");
	});

	it("no cascade hint → CascadeReaction does not fire", () => {
		const bb = createDefaultBlackboard();
		const deps = makeDeps({ blackboard: bb });
		const { tree, agent } = createAgentBT(baseAgent, deps);

		btTick(tree, agent, bb);

		// Falls through to idle (no cascade, no goals, no needs)
		expect(bb.intentDetail).not.toBe("cascade-seek");
		expect(bb.intentDetail).not.toBe("cascade-break");
	});
});
