/**
 * vault-test.controller.ts — Controller for vault-level integration tests.
 *
 * Exposes test:vault commands that run journey definitions against an
 * ephemeral vault copy. Each tier (smoke, integration, ecosystem) can
 * be invoked independently or all together.
 *
 * Delegates to the Vitest vault config via shell.run().
 */

import type { ControllerAction } from "../infrastructure/request-response.js";
import { adapt, dataResponse } from "../infrastructure/request-response.js";

interface VaultTestResult {
	tier: string;
	command: string;
	exitCode: number;
}

function renderVaultTestResult(data: VaultTestResult): void {
	const status = data.exitCode === 0 ? "PASS" : "FAIL";
	// Renderer produces side effects via console — the framework calls log() externally
	void `Vault test [${data.tier}]: ${status}`;
}

const actions: Record<string, ControllerAction> = {
	"test:vault": (req) => {
		const cmd = "npx vitest run --config configs/vitest.vault.config.ts";
		const cwd = req.project?.path ?? req.deps.paths.resolve(".");
		const exitCode = req.deps.shell.run(cmd, { cwd });
		return dataResponse<VaultTestResult>(
			{ tier: "all", command: "test:vault", exitCode },
			renderVaultTestResult,
		);
	},
	"test:vault:smoke": (req) => {
		const cmd = "npx vitest run --config configs/vitest.vault.config.ts tests/vault-journeys/tier-1-smoke.test.ts";
		const cwd = req.project?.path ?? req.deps.paths.resolve(".");
		const exitCode = req.deps.shell.run(cmd, { cwd });
		return dataResponse<VaultTestResult>(
			{ tier: "smoke", command: "test:vault:smoke", exitCode },
			renderVaultTestResult,
		);
	},
	"test:vault:integration": (req) => {
		const cmd = "npx vitest run --config configs/vitest.vault.config.ts tests/vault-journeys/tier-2-integration.test.ts";
		const cwd = req.project?.path ?? req.deps.paths.resolve(".");
		const exitCode = req.deps.shell.run(cmd, { cwd });
		return dataResponse<VaultTestResult>(
			{ tier: "integration", command: "test:vault:integration", exitCode },
			renderVaultTestResult,
		);
	},
	"test:vault:ecosystem": (req) => {
		const cmd = "npx vitest run --config configs/vitest.vault.config.ts tests/vault-journeys/tier-3-ecosystem.test.ts";
		const cwd = req.project?.path ?? req.deps.paths.resolve(".");
		const exitCode = req.deps.shell.run(cmd, { cwd });
		return dataResponse<VaultTestResult>(
			{ tier: "ecosystem", command: "test:vault:ecosystem", exitCode },
			renderVaultTestResult,
		);
	},
};

export const commands = Object.fromEntries(
	Object.entries(actions).map(([key, action]) => [key, adapt(action)]),
);
