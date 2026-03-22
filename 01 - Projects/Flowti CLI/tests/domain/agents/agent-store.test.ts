import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/infrastructure/ui.js", () => ({
	RESET: "", BOLD: "", DIM: "", GREEN: "", RED: "", YELLOW: "", CYAN: "",
}));
vi.mock("../../../src/infrastructure/logger.js", () => ({
	log: vi.fn(),
}));

import { agentStore, getProjectAgents, findAgent, createAgent, updateAgentField, deleteAgent, agentToJson, addArrayItem, removeArrayItem, updateAgentJson, readSystemPrompt, writeSystemPrompt, listInventory, addInventoryItem, removeInventoryItem, parseSuggestedTask } from "../../../src/domain/agents/agent-store.js";
import type { AgentDefinition } from "../../../src/domain/agents/agent-types.js";

function makeDeps(files: Record<string, string> = {}) {
	const store: Record<string, string> = { ...files };
	// Collect directories implied by the file paths
	const dirs = new Set<string>();
	for (const key of Object.keys(files)) {
		const parts = key.split("/");
		for (let i = 1; i < parts.length; i++) dirs.add(parts.slice(0, i).join("/"));
	}
	return {
		disk: {
			existsSync: vi.fn((p: string) => p in store || dirs.has(p)),
			readFileSync: vi.fn((p: string) => store[p] ?? ""),
			writeFileSync: vi.fn((p: string, c: string) => { store[p] = c; }),
			mkdirSync: vi.fn(),
			readdirSync: vi.fn((dir: string) => Object.keys(store).filter((k) => k.startsWith(dir + "/") && !k.slice(dir.length + 1).includes("/")).map((k) => k.split("/").pop()!)),
			unlinkSync: vi.fn((p: string) => { delete store[p]; }),
		},
		paths: {
			join: (...segs: string[]) => segs.join("/"),
			resolve: (...segs: string[]) => segs.join("/"),
			dirname: (p: string) => p.split("/").slice(0, -1).join("/"),
			basename: (p: string) => p.split("/").pop()!,
			relative: (_from: string, to: string) => to,
			extname: (p: string) => "." + p.split(".").pop()!,
			isAbsolute: () => true,
			sep: "/",
		},
	} as unknown as Parameters<typeof agentStore.list>[0];
}

const AGENT_MD = `---
type: Agent
name: CodeBot
agentType: ai
description: An AI coding assistant
skills:
  - TypeScript|expert
  - Python|intermediate
tools:
  - grep
  - git
roles:
  - Developer
---

# CodeBot
`;


describe("agentStore.list", () => {
	it("returns empty array when dir missing", () => {
		const deps = makeDeps();
		expect(agentStore.list(deps, "/proj")).toEqual([]);
	});

	it("parses agent files with skills, tools, and roles", () => {
		const deps = makeDeps({ "/proj/docs/agents/code-bot.md": AGENT_MD });
		const agents = agentStore.list(deps, "/proj");
		expect(agents).toHaveLength(1);
		expect(agents[0].name).toBe("CodeBot");
		expect(agents[0].agentType).toBe("ai");
		expect(agents[0].description).toBe("An AI coding assistant");
		expect(agents[0].skills).toEqual([
			{ name: "TypeScript", level: "expert" },
			{ name: "Python", level: "intermediate" },
		]);
		expect(agents[0].tools).toEqual(["grep", "git"]);
		expect(agents[0].roles).toEqual(["Developer"]);
		expect(agents[0].file).toBe("code-bot.md");
	});
});

describe("findAgent", () => {
	it("returns agent by name", () => {
		const deps = makeDeps({ "/proj/docs/agents/code-bot.md": AGENT_MD });
		const agent = findAgent(deps, "/proj", "CodeBot");
		expect(agent).not.toBeNull();
		expect(agent!.name).toBe("CodeBot");
	});

	it("returns null when not found", () => {
		const deps = makeDeps({ "/proj/docs/agents/code-bot.md": AGENT_MD });
		expect(findAgent(deps, "/proj", "Unknown")).toBeNull();
	});
});

