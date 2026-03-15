/**
 * vault-test-provider.ts — Environment provider for ephemeral vault testing.
 *
 * Provisions a temp copy of `tests/vault-template/`, injects the compiled
 * CLI binary, and exposes vault-cli, vault-project, and vault-assert tools.
 */

import type { EnvironmentProvider, ToolExecutor } from "../journey-environment.js";
import type { JourneyExecutorOptions } from "../journey-types.js";
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

// ── vault-cli tool ──────────────────────────────────────────────────

const toolVaultCli: ToolExecutor = (_action, _deps, _opts) => {
	return { tool: "vault-cli", success: false, error: "Not implemented", durationMs: 0 };
};

// ── vault-project tool ──────────────────────────────────────────────

const toolVaultProject: ToolExecutor = (_action, _deps, _opts) => {
	return { tool: "vault-project", success: false, error: "Not implemented", durationMs: 0 };
};

// ── vault-assert tool ───────────────────────────────────────────────

const toolVaultAssert: ToolExecutor = (_action, _deps, _opts) => {
	return { tool: "vault-assert", success: false, error: "Not implemented", durationMs: 0 };
};

// ── Provider config ─────────────────────────────────────────────────

interface VaultTestConfig {
	templateDir: string;
	binSrc: string;
}

// ── Factory ─────────────────────────────────────────────────────────

export function createVaultTestProvider(config?: VaultTestConfig): EnvironmentProvider {
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
