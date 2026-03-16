/**
 * vault-test-provider.ts — Environment provider for ephemeral vault testing.
 *
 * Provisions a temp copy of `tests/vault-template/`, injects the compiled
 * CLI binary, and exposes vault-cli, vault-project, and vault-assert tools.
 */

import type { EnvironmentProvider, ToolExecutor } from "../journey-environment.js";
import type { ActionResult, JourneyAction, JourneyExecutorOptions } from "../journey-types.js";
import type { ToolDeps } from "../journey-executor.js";
import { resolveString } from "../journey-tools.js";

// ── Helpers ─────────────────────────────────────────────────────────

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

function vaultRoot(opts: { variables?: Record<string, unknown> }): string {
	return String(opts.variables?.["vaultRoot"] ?? ".");
}

// ── Shared result / variable helpers ────────────────────────────────

function buildToolResult(
	tool: string,
	success: boolean,
	startMs: number,
	clock: { ms(): number },
	output?: string,
	error?: string,
): ActionResult {
	return { tool, success, output, error, durationMs: clock.ms() - startMs };
}

function storeVariable(
	opts: JourneyExecutorOptions,
	storeAs: string | undefined,
	value: string,
	format?: string,
): void {
	if (!storeAs || !opts.variables) return;
	if (format === "json") {
		try {
			opts.variables[storeAs] = JSON.parse(value);
		} catch {
			opts.variables[storeAs] = value;
		}
	} else {
		opts.variables[storeAs] = value;
	}
}

function execInVault(
	deps: ToolDeps,
	command: string,
	root: string,
	opts: JourneyExecutorOptions,
): { exitCode: number; stdout: string; stderr: string } {
	return deps.exec(command, {
		cwd: root,
		timeout: opts.commandTimeout ?? 30_000,
		env: opts.env,
	});
}

// ── vault-cli tool ──────────────────────────────────────────────────

const toolVaultCli: ToolExecutor = (action, deps, opts) => {
	const start = deps.clock.ms();
	const root = vaultRoot(opts);
	const command = resolveString(action, "command", opts.variables ?? {});
	const expectExit = typeof action.expectExit === "number" ? action.expectExit : 0;
	const stdoutContains = action.stdoutContains as string | undefined;

	try {
		const r = execInVault(deps, `node .flowti/bin/main.mjs ${command}`, root, opts);
		const exitMatch = r.exitCode === expectExit;
		const containsMatch = stdoutContains ? r.stdout.includes(stdoutContains) : true;
		const success = exitMatch && containsMatch;

		storeVariable(opts, action.storeAs as string | undefined, r.stdout, action.format as string | undefined);

		const error = success
			? undefined
			: `Exit ${r.exitCode} (expected ${expectExit})${!containsMatch ? `, stdout missing "${stdoutContains}"` : ""}`;
		return buildToolResult("vault-cli", success, start, deps.clock, r.stdout.slice(0, 1000), error);
	} catch (e) {
		return buildToolResult("vault-cli", false, start, deps.clock, undefined, String(e));
	}
};

// ── vault-project tool ──────────────────────────────────────────────

function handleProjectList(
	deps: ToolDeps,
	opts: JourneyExecutorOptions,
	root: string,
	storeAs: string | undefined,
	start: number,
): ActionResult {
	const r = execInVault(deps, "node .flowti/bin/main.mjs info --format=json", root, opts);
	storeVariable(opts, storeAs, r.stdout, "json");
	return buildToolResult("vault-project", r.exitCode === 0, start, deps.clock, r.stdout.slice(0, 500));
}

function handleProjectInfo(
	deps: ToolDeps,
	opts: JourneyExecutorOptions,
	root: string,
	project: string,
	storeAs: string | undefined,
	start: number,
): ActionResult {
	const r = execInVault(deps, `node .flowti/bin/main.mjs info --project="${project}" --format=json`, root, opts);
	storeVariable(opts, storeAs, r.stdout, "json");
	return buildToolResult("vault-project", r.exitCode === 0, start, deps.clock, r.stdout.slice(0, 500));
}

function handleProjectRun(
	action: JourneyAction,
	deps: ToolDeps,
	opts: JourneyExecutorOptions,
	root: string,
	project: string,
	storeAs: string | undefined,
	start: number,
): ActionResult {
	const command = resolveString(action, "command", opts.variables ?? {});
	const expectExit = typeof action.expectExit === "number" ? action.expectExit : 0;
	const r = execInVault(deps, `node .flowti/bin/main.mjs ${command} --project="${project}"`, root, opts);
	if (storeAs && opts.variables) opts.variables[storeAs] = r.stdout;
	return buildToolResult("vault-project", r.exitCode === expectExit, start, deps.clock, r.stdout.slice(0, 500));
}

const toolVaultProject: ToolExecutor = (action, deps, opts) => {
	const start = deps.clock.ms();
	const root = vaultRoot(opts);
	const op = action.op as string;
	const project = resolveString(action, "project", opts.variables ?? {});
	const storeAs = action.storeAs as string | undefined;

	try {
		if (op === "list") return handleProjectList(deps, opts, root, storeAs, start);
		if (op === "info") return handleProjectInfo(deps, opts, root, project, storeAs, start);
		if (op === "run") return handleProjectRun(action, deps, opts, root, project, storeAs, start);
		return buildToolResult("vault-project", false, start, deps.clock, undefined, `Unknown op: ${op}`);
	} catch (e) {
		return buildToolResult("vault-project", false, start, deps.clock, undefined, String(e));
	}
};