const AGENT2_MD = `---
type: Agent
name: Designer
agentType: human
description: A UX designer
skills:
  - UX|expert
tools:
  - figma
roles:
  - Designer
---
`;

describe("getProjectAgents", () => {
	it("returns all agents when no roster", () => {
		const deps = makeDeps({
			"/vault/docs/agents/code-bot.md": AGENT_MD,
			"/vault/docs/agents/designer.md": AGENT2_MD,
		});
		const result = getProjectAgents(deps, "/vault", undefined, undefined);
		expect(result).toHaveLength(2);
	});

	it("returns all agents when roster is empty", () => {
		const deps = makeDeps({
			"/vault/docs/agents/code-bot.md": AGENT_MD,
			"/vault/docs/agents/designer.md": AGENT2_MD,
		});
		const result = getProjectAgents(deps, "/vault", undefined, []);
		expect(result).toHaveLength(2);
	});

	it("filters agents to roster (case-insensitive)", () => {
		const deps = makeDeps({
			"/vault/docs/agents/code-bot.md": AGENT_MD,
			"/vault/docs/agents/designer.md": AGENT2_MD,
		});
		const result = getProjectAgents(deps, "/vault", undefined, ["codebot"]);
		expect(result).toHaveLength(1);
		expect(result[0].name).toBe("CodeBot");
	});

	it("returns empty when roster matches no agents", () => {
		const deps = makeDeps({
			"/vault/docs/agents/code-bot.md": AGENT_MD,
		});
		const result = getProjectAgents(deps, "/vault", undefined, ["NonExistent"]);
		expect(result).toHaveLength(0);
	});
});

describe("createAgent", () => {
	it("creates a new agent file and returns path", () => {
		const deps = makeDeps();
		const def: AgentDefinition = {
			name: "TestBot",
			agentType: "ai",
			description: "A test agent",
			skills: [{ name: "Testing", level: "expert" }],
			tools: ["vitest"],
			roles: ["QA"],
		};
		const result = createAgent(deps, "/proj", def);
		expect(result).toBe("/proj/docs/agents/test-bot.md");
		expect(deps.disk.writeFileSync).toHaveBeenCalled();
		const written = (deps.disk.writeFileSync as ReturnType<typeof vi.fn>).mock.calls[0][1] as string;
		expect(written).toContain("name: TestBot");
		expect(written).toContain("agentType: ai");
		expect(written).toContain("Testing|expert");
		expect(written).toContain("vitest");
		expect(written).toContain("QA");
	});

	it("returns null when file already exists", () => {
		const deps = makeDeps({ "/proj/docs/agents/test-bot.md": "existing" });
		const def: AgentDefinition = {
			name: "TestBot", agentType: "human", description: "",
			skills: [], tools: [], roles: [],
		};
		expect(createAgent(deps, "/proj", def)).toBeNull();
	});

	it("creates minimal agent with no skills/tools/roles", () => {
		const deps = makeDeps();
		const def: AgentDefinition = {
			name: "MinimalBot", agentType: "human", description: "",
			skills: [], tools: [], roles: [],
		};
		const result = createAgent(deps, "/proj", def);
		expect(result).toBe("/proj/docs/agents/minimal-bot.md");
		const written = (deps.disk.writeFileSync as ReturnType<typeof vi.fn>).mock.calls[0][1] as string;
		expect(written).toContain("agentType: human");
		expect(written).toContain("<!-- List skills");
	});
});

describe("updateAgentField", () => {
	it("updates a frontmatter field", () => {
		const deps = makeDeps({ "/proj/docs/agents/code-bot.md": AGENT_MD });
		const result = updateAgentField(deps, "/proj", "CodeBot", "description", "Updated desc");
		expect(result).toBe(true);
	});

	it("returns false for missing agent", () => {
		const deps = makeDeps();
		expect(updateAgentField(deps, "/proj", "None", "description", "x")).toBe(false);
	});
});

