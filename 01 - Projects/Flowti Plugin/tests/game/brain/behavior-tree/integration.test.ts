import { describe, it, expect, vi } from "vitest";
import { createAgentBT } from "../../../../src/game/brain/behavior-tree/bt-factory.js";
import { btTick } from "../../../../src/game/brain/behavior-tree/bt-tick.js";
import type { AgentToolDeps, BTAgentDef } from "../../../../src/game/brain/behavior-tree/bt-types.js";
import { createDefaultBlackboard } from "../../../../src/game/systems/blackboard.js";

function makeDeps(overrides: Partial<AgentToolDeps> = {}): AgentToolDeps {
	return {
		disk: {
			readFileSync: vi.fn(() => "---\nstatus: in-progress\n---\n# Iteration Plan\n\n## Goals\n\n- Ship A\n\n## Risks\n\nNone."),
			writeFileSync: vi.fn(),
			existsSync: vi.fn(() => true),
			mkdirSync: vi.fn(),
		},
		paths: { join: (...s: string[]) => s.join("/"), dirname: (p: string) => p, basename: (p: string) => p },
		clock: { now: () => 1000, ms: () => 1000, iso: () => "2026-03-20T10:00:00Z" },
		checkPermission: vi.fn(() => "allowed" as const),
		blackboard: createDefaultBlackboard(),
		...overrides,
	};
}

describe("BT integration — full tick cycle", () => {
	it("agent with goals goes through work cycle (needs-driven priority)", () => {
		const bb = createDefaultBlackboard();
		bb.nearestWorkstation = { x: 100, y: 100 };
		const applyNeedsEffect = vi.fn();
		const deps = makeDeps({ blackboard: bb, applyNeedsEffect });
		const agent: BTAgentDef = {
			name: "Atlas",
			agentType: "ai",
			attributes: { str: 10, int: 14, wis: 14, cha: 10, dex: 10, con: 14 },
			persona: "The Architect",
			mood: "focused",
			goals: [{ name: "review iteration plan", priority: 10 }],
		};

		const { tree, agent: btAgent } = createAgentBT(agent, deps);

		// Tick 1 — WorkCycle: PickGoal → GoToWorkstation returns "running" (walking)
		btTick(tree, btAgent, bb);
		expect(bb.intent).toBe("working");
		expect(bb.movementCommand).toBe("walk-to");

		// Simulate arrival at workstation
		bb.arrived = true;

		// Tick 2 — GoToWorkstation → succeeded → DoWork → LeaveWorkstation
		btTick(tree, btAgent, bb);

		// DoWork calls applyNeedsEffect, proving the work cycle completed
		expect(applyNeedsEffect).toHaveBeenCalledWith({ focus: -5, morale: 1 });
	});

	it("agent with low energy seeks rest instead of working", () => {
		const bb = createDefaultBlackboard();
		bb.nearestRestStation = { x: 50, y: 50 };
		const deps = makeDeps({ blackboard: bb });
		const agent: BTAgentDef = {
			name: "Scout",
			agentType: "ai",
			goals: [{ name: "summarize report", priority: 5 }],
		};

		const { tree, agent: btAgent } = createAgentBT(agent, deps);
		// Set energy below threshold — NeedsEnergy branch fires
		btAgent.context.needs.energy = 10;

		// Single tick — NeedsEnergy branch fires: SeekRestSpot returns "running"
		btTick(tree, btAgent, bb);

		// Low energy should trigger seeking/rest intent on blackboard
		expect(bb.intent).toBe("seeking");
		expect(bb.intentDetail).toBe("seek-rest");
		expect(bb.movementCommand).toBe("walk-to");
	});

	it("agent with no goals falls to idle behavior", () => {
		const bb = createDefaultBlackboard();
		const deps = makeDeps({ blackboard: bb });
		const agent: BTAgentDef = {
			name: "Idle",
			agentType: "human",
			goals: [],
		};

		const { tree, agent: btAgent } = createAgentBT(agent, deps);
		btTick(tree, btAgent, bb);

		// With no goals, ActiveGoal branch fails -> should fall to idle
		expect(bb.intent).toBe("idle");
	});

	it("cascade hint triggers CascadeReaction before idle", () => {
		const bb = createDefaultBlackboard();
		bb.cascadeHint = "seek-proximity";
		bb.cascadeTarget = { x: 200, y: 150 };
		const deps = makeDeps({ blackboard: bb });
		const agent: BTAgentDef = {
			name: "Scout",
			agentType: "ai",
			goals: [],
		};

		const { tree, agent: btAgent } = createAgentBT(agent, deps);
		btTick(tree, btAgent, bb);

		expect(bb.intent).toBe("seeking");
		expect(bb.intentDetail).toBe("cascade-seek");
		expect(bb.movementCommand).toBe("walk-to");
		// Cascade hint should be cleared after acting
		expect(bb.cascadeHint).toBeNull();
	});

	it("whim is suppressed when needs are critical", () => {
		const bb = createDefaultBlackboard();
		const deps = makeDeps({ blackboard: bb });
		const agent: BTAgentDef = {
			name: "Tired",
			agentType: "ai",
			goals: [],
		};

		const { tree, agent: btAgent } = createAgentBT(agent, deps);
		btAgent.context.needs.energy = 20; // Below 40 threshold
		btTick(tree, btAgent, bb);

		// Should NOT be a whim — should be idle or needs-driven
		expect(bb.intentDetail).not.toContain("whim");
	});

	it("permission denied on WriteFile causes graceful fallback", () => {
		const bb = createDefaultBlackboard();
		const checkPermission = vi.fn((tool: string) => tool === "Write" ? "denied" as const : "allowed" as const);
		const deps = makeDeps({ checkPermission, blackboard: bb });
		const agent: BTAgentDef = {
			name: "Blocked",
			agentType: "ai",
			goals: [{ name: "review plan", priority: 10 }],
		};

		const { tree, agent: btAgent } = createAgentBT(agent, deps);

		// Should not throw even when WriteFile is denied
		expect(() => {
			for (let i = 0; i < 5; i++) btTick(tree, btAgent, bb);
		}).not.toThrow();
	});
});
