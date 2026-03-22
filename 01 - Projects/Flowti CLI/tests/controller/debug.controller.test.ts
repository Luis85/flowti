/**
 * debug.controller.test.ts — Tests for debug CLI commands.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks (must come BEFORE imports) ─────────────────────────────

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
		dirname: vi.fn((p: string) => p.split("/").slice(0, -1).join("/") || "/"),
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
				xp: 350, level: 3, coin: 200, tokens: 50,
				totalEarned: { xp: 350, coin: 200 },
				totalSpent: { coin: 0, tokens: 0 },
			},
		},
	})),
	writeLedger: vi.fn(),
	appendTransaction: vi.fn(),
}));

vi.mock("../../src/domain/economy/leveling.js", () => ({
	levelForXp: vi.fn((xp: number) => Math.floor(xp / 100) + 1),
}));

vi.mock("../../src/domain/trust/trust-manager.js", () => ({
	loadTrustProfile: vi.fn(() => ({
		tier: "supervised",
		operations: { Read: "review", Write: "manual" },
		promotionLog: [],
	})),
	saveTrustProfile: vi.fn(),
}));

// Mock UI modules
vi.mock("../../src/ui/displays/debug-display.js", () => ({
	renderDebugSet: vi.fn(),
	renderDebugTrust: vi.fn(),
	renderDebugNeeds: vi.fn(),
	renderDebugUnlock: vi.fn(),
}));
vi.mock("../../src/ui/renderers/common-renderers.js", () => ({
	renderError: vi.fn(),
	renderNoProject: vi.fn(),
}));

// ── Imports ──────────────────────────────────────────────────────

import { commands } from "../../src/controller/debug.controller.js";
import { initializeDeps } from "../../src/infrastructure/command-engine.js";
import { readLedger, writeLedger, appendTransaction } from "../../src/domain/economy/economy-ledger.js";
import { loadTrustProfile, saveTrustProfile } from "../../src/domain/trust/trust-manager.js";
import { disk } from "../../src/infrastructure/filesystem.js";
import { paths } from "../../src/infrastructure/paths.js";
import { clock } from "../../src/infrastructure/clock.js";
import { proc, pidOps } from "../../src/infrastructure/proc.js";
import { log } from "../../src/infrastructure/logger.js";

const logMock = log as ReturnType<typeof vi.fn>;
const diskMock = disk as unknown as Record<string, ReturnType<typeof vi.fn>>;

const mockWorldState = {
	emitAction: vi.fn(),
	updateEntity: vi.fn(),
	getState: vi.fn(() => ({ version: 1 as const, updatedAt: "", entities: {}, permissions: {}, activityLog: [] })),
	getEntity: vi.fn(() => null),
	flush: vi.fn(),
	addActionListener: vi.fn(),
	removeActionListener: vi.fn(),
};

// ── Tests ────────────────────────────────────────────────────────

describe("debug.controller", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		diskMock.existsSync.mockReturnValue(false);
		initializeDeps({
			disk, paths, clock, proc, pidOps,
			shell: { run: vi.fn(), runSilent: vi.fn(), check: vi.fn(() => false) } as never,
			input: { ask: vi.fn() as never, askYesNo: vi.fn() as never, waitForEnter: vi.fn() as never, askAbortable: vi.fn() as never },
			bus: { emit: vi.fn(), on: vi.fn(), off: vi.fn(), clear: vi.fn() } as never,
			log, warn: vi.fn(),
			worldState: mockWorldState,
			workerManager: {
				spawn: vi.fn(() => null),
				spawnAll: vi.fn(),
				stop: vi.fn(),
				stopAll: vi.fn(),
				prime: vi.fn(),
				getWorker: vi.fn(() => null),
				listWorkers: vi.fn(() => []),
				send: vi.fn(),
				dispatchWorldEvent: vi.fn(),
			},
			processRunner: {
				spawn: vi.fn(() => ({
					onEvent: vi.fn(),
					result: Promise.resolve({ text: "", thinking: "", exitCode: 0 }),
					kill: vi.fn(),
				})),
			},
		});
	});

	// ── debug:set ─────────────────────────────────────────────────
	describe("debug:set", () => {
		it("is defined", () => {
			expect(commands["debug:set"]).toBeDefined();
		});

		it("overwrites xp and coin and returns changes as JSON", () => {
			commands["debug:set"]({ agent: "Architect", xp: "500", coin: "300", level: "-1", format: "json" }, [], "debug:set", undefined);

			expect(readLedger).toHaveBeenCalledOnce();
			expect(writeLedger).toHaveBeenCalledOnce();
			expect(appendTransaction).toHaveBeenCalledOnce();

			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("agent", "Architect");
			expect(output).toHaveProperty("changes");
			expect(output.changes).toContain("xp=500");
			expect(output.changes).toContain("coin=300");
		});

		it("logs debug transaction type", () => {
			commands["debug:set"]({ agent: "Architect", xp: "100", coin: "-1", level: "-1", format: "json" }, [], "debug:set", undefined);

			const tx = (appendTransaction as ReturnType<typeof vi.fn>).mock.calls[0][2];
			expect(tx).toHaveProperty("type", "debug");
			expect(tx).toHaveProperty("agent", "Architect");
		});

		it("does not include unchanged fields in changes array", () => {
			commands["debug:set"]({ agent: "Architect", xp: "-1", coin: "50", level: "-1", format: "json" }, [], "debug:set", undefined);

			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output.changes).not.toContain("xp");
			expect(output.changes).toContain("coin=50");
		});

		it("returns error when --agent is missing", () => {
			commands["debug:set"]({ xp: "100", format: "json" }, [], "debug:set", undefined);

			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("error");
			expect(output.error).toContain("--agent");
		});
	});

	// ── debug:trust ───────────────────────────────────────────────
	describe("debug:trust", () => {
		it("is defined", () => {
			expect(commands["debug:trust"]).toBeDefined();
		});

		it("sets trust level and returns model as JSON", () => {
			commands["debug:trust"]({ agent: "Architect", op: "Read", to: "auto", format: "json" }, [], "debug:trust", undefined);

			expect(loadTrustProfile).toHaveBeenCalledOnce();
			expect(saveTrustProfile).toHaveBeenCalledOnce();

			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("agent", "Architect");
			expect(output).toHaveProperty("op", "Read");
			expect(output).toHaveProperty("from", "review");
			expect(output).toHaveProperty("to", "auto");
		});

		it("logs debug transaction", () => {
			commands["debug:trust"]({ agent: "Architect", op: "Write", to: "review", format: "json" }, [], "debug:trust", undefined);

			expect(appendTransaction).toHaveBeenCalledOnce();
			const tx = (appendTransaction as ReturnType<typeof vi.fn>).mock.calls[0][2];
			expect(tx).toHaveProperty("type", "debug");
		});

		it("returns error when --agent is missing", () => {
			commands["debug:trust"]({ op: "Read", to: "auto", format: "json" }, [], "debug:trust", undefined);

			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("error");
			expect(output.error).toContain("--agent");
		});
	});

	// ── debug:needs ───────────────────────────────────────────────
	describe("debug:needs", () => {
		it("is defined", () => {
			expect(commands["debug:needs"]).toBeDefined();
		});

		it("updates world state entity and returns model as JSON", () => {
			commands["debug:needs"]({ agent: "Architect", energy: "80", hunger: "60", thirst: "-1", format: "json" }, [], "debug:needs", undefined);

			expect(mockWorldState.updateEntity).toHaveBeenCalledOnce();
			const [entityId, entityType, components] = mockWorldState.updateEntity.mock.calls[0];
			expect(entityId).toBe("Architect");
			expect(entityType).toBe("agent");
			expect(components).toHaveProperty("energy", 80);
			expect(components).toHaveProperty("hunger", 60);
			expect(components).not.toHaveProperty("thirst");

			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("agent", "Architect");
			expect(output).toHaveProperty("energy", 80);
			expect(output).not.toHaveProperty("thirst");
		});

		it("logs debug transaction", () => {
			commands["debug:needs"]({ agent: "Architect", energy: "50", hunger: "-1", thirst: "-1", format: "json" }, [], "debug:needs", undefined);

			expect(appendTransaction).toHaveBeenCalledOnce();
			const tx = (appendTransaction as ReturnType<typeof vi.fn>).mock.calls[0][2];
			expect(tx).toHaveProperty("type", "debug");
		});

		it("returns error when --agent is missing", () => {
			commands["debug:needs"]({ energy: "80", format: "json" }, [], "debug:needs", undefined);

			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("error");
			expect(output.error).toContain("--agent");
		});
	});

	// ── debug:unlock ──────────────────────────────────────────────
	describe("debug:unlock", () => {
		it("is defined", () => {
			expect(commands["debug:unlock"]).toBeDefined();
		});

		it("writes capability to agent companion JSON and returns ok model", () => {
			diskMock.existsSync.mockReturnValue(false); // no existing JSON

			commands["debug:unlock"]({ agent: "Architect", capability: "LLM-Caller", format: "json" }, [], "debug:unlock", undefined);

			expect(diskMock.writeFileSync).toHaveBeenCalledOnce();
			const writtenContent = diskMock.writeFileSync.mock.calls[0][1] as string;
			const parsed = JSON.parse(writtenContent) as { components: Array<{ name: string }> };
			expect(parsed.components).toHaveLength(1);
			expect(parsed.components[0].name).toBe("LLM-Caller");

			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("ok", true);
			expect(output).toHaveProperty("capability", "LLM-Caller");
		});

		it("does not duplicate capability if already present", () => {
			diskMock.existsSync.mockReturnValue(true);
			diskMock.readFileSync.mockReturnValue(JSON.stringify({
				components: [{ name: "LLM-Caller", type: "capability" }],
			}));

			commands["debug:unlock"]({ agent: "Architect", capability: "LLM-Caller", format: "json" }, [], "debug:unlock", undefined);

			const writtenContent = diskMock.writeFileSync.mock.calls[0][1] as string;
			const parsed = JSON.parse(writtenContent) as { components: Array<{ name: string }> };
			const matches = parsed.components.filter(c => c.name === "LLM-Caller");
			expect(matches).toHaveLength(1);
		});

		it("logs debug transaction", () => {
			commands["debug:unlock"]({ agent: "Architect", capability: "Tool-Caller", format: "json" }, [], "debug:unlock", undefined);

			expect(appendTransaction).toHaveBeenCalledOnce();
			const tx = (appendTransaction as ReturnType<typeof vi.fn>).mock.calls[0][2];
			expect(tx).toHaveProperty("type", "debug");
		});

		it("returns error when --agent is missing", () => {
			commands["debug:unlock"]({ capability: "LLM-Caller", format: "json" }, [], "debug:unlock", undefined);

			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("error");
			expect(output.error).toContain("--agent");
		});
	});
});