// ── vault-assert tool ───────────────────────────────────────────────

function assertHealthScore(
	action: JourneyAction,
	opts: JourneyExecutorOptions,
	start: number,
	clock: { ms(): number },
): ActionResult {
	const source = opts.variables?.[action.source as string] as Record<string, unknown> | undefined;
	if (!source) return buildToolResult("vault-assert", false, start, clock, undefined, `Variable "${action.source}" not found`);
	const score = source.score as number;
	const min = action.min as number;
	const max = action.max as number;
	const success = score >= min && score <= max;
	return buildToolResult(
		"vault-assert", success, start, clock,
		`Score: ${score} (range: ${min}-${max})`,
		success ? undefined : `Score ${score} outside range ${min}-${max}`,
	);
}

function assertJsonField(
	action: JourneyAction,
	opts: JourneyExecutorOptions,
	start: number,
	clock: { ms(): number },
): ActionResult {
	const source = opts.variables?.[action.source as string] as Record<string, unknown> | undefined;
	if (!source) return buildToolResult("vault-assert", false, start, clock, undefined, `Variable "${action.source}" not found`);
	const actual = getNestedField(source, action.field as string);
	const success = compareValues(actual, action.operator as string, action.expected);
	return buildToolResult(
		"vault-assert", success, start, clock,
		`${action.field}: ${JSON.stringify(actual)} ${action.operator} ${JSON.stringify(action.expected)}`,
		success ? undefined : `Assertion failed: ${JSON.stringify(actual)} ${action.operator} ${JSON.stringify(action.expected)}`,
	);
}

function assertReportExists(
	action: JourneyAction,
	deps: ToolDeps,
	opts: JourneyExecutorOptions,
	start: number,
): ActionResult {
	const root = vaultRoot(opts);
	const project = resolveString(action, "project", opts.variables ?? {});
	const report = action.report as string;
	const reportPath = `${root}/01 - Projects/${project}/reports/${report}`;
	const success = deps.exists(reportPath);
	return buildToolResult(
		"vault-assert", success, start, deps.clock,
		reportPath,
		success ? undefined : `Report not found: ${reportPath}`,
	);
}

const toolVaultAssert: ToolExecutor = (action, deps, opts) => {
	const start = deps.clock.ms();
	const type = action.type as string;

	try {
		if (type === "health-score") return assertHealthScore(action, opts, start, deps.clock);
		if (type === "json-field") return assertJsonField(action, opts, start, deps.clock);
		if (type === "report-exists") return assertReportExists(action, deps, opts, start);
		return buildToolResult("vault-assert", false, start, deps.clock, undefined, `Unknown assert type: ${type}`);
	} catch (e) {
		return buildToolResult("vault-assert", false, start, deps.clock, undefined, String(e));
	}
};

// ── Provider config ─────────────────────────────────────────────────

interface VaultTestConfig {
	templateDir: string;
	binSrc: string;
}

// ── Factory ─────────────────────────────────────────────────────────

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

			// Resolve temp dir without process.env
			const tmpBase = deps.exec("node -e \"console.log(require('os').tmpdir())\"", {});
			const uuid = Math.random().toString(36).slice(2, 10);
			const tmpDir = `${tmpBase.stdout.trim()}/flowti-vault-test-${uuid}`;

			const templateDir = config?.templateDir ?? String(opts.variables["templateDir"] ?? "");
			const binSrc = config?.binSrc ?? String(opts.variables["binSrc"] ?? "");

			// Copy template vault to temp directory
			const safeTpl = templateDir.replace(/\\/g, "/");
			const safeTmp = tmpDir.replace(/\\/g, "/");
			deps.exec(`node -e "require('fs').cpSync('${safeTpl}', '${safeTmp}', { recursive: true })"`, {});

			// Inject CLI binary
			if (binSrc) {
				const binDest = `${tmpDir}/.flowti/bin`;
				deps.mkdir(binDest);
				const safeBin = binSrc.replace(/\\/g, "/");
				deps.exec(`node -e "require('fs').cpSync('${safeBin}', '${safeTmp}/.flowti/bin/main.mjs')"`, {});
			}

			currentVaultRoot = tmpDir;
			opts.variables["vaultRoot"] = tmpDir;
			opts.variables["healthyProject"] = "Healthy App";
			opts.variables["brokenProject"] = "Broken App";

			deps.log(`[vault-test] Provisioned vault at ${tmpDir}`);
		},
		async teardown(deps) {
			if (currentVaultRoot) {
				const safe = currentVaultRoot.replace(/\\/g, "/");
				deps.exec(`node -e "require('fs').rmSync('${safe}', { recursive: true, force: true })"`, {});
				deps.log(`[vault-test] Cleaned up ${currentVaultRoot}`);
				currentVaultRoot = undefined;
			} else {
				deps.log("[vault-test] teardown: no vault to clean up");
			}
		},
	};
}
