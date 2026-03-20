import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";

/* ------------------------------------------------------------------ */
/*  Mocks                                                              */
/* ------------------------------------------------------------------ */

/** Create a mock ChildProcess with stdin/stdout/stderr as EventEmitters. */
function createMockChild(pid = 12345): ChildProcess {
	const child = new EventEmitter() as ChildProcess & EventEmitter;
	const stdinStream = { write: vi.fn(), destroyed: false, on: vi.fn() };
	const stdoutStream = new EventEmitter();
	const stderrStream = new EventEmitter();

	Object.defineProperty(child, "stdin", { value: stdinStream, writable: true });
	Object.defineProperty(child, "stdout", { value: stdoutStream, writable: true });
	Object.defineProperty(child, "stderr", { value: stderrStream, writable: true });
	Object.defineProperty(child, "pid", { value: pid, writable: true });
	Object.defineProperty(child, "exitCode", { value: null, writable: true });
	Object.defineProperty(child, "killed", { value: false, writable: true });

	(child as Record<string, unknown>).unref = vi.fn();

	return child;
}

/** Emit data on a child's stdout. */
function emitStdout(child: ChildProcess, data: string): void {
	if (child.stdout) {
		(child.stdout as EventEmitter).emit("data", Buffer.from(data));
	}
}

/**
 * Create a mock child that auto-responds with data and closes.
 * The response is emitted on stdout after a microtask, then close fires.
 */
function createAutoRespondChild(pid: number, responseData: string, exitCode = 0): ChildProcess {
	const child = createMockChild(pid);
	// Schedule response after a microtask (so the promise listeners are attached)
	const origOn = child.on.bind(child);
	let closeHandler: ((code: number) => void) | null = null;
	(child as EventEmitter).on = function (event: string, handler: (...args: unknown[]) => void) {
		if (event === "close") {
			closeHandler = handler as (code: number) => void;
			// Schedule the auto-response
			queueMicrotask(() => {
				if (responseData) {
					emitStdout(child, responseData);
				}
				queueMicrotask(() => {
					if (closeHandler) closeHandler(exitCode);
				});
			});
			return this;
		}
		return origOn(event, handler);
	} as typeof child.on;
	return child;
}

const spawnedChildren: ChildProcess[] = [];
const mockSpawn = vi.fn((): ChildProcess => {
	const child = createMockChild();
	spawnedChildren.push(child);
	return child;
});
const mockExecSync = vi.fn();

vi.mock("node:child_process", () => ({
	spawn: (...args: unknown[]) => mockSpawn(...args),
	execSync: (...args: unknown[]) => mockExecSync(...args),
}));

const mockFs: Record<string, ReturnType<typeof vi.fn>> = {
	existsSync: vi.fn(),
	readFileSync: vi.fn(),
	writeFileSync: vi.fn(),
	mkdirSync: vi.fn(),
	unlinkSync: vi.fn(),
	readdirSync: vi.fn(),
	statSync: vi.fn(),
	openSync: vi.fn(),
	readSync: vi.fn(),
	closeSync: vi.fn(),
};

vi.mock("node:fs", () => ({
	existsSync: (...args: unknown[]) => mockFs.existsSync(...args),
	readFileSync: (...args: unknown[]) => mockFs.readFileSync(...args),
	writeFileSync: (...args: unknown[]) => mockFs.writeFileSync(...args),
	mkdirSync: (...args: unknown[]) => mockFs.mkdirSync(...args),
	unlinkSync: (...args: unknown[]) => mockFs.unlinkSync(...args),
	readdirSync: (...args: unknown[]) => mockFs.readdirSync(...args),
	statSync: (...args: unknown[]) => mockFs.statSync(...args),
	openSync: (...args: unknown[]) => mockFs.openSync(...args),
	readSync: (...args: unknown[]) => mockFs.readSync(...args),
	closeSync: (...args: unknown[]) => mockFs.closeSync(...args),
}));

vi.mock("node:path", async () => {
	const actual = await vi.importActual<typeof import("node:path")>("node:path");
	return actual;
});

