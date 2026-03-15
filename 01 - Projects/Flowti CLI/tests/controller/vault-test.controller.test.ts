/**
 * vault-test.controller.test.ts — Tests for the vault-test controller.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/infrastructure/shell.js", async () => {
	const { mockShellPreset } = await import("../mocks/mock-presets.js");
	return mockShellPreset();
});
vi.mock("../../src/infrastructure/logger.js", () => ({ log: vi.fn() }));

import { commands } from "../../src/controller/vault-test.controller.js";
import { initializeDeps } from "../../src/infrastructure/request-response.js";
import { shell } from "../../src/infrastructure/shell.js";

describe("vault-test controller", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		initializeDeps({
			disk: {} as never,
			shell,
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
			clock: { iso: () => "", now: () => new Date(), ms: () => 0, safeIso: () => "" },
			proc: { exit: vi.fn() as never, argv: () => [], cwd: () => "/", env: () => ({}) },
			input: { ask: vi.fn() as never, askYesNo: vi.fn() as never, waitForEnter: vi.fn() as never },
			bus: { emit: vi.fn(), on: vi.fn(), off: vi.fn(), clear: vi.fn() } as never,
			log: vi.fn(),
			warn: vi.fn(),
			worldState: { load: vi.fn(), save: vi.fn(), get: vi.fn() } as never,
			workerManager: { start: vi.fn(), stop: vi.fn(), status: vi.fn() } as never,
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
		const req = {
			command: "test:vault",
			flags: {},
			rawArgs: [],
			format: "text" as const,
			deps: {
				shell,
				paths: { resolve: (...a: string[]) => a.join("/") },
			},
		};

		commands["test:vault"](req as never);

		expect(shell.run).toHaveBeenCalledWith(
			expect.stringContaining("vitest.vault.config.ts"),
			expect.anything(),
		);
	});

	it("test:vault:smoke calls shell.run with tier-1 test file", () => {
		const req = {
			command: "test:vault:smoke",
			flags: {},
			rawArgs: [],
			format: "text" as const,
			deps: {
				shell,
				paths: { resolve: (...a: string[]) => a.join("/") },
			},
		};

		commands["test:vault:smoke"](req as never);

		expect(shell.run).toHaveBeenCalledWith(
			expect.stringContaining("tier-1-smoke.test.ts"),
			expect.anything(),
		);
	});
});
