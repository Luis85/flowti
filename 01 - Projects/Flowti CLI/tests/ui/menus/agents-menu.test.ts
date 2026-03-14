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
vi.mock("../../../src/domain/project/project-config.js", () => ({
	readProjectConfig: vi.fn(() => ({ config: null, warnings: [] })),
	updateProjectConfig: vi.fn(() => true),
}));
vi.mock("../../../src/domain/project/project.js", () => ({
	listProjects: vi.fn(() => []),
}));
vi.mock("../../../src/infrastructure/config.js", () => ({
	VAULT_ROOT: "/mock-vault", CLI_PROJECT: "/mock/cli", cliConfig: {},
}));

import { listAgents, createAgent, deleteAgent, updateAgentField, addArrayItem, removeArrayItem, updateAgentJson, readSystemPrompt, writeSystemPrompt } from "../../../src/domain/agents/agent-store.js";
import { renderAgentList, renderAgentCreated, renderAgentDeleted } from "../../../src/ui/displays/agents-display.js";
import { readProjectConfig, updateProjectConfig } from "../../../src/domain/project/project-config.js";
import { listProjects } from "../../../src/domain/project/project.js";
import {
	addAgentInteractive,
	removeAgentInteractive,
	editAgentIdentity, editAgentSkills, editAgentArrayField,
	editAIConfigInteractive, editSystemPromptInteractive,
	manageProjectAgentsInteractive,
	talkToAgentInteractive, assignTaskInteractive, assignToProjectInteractive,
} from "../../../src/ui/menus/agents-menu.js";
import type { AgentSummary } from "../../../src/domain/agents/agent-types.js";
import type { ProjectConfig } from "../../../src/infrastructure/types.js";

const mockListAgents = vi.mocked(listAgents);
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

// ── Manage Project Agents ───────────────────────────────────────────

const mockUpdateConfig = vi.mocked(updateProjectConfig);
const mockReadConfig = vi.mocked(readProjectConfig);
const mockListProjects = vi.mocked(listProjects);

describe("manageProjectAgentsInteractive", () => {
	it("shows empty roster and skips on Enter", async () => {
		const deps = makeDeps();
		deps.input.ask.mockResolvedValueOnce("");
		const config: ProjectConfig = { name: "test" };
		await manageProjectAgentsInteractive("/proj", config, "/vault", undefined, deps);
		expect(deps.log).toHaveBeenCalledWith(expect.stringContaining("No agents assigned"));
	});

	it("shows existing roster", async () => {
		const deps = makeDeps();
		deps.input.ask.mockResolvedValueOnce("");
		const config: ProjectConfig = { name: "test", management: { agents: { roster: ["Agent A"] } } };
		await manageProjectAgentsInteractive("/proj", config, "/vault", undefined, deps);
		expect(deps.log).toHaveBeenCalledWith(expect.stringContaining("Agent A"));
	});

	it("adds agent to roster by number", async () => {
		const deps = makeDeps();
		mockListAgents.mockReturnValue([makeAgent({ name: "CodeBot" }), makeAgent({ name: "Designer" })]);
		deps.input.ask
			.mockResolvedValueOnce("a")     // action: add
			.mockResolvedValueOnce("1");     // select first available
		mockUpdateConfig.mockReturnValue(true);
		const config: ProjectConfig = { name: "test" };
		await manageProjectAgentsInteractive("/proj", config, "/vault", undefined, deps);
		expect(mockUpdateConfig).toHaveBeenCalled();
		expect(config.management?.agents?.roster).toContain("CodeBot");
	});

	it("removes agent from roster", async () => {
		const deps = makeDeps();
		deps.input.ask
			.mockResolvedValueOnce("r")         // action: remove
			.mockResolvedValueOnce("Agent A");   // name to remove
		mockUpdateConfig.mockReturnValue(true);
		const config: ProjectConfig = { name: "test", management: { agents: { roster: ["Agent A", "Agent B"] } } };
		await manageProjectAgentsInteractive("/proj", config, "/vault", undefined, deps);
		expect(config.management?.agents?.roster).toEqual(["Agent B"]);
	});

	it("does not add duplicates", async () => {
		const deps = makeDeps();
		mockListAgents.mockReturnValue([makeAgent({ name: "CodeBot" })]);
		deps.input.ask
			.mockResolvedValueOnce("a")
			.mockResolvedValueOnce("1");
		const config: ProjectConfig = { name: "test", management: { agents: { roster: ["CodeBot"] } } };
		await manageProjectAgentsInteractive("/proj", config, "/vault", undefined, deps);
		// Should show "All vault agents already on roster"
		expect(deps.log).toHaveBeenCalledWith(expect.stringContaining("already on the roster"));
	});
});

