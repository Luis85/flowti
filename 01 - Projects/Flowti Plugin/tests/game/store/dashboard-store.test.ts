import { describe, it, expect, vi } from "vitest";
import { DashboardStore } from "../../../src/game/store/dashboard-store.js";
import type { PanelMode } from "../../../src/game/store/dashboard-store.js";
import type { ICliExecutor, AgentProcess } from "../../../src/infrastructure/agents/cli-executor.js";

function createMockExecutor(): ICliExecutor {
	const mockProc: AgentProcess = {
		agentName: "atlas",
		running: true,
		getPid: vi.fn(() => null),
		send: vi.fn(),
		sendRaw: vi.fn(),
		onEvent: vi.fn(() => () => {}),
		replayFrom: vi.fn(() => []),
		stopGeneration: vi.fn(),
		grantPermission: vi.fn(),
		kill: vi.fn(),
	};
	return {
		startAgent: vi.fn(() => mockProc),
		assignTask: vi.fn(async () => ({ ok: true })),
		grantPermission: vi.fn(async () => ({ ok: true })),
		listAgents: vi.fn(async () => []),
		wakeAgent: vi.fn(async () => ({ ok: true })),
		killAll: vi.fn(),
		dispose: vi.fn(),
	};
}

describe("DashboardStore", () => {
	it("sets and retrieves agents", () => {
		const store = new DashboardStore();
		store.setAgents([{ name: "Atlas", agentType: "ai", status: "idle" }] as any);
		expect(store.agents).toHaveLength(1);
		expect(store.agents[0].name).toBe("Atlas");
	});
	it("selects and deselects agent", () => {
		const store = new DashboardStore();
		store.selectAgent("Atlas");
		expect(store.selectedAgent).toBe("Atlas");
		store.selectAgent(null);
		expect(store.selectedAgent).toBeNull();
	});
	it("batches position updates", () => {
		const store = new DashboardStore();
		store.beginBatch();
		store.updatePositions(new Map([["Atlas", { x: 10, y: 20 }]]));
		store.endBatch();
		expect(store.agentPositions.get("Atlas")).toEqual({ x: 10, y: 20 });
	});
});

describe("executeTask", () => {
	it("adds task to assignedTasks as pending", () => {
		const executor = createMockExecutor();
		const store = new DashboardStore(executor);
		store.executeTask("atlas", { name: "Review", phases: [] });
		const tasks = store.assignedTasks.get("atlas");
		expect(tasks).toHaveLength(1);
		expect(tasks![0].status).toBe("pending");
	});

	it("dispatches task-assigned event", () => {
		const store = new DashboardStore();
		let detail: unknown = null;
		store.addEventListener("task-assigned", ((e: CustomEvent) => { detail = e.detail; }) as EventListener);
		store.executeTask("atlas", { name: "Review", phases: [] });
		expect(detail).toEqual(expect.objectContaining({ agentName: "atlas" }));
	});

	it("logs to debug console", () => {
		const store = new DashboardStore();
		store.executeTask("atlas", { name: "Review", phases: [] }, "the input");
		expect(store.debugLog).toHaveLength(1);
		expect(store.debugLog[0].prompt).toContain("Review");
		expect(store.debugLog[0].prompt).toContain("the input");
	});

	it("marks task as failed when no executor available", () => {
		const store = new DashboardStore();
		store.executeTask("atlas", { name: "Review", phases: [] });
		const tasks = store.assignedTasks.get("atlas");
		expect(tasks).toHaveLength(1);
		expect(tasks![0].status).toBe("failed");
	});

	it("sends task prompt to agent process", () => {
		const executor = createMockExecutor();
		const store = new DashboardStore(executor);
		store.executeTask("atlas", { name: "Review", phases: [] });
		const proc = (executor.startAgent as ReturnType<typeof vi.fn>).mock.results[0].value as AgentProcess;
		expect(proc.send).toHaveBeenCalledWith(expect.stringContaining("Review"));
	});
});

describe("unreadAgents", () => {
	it("starts empty", () => {
		const store = new DashboardStore();
		expect(store.unreadAgents.size).toBe(0);
	});

	it("clears unread when talk tab is selected", () => {
		const store = new DashboardStore();
		store.unreadAgents.add("atlas");
		store.selectAgent("atlas");
		store.selectTab("talk");
		expect(store.unreadAgents.has("atlas")).toBe(false);
	});
});

