import { describe, it, expect } from "vitest";
import type { AgentAccount, EconomyLedger, Transaction, TransactionType } from "../../../src/domain/economy/economy-types.js";

describe("economy-types", () => {
	it("AgentAccount accepts valid account", () => {
		const account: AgentAccount = {
			xp: 1250, level: 5, coin: 340, tokens: 5000,
			totalEarned: { xp: 1250, coin: 780 },
			totalSpent: { coin: 440, tokens: 32000 },
		};
		expect(account.level).toBe(5);
	});

	it("EconomyLedger accepts valid ledger", () => {
		const ledger: EconomyLedger = {
			version: 1, updatedAt: "2026-03-21T10:00:00Z",
			accounts: { auditor: { xp: 0, level: 1, coin: 0, tokens: 0, totalEarned: { xp: 0, coin: 0 }, totalSpent: { coin: 0, tokens: 0 } } },
		};
		expect(ledger.version).toBe(1);
	});

	it("Transaction accepts valid entry", () => {
		const tx: Transaction = { ts: "2026-03-21T10:30:00Z", agent: "auditor", type: "task-reward", taskId: "task-001", xp: 50, coin: 25 };
		expect(tx.type).toBe("task-reward");
	});

	it("TransactionType includes all types", () => {
		const types: TransactionType[] = ["task-reward", "standing-order-reward", "delegation-fee", "delegation-cut", "spend", "llm-spend", "grant", "purchase", "debug"];
		expect(types).toHaveLength(9);
	});
});
