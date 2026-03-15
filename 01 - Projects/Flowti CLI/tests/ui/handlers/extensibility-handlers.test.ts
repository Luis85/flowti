import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Infrastructure mocks ────────────────────────────────────────────
vi.mock("../../../src/infrastructure/filesystem.js", () => ({
	disk: { existsSync: vi.fn(() => false), readFileSync: vi.fn(() => ""), readdirSync: vi.fn(() => []), writeFileSync: vi.fn(), mkdirSync: vi.fn() },
}));
vi.mock("../../../src/infrastructure/paths.js", () => ({
	paths: { join: (...args: string[]) => args.join("/"), resolve: (...args: string[]) => args.join("/"), basename: (p: string) => p.split("/").pop() ?? "", sep: "/" },
}));
vi.mock("../../../src/infrastructure/shell.js", () => ({
	shell: { run: vi.fn(() => 0), runSilent: vi.fn(), runCapture: vi.fn(() => ""), runCaptureStatus: vi.fn(() => ({ exitCode: 0, output: "" })) },
}));
vi.mock("../../../src/infrastructure/input.js", () => ({
	input: { ask: vi.fn(() => ""), askYesNo: vi.fn(() => true), waitForEnter: vi.fn() },
}));
vi.mock("../../../src/infrastructure/logger.js", () => ({ log: vi.fn() }));
vi.mock("../../../src/infrastructure/ui.js", () => ({
	RESET: "", BOLD: "", DIM: "", GREEN: "", RED: "", CYAN: "", YELLOW: "", printHeader: vi.fn(),
}));
vi.mock("../../../src/infrastructure/config.js", () => ({
	VAULT_ROOT: "/mock-vault", CLI_PROJECT: "/mock/cli", cliConfig: { agents: { dir: "agents" } }, PROJECTS_DIR: "/mock/projects", AGENTS_DIR: "/mock-vault/agents",
}));
vi.mock("../../../src/infrastructure/clock.js", () => ({
	clock: { iso: () => "2026-01-01T00:00:00.000Z", ms: () => 0, now: () => new Date("2026-01-01"), safeIso: () => "2026-01-01T00-00-00" },
}));
vi.mock("../../../src/infrastructure/deps.js", () => ({
	createDefaultDeps: vi.fn(() => ({ disk: {}, paths: {}, shell: {}, clock: {}, log: vi.fn() })),
}));

// ── Agent mocks ─────────────────────────────────────────────────────
vi.mock("../../../src/domain/agents/agent-store.js", () => ({
	listAgents: vi.fn(() => []),
	findAgent: vi.fn(),
}));
vi.mock("../../../src/infrastructure/sitemap-router.js", () => ({
	navigateWithParams: vi.fn((viewId: string, params?: Record<string, unknown>) => {
		const suffix = params ? `?${JSON.stringify(params)}` : "";
		return `navigate:${viewId}${suffix}`;
	}),
}));
vi.mock("../../../src/ui/menus/agents-menu.js", () => ({
	talkToAgentInteractive: vi.fn(),
	assignTaskInteractive: vi.fn(),
	clarifyTaskInteractive: vi.fn(),
	assignToProjectInteractive: vi.fn(),
	addAgentInteractive: vi.fn(),
	editInventoryInteractive: vi.fn(),
	removeAgentInteractive: vi.fn(),
	editAgentIdentity: vi.fn(),
	editAgentSkills: vi.fn(),
	editAgentArrayField: vi.fn(),
	editAIConfigInteractive: vi.fn(),
	editSystemPromptInteractive: vi.fn(),
}));
vi.mock("../../../src/ui/menus/agents-run-menu.js", () => ({
	runAgentInteractive: vi.fn(),
}));
vi.mock("../../../src/domain/iterations/iteration-store.js", () => ({
	findCurrentIteration: vi.fn(() => null),
}));
vi.mock("../../../src/domain/agents/agent-state.js", () => ({
	readAgentState: vi.fn(() => ({ name: "Dev", status: "idle", tasks: [], briefs: [] })),
	writeAgentState: vi.fn(),
	recordInteraction: vi.fn((s: unknown) => s),
	addTask: vi.fn((s: unknown) => s),
	addBrief: vi.fn((s: unknown) => s),
}));
vi.mock("../../../src/domain/agents/agent-session.js", () => ({
	listSessions: vi.fn(() => []),
}));
vi.mock("../../../src/ui/displays/agent-run-display.js", () => ({
	renderSessionList: vi.fn(),
}));