describe("deleteAgent", () => {
	it("deletes an existing agent", () => {
		const deps = makeDeps({ "/proj/docs/agents/code-bot.md": AGENT_MD });
		expect(deleteAgent(deps, "/proj", "CodeBot")).toBe(true);
		expect(deps.disk.unlinkSync).toHaveBeenCalled();
	});

	it("returns false for missing agent", () => {
		const deps = makeDeps();
		expect(deleteAgent(deps, "/proj", "CodeBot")).toBe(false);
	});
});

describe("agentToJson", () => {
	it("serializes agent summary to plain object", () => {
		const json = agentToJson({
			name: "Bot", agentType: "ai", description: "Desc",
			skills: [{ name: "TS", level: "5" }], tools: ["git"], roles: ["Dev"],
			file: "bot.md",
		});
		expect(json).toEqual({
			name: "Bot", agentType: "ai", description: "Desc",
			skills: [{ name: "TS", level: "5" }], tools: ["git"], roles: ["Dev"],
		});
		expect(json).not.toHaveProperty("file");
	});

	it("includes extended fields when present", () => {
		const json = agentToJson({
			name: "Bot", agentType: "ai", description: "Desc",
			skills: [], tools: [], roles: [], file: "bot.md",
			domain: "development",
			behaviors: ["patrol", "guard"],
			components: [{ name: "movement", type: "behavior" }],
			goals: [{ name: "complete-review", priority: 2 }],
			ai: { provider: "anthropic" },
			relationships: [{ target: "Human Lead", type: "reports-to" }],
		});
		expect(json.domain).toBe("development");
		expect(json.behaviors).toEqual(["patrol", "guard"]);
		expect(json.components).toEqual([{ name: "movement", type: "behavior" }]);
		expect(json.goals).toEqual([{ name: "complete-review", priority: 2 }]);
		expect(json.ai).toEqual({ model: "claude-sonnet-4-20250514", provider: "anthropic" });
		expect(json.relationships).toEqual([{ target: "Human Lead", type: "reports-to" }]);
	});
});

describe("companion JSON definition", () => {
	it("reads components, goals, ai, relationships from JSON file", () => {
		const jsonDef = JSON.stringify({
			components: [{ name: "tool-caller", type: "actuator" }],
			goals: [{ name: "assist-user", priority: 1 }],
			ai: { provider: "openai" },
			relationships: [{ target: "Supervisor", type: "reports-to" }],
		});
		const deps = makeDeps({
			"/proj/docs/agents/ai-bot.md": AGENT_MD.replace("CodeBot", "AIBot"),
			"/proj/docs/agents/ai-bot.json": jsonDef,
		});
		const agents = agentStore.list(deps, "/proj");
		// Note: the name comes from frontmatter which still says CodeBot
		const agent = agents.find((a) => a.file === "ai-bot.md");
		expect(agent).toBeDefined();
		expect(agent!.components).toEqual([{ name: "tool-caller", type: "actuator" }]);
		expect(agent!.goals).toEqual([{ name: "assist-user", priority: 1 }]);
		expect(agent!.ai).toEqual({ model: "gpt-4o", provider: "openai" });
		expect(agent!.relationships).toEqual([{ target: "Supervisor", type: "reports-to" }]);
	});

	it("creates companion JSON when definition has complex fields", () => {
		const deps = makeDeps();
		const def: AgentDefinition = {
			name: "SmartBot", agentType: "ai", description: "",
			skills: [], tools: [], roles: [],
			components: [{ name: "perception", type: "sensor" }],
			ai: { provider: "anthropic" },
		};
		createAgent(deps, "/proj", def);
		// Should have written both .md and .json
		const writeCalls = (deps.disk.writeFileSync as ReturnType<typeof vi.fn>).mock.calls;
		const jsonCall = writeCalls.find(([p]: string[]) => p.endsWith(".json"));
		expect(jsonCall).toBeDefined();
		const parsed = JSON.parse(jsonCall![1] as string);
		expect(parsed.components).toEqual([{ name: "perception", type: "sensor" }]);
		expect(parsed.ai).toEqual({ model: "claude-sonnet-4-20250514", provider: "anthropic" });
	});

	it("creates agent with domain and behaviors in frontmatter", () => {
		const deps = makeDeps();
		const def: AgentDefinition = {
			name: "DomainBot", agentType: "human", description: "A domain agent",
			domain: "qa", skills: [], tools: [], roles: [],
			behaviors: ["review-code", "write-tests"],
		};
		createAgent(deps, "/proj", def);
		const written = (deps.disk.writeFileSync as ReturnType<typeof vi.fn>).mock.calls[0][1] as string;
		expect(written).toContain("domain: qa");
		expect(written).toContain("review-code");
		expect(written).toContain("write-tests");
	});
});

