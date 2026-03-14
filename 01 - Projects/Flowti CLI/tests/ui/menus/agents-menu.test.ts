import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/infrastructure/ui.js", () => ({
	RESET: "", BOLD: "", DIM: "", GREEN: "", RED: "", YELLOW: "", CYAN: "",
	printHeader: vi.fn(), printSection: vi.fn(), printDivider: vi.fn(),
}));
vi.mock("../../../src/domain/agents/agent-store.js", () => ({
	listAgents: vi.fn(() => []),
	findAgent: vi.fn(),
	createAgent: vi.fn(),
	deleteAgent: vi.fn(),
	updateAgentField: vi.fn(() => true),
	addArrayItem: vi.fn(() => true),
	removeArrayItem: vi.fn(() => true),
	updateAgentJson: vi.fn(() => true),
	readSystemPrompt: vi.fn(() => null),
	writeSystemPrompt: vi.fn(() => true),
}));
vi.mock("../../../src/ui/displays/agents-display.js", () => ({
	renderAgentList: vi.fn(),
	renderAgentDetail: vi.fn(),
	renderAgentCreated: vi.fn(),
	renderAgentDeleted: vi.fn(),
}));

import { listAgents, findAgent, createAgent, deleteAgent, updateAgentField, addArrayItem, removeArrayItem, updateAgentJson, readSystemPrompt, writeSystemPrompt } from "../../../src/domain/agents/agent-store.js";
import { renderAgentList, renderAgentCreated, renderAgentDeleted } from "../../../src/ui/displays/agents-display.js";
import {
	addAgentInteractive, viewAgentInteractive, listAgentsInteractive,
	removeAgentInteractive, selectAgentInteractive,
	editAgentIdentity, editAgentSkills, editAgentArrayField,
	editAIConfigInteractive, editSystemPromptInteractive, agentDetailMenu,
} from "../../../src/ui/menus/agents-menu.js";
import type { AgentSummary } from "../../../src/domain/agents/agent-types.js";

const mockListAgents = vi.mocked(listAgents);
const mockFindAgent = vi.mocked(findAgent);
const mockCreateAgent = vi.mocked(createAgent);
const mockDeleteAgent = vi.mocked(deleteAgent);
const mockUpdateField = vi.mocked(updateAgentField);
const mockAddArrayItem = vi.mocked(addArrayItem);
const mockRemoveArrayItem = vi.mocked(removeArrayItem);
const mockUpdateJson = vi.mocked(updateAgentJson);
const mockReadPrompt = vi.mocked(readSystemPrompt);
const mockWritePrompt = vi.mocked(writeSystemPrompt);

function makeDeps() {
	return {
		disk: { readFileSync: vi.fn(), writeFileSync: vi.fn(), existsSync: vi.fn(), readdirSync: vi.fn(), mkdirSync: vi.fn(), unlinkSync: vi.fn() },
		paths: {
			join: vi.fn((...args: string[]) => args.join("/")),
			resolve: vi.fn((p: string) => p),
			relative: vi.fn((_from: string, to: string) => to),
			dirname: vi.fn(),
			basename: vi.fn((p: string) => p.split("/").pop()!),
		},
		input: { ask: vi.fn(), askYesNo: vi.fn(), waitForEnter: vi.fn() },
		log: vi.fn(),
	} as any;
}

function makeAgent(overrides: Partial<AgentSummary> = {}): AgentSummary {
	return {
		name: "CodeBot", agentType: "ai", description: "AI assistant",
		skills: [], tools: [], roles: [], file: "code-bot.md", ...overrides,
	};
}

beforeEach(() => vi.clearAllMocks());