// ── Domain / UI mocks for extensibility ─────────────────────────────
vi.mock("../../../src/domain/plugins/plugin-loader.js", () => ({
	loadPlugins: vi.fn(() => []),
	scaffoldPlugin: vi.fn(() => ({ path: "/mock/plugin" })),
}));
vi.mock("../../../src/domain/plugins/plugin-reference.js", () => ({
	generatePluginReference: vi.fn(() => ({ save: vi.fn() })),
}));
vi.mock("../../../src/domain/plugins/plugin-commands.js", () => ({
	toPluginListItems: vi.fn(() => []),
	toPluginValidationItems: vi.fn(() => []),
}));
vi.mock("../../../src/ui/displays/plugins-display.js", () => ({
	renderPluginList: vi.fn(),
	renderPluginValidation: vi.fn(),
}));
vi.mock("../../../src/domain/ai-tools/ai-tool-loader.js", () => ({
	loadAiTools: vi.fn(() => []),
	scaffoldAiTool: vi.fn(() => ({ path: "/mock/tool" })),
}));
vi.mock("../../../src/domain/ai-tools/ai-tool-reference.js", () => ({
	generateAiToolReference: vi.fn(() => ({ save: vi.fn() })),
}));
vi.mock("../../../src/domain/ai-tools/ai-tool-commands.js", () => ({
	toToolListItems: vi.fn(() => []),
	toToolValidationItems: vi.fn(() => []),
}));
vi.mock("../../../src/ui/displays/ai-tools-display.js", () => ({
	renderToolList: vi.fn(),
	renderToolValidation: vi.fn(),
}));

// ── Imports ─────────────────────────────────────────────────────────
import { HandlerRegistry } from "../../../src/infrastructure/handler-registry.js";
import { registerExtensibilityHandlers } from "../../../src/ui/handlers/extensibility-handlers.js";
import { input } from "../../../src/infrastructure/input.js";
import { disk } from "../../../src/infrastructure/filesystem.js";
import { clock } from "../../../src/infrastructure/clock.js";
import { loadPlugins, scaffoldPlugin } from "../../../src/domain/plugins/plugin-loader.js";
import { generatePluginReference } from "../../../src/domain/plugins/plugin-reference.js";
import { toPluginListItems, toPluginValidationItems } from "../../../src/domain/plugins/plugin-commands.js";
import { renderPluginList, renderPluginValidation } from "../../../src/ui/displays/plugins-display.js";
import { loadAiTools, scaffoldAiTool } from "../../../src/domain/ai-tools/ai-tool-loader.js";
import { generateAiToolReference } from "../../../src/domain/ai-tools/ai-tool-reference.js";
import { toToolListItems, toToolValidationItems } from "../../../src/domain/ai-tools/ai-tool-commands.js";
import { renderToolList, renderToolValidation } from "../../../src/ui/displays/ai-tools-display.js";
import { listAgents, findAgent } from "../../../src/domain/agents/agent-store.js";
import { talkToAgentInteractive, assignTaskInteractive } from "../../../src/ui/menus/agents-menu.js";
import { runAgentInteractive } from "../../../src/ui/menus/agents-run-menu.js";
import { findCurrentIteration } from "../../../src/domain/iterations/iteration-store.js";
import { listSessions } from "../../../src/domain/agents/agent-session.js";
import { renderSessionList } from "../../../src/ui/displays/agent-run-display.js";
import { writeAgentState } from "../../../src/domain/agents/agent-state.js";

import type { RouterContext } from "../../../src/infrastructure/sitemap-types.js";

// ── Helpers ─────────────────────────────────────────────────────────

