import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/infrastructure/ui.js", () => ({
	RESET: "", BOLD: "", DIM: "", GREEN: "", RED: "", YELLOW: "", CYAN: "",
	printHeader: vi.fn(), printSection: vi.fn(), printDivider: vi.fn(),
}));
vi.mock("../../../src/domain/agents/agent-store.js", () => ({
	listAgents: vi.fn(() => []),
	createAgent: vi.fn(),
	deleteAgent: vi.fn(),
	findAgent: vi.fn(),
}));
vi.mock("../../../src/ui/displays/agents-display.js", () => ({
	renderAgentList: vi.fn(),
	renderAgentDetail: vi.fn(),
	renderAgentCreated: vi.fn(),
	renderAgentDeleted: vi.fn(),
}));

import { listAgents, createAgent, deleteAgent } from "../../../src/domain/agents/agent-store.js";
import { renderAgentList, renderAgentCreated, renderAgentDeleted } from "../../../src/ui/displays/agents-display.js";
import {
	addAgentInteractive, viewAgentInteractive, listAgentsInteractive,
	removeAgentInteractive, selectAgentInteractive,
} from "../../../src/ui/menus/agents-menu.js";
import type { AgentSummary } from "../../../src/domain/agents/agent-types.js";

const mockListAgents = vi.mocked(listAgents);
const mockCreateAgent = vi.mocked(createAgent);
const mockDeleteAgent = vi.mocked(deleteAgent);

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
