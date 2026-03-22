/**
 * vault.controller.test.ts — Tests for vault CLI commands.
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
		renameSync: vi.fn(),
		statSync: vi.fn(() => ({ mtimeMs: 0 })),
		rmSync: vi.fn(),
		copyFileSync: vi.fn(),
	},
}));
vi.mock("../../src/infrastructure/paths.js", () => ({
	paths: {
		join: vi.fn((...args: string[]) => args.join("/")),
		resolve: vi.fn((...args: string[]) => args.join("/")),
		relative: vi.fn((_a: string, b: string) => b),
		dirname: vi.fn((p: string) => {
			const idx = p.lastIndexOf("/");
			return idx === -1 ? "." : p.slice(0, idx);
		}),
		basename: vi.fn((p: string) => p.split("/").pop() ?? p),
	},
}));
vi.mock("../../src/infrastructure/clock.js", () => ({
	clock: { iso: () => "2026-03-22T00:00:00.000Z", now: () => new Date("2026-03-22"), ms: () => 0, safeIso: () => "2026-03-22T000000" },
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
vi.mock("../../src/domain/vault-ops/vault-executor.js", () => ({
	executeVaultOp: vi.fn(() => ({
		result: { outcome: "executed", operation: "vault-read", agentName: "auditor", data: {} },
		profile: {
			tier: "supervised",
			operations: {
				"vault-read": "auto", "vault-search": "auto", "vault-tag": "review",
				"vault-create": "review", "vault-edit": "manual", "vault-move": "manual", "vault-link": "review",
			},
			promotionLog: [],
			successCounts: {},
		},
		ledger: { version: 1, updatedAt: "", accounts: {} },
	})),
	validateRequest: vi.fn(() => ({ valid: true })),
}));

vi.mock("../../src/domain/vault-ops/vault-context.js", () => ({
	buildVaultContext: vi.fn(() => ({
		folderMap: [{ path: "docs", noteCount: 5 }],
		tagIndex: [{ tag: "project", count: 3 }],
		recentChanges: [{ path: "docs/readme.md", action: "modified", at: "2026-03-22T00:00:00.000Z" }],
	})),
	invalidateContextCache: vi.fn(),
}));

vi.mock("../../src/domain/vault-ops/standing-order-evaluator.js", () => ({
	evaluateEvent: vi.fn(() => []),
}));

vi.mock("../../src/domain/tasks/task-store.js", () => ({
	taskStore: { list: vi.fn(() => []) },
}));

vi.mock("../../src/domain/vault-ops/frontmatter.js", () => ({
	parseFrontmatter: vi.fn(() => ({ frontmatter: {}, body: "" })),
}));

vi.mock("../../src/domain/trust/trust-manager.js", () => ({
	loadTrustProfile: vi.fn(() => ({
		tier: "supervised",
		operations: {
			"vault-read": "auto", "vault-search": "auto", "vault-tag": "review",
			"vault-create": "review", "vault-edit": "manual", "vault-move": "manual", "vault-link": "review",
		},
		promotionLog: [],
		successCounts: {},
	})),
	saveTrustProfile: vi.fn(),
}));

vi.mock("../../src/domain/economy/economy-ledger.js", () => ({
	readLedger: vi.fn(() => ({ version: 1, updatedAt: "", accounts: {} })),
	writeLedger: vi.fn(),
}));

// Mock UI modules
vi.mock("../../src/ui/displays/vault-display.js", () => ({
	renderVaultExecResult: vi.fn(),
	renderVaultContext: vi.fn(),
	renderEvaluateResult: vi.fn(),
}));
vi.mock("../../src/ui/renderers/common-renderers.js", () => ({
	renderError: vi.fn(),
	renderNoProject: vi.fn(),
}));

// ── Imports ──────────────────────────────────────────────────────

import { commands } from "../../src/controller/vault.controller.js";
import { initializeDeps } from "../../src/infrastructure/command-engine.js";
import { executeVaultOp } from "../../src/domain/vault-ops/vault-executor.js";
import { buildVaultContext, invalidateContextCache } from "../../src/domain/vault-ops/vault-context.js";
import { evaluateEvent } from "../../src/domain/vault-ops/standing-order-evaluator.js";
import { loadTrustProfile, saveTrustProfile } from "../../src/domain/trust/trust-manager.js";
import { readLedger, writeLedger } from "../../src/domain/economy/economy-ledger.js";
import { parseFrontmatter } from "../../src/domain/vault-ops/frontmatter.js";
import { disk } from "../../src/infrastructure/filesystem.js";
import { paths } from "../../src/infrastructure/paths.js";
import { clock } from "../../src/infrastructure/clock.js";
import { proc } from "../../src/infrastructure/proc.js";
import { log } from "../../src/infrastructure/logger.js";

const logMock = log as ReturnType<typeof vi.fn>;

// ── Tests ────────────────────────────────────────────────────────

describe("vault.controller", () => {
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

	// ── vault:exec ──────────────────────────────────────────────
	describe("vault:exec", () => {
		it("is defined", () => {
			expect(commands["vault:exec"]).toBeDefined();
		});

		it("executes a vault-read operation and returns result as JSON", () => {
			commands["vault:exec"](
				{ agent: "auditor", op: "vault-read", path: "docs/readme.md", format: "json" },
				[], "vault:exec", undefined,
			);

			expect(loadTrustProfile).toHaveBeenCalledOnce();
			expect(readLedger).toHaveBeenCalledOnce();
			expect(executeVaultOp).toHaveBeenCalledOnce();
			expect(saveTrustProfile).toHaveBeenCalledOnce();
			expect(writeLedger).toHaveBeenCalledOnce();
			expect(logMock).toHaveBeenCalledOnce();
			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("outcome", "executed");
			expect(output).toHaveProperty("operation", "vault-read");
			expect(output).toHaveProperty("agentName", "auditor");
		});

		it("returns error when --agent flag is missing", () => {
			commands["vault:exec"](
				{ op: "vault-read", path: "docs/readme.md", format: "json" },
				[], "vault:exec", undefined,
			);

			expect(executeVaultOp).not.toHaveBeenCalled();
			expect(logMock).toHaveBeenCalledOnce();
			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("error");
			expect(output.error).toContain("--agent");
		});

		it("returns error when --op flag is missing", () => {
			commands["vault:exec"](
				{ agent: "auditor", format: "json" },
				[], "vault:exec", undefined,
			);

			expect(executeVaultOp).not.toHaveBeenCalled();
			expect(logMock).toHaveBeenCalledOnce();
			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("error");
			expect(output.error).toContain("--op");
		});

		it("throws on invalid operation", () => {
			expect(() => {
				commands["vault:exec"](
					{ agent: "auditor", op: "invalid-op", path: "docs/readme.md", format: "json" },
					[], "vault:exec", undefined,
				);
			}).toThrow("Invalid vault operation");

			expect(executeVaultOp).not.toHaveBeenCalled();
		});

		it("passes task flag as taskId", () => {
			commands["vault:exec"](
				{ agent: "auditor", op: "vault-read", path: "docs/readme.md", task: "task-42", format: "json" },
				[], "vault:exec", undefined,
			);

			expect(executeVaultOp).toHaveBeenCalledOnce();
			const request = (executeVaultOp as ReturnType<typeof vi.fn>).mock.calls[0][0];
			expect(request).toHaveProperty("taskId", "task-42");
		});

		it("with bypass-trust, passes a profile where all operations are auto", () => {
			commands["vault:exec"](
				{ agent: "auditor", op: "vault-read", path: "docs/readme.md", "bypass-trust": true, format: "json" },
				[], "vault:exec", undefined,
			);

			expect(executeVaultOp).toHaveBeenCalledOnce();
			const profile = (executeVaultOp as ReturnType<typeof vi.fn>).mock.calls[0][2];
			for (const level of Object.values(profile.operations)) {
				expect(level).toBe("auto");
			}
		});

		it("without bypass-trust, passes profile unchanged", () => {
			commands["vault:exec"](
				{ agent: "auditor", op: "vault-read", path: "docs/readme.md", format: "json" },
				[], "vault:exec", undefined,
			);

			expect(executeVaultOp).toHaveBeenCalledOnce();
			const profile = (executeVaultOp as ReturnType<typeof vi.fn>).mock.calls[0][2];
			expect(profile.operations["vault-edit"]).toBe("manual");
			expect(profile.operations["vault-tag"]).toBe("review");
			expect(profile.operations["vault-read"]).toBe("auto");
		});

		it("invalidates cache after a write operation executes", () => {
			(executeVaultOp as ReturnType<typeof vi.fn>).mockReturnValue({
				result: { outcome: "executed", operation: "vault-create", agentName: "auditor", data: {} },
				profile: {
					tier: "supervised",
					operations: {
						"vault-read": "auto", "vault-search": "auto", "vault-tag": "review",
						"vault-create": "auto", "vault-edit": "manual", "vault-move": "manual", "vault-link": "review",
					},
					promotionLog: [],
					successCounts: {},
				},
				ledger: { version: 1, updatedAt: "", accounts: {} },
			});

			commands["vault:exec"](
				{ agent: "auditor", op: "vault-create", path: "docs/new.md", body: "test", format: "json" },
				[], "vault:exec", undefined,
			);

			expect(invalidateContextCache).toHaveBeenCalledOnce();
		});

		it("does not invalidate cache after a read operation executes", () => {
			commands["vault:exec"](
				{ agent: "auditor", op: "vault-read", path: "docs/readme.md", format: "json" },
				[], "vault:exec", undefined,
			);

			expect(invalidateContextCache).not.toHaveBeenCalled();
		});
	});

	// ── vault:context ───────────────────────────────────────────
	describe("vault:context", () => {
		it("is defined", () => {
			expect(commands["vault:context"]).toBeDefined();
		});

		it("returns vault context as JSON", () => {
			commands["vault:context"](
				{ agent: "auditor", format: "json" },
				[], "vault:context", undefined,
			);

			expect(buildVaultContext).toHaveBeenCalledOnce();
			expect(logMock).toHaveBeenCalledOnce();
			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("folderMap");
			expect(output).toHaveProperty("tagIndex");
			expect(output).toHaveProperty("recentChanges");
		});

		it("invalidates cache when --rebuild is set", () => {
			commands["vault:context"](
				{ agent: "auditor", rebuild: true, format: "json" },
				[], "vault:context", undefined,
			);

			expect(invalidateContextCache).toHaveBeenCalledOnce();
			expect(buildVaultContext).toHaveBeenCalledOnce();
		});

		it("does not invalidate cache by default", () => {
			commands["vault:context"](
				{ agent: "auditor", format: "json" },
				[], "vault:context", undefined,
			);

			expect(invalidateContextCache).not.toHaveBeenCalled();
			expect(buildVaultContext).toHaveBeenCalledOnce();
		});

		it("returns error when --agent flag is missing", () => {
			commands["vault:context"](
				{ format: "json" },
				[], "vault:context", undefined,
			);

			expect(buildVaultContext).not.toHaveBeenCalled();
			expect(logMock).toHaveBeenCalledOnce();
			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("error");
			expect(output.error).toContain("--agent");
		});

		it("passes vaultScope from agent frontmatter to buildVaultContext", () => {
			const mockDisk = disk as unknown as Record<string, ReturnType<typeof vi.fn>>;
			mockDisk.existsSync.mockReturnValue(true);
			mockDisk.readFileSync.mockReturnValue("---\nvaultScope:\n  folders:\n  - docs\n  tags:\n  - project\n---\nBody");
			(parseFrontmatter as ReturnType<typeof vi.fn>).mockReturnValue({
				frontmatter: { vaultScope: { folders: ["docs"], tags: ["project"] } },
				body: "Body",
			});

			commands["vault:context"](
				{ agent: "scoped-agent", format: "json" },
				[], "vault:context", undefined,
			);

			expect(buildVaultContext).toHaveBeenCalledOnce();
			const scopeArg = (buildVaultContext as ReturnType<typeof vi.fn>).mock.calls[0][1];
			expect(scopeArg).toEqual({ folders: ["docs"], tags: ["project"] });
		});

		it("passes undefined scope when agent has no vaultScope", () => {
			const mockDisk = disk as unknown as Record<string, ReturnType<typeof vi.fn>>;
			mockDisk.existsSync.mockReturnValue(true);
			mockDisk.readFileSync.mockReturnValue("---\ntitle: Agent\n---\nBody");
			(parseFrontmatter as ReturnType<typeof vi.fn>).mockReturnValue({
				frontmatter: { title: "Agent" },
				body: "Body",
			});

			commands["vault:context"](
				{ agent: "no-scope-agent", format: "json" },
				[], "vault:context", undefined,
			);

			expect(buildVaultContext).toHaveBeenCalledOnce();
			const scopeArg = (buildVaultContext as ReturnType<typeof vi.fn>).mock.calls[0][1];
			expect(scopeArg).toBeUndefined();
		});

		it("passes undefined scope when agent file not found", () => {
			const mockDisk = disk as unknown as Record<string, ReturnType<typeof vi.fn>>;
			mockDisk.existsSync.mockReturnValue(false);

			commands["vault:context"](
				{ agent: "missing-agent", format: "json" },
				[], "vault:context", undefined,
			);

			expect(buildVaultContext).toHaveBeenCalledOnce();
			const scopeArg = (buildVaultContext as ReturnType<typeof vi.fn>).mock.calls[0][1];
			expect(scopeArg).toBeUndefined();
		});
	});

	// ── task:evaluate ───────────────────────────────────────────
	describe("task:evaluate", () => {
		it("is defined", () => {
			expect(commands["task:evaluate"]).toBeDefined();
		});

		it("evaluates event and returns result as JSON", () => {
			commands["task:evaluate"](
				{ event: "vault-create", path: "docs/notes/new-note.md", format: "json" },
				[], "task:evaluate", undefined,
			);

			expect(evaluateEvent).toHaveBeenCalledOnce();
			expect(logMock).toHaveBeenCalledOnce();
			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("matched", 0);
			expect(output).toHaveProperty("dispatched");
			expect(output.dispatched).toHaveLength(0);
		});

		it("derives folder from path", () => {
			commands["task:evaluate"](
				{ event: "vault-create", path: "docs/notes/new-note.md", format: "json" },
				[], "task:evaluate", undefined,
			);

			const event = (evaluateEvent as ReturnType<typeof vi.fn>).mock.calls[0][0];
			expect(event).toHaveProperty("folder", "docs/notes");
			expect(event).toHaveProperty("path", "docs/notes/new-note.md");
			expect(event).toHaveProperty("type", "vault-create");
		});

		it("returns error when --event flag is missing", () => {
			commands["task:evaluate"](
				{ path: "docs/notes/new-note.md", format: "json" },
				[], "task:evaluate", undefined,
			);

			expect(evaluateEvent).not.toHaveBeenCalled();
			expect(logMock).toHaveBeenCalledOnce();
			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("error");
			expect(output.error).toContain("--event");
		});

		it("returns error when --path flag is missing", () => {
			commands["task:evaluate"](
				{ event: "vault-create", format: "json" },
				[], "task:evaluate", undefined,
			);

			expect(evaluateEvent).not.toHaveBeenCalled();
			expect(logMock).toHaveBeenCalledOnce();
			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("error");
			expect(output.error).toContain("--path");
		});
	});
});
