/**
 * project.controller.test.ts — Tests for project controller commands.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks (must come BEFORE imports) ─────────────────────────────

vi.mock("../../src/infrastructure/logger.js", () => ({ log: vi.fn(), warn: vi.fn() }));
vi.mock("../../src/infrastructure/shell.js", async () => {
	const { mockShellPreset } = await import("../mocks/mock-presets.js");
	return mockShellPreset();
});
vi.mock("../../src/infrastructure/filesystem.js", () => ({
	disk: {
		existsSync: vi.fn(() => true),
		readFileSync: vi.fn(() => ""),
		readdirSync: vi.fn(() => []),
		writeFileSync: vi.fn(),
		mkdirSync: vi.fn(),
	},
}));
vi.mock("../../src/infrastructure/paths.js", () => ({
	paths: {
		join: vi.fn((...args: string[]) => args.join("/")),
		resolve: vi.fn((...args: string[]) => args.join("/")),
		relative: vi.fn((_a: string, b: string) => b),
		dirname: vi.fn((p: string) => p),
		basename: vi.fn((p: string) => p.split("/").pop() ?? p),
	},
}));
vi.mock("../../src/infrastructure/config.js", () => ({
	VAULT_ROOT: "/vault",
	CLI_PROJECT: "/vault/cli",
	PROJECTS_DIR: "/vault/projects",
}));
vi.mock("../../src/infrastructure/proc.js", () => ({
	proc: { exit: vi.fn() },
	pidOps: { isPidAlive: vi.fn(() => false), isPortListening: vi.fn(async () => false), killPid: vi.fn(() => false) },
}));
vi.mock("../../src/infrastructure/output.js", () => ({
	output: { write: vi.fn() },
}));

// ── Imports ──────────────────────────────────────────────────────

import { commands } from "../../src/controller/project.controller.js";
import { log } from "../../src/infrastructure/logger.js";

const mockProject = {
	name: "test",
	path: "/project",
	config: { name: "test", reports: { generators: [] } },
	scripts: {},
	pkg: null,
};

// ── Tests ────────────────────────────────────────────────────────

describe("project.controller", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("project", () => {
		it("returns interactive-only message", async () => {
			await commands["project"]({}, [], "project", mockProject);

			expect(vi.mocked(log)).toHaveBeenCalledWith(
				expect.stringContaining("interactive"),
			);
		});
	});

	describe("project:create", () => {
		it("is registered as a command", () => {
			expect(commands["project:create"]).toBeDefined();
		});
	});

	describe("project:detect", () => {
		it("is registered as a command", () => {
			expect(commands["project:detect"]).toBeDefined();
		});
	});

	describe("project:bootstrap", () => {
		it("is registered as a command", () => {
			expect(commands["project:bootstrap"]).toBeDefined();
		});
	});
});
