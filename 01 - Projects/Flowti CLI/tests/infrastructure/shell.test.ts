import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("node:child_process", () => ({
	execSync: vi.fn(),
	execFileSync: vi.fn(),
	spawnSync: vi.fn(() => ({ stdout: "", stderr: "", status: 0 })),
	spawn: vi.fn(() => {
		const handlers: Record<string, Function[]> = {};
		return {
			stdout: { on: vi.fn(), off: vi.fn() },
			stderr: { on: vi.fn(), off: vi.fn() },
			on: vi.fn((event: string, cb: Function) => {
				handlers[event] = handlers[event] || [];
				handlers[event].push(cb);
			}),
			off: vi.fn(),
			kill: vi.fn(),
			pid: 1234,
		};
	}),
	exec: vi.fn((_cmd: string, _opts: unknown, cb: (err: Error | null, stdout: string, stderr: string) => void) => {
		cb(null, "", "");
		return { stdin: { end: vi.fn() } };
	}),
}));

vi.mock("../../src/infrastructure/config.js", () => ({
	CLI_PROJECT: "/project",
}));

vi.mock("../../src/infrastructure/ui.js", () => ({
	RESET: "", BOLD: "", DIM: "", GREEN: "", RED: "", CYAN: "", YELLOW: "",
}));

vi.mock("../../src/infrastructure/logger.js", () => ({
	log: vi.fn(),
}));

vi.mock("../../src/infrastructure/clock.js", () => ({
	clock: { ms: () => 1000 },
}));

import { execSync, execFileSync, spawnSync, spawn, exec } from "node:child_process";
import { shell } from "../../src/infrastructure/shell.js";
import { log } from "../../src/infrastructure/logger.js";

const mockedExec = vi.mocked(execSync);
const mockedExecFile = vi.mocked(execFileSync);
const mockedSpawnSync = vi.mocked(spawnSync);
const mockedSpawn = vi.mocked(spawn);
const mockedExecAsync = vi.mocked(exec);

beforeEach(() => {
	vi.clearAllMocks();
});

describe("shell.run", () => {
	it("returns 0 on success", () => {
		mockedExec.mockReturnValue(Buffer.from(""));
		expect(shell.run("npm test")).toBe(0);
	});

	it("uses CLI_PROJECT as default cwd", () => {
		mockedExec.mockReturnValue(Buffer.from(""));
		shell.run("npm test");
		expect(mockedExec).toHaveBeenCalledWith("npm test", expect.objectContaining({ cwd: "/project" }));
	});

	it("uses provided cwd", () => {
		mockedExec.mockReturnValue(Buffer.from(""));
		shell.run("npm test", { cwd: "/other" });
		expect(mockedExec).toHaveBeenCalledWith("npm test", expect.objectContaining({ cwd: "/other" }));
	});

	it("returns exit code on failure", () => {
		mockedExec.mockImplementation(() => { throw { status: 42 }; });
		expect(shell.run("bad-cmd")).toBe(42);
	});

	it("returns 1 when status is undefined", () => {
		mockedExec.mockImplementation(() => { throw new Error("oops"); });
		expect(shell.run("bad-cmd")).toBe(1);
	});

	it("passes env variables when provided", () => {
		mockedExec.mockReturnValue(Buffer.from(""));
		shell.run("npm test", { env: { NODE_ENV: "test" } });
		expect(mockedExec).toHaveBeenCalledWith("npm test", expect.objectContaining({
			env: expect.objectContaining({ NODE_ENV: "test" }),
		}));
	});

	it("does not set env when not provided", () => {
		mockedExec.mockReturnValue(Buffer.from(""));
		shell.run("npm test");
		expect(mockedExec).toHaveBeenCalledWith("npm test", expect.objectContaining({
			env: undefined,
		}));
	});

	it("uses label for log output when provided", () => {
		mockedExec.mockReturnValue(Buffer.from(""));
		shell.run("npm test", { label: "Running tests" });
		expect(log).toHaveBeenCalledWith(expect.stringContaining("Running tests"));
	});
});

