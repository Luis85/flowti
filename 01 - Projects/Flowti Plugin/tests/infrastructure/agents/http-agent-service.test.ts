import { describe, it, expect, vi, beforeEach } from "vitest";
import { HttpAgentService } from "../../../src/infrastructure/agents/http-agent-service";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function jsonResponse(data: unknown, status = 200) {
	return { ok: status >= 200 && status < 300, status, json: () => Promise.resolve(data) };
}

describe("HttpAgentService", () => {
	beforeEach(() => { mockFetch.mockReset(); });

	it("connect fetches world-state and populates agents", async () => {
		mockFetch.mockResolvedValueOnce(jsonResponse({
			entities: {
				atlas: { id: "atlas", type: "agent", components: {
					identity: { name: "atlas", persona: "Alice", mood: "cheerful" },
					stats: { int: 16, cha: 14 },
					status: { currentAction: "idle" },
				}},
			},
		}));
		const service = new HttpAgentService("http://localhost:3000");
		await service.connect();
		const agents = service.listAgents();
		expect(agents).toHaveLength(1);
		expect(agents[0].name).toBe("atlas");
		expect(agents[0].persona).toBe("Alice");
		expect(agents[0].activity).toBe("idle");
	});

	it("getAgent returns single agent", async () => {
		mockFetch.mockResolvedValueOnce(jsonResponse({
			entities: { atlas: { id: "atlas", type: "agent", components: {
				identity: { name: "atlas" }, status: { currentAction: "idle" },
			}}},
		}));
		const service = new HttpAgentService("http://localhost:3000");
		await service.connect();
		expect(service.getAgent("atlas")?.name).toBe("atlas");
		expect(service.getAgent("unknown")).toBeUndefined();
	});

	it("sendMessage posts to /api/agent/send", async () => {
		mockFetch
			.mockResolvedValueOnce(jsonResponse({ entities: {} }))
			.mockResolvedValueOnce(jsonResponse({ ok: true }));
		const service = new HttpAgentService("http://localhost:3000");
		await service.connect();
		await service.sendMessage("atlas", "hello", "conversational");
		expect(mockFetch).toHaveBeenCalledWith(
			"http://localhost:3000/api/agent/send",
			expect.objectContaining({
				method: "POST",
				body: JSON.stringify({ agentName: "atlas", message: "hello" }),
			}),
		);
	});

	it("sendMessage stores user turn in conversation", async () => {
		mockFetch
			.mockResolvedValueOnce(jsonResponse({ entities: {} }))
			.mockResolvedValueOnce(jsonResponse({ ok: true }));
		const service = new HttpAgentService("http://localhost:3000");
		await service.connect();
		await service.sendMessage("atlas", "hello", "conversational");
		const conv = service.getConversation("atlas");
		expect(conv).toHaveLength(1);
		expect(conv[0].role).toBe("user");
		expect(conv[0].content).toBe("hello");
	});

	it("onEvent registers callbacks and fires on status change", async () => {
		mockFetch.mockResolvedValueOnce(jsonResponse({
			entities: { atlas: { id: "atlas", type: "agent", components: {
				identity: { name: "atlas" }, status: { currentAction: "idle" },
			}}},
		})).mockResolvedValueOnce(jsonResponse({ ok: true }));
		const service = new HttpAgentService("http://localhost:3000");
		await service.connect();
		const events: unknown[] = [];
		service.onEvent((e) => events.push(e));
		await service.sendMessage("atlas", "hi", "conversational");
		expect(events.length).toBeGreaterThan(0);
		expect(events[0]).toEqual(expect.objectContaining({ kind: "status-changed" }));
	});

	it("disconnect clears agents", async () => {
		mockFetch.mockResolvedValueOnce(jsonResponse({ entities: {} }));
		const service = new HttpAgentService("http://localhost:3000");
		await service.connect();
		service.disconnect();
		expect(service.listAgents()).toHaveLength(0);
	});

	it("handleServerEvent processes speaking events", async () => {
		mockFetch.mockResolvedValueOnce(jsonResponse({
			entities: { atlas: { id: "atlas", type: "agent", components: {
				identity: { name: "atlas", persona: "Alice" }, status: { currentAction: "idle" },
			}}},
		}));
		const service = new HttpAgentService("http://localhost:3000");
		await service.connect();
		const events: unknown[] = [];
		service.onEvent((e) => events.push(e));
		service.handleServerEvent("agent-action", { agentName: "atlas", type: "speaking", text: "Hello!" });
		const msgEvent = events.find((e) => (e as Record<string, unknown>).kind === "message-received");
		expect(msgEvent).toBeDefined();
	});

	it("getTeamConversation returns all turns across agents", async () => {
		mockFetch
			.mockResolvedValueOnce(jsonResponse({ entities: {} }))
			.mockResolvedValueOnce(jsonResponse({ ok: true }));
		const service = new HttpAgentService("http://localhost:3000");
		await service.connect();
		await service.sendMessage("atlas", "hi", "conversational");
		expect(service.getTeamConversation()).toHaveLength(1);
	});

	it("sendMessage emits error and resets to idle on network failure", async () => {
		mockFetch
			.mockResolvedValueOnce(jsonResponse({
				entities: { atlas: { id: "atlas", type: "agent", components: {
					identity: { name: "atlas" }, status: { currentAction: "idle" },
				}}},
			}))
			.mockRejectedValueOnce(new Error("Network error"));
		const service = new HttpAgentService("http://localhost:3000");
		await service.connect();
		const events: Array<Record<string, unknown>> = [];
		service.onEvent((e) => events.push(e as unknown as Record<string, unknown>));
		await service.sendMessage("atlas", "hello", "conversational");
		const errorEvent = events.find((e) => e.kind === "error");
		expect(errorEvent).toBeDefined();
		expect(errorEvent?.error).toBe("Network error");
		expect(service.getAgent("atlas")?.activity).toBe("idle");
	});

	it("sendMessage emits error on non-OK response", async () => {
		mockFetch
			.mockResolvedValueOnce(jsonResponse({
				entities: { atlas: { id: "atlas", type: "agent", components: {
					identity: { name: "atlas" }, status: { currentAction: "idle" },
				}}},
			}))
			.mockResolvedValueOnce(jsonResponse({}, 500));
		const service = new HttpAgentService("http://localhost:3000");
		await service.connect();
		const events: Array<Record<string, unknown>> = [];
		service.onEvent((e) => events.push(e as unknown as Record<string, unknown>));
		await service.sendMessage("atlas", "hello", "conversational");
		const errorEvent = events.find((e) => e.kind === "error");
		expect(errorEvent).toBeDefined();
		expect(service.getAgent("atlas")?.activity).toBe("idle");
	});
});
