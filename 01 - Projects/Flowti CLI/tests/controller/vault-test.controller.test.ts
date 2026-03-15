/**
 * vault-test.controller.test.ts — Tests for the vault-test controller.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/infrastructure/shell.js", async () => {
	const { mockShellPreset } = await import("../mocks/mock-presets.js");
	return mockShellPreset();
});
vi.mock("../../src/infrastructure/logger.js", () => ({ log: vi.fn() }));
vi.mock("../../src/infrastructure/filesystem.js", () => ({
	disk: { existsSync: vi.fn(() => false) },
}));
vi.mock("../../src/infrastructure/paths.js", () => ({
	paths: {
		join: (...a: string[]) => a.join("/"),
		resolve: (...a: string[]) => a.join("/"),
		dirname: (p: string) => p,
		basename: (p: string) => p.split("/").pop() ?? p,
		relative: (_: string, b: string) => b,
		extname: () => "",
		isAbsolute: () => false,
		sep: "/",
	},
}));
vi.mock("../../src/infrastructure/clock.js", () => ({
	clock: { iso: () => "", now: () => new Date(), ms: () => 0, safeIso: () => "" },
}));
vi.mock("../../src/infrastructure/proc.js", () => ({
	proc: { exit: vi.fn(), argv: () => [], cwd: () => "/", env: () => ({}) },
}));
vi.mock("../../src/infrastructure/config.js", () => ({
	VAULT_ROOT: "/vault",
	PROJECTS_DIR: "/vault/projects",
	CLI_PROJECT: "/vault/01 - Projects/Flowti CLI",
	cliConfig: { agents: [], onboarding: {} },
}));
vi.mock("../../src/ui/renderers/common-renderers.js", () => ({
	renderNoProject: vi.fn(),
}));

import { commands } from "../../src/controller/vault-test.controller.js";
import { initializeDeps } from "../../src/infrastructure/request-response.js";
import { shell } from "../../src/infrastructure/shell.js";
import { paths } from "../../src/infrastructure/paths.js";
import { clock } from "../../src/infrastructure/clock.js";
import { proc } from "../../src/infrastructure/proc.js";
import { log } from "../../src/infrastructure/logger.js";

describe("vault-test controller", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		initializeDeps({
			disk: {} as never,
			shell,
			paths,
			clock,
			proc,
			input: { ask: vi.fn() as never, askYesNo: vi.fn() as never, waitForEnter: vi.fn() as never },
			bus: { emit: vi.fn(), on: vi.fn(), off: vi.fn(), clear: vi.fn() } as never,
			log,
			warn: vi.fn(),
			worldState: { load: vi.fn(), save: vi.fn(), get: vi.fn() } as never,
			workerManager: { spawnAll: vi.fn(), stopAll: vi.fn(), status: vi.fn(), dispatchWorldEvent: vi.fn() } as never,
			processRunner: { run: vi.fn() } as never,
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

	it("test:vault calls shell.run with vault config", () => {
		commands["test:vault"]({}, [], "test:vault");

		expect(shell.run).toHaveBeenCalledWith(
			expect.stringContaining("vitest.vault.config.ts"),
			expect.anything(),
		);
	});

	it("test:vault:smoke calls shell.run with tier-1 test file", () => {
		commands["test:vault:smoke"]({}, [], "test:vault:smoke");

		expect(shell.run).toHaveBeenCalledWith(
			expect.stringContaining("tier-1-smoke.test.ts"),
			expect.anything(),
		);
	});

	it("test:vault:integration calls shell.run with tier-2 test file", () => {
		commands["test:vault:integration"]({}, [], "test:vault:integration");

		expect(shell.run).toHaveBeenCalledWith(
			expect.stringContaining("tier-2-integration.test.ts"),
			expect.anything(),
		);
	});

	it("test:vault:ecosystem calls shell.run with tier-3 test file", () => {
		commands["test:vault:ecosystem"]({}, [], "test:vault:ecosystem");

		expect(shell.run).toHaveBeenCalledWith(
			expect.stringContaining("tier-3-ecosystem.test.ts"),
			expect.anything(),
		);
	});
});
