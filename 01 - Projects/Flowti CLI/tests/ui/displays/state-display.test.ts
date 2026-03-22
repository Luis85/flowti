import { describe, it, expect, vi } from "vitest";

vi.mock("../../../src/infrastructure/ui.js", () => ({
	RESET: "", DIM: "", GREEN: "", YELLOW: "", RED: "", CYAN: "", BOLD: "",
}));

import { renderWorldStateSummary, renderEntityDetail } from "../../../src/ui/displays/state-display.js";
import type { WorldState, WorldEntity } from "../../../src/domain/agents/world-state-types.js";

function emptyState(): WorldState {
	return { version: 1, updatedAt: new Date().toISOString(), entities: {}, permissions: {}, activityLog: [] };
}

describe("renderWorldStateSummary", () => {
	it("renders empty state without errors", () => {
		const log = vi.fn();
		renderWorldStateSummary(emptyState(), log);
		expect(log).toHaveBeenCalledWith(expect.stringContaining("World State"));
	});

	it("renders agents section", () => {
		const log = vi.fn();
		const state = emptyState();
		(state as unknown as Record<string, unknown>).entities = {
			Bob: { id: "Bob", type: "agent", components: { identity: { agentType: "ai" }, status: { state: "idle" } } },
		};
		renderWorldStateSummary(state, log);
		expect(log).toHaveBeenCalledWith(expect.stringContaining("Bob"));
		expect(log).toHaveBeenCalledWith(expect.stringContaining("Agents"));
	});

	it("renders projects section", () => {
		const log = vi.fn();
		const state: WorldState = {
			...emptyState(),
			entities: {
				"CLI": { id: "CLI", type: "project", components: { iteration: { name: "iter-1", status: "active" }, roster: { agents: ["a"] } } },
			},
		};
		renderWorldStateSummary(state, log);
		expect(log).toHaveBeenCalledWith(expect.stringContaining("CLI"));
		expect(log).toHaveBeenCalledWith(expect.stringContaining("Projects"));
	});

	it("renders activity log", () => {
		const log = vi.fn();
		const state: WorldState = {
			...emptyState(),
			activityLog: [{ id: "1", agentName: "Bob", timestamp: "2026-03-15T12:00:00Z", type: "speaking", summary: "Hello" }],
		};
		renderWorldStateSummary(state, log);
		expect(log).toHaveBeenCalledWith(expect.stringContaining("Recent Activity"));
		expect(log).toHaveBeenCalledWith(expect.stringContaining("Hello"));
	});

	it("shows at most 10 recent activity entries", () => {
		const log = vi.fn();
		const entries = Array.from({ length: 15 }, (_, i) => ({
			id: `${i}`, agentName: "Bob", timestamp: "2026-03-15T12:00:00Z", type: "thinking" as const, summary: `entry-${i}`,
		}));
		const state: WorldState = { ...emptyState(), activityLog: entries };
		renderWorldStateSummary(state, log);
		const activityCalls = log.mock.calls.filter((c: unknown[]) => typeof c[0] === "string" && (c[0] as string).includes("entry-"));
		expect(activityCalls.length).toBe(10);
	});
});

describe("renderEntityDetail", () => {
	it("renders entity id, type, and components", () => {
		const log = vi.fn();
		const entity: WorldEntity = { id: "Bob", type: "agent", components: { identity: { name: "Bob" }, status: { state: "idle" } } };
		renderEntityDetail(entity, log);
		expect(log).toHaveBeenCalledWith(expect.stringContaining("Bob"));
		expect(log).toHaveBeenCalledWith(expect.stringContaining("agent"));
		expect(log).toHaveBeenCalledWith(expect.stringContaining("identity"));
		expect(log).toHaveBeenCalledWith(expect.stringContaining("status"));
	});
});