const mockDeps = {
	disk,
	paths: { join: (...args: string[]) => args.join("/"), resolve: (...args: string[]) => args.join("/"), basename: (p: string) => p.split("/").pop() ?? "", sep: "/" },
	clock,
	input,
	log: vi.fn(),
	warn: vi.fn(),
	shell: { run: vi.fn(() => 0), runSilent: vi.fn(), runCapture: vi.fn(() => ""), runCaptureStatus: vi.fn(() => ({ exitCode: 0, output: "" })) },
	proc: { exit: vi.fn(), argv: [] },
	bus: { emit: vi.fn(), on: vi.fn(), off: vi.fn() },
	agentShell: { talk: vi.fn(), dispatch: vi.fn(), getActiveDispatch: vi.fn(() => null), reconcileStaleAgents: vi.fn(() => ({ recovered: [] })) },
};

function mockCtx(): RouterContext {
	return { deps: mockDeps } as RouterContext;
}

// ── Suite ───────────────────────────────────────────────────────────

describe("registerExtensibilityHandlers", () => {
	let registry: HandlerRegistry;

	beforeEach(() => {
		vi.clearAllMocks();
		registry = new HandlerRegistry();
		registerExtensibilityHandlers(registry);
	});

	// ── Registration ────────────────────────────────────────────────

	describe("registration", () => {
		it("registers all expected extensibility actions", () => {
			const expectedActions = [
				"plugins:list", "plugins:validate", "plugins:create", "plugins:reference",
				"ai-tools:list", "ai-tools:validate", "ai-tools:create", "ai-tools:reference",
				"agents:add", "agents:remove",
				"agents:edit-identity", "agents:edit-skills", "agents:edit-tools",
				"agents:edit-roles", "agents:edit-ai", "agents:edit-prompt",
				"agents:edit-inventory",
				"agents:talk", "agents:assign-task", "agents:assign-to-project",
				"agents:navigate-edit", "agent:status",
			];
			for (const id of expectedActions) {
				expect(registry.hasAction(id)).toBe(true);
			}
		});

		it("registers agents:list data source", () => {
			expect(registry.hasDataSource("agents:list")).toBe(true);
		});

		it("registers agent-detail and agent-edit views", () => {
			expect(registry.hasView("agent-detail")).toBe(true);
			expect(registry.hasView("agent-edit")).toBe(true);
		});
	});

	// ── Plugin handlers ─────────────────────────────────────────────

	describe("plugins:list", () => {
		it("loads plugins and renders the list", async () => {
			const handler = registry.getAction("plugins:list");
			await handler(mockCtx());
			expect(loadPlugins).toHaveBeenCalled();
			expect(toPluginListItems).toHaveBeenCalled();
			expect(renderPluginList).toHaveBeenCalled();
			expect(input.waitForEnter).toHaveBeenCalled();
		});

		it("returns 'main'", async () => {
			const handler = registry.getAction("plugins:list");
			const result = await handler(mockCtx());
			expect(result).toBe("main");
		});
	});

	describe("plugins:validate", () => {
		it("validates plugins and renders results", async () => {
			const handler = registry.getAction("plugins:validate");
			await handler(mockCtx());
			expect(toPluginValidationItems).toHaveBeenCalled();
			expect(renderPluginValidation).toHaveBeenCalled();
			expect(input.waitForEnter).toHaveBeenCalled();
		});

		it("returns 'main'", async () => {
			const handler = registry.getAction("plugins:validate");
			const result = await handler(mockCtx());
			expect(result).toBe("main");
		});
	});

	describe("plugins:create", () => {
		it("prompts for name and description then scaffolds", async () => {
			vi.mocked(input.ask)
				.mockResolvedValueOnce("my-plugin")
				.mockResolvedValueOnce("A test plugin");
			const handler = registry.getAction("plugins:create");
			await handler(mockCtx());
			expect(input.ask).toHaveBeenCalledTimes(2);
			expect(scaffoldPlugin).toHaveBeenCalledWith(
				expect.anything(), "/mock-vault", "my-plugin", "A test plugin", expect.anything(),
			);
			expect(input.waitForEnter).toHaveBeenCalled();
		});

		it("returns 'main' on success", async () => {
			vi.mocked(input.ask)
				.mockResolvedValueOnce("my-plugin")
				.mockResolvedValueOnce("desc");
			const handler = registry.getAction("plugins:create");
			const result = await handler(mockCtx());
			expect(result).toBe("main");
		});

		it("cancels when name is empty", async () => {
			vi.mocked(input.ask).mockResolvedValueOnce("");
			const handler = registry.getAction("plugins:create");
			const result = await handler(mockCtx());
			expect(scaffoldPlugin).not.toHaveBeenCalled();
			expect(result).toBe("main");
		});

		it("uses default description when empty", async () => {
			vi.mocked(input.ask)
				.mockResolvedValueOnce("my-plugin")
				.mockResolvedValueOnce("");
			const handler = registry.getAction("plugins:create");
			await handler(mockCtx());
			expect(scaffoldPlugin).toHaveBeenCalledWith(
				expect.anything(), "/mock-vault", "my-plugin", "A Flowti plugin", expect.anything(),
			);
		});

		it("logs error when scaffold returns error", async () => {
			vi.mocked(input.ask)
				.mockResolvedValueOnce("bad-plugin")
				.mockResolvedValueOnce("desc");
			vi.mocked(scaffoldPlugin).mockReturnValueOnce({ error: "already exists" } as any);
			const handler = registry.getAction("plugins:create");
			await handler(mockCtx());
			expect(mockDeps.log).toHaveBeenCalledWith(expect.stringContaining("already exists"));
		});
	});

	describe("plugins:reference", () => {
		it("generates and saves plugin reference doc", async () => {
			const mockSave = vi.fn();
			vi.mocked(generatePluginReference).mockReturnValueOnce({ save: mockSave } as any);
			const handler = registry.getAction("plugins:reference");
			await handler(mockCtx());
			expect(loadPlugins).toHaveBeenCalled();
			expect(generatePluginReference).toHaveBeenCalled();
			expect(mockSave).toHaveBeenCalledWith(
				expect.stringContaining("Plugin Reference.md"), expect.anything(),
			);
			expect(input.waitForEnter).toHaveBeenCalled();
		});

		it("returns 'main'", async () => {
			const handler = registry.getAction("plugins:reference");
			const result = await handler(mockCtx());
			expect(result).toBe("main");
		});
	});

	// ── AI Tools handlers ───────────────────────────────────────────

	describe("ai-tools:list", () => {
		it("loads tools and renders the list", async () => {
			const handler = registry.getAction("ai-tools:list");
			await handler(mockCtx());
			expect(loadAiTools).toHaveBeenCalled();
			expect(toToolListItems).toHaveBeenCalled();
			expect(renderToolList).toHaveBeenCalled();
			expect(input.waitForEnter).toHaveBeenCalled();
		});

		it("returns 'main'", async () => {
			const handler = registry.getAction("ai-tools:list");
			const result = await handler(mockCtx());
			expect(result).toBe("main");
		});
	});

	describe("ai-tools:validate", () => {
		it("validates tools and renders results", async () => {
			const handler = registry.getAction("ai-tools:validate");
			await handler(mockCtx());
			expect(toToolValidationItems).toHaveBeenCalled();
			expect(renderToolValidation).toHaveBeenCalled();
			expect(input.waitForEnter).toHaveBeenCalled();
		});

		it("returns 'main'", async () => {
			const handler = registry.getAction("ai-tools:validate");
			const result = await handler(mockCtx());
			expect(result).toBe("main");
		});
	});

	describe("ai-tools:create", () => {
		it("prompts for name, description, and run command then scaffolds", async () => {
			vi.mocked(input.ask)
				.mockResolvedValueOnce("my-tool")
				.mockResolvedValueOnce("A test tool")
				.mockResolvedValueOnce("echo hello");
			const handler = registry.getAction("ai-tools:create");
			await handler(mockCtx());
			expect(input.ask).toHaveBeenCalledTimes(3);
			expect(scaffoldAiTool).toHaveBeenCalledWith(
				expect.anything(), "/mock-vault", "my-tool", "A test tool", "echo hello", expect.anything(),
			);
			expect(input.waitForEnter).toHaveBeenCalled();
		});

		it("returns 'main' on success", async () => {
			vi.mocked(input.ask)
				.mockResolvedValueOnce("my-tool")
				.mockResolvedValueOnce("desc")
				.mockResolvedValueOnce("cmd");
			const handler = registry.getAction("ai-tools:create");
			const result = await handler(mockCtx());
			expect(result).toBe("main");
		});

		it("cancels when name is empty", async () => {
			vi.mocked(input.ask).mockResolvedValueOnce("");
			const handler = registry.getAction("ai-tools:create");
			const result = await handler(mockCtx());
			expect(scaffoldAiTool).not.toHaveBeenCalled();
			expect(result).toBe("main");
		});

		it("cancels when run command is empty", async () => {
			vi.mocked(input.ask)
				.mockResolvedValueOnce("my-tool")
				.mockResolvedValueOnce("desc")
				.mockResolvedValueOnce("");
			const handler = registry.getAction("ai-tools:create");
			const result = await handler(mockCtx());
			expect(scaffoldAiTool).not.toHaveBeenCalled();
			expect(result).toBe("main");
		});

		it("uses default description when empty", async () => {
			vi.mocked(input.ask)
				.mockResolvedValueOnce("my-tool")
				.mockResolvedValueOnce("")
				.mockResolvedValueOnce("run-cmd");
			const handler = registry.getAction("ai-tools:create");
			await handler(mockCtx());
			expect(scaffoldAiTool).toHaveBeenCalledWith(
				expect.anything(), "/mock-vault", "my-tool", "An AI tool", "run-cmd", expect.anything(),
			);
		});

		it("logs error when scaffold returns error", async () => {
			vi.mocked(input.ask)
				.mockResolvedValueOnce("bad-tool")
				.mockResolvedValueOnce("desc")
				.mockResolvedValueOnce("cmd");
			vi.mocked(scaffoldAiTool).mockReturnValueOnce({ error: "already exists" } as any);
			const handler = registry.getAction("ai-tools:create");
			await handler(mockCtx());
			expect(mockDeps.log).toHaveBeenCalledWith(expect.stringContaining("already exists"));
		});
	});

	describe("ai-tools:reference", () => {
		it("generates and saves AI tool reference doc", async () => {
			const mockSave = vi.fn();
			vi.mocked(generateAiToolReference).mockReturnValueOnce({ save: mockSave } as any);
			const handler = registry.getAction("ai-tools:reference");
			await handler(mockCtx());
			expect(loadAiTools).toHaveBeenCalled();
			expect(generateAiToolReference).toHaveBeenCalled();
			expect(mockSave).toHaveBeenCalledWith(
				expect.stringContaining("AI Tool Reference.md"), expect.anything(),
			);
			expect(input.waitForEnter).toHaveBeenCalled();
		});

		it("returns 'main'", async () => {
			const handler = registry.getAction("ai-tools:reference");
			const result = await handler(mockCtx());
			expect(result).toBe("main");
		});
	});

	// ── Agents data source ──────────────────────────────────────────

	describe("agents:list data source", () => {
		it("returns empty array when no agents", () => {
			vi.mocked(listAgents).mockReturnValueOnce([]);
			const ds = registry.getDataSource("agents:list");
			const entries = ds(mockCtx());
			expect(entries).toEqual([]);
		});

		it("returns selectable entries for each agent", () => {
			vi.mocked(listAgents).mockReturnValueOnce([
				{ name: "Alice", agentType: "human", description: "Lead dev", skills: [], tools: [], roles: [], behaviors: [] },
				{ name: "GPT-4", agentType: "ai", description: "", skills: [], tools: [], roles: [], behaviors: [] },
			] as any);
			const ds = registry.getDataSource("agents:list");
			const entries = ds(mockCtx());
			expect(entries).toHaveLength(2);
			expect(entries[0]).toMatchObject({ key: "1", group: "agents" });
			expect(entries[0].label).toContain("Alice");
			expect(entries[1]).toMatchObject({ key: "2", group: "agents" });
			expect(entries[1].label).toContain("GPT-4");
		});

		it("entry action navigates to agent-detail", () => {
			vi.mocked(listAgents).mockReturnValueOnce([
				{ name: "Alice", agentType: "human", description: "", skills: [], tools: [], roles: [], behaviors: [] },
			] as any);
			const ds = registry.getDataSource("agents:list");
			const entries = ds(mockCtx());
			const result = entries[0].action();
			expect(result).toBe("navigate:agent-detail?{\"agentName\":\"Alice\"}");
		});
	});

	// ── Agent interaction handlers ──────────────────────────────────

	describe("agents:talk", () => {
		it("calls talkToAgentInteractive and persists state", async () => {
			const agent = { name: "Dev", agentType: "ai", description: "", skills: [], tools: [], roles: [] };
			vi.mocked(findAgent).mockReturnValueOnce(agent as any);
			const ctx = { ...mockCtx(), params: { agentName: "Dev" } } as unknown as RouterContext;
			const handler = registry.getAction("agents:talk");
			await handler(ctx);
			expect(talkToAgentInteractive).toHaveBeenCalled();
			expect(writeAgentState).toHaveBeenCalled();
		});

		it("returns undefined when no agentName param", async () => {
			const handler = registry.getAction("agents:talk");
			const result = await handler(mockCtx());
			expect(result).toBeUndefined();
		});

		it("returns undefined when agent not found", async () => {
			vi.mocked(findAgent).mockReturnValueOnce(undefined as any);
			const ctx = { ...mockCtx(), params: { agentName: "Missing" } } as unknown as RouterContext;
			const handler = registry.getAction("agents:talk");
			const result = await handler(ctx);
			expect(result).toBeUndefined();
			expect(talkToAgentInteractive).not.toHaveBeenCalled();
		});
	});

	describe("agents:assign-task", () => {
		it("calls assignTaskInteractive then runAgentAfterInteraction", async () => {
			const agent = { name: "Dev", agentType: "ai", description: "", skills: [], tools: [], roles: [] };
			vi.mocked(findAgent).mockReturnValueOnce(agent as any);
			vi.mocked(assignTaskInteractive).mockResolvedValueOnce({ taskName: "Build feature", taskDescription: "Build it", taskContext: "" });
			const ctx = { ...mockCtx(), params: { agentName: "Dev" } } as unknown as RouterContext;
			const handler = registry.getAction("agents:assign-task");
			await handler(ctx);
			expect(assignTaskInteractive).toHaveBeenCalled();
			expect(writeAgentState).toHaveBeenCalled();
		});

		it("triggers runAgentInteractive when project and iteration exist", async () => {
			const agent = { name: "Dev", agentType: "ai", description: "", skills: [], tools: [], roles: [] };
			vi.mocked(findAgent).mockReturnValueOnce(agent as any);
			vi.mocked(assignTaskInteractive).mockResolvedValueOnce({ taskName: "Build feature", taskDescription: "Build it", taskContext: "" });
			const iteration = { name: "Sprint 1", number: 1, status: "in-progress", file: "iter.md", startDate: "", endDate: "", goal: "", capacity: "", description: "", agents: [], resources: [], capacities: [], scopeItems: [] };
			// Called multiple times: buildTaskContext, persistInteraction, runAgentAfterInteraction
			vi.mocked(findCurrentIteration).mockReturnValue(iteration as any);
			const ctx = {
				deps: mockDeps,
				params: { agentName: "Dev" },
				project: { path: "/proj", config: { name: "Test", management: { iterations: { dir: "iterations" } } } },
			} as unknown as RouterContext;
			const handler = registry.getAction("agents:assign-task");
			await handler(ctx);
			expect(runAgentInteractive).toHaveBeenCalledWith(
				agent, iteration, "/proj/iterations", false, expect.anything(), expect.anything(), undefined,
			);
		});
	});

	// ── Agent status handler ────────────────────────────────────────

	describe("agent:status", () => {
		it("lists sessions and renders them", async () => {
			const ctx = {
				deps: mockDeps,
				project: { path: "/proj", config: { name: "Test", management: { iterations: { dir: "iterations" } } } },
			} as unknown as RouterContext;
			const handler = registry.getAction("agent:status");
			await handler(ctx);
			expect(listSessions).toHaveBeenCalled();
			expect(renderSessionList).toHaveBeenCalled();
			expect(input.waitForEnter).toHaveBeenCalled();
		});

		it("logs message when no project selected", async () => {
			const handler = registry.getAction("agent:status");
			await handler(mockCtx());
			expect(mockDeps.log).toHaveBeenCalledWith(expect.stringContaining("No project"));
		});
	});
});
