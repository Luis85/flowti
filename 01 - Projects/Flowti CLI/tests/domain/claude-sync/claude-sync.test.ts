vi.mock("../../../src/infrastructure/ui.js", () => ({
	RESET: "", BOLD: "", DIM: "", GREEN: "", RED: "", YELLOW: "", CYAN: "",
}));

vi.mock("../../../src/infrastructure/logger.js", () => ({
	log: vi.fn(),
}));

import { describe, it, expect, vi } from "vitest";
import {
	generateAgentSkillContent,
	generateToolSkillContent,
	syncAgentsToClaude,
	syncToolsToClaude,
	syncAllToClaude,
} from "../../../src/domain/claude-sync/claude-sync.js";
import type { AgentSummary } from "../../../src/domain/agents/agent-types.js";
import type { LoadedAiTool } from "../../../src/domain/ai-tools/ai-tool-types.js";
import type { ClaudeSyncDeps } from "../../../src/domain/claude-sync/claude-sync.js";

// ── Test helpers ────────────────────────────────────────────────────

function makeDeps(files: Record<string, string> = {}): ClaudeSyncDeps {
	const store: Record<string, string> = { ...files };
	return {
		disk: {
			existsSync: vi.fn((p: string) => p in store),
			readFileSync: vi.fn((p: string) => store[p] ?? ""),
			writeFileSync: vi.fn((p: string, c: string) => { store[p] = c; }),
			mkdirSync: vi.fn(),
			readdirSync: vi.fn(() => []),
			unlinkSync: vi.fn(),
			copyFileSync: vi.fn(),
			rmSync: vi.fn(),
			statSync: vi.fn(),
		},
		paths: {
			join: (...segs: string[]) => segs.join("/"),
			resolve: (...segs: string[]) => segs.join("/"),
			dirname: (p: string) => p.split("/").slice(0, -1).join("/"),
			basename: (p: string, ext?: string) => {
				const base = p.split("/").pop()!;
				return ext && base.endsWith(ext) ? base.slice(0, -ext.length) : base;
			},
			relative: (_from: string, to: string) => to,
			extname: (p: string) => "." + p.split(".").pop()!,
			isAbsolute: () => true,
			sep: "/",
		},
	} as unknown as ClaudeSyncDeps;
}

function makeAgent(overrides: Partial<AgentSummary> = {}): AgentSummary {
	return {
		name: "Test Agent",
		agentType: "ai",
		description: "A test agent",
		skills: [{ name: "Testing", level: "expert" }],
		tools: ["flowti"],
		roles: ["Tester"],
		file: "test-agent.md",
		...overrides,
	};
}

function makeTool(overrides: Partial<LoadedAiTool> = {}): LoadedAiTool {
	return {
		definition: {
			name: "test-tool",
			description: "A test tool",
			version: "1.0.0",
			run: "echo hello",
			params: [{ name: "input", type: "string", description: "Input value", required: true }],
			tags: ["test"],
		},
		path: "/vault/.flowti/ai-tools/test-tool.json",
		valid: true,
		errors: [],
		...overrides,
	};
}

// ── generateAgentSkillContent ───────────────────────────────────────

