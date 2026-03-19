import { describe, it, expect, vi } from "vitest";
import { DashboardStore } from "../../../src/game/store/dashboard-store.js";

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
