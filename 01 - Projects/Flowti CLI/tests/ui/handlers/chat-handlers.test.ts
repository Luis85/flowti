import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/infrastructure/filesystem.js", () => ({ disk: {} }));
vi.mock("../../../src/infrastructure/shell.js", () => ({ shell: {} }));
vi.mock("../../../src/infrastructure/paths.js", () => ({ paths: {} }));
vi.mock("../../../src/infrastructure/clock.js", () => ({ clock: {} }));
vi.mock("../../../src/infrastructure/logger.js", () => ({ log: vi.fn() }));
vi.mock("../../../src/infrastructure/config.js", () => ({
	VAULT_ROOT: "/vault",
	cliConfig: { agents: { dir: "03 - Resources/Agents" } },
}));

vi.mock("../../../src/domain/agents/agent-store.js", () => ({
	findAgent: vi.fn(),
	agentStore: { list: vi.fn(() => []) },
}));

const mockStart = vi.fn(async () => "main");

vi.mock("../../../src/ui/menus/chat-shell.js", () => {
	const MockChatShell = vi.fn(function (this: { start: typeof mockStart }) { this.start = mockStart; });
	return { ChatShell: MockChatShell };
});

const MockRenderer = vi.fn(function () { /* empty constructor */ });
const mockLoadRenderer = vi.fn(async () => ({ InkChatRenderer: MockRenderer }));

import { HandlerRegistry } from "../../../src/infrastructure/handler-registry.js";
import { registerChatHandlers } from "../../../src/ui/handlers/chat-handlers.js";
import { findAgent } from "../../../src/domain/agents/agent-store.js";
import { ChatShell } from "../../../src/ui/menus/chat-shell.js";
import type { CliDeps } from "../../../src/infrastructure/deps.js";

function makeDeps(): CliDeps {
	return {
		disk: { existsSync: vi.fn(() => false), readFileSync: vi.fn(), writeFileSync: vi.fn() } as never,
		paths: { join: vi.fn((...a: string[]) => a.join("/")), resolve: vi.fn((...a: string[]) => a.join("/")) } as never,
		clock: { ms: vi.fn(() => 0), iso: vi.fn(() => "") } as never,
		shell: { check: vi.fn() } as never,
		proc: {} as never,
		input: {} as never,
		bus: {} as never,
		log: vi.fn(),
		warn: vi.fn(),
		worldState: {} as never,
		workerManager: {} as never,
		processRunner: { spawn: vi.fn() } as never,
	};
}

describe("registerChatHandlers", () => {
	let registry: HandlerRegistry;

	beforeEach(() => {
		vi.clearAllMocks();
		registry = new HandlerRegistry();
		registerChatHandlers(registry, mockLoadRenderer);
	});

	it("registers a view handler for agents-chat", () => {
		expect(registry.hasView("agents-chat")).toBe(true);
	});

	it("returns 'main' when agentName param is missing", async () => {
		const handler = registry.getView("agents-chat")!;
		const result = await handler({
			deps: makeDeps(),
			params: {},
			dataSourceEntries: [],
		} as never);
		expect(result).toBe("main");
	});

	it("returns 'main' when agent is not found", async () => {
		(findAgent as ReturnType<typeof vi.fn>).mockReturnValue(null);
		const handler = registry.getView("agents-chat")!;
		const deps = makeDeps();
		const result = await handler({
			deps,
			params: { agentName: "Unknown" },
			dataSourceEntries: [],
		} as never);
		expect(result).toBe("main");
		expect(deps.log).toHaveBeenCalledWith(expect.stringContaining("Unknown"));
	});

	it("creates InkChatRenderer and ChatShell when agent exists", async () => {
		const agent = { name: "Atlas", agentType: "ai", description: "Architect", skills: [], tools: [], roles: [], file: "atlas.md" };
		(findAgent as ReturnType<typeof vi.fn>).mockReturnValue(agent);
		const handler = registry.getView("agents-chat")!;
		const deps = makeDeps();
		const result = await handler({
			deps,
			params: { agentName: "Atlas" },
			project: { path: "/project" },
			dataSourceEntries: [],
		} as never);

		expect(mockLoadRenderer).toHaveBeenCalled();
		expect(MockRenderer).toHaveBeenCalled();
		expect(ChatShell).toHaveBeenCalledWith(
			expect.anything(),
			agent,
			expect.objectContaining({ disk: deps.disk }),
			"/vault",
			"/project",
		);
		expect(mockStart).toHaveBeenCalled();
		expect(result).toBe("main");
	});

	it("falls back to VAULT_ROOT when project is not set", async () => {
		const agent = { name: "Dev", agentType: "ai", description: "Dev", skills: [], tools: [], roles: [], file: "dev.md" };
		(findAgent as ReturnType<typeof vi.fn>).mockReturnValue(agent);
		const handler = registry.getView("agents-chat")!;
		const deps = makeDeps();
		await handler({
			deps,
			params: { agentName: "Dev" },
			dataSourceEntries: [],
		} as never);

		expect(ChatShell).toHaveBeenCalledWith(
			expect.anything(),
			agent,
			expect.anything(),
			"/vault",
			"/vault",
		);
	});
});