const AGENT_WITH_TASKS = `---
type: Agent
name: TaskBot
agentType: ai
description: Agent with suggested tasks
skills:
  - TypeScript|expert
tools:
  - flowti
roles:
  - Developer
suggestedTasks:
  - Implement features|in-progress
  - Code review|in-review
  - Plan architecture|planned,ready
  - General help
---

# TaskBot
`;

describe("suggestedTasks parsing", () => {
	it("parses suggested tasks with pipe-delimited phases", () => {
		const deps = makeDeps({ "/proj/docs/agents/task-bot.md": AGENT_WITH_TASKS });
		const agents = agentStore.list(deps, "/proj");
		const agent = agents.find((a) => a.name === "TaskBot");
		expect(agent).toBeDefined();
		expect(agent!.suggestedTasks).toEqual([
			{ name: "Implement features", phases: ["in-progress"] },
			{ name: "Code review", phases: ["in-review"] },
			{ name: "Plan architecture", phases: ["planned", "ready"] },
			{ name: "General help", phases: [] },
		]);
	});

	it("returns empty suggestedTasks when field is absent", () => {
		const deps = makeDeps({ "/proj/docs/agents/code-bot.md": AGENT_MD });
		const agents = agentStore.list(deps, "/proj");
		expect(agents[0].suggestedTasks).toEqual([]);
	});

	it("serializes suggestedTasks in agentToJson", () => {
		const json = agentToJson({
			name: "Bot", agentType: "ai", description: "",
			skills: [], tools: [], roles: [], file: "bot.md",
			suggestedTasks: [{ name: "Review code", phases: ["in-review"] }],
		});
		expect(json.suggestedTasks).toEqual([{ name: "Review code", phases: ["in-review"] }]);
	});

	it("omits suggestedTasks from agentToJson when empty", () => {
		const json = agentToJson({
			name: "Bot", agentType: "ai", description: "",
			skills: [], tools: [], roles: [], file: "bot.md",
			suggestedTasks: [],
		});
		expect(json).not.toHaveProperty("suggestedTasks");
	});
});

describe("addArrayItem", () => {
	it("appends to existing array field", () => {
		const deps = makeDeps({ "/proj/docs/agents/code-bot.md": AGENT_MD });
		const ok = addArrayItem(deps, "/proj", "CodeBot", "tools", "eslint");
		expect(ok).toBe(true);
		const written = (deps.disk.writeFileSync as ReturnType<typeof vi.fn>).mock.calls[0][1] as string;
		expect(written).toContain("  - eslint");
	});

	it("creates new array field when it does not exist", () => {
		const deps = makeDeps({ "/proj/docs/agents/code-bot.md": AGENT_MD });
		const ok = addArrayItem(deps, "/proj", "CodeBot", "behaviors", "patrol");
		expect(ok).toBe(true);
		const written = (deps.disk.writeFileSync as ReturnType<typeof vi.fn>).mock.calls[0][1] as string;
		expect(written).toContain("behaviors:\n  - patrol");
	});

	it("returns false for missing agent", () => {
		const deps = makeDeps();
		expect(addArrayItem(deps, "/proj", "Ghost", "tools", "x")).toBe(false);
	});
});

