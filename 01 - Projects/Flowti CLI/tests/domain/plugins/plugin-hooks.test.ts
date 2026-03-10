import { describe, it, expect, vi } from "vitest";
import {
	validateHooks,
	extractHooks,
	runHook,
	runHookSilent,
	wrapWithHooks,
	type PluginHooks,
	type HookName,
} from "../../../src/domain/plugins/plugin-hooks.js";

// ── validateHooks ────────────────────────────────────────────────────

describe("validateHooks", () => {
	it("returns empty errors for undefined hooks", () => {
		expect(validateHooks(undefined)).toEqual([]);
	});

	it("returns empty errors for null hooks", () => {
		expect(validateHooks(null)).toEqual([]);
	});

	it("rejects non-object hooks", () => {
		const errors = validateHooks("not an object");
		expect(errors).toContain('"hooks" must be an object');
	});

	it("rejects array hooks", () => {
		const errors = validateHooks([]);
		expect(errors).toContain('"hooks" must be an object');
	});

	it("accepts valid hooks", () => {
		const errors = validateHooks({
			onInstall: "npm install",
			onEnable: "echo enabled",
			onDisable: "echo disabled",
			onBeforeCommand: "echo before",
			onAfterCommand: "echo after",
		});
		expect(errors).toEqual([]);
	});

	it("rejects unknown hook names", () => {
		const errors = validateHooks({ onFoo: "echo foo" });
		expect(errors[0]).toContain("Unknown hook");
		expect(errors[0]).toContain("onFoo");
	});

	it("rejects non-string hook values", () => {
		const errors = validateHooks({ onInstall: 42 });
		expect(errors[0]).toContain("non-empty string");
	});

	it("rejects empty string hook values", () => {
		const errors = validateHooks({ onEnable: "  " });
		expect(errors[0]).toContain("non-empty string");
	});

	it("reports multiple errors", () => {
		const errors = validateHooks({ onBadName: 42, onInstall: "" });
		expect(errors.length).toBeGreaterThanOrEqual(2);
	});
});

// ── extractHooks ─────────────────────────────────────────────────────

describe("extractHooks", () => {
	it("returns empty hooks when no hooks field", () => {
		expect(extractHooks({ name: "test" })).toEqual({});
	});

	it("returns empty hooks for non-object hooks", () => {
		expect(extractHooks({ hooks: "bad" })).toEqual({});
	});

	it("extracts valid hook names only", () => {
		const hooks = extractHooks({
			hooks: {
				onInstall: "npm install",
				onBogus: "should be skipped",
				onEnable: "echo hi",
			},
		});
		expect(hooks.onInstall).toBe("npm install");
		expect(hooks.onEnable).toBe("echo hi");
		expect(Object.keys(hooks)).toHaveLength(2);
	});

	it("skips empty string hooks", () => {
		const hooks = extractHooks({ hooks: { onInstall: "" } });
		expect(hooks.onInstall).toBeUndefined();
	});
});

// ── runHook ──────────────────────────────────────────────────────────

describe("runHook", () => {
	function mockShell(exitCode = 0) {
		return {
			run: vi.fn().mockReturnValue(exitCode),
			runSilent: vi.fn().mockReturnValue("output"),
			check: vi.fn().mockReturnValue(true),
			execFile: vi.fn().mockReturnValue(""),
			runCapture: vi.fn().mockReturnValue(""),
			runCaptureStatus: vi.fn().mockReturnValue({ output: "", exitCode: 0 }),
		};
	}

	it("returns null when hook is not defined", () => {
		const hooks: PluginHooks = {};
		const result = runHook(hooks, "onInstall", mockShell() as never, "/cwd");
		expect(result).toBeNull();
	});

	it("runs the hook command and returns success", () => {
		const hooks: PluginHooks = { onInstall: "npm install" };
		const shell = mockShell(0);
		const result = runHook(hooks, "onInstall", shell as never, "/cwd");
		expect(result).toEqual({ hook: "onInstall", exitCode: 0, success: true });
		expect(shell.run).toHaveBeenCalledWith("npm install", { cwd: "/cwd", label: "[hook:onInstall]" });
	});

	it("reports failure when exit code is non-zero", () => {
		const hooks: PluginHooks = { onEnable: "echo fail" };
		const shell = mockShell(1);
		const result = runHook(hooks, "onEnable", shell as never, "/cwd");
		expect(result?.success).toBe(false);
		expect(result?.exitCode).toBe(1);
	});

	it("prepends env variables when provided", () => {
		const hooks: PluginHooks = { onAfterCommand: "echo done" };
		const shell = mockShell(0);
		runHook(hooks, "onAfterCommand", shell as never, "/cwd", { EXIT_CODE: "0" });
		expect(shell.run).toHaveBeenCalledWith(
			"EXIT_CODE=0 echo done",
			expect.objectContaining({ cwd: "/cwd" }),
		);
	});
});

// ── runHookSilent ────────────────────────────────────────────────────

