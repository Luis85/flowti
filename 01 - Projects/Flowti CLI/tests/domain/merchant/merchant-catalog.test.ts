import { describe, it, expect, vi } from "vitest";
import { readCatalog, writeCatalog, getAvailableItems, purchaseItem } from "../../../src/domain/merchant/merchant-catalog.js";
import type { MerchantCatalog } from "../../../src/domain/merchant/merchant-types.js";
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
	};
}

function makeAccount(coin: number, level = 1) {
	return { xp: 0, level, coin, tokens: 0, totalEarned: { xp: 0, coin }, totalSpent: { coin: 0, tokens: 0 } };
}

function makeLedger(agents: Record<string, ReturnType<typeof makeAccount>>): EconomyLedger {
	return { version: 1, updatedAt: "", accounts: agents };
}

describe("merchant-catalog", () => {
	describe("readCatalog", () => {
		it("returns default catalog when file is missing", () => {
			const deps = makeDeps();
			const catalog = readCatalog(deps, "/vault");
			expect(catalog.version).toBe(1);
			expect(catalog.items).toHaveLength(5);
			expect(catalog.buyback).toBe(0.5);
			expect(catalog.restockCycle).toBe("daily");
		});

		it("returns default catalog with expected item IDs", () => {
			const deps = makeDeps();
			const catalog = readCatalog(deps, "/vault");
			const ids = catalog.items.map((i) => i.id);
			expect(ids).toContain("tool-vault-write");
			expect(ids).toContain("token-pack-5k");
			expect(ids).toContain("title-senior");
			expect(ids).toContain("pet-hat-tophat");
			expect(ids).toContain("delegation-license");
		});

		it("parses existing catalog file", () => {
			const existing: MerchantCatalog = {
				version: 2,
				items: [{ id: "test-item", name: "Test", category: "resource", cost: { coin: 10 }, description: "A test item" }],
				buyback: 0.25,
				restockCycle: "weekly",
			};
			const deps = makeDeps({ "/vault/.flowti/var/merchant-catalog.json": JSON.stringify(existing) });
			const catalog = readCatalog(deps, "/vault");
			expect(catalog.version).toBe(2);
			expect(catalog.items).toHaveLength(1);
			expect(catalog.items[0].id).toBe("test-item");
		});
	});

	describe("writeCatalog", () => {
		it("writes catalog to the expected path", () => {
			const deps = makeDeps();
			const catalog = readCatalog(deps, "/vault");
			writeCatalog(deps, "/vault", catalog);
			expect(deps.disk.writeFileSync).toHaveBeenCalledWith(
				"/vault/.flowti/var/merchant-catalog.json",
				expect.any(String),
			);
		});
	});

	describe("getAvailableItems", () => {
		it("returns all items when agent level is high", () => {
			const deps = makeDeps();
			const catalog = readCatalog(deps, "/vault");
			const items = getAvailableItems(catalog, 10);
			expect(items).toHaveLength(5);
		});

		it("filters out items requiring higher level", () => {
			const deps = makeDeps();
			const catalog = readCatalog(deps, "/vault");
			// Level 1: no requiresLevel items (tool-vault-write=3, title-senior=5, delegation-license=4 are filtered)
			const items = getAvailableItems(catalog, 1);
			const ids = items.map((i) => i.id);
			expect(ids).not.toContain("tool-vault-write");
			expect(ids).not.toContain("title-senior");
			expect(ids).not.toContain("delegation-license");
			expect(ids).toContain("token-pack-5k");
			expect(ids).toContain("pet-hat-tophat");
		});

		it("includes items exactly at agent level", () => {
			const deps = makeDeps();
			const catalog = readCatalog(deps, "/vault");
			const items = getAvailableItems(catalog, 3);
			const ids = items.map((i) => i.id);
			expect(ids).toContain("tool-vault-write");
			expect(ids).not.toContain("title-senior");
		});
	});

	describe("purchaseItem", () => {
		it("succeeds with sufficient coin and level", () => {
			const deps = makeDeps();
			const catalog = readCatalog(deps, "/vault");
			const ledger = makeLedger({ alice: makeAccount(500, 5) });
			const result = purchaseItem(catalog, ledger, "alice", "token-pack-5k", 5);
			expect(result).not.toBeNull();
			expect(result!.ledger.accounts.alice.coin).toBe(400);
		});

		it("fails when agent has insufficient coin", () => {
			const deps = makeDeps();
			const catalog = readCatalog(deps, "/vault");
			const ledger = makeLedger({ alice: makeAccount(50, 5) });
			const result = purchaseItem(catalog, ledger, "alice", "token-pack-5k", 5);
			expect(result).toBeNull();
		});

		it("fails when agent level is too low", () => {
			const deps = makeDeps();
			const catalog = readCatalog(deps, "/vault");
			const ledger = makeLedger({ alice: makeAccount(1000, 1) });
			// tool-vault-write requires level 3
			const result = purchaseItem(catalog, ledger, "alice", "tool-vault-write", 1);
			expect(result).toBeNull();
		});

		it("fails when item does not exist", () => {
			const deps = makeDeps();
			const catalog = readCatalog(deps, "/vault");
			const ledger = makeLedger({ alice: makeAccount(1000, 10) });
			const result = purchaseItem(catalog, ledger, "alice", "nonexistent-item", 10);
			expect(result).toBeNull();
		});

		it("fails for oneTime item already purchased", () => {
			const deps = makeDeps();
			const catalog = readCatalog(deps, "/vault");
			const ledger = makeLedger({ alice: makeAccount(1000, 5) });
			const purchased = { alice: ["tool-vault-write"] as readonly string[] };
			const result = purchaseItem(catalog, ledger, "alice", "tool-vault-write", 5, purchased);
			expect(result).toBeNull();
		});

		it("allows re-purchase of non-oneTime items", () => {
			const deps = makeDeps();
			const catalog = readCatalog(deps, "/vault");
			const ledger = makeLedger({ alice: makeAccount(1000, 5) });
			const purchased = { alice: ["token-pack-5k"] as readonly string[] };
			// token-pack-5k has oneTime: false — should succeed
			const result = purchaseItem(catalog, ledger, "alice", "token-pack-5k", 5, purchased);
			expect(result).not.toBeNull();
		});

		it("debits correct coin amount", () => {
			const deps = makeDeps();
			const catalog = readCatalog(deps, "/vault");
			const ledger = makeLedger({ alice: makeAccount(500, 5) });
			// title-senior costs 150, requires level 5
			const result = purchaseItem(catalog, ledger, "alice", "title-senior", 5);
			expect(result).not.toBeNull();
			expect(result!.ledger.accounts.alice.coin).toBe(350);
		});
	});
});
