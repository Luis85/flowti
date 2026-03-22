/**
 * staging.controller.test.ts — Tests for staging CLI commands.
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
		copyFileSync: vi.fn(),
		rmSync: vi.fn(),
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

// Mock domain modules — staging
vi.mock("../../src/domain/tasks/staging.js", () => ({
	listPendingReviews: vi.fn(() => []),
	readManifest: vi.fn(() => null),
	approveStaged: vi.fn(() => true),
	rejectStaged: vi.fn(() => true),
}));

// Mock domain modules — vault-executor
vi.mock("../../src/domain/vault-ops/vault-executor.js", () => ({
	approveStaged: vi.fn(() => ({
		profile: {
			tier: "supervised",
			operations: {},
			promotionLog: [],
			successCounts: {},
		},
		ledger: { version: 1, updatedAt: "", accounts: {} },
	})),
}));

// Mock domain modules — trust
vi.mock("../../src/domain/trust/trust-manager.js", () => ({
	loadTrustProfile: vi.fn(() => ({
		tier: "supervised",
		operations: {},
		promotionLog: [],
		successCounts: {},
	})),
	saveTrustProfile: vi.fn(),
}));

vi.mock("../../src/domain/trust/trust-types.js", () => ({
	DEFAULT_TRUST_CONFIG: { autoPromote: true, thresholds: {} },
	DEFAULT_OPERATION_TRUST: {},
}));

// Mock domain modules — economy
vi.mock("../../src/domain/economy/economy-ledger.js", () => ({
	readLedger: vi.fn(() => ({ version: 1, updatedAt: "", accounts: {} })),
	writeLedger: vi.fn(),
}));

// Mock UI modules
vi.mock("../../src/ui/displays/staging-display.js", () => ({
	renderStagingList: vi.fn(),
	renderStagingReview: vi.fn(),
	renderStagingAction: vi.fn(),
}));
vi.mock("../../src/ui/renderers/common-renderers.js", () => ({
	renderError: vi.fn(),
	renderNoProject: vi.fn(),
}));

// ── Imports ──────────────────────────────────────────────────────

import { commands } from "../../src/controller/staging.controller.js";
import { initializeDeps } from "../../src/infrastructure/command-engine.js";
import { listPendingReviews, readManifest, approveStaged as applyStagedFiles, rejectStaged } from "../../src/domain/tasks/staging.js";
import { approveStaged as recordApproval } from "../../src/domain/vault-ops/vault-executor.js";
import { loadTrustProfile, saveTrustProfile } from "../../src/domain/trust/trust-manager.js";
import { readLedger, writeLedger } from "../../src/domain/economy/economy-ledger.js";
import { disk } from "../../src/infrastructure/filesystem.js";
import { paths } from "../../src/infrastructure/paths.js";
import { clock } from "../../src/infrastructure/clock.js";
import { proc } from "../../src/infrastructure/proc.js";
import { log } from "../../src/infrastructure/logger.js";

const logMock = log as ReturnType<typeof vi.fn>;

// ── Tests ────────────────────────────────────────────────────────

describe("staging.controller", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		initializeDeps({
			disk, paths, clock, proc,
			shell: { run: vi.fn(), runSilent: vi.fn(), check: vi.fn(() => false) } as never,
			input: { ask: vi.fn() as never, askYesNo: vi.fn() as never, waitForEnter: vi.fn() as never, askAbortable: vi.fn() as never },
			bus: { emit: vi.fn(), on: vi.fn(), off: vi.fn(), clear: vi.fn() } as never,
			log, warn: vi.fn(),
		});
	});

	// ── staging:list ──────────────────────────────────────────────
	describe("staging:list", () => {
		it("is defined", () => {
			expect(commands["staging:list"]).toBeDefined();
		});

		it("returns empty items when no pending reviews exist", () => {
			commands["staging:list"]({ format: "json" }, [], "staging:list", undefined);

			expect(listPendingReviews).toHaveBeenCalledOnce();
			expect(logMock).toHaveBeenCalledOnce();
			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("items");
			expect(output.items).toHaveLength(0);
		});

		it("returns all pending manifests", () => {
			(listPendingReviews as ReturnType<typeof vi.fn>).mockReturnValue([
				{ taskId: "task-1", agentName: "Architect", operation: "vault-create", files: [{ path: "a.md", action: "create", previewPath: "p/a.md" }], createdAt: "2026-03-21T00:00:00.000Z", status: "pending" },
				{ taskId: "task-2", agentName: "Developer", operation: "vault-edit", files: [], createdAt: "2026-03-21T01:00:00.000Z", status: "pending" },
			]);

			commands["staging:list"]({ format: "json" }, [], "staging:list", undefined);

			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output.items).toHaveLength(2);
			expect(output.items[0]).toHaveProperty("taskId", "task-1");
			expect(output.items[0]).toHaveProperty("agent", "Architect");
			expect(output.items[0]).toHaveProperty("operation", "vault-create");
			expect(output.items[0]).toHaveProperty("fileCount", 1);
		});

		it("filters by agent when --agent flag is provided", () => {
			(listPendingReviews as ReturnType<typeof vi.fn>).mockReturnValue([
				{ taskId: "task-1", agentName: "Architect", operation: "vault-create", files: [{ path: "a.md", action: "create", previewPath: "p/a.md" }], createdAt: "2026-03-21T00:00:00.000Z", status: "pending" },
				{ taskId: "task-2", agentName: "Developer", operation: "vault-edit", files: [], createdAt: "2026-03-21T01:00:00.000Z", status: "pending" },
			]);

			commands["staging:list"]({ agent: "Architect", format: "json" }, [], "staging:list", undefined);

			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output.items).toHaveLength(1);
			expect(output.items[0]).toHaveProperty("agent", "Architect");
		});
	});

	// ── staging:review ────────────────────────────────────────────
	describe("staging:review", () => {
		it("is defined", () => {
			expect(commands["staging:review"]).toBeDefined();
		});

		it("returns manifest details when found", () => {
			(readManifest as ReturnType<typeof vi.fn>).mockReturnValue({
				taskId: "task-1",
				agentName: "Architect",
				operation: "vault-create",
				files: [{ path: "notes/a.md", action: "create", previewPath: ".flowti/var/staging/task-1/notes/a.md" }],
				createdAt: "2026-03-21T00:00:00.000Z",
				status: "pending",
			});

			commands["staging:review"]({ id: "task-1", format: "json" }, [], "staging:review", undefined);

			expect(readManifest).toHaveBeenCalledOnce();
			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("taskId", "task-1");
			expect(output).toHaveProperty("agent", "Architect");
			expect(output).toHaveProperty("operation", "vault-create");
			expect(output.files).toHaveLength(1);
			expect(output.files[0]).toHaveProperty("path", "notes/a.md");
		});

		it("throws when manifest not found", () => {
			(readManifest as ReturnType<typeof vi.fn>).mockReturnValue(null);

			expect(() => {
				commands["staging:review"]({ id: "nonexistent", format: "json" }, [], "staging:review", undefined);
			}).toThrow("Staging area not found: nonexistent");
		});

		it("returns error when --id flag is missing", () => {
			commands["staging:review"]({ format: "json" }, [], "staging:review", undefined);

			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("error");
			expect(output.error).toContain("--id");
		});
	});

	// ── staging:approve ───────────────────────────────────────────
	describe("staging:approve", () => {
		it("is defined", () => {
			expect(commands["staging:approve"]).toBeDefined();
		});

		it("approves staged files and records trust+reward", () => {
			(readManifest as ReturnType<typeof vi.fn>).mockReturnValue({
				taskId: "task-1",
				agentName: "Architect",
				operation: "vault-create",
				files: [{ path: "notes/a.md", action: "create", previewPath: ".flowti/var/staging/task-1/notes/a.md" }],
				createdAt: "2026-03-21T00:00:00.000Z",
				status: "pending",
			});
			(applyStagedFiles as ReturnType<typeof vi.fn>).mockReturnValue(true);

			commands["staging:approve"]({ id: "task-1", format: "json" }, [], "staging:approve", undefined);

			expect(readManifest).toHaveBeenCalledOnce();
			expect(applyStagedFiles).toHaveBeenCalledOnce();
			expect(loadTrustProfile).toHaveBeenCalledOnce();
			expect(readLedger).toHaveBeenCalledOnce();
			expect(recordApproval).toHaveBeenCalledOnce();
			expect(saveTrustProfile).toHaveBeenCalledOnce();
			expect(writeLedger).toHaveBeenCalledOnce();

			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("taskId", "task-1");
			expect(output).toHaveProperty("action", "approved");
			expect(output).toHaveProperty("success", true);
		});

		it("returns success false when manifest not found", () => {
			(readManifest as ReturnType<typeof vi.fn>).mockReturnValue(null);

			commands["staging:approve"]({ id: "nonexistent", format: "json" }, [], "staging:approve", undefined);

			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("success", false);
			expect(applyStagedFiles).not.toHaveBeenCalled();
		});

		it("returns success false when file copy fails", () => {
			(readManifest as ReturnType<typeof vi.fn>).mockReturnValue({
				taskId: "task-1",
				agentName: "Architect",
				operation: "vault-create",
				files: [],
				createdAt: "2026-03-21T00:00:00.000Z",
				status: "pending",
			});
			(applyStagedFiles as ReturnType<typeof vi.fn>).mockReturnValue(false);

			commands["staging:approve"]({ id: "task-1", format: "json" }, [], "staging:approve", undefined);

			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("success", false);
			expect(recordApproval).not.toHaveBeenCalled();
		});

		it("returns error when --id flag is missing", () => {
			commands["staging:approve"]({ format: "json" }, [], "staging:approve", undefined);

			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("error");
			expect(output.error).toContain("--id");
		});
	});

	// ── staging:reject ────────────────────────────────────────────
	describe("staging:reject", () => {
		it("is defined", () => {
			expect(commands["staging:reject"]).toBeDefined();
		});

		it("rejects staged area and returns result with reason", () => {
			(rejectStaged as ReturnType<typeof vi.fn>).mockReturnValue(true);

			commands["staging:reject"]({ id: "task-1", reason: "Incorrect content", format: "json" }, [], "staging:reject", undefined);

			expect(rejectStaged).toHaveBeenCalledOnce();
			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("taskId", "task-1");
			expect(output).toHaveProperty("action", "rejected");
			expect(output).toHaveProperty("success", true);
			expect(output).toHaveProperty("reason", "Incorrect content");
		});

		it("returns success false when staging area not found", () => {
			(rejectStaged as ReturnType<typeof vi.fn>).mockReturnValue(false);

			commands["staging:reject"]({ id: "nonexistent", reason: "test", format: "json" }, [], "staging:reject", undefined);

			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("success", false);
		});

		it("returns error when --id flag is missing", () => {
			commands["staging:reject"]({ reason: "test", format: "json" }, [], "staging:reject", undefined);

			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("error");
			expect(output.error).toContain("--id");
		});

		it("returns error when --reason flag is missing", () => {
			commands["staging:reject"]({ id: "task-1", format: "json" }, [], "staging:reject", undefined);

			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("error");
			expect(output.error).toContain("--reason");
		});
	});
});
