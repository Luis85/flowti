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

import { execSync, execFileSync, spawnSync } from "node:child_process";
import { shell } from "../../src/infrastructure/shell.js";

const mockedExec = vi.mocked(execSync);
const mockedExecFile = vi.mocked(execFileSync);
const mockedSpawnSync = vi.mocked(spawnSync);

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
});

describe("shell.runSilent", () => {
	it("returns trimmed output on success", () => {
		mockedExec.mockReturnValue("  v24.12.0\n" as unknown as Buffer);
		expect(shell.runSilent("node --version")).toBe("v24.12.0");
	});

	it("returns null on failure", () => {
		mockedExec.mockImplementation(() => { throw new Error("fail"); });
		expect(shell.runSilent("bad-cmd")).toBeNull();
	});

	it("uses CLI_PROJECT as default cwd", () => {
		mockedExec.mockReturnValue("output" as unknown as Buffer);
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
