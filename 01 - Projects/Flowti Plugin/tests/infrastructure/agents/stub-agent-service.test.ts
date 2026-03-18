import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { StubAgentService } from "../../../src/infrastructure/agents/stub-agent-service.js";
import type { AgentServiceEvent } from "../../../src/domain/agents/types.js";

describe("StubAgentService", () => {
	let service: StubAgentService;

	beforeEach(() => {
		vi.useFakeTimers();
		service = new StubAgentService();
	});

	afterEach(() => {
		service.disconnect();
		vi.useRealTimers();
	});

	describe("connect", () => {
		it("populates a roster of 3 agents", async () => {
			await service.connect();
			const agents = service.listAgents();
			expect(agents).toHaveLength(3);
		});

		it("has atlas with correct stats", async () => {
			await service.connect();
			const atlas = service.getAgent("atlas");
			expect(atlas).toBeDefined();
			expect(atlas?.persona).toBe("Alice");
			expect(atlas?.mood).toBe("cheerful");
			expect(atlas?.intStat).toBe(16);
			expect(atlas?.chaStat).toBe(14);
			expect(atlas?.activity).toBe("idle");
		});

		it("has scout with correct stats", async () => {
			await service.connect();
			const scout = service.getAgent("scout");
			expect(scout).toBeDefined();
			expect(scout?.persona).toBe("Bob");
			expect(scout?.mood).toBe("focused");
			expect(scout?.intStat).toBe(12);
			expect(scout?.chaStat).toBe(16);
		});

		it("has sage with correct stats", async () => {
			await service.connect();
			const sage = service.getAgent("sage");
			expect(sage).toBeDefined();
			expect(sage?.persona).toBe("Carol");
			expect(sage?.mood).toBe("calm");
			expect(sage?.intStat).toBe(18);
			expect(sage?.chaStat).toBe(10);
		});
	});

	describe("sendMessage", () => {
		it("stores user turn in conversation", async () => {
			await service.connect();
			const promise = service.sendMessage("atlas", "hello", "conversational");
			const conv = service.getConversation("atlas");
			expect(conv).toHaveLength(1);
			expect(conv[0].role).toBe("user");
			expect(conv[0].content).toBe("hello");
			expect(conv[0].mode).toBe("conversational");
			await vi.advanceTimersByTimeAsync(2000);
			await promise;
		});

		it("sets activity to thinking immediately", async () => {
			await service.connect();
			const promise = service.sendMessage("atlas", "hello", "conversational");
			expect(service.getAgent("atlas")?.activity).toBe("thinking");
			await vi.advanceTimersByTimeAsync(2000);
			await promise;
		});

		it("generates agent response after delay", async () => {
			await service.connect();
			const promise = service.sendMessage("atlas", "hello", "conversational");
			await vi.advanceTimersByTimeAsync(2000);
			await promise;
			const conv = service.getConversation("atlas");
			expect(conv).toHaveLength(2);
			expect(conv[1].role).toBe("agent");
			expect(conv[1].agentName).toBe("atlas");
			expect(conv[1].content).toBe("[stub] Echo: hello");
		});

		it("resets activity to idle after response", async () => {
			await service.connect();
			const promise = service.sendMessage("atlas", "hello", "conversational");
			await vi.advanceTimersByTimeAsync(2000);
			await promise;
			expect(service.getAgent("atlas")?.activity).toBe("idle");
		});
	});

	describe("stopGeneration", () => {
		it("cancels pending response", async () => {
			await service.connect();
			const promise = service.sendMessage("atlas", "hello", "conversational");
			await service.stopGeneration("atlas");
			await vi.advanceTimersByTimeAsync(2000);
			await promise;
			const conv = service.getConversation("atlas");
			// Only the user turn should exist, no agent response
			expect(conv).toHaveLength(1);
			expect(conv[0].role).toBe("user");
		});

		it("resets activity to idle", async () => {
			await service.connect();
			const promise = service.sendMessage("atlas", "hello", "conversational");
			expect(service.getAgent("atlas")?.activity).toBe("thinking");
			await service.stopGeneration("atlas");
			expect(service.getAgent("atlas")?.activity).toBe("idle");
			await vi.advanceTimersByTimeAsync(2000);
			await promise;
		});
	});

	describe("onEvent", () => {
		it("fires status-changed when sending message", async () => {
			await service.connect();
			const events: AgentServiceEvent[] = [];
			service.onEvent((e) => events.push(e));
			const promise = service.sendMessage("atlas", "hello", "conversational");
			const statusChanged = events.find(
				(e) => e.kind === "status-changed" && e.activity === "thinking",
			);
			expect(statusChanged).toBeDefined();
			await vi.advanceTimersByTimeAsync(2000);
			await promise;
		});

		it("fires message-received after delay", async () => {
			await service.connect();
			const events: AgentServiceEvent[] = [];
			service.onEvent((e) => events.push(e));
			const promise = service.sendMessage("atlas", "hello", "conversational");
			await vi.advanceTimersByTimeAsync(2000);
			await promise;
			const messageReceived = events.find((e) => e.kind === "message-received");
			expect(messageReceived).toBeDefined();
			if (messageReceived?.kind === "message-received") {
				expect(messageReceived.turn.content).toBe("[stub] Echo: hello");
			}
		});

		it("fires status-changed back to idle after response", async () => {
			await service.connect();
			const events: AgentServiceEvent[] = [];
			service.onEvent((e) => events.push(e));
			const promise = service.sendMessage("atlas", "hello", "conversational");
			await vi.advanceTimersByTimeAsync(2000);
			await promise;
			const idleEvents = events.filter(
				(e) => e.kind === "status-changed" && e.activity === "idle",
			);
			expect(idleEvents.length).toBeGreaterThan(0);
		});

		it("unsubscribe stops receiving events", async () => {
			await service.connect();
			const events: AgentServiceEvent[] = [];
			const unsub = service.onEvent((e) => events.push(e));
			unsub();
			const promise = service.sendMessage("atlas", "hello", "conversational");
			await vi.advanceTimersByTimeAsync(2000);
			await promise;
			expect(events).toHaveLength(0);
		});
	});

	describe("getTeamConversation", () => {
		it("aggregates turns across agents", async () => {
			await service.connect();
			const p1 = service.sendMessage("atlas", "hello from atlas", "conversational");
			const p2 = service.sendMessage("scout", "hello from scout", "conversational");
			await vi.advanceTimersByTimeAsync(2000);
			await Promise.all([p1, p2]);
			const team = service.getTeamConversation();
			// 2 user turns + 2 agent turns
			expect(team).toHaveLength(4);
			const agentNames = team
				.filter((t) => t.role === "user")
				.map((t) => t.agentName);
			expect(agentNames).toContain("atlas");
			expect(agentNames).toContain("scout");
		});
	});

	describe("disconnect", () => {
		it("clears agents and conversations", async () => {
			await service.connect();
			const promise = service.sendMessage("atlas", "hello", "conversational");
			await vi.advanceTimersByTimeAsync(2000);
			await promise;
			service.disconnect();
			expect(service.listAgents()).toHaveLength(0);
			expect(service.getConversation("atlas")).toHaveLength(0);
			expect(service.getTeamConversation()).toHaveLength(0);
		});

		it("getAgent returns undefined after disconnect", async () => {
			await service.connect();
			service.disconnect();
			expect(service.getAgent("atlas")).toBeUndefined();
		});
	});
});
