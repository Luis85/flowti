import { describe, it, expect, vi } from "vitest";
import { State } from "mistreevous";
import { createBTAgent } from "../../../../src/domain/agents/behavior-tree/bt-agent.js";
import { createDefaultNeeds, createIdleLLMSlot } from "../../../../src/domain/agents/behavior-tree/bt-types.js";
import type { AgentToolDeps } from "../../../../src/domain/agents/behavior-tree/bt-types.js";
import type { AgentSummary } from "../../../../src/domain/agents/agent-types.js";

function makeDeps(overrides: Partial<AgentToolDeps> = {}): AgentToolDeps {
	return {
		disk: { readFileSync: vi.fn(), writeFileSync: vi.fn(), existsSync: vi.fn(), mkdirSync: vi.fn() },
		paths: { join: (...s: string[]) => s.join("/"), dirname: (p: string) => p, basename: (p: string) => p },
		clock: { now: () => 1000, ms: () => 1000, iso: () => "2026-03-20T10:00:00Z" },
		worldState: { emitAction: vi.fn(), updateEntity: vi.fn(), getState: vi.fn(), getEntity: vi.fn(), flush: vi.fn(), addActionListener: vi.fn(), removeActionListener: vi.fn() },
		checkPermission: vi.fn(() => "allowed" as const),
		...overrides,
	} as AgentToolDeps;
}

function makeAgent(overrides: Partial<AgentSummary> = {}): AgentSummary {
	return {
		name: "Atlas",
		agentType: "ai",
		description: "Test agent",
		skills: [],
		tools: [],
		roles: [],
		attributes: { str: 10, int: 14, wis: 12, cha: 10, dex: 10, con: 14 },
		persona: "The Architect",
		mood: "focused",
		personality: ["analytical", "methodical"],
		experience: 100,
		goals: [{ name: "review iteration plan", priority: 10 }],
		file: "agents/atlas.md",
		...overrides,
	};
}

describe("createBTAgent — conditions", () => {
	it("HasEnoughEnergy returns true when energy above threshold", () => {
		const bt = createBTAgent(makeAgent(), makeDeps());
		bt.context.needs.energy = 50;
		expect(bt.HasEnoughEnergy()).toBe(true);
	});

	it("HasEnoughEnergy returns false when energy below threshold", () => {
		const bt = createBTAgent(makeAgent(), makeDeps());
		bt.context.needs.energy = 10;
		expect(bt.HasEnoughEnergy()).toBe(false);
	});

	it("HasEnoughEnergy threshold lowered by high CON", () => {
		const bt = createBTAgent(makeAgent({ attributes: { con: 20 } }), makeDeps());
		bt.context.needs.energy = 21;
		// Threshold = 30 - 20/2 = 20, so 21 > 20 = true
		expect(bt.HasEnoughEnergy()).toBe(true);
	});

	it("HasEnoughFocus returns true when focus above threshold", () => {
		const bt = createBTAgent(makeAgent(), makeDeps());
		bt.context.needs.focus = 50;
		expect(bt.HasEnoughFocus()).toBe(true);
	});

	it("HasEnoughFocus threshold lowered by high INT", () => {
		const bt = createBTAgent(makeAgent({ attributes: { int: 18 } }), makeDeps());
		bt.context.needs.focus = 15;
		// Threshold = 20 - 18/3 = 14, so 15 > 14 = true
		expect(bt.HasEnoughFocus()).toBe(true);
	});

	it("HasEnoughMorale returns true when morale above 10", () => {
		const bt = createBTAgent(makeAgent(), makeDeps());
		bt.context.needs.morale = 15;
		expect(bt.HasEnoughMorale()).toBe(true);
	});

	it("HasActiveGoal returns false when no active goal", () => {
		const bt = createBTAgent(makeAgent(), makeDeps());
		expect(bt.HasActiveGoal()).toBe(false);
	});

	it("HasActiveGoal returns true when goal is set", () => {
		const bt = createBTAgent(makeAgent(), makeDeps());
		bt.context.activeGoal = { name: "review plan", priority: 10 };
		expect(bt.HasActiveGoal()).toBe(true);
	});

	it("HasGoalFile returns false initially", () => {
		const bt = createBTAgent(makeAgent(), makeDeps());
		expect(bt.HasGoalFile()).toBe(false);
	});

	it("HasLLMProvider returns false when no registry", () => {
		const bt = createBTAgent(makeAgent(), makeDeps({ providerRegistry: undefined }));
		expect(bt.HasLLMProvider()).toBe(false);
	});

	it("HasLLMProvider returns true when providers registered", () => {
		const registry = { register: vi.fn(), get: vi.fn(), list: vi.fn(() => [{}]), select: vi.fn() };
		const bt = createBTAgent(makeAgent(), makeDeps({ providerRegistry: registry as never }));
		expect(bt.HasLLMProvider()).toBe(true);
	});

	it("HasNearbyAgent returns false when no nearby agents", () => {
		const bt = createBTAgent(makeAgent(), makeDeps());
		expect(bt.HasNearbyAgent()).toBe(false);
	});

	it("HasPendingEvent returns false initially (Phase 1)", () => {
		const bt = createBTAgent(makeAgent(), makeDeps());
		expect(bt.HasPendingEvent()).toBe(false);
	});

	it("HasFileContent returns false initially", () => {
		const bt = createBTAgent(makeAgent(), makeDeps());
		expect(bt.HasFileContent()).toBe(false);
	});

	it("HasLLMResult returns false initially", () => {
		const bt = createBTAgent(makeAgent(), makeDeps());
		expect(bt.HasLLMResult()).toBe(false);
	});
});