describe("runHookSilent", () => {
	it("returns true when hook is not defined", () => {
		const shell = { runSilent: vi.fn() } as never;
		expect(runHookSilent({}, "onInstall", shell, "/cwd")).toBe(true);
	});

	it("returns true on success", () => {
		const shell = { runSilent: vi.fn().mockReturnValue("ok") } as never;
		expect(runHookSilent({ onEnable: "echo hi" }, "onEnable", shell, "/cwd")).toBe(true);
	});

	it("returns false on failure", () => {
		const shell = { runSilent: vi.fn().mockReturnValue(null) } as never;
		expect(runHookSilent({ onDisable: "exit 1" }, "onDisable", shell, "/cwd")).toBe(false);
	});
});

// ── wrapWithHooks ────────────────────────────────────────────────────

describe("wrapWithHooks", () => {
	function mockShell(exitCodes: Record<string, number> = {}) {
		let callIndex = 0;
		const exitCodeList = Object.values(exitCodes);
		return {
			run: vi.fn().mockImplementation(() => {
				return exitCodeList[callIndex++] ?? 0;
			}),
			runSilent: vi.fn().mockReturnValue("output"),
			check: vi.fn().mockReturnValue(true),
			execFile: vi.fn().mockReturnValue(""),
			runCapture: vi.fn().mockReturnValue(""),
			runCaptureStatus: vi.fn().mockReturnValue({ output: "", exitCode: 0 }),
		};
	}

	it("runs command directly when no hooks", () => {
		const originalRun = vi.fn().mockReturnValue(0);
		const wrapped = wrapWithHooks({}, mockShell() as never, "/cwd", originalRun);
		expect(wrapped()).toBe(0);
		expect(originalRun).toHaveBeenCalled();
	});

	it("runs onBeforeCommand before the command", () => {
		const calls: string[] = [];
		const shell = {
			run: vi.fn().mockImplementation((_cmd: string, opts: { label: string }) => {
				calls.push(opts.label);
				return 0;
			}),
		} as never;
		const originalRun = vi.fn().mockImplementation(() => { calls.push("command"); return 0; });
		const hooks: PluginHooks = { onBeforeCommand: "echo before" };
		const wrapped = wrapWithHooks(hooks, shell, "/cwd", originalRun);
		wrapped();
		expect(calls).toEqual(["[hook:onBeforeCommand]", "command"]);
	});

	it("aborts command when onBeforeCommand fails", () => {
		const shell = { run: vi.fn().mockReturnValue(1) } as never;
		const originalRun = vi.fn().mockReturnValue(0);
		const hooks: PluginHooks = { onBeforeCommand: "exit 1" };
		const wrapped = wrapWithHooks(hooks, shell, "/cwd", originalRun);
		const result = wrapped();
		expect(result).toBe(1);
		expect(originalRun).not.toHaveBeenCalled();
	});

	it("runs onAfterCommand after the command", () => {
		const calls: string[] = [];
		const shell = {
			run: vi.fn().mockImplementation((_cmd: string, opts: { label: string }) => {
				calls.push(opts.label);
				return 0;
			}),
		} as never;
		const originalRun = vi.fn().mockImplementation(() => { calls.push("command"); return 0; });
		const hooks: PluginHooks = { onAfterCommand: "echo after" };
		const wrapped = wrapWithHooks(hooks, shell, "/cwd", originalRun);
		wrapped();
		expect(calls).toEqual(["command", "[hook:onAfterCommand]"]);
	});

	it("runs onAfterCommand even when command fails", () => {
		const shell = { run: vi.fn().mockReturnValue(0) } as never;
		const originalRun = vi.fn().mockReturnValue(1);
		const hooks: PluginHooks = { onAfterCommand: "echo cleanup" };
		const wrapped = wrapWithHooks(hooks, shell, "/cwd", originalRun);
		const result = wrapped();
		expect(result).toBe(1);
		expect(shell.run).toHaveBeenCalled();
	});

	it("passes command exit code as env to onAfterCommand", () => {
		const shell = { run: vi.fn().mockReturnValue(0) } as never;
		const originalRun = vi.fn().mockReturnValue(42);
		const hooks: PluginHooks = { onAfterCommand: "echo done" };
		const wrapped = wrapWithHooks(hooks, shell, "/cwd", originalRun);
		wrapped();
		expect(shell.run).toHaveBeenCalledWith(
			expect.stringContaining("FLOWTI_COMMAND_EXIT_CODE=42"),
			expect.anything(),
		);
	});

	it("runs both before and after hooks in order", () => {
		const calls: string[] = [];
		const shell = {
			run: vi.fn().mockImplementation((_cmd: string, opts: { label: string }) => {
				calls.push(opts.label);
				return 0;
			}),
		} as never;
		const originalRun = vi.fn().mockImplementation(() => { calls.push("command"); return 0; });
		const hooks: PluginHooks = { onBeforeCommand: "echo before", onAfterCommand: "echo after" };
		const wrapped = wrapWithHooks(hooks, shell, "/cwd", originalRun);
		wrapped();
		expect(calls).toEqual(["[hook:onBeforeCommand]", "command", "[hook:onAfterCommand]"]);
	});
});