describe("removeArrayItem", () => {
	it("removes an existing array item", () => {
		const deps = makeDeps({ "/proj/docs/agents/code-bot.md": AGENT_MD });
		const ok = removeArrayItem(deps, "/proj", "CodeBot", "tools", "grep");
		expect(ok).toBe(true);
		const written = (deps.disk.writeFileSync as ReturnType<typeof vi.fn>).mock.calls[0][1] as string;
		expect(written).not.toContain("  - grep");
		expect(written).toContain("  - git");
	});

	it("returns false when item not found", () => {
		const deps = makeDeps({ "/proj/docs/agents/code-bot.md": AGENT_MD });
		expect(removeArrayItem(deps, "/proj", "CodeBot", "tools", "nonexistent")).toBe(false);
	});

	it("returns false for missing agent", () => {
		const deps = makeDeps();
		expect(removeArrayItem(deps, "/proj", "Ghost", "tools", "x")).toBe(false);
	});
});

describe("updateAgentJson", () => {
	it("creates companion JSON when none exists", () => {
		const deps = makeDeps({ "/proj/docs/agents/code-bot.md": AGENT_MD });
		const ok = updateAgentJson(deps, "/proj", "CodeBot", { ai: { provider: "anthropic" } });
		expect(ok).toBe(true);
		const written = (deps.disk.writeFileSync as ReturnType<typeof vi.fn>).mock.calls[0][1] as string;
		const parsed = JSON.parse(written);
		expect(parsed.ai.model).toBe("claude-sonnet-4-20250514");
		expect(parsed.ai.provider).toBe("anthropic");
	});

	it("merges into existing companion JSON", () => {
		const existingJson = JSON.stringify({ components: [{ name: "tool-caller" }] });
		const deps = makeDeps({
			"/proj/docs/agents/code-bot.md": AGENT_MD,
			"/proj/docs/agents/code-bot.json": existingJson,
		});
		updateAgentJson(deps, "/proj", "CodeBot", { ai: { provider: "gpt-4o" } });
		const written = (deps.disk.writeFileSync as ReturnType<typeof vi.fn>).mock.calls[0][1] as string;
		const parsed = JSON.parse(written);
		expect(parsed.components).toEqual([{ name: "tool-caller" }]);
		expect(parsed.ai).toEqual({ provider: "gpt-4o" });
	});
});

describe("readSystemPrompt", () => {
	it("returns prompt content when file exists", () => {
		const deps = makeDeps({ "/proj/docs/agents/code-bot.prompt.md": "You are a coding assistant." });
		const prompt = readSystemPrompt(deps, "/proj", "CodeBot");
		expect(prompt).toBe("You are a coding assistant.");
	});

	it("returns null when prompt file does not exist", () => {
		const deps = makeDeps({ "/proj/docs/agents/code-bot.md": AGENT_MD });
		expect(readSystemPrompt(deps, "/proj", "CodeBot")).toBeNull();
	});
});

describe("writeSystemPrompt", () => {
	it("writes prompt file", () => {
		const deps = makeDeps();
		const ok = writeSystemPrompt(deps, "/proj", "CodeBot", "You are helpful.");
		expect(ok).toBe(true);
		expect(deps.disk.writeFileSync).toHaveBeenCalledWith(
			"/proj/docs/agents/code-bot.prompt.md", "You are helpful.", "utf-8",
		);
	});
});

