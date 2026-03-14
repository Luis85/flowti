import { describe, it, expect } from "vitest";
import { generateBrief, generateFullIterationBrief, briefFileName } from "../../../src/domain/agents/agent-brief.js";
import type { BriefContext, FullBriefContext } from "../../../src/domain/agents/agent-brief.js";
import type { ActiveAgent } from "../../../src/domain/agents/agent-orchestration.js";
import type { IterationSummary } from "../../../src/domain/iterations/iteration-types.js";
import type { LifecycleTemplate } from "../../../src/domain/lifecycle/lifecycle-types.js";
import type { OrchestrationConfig } from "../../../src/infrastructure/types.js";

function makeAgent(overrides: Partial<ActiveAgent> = {}): ActiveAgent {
	return { name: "Product Owner", role: "refiner", instruction: "Refine the goal", state: "new", ...overrides };
}

function makeIteration(overrides: Partial<IterationSummary> = {}): IterationSummary {
	return {
		name: "Agent Orchestration", number: 3, startDate: "2026-03-14", endDate: "2026-03-28",
		goal: "Agents work on plans", capacity: "", description: "Build the orchestration layer",
		status: "new", file: "iteration-003-plan.md", agents: [], resources: [], capacities: [],
		scopeItems: [{ text: "Phase 1: Bindings", done: true }, { text: "Phase 2: Briefs", done: false }],
		...overrides,
	};
}

function makeCtx(overrides: Partial<BriefContext> = {}): BriefContext {
	return {
		agent: makeAgent(),
		iteration: makeIteration(),
		systemPrompt: "You are a product owner focused on value delivery.",
		validTransitions: ["planned", "cancelled"],
		...overrides,
	};
}

describe("generateBrief", () => {
	it("includes the agent name and iteration number in the title", () => {
		const brief = generateBrief(makeCtx());
		expect(brief).toContain("# Agent Brief: Product Owner — Iteration #3");
	});

	it("includes the agent role and instruction", () => {
		const brief = generateBrief(makeCtx());
		expect(brief).toContain("**Product Owner** (refiner)");
		expect(brief).toContain("Your task: Refine the goal");
	});

	it("includes the system prompt section", () => {
		const brief = generateBrief(makeCtx());
		expect(brief).toContain("## System Prompt");
		expect(brief).toContain("You are a product owner focused on value delivery.");
	});

	it("omits system prompt section when null", () => {
		const brief = generateBrief(makeCtx({ systemPrompt: null }));
		expect(brief).not.toContain("## System Prompt");
	});

	it("includes iteration context fields", () => {
		const brief = generateBrief(makeCtx());
		expect(brief).toContain("**Name**: Agent Orchestration");
		expect(brief).toContain("**Goal**: Agents work on plans");
		expect(brief).toContain("**Status**: new");
		expect(brief).toContain("**Dates**: 2026-03-14 → 2026-03-28");
		expect(brief).toContain("**Description**: Build the orchestration layer");
	});

	it("includes valid transitions", () => {
		const brief = generateBrief(makeCtx());
		expect(brief).toContain("**Next states**: planned, cancelled");
	});

	it("omits next states when empty", () => {
		const brief = generateBrief(makeCtx({ validTransitions: [] }));
		expect(brief).not.toContain("Next states");
	});

	it("includes scope items with completion count", () => {
		const brief = generateBrief(makeCtx());
		expect(brief).toContain("## Scope Items (1/2 done)");
		expect(brief).toContain("- [x] Phase 1: Bindings");
		expect(brief).toContain("- [ ] Phase 2: Briefs");
	});

	it("shows placeholder when no scope items", () => {
		const brief = generateBrief(makeCtx({ iteration: makeIteration({ scopeItems: [] }) }));
		expect(brief).toContain("_No scope items yet._");
	});

	it("includes expected output instructions", () => {
		const brief = generateBrief(makeCtx());
		expect(brief).toContain("## Expected Output");
		expect(brief).toContain("Write your changes directly to the iteration plan file");
	});

	it("omits instruction line when agent has no instruction", () => {
		const brief = generateBrief(makeCtx({ agent: makeAgent({ instruction: "" }) }));
		expect(brief).not.toContain("Your task:");
	});

	it("omits description when empty", () => {
		const brief = generateBrief(makeCtx({ iteration: makeIteration({ description: "" }) }));
		expect(brief).not.toContain("**Description**");
	});
});

