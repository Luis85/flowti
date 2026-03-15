import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/infrastructure/ui.js", () => ({
	RESET: "", BOLD: "", DIM: "", GREEN: "", RED: "", YELLOW: "", CYAN: "",
}));

import { renderAgentList, renderAgentDetail, renderAgentCreated, renderAgentDeleted, renderAgentState } from "../../../src/ui/displays/agents-display.js";
import type { AgentSummary } from "../../../src/domain/agents/agent-types.js";
import type { AgentState } from "../../../src/domain/agents/agent-state.js";

const mockLog = vi.fn();
beforeEach(() => mockLog.mockClear());

function makeAgent(overrides: Partial<AgentSummary> = {}): AgentSummary {
	return {
		name: "CodeBot", agentType: "ai", description: "An AI assistant",
		skills: [], tools: [], roles: [], file: "code-bot.md", ...overrides,
	};
}

describe("renderAgentList", () => {
	it("shows empty message when no agents", () => {
		renderAgentList([], mockLog);
		const output = mockLog.mock.calls.flat().join(" ");
		expect(output).toContain("No agents defined");
	});

	it("renders agent items with type tags", () => {
		renderAgentList([makeAgent(), makeAgent({ name: "Human Dev", agentType: "human" })], mockLog);
		const output = mockLog.mock.calls.flat().join(" ");
		expect(output).toContain("CodeBot");
		expect(output).toContain("[ai]");
		expect(output).toContain("Human Dev");
		expect(output).toContain("[human]");
	});

	it("shows description when present", () => {
		renderAgentList([makeAgent({ description: "Helps with code" })], mockLog);
		const output = mockLog.mock.calls.flat().join(" ");
		expect(output).toContain("Helps with code");
	});

	it("shows domain when present", () => {
		renderAgentList([makeAgent({ domain: "development" })], mockLog);
		const output = mockLog.mock.calls.flat().join(" ");
		expect(output).toContain("development");
	});
});

describe("renderAgentDetail", () => {
	it("renders all agent fields", () => {
		renderAgentDetail(makeAgent({
			skills: [{ name: "TypeScript", level: "expert" }],
			tools: ["git", "grep"],
			roles: ["Developer"],
		}), mockLog);
		const output = mockLog.mock.calls.flat().join(" ");
		expect(output).toContain("CodeBot");
		expect(output).toContain("[ai]");
		expect(output).toContain("An AI assistant");
		expect(output).toContain("TypeScript");
		expect(output).toContain("expert");
		expect(output).toContain("git");
		expect(output).toContain("grep");
		expect(output).toContain("Developer");
	});

	it("shows (none) for empty description", () => {
		renderAgentDetail(makeAgent({ description: "" }), mockLog);
		const output = mockLog.mock.calls.flat().join(" ");
		expect(output).toContain("(none)");
	});

	it("omits empty sections", () => {
		renderAgentDetail(makeAgent({ skills: [], tools: [], roles: [] }), mockLog);
		const output = mockLog.mock.calls.flat().join(" ");
		expect(output).not.toContain("Skills");
		expect(output).not.toContain("Tools");
		expect(output).not.toContain("Roles");
		expect(output).not.toContain("Inventory");
	});

	it("renders inventory when present", () => {
		renderAgentDetail(makeAgent({
			inventory: [
				{ path: "docs/spec.md", label: "Project Spec" },
				{ path: "docs/notes.md" },
			],
		}), mockLog);
		const output = mockLog.mock.calls.flat().join(" ");
		expect(output).toContain("Inventory");
		expect(output).toContain("2 items");
		expect(output).toContain("Project Spec");
		expect(output).toContain("docs/spec.md");
		expect(output).toContain("notes.md");
	});

	it("omits inventory when empty", () => {
		renderAgentDetail(makeAgent({ inventory: [] }), mockLog);
		const output = mockLog.mock.calls.flat().join(" ");
		expect(output).not.toContain("Inventory");
	});

	it("renders extended fields (goals, components, ai, relationships)", () => {
		renderAgentDetail(makeAgent({
			domain: "qa",
			goals: [{ name: "complete-review", priority: 2 }],
			components: [{ name: "tool-caller", type: "actuator" }],
			behaviors: ["patrol", "guard"],
			ai: { provider: "anthropic" },
			relationships: [{ target: "Lead", type: "reports-to", description: "Daily sync" }],
		}), mockLog);
		const output = mockLog.mock.calls.flat().join(" ");
		expect(output).toContain("qa");
		expect(output).toContain("complete-review");
		expect(output).toContain("tool-caller");
		expect(output).toContain("actuator");
		expect(output).toContain("patrol");
		expect(output).toContain("anthropic");
		expect(output).toContain("reports-to");
		expect(output).toContain("Lead");
	});
});

describe("renderAgentCreated", () => {
	it("shows path", () => {
		renderAgentCreated("docs/agents/code-bot.md", mockLog);
		const output = mockLog.mock.calls.flat().join(" ");
		expect(output).toContain("Created agent");
		expect(output).toContain("code-bot.md");
	});
});

describe("renderAgentDeleted", () => {
	it("shows name", () => {
		renderAgentDeleted("CodeBot", mockLog);
		const output = mockLog.mock.calls.flat().join(" ");
		expect(output).toContain("Deleted agent");
		expect(output).toContain("CodeBot");
	});
});

describe("renderAgentState", () => {
	function makeState(overrides: Partial<AgentState> = {}): AgentState {
		return { name: "Bob", status: "idle", tasks: [], briefs: [], ...overrides };
	}

	it("shows status", () => {
		renderAgentState(makeState({ status: "active" }), mockLog);
		const output = mockLog.mock.calls.flat().join(" ");
		expect(output).toContain("State");
		expect(output).toContain("active");
	});

	it("shows last interaction when present", () => {
		renderAgentState(makeState({
			lastInteraction: "2026-03-15T10:00:00Z",
			lastInteractionType: "talk",
		}), mockLog);
		const output = mockLog.mock.calls.flat().join(" ");
		expect(output).toContain("talk");
		expect(output).toContain("2026-03-15");
	});

	it("shows brief count", () => {
		renderAgentState(makeState({
			briefs: [
				{ path: "/b/1.md", generatedAt: "2026-03-15", autonomous: false },
				{ path: "/b/2.md", generatedAt: "2026-03-15", autonomous: true },
			],
		}), mockLog);
		const output = mockLog.mock.calls.flat().join(" ");
		expect(output).toContain("Briefs generated: 2");
	});

	it("omits sections when empty", () => {
		renderAgentState(makeState(), mockLog);
		const output = mockLog.mock.calls.flat().join(" ");
		expect(output).not.toContain("Briefs");
		expect(output).not.toContain("Last interaction");
	});
});
