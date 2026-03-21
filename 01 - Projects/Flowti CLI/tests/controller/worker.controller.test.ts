/**
 * worker.controller.test.ts — Tests for worker CLI commands.
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
				status: "assigned",
				reward: { xp: 50, coin: 25 },
				tags: [],
				createdAt: "2026-03-21T00:00:00.000Z",
				file: "/vault/docs/tasks/task-001.md",
			},
			{
				id: "task-002",
				type: "standing-order",
				title: "Daily review",
				assignee: "Architect",
				creator: "director",
				priority: "high",
				trustTier: "auto",
				status: "pending",
				reward: { xp: 10, coin: 5 },
				tags: [],
				createdAt: "2026-03-20T00:00:00.000Z",
				file: "/vault/docs/tasks/task-002.md",
			},
		]),
		read: vi.fn(),
		updateField: vi.fn(() => true),
	},
}));

vi.mock("../../src/domain/agents/agent-store.js", () => ({
	agentStore: {
		list: vi.fn(() => [
			{
				name: "Architect",
				agentType: "ai",
				description: "Systems designer",
				skills: [],
				tools: [],
				roles: [],
				file: "/vault/docs/agents/architect.md",
			},
		]),
	},
}));

// Mock UI modules
vi.mock("../../src/ui/displays/worker-display.js", () => ({
	renderWorkerStatus: vi.fn(),
	renderWorkerQueue: vi.fn(),
	renderWorkerReassigned: vi.fn(),
	renderWorkerPaused: vi.fn(),
	renderWorkerResumed: vi.fn(),
}));
vi.mock("../../src/ui/renderers/common-renderers.js", () => ({
	renderError: vi.fn(),
	renderNoProject: vi.fn(),
}));

// ── Imports ──────────────────────────────────────────────────────

import { commands } from "../../src/controller/worker.controller.js";
import { initializeDeps } from "../../src/infrastructure/command-engine.js";
import { taskStore } from "../../src/domain/tasks/task-store.js";
import { agentStore } from "../../src/domain/agents/agent-store.js";
import { disk } from "../../src/infrastructure/filesystem.js";
import { paths } from "../../src/infrastructure/paths.js";
import { clock } from "../../src/infrastructure/clock.js";
import { proc } from "../../src/infrastructure/proc.js";
import { log } from "../../src/infrastructure/logger.js";

const logMock = log as ReturnType<typeof vi.fn>;
const diskMock = disk as Record<string, ReturnType<typeof vi.fn>>;

// ── Tests ────────────────────────────────────────────────────────

describe("worker.controller", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		diskMock.existsSync.mockReturnValue(false);
		initializeDeps({
			disk, paths, clock, proc,
			shell: { run: vi.fn(), runSilent: vi.fn(), check: vi.fn(() => false) } as never,
			input: { ask: vi.fn() as never, askYesNo: vi.fn() as never, waitForEnter: vi.fn() as never },
			bus: { emit: vi.fn(), on: vi.fn(), off: vi.fn(), clear: vi.fn() } as never,
			log, warn: vi.fn(),
			worldState: {
				emitAction: vi.fn(),
				updateEntity: vi.fn(),
				getState: vi.fn(() => ({ version: 1 as const, updatedAt: "", entities: {}, permissions: {}, activityLog: [] })),
				getEntity: vi.fn(() => null),
				flush: vi.fn(),
				addActionListener: vi.fn(),
				removeActionListener: vi.fn(),
			},
			workerManager: {
				spawn: vi.fn(() => null),
				spawnAll: vi.fn(),
				stop: vi.fn(),
				stopAll: vi.fn(),
				getWorker: vi.fn(() => null),
				listWorkers: vi.fn(() => [{ name: "Architect", agent: {}, state: "idle", messageQueue: [], send: vi.fn(), stop: vi.fn() }]),
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

	// ── worker:status ─────────────────────────────────────────────
	describe("worker:status", () => {
		it("is defined", () => {
			expect(commands["worker:status"]).toBeDefined();
		});

		it("returns workers model as JSON", () => {
			commands["worker:status"]({ format: "json" }, [], "worker:status", undefined);

			expect(agentStore.list).toHaveBeenCalledOnce();
			expect(taskStore.list).toHaveBeenCalledOnce();
			expect(logMock).toHaveBeenCalledOnce();
			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("workers");
			expect(Array.isArray(output.workers)).toBe(true);
		});

		it("includes agent name and task counts in each worker entry", () => {
			commands["worker:status"]({ format: "json" }, [], "worker:status", undefined);

			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			const worker = output.workers[0];
			expect(worker).toHaveProperty("name", "Architect");
			expect(worker).toHaveProperty("activeTaskCount");
			expect(worker).toHaveProperty("standingOrderCount");
			expect(worker).toHaveProperty("paused");
		});

		it("marks agent as not paused when pause file does not exist", () => {
			diskMock.existsSync.mockReturnValue(false);

			commands["worker:status"]({ format: "json" }, [], "worker:status", undefined);

			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output.workers[0].paused).toBe(false);
		});

		it("marks agent as paused when in pause file", () => {
			diskMock.existsSync.mockReturnValue(true);
			diskMock.readFileSync.mockReturnValue(JSON.stringify({ paused: ["Architect"] }));

			commands["worker:status"]({ format: "json" }, [], "worker:status", undefined);

			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output.workers[0].paused).toBe(true);
		});
	});

	// ── worker:queue ──────────────────────────────────────────────
	describe("worker:queue", () => {
		it("is defined", () => {
			expect(commands["worker:queue"]).toBeDefined();
		});

		it("returns pending and assigned tasks as JSON", () => {
			commands["worker:queue"]({ format: "json" }, [], "worker:queue", undefined);

			expect(taskStore.list).toHaveBeenCalledOnce();
			expect(logMock).toHaveBeenCalledOnce();
			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("tasks");
			expect(output.tasks).toHaveLength(2); // both tasks are pending/assigned
		});

		it("includes id, title, status, assignee, priority in each task", () => {
			commands["worker:queue"]({ format: "json" }, [], "worker:queue", undefined);

			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			const task = output.tasks[0];
			expect(task).toHaveProperty("id");
			expect(task).toHaveProperty("title");
			expect(task).toHaveProperty("status");
			expect(task).toHaveProperty("assignee");
			expect(task).toHaveProperty("priority");
		});

		it("excludes completed tasks from queue", () => {
			(taskStore.list as ReturnType<typeof vi.fn>).mockReturnValue([
				{ id: "t1", type: "one-off", title: "Done", assignee: "Architect", status: "completed", priority: "normal", reward: { xp: 0, coin: 0 }, tags: [], createdAt: "", file: "" },
				{ id: "t2", type: "one-off", title: "Pending", assignee: "", status: "pending", priority: "normal", reward: { xp: 0, coin: 0 }, tags: [], createdAt: "", file: "" },
			]);

			commands["worker:queue"]({ format: "json" }, [], "worker:queue", undefined);

			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output.tasks).toHaveLength(1);
			expect(output.tasks[0].id).toBe("t2");
		});
	});

	// ── worker:reassign ───────────────────────────────────────────
	describe("worker:reassign", () => {
		it("is defined", () => {
			expect(commands["worker:reassign"]).toBeDefined();
		});

		it("reassigns task and returns ok model as JSON", () => {
			(taskStore.read as ReturnType<typeof vi.fn>).mockReturnValue({
				id: "task-001", title: "Write tests", status: "assigned", assignee: "Architect",
			});

			commands["worker:reassign"]({ id: "task-001", to: "Developer", format: "json" }, [], "worker:reassign", undefined);

			expect(taskStore.updateField).toHaveBeenCalledWith(expect.anything(), "/vault", "task-001", "assignee", "Developer");
			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("ok", true);
			expect(output).toHaveProperty("to", "Developer");
		});

		it("returns error when task not found", () => {
			(taskStore.read as ReturnType<typeof vi.fn>).mockReturnValue(undefined);

			commands["worker:reassign"]({ id: "missing", to: "Developer", format: "json" }, [], "worker:reassign", undefined);

			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("ok", false);
			expect(output).toHaveProperty("error");
		});

		it("returns error when --id is missing", () => {
			commands["worker:reassign"]({ to: "Developer", format: "json" }, [], "worker:reassign", undefined);

			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("error");
			expect(output.error).toContain("--id");
		});
	});

	// ── worker:pause ──────────────────────────────────────────────
	describe("worker:pause", () => {
		it("is defined", () => {
			expect(commands["worker:pause"]).toBeDefined();
		});

		it("writes pause flag and returns ok model as JSON", () => {
			commands["worker:pause"]({ agent: "Architect", format: "json" }, [], "worker:pause", undefined);

			expect(diskMock.writeFileSync).toHaveBeenCalledOnce();
			const writtenContent = diskMock.writeFileSync.mock.calls[0][1] as string;
			const parsed = JSON.parse(writtenContent) as { paused: string[] };
			expect(parsed.paused).toContain("Architect");

			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("ok", true);
			expect(output).toHaveProperty("agent", "Architect");
		});

		it("returns error when --agent is missing", () => {
			commands["worker:pause"]({ format: "json" }, [], "worker:pause", undefined);

			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("error");
			expect(output.error).toContain("--agent");
		});
	});

	// ── worker:resume ─────────────────────────────────────────────
	describe("worker:resume", () => {
		it("is defined", () => {
			expect(commands["worker:resume"]).toBeDefined();
		});

		it("removes pause flag and returns ok model as JSON", () => {
			diskMock.existsSync.mockReturnValue(true);
			diskMock.readFileSync.mockReturnValue(JSON.stringify({ paused: ["Architect", "Developer"] }));

			commands["worker:resume"]({ agent: "Architect", format: "json" }, [], "worker:resume", undefined);

			expect(diskMock.writeFileSync).toHaveBeenCalledOnce();
			const writtenContent = diskMock.writeFileSync.mock.calls[0][1] as string;
			const parsed = JSON.parse(writtenContent) as { paused: string[] };
			expect(parsed.paused).not.toContain("Architect");
			expect(parsed.paused).toContain("Developer");

			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("ok", true);
			expect(output).toHaveProperty("agent", "Architect");
		});

		it("returns error when --agent is missing", () => {
			commands["worker:resume"]({ format: "json" }, [], "worker:resume", undefined);

			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("error");
			expect(output.error).toContain("--agent");
		});
	});
});
