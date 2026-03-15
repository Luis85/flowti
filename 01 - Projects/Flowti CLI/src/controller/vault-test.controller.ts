/**
 * vault-test.controller.ts — Controller for vault-level integration tests.
 *
 * Exposes test:vault commands that run journey definitions against an
 * ephemeral vault copy. Each tier (smoke, integration, ecosystem) can
 * be invoked independently or all together.
 *
 * Delegates to the Vitest vault config via shell.run().
 */

import { adaptDescriptor } from "../infrastructure/command-engine.js";
import type { CommandHandler } from "../infrastructure/types.js";
import type { LogFn } from "../infrastructure/command-engine.js";

interface VaultTestResult {
	tier: string;
	command: string;
	exitCode: number;
}

function renderVaultTestResult(data: VaultTestResult, log: LogFn): void {
	const status = data.exitCode === 0 ? "PASS" : "FAIL";
	log(`  Vault test [${data.tier}]: ${status}`);
}

function vaultTestCommand(tier: string, cmd: string): CommandHandler {
	return adaptDescriptor<Record<string, unknown>, VaultTestResult>({
		handler: (ctx) => {
			const cwd = ctx.project?.path ?? ctx.deps.paths.resolve(".");
			const exitCode = ctx.deps.shell.run(cmd, { cwd });
			return { tier, command: `test:vault${tier === "all" ? "" : `:${tier}`}`, exitCode };
		},
		renderer: renderVaultTestResult,
		exitCode: (model) => model.exitCode === 0 ? undefined : 1,
	});
}

export const commands: Record<string, CommandHandler> = {
	"test:vault": vaultTestCommand("all", "npx vitest run --config configs/vitest.vault.config.ts"),
	"test:vault:smoke": vaultTestCommand("smoke", "npx vitest run --config configs/vitest.vault.config.ts tests/vault-journeys/tier-1-smoke.test.ts"),
	"test:vault:integration": vaultTestCommand("integration", "npx vitest run --config configs/vitest.vault.config.ts tests/vault-journeys/tier-2-integration.test.ts"),
	"test:vault:ecosystem": vaultTestCommand("ecosystem", "npx vitest run --config configs/vitest.vault.config.ts tests/vault-journeys/tier-3-ecosystem.test.ts"),
};
