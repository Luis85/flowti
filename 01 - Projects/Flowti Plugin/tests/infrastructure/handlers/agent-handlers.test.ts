// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "../../../src/components/agents/flowti-agent-sidepanel.js";
import { mountAgentSidepanel } from "../../../src/infrastructure/handlers/agent-handlers";
import type { IAgentService, AgentCard } from "../../../src/domain/agents/types";

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

describe("mountAgentSidepanel", () => {
	let container: HTMLElement;

	beforeEach(() => {
		container = document.createElement("div");
		document.body.appendChild(container);
	});

	it("mounts flowti-agent-sidepanel element into container", () => {
		const dispose = mountAgentSidepanel(container, { eventBus: mockEventBus(), agentService: mockService() });
		expect(container.querySelector("flowti-agent-sidepanel")).toBeTruthy();
		dispose();
	});

	it("sets agents property from service", () => {
		const agents: AgentCard[] = [{ name: "atlas", activity: "idle", persona: "Alice" }];
		const dispose = mountAgentSidepanel(container, { eventBus: mockEventBus(), agentService: mockService(agents) });
		const el = container.querySelector("flowti-agent-sidepanel") as HTMLElement & Record<string, unknown>;
		expect(el.agents).toEqual(agents);
		dispose();
	});

	it("dispose removes element", () => {
		const dispose = mountAgentSidepanel(container, { eventBus: mockEventBus(), agentService: mockService() });
		dispose();
		expect(container.querySelector("flowti-agent-sidepanel")).toBeNull();
	});

	it("sets activeAgent to first agent when none selected", () => {
		const agents: AgentCard[] = [{ name: "atlas", activity: "idle" }, { name: "bob", activity: "idle" }];
		const dispose = mountAgentSidepanel(container, { eventBus: mockEventBus(), agentService: mockService(agents) });
		const el = container.querySelector("flowti-agent-sidepanel") as HTMLElement & Record<string, unknown>;
		expect(el.activeAgent).toBe("atlas");
		dispose();
	});
});
