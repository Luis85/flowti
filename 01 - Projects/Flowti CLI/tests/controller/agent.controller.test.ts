/**
 * agent.controller.test.ts — Tests for agent management CLI commands.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks (must come BEFORE imports) ─────────────────────────────

vi.mock("../../src/infrastructure/logger.js", () => ({ log: vi.fn(), warn: vi.fn() }));
vi.mock("../../src/infrastructure/filesystem.js", () => ({
	disk: {
		existsSync: vi.fn(() => false),
		readFileSync: vi.fn(() => ""),
		writeFileSync: vi.fn(),
		mkdirSync: vi.fn(),
		readdirSync: vi.fn(() => []),
	},
}));
vi.mock("../../src/infrastructure/paths.js", () => ({
	paths: {
		join: (...args: string[]) => args.join("/"),
		resolve: (...args: string[]) => args.join("/"),
		relative: (_from: string, to: string) => to,
		isAbsolute: (p: string) => p.startsWith("/"),
		dirname: (p: string) => p.split("/").slice(0, -1).join("/"),
		basename: (p: string) => p.split("/").pop(),
	},
}));
vi.mock("../../src/infrastructure/shell.js", () => ({
	shell: { run: vi.fn(), runSilent: vi.fn(), check: vi.fn(() => false) },
}));
vi.mock("../../src/infrastructure/clock.js", () => ({
	clock: { iso: () => "2026-03-19T00:00:00.000Z", now: () => new Date("2026-03-19"), ms: () => 1710806400000, safeIso: () => "" },
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
	PROJECTS_DIR: "/vault/projects",
	AGENTS_DIR: "/vault/agents",
	cliConfig: { agents: { dir: "docs/agents" } },
	loadJson: vi.fn(),
}));
vi.mock("../../src/infrastructure/ui.js", () => ({
	RESET: "", BOLD: "", DIM: "", GREEN: "", RED: "", CYAN: "", YELLOW: "",
}));
vi.mock("../../src/ui/renderers/cli-event-renderer.js", () => ({ attachCliRenderer: vi.fn(() => () => {}) }));

// Mock domain modules
vi.mock("../../src/domain/agents/agent-store.js", () => ({
	agentStore: {
		list: vi.fn(() => [
			{ name: "Architect", domain: "design", skills: [], tools: [], roles: [], behaviors: [] },
			{ name: "Developer", domain: "code", skills: [], tools: [], roles: [], behaviors: [] },
		]),
	},
}));
vi.mock("../../src/domain/agents/agent-state.js", () => ({
	readAgentState: vi.fn(() => ({
		name: "Architect",
		status: "idle",
		tasks: [],
		briefs: [],
		grants: [],
		pendingPermissions: [],
	})),
	writeAgentState: vi.fn(),
	addTask: vi.fn((state: Record<string, unknown>, task: Record<string, unknown>) => ({
		...state,
		tasks: [...(state.tasks as unknown[]), task],
		status: "busy",
	})),
}));

// ── Imports ──────────────────────────────────────────────────────

import { commands } from "../../src/controller/agent.controller.js";
import { initializeDeps } from "../../src/infrastructure/command-engine.js";
import { disk } from "../../src/infrastructure/filesystem.js";
import { paths } from "../../src/infrastructure/paths.js";
import { clock } from "../../src/infrastructure/clock.js";
import { proc } from "../../src/infrastructure/proc.js";
import { log } from "../../src/infrastructure/logger.js";
import { writeAgentState } from "../../src/domain/agents/agent-state.js";

const logMock = log as ReturnType<typeof vi.fn>;
const writeAgentStateMock = writeAgentState as ReturnType<typeof vi.fn>;

// ── Tests ────────────────────────────────────────────────────────

describe("agent.controller", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		initializeDeps({
			disk, paths, clock, proc,
			shell: { run: vi.fn(), runSilent: vi.fn(), check: vi.fn(() => false) } as never,
			input: { ask: vi.fn() as never, askYesNo: vi.fn() as never, waitForEnter: vi.fn() as never, askAbortable: vi.fn() as never },
			bus: { emit: vi.fn(), on: vi.fn(), off: vi.fn(), clear: vi.fn() } as never,
			log, warn: vi.fn(),
			worldState: {
				emitAction: vi.fn(),
				updateEntity: vi.fn(),
				getState: vi.fn(() => ({
					version: 1 as const,
					updatedAt: "",
					entities: {
						Architect: { id: "Architect", type: "agent" as const, components: { status: "active" } },
					},
					permissions: {},
					activityLog: [],
				})),
				getEntity: vi.fn(() => null),
				flush: vi.fn(),
				addActionListener: vi.fn(),
				removeActionListener: vi.fn(),
			},
			workerManager: {
				spawn: vi.fn(() => ({ name: "Architect", agent: {} as never, state: "idle" as const, messageQueue: [] as readonly string[], send: vi.fn(), stop: vi.fn() })),
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

	// ── agent:list ──────────────────────────────────────────────
	describe("agent:list", () => {
		it("is defined", () => {
			expect(commands["agent:list"]).toBeDefined();
		});

		it("returns agents array as JSON", () => {
			commands["agent:list"]({ format: "json" }, [], "agent:list", undefined);

			expect(logMock).toHaveBeenCalledOnce();
			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("agents");
			expect(output.agents).toHaveLength(2);
			expect(output.agents[0]).toHaveProperty("name", "Architect");
			expect(output.agents[0]).toHaveProperty("status", "active");
			expect(output.agents[1]).toHaveProperty("name", "Developer");
			expect(output.agents[1]).toHaveProperty("status", "idle");
		});
	});

	// ── agent:task ──────────────────────────────────────────────
	describe("agent:task", () => {
		it("is defined", () => {
			expect(commands["agent:task"]).toBeDefined();
		});

		it("assigns a task and returns ok + taskId as JSON", () => {
			commands["agent:task"](
				{ agent: "Architect", task: "Review the design", format: "json" },
				[], "agent:task", undefined,
			);

			expect(writeAgentStateMock).toHaveBeenCalledOnce();
			expect(logMock).toHaveBeenCalledOnce();
			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("ok", true);
			expect(output).toHaveProperty("taskId");
			expect(output.taskId).toMatch(/^task-/);
		});

		it("returns error when --agent flag is missing", () => {
			commands["agent:task"](
				{ task: "Review", format: "json" },
				[], "agent:task", undefined,
			);

			expect(writeAgentStateMock).not.toHaveBeenCalled();
			expect(logMock).toHaveBeenCalledOnce();
			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("error");
			expect(output.error).toContain("--agent");
		});
	});

	// ── agent:wake ──────────────────────────────────────────────
	describe("agent:wake", () => {
		it("is defined", () => {
			expect(commands["agent:wake"]).toBeDefined();
		});

		it("spawns a worker and returns ok + state as JSON", () => {
			commands["agent:wake"](
				{ agent: "Architect", format: "json" },
				[], "agent:wake", undefined,
			);

			expect(logMock).toHaveBeenCalledOnce();
			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("ok", true);
			expect(output).toHaveProperty("state");
		});
	});

	// ── agent:permission ────────────────────────────────────────
	describe("agent:permission", () => {
		it("is defined", () => {
			expect(commands["agent:permission"]).toBeDefined();
		});

		it("emits permission action and returns ok as JSON", () => {
			commands["agent:permission"](
				{ agent: "Architect", tool: "file_write", decision: "allow", format: "json" },
				[], "agent:permission", undefined,
			);

			expect(logMock).toHaveBeenCalledOnce();
			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("ok", true);
		});

		it("returns error for invalid decision", () => {
			commands["agent:permission"](
				{ agent: "Architect", tool: "file_write", decision: "invalid", format: "json" },
				[], "agent:permission", undefined,
			);

			expect(logMock).toHaveBeenCalledOnce();
			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("error");
			expect(output.error).toContain("invalid");
		});
	});
});
