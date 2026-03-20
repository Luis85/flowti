import { describe, it, expect } from "vitest";
import { dashboardAgentsFromWorldState } from "../../../src/game/config/world-state-agents";
import type { WorldState } from "../../../src/game/data/types";

describe("dashboardAgentsFromWorldState", () => {
	it("returns empty for null/undefined", () => {
		expect(dashboardAgentsFromWorldState(null)).toEqual([]);
		expect(dashboardAgentsFromWorldState(undefined)).toEqual([]);
	});

	it("returns empty when entities missing", () => {
		expect(dashboardAgentsFromWorldState({} as WorldState)).toEqual([]);
	});

	it("maps agent entities with string status and domain", () => {
		const state: WorldState = {
			version: 1,
			updatedAt: "2026-01-01T00:00:00Z",
			entities: {
				atlas: {
					id: "atlas",
					type: "agent",
					components: {
						domain: "engineering",
						agentType: "ai",
						status: "busy",
						identity: { persona: "Helper", mood: "focused" },
					},
				},
			},
			permissions: {},
			activityLog: [],
		};
		const rows = dashboardAgentsFromWorldState(state);
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({
			name: "atlas",
			agentType: "ai",
			domain: "engineering",
			status: "busy",
			persona: "Helper",
			mood: "focused",
		});
	});

	it("maps nested status.state to busy/idle", () => {
		const state: WorldState = {
			version: 1,
			updatedAt: "2026-01-01T00:00:00Z",
			entities: {
				bob: {
					id: "bob",
					type: "agent",
					components: {
						status: { state: "working" },
						identity: { domain: "product" },
					},
				},
			},
			permissions: {},
			activityLog: [],
		};
		const rows = dashboardAgentsFromWorldState(state);
		expect(rows[0]?.status).toBe("busy");
		expect(rows[0]?.domain).toBe("product");
		expect(rows[0]?.agentType).toBe("ai");
	});

	it("skips non-agent entities", () => {
		const state: WorldState = {
			version: 1,
			updatedAt: "2026-01-01T00:00:00Z",
			entities: {
				p1: { id: "p1", type: "project", components: {} },
				a1: { id: "a1", type: "agent", components: { domain: "x" } },
			},
			permissions: {},
			activityLog: [],
		};
		expect(dashboardAgentsFromWorldState(state)).toHaveLength(1);
		expect(dashboardAgentsFromWorldState(state)[0]?.name).toBe("a1");
	});
});