describe("shell.runSilent", () => {
	it("returns trimmed output on success", () => {
		mockedExec.mockReturnValue("  v24.12.0\n" as never);
		expect(shell.runSilent("node --version")).toBe("v24.12.0");
	});

	it("returns null on failure", () => {
		mockedExec.mockImplementation(() => { throw new Error("fail"); });
		expect(shell.runSilent("bad-cmd")).toBeNull();
	});

	it("uses CLI_PROJECT as default cwd", () => {
		mockedExec.mockReturnValue("output" as never);
		shell.runSilent("git status");
		expect(mockedExec).toHaveBeenCalledWith("git status", expect.objectContaining({ cwd: "/project" }));
	});
});

describe("shell.check", () => {
	it("returns true when command succeeds", () => {
		mockedExec.mockReturnValue(Buffer.from(""));
		expect(shell.check("git --version")).toBe(true);
	});

	it("returns false when command fails", () => {
		mockedExec.mockImplementation(() => { throw new Error("not found"); });
		expect(shell.check("nonexistent")).toBe(false);
	});
});

// ── runCapture ──────────────────────────────────────────────────────

describe("shell.runCapture", () => {
	it("returns combined stdout and stderr", () => {
		mockedSpawnSync.mockReturnValue({ stdout: "output line", stderr: "error line", status: 0 } as any);

		const result = shell.runCapture("npm test");

		expect(result).toContain("output line");
		expect(result).toContain("error line");
	});

	it("uses CLI_PROJECT as default cwd", () => {
		mockedSpawnSync.mockReturnValue({ stdout: "", stderr: "", status: 0 } as any);

		shell.runCapture("npm test");

		expect(mockedSpawnSync).toHaveBeenCalledWith("npm test", expect.objectContaining({ cwd: "/project" }));
	});

	it("uses provided cwd", () => {
		mockedSpawnSync.mockReturnValue({ stdout: "", stderr: "", status: 0 } as any);

		shell.runCapture("npm test", { cwd: "/other" });

		expect(mockedSpawnSync).toHaveBeenCalledWith("npm test", expect.objectContaining({ cwd: "/other" }));
	});

	it("uses provided timeout", () => {
		mockedSpawnSync.mockReturnValue({ stdout: "", stderr: "", status: 0 } as any);

		shell.runCapture("npm test", { timeout: 5000 });

		expect(mockedSpawnSync).toHaveBeenCalledWith("npm test", expect.objectContaining({ timeout: 5000 }));
	});

	it("handles null stdout/stderr gracefully", () => {
		mockedSpawnSync.mockReturnValue({ stdout: null, stderr: null, status: 0 } as any);

		const result = shell.runCapture("npm test");

		expect(result).toBe("\n");
	});
});

// ── runCaptureStatus ────────────────────────────────────────────────

describe("shell.runCaptureStatus", () => {
	it("returns output and exit code 0 on success", () => {
		mockedSpawnSync.mockReturnValue({ stdout: "ok", stderr: "", status: 0 } as any);

		const result = shell.runCaptureStatus("npm test");

		expect(result.exitCode).toBe(0);
		expect(result.output).toContain("ok");
	});

	it("returns exit code from failed command", () => {
		mockedSpawnSync.mockReturnValue({ stdout: "", stderr: "fail", status: 42 } as any);

		const result = shell.runCaptureStatus("bad-cmd");

		expect(result.exitCode).toBe(42);
	});

	it("defaults to exit code 1 when status is null", () => {
		mockedSpawnSync.mockReturnValue({ stdout: "", stderr: "", status: null } as any);

		const result = shell.runCaptureStatus("cmd");

		expect(result.exitCode).toBe(1);
	});

	it("uses default timeout of 120000ms", () => {
		mockedSpawnSync.mockReturnValue({ stdout: "", stderr: "", status: 0 } as any);

		shell.runCaptureStatus("npm test");

		expect(mockedSpawnSync).toHaveBeenCalledWith("npm test", expect.objectContaining({ timeout: 120_000 }));
	});
});

// ── runCaptureDetailed ──────────────────────────────────────────────

