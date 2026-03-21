/**
 * task.controller.test.ts — Tests for task management CLI commands.
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
vi.mock("../../src/domain/tasks/task-store.js", () => ({
	taskStore: {
		list: vi.fn(() => [
			{
				id: "task-001",
				type: "one-off",
				title: "Write tests",
				assignee: "Architect",
				creator: "director",
				priority: "normal",
				trustTier: "review",
				status: "pending",
				reward: { xp: 50, coin: 25 },
				tags: [],
				createdAt: "2026-03-21T00:00:00.000Z",
				completedAt: "",
				journeyId: "",
				file: "/vault/docs/tasks/task-001.md",
			},
			{
				id: "task-002",
				type: "delegated",
				title: "Deploy service",
				assignee: "Developer",
				creator: "director",
				priority: "high",
				trustTier: "auto",
				status: "assigned",
				reward: { xp: 100, coin: 50 },
				tags: [],
				createdAt: "2026-03-20T00:00:00.000Z",
				completedAt: "",
				journeyId: "",
				file: "/vault/docs/tasks/task-002.md",
			},
		]),
		read: vi.fn((_, __, id: string) => {
			if (id === "task-001") {
				return {
					id: "task-001",
					type: "one-off",
					title: "Write tests",
					assignee: "",
					creator: "director",
					priority: "normal",
					trustTier: "review",
					status: "pending",
					reward: { xp: 50, coin: 25 },
					tags: [],
					createdAt: "2026-03-21T00:00:00.000Z",
					completedAt: "",
					journeyId: "",
					file: "/vault/docs/tasks/task-001.md",
				};
			}
			return undefined;
		}),
		create: vi.fn(() => "/vault/docs/tasks/task-new.md"),
		updateField: vi.fn(() => true),
		remove: vi.fn(),
	},
}));

// Mock economy ledger
vi.mock("../../src/domain/economy/economy-ledger.js", () => ({
	readLedger: vi.fn(() => ({ version: 1, updatedAt: "", accounts: {} })),
	writeLedger: vi.fn(),
	creditReward: vi.fn((_ledger: unknown, _agent: string, reward: { xp: number; coin: number }) => ({
		ledger: { version: 1, updatedAt: "", accounts: {} },
		reward: { xp: reward.xp, coin: reward.coin, leveledUp: false },
	})),
	appendTransaction: vi.fn(),
}));

// Mock UI modules
vi.mock("../../src/ui/displays/task-display.js", () => ({
	renderTaskList: vi.fn(),
	renderTaskCreated: vi.fn(),
	renderTaskUpdated: vi.fn(),
	renderTaskReview: vi.fn(),
	renderTaskApproved: vi.fn(),
	renderTaskRejected: vi.fn(),
	renderStandingOrders: vi.fn(),
}));
vi.mock("../../src/ui/renderers/common-renderers.js", () => ({
	renderError: vi.fn(),
	renderNoProject: vi.fn(),
}));

// ── Imports ──────────────────────────────────────────────────────

import { commands } from "../../src/controller/task.controller.js";
import { initializeDeps } from "../../src/infrastructure/command-engine.js";
import { taskStore } from "../../src/domain/tasks/task-store.js";
import { readLedger, writeLedger, creditReward, appendTransaction } from "../../src/domain/economy/economy-ledger.js";
import { disk } from "../../src/infrastructure/filesystem.js";
import { paths } from "../../src/infrastructure/paths.js";
import { clock } from "../../src/infrastructure/clock.js";
import { proc } from "../../src/infrastructure/proc.js";
import { log } from "../../src/infrastructure/logger.js";

const readLedgerMock = readLedger as ReturnType<typeof vi.fn>;
const writeLedgerMock = writeLedger as ReturnType<typeof vi.fn>;
const creditRewardMock = creditReward as ReturnType<typeof vi.fn>;
const appendTransactionMock = appendTransaction as ReturnType<typeof vi.fn>;

const logMock = log as ReturnType<typeof vi.fn>;

// ── Tests ────────────────────────────────────────────────────────

describe("task.controller", () => {
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

	// ── task:list ────────────────────────────────────────────────
	describe("task:list", () => {
		it("is defined", () => {
			expect(commands["task:list"]).toBeDefined();
		});

		it("returns tasks array as JSON", () => {
			commands["task:list"]({ format: "json" }, [], "task:list", undefined);

			expect(logMock).toHaveBeenCalledOnce();
			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("tasks");
			expect(output.tasks).toHaveLength(2);
			expect(output.tasks[0]).toHaveProperty("id", "task-001");
		});

		it("filters by status when --status flag is provided", () => {
			commands["task:list"]({ status: "assigned", format: "json" }, [], "task:list", undefined);

			expect(logMock).toHaveBeenCalledOnce();
			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output.tasks).toHaveLength(1);
			expect(output.tasks[0]).toHaveProperty("id", "task-002");
		});

		it("filters by assignee when --assignee flag is provided", () => {
			commands["task:list"]({ assignee: "Architect", format: "json" }, [], "task:list", undefined);

			expect(logMock).toHaveBeenCalledOnce();
			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output.tasks).toHaveLength(1);
			expect(output.tasks[0]).toHaveProperty("id", "task-001");
		});

		it("calls taskStore.list", () => {
			commands["task:list"]({}, [], "task:list", undefined);

			expect(taskStore.list).toHaveBeenCalledOnce();
		});
	});

	// ── task:create ──────────────────────────────────────────────
	describe("task:create", () => {
		it("is defined", () => {
			expect(commands["task:create"]).toBeDefined();
		});

		it("creates a task and returns id + title as JSON", () => {
			commands["task:create"](
				{ title: "Write docs", format: "json" },
				[], "task:create", undefined,
			);

			expect(taskStore.create).toHaveBeenCalledOnce();
			expect(logMock).toHaveBeenCalledOnce();
			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("id");
			expect(output.id).toMatch(/^task-/);
			expect(output).toHaveProperty("title", "Write docs");
		});

		it("returns error when --title flag is missing", () => {
			commands["task:create"](
				{ format: "json" },
				[], "task:create", undefined,
			);

			expect(taskStore.create).not.toHaveBeenCalled();
			expect(logMock).toHaveBeenCalledOnce();
			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("error");
			expect(output.error).toContain("--title");
		});

		it("accepts optional flags for type and priority", () => {
			commands["task:create"](
				{ title: "Deploy feature", type: "delegated", priority: "high", format: "json" },
				[], "task:create", undefined,
			);

			expect(taskStore.create).toHaveBeenCalledOnce();
			const createArgs = (taskStore.create as ReturnType<typeof vi.fn>).mock.calls[0][2];
			expect(createArgs).toHaveProperty("type", "delegated");
			expect(createArgs).toHaveProperty("priority", "high");
		});
	});

	// ── task:assign ──────────────────────────────────────────────
	describe("task:assign", () => {
		it("is defined", () => {
			expect(commands["task:assign"]).toBeDefined();
		});

		it("assigns task and returns id + assignee as JSON", () => {
			commands["task:assign"](
				{ id: "task-001", to: "Architect", format: "json" },
				[], "task:assign", undefined,
			);

			expect(taskStore.updateField).toHaveBeenCalledTimes(2);
			expect(logMock).toHaveBeenCalledOnce();
			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("id", "task-001");
			expect(output).toHaveProperty("field", "assignee");
			expect(output).toHaveProperty("value", "Architect");
		});

		it("returns error when task is not found", () => {
			commands["task:assign"](
				{ id: "task-999", to: "Architect", format: "json" },
				[], "task:assign", undefined,
			);

			expect(taskStore.updateField).not.toHaveBeenCalled();
			expect(logMock).toHaveBeenCalledOnce();
			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("field", "error");
			expect(output.value).toContain("not found");
		});

		it("returns error when --id flag is missing", () => {
			commands["task:assign"](
				{ to: "Architect", format: "json" },
				[], "task:assign", undefined,
			);

			expect(taskStore.updateField).not.toHaveBeenCalled();
			expect(logMock).toHaveBeenCalledOnce();
			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("error");
			expect(output.error).toContain("--id");
		});

		it("returns error when --to flag is missing", () => {
			commands["task:assign"](
				{ id: "task-001", format: "json" },
				[], "task:assign", undefined,
			);

			expect(taskStore.updateField).not.toHaveBeenCalled();
			expect(logMock).toHaveBeenCalledOnce();
			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("error");
			expect(output.error).toContain("--to");
		});
	});

	// ── task:review ──────────────────────────────────────────────
	describe("task:review", () => {
		it("is defined", () => {
			expect(commands["task:review"]).toBeDefined();
		});

		it("returns only tasks with status review", () => {
			(taskStore.list as ReturnType<typeof vi.fn>).mockReturnValueOnce([
				{
					id: "task-003",
					type: "delegated",
					title: "Review deployment",
					assignee: "Developer",
					creator: "director",
					priority: "high",
					trustTier: "review",
					status: "review",
					reward: { xp: 100, coin: 50 },
					tags: [],
					createdAt: "2026-03-21T00:00:00.000Z",
					completedAt: "",
					journeyId: "",
					file: "/vault/docs/tasks/task-003.md",
				},
			]);

			commands["task:review"]({ format: "json" }, [], "task:review", undefined);

			expect(logMock).toHaveBeenCalledOnce();
			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("tasks");
			expect(output.tasks).toHaveLength(1);
			expect(output.tasks[0]).toHaveProperty("status", "review");
		});

		it("returns empty array when no tasks in review", () => {
			commands["task:review"]({ format: "json" }, [], "task:review", undefined);

			expect(logMock).toHaveBeenCalledOnce();
			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output.tasks).toHaveLength(0);
		});
	});

	// ── task:approve ─────────────────────────────────────────────
	describe("task:approve", () => {
		it("is defined", () => {
			expect(commands["task:approve"]).toBeDefined();
		});

		it("approves a task in review status and awards XP/coin", () => {
			(taskStore.read as ReturnType<typeof vi.fn>).mockReturnValueOnce({
				id: "task-003",
				type: "one-off",
				title: "Review deployment",
				assignee: "Developer",
				creator: "director",
				priority: "high",
				trustTier: "review",
				status: "review",
				reward: { xp: 100, coin: 50 },
				tags: [],
				createdAt: "2026-03-21T00:00:00.000Z",
				completedAt: "",
				journeyId: "",
				file: "/vault/docs/tasks/task-003.md",
			});
			creditRewardMock.mockReturnValueOnce({
				ledger: { version: 1, updatedAt: "", accounts: {} },
				reward: { xp: 100, coin: 50, leveledUp: false },
			});

			commands["task:approve"]({ id: "task-003", format: "json" }, [], "task:approve", undefined);

			expect(readLedgerMock).toHaveBeenCalledOnce();
			expect(creditRewardMock).toHaveBeenCalledOnce();
			expect(writeLedgerMock).toHaveBeenCalledOnce();
			expect(appendTransactionMock).toHaveBeenCalledOnce();
			expect(taskStore.updateField).toHaveBeenCalledTimes(2);

			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("ok", true);
			expect(output).toHaveProperty("xp", 100);
			expect(output).toHaveProperty("coin", 50);
		});

		it("returns error when task is not found", () => {
			commands["task:approve"]({ id: "task-999", format: "json" }, [], "task:approve", undefined);

			expect(readLedgerMock).not.toHaveBeenCalled();
			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("ok", false);
			expect(output.error).toContain("not found");
		});

		it("returns error when task is not in review status", () => {
			commands["task:approve"]({ id: "task-001", format: "json" }, [], "task:approve", undefined);

			expect(readLedgerMock).not.toHaveBeenCalled();
			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("ok", false);
			expect(output.error).toContain("cannot approve");
		});

		it("returns error when --id flag is missing", () => {
			commands["task:approve"]({ format: "json" }, [], "task:approve", undefined);

			expect(readLedgerMock).not.toHaveBeenCalled();
			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("error");
			expect(output.error).toContain("--id");
		});
	});

	// ── task:reject ──────────────────────────────────────────────
	describe("task:reject", () => {
		it("is defined", () => {
			expect(commands["task:reject"]).toBeDefined();
		});

		it("rejects a task in review status back to pending", () => {
			(taskStore.read as ReturnType<typeof vi.fn>).mockReturnValueOnce({
				id: "task-003",
				type: "one-off",
				title: "Review deployment",
				assignee: "Developer",
				creator: "director",
				priority: "high",
				trustTier: "review",
				status: "review",
				reward: { xp: 100, coin: 50 },
				tags: [],
				createdAt: "2026-03-21T00:00:00.000Z",
				completedAt: "",
				journeyId: "",
				file: "/vault/docs/tasks/task-003.md",
			});

			commands["task:reject"]({ id: "task-003", reason: "needs rework", format: "json" }, [], "task:reject", undefined);

			expect(taskStore.updateField).toHaveBeenCalledWith(expect.anything(), expect.anything(), "task-003", "status", "pending");
			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("ok", true);
			expect(output).toHaveProperty("reason", "needs rework");
		});

		it("returns error when task is not found", () => {
			commands["task:reject"]({ id: "task-999", reason: "bad", format: "json" }, [], "task:reject", undefined);

			expect(taskStore.updateField).not.toHaveBeenCalled();
			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("ok", false);
		});

		it("returns error when --id flag is missing", () => {
			commands["task:reject"]({ reason: "bad", format: "json" }, [], "task:reject", undefined);

			expect(taskStore.updateField).not.toHaveBeenCalled();
			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("error");
			expect(output.error).toContain("--id");
		});
	});

	// ── task:standing-orders ──────────────────────────────────────
	describe("task:standing-orders", () => {
		it("is defined", () => {
			expect(commands["task:standing-orders"]).toBeDefined();
		});

		it("returns only standing-order type tasks", () => {
			(taskStore.list as ReturnType<typeof vi.fn>).mockReturnValueOnce([
				{
					id: "task-so-1",
					type: "standing-order",
					title: "Daily sync",
					assignee: "Architect",
					creator: "director",
					priority: "normal",
					trustTier: "auto",
					status: "assigned",
					reward: { xp: 10, coin: 5 },
					tags: [],
					createdAt: "2026-03-21T00:00:00.000Z",
					completedAt: "",
					journeyId: "",
					file: "/vault/docs/tasks/task-so-1.md",
				},
				{
					id: "task-001",
					type: "one-off",
					title: "Write tests",
					assignee: "Architect",
					creator: "director",
					priority: "normal",
					trustTier: "review",
					status: "pending",
					reward: { xp: 50, coin: 25 },
					tags: [],
					createdAt: "2026-03-21T00:00:00.000Z",
					completedAt: "",
					journeyId: "",
					file: "/vault/docs/tasks/task-001.md",
				},
			]);

			commands["task:standing-orders"]({ format: "json" }, [], "task:standing-orders", undefined);

			expect(logMock).toHaveBeenCalledOnce();
			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("orders");
			expect(output.orders).toHaveLength(1);
			expect(output.orders[0]).toHaveProperty("id", "task-so-1");
		});

		it("filters by assignee when --assignee flag is provided", () => {
			(taskStore.list as ReturnType<typeof vi.fn>).mockReturnValueOnce([
				{
					id: "task-so-1",
					type: "standing-order",
					title: "Daily sync",
					assignee: "Architect",
					creator: "director",
					priority: "normal",
					trustTier: "auto",
					status: "assigned",
					reward: { xp: 10, coin: 5 },
					tags: [],
					createdAt: "2026-03-21T00:00:00.000Z",
					completedAt: "",
					journeyId: "",
					file: "/vault/docs/tasks/task-so-1.md",
				},
				{
					id: "task-so-2",
					type: "standing-order",
					title: "Weekly review",
					assignee: "Developer",
					creator: "director",
					priority: "normal",
					trustTier: "auto",
					status: "assigned",
					reward: { xp: 10, coin: 5 },
					tags: [],
					createdAt: "2026-03-21T00:00:00.000Z",
					completedAt: "",
					journeyId: "",
					file: "/vault/docs/tasks/task-so-2.md",
				},
			]);

			commands["task:standing-orders"]({ assignee: "Architect", format: "json" }, [], "task:standing-orders", undefined);

			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output.orders).toHaveLength(1);
			expect(output.orders[0]).toHaveProperty("id", "task-so-1");
		});

		it("returns empty array when no standing orders exist", () => {
			commands["task:standing-orders"]({ format: "json" }, [], "task:standing-orders", undefined);

			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output.orders).toHaveLength(0);
		});
	});
});