// ── Talk to Agent ───────────────────────────────────────────────────

describe("talkToAgentInteractive", () => {
	it("writes new prompt when none exists", async () => {
		const deps = makeDeps();
		mockReadPrompt.mockReturnValue(null);
		deps.input.ask
			.mockResolvedValueOnce("w")                    // write new
			.mockResolvedValueOnce("You are a reviewer.")  // prompt line
			.mockResolvedValueOnce("");                    // empty = done
		await talkToAgentInteractive("/proj", makeAgent(), undefined, deps);
		expect(mockWritePrompt).toHaveBeenCalledWith(deps, "/proj", "CodeBot", "You are a reviewer.", undefined);
	});

	it("appends to existing prompt on edit", async () => {
		const deps = makeDeps();
		mockReadPrompt.mockReturnValue("Be helpful.");
		deps.input.ask
			.mockResolvedValueOnce("e")                    // edit (append)
			.mockResolvedValueOnce("Also be concise.")     // new line
			.mockResolvedValueOnce("");                    // done
		await talkToAgentInteractive("/proj", makeAgent(), undefined, deps);
		expect(mockWritePrompt).toHaveBeenCalledWith(
			deps, "/proj", "CodeBot",
			"Be helpful.\n\nAlso be concise.",
			undefined,
		);
	});

	it("replaces prompt on 'r'", async () => {
		const deps = makeDeps();
		mockReadPrompt.mockReturnValue("Old prompt.");
		deps.input.ask
			.mockResolvedValueOnce("r")                    // replace
			.mockResolvedValueOnce("Brand new prompt.")    // line
			.mockResolvedValueOnce("");                    // done
		await talkToAgentInteractive("/proj", makeAgent(), undefined, deps);
		expect(mockWritePrompt).toHaveBeenCalledWith(deps, "/proj", "CodeBot", "Brand new prompt.", undefined);
	});

	it("deletes prompt on 'd'", async () => {
		const deps = makeDeps();
		mockReadPrompt.mockReturnValue("Existing");
		deps.input.ask.mockResolvedValueOnce("d");
		await talkToAgentInteractive("/proj", makeAgent(), undefined, deps);
		expect(mockWritePrompt).toHaveBeenCalledWith(deps, "/proj", "CodeBot", "", undefined);
	});

	it("skips on empty input", async () => {
		const deps = makeDeps();
		mockReadPrompt.mockReturnValue("Existing");
		deps.input.ask.mockResolvedValueOnce("");
		await talkToAgentInteractive("/proj", makeAgent(), undefined, deps);
		expect(mockWritePrompt).not.toHaveBeenCalled();
	});

	it("shows current prompt preview when it exists", async () => {
		const deps = makeDeps();
		mockReadPrompt.mockReturnValue("Line 1\nLine 2");
		deps.input.ask.mockResolvedValueOnce("");
		await talkToAgentInteractive("/proj", makeAgent(), undefined, deps);
		expect(deps.log).toHaveBeenCalledWith(expect.stringContaining("13 chars"));
	});
});

// ── Assign Task ─────────────────────────────────────────────────────