describe("shell.runCaptureDetailed", () => {
	it("returns separate stdout, stderr, and exitCode", () => {
		mockedSpawnSync.mockReturnValue({ stdout: "out", stderr: "err", status: 0 } as any);

		const result = shell.runCaptureDetailed("npm test");

		expect(result.stdout).toBe("out");
		expect(result.stderr).toBe("err");
		expect(result.exitCode).toBe(0);
	});

	it("defaults to exit code 1 when status is null", () => {
		mockedSpawnSync.mockReturnValue({ stdout: "", stderr: "", status: null } as any);

		const result = shell.runCaptureDetailed("cmd");

		expect(result.exitCode).toBe(1);
	});

	it("handles null stdout and stderr", () => {
		mockedSpawnSync.mockReturnValue({ stdout: null, stderr: null, status: 0 } as any);

		const result = shell.runCaptureDetailed("cmd");

		expect(result.stdout).toBe("");
		expect(result.stderr).toBe("");
	});

	it("passes env variables when provided", () => {
		mockedSpawnSync.mockReturnValue({ stdout: "", stderr: "", status: 0 } as any);

		shell.runCaptureDetailed("npm test", { env: { NODE_ENV: "test" } });

		expect(mockedSpawnSync).toHaveBeenCalledWith("npm test", expect.objectContaining({
			env: expect.objectContaining({ NODE_ENV: "test" }),
		}));
	});

	it("does not set env when not provided", () => {
		mockedSpawnSync.mockReturnValue({ stdout: "", stderr: "", status: 0 } as any);

		shell.runCaptureDetailed("npm test");

		expect(mockedSpawnSync).toHaveBeenCalledWith("npm test", expect.objectContaining({
			env: undefined,
		}));
	});
});

// ── execFile ────────────────────────────────────────────────────────

describe("shell.execFile", () => {
	it("returns trimmed output on success", () => {
		mockedExecFile.mockReturnValue("  result  \n" as any);

		const result = shell.execFile("node", ["--version"]);

		expect(result).toBe("result");
	});

	it("returns null on error", () => {
		mockedExecFile.mockImplementation(() => { throw new Error("not found"); });

		const result = shell.execFile("nonexistent", []);

		expect(result).toBeNull();
	});

	it("returns empty string for non-string result", () => {
		mockedExecFile.mockReturnValue(Buffer.from("data") as any);

		const result = shell.execFile("node", ["--version"]);

		expect(result).toBe("");
	});

	it("passes timeout option", () => {
		mockedExecFile.mockReturnValue("ok" as any);

		shell.execFile("cmd", ["arg"], { timeout: 5000 });

		expect(mockedExecFile).toHaveBeenCalledWith("cmd", ["arg"], expect.objectContaining({ timeout: 5000 }));
	});

	it("passes stdio option when provided", () => {
		mockedExecFile.mockReturnValue("ok" as any);

		shell.execFile("cmd", ["arg"], { stdio: "inherit" });

		expect(mockedExecFile).toHaveBeenCalledWith("cmd", ["arg"], expect.objectContaining({ stdio: "inherit" }));
	});
});

// ── spawnBackground ──────────────────────────────────────────────────

