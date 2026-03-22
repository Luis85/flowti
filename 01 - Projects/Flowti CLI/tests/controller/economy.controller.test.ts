/**
 * economy.controller.test.ts — Tests for economy CLI commands.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks (must come BEFORE imports) ─────────────────────────────

vi.mock("../../src/infrastructure/logger.js", () => ({ log: vi.fn(), warn: vi.fn() }));
vi.mock("../../src/infrastructure/filesystem.js", () => ({
	disk: {
		existsSync: vi.fn(() => true),
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
		dirname: vi.fn((p: string) => p),
		basename: vi.fn((p: string) => p.split("/").pop() ?? p),
	},
}));
vi.mock("../../src/infrastructure/clock.js", () => ({
	clock: { iso: () => "2026-03-21T00:00:00.000Z", now: () => new Date("2026-03-21"), ms: () => 0, safeIso: () => "2026-03-21T000000" },
}));
vi.mock("../../src/infrastructure/proc.js", () => ({
	proc: { exit: vi.fn(), argv: () => [], cwd: () => "/", env: () => ({}) },
	pidOps: { isPidAlive: vi.fn(() => false), isPortListening: vi.fn(async () => false), killPid: vi.fn(() => false) },
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

// Mock domain modules
vi.mock("../../src/domain/economy/economy-ledger.js", () => ({
	readLedger: vi.fn(() => ({
		version: 1,
		updatedAt: "2026-03-21T00:00:00.000Z",
		accounts: {
			Architect: {
				xp: 350,
				level: 3,
				coin: 200,
				tokens: 50,
				totalEarned: { xp: 350, coin: 200 },
				totalSpent: { coin: 0, tokens: 0 },
			},
		},
	})),
	writeLedger: vi.fn(),
	getAccount: vi.fn((ledger, agent) => {
		return ledger.accounts[agent] ?? { xp: 0, level: 1, coin: 0, tokens: 0, totalEarned: { xp: 0, coin: 0 }, totalSpent: { coin: 0, tokens: 0 } };
	}),
	creditReward: vi.fn((ledger, _agent, reward) => ({
		ledger,
		reward: { xp: reward.xp, coin: reward.coin, leveledUp: false, newLevel: undefined },
	})),
	grantResources: vi.fn((ledger, agent, grant) => ({
		...ledger,
		accounts: {
			...ledger.accounts,
			[agent]: {
				...( ledger.accounts[agent] ?? { xp: 0, level: 1, coin: 0, tokens: 0, totalEarned: { xp: 0, coin: 0 }, totalSpent: { coin: 0, tokens: 0 } }),
				coin: (ledger.accounts[agent]?.coin ?? 0) + (grant.coin ?? 0),
				tokens: (ledger.accounts[agent]?.tokens ?? 0) + (grant.tokens ?? 0),
			},
		},
	})),
	appendTransaction: vi.fn(),
}));

vi.mock("../../src/domain/economy/leveling.js", () => ({
	titleForLevel: vi.fn((level: number) => {
		const titles: Record<number, string> = { 1: "Novice", 2: "Apprentice", 3: "Journeyman", 4: "Artisan" };
		return titles[level] ?? "Unknown";
	}),
}));

// Mock additional domain modules (imported by economy:reward command)
vi.mock("../../src/domain/economy/economy-rules.js", () => ({
	calculateReward: vi.fn((base: { xp: number; coin: number }) => ({ xp: base.xp, coin: base.coin })),
}));
vi.mock("../../src/domain/tasks/task-store.js", () => ({
	taskStore: {
		list: vi.fn(() => []),
		read: vi.fn(() => undefined),
		create: vi.fn(),
		updateField: vi.fn(),
		remove: vi.fn(),
		countCompletedByAgent: vi.fn(() => 0),
	},
}));
vi.mock("../../src/domain/trust/trust-manager.js", () => ({
	loadTrustProfile: vi.fn(),
	saveTrustProfile: vi.fn(),
	checkAutoPromotion: vi.fn(() => ({ shouldPromote: false })),
	promote: vi.fn(),
}));

// Mock UI modules
vi.mock("../../src/ui/displays/economy-display.js", () => ({
	renderBalance: vi.fn(),
	renderLedger: vi.fn(),
	renderGrant: vi.fn(),
	renderReward: vi.fn(),
}));
vi.mock("../../src/ui/renderers/common-renderers.js", () => ({
	renderError: vi.fn(),
	renderNoProject: vi.fn(),
}));

// ── Imports ──────────────────────────────────────────────────────

import { commands } from "../../src/controller/economy.controller.js";
import { initializeDeps } from "../../src/infrastructure/command-engine.js";
import { readLedger, writeLedger, getAccount, grantResources, appendTransaction } from "../../src/domain/economy/economy-ledger.js";
import { disk } from "../../src/infrastructure/filesystem.js";
import { paths } from "../../src/infrastructure/paths.js";
import { clock } from "../../src/infrastructure/clock.js";
import { proc, pidOps } from "../../src/infrastructure/proc.js";
import { log } from "../../src/infrastructure/logger.js";

const logMock = log as ReturnType<typeof vi.fn>;
const diskMock = disk as unknown as Record<string, ReturnType<typeof vi.fn>>;

// ── Tests ────────────────────────────────────────────────────────

describe("economy.controller", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		initializeDeps({
			disk, paths, clock, proc, pidOps,
			shell: { run: vi.fn(), runSilent: vi.fn(), check: vi.fn(() => false) } as never,
			input: { ask: vi.fn() as never, askYesNo: vi.fn() as never, waitForEnter: vi.fn() as never, askAbortable: vi.fn() as never },
			bus: { emit: vi.fn(), on: vi.fn(), off: vi.fn(), clear: vi.fn() } as never,
			log, warn: vi.fn(),
			worldState: { load: vi.fn(), save: vi.fn(), update: vi.fn() } as never,
			workerManager: { start: vi.fn(), stop: vi.fn(), getWorker: vi.fn() } as never,
			processRunner: { spawn: vi.fn(), kill: vi.fn() } as never,
		});
	});

	// ── economy:balance ──────────────────────────────────────────
	describe("economy:balance", () => {
		it("is defined", () => {
			expect(commands["economy:balance"]).toBeDefined();
		});

		it("returns balance model as JSON", () => {
			commands["economy:balance"]({ agent: "Architect", format: "json" }, [], "economy:balance", undefined);

			expect(readLedger).toHaveBeenCalledOnce();
			expect(getAccount).toHaveBeenCalledOnce();
			expect(logMock).toHaveBeenCalledOnce();
			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("agent", "Architect");
			expect(output).toHaveProperty("xp", 350);
			expect(output).toHaveProperty("level", 3);
			expect(output).toHaveProperty("coin", 200);
			expect(output).toHaveProperty("tokens", 50);
		});

		it("includes title from levelForTitle", () => {
			commands["economy:balance"]({ agent: "Architect", format: "json" }, [], "economy:balance", undefined);

			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("title");
			expect(typeof output.title).toBe("string");
		});

		it("returns error when --agent flag is missing", () => {
			commands["economy:balance"]({ format: "json" }, [], "economy:balance", undefined);

			expect(readLedger).not.toHaveBeenCalled();
			expect(logMock).toHaveBeenCalledOnce();
			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("error");
			expect(output.error).toContain("--agent");
		});
	});

	// ── economy:ledger ───────────────────────────────────────────
	describe("economy:ledger", () => {
		it("is defined", () => {
			expect(commands["economy:ledger"]).toBeDefined();
		});

		it("returns empty entries when log file has no matching lines", () => {
			diskMock.existsSync.mockReturnValue(true);
			diskMock.readFileSync.mockReturnValue(
				JSON.stringify({ ts: "2026-03-21T00:00:00.000Z", agent: "Developer", type: "task-reward", xp: 50, coin: 25 }) + "\n"
			);

			commands["economy:ledger"]({ agent: "Architect", format: "json" }, [], "economy:ledger", undefined);

			expect(logMock).toHaveBeenCalledOnce();
			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("agent", "Architect");
			expect(output).toHaveProperty("entries");
			expect(output.entries).toHaveLength(0);
		});

		it("returns matching entries filtered by agent", () => {
			diskMock.existsSync.mockReturnValue(true);
			diskMock.readFileSync.mockReturnValue(
				JSON.stringify({ ts: "2026-03-21T00:00:00.000Z", agent: "Architect", type: "task-reward", xp: 50, coin: 25 }) + "\n" +
				JSON.stringify({ ts: "2026-03-21T01:00:00.000Z", agent: "Developer", type: "task-reward", xp: 100, coin: 50 }) + "\n" +
				JSON.stringify({ ts: "2026-03-21T02:00:00.000Z", agent: "Architect", type: "grant", coin: 100, tokens: 10 }) + "\n"
			);

			commands["economy:ledger"]({ agent: "Architect", format: "json" }, [], "economy:ledger", undefined);

			expect(logMock).toHaveBeenCalledOnce();
			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output.entries).toHaveLength(2);
			expect(output.entries[0]).toHaveProperty("agent", "Architect");
		});

		it("respects --limit flag", () => {
			const lines = Array.from({ length: 30 }, (_, i) =>
				JSON.stringify({ ts: `2026-03-21T${String(i).padStart(2, "0")}:00:00.000Z`, agent: "Architect", type: "task-reward", xp: 10 })
			).join("\n");
			diskMock.existsSync.mockReturnValue(true);
			diskMock.readFileSync.mockReturnValue(lines + "\n");

			commands["economy:ledger"]({ agent: "Architect", limit: "5", format: "json" }, [], "economy:ledger", undefined);

			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output.entries).toHaveLength(5);
		});

		it("returns empty entries when log file does not exist", () => {
			diskMock.existsSync.mockReturnValue(false);

			commands["economy:ledger"]({ agent: "Architect", format: "json" }, [], "economy:ledger", undefined);

			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output.entries).toHaveLength(0);
		});

		it("returns error when --agent flag is missing", () => {
			commands["economy:ledger"]({ format: "json" }, [], "economy:ledger", undefined);

			expect(logMock).toHaveBeenCalledOnce();
			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("error");
			expect(output.error).toContain("--agent");
		});
	});

	// ── economy:grant ────────────────────────────────────────────
	describe("economy:grant", () => {
		it("is defined", () => {
			expect(commands["economy:grant"]).toBeDefined();
		});

		it("grants resources and returns model as JSON", () => {
			commands["economy:grant"]({ agent: "Architect", coin: "100", tokens: "20", format: "json" }, [], "economy:grant", undefined);

			expect(readLedger).toHaveBeenCalledOnce();
			expect(grantResources).toHaveBeenCalledOnce();
			expect(writeLedger).toHaveBeenCalledOnce();
			expect(appendTransaction).toHaveBeenCalledOnce();
			expect(logMock).toHaveBeenCalledOnce();
			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("agent", "Architect");
			expect(output).toHaveProperty("coin", 100);
			expect(output).toHaveProperty("tokens", 20);
		});

		it("appends a grant transaction with correct type", () => {
			commands["economy:grant"]({ agent: "Architect", coin: "50", tokens: "5", format: "json" }, [], "economy:grant", undefined);

			expect(appendTransaction).toHaveBeenCalledOnce();
			const tx = (appendTransaction as ReturnType<typeof vi.fn>).mock.calls[0][2];
			expect(tx).toHaveProperty("type", "grant");
			expect(tx).toHaveProperty("agent", "Architect");
			expect(tx).toHaveProperty("coin", 50);
			expect(tx).toHaveProperty("tokens", 5);
		});

		it("returns error when --agent flag is missing", () => {
			commands["economy:grant"]({ coin: "100", format: "json" }, [], "economy:grant", undefined);

			expect(readLedger).not.toHaveBeenCalled();
			expect(logMock).toHaveBeenCalledOnce();
			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("error");
			expect(output.error).toContain("--agent");
		});

		it("defaults coin and tokens to 0 when not provided", () => {
			commands["economy:grant"]({ agent: "Architect", format: "json" }, [], "economy:grant", undefined);

			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("coin", 0);
			expect(output).toHaveProperty("tokens", 0);
		});
	});
});