describe("assignTaskInteractive", () => {
	it("saves task file with name and description", async () => {
		const deps = makeDeps();
		const agent = makeAgent({ skills: [{ name: "TypeScript", level: "expert" }], tools: ["eslint"] });
		deps.paths.dirname.mockReturnValue("/vault/agents");
		deps.input.ask
			.mockResolvedValueOnce("Fix bug")           // task name
			.mockResolvedValueOnce("Fix the login bug") // description
			.mockResolvedValueOnce("");                  // context (empty)
		await assignTaskInteractive("/proj", agent, undefined, deps);
		expect(deps.disk.writeFileSync).toHaveBeenCalledWith(
			"/vault/agents/CodeBot.task.md",
			expect.stringContaining("Fix bug"),
			"utf-8",
		);
		expect(deps.disk.writeFileSync).toHaveBeenCalledWith(
			expect.anything(),
			expect.stringContaining("Fix the login bug"),
			"utf-8",
		);
	});

	it("includes context when provided", async () => {
		const deps = makeDeps();
		deps.paths.dirname.mockReturnValue("/vault/agents");
		deps.input.ask
			.mockResolvedValueOnce("Review PR")
			.mockResolvedValueOnce("Review pull request #42")
			.mockResolvedValueOnce("High priority");
		await assignTaskInteractive("/proj", makeAgent(), undefined, deps);
		expect(deps.disk.writeFileSync).toHaveBeenCalledWith(
			expect.anything(),
			expect.stringContaining("High priority"),
			"utf-8",
		);
	});

	it("cancels when task name is empty", async () => {
		const deps = makeDeps();
		deps.input.ask.mockResolvedValueOnce("");
		await assignTaskInteractive("/proj", makeAgent(), undefined, deps);
		expect(deps.disk.writeFileSync).not.toHaveBeenCalled();
	});

	it("cancels when description is empty", async () => {
		const deps = makeDeps();
		deps.input.ask
			.mockResolvedValueOnce("Task name")
			.mockResolvedValueOnce("");
		await assignTaskInteractive("/proj", makeAgent(), undefined, deps);
		expect(deps.disk.writeFileSync).not.toHaveBeenCalled();
	});

	it("lists agent capabilities", async () => {
		const deps = makeDeps();
		const agent = makeAgent({ skills: [{ name: "TS", level: "expert" }], tools: ["eslint"], roles: ["reviewer"] });
		deps.paths.dirname.mockReturnValue("/vault/agents");
		deps.input.ask
			.mockResolvedValueOnce("Task")
			.mockResolvedValueOnce("Do thing")
			.mockResolvedValueOnce("");
		await assignTaskInteractive("/proj", agent, undefined, deps);
		expect(deps.log).toHaveBeenCalledWith(expect.stringContaining("skill: TS"));
		expect(deps.log).toHaveBeenCalledWith(expect.stringContaining("tool: eslint"));
		expect(deps.log).toHaveBeenCalledWith(expect.stringContaining("role: reviewer"));
	});

	it("includes iteration wikilink when task context provided", async () => {
		const deps = makeDeps();
		deps.paths.dirname.mockReturnValue("/vault/agents");
		deps.input.ask
			.mockResolvedValueOnce("Fix bug")
			.mockResolvedValueOnce("Fix it")
			.mockResolvedValueOnce("");
		await assignTaskInteractive("/proj", makeAgent(), undefined, deps, {
			projectName: "Flowti CLI",
			iterationFile: "iteration-004-plan.md",
			iterationNumber: 4,
		});
		expect(deps.disk.writeFileSync).toHaveBeenCalledWith(
			expect.anything(),
			expect.stringContaining("[[iteration-004-plan|Iteration #4 Plan]]"),
			"utf-8",
		);
		expect(deps.disk.writeFileSync).toHaveBeenCalledWith(
			expect.anything(),
			expect.stringContaining("**Project:** Flowti CLI"),
			"utf-8",
		);
	});

	it("includes project name only when no iteration", async () => {
		const deps = makeDeps();
		deps.paths.dirname.mockReturnValue("/vault/agents");
		deps.input.ask
			.mockResolvedValueOnce("Task")
			.mockResolvedValueOnce("Do thing")
			.mockResolvedValueOnce("");
		await assignTaskInteractive("/proj", makeAgent(), undefined, deps, { projectName: "My Project" });
		expect(deps.disk.writeFileSync).toHaveBeenCalledWith(
			expect.anything(),
			expect.stringContaining("**Project:** My Project"),
			"utf-8",
		);
	});
});

