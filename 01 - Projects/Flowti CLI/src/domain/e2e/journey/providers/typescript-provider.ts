/**
 * typescript-provider.ts — Environment provider for TypeScript projects.
 *
 * Adds tools for TypeScript-specific assertions: type-checking,
 * build verification, and module resolution.
 */

import type { EnvironmentProvider } from "../journey-environment.js";
import type { ToolExecutor } from "../journey-tools.js";
import { resolveString } from "../journey-tools.js";

/**
 * Tool: tsc-check — run the TypeScript compiler in check mode.
 * Action: { tool: "tsc-check", tsconfig?: "tsconfig.json" }
 */
const toolTscCheck: ToolExecutor = (action, deps, opts) => {
	const start = Date.now();
	const tsconfig = resolveString(action, "tsconfig", opts.variables ?? {}) || "tsconfig.json";
	try {
		const result = deps.exec(`npx tsc --noEmit -p ${tsconfig}`, {
			cwd: opts.cwd,
			timeout: opts.commandTimeout ?? 60000,
			env: opts.env,
		});
		const success = result.exitCode === 0;
		return {
			tool: "tsc-check",
			success,
			output: success ? "No type errors" : result.stdout.slice(0, 500),
			error: success ? undefined : `Type check failed (exit ${result.exitCode})`,
			durationMs: Date.now() - start,
		};
	} catch (e) {
		return { tool: "tsc-check", success: false, error: String(e), durationMs: Date.now() - start };
	}
};

/**
 * Tool: lint — run the project linter.
 * Action: { tool: "lint", command?: "npx eslint ." }
 */
const toolLint: ToolExecutor = (action, deps, opts) => {
	const start = Date.now();
	const cmd = resolveString(action, "command", opts.variables ?? {}) || "npx eslint .";
	try {
		const result = deps.exec(cmd, {
			cwd: opts.cwd,
			timeout: opts.commandTimeout ?? 60000,
			env: opts.env,
		});
		const success = result.exitCode === 0;
		return {
			tool: "lint",
			success,
			output: result.stdout.slice(0, 300),
			error: success ? undefined : `Lint failed (exit ${result.exitCode})`,
			durationMs: Date.now() - start,
		};
	} catch (e) {
		return { tool: "lint", success: false, error: String(e), durationMs: Date.now() - start };
	}
};

export function createTypescriptProvider(): EnvironmentProvider {
	return {
		target: "typescript",
		label: "TypeScript Project",
		capabilities: ["command", "filesystem", "tsc-check", "lint"],
		tools: {
			"tsc-check": toolTscCheck,
			lint: toolLint,
		},
	};
}
