import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/infrastructure/ui.js", () => ({
	RESET: "", BOLD: "", DIM: "", GREEN: "", RED: "", YELLOW: "", CYAN: "",
}));

import { renderAgentList, renderAgentDetail, renderAgentCreated, renderAgentDeleted } from "../../../src/ui/displays/agents-display.js";
import type { AgentSummary } from "../../../src/domain/agents/agent-types.js";

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
	});

	it("renders extended fields (goals, components, ai, relationships)", () => {
		renderAgentDetail(makeAgent({
			domain: "qa",
			goals: [{ name: "complete-review", priority: 2 }],
			components: [{ name: "tool-caller", type: "actuator" }],
			behaviors: ["patrol", "guard"],
			ai: { model: "claude-sonnet-4-20250514", provider: "anthropic", contextWindow: 200000 },
			relationships: [{ target: "Lead", type: "reports-to", description: "Daily sync" }],
		}), mockLog);
		const output = mockLog.mock.calls.flat().join(" ");
		expect(output).toContain("qa");
		expect(output).toContain("complete-review");
		expect(output).toContain("tool-caller");
		expect(output).toContain("actuator");
		expect(output).toContain("patrol");
		expect(output).toContain("anthropic");
		expect(output).toContain("200000");
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