describe("generateAgentSkillContent", () => {
	it("generates frontmatter with name and description", () => {
		const deps = makeDeps();
		const content = generateAgentSkillContent([], "/agents", deps);
		expect(content).toContain("name: agents");
		expect(content).toContain("description:");
		expect(content).toContain("user-invocable: true");
	});

	it("shows empty message when no agents exist", () => {
		const deps = makeDeps();
		const content = generateAgentSkillContent([], "/agents", deps);
		expect(content).toContain("No agents defined");
	});

	it("generates roster table for agents", () => {
		const deps = makeDeps();
		const agents = [makeAgent({ name: "Alice", roles: ["Dev"], domain: "engineering" })];
		const content = generateAgentSkillContent(agents, "/agents", deps);
		expect(content).toContain("## Roster");
		expect(content).toContain("| Alice | ai | engineering | Dev | Testing (expert) |");
	});

	it("includes agent detail sections", () => {
		const deps = makeDeps();
		const agents = [makeAgent({ name: "Bob", description: "Builder" })];
		const content = generateAgentSkillContent(agents, "/agents", deps);
		expect(content).toContain("## Bob");
		expect(content).toContain("> Builder");
		expect(content).toContain("**Tools**: flowti");
		expect(content).toContain("**Roles**: Tester");
	});

	it("includes skills list in detail section", () => {
		const deps = makeDeps();
		const agents = [makeAgent({ skills: [{ name: "Go", level: "expert" }, { name: "Rust", level: "" }] })];
		const content = generateAgentSkillContent(agents, "/agents", deps);
		expect(content).toContain("- Go (expert)");
		expect(content).toContain("- Rust");
	});

	it("includes system prompt when prompt file exists", () => {
		const deps = makeDeps({ "/agents/test-agent.prompt.md": "You are a test agent." });
		const agents = [makeAgent()];
		const content = generateAgentSkillContent(agents, "/agents", deps);
		expect(content).toContain("### System Prompt");
		expect(content).toContain("You are a test agent.");
	});

	it("omits system prompt section when no prompt file exists", () => {
		const deps = makeDeps();
		const agents = [makeAgent()];
		const content = generateAgentSkillContent(agents, "/agents", deps);
		expect(content).not.toContain("### System Prompt");
	});

	it("includes relationships when present", () => {
		const deps = makeDeps();
		const agents = [makeAgent({
			relationships: [{ target: "Architect", type: "reports-to", description: "Reports on progress" }],
		})];
		const content = generateAgentSkillContent(agents, "/agents", deps);
		expect(content).toContain("**Relationships**:");
		expect(content).toContain("reports-to → Architect: Reports on progress");
	});

	it("includes behaviors when present", () => {
		const deps = makeDeps();
		const agents = [makeAgent({ behaviors: ["patrol", "guard"] })];
		const content = generateAgentSkillContent(agents, "/agents", deps);
		expect(content).toContain("**Behaviors**: patrol, guard");
	});

	it("includes preferred phases when present", () => {
		const deps = makeDeps();
		const agents = [makeAgent({ preferredPhases: ["planned", "in-progress"] })];
		const content = generateAgentSkillContent(agents, "/agents", deps);
		expect(content).toContain("**Preferred Phases**: planned, in-progress");
	});

	it("omits preferred phases when not set", () => {
		const deps = makeDeps();
		const agents = [makeAgent()];
		const content = generateAgentSkillContent(agents, "/agents", deps);
		expect(content).not.toContain("**Preferred Phases**");
	});

	it("includes inventory items when present", () => {
		const deps = makeDeps();
		const agents = [makeAgent({
			inventory: [
				{ path: "docs/spec.md", label: "Specification" },
				{ path: "docs/notes.md" },
			],
		})];
		const content = generateAgentSkillContent(agents, "/agents", deps);
		expect(content).toContain("**Inventory**:");
		expect(content).toContain("- `docs/spec.md` — Specification");
		expect(content).toContain("- `docs/notes.md`");
	});

	it("omits inventory section when empty", () => {
		const deps = makeDeps();
		const agents = [makeAgent()];
		const content = generateAgentSkillContent(agents, "/agents", deps);
		expect(content).not.toContain("**Inventory**");
	});

	it("handles multiple agents", () => {
		const deps = makeDeps();
		const agents = [
			makeAgent({ name: "Alice", file: "alice.md" }),
			makeAgent({ name: "Bob", file: "bob.md" }),
		];
		const content = generateAgentSkillContent(agents, "/agents", deps);
		expect(content).toContain("## Alice");
		expect(content).toContain("## Bob");
	});

	it("shows dash for missing domain in roster table", () => {
		const deps = makeDeps();
		const agents = [makeAgent({ domain: undefined })];
		const content = generateAgentSkillContent(agents, "/agents", deps);
		expect(content).toMatch(/\| Test Agent \| ai \| — \|/);
	});
});