describe("addAgentInteractive", () => {
	it("returns false when name is empty", async () => {
		const deps = makeDeps();
		deps.input.ask.mockResolvedValueOnce("");
		expect(await addAgentInteractive("/proj", undefined, deps)).toBe(false);
		expect(mockCreateAgent).not.toHaveBeenCalled();
	});

	it("creates a minimal agent", async () => {
		const deps = makeDeps();
		deps.input.ask
			.mockResolvedValueOnce("NewBot")    // name
			.mockResolvedValueOnce("ai")        // type
			.mockResolvedValueOnce("A bot");    // description
		deps.input.askYesNo
			.mockResolvedValueOnce(false)       // no skills
			.mockResolvedValueOnce(false)       // no tools
			.mockResolvedValueOnce(false);      // no roles
		mockCreateAgent.mockReturnValue("/proj/docs/agents/new-bot.md");
		expect(await addAgentInteractive("/proj", undefined, deps)).toBe(true);
		expect(mockCreateAgent).toHaveBeenCalledWith(
			deps, "/proj",
			expect.objectContaining({ name: "NewBot", agentType: "ai", description: "A bot" }),
			undefined,
		);
	});

	it("returns false when agent already exists", async () => {
		const deps = makeDeps();
		deps.input.ask
			.mockResolvedValueOnce("Existing")
			.mockResolvedValueOnce("human")
			.mockResolvedValueOnce("");
		deps.input.askYesNo
			.mockResolvedValueOnce(false)
			.mockResolvedValueOnce(false)
			.mockResolvedValueOnce(false);
		mockCreateAgent.mockReturnValue(null);
		expect(await addAgentInteractive("/proj", undefined, deps)).toBe(false);
	});

	it("collects skills when user opts in", async () => {
		const deps = makeDeps();
		deps.input.ask
			.mockResolvedValueOnce("SkillBot")
			.mockResolvedValueOnce("ai")
			.mockResolvedValueOnce("")
			.mockResolvedValueOnce("TypeScript")  // skill name
			.mockResolvedValueOnce("expert");      // skill level
		deps.input.askYesNo
			.mockResolvedValueOnce(true)           // add skills? yes
			.mockResolvedValueOnce(false)          // another skill? no
			.mockResolvedValueOnce(false)          // tools? no
			.mockResolvedValueOnce(false);         // roles? no
		mockCreateAgent.mockReturnValue("/proj/docs/agents/skill-bot.md");
		await addAgentInteractive("/proj", undefined, deps);
		expect(mockCreateAgent).toHaveBeenCalledWith(
			deps, "/proj",
			expect.objectContaining({ skills: [{ name: "TypeScript", level: "expert" }] }),
			undefined,
		);
	});
});

describe("listAgentsInteractive", () => {
	it("renders agent list", async () => {
		const deps = makeDeps();
		mockListAgents.mockReturnValue([makeAgent()]);
		await listAgentsInteractive("/proj", undefined, deps);
		expect(vi.mocked(renderAgentList)).toHaveBeenCalledWith([makeAgent()], deps.log);
	});
});

describe("viewAgentInteractive", () => {
	it("shows message when no agents", async () => {
		const deps = makeDeps();
		mockListAgents.mockReturnValue([]);
		await viewAgentInteractive("/proj", undefined, deps);
		expect(deps.log).toHaveBeenCalledWith(expect.stringContaining("No agents"));
	});

	it("shows not found for unknown name", async () => {
		const deps = makeDeps();
		mockListAgents.mockReturnValue([makeAgent()]);
		deps.input.ask.mockResolvedValueOnce("Unknown");
		await viewAgentInteractive("/proj", undefined, deps);
		expect(deps.log).toHaveBeenCalledWith(expect.stringContaining("not found"));
	});
});

describe("removeAgentInteractive", () => {
	it("returns false when no agents", async () => {
		const deps = makeDeps();
		mockListAgents.mockReturnValue([]);
		expect(await removeAgentInteractive("/proj", undefined, deps)).toBe(false);
	});

	it("removes agent on confirm", async () => {
		const deps = makeDeps();
		mockListAgents.mockReturnValue([makeAgent()]);
		deps.input.ask.mockResolvedValueOnce("CodeBot");
		deps.input.askYesNo.mockResolvedValueOnce(true);
		mockDeleteAgent.mockReturnValue(true);
		expect(await removeAgentInteractive("/proj", undefined, deps)).toBe(true);
		expect(mockDeleteAgent).toHaveBeenCalledWith(deps, "/proj", "CodeBot", undefined);
	});

	it("does not remove on cancel", async () => {
		const deps = makeDeps();
		mockListAgents.mockReturnValue([makeAgent()]);
		deps.input.ask.mockResolvedValueOnce("CodeBot");
		deps.input.askYesNo.mockResolvedValueOnce(false);
		expect(await removeAgentInteractive("/proj", undefined, deps)).toBe(false);
		expect(mockDeleteAgent).not.toHaveBeenCalled();
	});
});

