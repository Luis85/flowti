/**
 * trust.controller.test.ts — Tests for trust management CLI commands.
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
const mockProfile = {
	tier: "supervised" as const,
	operations: {
		"vault-read": "auto" as const,
		"vault-search": "auto" as const,
		"vault-tag": "review" as const,
		"vault-create": "review" as const,
		"vault-edit": "manual" as const,
		"vault-move": "manual" as const,
		"vault-link": "review" as const,
	},
	promotionLog: [
		{ op: "vault-tag", from: "manual" as const, to: "review" as const, at: "2026-03-20T00:00:00.000Z", reason: "good behavior" },
	],
	successCounts: { "vault-read": 5, "vault-search": 3 },
};

vi.mock("../../src/domain/trust/trust-manager.js", () => ({
	loadTrustProfile: vi.fn(() => mockProfile),
	saveTrustProfile: vi.fn(),
	promote: vi.fn((_profile, op, to, reason, _clock) => ({
		...mockProfile,
		operations: { ...mockProfile.operations, [op]: to },
		promotionLog: [...mockProfile.promotionLog, { op, from: mockProfile.operations[op as keyof typeof mockProfile.operations] ?? "manual", to, at: "2026-03-21T00:00:00.000Z", reason }],
	})),
	demote: vi.fn((_profile, op, to, reason, _clock) => ({
		...mockProfile,
		operations: { ...mockProfile.operations, [op]: to },
		promotionLog: [...mockProfile.promotionLog, { op, from: mockProfile.operations[op as keyof typeof mockProfile.operations] ?? "auto", to, at: "2026-03-21T00:00:00.000Z", reason }],
	})),
}));

// Mock UI modules
vi.mock("../../src/ui/displays/trust-display.js", () => ({
	renderTrustProfile: vi.fn(),
	renderTrustUpdated: vi.fn(),
	renderTrustHistory: vi.fn(),
	renderTrustReset: vi.fn(),
}));
vi.mock("../../src/ui/renderers/common-renderers.js", () => ({
	renderError: vi.fn(),
	renderNoProject: vi.fn(),
}));

// ── Imports ──────────────────────────────────────────────────────

import { commands } from "../../src/controller/trust.controller.js";
import { initializeDeps } from "../../src/infrastructure/command-engine.js";
import { loadTrustProfile, saveTrustProfile, promote, demote } from "../../src/domain/trust/trust-manager.js";
import { disk } from "../../src/infrastructure/filesystem.js";
import { paths } from "../../src/infrastructure/paths.js";
import { clock } from "../../src/infrastructure/clock.js";
import { proc } from "../../src/infrastructure/proc.js";
import { log } from "../../src/infrastructure/logger.js";

const logMock = log as ReturnType<typeof vi.fn>;

// ── Tests ────────────────────────────────────────────────────────

describe("trust.controller", () => {
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

	// ── trust:show ───────────────────────────────────────────────
	describe("trust:show", () => {
		it("is defined", () => {
			expect(commands["trust:show"]).toBeDefined();
		});

		it("returns trust profile as JSON", () => {
			commands["trust:show"]({ agent: "Architect", format: "json" }, [], "trust:show", undefined);

			expect(loadTrustProfile).toHaveBeenCalledOnce();
			expect(logMock).toHaveBeenCalledOnce();
			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("agent", "Architect");
			expect(output).toHaveProperty("tier", "supervised");
			expect(output).toHaveProperty("operations");
			expect(Array.isArray(output.operations)).toBe(true);
			expect(output.operations.length).toBeGreaterThan(0);
		});

		it("returns error when --agent flag is missing", () => {
			commands["trust:show"]({ format: "json" }, [], "trust:show", undefined);

			expect(loadTrustProfile).not.toHaveBeenCalled();
			expect(logMock).toHaveBeenCalledOnce();
			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("error");
			expect(output.error).toContain("--agent");
		});
	});

	// ── trust:promote ────────────────────────────────────────────
	describe("trust:promote", () => {
		it("is defined", () => {
			expect(commands["trust:promote"]).toBeDefined();
		});

		it("promotes trust level and returns updated model as JSON", () => {
			commands["trust:promote"]({ agent: "Architect", op: "vault-edit", to: "review", format: "json" }, [], "trust:promote", undefined);

			expect(loadTrustProfile).toHaveBeenCalledOnce();
			expect(promote).toHaveBeenCalledOnce();
			expect(saveTrustProfile).toHaveBeenCalledOnce();
			expect(logMock).toHaveBeenCalledOnce();
			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("agent", "Architect");
			expect(output).toHaveProperty("op", "vault-edit");
			expect(output).toHaveProperty("to", "review");
			expect(output).toHaveProperty("action", "promote");
		});

		it("returns error when --agent flag is missing", () => {
			commands["trust:promote"]({ op: "vault-edit", to: "review", format: "json" }, [], "trust:promote", undefined);

			expect(promote).not.toHaveBeenCalled();
			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("error");
			expect(output.error).toContain("--agent");
		});
	});

	// ── trust:demote ─────────────────────────────────────────────
	describe("trust:demote", () => {
		it("is defined", () => {
			expect(commands["trust:demote"]).toBeDefined();
		});

		it("demotes trust level and returns updated model as JSON", () => {
			commands["trust:demote"]({ agent: "Architect", op: "vault-create", to: "manual", format: "json" }, [], "trust:demote", undefined);

			expect(loadTrustProfile).toHaveBeenCalledOnce();
			expect(demote).toHaveBeenCalledOnce();
			expect(saveTrustProfile).toHaveBeenCalledOnce();
			expect(logMock).toHaveBeenCalledOnce();
			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("agent", "Architect");
			expect(output).toHaveProperty("op", "vault-create");
			expect(output).toHaveProperty("to", "manual");
			expect(output).toHaveProperty("action", "demote");
		});

		it("returns error when --op flag is missing", () => {
			commands["trust:demote"]({ agent: "Architect", to: "manual", format: "json" }, [], "trust:demote", undefined);

			expect(demote).not.toHaveBeenCalled();
			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("error");
			expect(output.error).toContain("--op");
		});
	});

	// ── trust:reset ─────────────────────────────────────────────
	describe("trust:reset", () => {
		it("is defined", () => {
			expect(commands["trust:reset"]).toBeDefined();
		});

		it("resets operations to defaults and clears counts", () => {
			commands["trust:reset"]({ agent: "Architect", format: "json" }, [], "trust:reset", undefined);

			expect(loadTrustProfile).toHaveBeenCalledOnce();
			expect(saveTrustProfile).toHaveBeenCalledOnce();
			expect(logMock).toHaveBeenCalledOnce();
			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("agent", "Architect");
			expect(output.operations).toEqual({
				"vault-read": "auto",
				"vault-search": "auto",
				"vault-tag": "review",
				"vault-create": "review",
				"vault-edit": "manual",
				"vault-move": "manual",
				"vault-link": "review",
			});
			expect(output.successCounts).toEqual({});
			expect(output.promotionLog).toHaveLength(1);
		});

		it("preserves promotion log for audit trail", () => {
			commands["trust:reset"]({ agent: "Architect", format: "json" }, [], "trust:reset", undefined);

			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output.promotionLog[0]).toHaveProperty("op", "vault-tag");
			expect(output.promotionLog[0]).toHaveProperty("reason", "good behavior");
		});

		it("returns error when --agent flag is missing", () => {
			commands["trust:reset"]({ format: "json" }, [], "trust:reset", undefined);

			expect(loadTrustProfile).not.toHaveBeenCalled();
			expect(logMock).toHaveBeenCalledOnce();
			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("error");
			expect(output.error).toContain("--agent");
		});
	});

	// ── trust:history ────────────────────────────────────────────
	describe("trust:history", () => {
		it("is defined", () => {
			expect(commands["trust:history"]).toBeDefined();
		});

		it("returns promotion log as JSON", () => {
			commands["trust:history"]({ agent: "Architect", format: "json" }, [], "trust:history", undefined);

			expect(loadTrustProfile).toHaveBeenCalledOnce();
			expect(logMock).toHaveBeenCalledOnce();
			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("agent", "Architect");
			expect(output).toHaveProperty("entries");
			expect(output.entries).toHaveLength(1);
			expect(output.entries[0]).toHaveProperty("op", "vault-tag");
			expect(output.entries[0]).toHaveProperty("reason", "good behavior");
		});

		it("returns error when --agent flag is missing", () => {
			commands["trust:history"]({ format: "json" }, [], "trust:history", undefined);

			expect(loadTrustProfile).not.toHaveBeenCalled();
			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("error");
			expect(output.error).toContain("--agent");
		});
	});
});
