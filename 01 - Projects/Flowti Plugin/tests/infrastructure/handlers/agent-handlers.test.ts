// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import "../../../src/components/agents/flowti-agent-sidepanel.js";
import { mountAgentSidepanel } from "../../../src/infrastructure/handlers/agent-handlers.js";
import type { ICliExecutor, AgentProcess, CliEvent } from "../../../src/infrastructure/agents/cli-executor.js";
import type { IContextProvider, FileContext } from "../../../src/domain/agents/context-provider.js";

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

function createMockCliExecutor(agents: { name: string; status: string }[] = []) {
	const processes: ReturnType<typeof mockAgentProcess>[] = [];
	const executor: ICliExecutor = {
		startAgent: vi.fn((name: string) => {
			const proc = mockAgentProcess(name);
			processes.push(proc);
			return proc;
		}),
		assignTask: vi.fn(async () => ({ ok: true })),
		grantPermission: vi.fn(async () => ({ ok: true })),
		listAgents: vi.fn(async () => agents),
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

	it("sets agents from cliExecutor.listAgents()", async () => {
		const agents = [{ name: "atlas", status: "idle" }];
		const { executor } = createMockCliExecutor(agents);
		mountAgentSidepanel(container, { eventBus: mockEventBus(), cliExecutor: executor });
		// listAgents is async — wait for the microtask
		await vi.waitFor(() => {
			const el = container.querySelector("flowti-agent-sidepanel") as HTMLElement & Record<string, unknown>;
			expect(el.agents).toEqual(agents);
		});
	});

	it("dispose removes element", () => {
		const dispose = mountAgentSidepanel(container, { eventBus: mockEventBus(), cliExecutor: createMockCliExecutor().executor });
		dispose();
		expect(container.querySelector("flowti-agent-sidepanel")).toBeNull();
	});

	it("sets activeAgent to first agent when none selected", async () => {
		const agents = [{ name: "atlas", status: "idle" }];
		const { executor } = createMockCliExecutor(agents);
		mountAgentSidepanel(container, { eventBus: mockEventBus(), cliExecutor: executor });
		await vi.waitFor(() => {
			const el = container.querySelector("flowti-agent-sidepanel") as HTMLElement & Record<string, unknown>;
			expect(el.activeAgent).toBe("atlas");
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
		const agents = [{ name: "atlas", status: "thinking" }];
		const { executor, processes } = createMockCliExecutor(agents);
		mountAgentSidepanel(container, { eventBus: mockEventBus(), cliExecutor: executor });

		// Wait for agent list to populate so activeAgent is set
		await vi.waitFor(() => {
			const el = container.querySelector("flowti-agent-sidepanel") as HTMLElement & Record<string, unknown>;
			expect(el.activeAgent).toBe("atlas");
		});

		// Send a message to create a process
		const el = container.querySelector("flowti-agent-sidepanel") as HTMLElement & Record<string, unknown>;
		el.dispatchEvent(new CustomEvent("agent-send", { detail: { message: "hello" }, bubbles: true, composed: true }));
		expect(processes.length).toBe(1);

		// Now stop
		el.dispatchEvent(new CustomEvent("agent-stop", { bubbles: true, composed: true }));
		expect(processes[0].stopGeneration).toHaveBeenCalled();
	});

	it("enriches message with context diff when provider available", async () => {
		const agents = [{ name: "atlas", status: "idle" }];
		const { executor, processes } = createMockCliExecutor(agents);
		const ctx = mockContextProvider();
		mountAgentSidepanel(container, { eventBus: mockEventBus(), cliExecutor: executor, contextProvider: ctx });

		// Wait for agent list to populate
		await vi.waitFor(() => {
			const el = container.querySelector("flowti-agent-sidepanel") as HTMLElement & Record<string, unknown>;
			expect(el.activeAgent).toBe("atlas");
		});

		const el = container.querySelector("flowti-agent-sidepanel") as HTMLElement;
		el.dispatchEvent(new CustomEvent("agent-send", { detail: { message: "explain this" }, bubbles: true, composed: true }));
		expect(processes.length).toBe(1);
		expect(processes[0].send).toHaveBeenCalledWith(
			expect.stringContaining("+new line"),
		);
	});

	it("Escape key stops generation when processing", async () => {
		const agents = [{ name: "atlas", status: "thinking" }];
		const { executor, processes } = createMockCliExecutor(agents);
		mountAgentSidepanel(container, { eventBus: mockEventBus(), cliExecutor: executor });

		// Wait for agent list
		await vi.waitFor(() => {
			const el = container.querySelector("flowti-agent-sidepanel") as HTMLElement & Record<string, unknown>;
			expect(el.activeAgent).toBe("atlas");
		});

		// Send a message to create a process
		const el = container.querySelector("flowti-agent-sidepanel") as HTMLElement & Record<string, unknown>;
		el.dispatchEvent(new CustomEvent("agent-send", { detail: { message: "test" }, bubbles: true, composed: true }));
		expect(processes.length).toBe(1);

		el.processing = true;
		container.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
		expect(processes[0].stopGeneration).toHaveBeenCalled();
	});
});
