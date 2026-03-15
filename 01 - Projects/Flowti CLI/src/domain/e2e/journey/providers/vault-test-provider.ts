/**
 * vault-test-provider.ts — Environment provider for ephemeral vault testing.
 *
 * Provisions temporary vault copies from a template directory, executes
 * Flowti CLI commands against them, and tears down after each journey.
 */

import type { EnvironmentProvider, ToolExecutor } from "../journey-environment.js";

const toolVaultCli: ToolExecutor = (_action, _deps, _opts) => {
	return { tool: "vault-cli", success: false, error: "Not implemented", durationMs: 0 };
};

const toolVaultProject: ToolExecutor = (_action, _deps, _opts) => {
	return { tool: "vault-project", success: false, error: "Not implemented", durationMs: 0 };
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
