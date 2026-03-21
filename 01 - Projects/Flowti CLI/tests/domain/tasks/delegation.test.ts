import { describe, it, expect } from "vitest";
import { canDelegate, createDelegatedTask, awardDelegationCut } from "../../../src/domain/tasks/delegation.js";
import type { EconomyLedger } from "../../../src/domain/economy/economy-types.js";

function makeLedger(agentName: string, coin: number): EconomyLedger {
	return {
		version: 1,
		updatedAt: "2026-01-01T00:00:00.000Z",
		accounts: {
			[agentName]: {
				xp: 100,
				level: 2,
				coin,
				tokens: 0,
				totalEarned: { xp: 100, coin },
				totalSpent: { coin: 0, tokens: 0 },
			},
		},
	};
}

const mockClock = { iso: () => "2026-03-21T00:00:00.000Z" };

describe("canDelegate", () => {
	it("returns allowed=true when agent has sufficient coin", () => {
		const ledger = makeLedger("alice", 50);
		const result = canDelegate(ledger, "alice", 10);
		expect(result.allowed).toBe(true);
		expect(result.reason).toBeUndefined();
	});

	it("returns allowed=false with reason when agent has insufficient coin", () => {
		const ledger = makeLedger("alice", 5);
		const result = canDelegate(ledger, "alice", 10);
		expect(result.allowed).toBe(false);
		expect(result.reason).toMatch(/insufficient coin/i);
	});

	it("returns allowed=true when coin exactly equals fee", () => {
		const ledger = makeLedger("alice", 10);
		const result = canDelegate(ledger, "alice", 10);
		expect(result.allowed).toBe(true);
	});

	it("returns allowed=false for unknown agent with zero balance", () => {
		const ledger = makeLedger("alice", 50);
		const result = canDelegate(ledger, "unknown", 1);
		expect(result.allowed).toBe(false);
	});
});

describe("createDelegatedTask", () => {
	it("sets type=delegated, creator=fromAgent, assignee=toAgent", () => {
		const task = createDelegatedTask(
			{ title: "Review PR", reward: { xp: 20, coin: 5 } },
			"alice",
			"bob",
			mockClock,
		);
		expect(task.type).toBe("delegated");
		expect(task.creator).toBe("alice");
		expect(task.assignee).toBe("bob");
		expect(task.title).toBe("Review PR");
	});

	it("uses provided id when present", () => {
		const task = createDelegatedTask({ id: "task-123" }, "alice", "bob", mockClock);
		expect(task.id).toBe("task-123");
	});

	it("applies defaults for missing fields", () => {
		const task = createDelegatedTask({}, "alice", "bob", mockClock);
		expect(task.priority).toBe("normal");
		expect(task.trustTier).toBe("review");
		expect(task.status).toBe("pending");
		expect(task.tags).toEqual([]);
	});

	it("sets createdAt from clock when not provided", () => {
		const task = createDelegatedTask({}, "alice", "bob", mockClock);
		expect(task.createdAt).toBe("2026-03-21T00:00:00.000Z");
	});
});

describe("awardDelegationCut", () => {
	it("credits 20% of xp and coin to assigner", () => {
		const ledger = makeLedger("alice", 0);
		const { cut, ledger: updated } = awardDelegationCut(ledger, "alice", { xp: 100, coin: 50 });
		expect(cut.xp).toBe(20);
		expect(cut.coin).toBe(10);
		expect(updated.accounts["alice"].xp).toBe(120);
		expect(updated.accounts["alice"].coin).toBe(10);
	});

	it("floors fractional cut amounts", () => {
		const ledger = makeLedger("alice", 0);
		const { cut } = awardDelegationCut(ledger, "alice", { xp: 7, coin: 3 });
		expect(cut.xp).toBe(1);
		expect(cut.coin).toBe(0);
	});

	it("does not modify original ledger", () => {
		const ledger = makeLedger("alice", 0);
		awardDelegationCut(ledger, "alice", { xp: 50, coin: 20 });
		expect(ledger.accounts["alice"].xp).toBe(100);
	});
});
