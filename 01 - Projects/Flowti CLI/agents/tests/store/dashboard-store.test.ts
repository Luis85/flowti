import { describe, it, expect, vi } from "vitest";
import { DashboardStore } from "../../src/store/dashboard-store.js";
import type { DashboardAgent } from "../../src/data/types.js";

const agent = (name: string, status: "idle" | "busy" = "idle"): DashboardAgent => ({
	name,
	agentType: "autonomous",
	status,
});

describe("DashboardStore", () => {
	it("dispatches state-changed on agent update", () => {
		const store = new DashboardStore();
		const handler = vi.fn();
		store.addEventListener("state-changed", handler);

		store.setAgents([agent("Alice")]);

		expect(handler).toHaveBeenCalledTimes(1);
		expect(store.agents).toHaveLength(1);
		expect(store.agents[0].name).toBe("Alice");
	});

	it("tracks selected agent", () => {
		const store = new DashboardStore();
		expect(store.selectedAgent).toBeNull();

		store.selectAgent("Bob");
		expect(store.selectedAgent).toBe("Bob");

		store.selectAgent(null);
		expect(store.selectedAgent).toBeNull();
	});

	it("manages conversations: push user message → thinking → push agent response", () => {
		const store = new DashboardStore();

		expect(store.getConversation("Alice")).toEqual([]);
		expect(store.isThinking("Alice")).toBe(false);

		store.pushUserMessage("Alice", "Hello");
		expect(store.getConversation("Alice")).toHaveLength(1);
		expect(store.getConversation("Alice")[0].role).toBe("user");
		expect(store.getConversation("Alice")[0].text).toBe("Hello");
		expect(store.isThinking("Alice")).toBe(true);

		store.pushAgentResponse("Alice", "Hi there!");
		expect(store.getConversation("Alice")).toHaveLength(2);
		expect(store.getConversation("Alice")[1].role).toBe("agent");
		expect(store.getConversation("Alice")[1].text).toBe("Hi there!");
		expect(store.isThinking("Alice")).toBe(false);
	});

	it("tracks agent positions", () => {
		const store = new DashboardStore();
		const handler = vi.fn();
		store.addEventListener("state-changed", handler);

		const positions = new Map([
			["Alice", { x: 10, y: 20 }],
			["Bob", { x: 30, y: 40 }],
		]);
		store.updatePositions(positions);

		expect(handler).toHaveBeenCalledTimes(1);
		expect(store.agentPositions.get("Alice")).toEqual({ x: 10, y: 20 });
		expect(store.agentPositions.get("Bob")).toEqual({ x: 30, y: 40 });
	});

	it("tracks LLM status", () => {
		const store = new DashboardStore();
		const handler = vi.fn();
		store.addEventListener("state-changed", handler);

		store.setLlmStatus("Alice", { state: "thinking", since: 1000 });

		expect(handler).toHaveBeenCalledTimes(1);
		expect(store.llmStatus.get("Alice")).toEqual({ state: "thinking", since: 1000 });

		store.setLlmStatus("Alice", { state: "idle", since: 2000 });
		expect(store.llmStatus.get("Alice")?.state).toBe("idle");
	});

	it("tracks followed agent", () => {
		const store = new DashboardStore();
		expect(store.followedAgent).toBeNull();

		store.startFollow("Alice");
		expect(store.followedAgent).toBe("Alice");

		store.stopFollow();
		expect(store.followedAgent).toBeNull();
	});

	it("manages connection status", () => {
		const store = new DashboardStore();
		expect(store.connectionStatus).toBe("disconnected");

		store.setConnectionStatus("connected");
		expect(store.connectionStatus).toBe("connected");

		store.setConnectionStatus("reconnecting");
		expect(store.connectionStatus).toBe("reconnecting");
	});

	it("manages tab selection", () => {
		const store = new DashboardStore();
		expect(store.selectedTab).toBe("info");

		store.selectTab("talk");
		expect(store.selectedTab).toBe("talk");
	});

	it("dispatches scene-change event on changeScene", () => {
		const store = new DashboardStore();
		const handler = vi.fn();
		store.addEventListener("scene-change", handler);

		store.changeScene("office");

		expect(handler).toHaveBeenCalledTimes(1);
		expect(store.currentScene).toBe("office");
	});

	it("sets agent brain states", () => {
		const store = new DashboardStore();
		store.setAgentState("Alice", "working");
		expect(store.agentStates.get("Alice")).toBe("working");
	});

	it("sets agent movement targets", () => {
		const store = new DashboardStore();
		store.setAgentTarget("Alice", { x: 100, y: 200 });
		expect(store.agentTargets.get("Alice")).toEqual({ x: 100, y: 200 });
	});

	it("sets permissions for an agent", () => {
		const store = new DashboardStore();
		const perms = [{ tool: "bash", scope: "always" as const, grantedAt: "2026-03-16" }];
		store.setPermissions("Alice", perms);
		expect(store.permissions.get("Alice")).toEqual(perms);
	});

	it("sets activity log", () => {
		const store = new DashboardStore();
		const log = [{ id: "1", agentName: "Alice", timestamp: "t", type: "idle" as const, summary: "Went idle" }];
		store.setActivityLog(log);
		expect(store.activityLog).toEqual(log);
	});
});
