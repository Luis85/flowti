import { describe, it, expect } from "vitest";
import { generateBrief, briefFileName, agentWikilink } from "../../../src/domain/agents/agent-brief.js";
import type { BriefContext } from "../../../src/domain/agents/agent-brief.js";
import type { IterationSummary } from "../../../src/domain/iterations/iteration-types.js";
import type { LifecycleTemplate } from "../../../src/domain/lifecycle/lifecycle-types.js";
import type { OrchestrationConfig } from "../../../src/infrastructure/types.js";

function makeIteration(overrides: Partial<IterationSummary> = {}): IterationSummary {
	return {
		name: "Agent Orchestration", number: 3, startDate: "2026-03-14", endDate: "2026-03-28",
		goal: "Agents work on plans", capacity: "", description: "Build the orchestration layer",
		status: "new", file: "iteration-003-plan.md", agents: [], resources: [], capacities: [],
		scopeItems: [{ text: "Phase 1: Bindings", done: true }, { text: "Phase 2: Briefs", done: false }],
		...overrides,
	};
}

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
	tasks: {
		"new": ["Refine goal and vision", "Identify initial scope items"],
		"planned": ["Break scope into actionable tasks", "Assign resources"],
		"in-progress": ["Track progress daily"],
	},
};

function makeCtx(overrides: Partial<BriefContext> = {}): BriefContext {
	return {
		agentName: "Product Owner",
		agentDescription: "Refines iteration goals and identifies scope items",
		agentSkills: ["Product Strategy", "Scope Definition"],
		agentRoles: ["Refiner", "Planner"],
		iteration: makeIteration(),
		systemPrompt: "You are a product owner focused on value delivery.",
		...overrides,
	};
}

