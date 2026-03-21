/**
 * shop.controller.test.ts — Tests for shop CLI commands.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks (must come BEFORE imports) ──────────────────────────────

vi.mock("../../src/infrastructure/logger.js", () => ({ log: vi.fn(), warn: vi.fn() }));
vi.mock("../../src/infrastructure/filesystem.js", () => ({
	disk: {
		existsSync: vi.fn(() => false),
		readFileSync: vi.fn(() => ""),
		readdirSync: vi.fn(() => []),
		writeFileSync: vi.fn(),
		mkdirSync: vi.fn(),
		unlinkSync: vi.fn(),
	},
}));
vi.mock("../../src/infrastructure/paths.js", () => ({
	paths: {
		join: vi.fn((...args: string[]) => args.join("/")),
		resolve: vi.fn((...args: string[]) => args.join("/")),
		relative: vi.fn((_a: string, b: string) => b),
		dirname: vi.fn((p: string) => p.split("/").slice(0, -1).join("/")),
		basename: vi.fn((p: string) => p.split("/").pop() ?? p),
	},
}));
vi.mock("../../src/infrastructure/clock.js", () => ({
	clock: { iso: () => "2026-03-21T00:00:00.000Z", now: () => new Date("2026-03-21"), ms: () => 0, safeIso: () => "2026-03-21T000000" },
}));
vi.mock("../../src/infrastructure/proc.js", () => ({
	proc: { exit: vi.fn(), argv: () => [], cwd: () => "/", env: () => ({}) },
}));
vi.mock("../../src/infrastructure/input.js", () => ({
	input: { ask: vi.fn(async () => ""), askYesNo: vi.fn(async () => false), waitForEnter: vi.fn(async () => {}) },
}));
vi.mock("../../src/infrastructure/config.js", () => ({
	VAULT_ROOT: "/vault",
	CLI_PROJECT: "/vault/cli",
	PLUGIN_ROOT: "/vault/plugin",
	cliConfig: { version: "1.0.0" },
	loadJson: vi.fn(),
}));
vi.mock("../../src/infrastructure/shell.js", () => ({
	shell: { run: vi.fn(), runSilent: vi.fn(), check: vi.fn(() => false) },
}));
vi.mock("../../src/infrastructure/ui.js", () => ({
	RESET: "", BOLD: "", DIM: "", GREEN: "", RED: "", YELLOW: "", CYAN: "",
}));

const DEFAULT_CATALOG = {
	version: 1,
	items: [
		{ id: "tool-vault-write", name: "Vault Write Access", category: "capability", cost: { coin: 200 }, requiresLevel: 3, description: "Unlocks note creation", oneTime: true },
		{ id: "token-pack-5k", name: "Token Pack (5,000)", category: "resource", cost: { coin: 100 }, description: "5,000 LLM tokens", oneTime: false },
		{ id: "title-senior", name: "Senior Title Badge", category: "cosmetic", cost: { coin: 150 }, requiresLevel: 5, description: "Display Senior title", oneTime: true },
		{ id: "pet-hat-tophat", name: "Top Hat (Pet)", category: "pet-cosmetic", cost: { coin: 50 }, description: "A dapper top hat", oneTime: false },
		{ id: "delegation-license", name: "Delegation License", category: "capability", cost: { coin: 300 }, requiresLevel: 4, description: "Assign tasks to others", oneTime: true },
	],
	buyback: 0.5,
	restockCycle: "daily",
};

const DEFAULT_LEDGER = {
	version: 1,
	updatedAt: "2026-03-21T00:00:00.000Z",
	accounts: {
		Merchant: { xp: 0, level: 5, coin: 1000, tokens: 0, totalEarned: { xp: 0, coin: 1000 }, totalSpent: { coin: 0, tokens: 0 } },
		Broke: { xp: 0, level: 1, coin: 10, tokens: 0, totalEarned: { xp: 0, coin: 10 }, totalSpent: { coin: 0, tokens: 0 } },
	},
};

vi.mock("../../src/domain/merchant/merchant-catalog.js", () => ({
	readCatalog: vi.fn(() => DEFAULT_CATALOG),
	writeCatalog: vi.fn(),
	getAvailableItems: vi.fn((catalog, level) => catalog.items.filter((i: { requiresLevel?: number }) => (i.requiresLevel ?? 1) <= level)),
	purchaseItem: vi.fn((catalog, ledger, agent, itemId, level) => {
		const item = catalog.items.find((i: { id: string }) => i.id === itemId);
		if (!item) return null;
		if ((item.requiresLevel ?? 1) > level) return null;
		const account = ledger.accounts[agent];
		if (!account || account.coin < item.cost.coin) return null;
		return {
			catalog,
			ledger: {
				...ledger,
				accounts: {
					...ledger.accounts,
					[agent]: { ...account, coin: account.coin - item.cost.coin },
				},
			},
		};
	}),
}));

vi.mock("../../src/domain/economy/economy-ledger.js", () => ({
	readLedger: vi.fn(() => DEFAULT_LEDGER),
	writeLedger: vi.fn(),
	getAccount: vi.fn((ledger, agent) => ledger.accounts[agent] ?? { xp: 0, level: 1, coin: 0, tokens: 0, totalEarned: { xp: 0, coin: 0 }, totalSpent: { coin: 0, tokens: 0 } }),
}));

vi.mock("../../src/ui/displays/shop-display.js", () => ({
	renderShopList: vi.fn(),
	renderShopBuy: vi.fn(),
	renderShopCatalogAdd: vi.fn(),
	renderShopCatalogEdit: vi.fn(),
}));

vi.mock("../../src/ui/renderers/common-renderers.js", () => ({
	renderError: vi.fn(),
	renderNoProject: vi.fn(),
}));

// ── Imports ──────────────────────────────────────────────────────

import { commands } from "../../src/controller/shop.controller.js";
import { initializeDeps } from "../../src/infrastructure/command-engine.js";
import { readCatalog, writeCatalog, purchaseItem } from "../../src/domain/merchant/merchant-catalog.js";
import { readLedger, writeLedger } from "../../src/domain/economy/economy-ledger.js";
import { disk } from "../../src/infrastructure/filesystem.js";
import { paths } from "../../src/infrastructure/paths.js";
import { clock } from "../../src/infrastructure/clock.js";
import { proc } from "../../src/infrastructure/proc.js";
import { log } from "../../src/infrastructure/logger.js";

const logMock = log as ReturnType<typeof vi.fn>;

// ── Tests ─────────────────────────────────────────────────────────

describe("shop.controller", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		initializeDeps({
			disk, paths, clock, proc,
			shell: { run: vi.fn(), runSilent: vi.fn(), check: vi.fn(() => false) } as never,
			input: { ask: vi.fn() as never, askYesNo: vi.fn() as never, waitForEnter: vi.fn() as never },
			bus: { emit: vi.fn(), on: vi.fn(), off: vi.fn(), clear: vi.fn() } as never,
			log, warn: vi.fn(),
		});
	});

	// ── shop:list ──────────────────────────────────────────────────
	describe("shop:list", () => {
		it("is defined", () => {
			expect(commands["shop:list"]).toBeDefined();
		});

		it("returns all catalog items as JSON", () => {
			commands["shop:list"]({ format: "json" }, [], "shop:list", undefined);

			expect(readCatalog).toHaveBeenCalledOnce();
			expect(logMock).toHaveBeenCalledOnce();
			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("items");
			expect(output.items).toHaveLength(5);
		});

		it("items contain id, name, category, coin, requiresLevel, description, oneTime", () => {
			commands["shop:list"]({ format: "json" }, [], "shop:list", undefined);

			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			const first = output.items[0];
			expect(first).toHaveProperty("id");
			expect(first).toHaveProperty("name");
			expect(first).toHaveProperty("category");
			expect(first).toHaveProperty("coin");
			expect(first).toHaveProperty("requiresLevel");
			expect(first).toHaveProperty("description");
			expect(first).toHaveProperty("oneTime");
		});
	});

	// ── shop:buy ───────────────────────────────────────────────────
	describe("shop:buy", () => {
		it("is defined", () => {
			expect(commands["shop:buy"]).toBeDefined();
		});

		it("returns success model when purchase succeeds", () => {
			commands["shop:buy"]({ agent: "Merchant", item: "token-pack-5k", format: "json" }, [], "shop:buy", undefined);

			expect(readCatalog).toHaveBeenCalledOnce();
			expect(readLedger).toHaveBeenCalledOnce();
			expect(purchaseItem).toHaveBeenCalledOnce();
			expect(writeLedger).toHaveBeenCalledOnce();
			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("success", true);
			expect(output).toHaveProperty("agent", "Merchant");
			expect(output).toHaveProperty("itemId", "token-pack-5k");
		});

		it("returns failure model when agent has insufficient coin", () => {
			commands["shop:buy"]({ agent: "Broke", item: "token-pack-5k", format: "json" }, [], "shop:buy", undefined);

			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("success", false);
			expect(output).toHaveProperty("reason");
		});

		it("returns failure model when item does not exist", () => {
			commands["shop:buy"]({ agent: "Merchant", item: "nonexistent", format: "json" }, [], "shop:buy", undefined);

			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("success", false);
			expect(writeLedger).not.toHaveBeenCalled();
		});

		it("returns failure model when agent level is too low", () => {
			// Broke is level 1, tool-vault-write requires level 3
			commands["shop:buy"]({ agent: "Broke", item: "tool-vault-write", format: "json" }, [], "shop:buy", undefined);

			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("success", false);
			expect(output.reason).toMatch(/level/i);
		});

		it("returns error when --agent flag is missing", () => {
			commands["shop:buy"]({ item: "token-pack-5k", format: "json" }, [], "shop:buy", undefined);

			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("error");
			expect(output.error).toContain("--agent");
		});

		it("returns error when --item flag is missing", () => {
			commands["shop:buy"]({ agent: "Merchant", format: "json" }, [], "shop:buy", undefined);

			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("error");
			expect(output.error).toContain("--item");
		});
	});

	// ── shop:catalog:add ───────────────────────────────────────────
	describe("shop:catalog:add", () => {
		it("is defined", () => {
			expect(commands["shop:catalog:add"]).toBeDefined();
		});

		it("adds item and writes catalog", () => {
			commands["shop:catalog:add"]({ id: "new-item", name: "New Item", cost: 75, category: "resource", format: "json" }, [], "shop:catalog:add", undefined);

			expect(readCatalog).toHaveBeenCalledOnce();
			expect(writeCatalog).toHaveBeenCalledOnce();
			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("id", "new-item");
			expect(output).toHaveProperty("name", "New Item");
		});

		it("returns error when --id flag is missing", () => {
			commands["shop:catalog:add"]({ name: "Item", cost: 10, category: "resource", format: "json" }, [], "shop:catalog:add", undefined);

			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("error");
			expect(output.error).toContain("--id");
		});

		it("returns error when --cost flag is missing", () => {
			commands["shop:catalog:add"]({ id: "x", name: "Item", category: "resource", format: "json" }, [], "shop:catalog:add", undefined);

			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("error");
			expect(output.error).toContain("--cost");
		});
	});

	// ── shop:catalog:edit ──────────────────────────────────────────
	describe("shop:catalog:edit", () => {
		it("is defined", () => {
			expect(commands["shop:catalog:edit"]).toBeDefined();
		});

		it("updates item cost and writes catalog", () => {
			commands["shop:catalog:edit"]({ id: "token-pack-5k", cost: 120, format: "json" }, [], "shop:catalog:edit", undefined);

			expect(readCatalog).toHaveBeenCalledOnce();
			expect(writeCatalog).toHaveBeenCalledOnce();
			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("id", "token-pack-5k");
			expect(output).toHaveProperty("cost", 120);
		});

		it("returns error when --id flag is missing", () => {
			commands["shop:catalog:edit"]({ cost: 50, format: "json" }, [], "shop:catalog:edit", undefined);

			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("error");
			expect(output.error).toContain("--id");
		});

		it("returns error when --cost flag is missing", () => {
			commands["shop:catalog:edit"]({ id: "token-pack-5k", format: "json" }, [], "shop:catalog:edit", undefined);

			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("error");
			expect(output.error).toContain("--cost");
		});
	});
});
