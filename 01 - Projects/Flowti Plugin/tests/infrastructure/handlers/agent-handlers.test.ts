// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import "../../../src/components/agents/flowti-agent-sidepanel.js";
import { mountAgentSidepanel } from "../../../src/infrastructure/handlers/agent-handlers.js";
import type { IAgentService, AgentCard } from "../../../src/domain/agents/types.js";
import type { IContextProvider, FileContext } from "../../../src/domain/agents/context-provider.js";

function mockService(agents: AgentCard[] = []): IAgentService {
	return {
		listAgents: () => agents,
		getAgent: (n) => agents.find((a) => a.name === n),
		sendMessage: vi.fn(async () => {}),
		stopGeneration: vi.fn(async () => {}),
		getConversation: () => [],
		getTeamConversation: () => [],
		onEvent: vi.fn(() => () => {}),
		connect: vi.fn(async () => {}),
		disconnect: vi.fn(),
	};
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
		const dispose = mountAgentSidepanel(container, { eventBus: mockEventBus(), agentService: mockService() });
		expect(container.querySelector("flowti-agent-sidepanel")).toBeTruthy();
		dispose();
	});

	it("sets agents property from service", () => {
		const agents: AgentCard[] = [{ name: "atlas", activity: "idle", persona: "Alice" }];
		mountAgentSidepanel(container, { eventBus: mockEventBus(), agentService: mockService(agents) });
		const el = container.querySelector("flowti-agent-sidepanel") as HTMLElement & Record<string, unknown>;
		expect(el.agents).toEqual(agents);
	});

	it("dispose removes element", () => {
		const dispose = mountAgentSidepanel(container, { eventBus: mockEventBus(), agentService: mockService() });
		dispose();
		expect(container.querySelector("flowti-agent-sidepanel")).toBeNull();
	});

	it("sets activeAgent to first agent when none selected", () => {
		const agents: AgentCard[] = [{ name: "atlas", activity: "idle" }];
		mountAgentSidepanel(container, { eventBus: mockEventBus(), agentService: mockService(agents) });
		const el = container.querySelector("flowti-agent-sidepanel") as HTMLElement & Record<string, unknown>;
		expect(el.activeAgent).toBe("atlas");
	});

	it("handles team-toggled event", () => {
		const bus = mockEventBus();
		const agents: AgentCard[] = [{ name: "atlas", activity: "idle" }];
		mountAgentSidepanel(container, { eventBus: bus, agentService: mockService(agents) });
		const el = container.querySelector("flowti-agent-sidepanel") as HTMLElement;
		el.dispatchEvent(new CustomEvent("team-toggled", { detail: { enabled: true }, bubbles: true, composed: true }));
		expect(bus.emit).toHaveBeenCalledWith("agent.team.toggled", { enabled: true });
	});

	it("handles agent-stop event", () => {
		const service = mockService([{ name: "atlas", activity: "thinking" }]);
		mountAgentSidepanel(container, { eventBus: mockEventBus(), agentService: service });
		const el = container.querySelector("flowti-agent-sidepanel") as HTMLElement;
		el.dispatchEvent(new CustomEvent("agent-stop", { bubbles: true, composed: true }));
		expect(service.stopGeneration).toHaveBeenCalledWith("atlas");
	});

	it("enriches message with context diff when provider available", () => {
		const service = mockService([{ name: "atlas", activity: "idle" }]);
		const ctx = mockContextProvider();
		mountAgentSidepanel(container, { eventBus: mockEventBus(), agentService: service, contextProvider: ctx });
		const el = container.querySelector("flowti-agent-sidepanel") as HTMLElement;
		el.dispatchEvent(new CustomEvent("agent-send", { detail: { message: "explain this" }, bubbles: true, composed: true }));
		expect(service.sendMessage).toHaveBeenCalledWith(
			"atlas",
			expect.stringContaining("+new line"),
			"conversational",
		);
	});

	it("Escape key stops generation when processing", () => {
		const service = mockService([{ name: "atlas", activity: "thinking" }]);
		mountAgentSidepanel(container, { eventBus: mockEventBus(), agentService: service });
		const el = container.querySelector("flowti-agent-sidepanel") as HTMLElement & Record<string, unknown>;
		el.processing = true;
		container.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
		expect(service.stopGeneration).toHaveBeenCalledWith("atlas");
	});
});