describe("agentEventLog", () => {
	it("starts empty", () => {
		const store = new DashboardStore();
		expect(store.agentEventLog.size).toBe(0);
	});

	it("pushEventLog adds entries", () => {
		const store = new DashboardStore();
		(store as unknown as { pushEventLog(a: string, t: string, s: string): void }).pushEventLog("atlas", "response", "Hello");
		const log = store.agentEventLog.get("atlas");
		expect(log).toHaveLength(1);
		expect(log![0]).toEqual(expect.objectContaining({ type: "response", summary: "Hello" }));
	});

	it("caps at 50 entries", () => {
		const store = new DashboardStore();
		for (let i = 0; i < 60; i++) {
			(store as unknown as { pushEventLog(a: string, t: string, s: string): void }).pushEventLog("atlas", "response", `msg${i}`);
		}
		expect(store.agentEventLog.get("atlas")).toHaveLength(50);
	});
});

describe("taskLockedAgents", () => {
	it("starts empty", () => {
		const store = new DashboardStore();
		expect(store.taskLockedAgents.size).toBe(0);
	});
});

describe("isProcessAlive", () => {
	it("returns false when no process exists", () => {
		const store = new DashboardStore();
		expect(store.isProcessAlive("atlas")).toBe(false);
	});
});

describe("activePanel", () => {
	it("defaults to null", () => {
		const store = new DashboardStore();
		expect(store.activePanel).toBeNull();
	});

	it("setActivePanel sets mode and emits state-changed", () => {
		const store = new DashboardStore();
		const events: string[] = [];
		store.addEventListener("state-changed", () => events.push("state-changed"));
		store.setActivePanel("roster");
		expect(store.activePanel).toBe("roster");
		expect(events).toContain("state-changed");
	});

	it("emits panel-changed on open (null to non-null)", () => {
		const store = new DashboardStore();
		let detail: { activePanel: PanelMode | null } | null = null;
		store.addEventListener("panel-changed", ((e: CustomEvent) => { detail = e.detail; }) as EventListener);
		store.setActivePanel("bob");
		expect(detail).toEqual({ activePanel: "bob" });
	});

	it("emits panel-changed on close (non-null to null)", () => {
		const store = new DashboardStore();
		store.setActivePanel("roster");
		let detail: { activePanel: PanelMode | null } | null = null;
		store.addEventListener("panel-changed", ((e: CustomEvent) => { detail = e.detail; }) as EventListener);
		store.setActivePanel(null);
		expect(detail).toEqual({ activePanel: null });
	});

	it("does NOT emit panel-changed on swap (non-null to non-null)", () => {
		const store = new DashboardStore();
		store.setActivePanel("roster");
		let panelChangedFired = false;
		store.addEventListener("panel-changed", () => { panelChangedFired = true; });
		store.setActivePanel("bob");
		expect(store.activePanel).toBe("bob");
		expect(panelChangedFired).toBe(false);
	});

	it("panel-changed fires before state-changed", () => {
		const store = new DashboardStore();
		const order: string[] = [];
		store.addEventListener("panel-changed", () => order.push("panel-changed"));
		store.addEventListener("state-changed", () => order.push("state-changed"));
		store.setActivePanel("merchant");
		expect(order).toEqual(["panel-changed", "state-changed"]);
	});

	it("selectAgent sets activePanel to agent-detail", () => {
		const store = new DashboardStore();
		store.selectAgent("atlas");
		expect(store.activePanel).toBe("agent-detail");
	});

	it("selectAgent(null) clears activePanel when showing agent-detail", () => {
		const store = new DashboardStore();
		store.selectAgent("atlas");
		expect(store.activePanel).toBe("agent-detail");
		store.selectAgent(null);
		expect(store.activePanel).toBeNull();
	});

	it("selectAgent(null) does NOT clear activePanel when showing bob", () => {
		const store = new DashboardStore();
		store.selectAgent("atlas");
		store.setActivePanel("bob");
		store.selectAgent(null);
		expect(store.activePanel).toBe("bob");
	});

	it("deselectAgent clears activePanel when showing agent-detail", () => {
		const store = new DashboardStore();
		store.selectAgent("atlas");
		expect(store.activePanel).toBe("agent-detail");
		store.deselectAgent("atlas");
		expect(store.activePanel).toBeNull();
	});
});
