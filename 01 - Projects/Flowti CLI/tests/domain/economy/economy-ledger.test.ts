import { describe, it, expect, vi } from "vitest";
import { readLedger, writeLedger, getAccount, creditReward, debitCoin, debitTokens, grantResources, appendTransaction } from "../../../src/domain/economy/economy-ledger.js";
import type { EconomyLedger } from "../../../src/domain/economy/economy-types.js";

function makeDeps(files: Record<string, string> = {}) {
	const store: Record<string, string> = { ...files };
	return {
		disk: {
			existsSync: vi.fn((p: string) => p in store),
			readFileSync: vi.fn((p: string) => store[p] ?? ""),
			writeFileSync: vi.fn((p: string, c: string) => { store[p] = c; }),
			mkdirSync: vi.fn(),
		},
		paths: {
			join: (...segs: string[]) => segs.join("/"),
			dirname: (p: string) => p.split("/").slice(0, -1).join("/"),
		},
		clock: { iso: () => "2026-03-21T10:00:00Z" },
	};
}

const EMPTY_LEDGER: EconomyLedger = { version: 1, updatedAt: "", accounts: {} };

describe("economy-ledger", () => {
	describe("readLedger", () => {
		it("returns empty ledger when file missing", () => {
			const deps = makeDeps();
			const ledger = readLedger(deps, "/vault");
			expect(ledger.accounts).toEqual({});
			expect(ledger.version).toBe(1);
		});

		it("parses existing ledger", () => {
			const existing: EconomyLedger = {
				version: 1, updatedAt: "2026-03-21T09:00:00Z",
				accounts: { auditor: { xp: 100, level: 2, coin: 50, tokens: 1000, totalEarned: { xp: 100, coin: 50 }, totalSpent: { coin: 0, tokens: 0 } } },
			};
			const deps = makeDeps({ "/vault/.flowti/var/economy.json": JSON.stringify(existing) });
			const ledger = readLedger(deps, "/vault");
			expect(ledger.accounts.auditor.xp).toBe(100);
		});
	});

	describe("getAccount", () => {
		it("returns default account for unknown agent", () => {
			const account = getAccount(EMPTY_LEDGER, "newbie");
			expect(account.xp).toBe(0);
			expect(account.level).toBe(1);
			expect(account.coin).toBe(0);
			expect(account.tokens).toBe(0);
		});

		it("returns existing account", () => {
			const ledger: EconomyLedger = {
				...EMPTY_LEDGER,
				accounts: { auditor: { xp: 500, level: 3, coin: 200, tokens: 3000, totalEarned: { xp: 500, coin: 300 }, totalSpent: { coin: 100, tokens: 1000 } } },
			};
			expect(getAccount(ledger, "auditor").xp).toBe(500);
		});
	});

	describe("creditReward", () => {
		it("adds XP and Coin to agent account", () => {
			const result = creditReward(EMPTY_LEDGER, "auditor", { xp: 50, coin: 25 });
			expect(result.ledger.accounts.auditor.xp).toBe(50);
			expect(result.ledger.accounts.auditor.coin).toBe(25);
		});

		it("triggers level-up when XP crosses threshold", () => {
			const ledger: EconomyLedger = {
				...EMPTY_LEDGER,
				accounts: { auditor: { xp: 90, level: 1, coin: 0, tokens: 0, totalEarned: { xp: 90, coin: 0 }, totalSpent: { coin: 0, tokens: 0 } } },
			};
			const result = creditReward(ledger, "auditor", { xp: 20, coin: 0 });
			expect(result.ledger.accounts.auditor.level).toBe(2);
			expect(result.reward.leveledUp).toBe(true);
			expect(result.reward.newLevel).toBe(2);
		});

		it("accumulates totalEarned", () => {
			const ledger: EconomyLedger = {
				...EMPTY_LEDGER,
				accounts: { auditor: { xp: 50, level: 1, coin: 20, tokens: 0, totalEarned: { xp: 50, coin: 20 }, totalSpent: { coin: 0, tokens: 0 } } },
			};
			const result = creditReward(ledger, "auditor", { xp: 30, coin: 10 });
			expect(result.ledger.accounts.auditor.totalEarned).toEqual({ xp: 80, coin: 30 });
		});
	});

	describe("debitCoin", () => {
		it("deducts Coin from account", () => {
			const ledger: EconomyLedger = {
				...EMPTY_LEDGER,
				accounts: { auditor: { xp: 0, level: 1, coin: 100, tokens: 0, totalEarned: { xp: 0, coin: 100 }, totalSpent: { coin: 0, tokens: 0 } } },
			};
			const result = debitCoin(ledger, "auditor", 30);
			expect(result).not.toBeNull();
			expect(result!.accounts.auditor.coin).toBe(70);
			expect(result!.accounts.auditor.totalSpent.coin).toBe(30);
		});

		it("returns null if insufficient balance", () => {
			const ledger: EconomyLedger = {
				...EMPTY_LEDGER,
				accounts: { auditor: { xp: 0, level: 1, coin: 10, tokens: 0, totalEarned: { xp: 0, coin: 10 }, totalSpent: { coin: 0, tokens: 0 } } },
			};
			expect(debitCoin(ledger, "auditor", 20)).toBeNull();
		});
	});

	describe("debitTokens", () => {
		it("deducts Tokens from account", () => {
			const ledger: EconomyLedger = {
				...EMPTY_LEDGER,
				accounts: { auditor: { xp: 0, level: 1, coin: 0, tokens: 5000, totalEarned: { xp: 0, coin: 0 }, totalSpent: { coin: 0, tokens: 0 } } },
			};
			const result = debitTokens(ledger, "auditor", 1200);
			expect(result).not.toBeNull();
			expect(result!.accounts.auditor.tokens).toBe(3800);
		});

		it("returns null if insufficient tokens", () => {
			const ledger: EconomyLedger = {
				...EMPTY_LEDGER,
				accounts: { auditor: { xp: 0, level: 1, coin: 0, tokens: 100, totalEarned: { xp: 0, coin: 0 }, totalSpent: { coin: 0, tokens: 0 } } },
			};
			expect(debitTokens(ledger, "auditor", 200)).toBeNull();
		});
	});

	describe("grantResources", () => {
		it("adds Coin and Tokens to account", () => {
			const result = grantResources(EMPTY_LEDGER, "auditor", { coin: 100, tokens: 5000 });
			expect(result.accounts.auditor.coin).toBe(100);
			expect(result.accounts.auditor.tokens).toBe(5000);
		});
	});

	describe("writeLedger", () => {
		it("writes ledger to disk", () => {
			const deps = makeDeps();
			writeLedger(deps, "/vault", EMPTY_LEDGER);
			expect(deps.disk.writeFileSync).toHaveBeenCalledWith(
				"/vault/.flowti/var/economy.json",
				expect.any(String),
			);
		});
	});

	describe("appendTransaction", () => {
		it("appends JSONL line to transaction log", () => {
			const deps = makeDeps();
			appendTransaction(deps, "/vault", { ts: "2026-03-21T10:00:00Z", agent: "auditor", type: "task-reward", xp: 50, coin: 25 });
			expect(deps.disk.writeFileSync).toHaveBeenCalledWith(
				"/vault/.flowti/var/economy-log.jsonl",
				expect.stringContaining('"task-reward"'),
			);
		});
	});
});