describe("generateBrief", () => {
	it("includes the agent name and iteration number in the title", () => {
		const brief = generateBrief(makeCtx());
		expect(brief).toContain("# Agent Brief: Product Owner — Iteration #3");
	});

	it("includes agent wikilink and open status", () => {
		const brief = generateBrief(makeCtx());
		expect(brief).toContain("**Agent**: [[product-owner|Product Owner]]");
		expect(brief).toContain("**Status**: open");
	});

	it("includes frontmatter with agent, iteration, phase, and status", () => {
		const brief = generateBrief(makeCtx());
		expect(brief).toContain("agent: Product Owner");
		expect(brief).toContain("iteration: 3");
		expect(brief).toContain("phase: new");
		expect(brief).toContain("status: open");
	});

	it("includes the agent role context with description, skills, and roles", () => {
		const brief = generateBrief(makeCtx());
		expect(brief).toContain("## Your Role");
		expect(brief).toContain("Refines iteration goals and identifies scope items");
		expect(brief).toContain("**Skills**: Product Strategy, Scope Definition");
		expect(brief).toContain("**Roles**: Refiner, Planner");
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

	it("references scope items via wikilink instead of duplicating them", () => {
		const brief = generateBrief(makeCtx());
		expect(brief).toContain("## Scope Items (1/2 done)");
		expect(brief).toContain("[[iteration-003-plan|Iteration #3 Plan]]");
		expect(brief).not.toContain("- [x] Phase 1: Bindings");
	});

	it("shows placeholder with plan link when no scope items", () => {
		const brief = generateBrief(makeCtx({ iteration: makeIteration({ scopeItems: [] }) }));
		expect(brief).toContain("_No scope items yet._");
		expect(brief).toContain("[[iteration-003-plan|Iteration #3 Plan]]");
	});

	it("includes plan wikilink in iteration context", () => {
		const brief = generateBrief(makeCtx());
		expect(brief).toContain("**Plan**: [[iteration-003-plan|Iteration #3 Plan]]");
	});

	it("includes expected output instructions with plan wikilink", () => {
		const brief = generateBrief(makeCtx());
		expect(brief).toContain("## Expected Output");
		expect(brief).toContain("[[iteration-003-plan|Iteration #3 Plan]]");
	});

	it("omits description when empty", () => {
		const brief = generateBrief(makeCtx({ iteration: makeIteration({ description: "" }) }));
		expect(brief).not.toContain("**Description**");
	});

	it("includes acceptance criteria section with default items", () => {
		const brief = generateBrief(makeCtx());
		expect(brief).toContain("## Acceptance Criteria");
		expect(brief).toContain("- [ ] All scope items marked as done");
		expect(brief).toContain("- [ ] Brief reviewed and approved by stakeholder");
	});

	it("includes DoD with phase tasks when iteration template provided", () => {
		const brief = generateBrief(makeCtx({ iterationTemplate: iterTemplate }));
		expect(brief).toContain("## Definition of Done");
		expect(brief).toContain("To advance from **new** to the next phase:");
		expect(brief).toContain("- [ ] Refine goal and vision");
	});

	it("includes default DoD when no template provided", () => {
		const brief = generateBrief(makeCtx());
		expect(brief).toContain("## Definition of Done");
		expect(brief).toContain("- [ ] All scope items completed");
	});

	it("includes default DoD when template has no tasks for the current state", () => {
		const brief = generateBrief(makeCtx({ iterationTemplate: iterTemplate, iteration: makeIteration({ status: "ready" }) }));
		expect(brief).toContain("- [ ] All scope items completed");
	});

	it("includes Assigned Tasks section", () => {
		const brief = generateBrief(makeCtx());
		expect(brief).toContain("## Assigned Tasks");
	});
});

describe("generateBrief — full iteration mode", () => {
	const orchestration: OrchestrationConfig = {
		phases: {
			"new": { agent: "Product Owner", role: "refiner", instruction: "Refine the goal" },
			"planned": { agent: "Architect", role: "planner", instruction: "Break scope into tasks" },
			"in-progress": { agent: "Developer", role: "implementer", instruction: "Implement scope items" },
		},
	};

	function makeFullCtx(overrides: Partial<BriefContext> = {}): BriefContext {
		return {
			agentName: "Software Architect",
			agentDescription: "Designs systems and technical plans",
			agentSkills: ["Architecture", "Design"],
			agentRoles: ["Planner"],
			iteration: makeIteration({ status: "planned" }),
			systemPrompt: "You are a software architect.",
			iterationTemplate: iterTemplate,
			orchestration,
			...overrides,
		};
	}

	it("uses Full Iteration Brief title when orchestration is set", () => {
		const brief = generateBrief(makeFullCtx());
		expect(brief).toContain("# Full Iteration Brief: Software Architect — Iteration #3");
	});

	it("includes role context with description, skills, and roles", () => {
		const brief = generateBrief(makeFullCtx());
		expect(brief).toContain("Designs systems and technical plans");
		expect(brief).toContain("**Skills**: Architecture, Design");
		expect(brief).toContain("**Roles**: Planner");
	});

	it("says execute all phases and use other agents in role section", () => {
		const brief = generateBrief(makeFullCtx());
		expect(brief).toContain("Execute all phases from planned → done");
		expect(brief).toContain("Use other agents from the roster");
	});

	it("includes lifecycle path from current state to done", () => {
		const brief = generateBrief(makeFullCtx());
		expect(brief).toContain("planned → ready → in-progress → in-review → done");
	});

	it("includes phase instructions from orchestration", () => {
		const brief = generateBrief(makeFullCtx());
		expect(brief).toContain("### planned (planner)");
		expect(brief).toContain("Break scope into tasks");
		expect(brief).toContain("### in-progress (implementer)");
	});

	it("includes system prompt when provided", () => {
		const brief = generateBrief(makeFullCtx());
		expect(brief).toContain("## System Prompt");
		expect(brief).toContain("You are a software architect.");
	});

	it("omits system prompt when null", () => {
		const brief = generateBrief(makeFullCtx({ systemPrompt: null }));
		expect(brief).not.toContain("## System Prompt");
	});

	it("includes iteration context", () => {
		const brief = generateBrief(makeFullCtx());
		expect(brief).toContain("**Goal**: Agents work on plans");
		expect(brief).toContain("**Status**: planned");
	});

	it("handles missing orchestration gracefully", () => {
		const brief = generateBrief(makeFullCtx({ orchestration: undefined }));
		expect(brief).not.toContain("## Phase Instructions");
		expect(brief).not.toContain("## Lifecycle Path");
	});

	it("builds path starting from in-progress", () => {
		const brief = generateBrief(makeFullCtx({ iteration: makeIteration({ status: "in-progress" }) }));
		expect(brief).toContain("in-progress → in-review → done");
		expect(brief).not.toContain("planned →");
	});

	it("includes DoD with tasks for each phase in the lifecycle path", () => {
		const brief = generateBrief(makeFullCtx());
		expect(brief).toContain("## Definition of Done");
		expect(brief).toContain("### planned");
		expect(brief).toContain("- [ ] Break scope into actionable tasks");
		expect(brief).toContain("### in-progress");
		expect(brief).toContain("- [ ] Track progress daily");
	});

	it("falls back to default DoD when template has no tasks", () => {
		const brief = generateBrief(makeFullCtx({ iterationTemplate: { ...iterTemplate, tasks: undefined } }));
		expect(brief).toContain("- [ ] All scope items completed");
	});

	it("includes frontmatter with phase", () => {
		const brief = generateBrief(makeFullCtx());
		expect(brief).toContain("phase: planned");
	});
});

describe("briefFileName", () => {
	it("generates phase-scoped file name with zero-padded iteration number", () => {
		expect(briefFileName(3, "Product Owner", "new")).toBe("iteration-003-product-owner--new.md");
	});

	it("handles large numbers", () => {
		expect(briefFileName(42, "Architect", "in-progress")).toBe("iteration-042-architect--in-progress.md");
	});

	it("handles agent names with special characters", () => {
		expect(briefFileName(1, "AI Tools Expert", "planned")).toBe("iteration-001-ai-tools-expert--planned.md");
	});
});

describe("agentWikilink", () => {
	it("generates obsidian wikilink from agent name", () => {
		expect(agentWikilink("Product Owner")).toBe("[[product-owner|Product Owner]]");
	});

	it("handles single-word names", () => {
		expect(agentWikilink("Architect")).toBe("[[architect|Architect]]");
	});
});
