import { describe, it, expect } from "vitest";
import { generateBrief, briefFileName } from "../../../src/domain/agents/agent-brief.js";
import type { BriefContext } from "../../../src/domain/agents/agent-brief.js";
import type { ActiveAgent } from "../../../src/domain/agents/agent-orchestration.js";
import type { IterationSummary } from "../../../src/domain/iterations/iteration-types.js";

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