describe("shell.spawnBackground", () => {
	it("returns a BackgroundProcess with running=true initially", () => {
		const proc = shell.spawnBackground("node server.js");

		expect(proc.running).toBe(true);
	});

	it("uses CLI_PROJECT as default cwd", () => {
		shell.spawnBackground("node server.js");

		expect(mockedSpawn).toHaveBeenCalledWith(
			"node server.js",
			expect.objectContaining({ cwd: "/project" }),
		);
	});

	it("uses provided cwd", () => {
		shell.spawnBackground("node server.js", { cwd: "/custom" });

		expect(mockedSpawn).toHaveBeenCalledWith(
			"node server.js",
			expect.objectContaining({ cwd: "/custom" }),
		);
	});

	it("kill() calls taskkill on Windows", () => {
		mockedExec.mockReturnValue(Buffer.from(""));

		const proc = shell.spawnBackground("node server.js");
		proc.kill();

		expect(mockedExec).toHaveBeenCalledWith(
			"taskkill /T /F /PID 1234",
			expect.objectContaining({ stdio: "ignore" }),
		);
		expect(proc.running).toBe(false);
	});

	it("passes env variables when provided", () => {
		shell.spawnBackground("node server.js", { env: { MY_VAR: "hello" } });

		expect(mockedSpawn).toHaveBeenCalledWith(
			"node server.js",
			expect.objectContaining({
				env: expect.objectContaining({ MY_VAR: "hello" }),
			}),
		);
	});

	it("does not set env when not provided", () => {
		shell.spawnBackground("node server.js");

		expect(mockedSpawn).toHaveBeenCalledWith(
			"node server.js",
			expect.objectContaining({ env: undefined }),
		);
	});

	it("kill() is a no-op when already stopped", () => {
		const proc = shell.spawnBackground("node server.js");
		proc.kill(); // first kill
		vi.clearAllMocks();
		proc.kill(); // second kill — should not call execSync again
		expect(mockedExec).not.toHaveBeenCalled();
	});

	it("collectOutput pushes lines from stdout data events", () => {
		let stdoutHandler: ((chunk: Buffer) => void) | undefined;
		mockedSpawn.mockReturnValue({
			stdout: {
				on: vi.fn((event: string, cb: (chunk: Buffer) => void) => {
					if (event === "data") stdoutHandler = cb;
				}),
				off: vi.fn(),
			},
			stderr: { on: vi.fn(), off: vi.fn() },
			on: vi.fn(),
			off: vi.fn(),
			kill: vi.fn(),
			pid: 9999,
		} as any);

		const proc = shell.spawnBackground("echo hello");
		stdoutHandler!(Buffer.from("line1\nline2\n"));

		expect(proc.output).toContain("line1");
		expect(proc.output).toContain("line2");
	});

	it("onOutput callback fires for new lines and can be unsubscribed", () => {
		let stdoutHandler: ((chunk: Buffer) => void) | undefined;
		mockedSpawn.mockReturnValue({
			stdout: {
				on: vi.fn((event: string, cb: (chunk: Buffer) => void) => {
					if (event === "data") stdoutHandler = cb;
				}),
				off: vi.fn(),
			},
			stderr: { on: vi.fn(), off: vi.fn() },
			on: vi.fn(),
			off: vi.fn(),
			kill: vi.fn(),
			pid: 9999,
		} as any);

		const proc = shell.spawnBackground("echo hello");
		const received: string[] = [];
		const unsub = proc.onOutput((line) => received.push(line));

		stdoutHandler!(Buffer.from("first\n"));
		expect(received).toContain("first");

		unsub();
		stdoutHandler!(Buffer.from("second\n"));
		expect(received).not.toContain("second");
	});

	it("exit event sets running to false", () => {
		let exitHandler: (() => void) | undefined;
		mockedSpawn.mockReturnValue({
			stdout: { on: vi.fn(), off: vi.fn() },
			stderr: { on: vi.fn(), off: vi.fn() },
			on: vi.fn((event: string, cb: () => void) => {
				if (event === "exit") exitHandler = cb;
			}),
			off: vi.fn(),
			kill: vi.fn(),
			pid: 9999,
		} as any);

		const proc = shell.spawnBackground("echo hello");
		expect(proc.running).toBe(true);
		exitHandler!();
		expect(proc.running).toBe(false);
	});

	it("waitForOutput resolves when pattern matches stdout", async () => {
		let stdoutOnHandlers: Map<string, ((chunk: Buffer) => void)[]> = new Map();
		let stderrOnHandlers: Map<string, ((chunk: Buffer) => void)[]> = new Map();
		mockedSpawn.mockReturnValue({
			stdout: {
				on: vi.fn((event: string, cb: (chunk: Buffer) => void) => {
					if (!stdoutOnHandlers.has(event)) stdoutOnHandlers.set(event, []);
					stdoutOnHandlers.get(event)!.push(cb);
				}),
				off: vi.fn(),
			},
			stderr: {
				on: vi.fn((event: string, cb: (chunk: Buffer) => void) => {
					if (!stderrOnHandlers.has(event)) stderrOnHandlers.set(event, []);
					stderrOnHandlers.get(event)!.push(cb);
				}),
				off: vi.fn(),
			},
			on: vi.fn(),
			off: vi.fn(),
			kill: vi.fn(),
			pid: 9999,
		} as any);

		const proc = shell.spawnBackground("node server.js");
		const promise = proc.waitForOutput(/ready/, 5000);

		// Emit data on stdout — the waitForOutput listener is the LAST one added
		const listeners = stdoutOnHandlers.get("data") ?? [];
		for (const cb of listeners) cb(Buffer.from("server ready on port 3000\n"));

		const result = await promise;
		expect(result).toContain("ready");
	});

	it("waitForOutput resolves null on timeout", async () => {
		vi.useFakeTimers();
		mockedSpawn.mockReturnValue({
			stdout: { on: vi.fn(), off: vi.fn() },
			stderr: { on: vi.fn(), off: vi.fn() },
			on: vi.fn(),
			off: vi.fn(),
			kill: vi.fn(),
			pid: 9999,
		} as any);

		const proc = shell.spawnBackground("node server.js");
		const promise = proc.waitForOutput(/ready/, 1000);

		vi.advanceTimersByTime(1001);

		const result = await promise;
		expect(result).toBeNull();
		vi.useRealTimers();
	});

	it("waitForOutput resolves null on process exit", async () => {
		let exitHandlers: ((event: string) => void)[] = [];
		mockedSpawn.mockReturnValue({
			stdout: { on: vi.fn(), off: vi.fn() },
			stderr: { on: vi.fn(), off: vi.fn() },
			on: vi.fn((event: string, cb: () => void) => {
				exitHandlers.push(cb as any);
			}),
			off: vi.fn(),
			kill: vi.fn(),
			pid: 9999,
		} as any);

		const proc = shell.spawnBackground("node server.js");
		const promise = proc.waitForOutput(/ready/, 60_000);

		// Fire exit event — the last registered "exit" handler is from waitForOutput
		for (const cb of exitHandlers) cb("exit");

		const result = await promise;
		expect(result).toBeNull();
	});
});