// ── Assign to Project ───────────────────────────────────────────────

describe("assignToProjectInteractive", () => {
	it("lists projects and assigns agent", async () => {
		const deps = makeDeps();
		mockListProjects.mockReturnValue(["Project A", "Project B"]);
		mockReadConfig.mockReturnValue({ config: { name: "Project A" } as ProjectConfig, warnings: [] });
		mockUpdateConfig.mockReturnValue(true);
		deps.input.ask.mockResolvedValueOnce("1");
		await assignToProjectInteractive("/vault", makeAgent(), deps);
		expect(mockUpdateConfig).toHaveBeenCalled();
		expect(deps.log).toHaveBeenCalledWith(expect.stringContaining("Assigned CodeBot to Project A"));
	});

	it("shows no projects message when empty", async () => {
		const deps = makeDeps();
		mockListProjects.mockReturnValue([]);
		await assignToProjectInteractive("/vault", makeAgent(), deps);
		expect(deps.log).toHaveBeenCalledWith(expect.stringContaining("No projects found"));
	});

	it("cancels when no choice given", async () => {
		const deps = makeDeps();
		mockListProjects.mockReturnValue(["Project A"]);
		mockReadConfig.mockReturnValue({ config: { name: "Project A" } as ProjectConfig, warnings: [] });
		deps.input.ask.mockResolvedValueOnce("");
		await assignToProjectInteractive("/vault", makeAgent(), deps);
		expect(mockUpdateConfig).not.toHaveBeenCalled();
	});

	it("rejects when project not found", async () => {
		const deps = makeDeps();
		mockListProjects.mockReturnValue(["Project A"]);
		mockReadConfig.mockReturnValue({ config: { name: "Project A" } as ProjectConfig, warnings: [] });
		deps.input.ask.mockResolvedValueOnce("NonExistent");
		await assignToProjectInteractive("/vault", makeAgent(), deps);
		expect(deps.log).toHaveBeenCalledWith(expect.stringContaining("not found"));
	});

	it("skips when agent already assigned", async () => {
		const deps = makeDeps();
		mockListProjects.mockReturnValue(["Project A"]);
		mockReadConfig.mockReturnValue({ config: { name: "Project A", management: { agents: { roster: ["CodeBot"] } } } as ProjectConfig, warnings: [] });
		deps.input.ask.mockResolvedValueOnce("1");
		await assignToProjectInteractive("/vault", makeAgent(), deps);
		expect(mockUpdateConfig).not.toHaveBeenCalled();
		expect(deps.log).toHaveBeenCalledWith(expect.stringContaining("already assigned"));
	});

	it("shows assigned tag for projects with agent on roster", async () => {
		const deps = makeDeps();
		mockListProjects.mockReturnValue(["Project A"]);
		mockReadConfig.mockReturnValue({ config: { name: "Project A", management: { agents: { roster: ["CodeBot"] } } } as ProjectConfig, warnings: [] });
		deps.input.ask.mockResolvedValueOnce("");
		await assignToProjectInteractive("/vault", makeAgent(), deps);
		expect(deps.log).toHaveBeenCalledWith(expect.stringContaining("(assigned)"));
	});

	it("skips when project has no config", async () => {
		const deps = makeDeps();
		mockListProjects.mockReturnValue(["Project A"]);
		mockReadConfig.mockReturnValue({ config: null, warnings: [] });
		deps.input.ask.mockResolvedValueOnce("1");
		await assignToProjectInteractive("/vault", makeAgent(), deps);
		expect(mockUpdateConfig).not.toHaveBeenCalled();
		expect(deps.log).toHaveBeenCalledWith(expect.stringContaining("No flowti.config.json"));
	});
});
