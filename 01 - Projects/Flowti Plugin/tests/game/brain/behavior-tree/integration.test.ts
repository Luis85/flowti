import { describe, it, expect, vi } from "vitest";
import { createAgentBT } from "../../../../src/game/brain/behavior-tree/bt-factory.js";
import { btTick } from "../../../../src/game/brain/behavior-tree/bt-tick.js";
import type { AgentToolDeps, BTAgentDef } from "../../../../src/game/brain/behavior-tree/bt-types.js";

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
		worldState: { emitAction: vi.fn(), updateEntity: vi.fn() },
		checkPermission: vi.fn(() => "allowed" as const),
		...overrides,
	};
}

describe("BT integration — full tick cycle", () => {
	it("agent with review goal produces artifact after ticks", () => {
		const deps = makeDeps();
		const agent: BTAgentDef = {
			name: "Atlas",
			agentType: "ai",
			attributes: { str: 10, int: 14, wis: 14, cha: 10, dex: 10, con: 14 },
			persona: "The Architect",
			mood: "focused",
			goals: [{ name: "review iteration plan", priority: 10 }],
		};

		const { tree, agent: btAgent } = createAgentBT(agent, deps);

		// Tick several times to walk through the tree
		const allActions: ReturnType<typeof btTick> = [];
		for (let i = 0; i < 5; i++) {
			const actions = btTick(tree, btAgent, deps.worldState, deps.clock);
			allActions.push(...actions);
		}

		// Verify full pipeline: PickGoal -> ReadFile -> GenerateFromTemplate -> WriteFile -> DropArtifact
		expect(allActions.some((a) => a.type === "goal-started")).toBe(true);
		expect(allActions.some((a) => a.type === "file-read")).toBe(true);
		expect(allActions.some((a) => a.type === "template-generated")).toBe(true);
		expect(allActions.some((a) => a.type === "file-written")).toBe(true);

		// Verify ReadFile actually populated the context
		expect(deps.disk.readFileSync).toHaveBeenCalled();

		// Verify WriteFile wrote content
		expect(deps.disk.writeFileSync).toHaveBeenCalled();

		// Verify artifact entity was created in world state
		expect(deps.worldState.updateEntity).toHaveBeenCalledWith(
			expect.stringContaining("artifact-Atlas-"),
			"artifact",
			expect.objectContaining({ droppedBy: "Atlas" }),
		);
	});

	it("agent without LLM falls back to template generation", () => {
		const deps = makeDeps({ providerRegistry: undefined });
		const agent: BTAgentDef = {
			name: "Scout",
			agentType: "ai",
			goals: [{ name: "summarize report", priority: 5 }],
		};

		const { tree, agent: btAgent } = createAgentBT(agent, deps);

		const allActions: ReturnType<typeof btTick> = [];
		for (let i = 0; i < 5; i++) {
			allActions.push(...btTick(tree, btAgent, deps.worldState, deps.clock));
		}

		expect(allActions.some((a) => a.type === "template-generated")).toBe(true);
	});

	it("agent with no goals falls to idle behavior", () => {
		const deps = makeDeps();
		const agent: BTAgentDef = {
			name: "Idle",
			agentType: "human",
			goals: [],
		};

		const { tree, agent: btAgent } = createAgentBT(agent, deps);
		const actions = btTick(tree, btAgent, deps.worldState, deps.clock);

		// With no goals, ActiveGoal branch fails -> should fall to idle or social
		expect(actions.length).toBeGreaterThan(0);
		const hasIdleOrSpeech = actions.some(
			(a) => a.type === "idle" || a.type === "speaking",
		);
		expect(hasIdleOrSpeech).toBe(true);
	});

	it("permission denied on WriteFile causes graceful fallback", () => {
		const checkPermission = vi.fn((tool: string) => tool === "Write" ? "denied" as const : "allowed" as const);
		const deps = makeDeps({ checkPermission });
		const agent: BTAgentDef = {
			name: "Blocked",
			agentType: "ai",
			goals: [{ name: "review plan", priority: 10 }],
		};

		const { tree, agent: btAgent } = createAgentBT(agent, deps);

		// Should not throw even when WriteFile is denied
		expect(() => {
			for (let i = 0; i < 5; i++) btTick(tree, btAgent, deps.worldState, deps.clock);
		}).not.toThrow();
	});
});