// Mock the file-watcher — the source imports from "./file-watcher.js"
// Vitest resolves vi.mock paths relative to the source module's location
vi.mock("../../../src/infrastructure/agents/file-watcher.js", () => ({
	watchJsonFile: vi.fn(() => ({ close: vi.fn() })),
}));

/* ------------------------------------------------------------------ */
/*  Imports (after mocks)                                              */
/* ------------------------------------------------------------------ */

import { CliExecutor, resetNodeBinaryCache } from "../../../src/infrastructure/agents/cli-executor.js";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const VAULT = "/test/vault";

function setupNodeBinary(): void {
	mockExecSync.mockReturnValue("/usr/bin/node\n");
}

function setupCliBinExists(): void {
	mockFs.existsSync.mockImplementation((path: string) => {
		if (typeof path === "string" && path.includes("main.mjs")) return true;
		if (typeof path === "string" && path.includes(".pid")) return false;
		if (typeof path === "string" && path.includes("agents")) return true;
		return false;
	});
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("CliExecutor", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		spawnedChildren.length = 0;
		resetNodeBinaryCache();
		setupNodeBinary();
		setupCliBinExists();
		mockFs.readdirSync.mockReturnValue([]);
	});

	afterEach(() => {
		resetNodeBinaryCache();
	});

	describe("constructor", () => {
		it("resolves Node.js binary on creation", () => {
			new CliExecutor(VAULT);
			expect(mockExecSync).toHaveBeenCalled();
		});

		it("stores vault base path", () => {
			const executor = new CliExecutor(VAULT);
			expect(executor).toBeDefined();
		});
	});

	describe("startAgent", () => {
		it("spawns CLI with correct args and stdio pipe", () => {
			const executor = new CliExecutor(VAULT);
			const agent = executor.startAgent("Atlas");

			expect(mockSpawn).toHaveBeenCalledWith(
				expect.any(String),
				expect.arrayContaining(["agent:start", "--agent=Atlas"]),
				expect.objectContaining({
					cwd: VAULT,
					stdio: ["pipe", "pipe", "pipe"],
					windowsHide: true,
				}),
			);
			expect(agent.agentName).toBe("Atlas");
		});

		it("writes PID file after spawning", () => {
			const executor = new CliExecutor(VAULT);
			executor.startAgent("Atlas");

			expect(mockFs.writeFileSync).toHaveBeenCalledWith(
				expect.stringContaining("atlas.pid"),
				"12345",
				"utf-8",
			);
		});

		it("kills existing process if PID file found and process alive", () => {
			mockFs.existsSync.mockImplementation((path: string) => {
				if (typeof path === "string" && path.includes("atlas.pid")) return true;
				if (typeof path === "string" && path.includes("main.mjs")) return true;
				return false;
			});
			mockFs.readFileSync.mockReturnValue("99999");
			mockExecSync.mockImplementation((cmd: string) => {
				if (typeof cmd === "string" && cmd.includes("tasklist")) {
					return "node.exe  99999  Console  1  12,345 K";
				}
				if (typeof cmd === "string" && cmd.includes("taskkill")) return "";
				return "/usr/bin/node\n";
			});

			const executor = new CliExecutor(VAULT);
			executor.startAgent("Atlas");

			expect(mockExecSync).toHaveBeenCalledWith(
				expect.stringContaining("99999"),
				expect.anything(),
			);
		});

		it("throws if Node.js binary not found", () => {
			mockExecSync.mockImplementation(() => {
				throw new Error("not found");
			});

			expect(() => new CliExecutor(VAULT).startAgent("Atlas")).toThrow("Node.js not found");
		});

		it("throws if CLI binary does not exist", () => {
			mockFs.existsSync.mockReturnValue(false);

			expect(() => new CliExecutor(VAULT).startAgent("Atlas")).toThrow("CLI binary not found");
		});

		it("returns an AgentProcess with running=true", () => {
			const executor = new CliExecutor(VAULT);
			const agent = executor.startAgent("Atlas");

			expect(agent.running).toBe(true);
		});

	});

	describe("AgentProcess.send", () => {
		it("writes JSON message to stdin", () => {
			const executor = new CliExecutor(VAULT);
			const agent = executor.startAgent("Atlas");
			const child = spawnedChildren[0];

			agent.send("Hello world");

			const stdin = child.stdin as unknown as { write: ReturnType<typeof vi.fn> };
			expect(stdin.write).toHaveBeenCalledWith(
				expect.stringContaining('"type":"message"'),
			);
			expect(stdin.write).toHaveBeenCalledWith(
				expect.stringContaining('"text":"Hello world"'),
			);
		});

		it("includes context when provided", () => {
			const executor = new CliExecutor(VAULT);
			const agent = executor.startAgent("Atlas");
			const child = spawnedChildren[0];

			agent.send("Do this", "some context");

			const stdin = child.stdin as unknown as { write: ReturnType<typeof vi.fn> };
			const written = stdin.write.mock.calls[0][0] as string;
			const parsed = JSON.parse(written.trim());
			expect(parsed.context).toBe("some context");
		});
	});

	describe("AgentProcess.onEvent", () => {
		it("dispatches stdout JSONL events to callbacks", () => {
			const executor = new CliExecutor(VAULT);
			const agent = executor.startAgent("Atlas");
			const child = spawnedChildren[0];

			const events: unknown[] = [];
			agent.onEvent((e) => events.push(e));

			const event = { ts: 1, type: "thinking", agent: "Atlas", text: "hmm" };
			emitStdout(child, JSON.stringify(event) + "\n");

			expect(events).toHaveLength(1);
			expect(events[0]).toEqual(event);
		});

		it("returns unsubscribe function", () => {
			const executor = new CliExecutor(VAULT);
			const agent = executor.startAgent("Atlas");
			const child = spawnedChildren[0];

			const events: unknown[] = [];
			const unsub = agent.onEvent((e) => events.push(e));

			const event1 = { ts: 1, type: "thinking", agent: "Atlas" };
			emitStdout(child, JSON.stringify(event1) + "\n");
			expect(events).toHaveLength(1);

			unsub();

			const event2 = { ts: 2, type: "response", agent: "Atlas" };
			emitStdout(child, JSON.stringify(event2) + "\n");
			expect(events).toHaveLength(1);
		});

		it("handles multiple events in a single chunk", () => {
			const executor = new CliExecutor(VAULT);
			const agent = executor.startAgent("Atlas");
			const child = spawnedChildren[0];

			const events: unknown[] = [];
			agent.onEvent((e) => events.push(e));

			const e1 = { ts: 1, type: "thinking", agent: "Atlas" };
			const e2 = { ts: 2, type: "response", agent: "Atlas" };
			emitStdout(child, JSON.stringify(e1) + "\n" + JSON.stringify(e2) + "\n");

			expect(events).toHaveLength(2);
		});

		it("skips non-JSON output lines", () => {
			const executor = new CliExecutor(VAULT);
			const agent = executor.startAgent("Atlas");
			const child = spawnedChildren[0];

			const events: unknown[] = [];
			agent.onEvent((e) => events.push(e));

			emitStdout(child, "some text output\n{invalid json}\n");

			expect(events).toHaveLength(0);
		});
	});

	describe("AgentProcess.replayFrom", () => {
		it("reads event log file from byte offset", () => {
			const executor = new CliExecutor(VAULT);
			const agent = executor.startAgent("Atlas");

			const event1 = JSON.stringify({ ts: 1, type: "thinking", agent: "Atlas" });
			const event2 = JSON.stringify({ ts: 2, type: "response", agent: "Atlas" });
			const content = event1 + "\n" + event2 + "\n";
			const buf = Buffer.from(content, "utf-8");

			mockFs.existsSync.mockReturnValue(true);
			mockFs.statSync.mockReturnValue({ size: buf.length });
			mockFs.openSync.mockReturnValue(42);
			mockFs.readSync.mockImplementation((_fd: number, b: Buffer) => {
				buf.copy(b);
				return buf.length;
			});

			const events = agent.replayFrom(0);

			expect(events).toHaveLength(2);
			expect(events[0]).toEqual({ ts: 1, type: "thinking", agent: "Atlas" });
			expect(events[1]).toEqual({ ts: 2, type: "response", agent: "Atlas" });
		});

		it("returns empty array when log file does not exist", () => {
			const executor = new CliExecutor(VAULT);
			const agent = executor.startAgent("Atlas");

			mockFs.existsSync.mockReturnValue(false);

			const events = agent.replayFrom(0);
			expect(events).toEqual([]);
		});
	});

	describe("AgentProcess.stopGeneration", () => {
		it("writes stop-generation command to stdin", () => {
			const executor = new CliExecutor(VAULT);
			const agent = executor.startAgent("Atlas");
			const child = spawnedChildren[0];

			agent.stopGeneration();

			const stdin = child.stdin as unknown as { write: ReturnType<typeof vi.fn> };
			const written = stdin.write.mock.calls[0][0] as string;
			const parsed = JSON.parse(written.trim());
			expect(parsed.type).toBe("stop-generation");
		});
	});

	describe("AgentProcess.grantPermission", () => {
		it("writes grant-permission command to stdin", () => {
			const executor = new CliExecutor(VAULT);
			const agent = executor.startAgent("Atlas");
			const child = spawnedChildren[0];

			agent.grantPermission("Bash", "allow");

			const stdin = child.stdin as unknown as { write: ReturnType<typeof vi.fn> };
			const written = stdin.write.mock.calls[0][0] as string;
			const parsed = JSON.parse(written.trim());
			expect(parsed.type).toBe("grant-permission");
			expect(parsed.tool).toBe("Bash");
			expect(parsed.decision).toBe("allow");
		});
	});

	describe("AgentProcess.kill", () => {
		it("kills the process and removes PID file", () => {
			const executor = new CliExecutor(VAULT);
			const agent = executor.startAgent("Atlas");

			agent.kill();

			expect(mockExecSync).toHaveBeenCalledWith(
				expect.stringContaining("12345"),
				expect.anything(),
			);
			expect(mockFs.unlinkSync).toHaveBeenCalledWith(
				expect.stringContaining("atlas.pid"),
			);
		});

	});

	describe("assignTask", () => {
		it("spawns one-shot CLI and parses JSON response", async () => {
			const oneShotChild = createAutoRespondChild(
				54321, JSON.stringify({ taskId: "task-123" }), 0,
			);
			mockSpawn.mockReturnValueOnce(oneShotChild);

			const executor = new CliExecutor(VAULT);
			const result = await executor.assignTask("Atlas", "write tests");

			expect(result.ok).toBe(true);
			expect(result.taskId).toBe("task-123");

			expect(mockSpawn).toHaveBeenCalledWith(
				expect.any(String),
				expect.arrayContaining(["agent:task", "--agent=Atlas", "--format=json"]),
				expect.objectContaining({ cwd: VAULT }),
			);
		});

		it("returns ok=false when CLI command fails", async () => {
			const oneShotChild = createAutoRespondChild(54321, "", 1);
			mockSpawn.mockReturnValueOnce(oneShotChild);

			const executor = new CliExecutor(VAULT);
			const result = await executor.assignTask("Atlas", "fail task");

			expect(result.ok).toBe(false);
		});
	});

	describe("listAgents", () => {
		it("spawns one-shot CLI and parses JSON array", async () => {
			const agents = [
				{ name: "Atlas", domain: "architecture", status: "idle" },
				{ name: "Forge", status: "busy" },
			];
			const oneShotChild = createAutoRespondChild(
				54321, JSON.stringify(agents), 0,
			);
			mockSpawn.mockReturnValueOnce(oneShotChild);

			const executor = new CliExecutor(VAULT);
			const result = await executor.listAgents();

			expect(result).toHaveLength(2);
			expect(result[0]).toEqual({ name: "Atlas", domain: "architecture", status: "idle" });
			expect(result[1]).toEqual({ name: "Forge", domain: undefined, status: "busy" });
		});

		it("returns empty array on failure", async () => {
			const oneShotChild = createAutoRespondChild(54321, "", 1);
			mockSpawn.mockReturnValueOnce(oneShotChild);

			const executor = new CliExecutor(VAULT);
			const result = await executor.listAgents();

			expect(result).toEqual([]);
		});
	});

	describe("wakeAgent", () => {
		it("spawns one-shot CLI and returns state", async () => {
			const oneShotChild = createAutoRespondChild(
				54321, JSON.stringify({ state: "awake" }), 0,
			);
			mockSpawn.mockReturnValueOnce(oneShotChild);

			const executor = new CliExecutor(VAULT);
			const result = await executor.wakeAgent("Atlas");

			expect(result.ok).toBe(true);
			expect(result.state).toBe("awake");
		});
	});

	describe("killAll", () => {
		it("kills all tracked processes and removes PID files", () => {
			const executor = new CliExecutor(VAULT);
			executor.startAgent("Atlas");

			const child = spawnedChildren[0];
			const pid = child.pid;

			mockFs.readdirSync.mockReturnValue([]);
			executor.killAll();

			expect(mockExecSync).toHaveBeenCalledWith(
				expect.stringContaining(String(pid)),
				expect.anything(),
			);
			expect(mockFs.unlinkSync).toHaveBeenCalledWith(
				expect.stringContaining("atlas.pid"),
			);
		});

		it("reads orphaned PID files and kills those processes too", () => {
			const executor = new CliExecutor(VAULT);

			mockFs.existsSync.mockReturnValue(true);
			mockFs.readdirSync.mockReturnValue(["orphan.pid"]);
			mockFs.readFileSync.mockReturnValue("77777");
			mockExecSync.mockImplementation((cmd: string) => {
				if (typeof cmd === "string" && cmd.includes("tasklist")) {
					return "node.exe  77777  Console  1  12,345 K";
				}
				return "";
			});

			executor.killAll();

			expect(mockFs.unlinkSync).toHaveBeenCalledWith(
				expect.stringContaining("orphan.pid"),
			);
		});
	});

	describe("dispose", () => {
		it("kills all processes and clears state", () => {
			const executor = new CliExecutor(VAULT);
			executor.startAgent("Atlas");

			const child = spawnedChildren[0];
			const pid = child.pid;

			mockFs.readdirSync.mockReturnValue([]);
			executor.dispose();

			expect(mockExecSync).toHaveBeenCalledWith(
				expect.stringContaining(String(pid)),
				expect.anything(),
			);
		});
	});

	describe("PID file stale detection", () => {
		it("removes PID file when process is not alive", () => {
			mockFs.existsSync.mockImplementation((path: string) => {
				if (typeof path === "string" && path.includes("atlas.pid")) return true;
				if (typeof path === "string" && path.includes("main.mjs")) return true;
				return false;
			});
			mockFs.readFileSync.mockReturnValue("88888");
			mockExecSync.mockImplementation((cmd: string) => {
				if (typeof cmd === "string" && cmd.includes("tasklist")) {
					return "INFO: No tasks are running which match the specified criteria.";
				}
				return "/usr/bin/node\n";
			});

			const executor = new CliExecutor(VAULT);
			executor.startAgent("Atlas");

			expect(mockFs.unlinkSync).toHaveBeenCalledWith(
				expect.stringContaining("atlas.pid"),
			);
		});
	});

	describe("grantPermission (executor level)", () => {
		it("spawns one-shot CLI with correct args", async () => {
			const oneShotChild = createAutoRespondChild(
				54321, JSON.stringify({ ok: true }), 0,
			);
			mockSpawn.mockReturnValueOnce(oneShotChild);

			const executor = new CliExecutor(VAULT);
			const result = await executor.grantPermission("Atlas", "Bash", "allow");

			expect(result.ok).toBe(true);

			expect(mockSpawn).toHaveBeenCalledWith(
				expect.any(String),
				expect.arrayContaining([
					"agent:permission",
					"--agent=Atlas",
					"--tool=Bash",
					"--decision=allow",
					"--format=json",
				]),
				expect.objectContaining({ cwd: VAULT }),
			);
		});
	});
});
