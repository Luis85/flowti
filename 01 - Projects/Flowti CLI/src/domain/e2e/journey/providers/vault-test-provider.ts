/**
 * vault-test-provider.ts — Environment provider for ephemeral vault testing.
 *
 * Provisions temporary vault copies from a template directory, executes
 * Flowti CLI commands against them, and tears down after each journey.
 */

import type { EnvironmentProvider, ToolExecutor } from "../journey-environment.js";
import { resolveString } from "../journey-tools.js";

const toolVaultCli: ToolExecutor = (action, deps, opts) => {
	const start = deps.clock.ms();
	const vaultRoot = opts.variables?.["vaultRoot"] as string ?? ".";
	const command = resolveString(action, "command", opts.variables ?? {});
	const expectExit = typeof action.expectExit === "number" ? action.expectExit : 0;
	const stdoutContains = action.stdoutContains as string | undefined;
	const storeAs = action.storeAs as string | undefined;
	const format = action.format as string | undefined;

	try {
		const r = deps.exec(`node .flowti/bin/main.js ${command}`, {
			cwd: vaultRoot,
			timeout: opts.commandTimeout ?? 30_000,
			env: opts.env,
		});

		const exitMatch = r.exitCode === expectExit;
		const containsMatch = stdoutContains ? r.stdout.includes(stdoutContains) : true;
		const success = exitMatch && containsMatch;

		if (storeAs && opts.variables) {
			if (format === "json") {
				try {
					opts.variables[storeAs] = JSON.parse(r.stdout);
				} catch {
					opts.variables[storeAs] = r.stdout;
				}
			} else {
				opts.variables[storeAs] = r.stdout;
			}
		}

		return {
			tool: "vault-cli",
			success,
			output: r.stdout.slice(0, 1000),
			error: success ? undefined : `Exit ${r.exitCode} (expected ${expectExit})${!containsMatch ? `, stdout missing "${stdoutContains}"` : ""}`,
			durationMs: deps.clock.ms() - start,
		};
	} catch (e) {
		return { tool: "vault-cli", success: false, error: String(e), durationMs: deps.clock.ms() - start };
	}
};

const toolVaultProject: ToolExecutor = (action, deps, opts) => {
	const start = deps.clock.ms();
	const vaultRoot = opts.variables?.["vaultRoot"] as string ?? ".";
	const op = action.op as string;
	const project = resolveString(action, "project", opts.variables ?? {});
	const storeAs = action.storeAs as string | undefined;

	try {
		if (op === "list") {
			const r = deps.exec("node .flowti/bin/main.js info --format=json", {
				cwd: vaultRoot,
				timeout: opts.commandTimeout ?? 30_000,
				env: opts.env,
			});
			if (storeAs && opts.variables) {
				try {
					opts.variables[storeAs] = JSON.parse(r.stdout);
				} catch {
					opts.variables[storeAs] = r.stdout;
				}
			}
			return { tool: "vault-project", success: r.exitCode === 0, output: r.stdout.slice(0, 500), durationMs: deps.clock.ms() - start };
		}

		if (op === "info") {
			const r = deps.exec(`node .flowti/bin/main.js info --project="${project}" --format=json`, {
				cwd: vaultRoot,
				timeout: opts.commandTimeout ?? 30_000,
				env: opts.env,
			});
			if (storeAs && opts.variables) {
				try {
					opts.variables[storeAs] = JSON.parse(r.stdout);
				} catch {
					opts.variables[storeAs] = r.stdout;
				}
			}
			return { tool: "vault-project", success: r.exitCode === 0, output: r.stdout.slice(0, 500), durationMs: deps.clock.ms() - start };
		}

		if (op === "run") {
			const command = resolveString(action, "command", opts.variables ?? {});
			const expectExit = typeof action.expectExit === "number" ? action.expectExit : 0;
			const r = deps.exec(`node .flowti/bin/main.js ${command} --project="${project}"`, {
				cwd: vaultRoot,
				timeout: opts.commandTimeout ?? 30_000,
				env: opts.env,
			});
			if (storeAs && opts.variables) opts.variables[storeAs] = r.stdout;
			return { tool: "vault-project", success: r.exitCode === expectExit, output: r.stdout.slice(0, 500), durationMs: deps.clock.ms() - start };
		}

		return { tool: "vault-project", success: false, error: `Unknown op: ${op}`, durationMs: deps.clock.ms() - start };
	} catch (e) {
		return { tool: "vault-project", success: false, error: String(e), durationMs: deps.clock.ms() - start };
	}
};

const toolVaultAssert: ToolExecutor = (_action, _deps, _opts) => {
	return { tool: "vault-assert", success: false, error: "Not implemented", durationMs: 0 };
};

export function createVaultTestProvider(): EnvironmentProvider {
	return {
		target: "vault-test",
		label: "Vault Test",
		capabilities: ["command", "filesystem", "vault-provision", "vault-cli", "vault-project"],
		tools: {
			"vault-cli": toolVaultCli,
			"vault-project": toolVaultProject,
			"vault-assert": toolVaultAssert,
		},
		async setup(deps, opts) {
			opts.variables ??= {};
			deps.log("[vault-test] setup: not yet implemented");
		},
		async teardown(deps) {
			deps.log("[vault-test] teardown: not yet implemented");
		},
	};
}