describe("selectAgentInteractive", () => {
	it("returns null when no agents", async () => {
		const deps = makeDeps();
		mockListAgents.mockReturnValue([]);
		expect(await selectAgentInteractive("/proj", undefined, deps)).toBeNull();
	});

	it("returns agent name on match", async () => {
		const deps = makeDeps();
		mockListAgents.mockReturnValue([makeAgent()]);
		deps.input.ask.mockResolvedValueOnce("codebot");
		expect(await selectAgentInteractive("/proj", undefined, deps)).toBe("CodeBot");
	});

	it("returns null on no match", async () => {
		const deps = makeDeps();
		mockListAgents.mockReturnValue([makeAgent()]);
		deps.input.ask.mockResolvedValueOnce("Unknown");
		expect(await selectAgentInteractive("/proj", undefined, deps)).toBeNull();
	});
});

// ── Agent detail view ────────────────────────────────────────────────

describe("agentDetailMenu", () => {
	it("returns main when agent not found", async () => {
		const deps = makeDeps();
		mockFindAgent.mockReturnValue(null);
		expect(await agentDetailMenu("/proj", "Ghost", undefined, deps)).toBe("main");
	});

	it("renders detail when agent found", async () => {
		const deps = makeDeps();
		mockFindAgent.mockReturnValue(makeAgent());
		const result = await agentDetailMenu("/proj", "CodeBot", undefined, deps);
		expect(result).toBeUndefined();
	});
});

// ── Edit identity ────────────────────────────────────────────────────

describe("editAgentIdentity", () => {
	it("updates description and domain", async () => {
		const deps = makeDeps();
		const agent = makeAgent({ description: "Old", domain: "dev" });
		deps.input.ask
			.mockResolvedValueOnce("New desc")
			.mockResolvedValueOnce("qa");
		await editAgentIdentity("/proj", agent, undefined, deps);
		expect(mockUpdateField).toHaveBeenCalledWith(deps, "/proj", "CodeBot", "description", "New desc", undefined);
		expect(mockUpdateField).toHaveBeenCalledWith(deps, "/proj", "CodeBot", "domain", "qa", undefined);
	});

	it("skips update when values unchanged", async () => {
		const deps = makeDeps();
		const agent = makeAgent({ description: "Same", domain: "dev" });
		deps.input.ask
			.mockResolvedValueOnce("Same")
			.mockResolvedValueOnce("dev");
		await editAgentIdentity("/proj", agent, undefined, deps);
		expect(mockUpdateField).not.toHaveBeenCalled();
	});
});

// ── Edit skills ──────────────────────────────────────────────────────

describe("editAgentSkills", () => {
	it("adds a skill", async () => {
		const deps = makeDeps();
		const agent = makeAgent();
		deps.input.ask
			.mockResolvedValueOnce("a")         // action: add
			.mockResolvedValueOnce("Python")    // skill name
			.mockResolvedValueOnce("beginner"); // level
		await editAgentSkills("/proj", agent, undefined, deps);
		expect(mockAddArrayItem).toHaveBeenCalledWith(deps, "/proj", "CodeBot", "skills", "Python|beginner", undefined);
	});

	it("removes a skill", async () => {
		const deps = makeDeps();
		const agent = makeAgent({ skills: [{ name: "TypeScript", level: "expert" }] });
		deps.input.ask
			.mockResolvedValueOnce("r")
			.mockResolvedValueOnce("typescript");
		await editAgentSkills("/proj", agent, undefined, deps);
		expect(mockRemoveArrayItem).toHaveBeenCalledWith(deps, "/proj", "CodeBot", "skills", "TypeScript|expert", undefined);
	});

	it("does nothing on skip", async () => {
		const deps = makeDeps();
		deps.input.ask.mockResolvedValueOnce("");
		await editAgentSkills("/proj", makeAgent(), undefined, deps);
		expect(mockAddArrayItem).not.toHaveBeenCalled();
		expect(mockRemoveArrayItem).not.toHaveBeenCalled();
	});
});

// ── Edit array fields ────────────────────────────────────────────────

