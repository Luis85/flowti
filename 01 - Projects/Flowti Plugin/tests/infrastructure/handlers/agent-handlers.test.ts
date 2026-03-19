// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import "../../../src/components/agents/flowti-agent-sidepanel.js";
import { mountAgentSidepanel, parseSuggestedTask } from "../../../src/infrastructure/handlers/agent-handlers.js";
import type { ICliExecutor, AgentProcess, CliEvent } from "../../../src/infrastructure/agents/cli-executor.js";
import type { IContextProvider, FileContext } from "../../../src/domain/agents/context-provider.js";
import type { VaultFileAdapter } from "../../../src/infrastructure/handlers/agent-handlers.js";

function mockAgentProcess(agentName: string): AgentProcess & { _triggerEvent: (e: CliEvent) => void } {
	const callbacks = new Set<(event: CliEvent) => void>();
	return {
		agentName,
		running: true,
		send: vi.fn(),
		onEvent: vi.fn((cb: (event: CliEvent) => void) => {
			callbacks.add(cb);
			return () => { callbacks.delete(cb); };
		}),
		replayFrom: vi.fn(() => []),
		stopGeneration: vi.fn(),
		grantPermission: vi.fn(),
		kill: vi.fn(),
		_triggerEvent(e: CliEvent) {
			for (const cb of callbacks) cb(e);
		},
	};
}

function createMockCliExecutor() {
	const processes: ReturnType<typeof mockAgentProcess>[] = [];
	const executor: ICliExecutor = {
		startAgent: vi.fn((name: string) => {
			const proc = mockAgentProcess(name);
			processes.push(proc);
			return proc;
		}),
		assignTask: vi.fn(async () => ({ ok: true })),
		grantPermission: vi.fn(async () => ({ ok: true })),
		listAgents: vi.fn(async () => []),
		wakeAgent: vi.fn(async () => ({ ok: true })),
		killAll: vi.fn(),
		dispose: vi.fn(),
	};
	return { executor, processes };
}

function mockEventBus() {
	return { emit: vi.fn(async () => {}), on: vi.fn(() => () => {}), off: vi.fn() } as never;
}

function mockContextProvider(): IContextProvider {
	return {
		getActiveFileContext: vi.fn(() => ({ path: "test.md", contentHash: "abc", content: "hello" }) as FileContext),
		getDiff: vi.fn(() => ({ path: "test.md", previousHash: "old", currentHash: "abc", diff: "+new line" })),
		onFileChanged: vi.fn(() => () => {}),
		dispose: vi.fn(),
	};
}

const ATLAS_MD = `---
type: Agent
name: Atlas
agentType: ai
persona: "[[Atlas]]"
domain: orchestration
attributes:
  str: 10
  int: 18
  wis: 16
  cha: 14
  dex: 12
  con: 14
mood: focused
---

# Atlas
`;

function mockVaultAdapter(files: Record<string, string> = {}): VaultFileAdapter {
	return {
		list: vi.fn(async () => ({
			files: Object.keys(files),
			folders: [],
		})),
		read: vi.fn(async (path: string) => {
			if (path in files) return files[path];
			throw new Error(`File not found: ${path}`);
		}),
	};
}

