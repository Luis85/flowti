/**
 * economy-reward.test.ts — Tests for the economy:reward CLI command.
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
		accounts: {},
	})),
	writeLedger: vi.fn(),
	getAccount: vi.fn((_ledger: unknown, _agent: string) => ({
		xp: 60, level: 1, coin: 30, tokens: 0,
		totalEarned: { xp: 60, coin: 30 },
		totalSpent: { coin: 0, tokens: 0 },
	})),
	creditReward: vi.fn((_ledger: unknown, _agent: string, reward: { xp: number; coin: number }) => ({
		ledger: { version: 1, updatedAt: "", accounts: {} },
		reward: { xp: reward.xp, coin: reward.coin, leveledUp: false, newLevel: undefined },
	})),
	grantResources: vi.fn(),
	appendTransaction: vi.fn(),
}));
vi.mock("../../src/domain/economy/economy-rules.js", () => ({
	calculateReward: vi.fn((base: { xp: number; coin: number }) => ({ xp: base.xp, coin: base.coin })),
}));
vi.mock("../../src/domain/economy/leveling.js", () => ({
	titleForLevel: vi.fn((level: number) => {
		const titles: Record<number, string> = { 1: "Novice", 2: "Apprentice", 3: "Journeyman" };
		return titles[level] ?? "Unknown";
	}),
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
import { creditReward, writeLedger, appendTransaction } from "../../src/domain/economy/economy-ledger.js";
import { disk } from "../../src/infrastructure/filesystem.js";
import { paths } from "../../src/infrastructure/paths.js";
import { clock } from "../../src/infrastructure/clock.js";
import { proc } from "../../src/infrastructure/proc.js";
import { log } from "../../src/infrastructure/logger.js";

const logMock = log as ReturnType<typeof vi.fn>;

// ── Tests ────────────────────────────────────────────────────────

describe("economy:reward", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		initializeDeps({
			disk, paths, clock, proc,
			shell: { run: vi.fn(), runSilent: vi.fn(), check: vi.fn(() => false) } as never,
			input: { ask: vi.fn() as never, askYesNo: vi.fn() as never, waitForEnter: vi.fn() as never, askAbortable: vi.fn() as never },
			bus: { emit: vi.fn(), on: vi.fn(), off: vi.fn(), clear: vi.fn() } as never,
			log, warn: vi.fn(),
			worldState: { load: vi.fn(), save: vi.fn(), update: vi.fn() } as never,
			workerManager: { start: vi.fn(), stop: vi.fn(), getWorker: vi.fn() } as never,
			processRunner: { spawn: vi.fn(), kill: vi.fn() } as never,
		});
	});

	it("command is defined", () => {
		expect(commands["economy:reward"]).toBeDefined();
	});

	it("credits reward and returns model as JSON", () => {
		commands["economy:reward"]({ agent: "auditor", xp: "100", coin: "50", format: "json" }, [], "economy:reward", undefined);

		expect(creditReward).toHaveBeenCalledOnce();
		expect(writeLedger).toHaveBeenCalledOnce();
		expect(appendTransaction).toHaveBeenCalledOnce();
		expect(logMock).toHaveBeenCalledOnce();
		const output = JSON.parse(logMock.mock.calls[0][0] as string);
		expect(output).toHaveProperty("agent", "auditor");
		expect(output).toHaveProperty("xp");
		expect(output).toHaveProperty("coin");
		expect(output).toHaveProperty("totalXp");
		expect(output).toHaveProperty("totalCoin");
		expect(output).toHaveProperty("level");
	});

	it("returns error when --agent flag is missing", () => {
		commands["economy:reward"]({ xp: "100", format: "json" }, [], "economy:reward", undefined);

		expect(creditReward).not.toHaveBeenCalled();
		expect(logMock).toHaveBeenCalledOnce();
		const output = JSON.parse(logMock.mock.calls[0][0] as string);
		expect(output).toHaveProperty("error");
		expect(output.error).toContain("--agent");
	});

	it("logs transaction with type task-reward", () => {
		commands["economy:reward"]({ agent: "auditor", xp: "50", coin: "25", format: "json" }, [], "economy:reward", undefined);

		expect(appendTransaction).toHaveBeenCalledOnce();
		const tx = (appendTransaction as ReturnType<typeof vi.fn>).mock.calls[0][2];
		expect(tx).toHaveProperty("type", "task-reward");
		expect(tx).toHaveProperty("agent", "auditor");
	});
});
