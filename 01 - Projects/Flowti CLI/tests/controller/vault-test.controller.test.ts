/**
 * vault-test.controller.test.ts — Tests for the vault-test controller.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/infrastructure/shell.js", async () => {
	const { mockShellPreset } = await import("../mocks/mock-presets.js");
	return mockShellPreset();
});
vi.mock("../../src/infrastructure/logger.js", () => ({ log: vi.fn() }));
vi.mock("../../src/ui/renderers/common-renderers.js", () => ({
	renderShellCommand: vi.fn(),
}));

import { commands } from "../../src/controller/vault-test.controller.js";
import { initializeDeps } from "../../src/infrastructure/request-response.js";
import { shell } from "../../src/infrastructure/shell.js";
import { log } from "../../src/infrastructure/logger.js";

describe("vault-test.controller", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		initializeDeps({
			disk: {} as never, shell, paths: { join: (...a: string[]) => a.join("/"), resolve: (...a: string[]) => a.join("/"), dirname: (p: string) => p, basename: (p: string) => p.split("/").pop() ?? p, relative: (_: string, b: string) => b, extname: () => "", isAbsolute: () => false, sep: "/" },
			clock: { iso: () => "", now: () => new Date(), ms: () => 0, safeIso: () => "" },
			proc: { exit: vi.fn() as never, argv: () => [], cwd: () => "/", env: () => ({}) },
			input: { ask: vi.fn() as never, askYesNo: vi.fn() as never, waitForEnter: vi.fn() as never },
			bus: { emit: vi.fn(), on: vi.fn(), off: vi.fn(), clear: vi.fn() } as never,
			log, warn: vi.fn(),
		});
	});

	it("exports test:vault command", () => {
		expect(commands["test:vault"]).toBeDefined();
	});

	it("exports test:vault:smoke command", () => {
		expect(commands["test:vault:smoke"]).toBeDefined();
	});

	it("exports test:vault:integration command", () => {
		expect(commands["test:vault:integration"]).toBeDefined();
	});

	it("exports test:vault:ecosystem command", () => {
		expect(commands["test:vault:ecosystem"]).toBeDefined();
	});

	describe("test:vault", () => {
		it("calls shell.run with vault vitest config", () => {
			commands["test:vault"]({}, [], "test:vault", undefined);
			expect(shell.run).toHaveBeenCalledWith(
				"npx vitest run --config configs/vitest.vault.config.ts",
				expect.objectContaining({ cwd: expect.any(String) }),
			);
		});
	});

	describe("test:vault:smoke", () => {
		it("calls shell.run with tier-1 test file", () => {
			commands["test:vault:smoke"]({}, [], "test:vault:smoke", undefined);
			expect(shell.run).toHaveBeenCalledWith(
				"npx vitest run --config configs/vitest.vault.config.ts tests/vault-journeys/tier-1-smoke.test.ts",
				expect.objectContaining({ cwd: expect.any(String) }),
			);
		});
	});

	describe("test:vault:integration", () => {
		it("calls shell.run with tier-2 test file", () => {
			commands["test:vault:integration"]({}, [], "test:vault:integration", undefined);
			expect(shell.run).toHaveBeenCalledWith(
				"npx vitest run --config configs/vitest.vault.config.ts tests/vault-journeys/tier-2-integration.test.ts",
				expect.objectContaining({ cwd: expect.any(String) }),
			);
		});
	});

	describe("test:vault:ecosystem", () => {
		it("calls shell.run with tier-3 test file", () => {
			commands["test:vault:ecosystem"]({}, [], "test:vault:ecosystem", undefined);
			expect(shell.run).toHaveBeenCalledWith(
				"npx vitest run --config configs/vitest.vault.config.ts tests/vault-journeys/tier-3-ecosystem.test.ts",
				expect.objectContaining({ cwd: expect.any(String) }),
			);
		});
	});
});