describe("mountAgentSidepanel", () => {
	let container: HTMLElement;

	beforeEach(() => {
		container = document.createElement("div");
		document.body.appendChild(container);
	});

	afterEach(() => { container.remove(); });

	it("mounts flowti-agent-sidepanel element into container", () => {
		const dispose = mountAgentSidepanel(container, { eventBus: mockEventBus(), cliExecutor: createMockCliExecutor().executor });
		expect(container.querySelector("flowti-agent-sidepanel")).toBeTruthy();
		dispose();
	});

	it("loads agents from vault adapter", async () => {
		const adapter = mockVaultAdapter({
			"03 - Resources/Agents/atlas.md": ATLAS_MD,
		});
		mountAgentSidepanel(container, {
			eventBus: mockEventBus(),
			cliExecutor: createMockCliExecutor().executor,
			vaultAdapter: adapter,
			agentsDir: "03 - Resources/Agents",
		});
		await vi.waitFor(() => {
			const el = container.querySelector("flowti-agent-sidepanel") as HTMLElement & Record<string, unknown>;
			const agents = el.agents as { name: string }[];
			expect(agents.length).toBe(1);
			expect(agents[0].name).toBe("Atlas");
		});
	});

	it("dispose removes element", () => {
		const dispose = mountAgentSidepanel(container, { eventBus: mockEventBus(), cliExecutor: createMockCliExecutor().executor });
		dispose();
		expect(container.querySelector("flowti-agent-sidepanel")).toBeNull();
	});

	it("sets activeAgent to first agent when none selected", async () => {
		const adapter = mockVaultAdapter({
			"03 - Resources/Agents/atlas.md": ATLAS_MD,
		});
		mountAgentSidepanel(container, {
			eventBus: mockEventBus(),
			cliExecutor: createMockCliExecutor().executor,
			vaultAdapter: adapter,
			agentsDir: "03 - Resources/Agents",
		});
		await vi.waitFor(() => {
			const el = container.querySelector("flowti-agent-sidepanel") as HTMLElement & Record<string, unknown>;
			expect(el.activeAgent).toBe("Atlas");
		});
	});

	it("handles team-toggled event", () => {
		const bus = mockEventBus();
		mountAgentSidepanel(container, { eventBus: bus, cliExecutor: createMockCliExecutor().executor });
		const el = container.querySelector("flowti-agent-sidepanel") as HTMLElement;
		el.dispatchEvent(new CustomEvent("team-toggled", { detail: { enabled: true }, bubbles: true, composed: true }));
		expect((bus as unknown as { emit: ReturnType<typeof vi.fn> }).emit).toHaveBeenCalledWith("agent.team.toggled", { enabled: true });
	});

	it("handles agent-stop event by calling process.stopGeneration()", async () => {
		const adapter = mockVaultAdapter({
			"03 - Resources/Agents/atlas.md": ATLAS_MD,
		});
		const { executor, processes } = createMockCliExecutor();
		mountAgentSidepanel(container, {
			eventBus: mockEventBus(),
			cliExecutor: executor,
			vaultAdapter: adapter,
			agentsDir: "03 - Resources/Agents",
		});

		await vi.waitFor(() => {
			const el = container.querySelector("flowti-agent-sidepanel") as HTMLElement & Record<string, unknown>;
			expect(el.activeAgent).toBe("Atlas");
		});

		const el = container.querySelector("flowti-agent-sidepanel") as HTMLElement & Record<string, unknown>;
		el.dispatchEvent(new CustomEvent("agent-send", { detail: { message: "hello" }, bubbles: true, composed: true }));
		expect(processes.length).toBe(1);

		el.dispatchEvent(new CustomEvent("agent-stop", { bubbles: true, composed: true }));
		expect(processes[0].stopGeneration).toHaveBeenCalled();
	});

	it("enriches message with context diff when provider available", async () => {
		const adapter = mockVaultAdapter({
			"03 - Resources/Agents/atlas.md": ATLAS_MD,
		});
		const { executor, processes } = createMockCliExecutor();
		const ctx = mockContextProvider();
		mountAgentSidepanel(container, {
			eventBus: mockEventBus(),
			cliExecutor: executor,
			contextProvider: ctx,
			vaultAdapter: adapter,
			agentsDir: "03 - Resources/Agents",
		});

		await vi.waitFor(() => {
			const el = container.querySelector("flowti-agent-sidepanel") as HTMLElement & Record<string, unknown>;
			expect(el.activeAgent).toBe("Atlas");
		});

		const el = container.querySelector("flowti-agent-sidepanel") as HTMLElement;
		el.dispatchEvent(new CustomEvent("agent-send", { detail: { message: "explain this" }, bubbles: true, composed: true }));
		expect(processes.length).toBe(1);
		expect(processes[0].send).toHaveBeenCalledWith(
			expect.stringContaining("+new line"),
		);
	});

	it("Escape key stops generation when processing", async () => {
		const adapter = mockVaultAdapter({
			"03 - Resources/Agents/atlas.md": ATLAS_MD,
		});
		const { executor, processes } = createMockCliExecutor();
		mountAgentSidepanel(container, {
			eventBus: mockEventBus(),
			cliExecutor: executor,
			vaultAdapter: adapter,
			agentsDir: "03 - Resources/Agents",
		});

		await vi.waitFor(() => {
			const el = container.querySelector("flowti-agent-sidepanel") as HTMLElement & Record<string, unknown>;
			expect(el.activeAgent).toBe("Atlas");
		});

		const el = container.querySelector("flowti-agent-sidepanel") as HTMLElement & Record<string, unknown>;
		el.dispatchEvent(new CustomEvent("agent-send", { detail: { message: "test" }, bubbles: true, composed: true }));
		expect(processes.length).toBe(1);

		el.processing = true;
		container.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
		expect(processes[0].stopGeneration).toHaveBeenCalled();
	});

	it("parses persona, mood, and attributes from frontmatter", async () => {
		const adapter = mockVaultAdapter({
			"03 - Resources/Agents/atlas.md": ATLAS_MD,
		});
		mountAgentSidepanel(container, {
			eventBus: mockEventBus(),
			vaultAdapter: adapter,
			agentsDir: "03 - Resources/Agents",
		});
		await vi.waitFor(() => {
			const el = container.querySelector("flowti-agent-sidepanel") as HTMLElement & Record<string, unknown>;
			const agents = el.agents as { name: string; persona?: string; mood?: string; intStat?: number; chaStat?: number }[];
			expect(agents[0]).toEqual(expect.objectContaining({
				name: "Atlas",
				persona: "Atlas",
				mood: "focused",
				intStat: 18,
				chaStat: 14,
			}));
		});
	});

	it("skips non-Agent markdown files", async () => {
		const adapter = mockVaultAdapter({
			"agents/atlas.md": ATLAS_MD,
			"agents/notes.md": "---\ntype: Note\ntitle: Random\n---\n\nNot an agent.",
			"agents/atlas.prompt.md": "prompt content",
		});
		mountAgentSidepanel(container, {
			eventBus: mockEventBus(),
			vaultAdapter: adapter,
			agentsDir: "agents",
		});
		await vi.waitFor(() => {
			const el = container.querySelector("flowti-agent-sidepanel") as HTMLElement & Record<string, unknown>;
			const agents = el.agents as { name: string }[];
			expect(agents.length).toBe(1);
			expect(agents[0].name).toBe("Atlas");
		});
	});
});