describe("briefFileName", () => {
	it("generates zero-padded file name", () => {
		expect(briefFileName(3, "new")).toBe("iteration-003-new.md");
	});

	it("handles large numbers", () => {
		expect(briefFileName(42, "planned")).toBe("iteration-042-planned.md");
	});
});

// ── Full-iteration brief ────────────────────────────────────────────

const iterTemplate: LifecycleTemplate = {
	entityType: "iteration",
	states: ["new", "planned", "ready", "in-progress", "in-review", "done", "cancelled"],
	transitions: {
		"new": ["planned", "cancelled"],
		"planned": ["ready", "cancelled"],
		"ready": ["in-progress", "cancelled"],
		"in-progress": ["in-review", "cancelled"],
		"in-review": ["done", "cancelled"],
		"done": [],
		"cancelled": [],
	},
	initialState: "new",
	terminalStates: ["done", "cancelled"],
};

const orchestration: OrchestrationConfig = {
	phases: {
		"new": { agent: "Product Owner", role: "refiner", instruction: "Refine the goal" },
		"planned": { agent: "Architect", role: "planner", instruction: "Break scope into tasks" },
		"in-progress": { agent: "Developer", role: "implementer", instruction: "Implement scope items" },
	},
};

function makeFullCtx(overrides: Partial<FullBriefContext> = {}): FullBriefContext {
	return {
		agentName: "Software Architect",
		iteration: makeIteration({ status: "planned" }),
		systemPrompt: "You are a software architect.",
		template: iterTemplate,
		orchestration,
		...overrides,
	};
}

describe("generateFullIterationBrief", () => {
	it("includes agent name and iteration number in title", () => {
		const brief = generateFullIterationBrief(makeFullCtx());
		expect(brief).toContain("# Full Iteration Brief: Software Architect — Iteration #3");
	});

	it("includes lifecycle path from current state to done", () => {
		const brief = generateFullIterationBrief(makeFullCtx());
		expect(brief).toContain("planned → ready → in-progress → in-review → done");
	});

	it("includes phase instructions from orchestration", () => {
		const brief = generateFullIterationBrief(makeFullCtx());
		expect(brief).toContain("### planned (planner)");
		expect(brief).toContain("Break scope into tasks");
		expect(brief).toContain("### in-progress (implementer)");
		expect(brief).toContain("Implement scope items");
	});

	it("includes system prompt when provided", () => {
		const brief = generateFullIterationBrief(makeFullCtx());
		expect(brief).toContain("## System Prompt");
		expect(brief).toContain("You are a software architect.");
	});

	it("omits system prompt when null", () => {
		const brief = generateFullIterationBrief(makeFullCtx({ systemPrompt: null }));
		expect(brief).not.toContain("## System Prompt");
	});

	it("includes iteration context", () => {
		const brief = generateFullIterationBrief(makeFullCtx());
		expect(brief).toContain("**Goal**: Agents work on plans");
		expect(brief).toContain("**Status**: planned");
	});

	it("includes scope items", () => {
		const brief = generateFullIterationBrief(makeFullCtx());
		expect(brief).toContain("- [x] Phase 1: Bindings");
		expect(brief).toContain("- [ ] Phase 2: Briefs");
	});

	it("includes expected output instructions", () => {
		const brief = generateFullIterationBrief(makeFullCtx());
		expect(brief).toContain("## Expected Output");
		expect(brief).toContain("Update the iteration plan file directly");
	});

	it("handles missing orchestration gracefully", () => {
		const brief = generateFullIterationBrief(makeFullCtx({ orchestration: undefined }));
		expect(brief).not.toContain("## Phase Instructions");
		expect(brief).toContain("planned → ready");
	});

	it("builds path starting from in-progress", () => {
		const brief = generateFullIterationBrief(makeFullCtx({ iteration: makeIteration({ status: "in-progress" }) }));
		expect(brief).toContain("in-progress → in-review → done");
		expect(brief).not.toContain("planned →");
	});

	it("says execute all phases in role section", () => {
		const brief = generateFullIterationBrief(makeFullCtx());
		expect(brief).toContain("Execute all phases from planned → done");
	});
});