describe("inventory", () => {
	it("reads inventory from companion JSON", () => {
		const jsonDef = JSON.stringify({
			inventory: [
				{ path: "docs/notes.md", label: "Project Notes" },
				{ path: "docs/spec.md" },
			],
		});
		const deps = makeDeps({
			"/proj/docs/agents/code-bot.md": AGENT_MD,
			"/proj/docs/agents/code-bot.json": jsonDef,
		});
		const agents = agentStore.list(deps, "/proj");
		expect(agents[0].inventory).toEqual([
			{ path: "docs/notes.md", label: "Project Notes" },
			{ path: "docs/spec.md" },
		]);
	});

	it("returns empty inventory when no JSON file", () => {
		const deps = makeDeps({ "/proj/docs/agents/code-bot.md": AGENT_MD });
		expect(listInventory(deps, "/proj", "CodeBot")).toEqual([]);
	});

	it("returns empty inventory when JSON has no inventory key", () => {
		const deps = makeDeps({
			"/proj/docs/agents/code-bot.md": AGENT_MD,
			"/proj/docs/agents/code-bot.json": JSON.stringify({ ai: { model: "test" } }),
		});
		expect(listInventory(deps, "/proj", "CodeBot")).toEqual([]);
	});

	it("lists inventory items", () => {
		const jsonDef = JSON.stringify({ inventory: [{ path: "a.md" }, { path: "b.md", label: "B" }] });
		const deps = makeDeps({
			"/proj/docs/agents/code-bot.md": AGENT_MD,
			"/proj/docs/agents/code-bot.json": jsonDef,
		});
		const items = listInventory(deps, "/proj", "CodeBot");
		expect(items).toHaveLength(2);
		expect(items[0].path).toBe("a.md");
		expect(items[1].label).toBe("B");
	});

	it("adds an inventory item", () => {
		const deps = makeDeps({
			"/proj/docs/agents/code-bot.md": AGENT_MD,
			"/proj/docs/agents/code-bot.json": JSON.stringify({}),
		});
		const ok = addInventoryItem(deps, "/proj", "CodeBot", { path: "docs/plan.md", label: "Plan" });
		expect(ok).toBe(true);
		const items = listInventory(deps, "/proj", "CodeBot");
		expect(items).toEqual([{ path: "docs/plan.md", label: "Plan" }]);
	});

	it("prevents duplicate inventory items", () => {
		const jsonDef = JSON.stringify({ inventory: [{ path: "docs/plan.md" }] });
		const deps = makeDeps({
			"/proj/docs/agents/code-bot.md": AGENT_MD,
			"/proj/docs/agents/code-bot.json": jsonDef,
		});
		const ok = addInventoryItem(deps, "/proj", "CodeBot", { path: "docs/plan.md" });
		expect(ok).toBe(false);
	});

	it("removes an inventory item by path", () => {
		const jsonDef = JSON.stringify({ inventory: [{ path: "a.md" }, { path: "b.md" }] });
		const deps = makeDeps({
			"/proj/docs/agents/code-bot.md": AGENT_MD,
			"/proj/docs/agents/code-bot.json": jsonDef,
		});
		const ok = removeInventoryItem(deps, "/proj", "CodeBot", "a.md");
		expect(ok).toBe(true);
		const items = listInventory(deps, "/proj", "CodeBot");
		expect(items).toEqual([{ path: "b.md" }]);
	});

	it("returns false when removing a non-existent item", () => {
		const jsonDef = JSON.stringify({ inventory: [{ path: "a.md" }] });
		const deps = makeDeps({
			"/proj/docs/agents/code-bot.md": AGENT_MD,
			"/proj/docs/agents/code-bot.json": jsonDef,
		});
		expect(removeInventoryItem(deps, "/proj", "CodeBot", "nonexistent.md")).toBe(false);
	});

	it("serializes inventory in agentToJson", () => {
		const json = agentToJson({
			name: "Bot", agentType: "ai", description: "",
			skills: [], tools: [], roles: [], file: "bot.md",
			inventory: [{ path: "docs/spec.md", label: "Spec" }],
		});
		expect(json.inventory).toEqual([{ path: "docs/spec.md", label: "Spec" }]);
	});

	it("omits inventory from agentToJson when empty", () => {
		const json = agentToJson({
			name: "Bot", agentType: "ai", description: "",
			skills: [], tools: [], roles: [], file: "bot.md",
			inventory: [],
		});
		expect(json).not.toHaveProperty("inventory");
	});

	it("includes inventory in companion JSON on agent creation", () => {
		const deps = makeDeps();
		const def: AgentDefinition = {
			name: "InvBot", agentType: "ai", description: "",
			skills: [], tools: [], roles: [],
			inventory: [{ path: "docs/brief.md", label: "Brief" }],
		};
		createAgent(deps, "/proj", def);
		const writeCalls = (deps.disk.writeFileSync as ReturnType<typeof vi.fn>).mock.calls;
		const jsonCall = writeCalls.find(([p]: string[]) => p.endsWith(".json"));
		expect(jsonCall).toBeDefined();
		const parsed = JSON.parse(jsonCall![1] as string);
		expect(parsed.inventory).toEqual([{ path: "docs/brief.md", label: "Brief" }]);
	});
});

