import { describe, it, expect } from "vitest";
import { findEligibleAgent, checkCapacity } from "../../src/infrastructure/task-router.js";
import type { RoutingContext, TaskRoutingRequest } from "../../src/infrastructure/task-router.js";

function makeContext(overrides: Partial<RoutingContext> = {}): RoutingContext {
	return {
		agents: [],
		trustProfiles: {},
		ledger: { accounts: {} },
		activeTasks: {},
		standingOrders: {},
		...overrides,
	};
}

describe("checkCapacity", () => {
	it("returns true when below limit (level 1, 0 active)", () => {
		expect(checkCapacity(1, 0, 0)).toBe(true);
	});

	it("returns false when at task limit (level 1, 1 active)", () => {
		expect(checkCapacity(1, 1, 0)).toBe(false);
	});

	it("returns false when at standing order limit (level 1, 1 standing)", () => {
		expect(checkCapacity(1, 0, 1)).toBe(false);
	});

	it("returns true at level 3 with 1 active task", () => {
		expect(checkCapacity(3, 1, 0)).toBe(true);
	});

	it("returns false at level 3 with 2 active tasks", () => {
		expect(checkCapacity(3, 2, 0)).toBe(false);
	});

	it("returns true at level 7 with 3 active tasks", () => {
		expect(checkCapacity(7, 3, 0)).toBe(true);
	});

	it("returns false at level 7 with 4 active tasks", () => {
		expect(checkCapacity(7, 4, 0)).toBe(false);
	});
});

describe("findEligibleAgent", () => {
	it("returns null for empty agent list", () => {
		const ctx = makeContext();
		const task: TaskRoutingRequest = { domain: "engineering" };
		expect(findEligibleAgent(task, ctx)).toBeNull();
	});

	it("returns null when all agents are NPCs", () => {
		const ctx = makeContext({
			agents: [{ name: "Bob", agentType: "npc" }],
			ledger: { accounts: { Bob: { level: 3 } } },
		});
		expect(findEligibleAgent({ domain: "engineering" }, ctx)).toBeNull();
	});

	it("returns null when only AI agent is at capacity", () => {
		const ctx = makeContext({
			agents: [{ name: "Alice", agentType: "ai" }],
			ledger: { accounts: { Alice: { level: 1 } } },
			activeTasks: { Alice: 1 },
		});
		expect(findEligibleAgent({ domain: "engineering" }, ctx)).toBeNull();
	});

	it("returns the only available AI agent", () => {
		const ctx = makeContext({
			agents: [{ name: "Alice", agentType: "ai" }],
			ledger: { accounts: { Alice: { level: 1 } } },
		});
		expect(findEligibleAgent({ domain: "engineering" }, ctx)).toBe("Alice");
	});

	it("prefers domain-matched agent over non-matched", () => {
		const ctx = makeContext({
			agents: [
				{ name: "Generic", agentType: "ai", domain: "design" },
				{ name: "Engineer", agentType: "ai", domain: "engineering" },
			],
			ledger: {
				accounts: {
					Generic: { level: 3 },
					Engineer: { level: 3 },
				},
			},
		});
		const result = findEligibleAgent({ domain: "engineering" }, ctx);
		expect(result).toBe("Engineer");
	});

	it("skips NPC agents even when eligible by capacity", () => {
		const ctx = makeContext({
			agents: [
				{ name: "NpcBob", agentType: "npc", domain: "engineering" },
				{ name: "AiAlice", agentType: "ai", domain: "design" },
			],
			ledger: {
				accounts: {
					NpcBob: { level: 5 },
					AiAlice: { level: 5 },
				},
			},
		});
		expect(findEligibleAgent({ domain: "engineering" }, ctx)).toBe("AiAlice");
	});

	it("prefers agent with trust auto for required operation", () => {
		const ctx = makeContext({
			agents: [
				{ name: "Trusted", agentType: "ai" },
				{ name: "Untrusted", agentType: "ai" },
			],
			ledger: {
				accounts: {
					Trusted: { level: 3 },
					Untrusted: { level: 3 },
				},
			},
			trustProfiles: {
				Trusted: { operations: { "file:write": "auto" } },
				Untrusted: { operations: { "file:write": "review" } },
			},
		});
		const result = findEligibleAgent({ requiredOperation: "file:write" }, ctx);
		expect(result).toBe("Trusted");
	});
});