describe("editAgentArrayField", () => {
	it("adds a tool", async () => {
		const deps = makeDeps();
		deps.input.ask
			.mockResolvedValueOnce("a")
			.mockResolvedValueOnce("eslint");
		await editAgentArrayField("/proj", makeAgent(), "tools", undefined, deps);
		expect(mockAddArrayItem).toHaveBeenCalledWith(deps, "/proj", "CodeBot", "tools", "eslint", undefined);
	});

	it("removes a role", async () => {
		const deps = makeDeps();
		const agent = makeAgent({ roles: ["Developer", "Reviewer"] });
		deps.input.ask
			.mockResolvedValueOnce("r")
			.mockResolvedValueOnce("reviewer");
		await editAgentArrayField("/proj", agent, "roles", undefined, deps);
		expect(mockRemoveArrayItem).toHaveBeenCalledWith(deps, "/proj", "CodeBot", "roles", "Reviewer", undefined);
	});

	it("handles behaviors field", async () => {
		const deps = makeDeps();
		const agent = makeAgent({ behaviors: ["patrol"] });
		deps.input.ask
			.mockResolvedValueOnce("a")
			.mockResolvedValueOnce("guard");
		await editAgentArrayField("/proj", agent, "behaviors", undefined, deps);
		expect(mockAddArrayItem).toHaveBeenCalledWith(deps, "/proj", "CodeBot", "behaviors", "guard", undefined);
	});
});

// ── AI Config ────────────────────────────────────────────────────────

describe("editAIConfigInteractive", () => {
	it("writes AI config to companion JSON", async () => {
		const deps = makeDeps();
		const agent = makeAgent();
		deps.input.ask
			.mockResolvedValueOnce("claude-sonnet-4-20250514")
			.mockResolvedValueOnce("anthropic")
			.mockResolvedValueOnce("200000")
			.mockResolvedValueOnce("4096");
		await editAIConfigInteractive("/proj", agent, undefined, deps);
		expect(mockUpdateJson).toHaveBeenCalledWith(
			deps, "/proj", "CodeBot",
			{ ai: { model: "claude-sonnet-4-20250514", provider: "anthropic", contextWindow: 200000, maxTokens: 4096, systemPrompt: undefined } },
			undefined,
		);
	});

	it("preserves existing systemPrompt", async () => {
		const deps = makeDeps();
		const agent = makeAgent({ ai: { systemPrompt: "Be helpful" } });
		deps.input.ask
			.mockResolvedValueOnce("gpt-4o")
			.mockResolvedValueOnce("openai")
			.mockResolvedValueOnce("")
			.mockResolvedValueOnce("");
		await editAIConfigInteractive("/proj", agent, undefined, deps);
		expect(mockUpdateJson).toHaveBeenCalledWith(
			deps, "/proj", "CodeBot",
			expect.objectContaining({ ai: expect.objectContaining({ systemPrompt: "Be helpful" }) }),
			undefined,
		);
	});
});

// ── System Prompt ────────────────────────────────────────────────────

describe("editSystemPromptInteractive", () => {
	it("writes new system prompt", async () => {
		const deps = makeDeps();
		mockReadPrompt.mockReturnValue(null);
		deps.input.ask.mockResolvedValueOnce("You are a code reviewer.");
		await editSystemPromptInteractive("/proj", makeAgent(), undefined, deps);
		expect(mockWritePrompt).toHaveBeenCalledWith(deps, "/proj", "CodeBot", "You are a code reviewer.", undefined);
	});

	it("skips when user enters nothing", async () => {
		const deps = makeDeps();
		mockReadPrompt.mockReturnValue("Existing prompt");
		deps.input.ask.mockResolvedValueOnce("");
		await editSystemPromptInteractive("/proj", makeAgent(), undefined, deps);
		expect(mockWritePrompt).not.toHaveBeenCalled();
	});

	it("shows current prompt when it exists", async () => {
		const deps = makeDeps();
		mockReadPrompt.mockReturnValue("You are helpful.");
		deps.input.ask.mockResolvedValueOnce("");
		await editSystemPromptInteractive("/proj", makeAgent(), undefined, deps);
		expect(deps.log).toHaveBeenCalledWith(expect.stringContaining("16 chars"));
	});
});