// ── generateAgentSkillContent — skillMap ────────────────────────────

describe("generateAgentSkillContent — skillMap", () => {
	it("appends Recommended Skills when agent domain matches skillMap", () => {
		const agent = makeAgent({ domain: "engineering" });
		const skillMap = { engineering: ["superpowers:test-driven-development", "superpowers:systematic-debugging"] };
		const content = generateAgentSkillContent([agent], "/agents", makeDeps(), skillMap);
		expect(content).toContain("**Recommended Skills**:");
		expect(content).toContain("`/superpowers:test-driven-development`");
		expect(content).toContain("`/superpowers:systematic-debugging`");
	});

	it("omits Recommended Skills when agent has no domain", () => {
		const agent = makeAgent({ domain: undefined });
		const skillMap = { engineering: ["superpowers:tdd"] };
		const content = generateAgentSkillContent([agent], "/agents", makeDeps(), skillMap);
		expect(content).not.toContain("Recommended Skills");
	});

	it("omits Recommended Skills when domain not in skillMap", () => {
		const agent = makeAgent({ domain: "design" });
		const skillMap = { engineering: ["superpowers:tdd"] };
		const content = generateAgentSkillContent([agent], "/agents", makeDeps(), skillMap);
		expect(content).not.toContain("Recommended Skills");
	});

	it("omits Recommended Skills when skillMap is undefined", () => {
		const agent = makeAgent({ domain: "engineering" });
		const content = generateAgentSkillContent([agent], "/agents", makeDeps(), undefined);
		expect(content).not.toContain("Recommended Skills");
	});

	it("omits Recommended Skills when skillMap is empty", () => {
		const agent = makeAgent({ domain: "engineering" });
		const content = generateAgentSkillContent([agent], "/agents", makeDeps(), {});
		expect(content).not.toContain("Recommended Skills");
	});

	it("omits Recommended Skills when skills array is empty", () => {
		const agent = makeAgent({ domain: "engineering" });
		const content = generateAgentSkillContent([agent], "/agents", makeDeps(), { engineering: [] });
		expect(content).not.toContain("Recommended Skills");
	});

	it("renders multiple agents with different domains correctly", () => {
		const eng = makeAgent({ name: "Dev", domain: "engineering" });
		const des = makeAgent({ name: "UX", domain: "design", file: "ux.md" });
		const skillMap = {
			engineering: ["superpowers:tdd"],
			design: ["superpowers:brainstorming"],
		};
		const content = generateAgentSkillContent([eng, des], "/agents", makeDeps(), skillMap);
		expect(content).toContain("`/superpowers:tdd`");
		expect(content).toContain("`/superpowers:brainstorming`");
	});

	it("auto-generates human-readable description from slug", () => {
		const agent = makeAgent({ domain: "engineering" });
		const skillMap = { engineering: ["superpowers:test-driven-development"] };
		const content = generateAgentSkillContent([agent], "/agents", makeDeps(), skillMap);
		expect(content).toContain("Test driven development");
	});
});

// ── generateToolSkillContent ────────────────────────────────────────

