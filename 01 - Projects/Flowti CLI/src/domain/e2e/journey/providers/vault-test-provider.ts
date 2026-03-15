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

function getNestedField(obj: Record<string, unknown>, dotPath: string): unknown {
	return dotPath.split(".").reduce<unknown>((current, key) => {
		if (current && typeof current === "object") return (current as Record<string, unknown>)[key];
		return undefined;
	}, obj);
}

function compareValues(actual: unknown, operator: string, expected: unknown): boolean {
	switch (operator) {
		case "eq": return actual === expected;
		case "gt": return (actual as number) > (expected as number);
		case "gte": return (actual as number) >= (expected as number);
		case "lt": return (actual as number) < (expected as number);
		case "lte": return (actual as number) <= (expected as number);
		case "contains": return typeof actual === "string" && actual.includes(String(expected));
		default: return false;
	}
}

const toolVaultAssert: ToolExecutor = (action, deps, opts) => {
	const start = deps.clock.ms();
	const type = action.type as string;

	try {
		if (type === "health-score") {
			const source = opts.variables?.[action.source as string] as Record<string, unknown> | undefined;
			if (!source) return { tool: "vault-assert", success: false, error: `Variable "${action.source}" not found`, durationMs: deps.clock.ms() - start };
			const score = source.score as number;
			const min = action.min as number;
			const max = action.max as number;
			const success = score >= min && score <= max;
			return { tool: "vault-assert", success, output: `Score: ${score} (range: ${min}-${max})`, error: success ? undefined : `Score ${score} outside range ${min}-${max}`, durationMs: deps.clock.ms() - start };
		}

		if (type === "json-field") {
			const source = opts.variables?.[action.source as string] as Record<string, unknown> | undefined;
			if (!source) return { tool: "vault-assert", success: false, error: `Variable "${action.source}" not found`, durationMs: deps.clock.ms() - start };
			const actual = getNestedField(source, action.field as string);
			const success = compareValues(actual, action.operator as string, action.expected);
			return { tool: "vault-assert", success, output: `${action.field}: ${JSON.stringify(actual)} ${action.operator} ${JSON.stringify(action.expected)}`, error: success ? undefined : `Assertion failed: ${JSON.stringify(actual)} ${action.operator} ${JSON.stringify(action.expected)}`, durationMs: deps.clock.ms() - start };
		}

		if (type === "report-exists") {
			const vaultRoot = opts.variables?.["vaultRoot"] as string ?? ".";
			const project = resolveString(action, "project", opts.variables ?? {});
			const report = action.report as string;
			const reportPath = `${vaultRoot}/01 - Projects/${project}/reports/${report}`;
			const success = deps.exists(reportPath);
			return { tool: "vault-assert", success, output: reportPath, error: success ? undefined : `Report not found: ${reportPath}`, durationMs: deps.clock.ms() - start };
		}

		return { tool: "vault-assert", success: false, error: `Unknown assert type: ${type}`, durationMs: deps.clock.ms() - start };
	} catch (e) {
		return { tool: "vault-assert", success: false, error: String(e), durationMs: deps.clock.ms() - start };
	}
};

interface VaultTestConfig {
	templateDir: string;
	binSrc: string;
}

export function createVaultTestProvider(config?: VaultTestConfig): EnvironmentProvider {
	let currentVaultRoot: string | undefined;

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

			const tmpBase = deps.exec("node -e \"console.log(require('os').tmpdir())\"", {});
			const uuid = Math.random().toString(36).slice(2, 10);
			const tmpDir = `${tmpBase.stdout.trim()}/flowti-vault-test-${uuid}`;

			const templateDir = config?.templateDir ?? opts.variables["templateDir"] as string;
			const binSrc = config?.binSrc ?? opts.variables["binSrc"] as string;

			if (templateDir) {
				const safeTpl = templateDir.replace(/\\/g, "/");
				deps.exec(`node -e "require('fs').cpSync('${safeTpl}', '${tmpDir}', { recursive: true })"`, {});
			} else {
				deps.mkdir(tmpDir);
			}

			if (binSrc) {
				const binDest = `${tmpDir}/.flowti/bin`;
				deps.mkdir(binDest);
				const safeBin = binSrc.replace(/\\/g, "/");
				deps.exec(`node -e "require('fs').cpSync('${safeBin}', '${binDest}/main.js')"`, {});
			}

			currentVaultRoot = tmpDir;
			opts.variables["vaultRoot"] = tmpDir;
			opts.variables["healthyProject"] = "Healthy App";
			opts.variables["brokenProject"] = "Broken App";

			deps.log(`[vault-test] Provisioned vault at ${tmpDir}`);
		},
		async teardown(deps) {
			if (currentVaultRoot) {
				const safePath = currentVaultRoot.replace(/\\/g, "/");
				deps.exec(`node -e "require('fs').rmSync('${safePath}', { recursive: true, force: true })"`, {});
				deps.log(`[vault-test] Cleaned up ${currentVaultRoot}`);
				currentVaultRoot = undefined;
			} else {
				deps.log("[vault-test] teardown: nothing to clean up");
			}
		},
	};
}
