/**
 * vault-test.controller.ts — Controller for vault-level test commands.
 *
 * Runs vault journey tests via vitest with the vault-specific config.
 * Supports running all tiers or individual tier test files.
 */

import type { ControllerAction } from "../infrastructure/request-response.js";
import { adapt, dataResponse } from "../infrastructure/request-response.js";
import type { CommandHandler } from "../infrastructure/types.js";
import { renderShellCommand, type ShellCommandModel } from "../ui/renderers/common-renderers.js";

// ── Controller actions ──────────────────────────────────────────────

function runVaultTests(tier: string, testFile?: string): ControllerAction {
	return (req) => {
		const cmd = testFile
			? `npx vitest run --config configs/vitest.vault.config.ts ${testFile}`
			: "npx vitest run --config configs/vitest.vault.config.ts";
		const cwd = req.deps.paths.resolve(".");
		const exitCode = req.deps.shell.run(cmd, { cwd });
		const data: ShellCommandModel = {
			command: `test:vault${tier !== "all" ? `:${tier}` : ""}`,
			exitCode,
			label: `Vault test [${tier}]`,
		};
		return dataResponse(data, (d) => renderShellCommand(req.deps.log, d));
	};
}

const actions: Record<string, ControllerAction> = {
	"test:vault": runVaultTests("all"),
	"test:vault:smoke": runVaultTests("smoke", "tests/vault-journeys/tier-1-smoke.test.ts"),
	"test:vault:integration": runVaultTests("integration", "tests/vault-journeys/tier-2-integration.test.ts"),
	"test:vault:ecosystem": runVaultTests("ecosystem", "tests/vault-journeys/tier-3-ecosystem.test.ts"),
};

// ── Adapted commands ────────────────────────────────────────────────

export const commands: Record<string, CommandHandler> = Object.fromEntries(
	Object.entries(actions).map(([key, action]) => [key, adapt(action)]),
);