describe("generateToolSkillContent", () => {
	it("generates frontmatter with name and description", () => {
		const content = generateToolSkillContent([]);
		expect(content).toContain("name: tools");
		expect(content).toContain("description:");
		expect(content).toContain("user-invocable: true");
	});

	it("shows empty message when no tools exist", () => {
		const content = generateToolSkillContent([]);
		expect(content).toContain("No tools defined");
	});

	it("generates summary table for valid tools", () => {
		const tools = [makeTool()];
		const content = generateToolSkillContent(tools);
		expect(content).toContain("| test-tool | 1.0.0 | A test tool | test |");
	});

	it("includes tool detail sections", () => {
		const tools = [makeTool()];
		const content = generateToolSkillContent(tools);
		expect(content).toContain("## test-tool");
		expect(content).toContain("> A test tool");
		expect(content).toContain("**Run**: `echo hello`");
		expect(content).toContain("**Version**: 1.0.0");
	});

	it("includes parameter table", () => {
		const tools = [makeTool()];
		const content = generateToolSkillContent(tools);
		expect(content).toContain("**Parameters**:");
		expect(content).toContain("| input | string | yes | Input value |");
	});

	it("excludes invalid tools", () => {
		const tools = [makeTool({ valid: false, errors: ["broken"] })];
		const content = generateToolSkillContent(tools);
		expect(content).toContain("No tools defined");
	});

	it("includes cwd when specified", () => {
		const tools = [makeTool({ definition: { ...makeTool().definition, cwd: "src/" } })];
		const content = generateToolSkillContent(tools);
		expect(content).toContain("**Working Directory**: `src/`");
	});

	it("includes tags", () => {
		const tools = [makeTool({ definition: { ...makeTool().definition, tags: ["build", "ci"] } })];
		const content = generateToolSkillContent(tools);
		expect(content).toContain("**Tags**: build, ci");
	});
});

// ── syncAgentsToClaude ──────────────────────────────────────────────

describe("syncAgentsToClaude", () => {
	it("writes SKILL.md to .claude/skills/agents/", () => {
		const deps = makeDeps();
		const agents = [makeAgent()];
		const result = syncAgentsToClaude(deps, "/vault", "/vault/agents", agents);
		expect(result.written).toHaveLength(1);
		expect(result.written[0]).toContain(".claude/skills/agents/SKILL.md");
		expect(deps.disk.writeFileSync).toHaveBeenCalled();
		expect(deps.disk.mkdirSync).toHaveBeenCalled();
	});

	it("creates parent directories", () => {
		const deps = makeDeps();
		syncAgentsToClaude(deps, "/vault", "/vault/agents", []);
		expect(deps.disk.mkdirSync).toHaveBeenCalledWith(
			"/vault/.claude/skills/agents",
			{ recursive: true },
		);
	});

	it("writes valid SKILL.md content", () => {
		const deps = makeDeps();
		const agents = [makeAgent({ name: "Tester" })];
		syncAgentsToClaude(deps, "/vault", "/vault/agents", agents);
		const written = (deps.disk.writeFileSync as ReturnType<typeof vi.fn>).mock.calls[0][1] as string;
		expect(written).toContain("name: agents");
		expect(written).toContain("Tester");
	});
});

// ── syncToolsToClaude ───────────────────────────────────────────────

describe("syncToolsToClaude", () => {
	it("writes SKILL.md to .claude/skills/tools/", () => {
		const deps = makeDeps();
		const tools = [makeTool()];
		const result = syncToolsToClaude(deps, "/vault", tools);
		expect(result.written).toHaveLength(1);
		expect(result.written[0]).toContain(".claude/skills/tools/SKILL.md");
		expect(deps.disk.writeFileSync).toHaveBeenCalled();
	});

	it("creates parent directories", () => {
		const deps = makeDeps();
		syncToolsToClaude(deps, "/vault", []);
		expect(deps.disk.mkdirSync).toHaveBeenCalledWith(
			"/vault/.claude/skills/tools",
			{ recursive: true },
		);
	});
});

// ── syncAllToClaude ─────────────────────────────────────────────────

describe("syncAllToClaude", () => {
	it("syncs both agents and tools", () => {
		const deps = makeDeps();
		const agents = [makeAgent()];
		const tools = [makeTool()];
		const result = syncAllToClaude(deps, "/vault", "/vault/agents", agents, tools);
		expect(result.written).toHaveLength(2);
		expect(result.written[0]).toContain("agents/SKILL.md");
		expect(result.written[1]).toContain("tools/SKILL.md");
	});

	it("works with empty agents and tools", () => {
		const deps = makeDeps();
		const result = syncAllToClaude(deps, "/vault", "/vault/agents", [], []);
		expect(result.written).toHaveLength(2);
	});
});