describe("createBTAgent — tool actions", () => {
	it("PickGoal selects highest-priority goal when WIS >= 14", () => {
		const agent = makeAgent({
			attributes: { wis: 16 },
			goals: [
				{ name: "review plan", priority: 5 },
				{ name: "summarize report", priority: 10 },
			],
		});
		const bt = createBTAgent(agent, makeDeps());
		const result = bt.PickGoal();
		expect(result).toBe(State.SUCCEEDED);
		expect(bt.context.activeGoal?.name).toBe("summarize report");
	});

	it("PickGoal fails when no goals exist", () => {
		const bt = createBTAgent(makeAgent({ goals: [] }), makeDeps());
		expect(bt.PickGoal()).toBe(State.FAILED);
	});

	it("PickGoalFile derives file name from goal", () => {
		const bt = createBTAgent(makeAgent(), makeDeps());
		bt.context.activeGoal = { name: "review iteration plan" };
		const result = bt.PickGoalFile();
		expect(result).toBe(State.SUCCEEDED);
		expect(bt.context.activeGoalFile).toBe("iteration-plan.md");
	});

	it("ReadFile stores content on context", () => {
		const disk = { readFileSync: vi.fn(() => "file content"), writeFileSync: vi.fn(), existsSync: vi.fn(), mkdirSync: vi.fn() };
		const bt = createBTAgent(makeAgent(), makeDeps({ disk }));
		(bt.context as { workingFilePath: string }).workingFilePath = "test.md";
		const result = bt.ReadFile();
		expect(result).toBe(State.SUCCEEDED);
		expect(bt.context.lastFileContent).toBe("file content");
	});

	it("ReadFile returns FAILED when permission denied", () => {
		const bt = createBTAgent(makeAgent(), makeDeps({ checkPermission: vi.fn(() => "denied" as const) }));
		(bt.context as { workingFilePath: string }).workingFilePath = "test.md";
		expect(bt.ReadFile()).toBe(State.FAILED);
	});

	it("WriteFile writes content and stores path", () => {
		const disk = { readFileSync: vi.fn(), writeFileSync: vi.fn(), existsSync: vi.fn(), mkdirSync: vi.fn() };
		const bt = createBTAgent(makeAgent(), makeDeps({ disk }));
		bt.context.activeGoal = { name: "review plan" };
		(bt.context as { lastLLMResult: string }).lastLLMResult = "generated content";
		const result = bt.WriteFile();
		expect(result).toBe(State.SUCCEEDED);
		expect(disk.writeFileSync).toHaveBeenCalled();
		expect(bt.context.lastWrittenPath).toContain("Atlas-review-");
	});

	it("GenerateFromTemplate populates lastLLMResult", () => {
		const bt = createBTAgent(makeAgent(), makeDeps());
		bt.context.activeGoal = { name: "review plan" };
		(bt.context as { activeGoalFile: string }).activeGoalFile = "plan.md";
		(bt.context as { lastFileContent: string }).lastFileContent = "# Plan\n\nContent here.";
		const result = bt.GenerateFromTemplate();
		expect(result).toBe(State.SUCCEEDED);
		expect(bt.context.lastLLMResult).toBeTruthy();
		expect(bt.context.lastLLMResult!.length).toBeGreaterThan(50);
	});

	it("DropArtifact creates entity and emits action", () => {
		const worldState = { emitAction: vi.fn(), updateEntity: vi.fn(), getState: vi.fn(), getEntity: vi.fn(), flush: vi.fn(), addActionListener: vi.fn(), removeActionListener: vi.fn() };
		const bt = createBTAgent(makeAgent(), makeDeps({ worldState }));
		bt.context.activeGoal = { name: "review plan" };
		(bt.context as { lastWrittenPath: string }).lastWrittenPath = "artifacts/Atlas-review-1000.md";
		const result = bt.DropArtifact();
		expect(result).toBe(State.SUCCEEDED);
		expect(worldState.updateEntity).toHaveBeenCalledWith(
			expect.stringContaining("artifact-Atlas-"),
			"artifact",
			expect.objectContaining({ droppedBy: "Atlas", goalType: "review" }),
		);
	});

	it("DropArtifact auto-opens file when STR >= 14", () => {
		const bt = createBTAgent(makeAgent({ attributes: { str: 16 } }), makeDeps());
		bt.context.activeGoal = { name: "review plan" };
		(bt.context as { lastWrittenPath: string }).lastWrittenPath = "artifacts/Atlas-review-1000.md";
		bt.DropArtifact();
		const fileOpenedAction = bt.collectedActions.find((a) => a.type === "file-opened");
		expect(fileOpenedAction).toBeDefined();
	});

	it("SpeakBubble emits speaking action", () => {
		const bt = createBTAgent(makeAgent(), makeDeps());
		(bt.context as { lastLLMResult: string }).lastLLMResult = "Here are my findings...";
		bt.SpeakBubble();
		const speakAction = bt.collectedActions.find((a) => a.type === "speaking");
		expect(speakAction).toBeDefined();
		expect(speakAction?.data.source).toBe("bt");
	});

	it("OpenInVault emits file-opened action", () => {
		const bt = createBTAgent(makeAgent(), makeDeps());
		(bt.context as { lastWrittenPath: string }).lastWrittenPath = "test.md";
		const result = bt.OpenInVault();
		expect(result).toBe(State.SUCCEEDED);
		expect(bt.collectedActions.find((a) => a.type === "file-opened")).toBeDefined();
	});
});