describe("parseSuggestedTask", () => {
	it("parses name and phases only", () => {
		const result = parseSuggestedTask("Refine goal|new,planned");
		expect(result).toEqual({ name: "Refine goal", phases: ["new", "planned"] });
	});

	it("parses input segment", () => {
		const result = parseSuggestedTask("Refine goal|new|input:text:What is the goal?");
		expect(result).toEqual({
			name: "Refine goal",
			phases: ["new"],
			input: { type: "text", prompt: "What is the goal?" },
		});
	});

	it("parses tool segment", () => {
		const result = parseSuggestedTask("Run tests|any|tool:flowti test --format=json");
		expect(result).toEqual({
			name: "Run tests",
			phases: ["any"],
			tool: { command: "flowti test --format=json" },
		});
	});

	it("parses both input and tool", () => {
		const result = parseSuggestedTask("Review|ready|input:text:Which PR?|tool:flowti review");
		expect(result).toEqual({
			name: "Review",
			phases: ["ready"],
			input: { type: "text", prompt: "Which PR?" },
			tool: { command: "flowti review" },
		});
	});

	it("handles segments in any order", () => {
		const result = parseSuggestedTask("Review|ready|tool:flowti review|input:text:Which PR?");
		expect(result.input).toEqual({ type: "text", prompt: "Which PR?" });
		expect(result.tool).toEqual({ command: "flowti review" });
	});

	it("handles no phases with input", () => {
		const result = parseSuggestedTask("Quick task||input:text:Details?");
		expect(result).toEqual({
			name: "Quick task",
			phases: [],
			input: { type: "text", prompt: "Details?" },
		});
	});
});

// ── NPC agent type parsing ────────────────────────────────────────────

const NPC_AGENT_MD = `---
type: Agent
name: Merchant
agentType: npc
domain: commerce
description: NPC shopkeeper for the Agent World economy
---

# Merchant
`;

describe("agentStore — NPC type parsing", () => {
	it("parses agentType npc from frontmatter", () => {
		const deps = makeDeps({ "/proj/docs/agents/merchant.md": NPC_AGENT_MD });
		const agents = agentStore.list(deps, "/proj");
		expect(agents).toHaveLength(1);
		expect(agents[0].agentType).toBe("npc");
	});

	it("preserves npc agentType on read", () => {
		const deps = makeDeps({ "/proj/docs/agents/merchant.md": NPC_AGENT_MD });
		const agent = findAgent(deps, "/proj", "Merchant");
		expect(agent).not.toBeNull();
		expect(agent!.agentType).toBe("npc");
	});

	it("falls back to human for unknown agentType values", () => {
		const badMd = `---
type: Agent
name: Unknown
agentType: robot
description: Unknown type
---
`;
		const deps = makeDeps({ "/proj/docs/agents/unknown.md": badMd });
		const agents = agentStore.list(deps, "/proj");
		expect(agents[0].agentType).toBe("human");
	});

	it("parses npc domain and description", () => {
		const deps = makeDeps({ "/proj/docs/agents/merchant.md": NPC_AGENT_MD });
		const agents = agentStore.list(deps, "/proj");
		expect(agents[0].domain).toBe("commerce");
		expect(agents[0].description).toBe("NPC shopkeeper for the Agent World economy");
	});
});