// ── runAsync ─────────────────────────────────────────────────────────

describe("shell.runAsync", () => {
	it("resolves with output and exit code 0 on success", async () => {
		mockedExecAsync.mockImplementation((_cmd: any, _opts: any, cb: any) => {
			cb(null, "async output", "");
			return { stdin: { end: vi.fn() } } as any;
		});

		const result = await shell.runAsync("npm test");

		expect(result.exitCode).toBe(0);
		expect(result.output).toContain("async output");
	});

	it("resolves with exit code from error", async () => {
		mockedExecAsync.mockImplementation((_cmd: any, _opts: any, cb: any) => {
			cb({ code: 42 }, "", "error msg");
			return { stdin: { end: vi.fn() } } as any;
		});

		const result = await shell.runAsync("bad-cmd");

		expect(result.exitCode).toBe(42);
	});

	it("defaults to exit code 1 when error has no code", async () => {
		mockedExecAsync.mockImplementation((_cmd: any, _opts: any, cb: any) => {
			cb(new Error("oops"), "", "");
			return { stdin: { end: vi.fn() } } as any;
		});

		const result = await shell.runAsync("bad-cmd");

		expect(result.exitCode).toBe(1);
	});

	it("uses CLI_PROJECT as default cwd", async () => {
		mockedExecAsync.mockImplementation((_cmd: any, _opts: any, cb: any) => {
			cb(null, "", "");
			return { stdin: { end: vi.fn() } } as any;
		});

		await shell.runAsync("npm test");

		expect(mockedExecAsync).toHaveBeenCalledWith(
			"npm test",
			expect.objectContaining({ cwd: "/project" }),
			expect.any(Function),
		);
	});
});

// ── runParallel ──────────────────────────────────────────────────────

describe("shell.runParallel", () => {
	it("runs all commands and returns results in order", async () => {
		let callCount = 0;
		mockedExecAsync.mockImplementation((_cmd: any, _opts: any, cb: any) => {
			callCount++;
			cb(null, `output-${callCount}`, "");
			return { stdin: { end: vi.fn() } } as any;
		});

		const results = await shell.runParallel(["cmd1", "cmd2", "cmd3"]);

		expect(results).toHaveLength(3);
		expect(results[0].output).toContain("output-1");
		expect(results[1].output).toContain("output-2");
		expect(results[2].output).toContain("output-3");
	});

	it("returns empty array for empty input", async () => {
		const results = await shell.runParallel([]);

		expect(results).toEqual([]);
	});

	it("handles mixed success and failure", async () => {
		let callCount = 0;
		mockedExecAsync.mockImplementation((_cmd: any, _opts: any, cb: any) => {
			callCount++;
			if (callCount === 2) {
				cb({ code: 1 }, "", "fail");
			} else {
				cb(null, "ok", "");
			}
			return { stdin: { end: vi.fn() } } as any;
		});

		const results = await shell.runParallel(["cmd1", "cmd2", "cmd3"]);

		expect(results[0].exitCode).toBe(0);
		expect(results[1].exitCode).toBe(1);
		expect(results[2].exitCode).toBe(0);
	});
});
