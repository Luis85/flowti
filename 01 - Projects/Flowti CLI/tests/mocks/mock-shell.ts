/**
 * mock-shell.ts — In-memory IShell for tests.
 *
 * Usage:
 *   const sh = createMockShell({ "git --version": "git version 2.43.0" });
 *   sh.runSilent("git --version"); // "git version 2.43.0"
 *   sh.check("git --version");     // true
 *   sh.run("npm install");         // 0 (default success)
 */

import type { IShell } from "../../src/infrastructure/types.js";

export interface MockShellOptions {
	/** Map command → stdout (for runSilent). Missing = null (failure). */
	outputs?: Record<string, string>;
	/** Map command → exit code (for run). Missing = 0 (success). */
	exitCodes?: Record<string, number>;
	/** Commands that should fail check(). By default all succeed. */
	failChecks?: string[];
}

export function createMockShell(opts: MockShellOptions = {}): IShell & {
	calls: Array<{ method: string; cmd: string; opts?: Record<string, unknown> }>;
} {
	const outputs = opts.outputs ?? {};
	const exitCodes = opts.exitCodes ?? {};
	const failChecks = new Set(opts.failChecks ?? []);

	const calls: Array<{ method: string; cmd: string; opts?: Record<string, unknown> }> = [];

	return {
		calls,

		run(cmd: string, runOpts?: { cwd?: string; label?: string }): number {
			calls.push({ method: "run", cmd, opts: runOpts });
			return exitCodes[cmd] ?? 0;
		},

		runSilent(cmd: string, runOpts?: { cwd?: string }): string | null {
			calls.push({ method: "runSilent", cmd, opts: runOpts });
			return outputs[cmd] ?? null;
		},

		check(cmd: string): boolean {
			calls.push({ method: "check", cmd });
			return !failChecks.has(cmd);
		},

		runCapture(cmd: string, runOpts?: { cwd?: string; timeout?: number }): string {
			calls.push({ method: "runCapture", cmd, opts: runOpts });
			return outputs[cmd] ?? "";
		},

		execFile(cmd: string, args: string[], execOpts?: { timeout?: number; stdio?: string }): string | null {
			const key = `${cmd} ${args.join(" ")}`;
			calls.push({ method: "execFile", cmd: key, opts: execOpts });
			return outputs[key] ?? null;
		},

		runCaptureStatus(cmd: string, runOpts?: { cwd?: string; timeout?: number }): { output: string; exitCode: number } {
			calls.push({ method: "runCaptureStatus", cmd, opts: runOpts });
			return { output: outputs[cmd] ?? "", exitCode: exitCodes[cmd] ?? 0 };
		},
	};
}