describe("parseSuggestedTask", () => {
	it("parses a simple task with name only", () => {
		const result = parseSuggestedTask("Run tests");
		expect(result).toEqual({ name: "Run tests", phases: [] });
	});

	it("parses a task with phases", () => {
		const result = parseSuggestedTask("Run tests|ready,active");
		expect(result).toEqual({ name: "Run tests", phases: ["ready", "active"] });
	});

	it("parses a task with a tool segment", () => {
		const result = parseSuggestedTask("Run tests|any|tool:flowti test");
		expect(result).toEqual({ name: "Run tests", phases: ["any"], tool: { command: "flowti test" } });
	});

	it("parses a task with an input segment", () => {
		const result = parseSuggestedTask("Review code|ready|input:text:Which file?");
		expect(result).toEqual({ name: "Review code", phases: ["ready"], input: { type: "text", prompt: "Which file?" } });
	});

	it("parses suggestedTasks with input and tool segments", () => {
		const task1 = parseSuggestedTask("Run tests|any|tool:flowti test");
		const task2 = parseSuggestedTask("Review code|ready|input:text:Which file?");
		const tasks = [task1, task2];

		expect(tasks).toHaveLength(2);
		expect(tasks[0].tool).toEqual({ command: "flowti test" });
		expect(tasks[1].input).toEqual({ type: "text", prompt: "Which file?" });
	});

	it("parses a task with both input and tool segments", () => {
		const result = parseSuggestedTask("Deploy|release|input:text:Target env?|tool:flowti deploy");
		expect(result).toEqual({
			name: "Deploy",
			phases: ["release"],
			input: { type: "text", prompt: "Target env?" },
			tool: { command: "flowti deploy" },
		});
	});

	it("omits input and tool when not present", () => {
		const result = parseSuggestedTask("Simple task|planning");
		expect(result.input).toBeUndefined();
		expect(result.tool).toBeUndefined();
	});
});
