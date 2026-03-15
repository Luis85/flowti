/**
 * devtools.controller.test.ts — Tests for developer utility commands.
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
vi.mock("../../src/infrastructure/clock.js", () => ({
	clock: { now: () => new Date("2025-06-15T10:00:00Z"), ms: () => 1234567890, iso: () => "2025-06-15T10:00:00Z", safeIso: () => "2025-06-15T10-00-00Z" },
}));
vi.mock("../../src/infrastructure/config.js", () => ({
	VAULT_ROOT: "/vault",
	CLI_PROJECT: "/vault/cli",
	PLUGIN_ROOT: "/vault/plugin",
}));
vi.mock("../../src/infrastructure/proc.js", () => ({
	proc: { exit: vi.fn() },
}));
vi.mock("../../src/infrastructure/output.js", () => ({
	output: { write: vi.fn() },
}));

// Mock domain modules
vi.mock("../../src/domain/devtools/self-update.js", () => ({
	rebuildCli: vi.fn(() => 0),
}));
vi.mock("../../src/domain/devtools/cli-reload.js", () => ({
	reloadPlugin: vi.fn(() => true),
}));
vi.mock("../../src/domain/devtools/fix-frontmatter.js", () => ({
	fixFrontmatter: vi.fn(() => ({ fixed: 2, skipped: 1, errors: 0 })),
}));
vi.mock("../../src/domain/devtools/generate-test-data.js", () => ({
	generateTestData: vi.fn(() => ({ totalRows: 100, filesWritten: 8, files: [] })),
}));
vi.mock("../../src/domain/devtools/run-analysis.js", () => ({
	runAnalysisPipeline: vi.fn(),
}));

// ── Imports ──────────────────────────────────────────────────────

import { commands } from "../../src/controller/devtools.controller.js";
import { shell } from "../../src/infrastructure/shell.js";
import { rebuildCli } from "../../src/domain/devtools/self-update.js";
import { reloadPlugin } from "../../src/domain/devtools/cli-reload.js";
import { fixFrontmatter } from "../../src/domain/devtools/fix-frontmatter.js";
import { generateTestData } from "../../src/domain/devtools/generate-test-data.js";
import { runAnalysisPipeline } from "../../src/domain/devtools/run-analysis.js";

const mockProject = {
	name: "test",
	path: "/project",
	config: { name: "test", reports: { generators: [] } },
	scripts: {},
	pkg: null,
};

// ── Tests ────────────────────────────────────────────────────────

describe("devtools.controller", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("dev:reload", () => {
		it("calls reloadPlugin with deps", () => {
			commands["dev:reload"]({}, [], "dev:reload", mockProject);

			expect(reloadPlugin).toHaveBeenCalledWith(undefined, expect.objectContaining({ shell: expect.anything(), log: expect.anything(), warn: expect.anything() }));
		});

		it("passes vault flag to reloadPlugin", () => {
			commands["dev:reload"]({ vault: "myVault" }, [], "dev:reload", mockProject);

			expect(reloadPlugin).toHaveBeenCalledWith("myVault", expect.anything());
		});
	});

	describe("dev:console", () => {
		it("runs the default console command", () => {
			vi.mocked(shell.runCaptureStatus).mockReturnValue({ output: "", exitCode: 0 });

			commands["dev:console"]({}, [], "dev:console", mockProject);

			expect(shell.runCaptureStatus).toHaveBeenCalledWith("obsidian dev:console");
		});

		it("enables debug mode and retries when debugger not attached", () => {
			vi.mocked(shell.runCaptureStatus).mockReturnValue({
				output: "Debugger not attached",
				exitCode: 1,
			});

			commands["dev:console"]({}, [], "dev:console", mockProject);

			expect(shell.run).toHaveBeenCalledWith(
				"obsidian dev:debug on",
				{ label: "Enabling debug mode..." },
			);
			expect(shell.run).toHaveBeenCalledWith(
				"obsidian dev:console",
				{ label: "Opening dev console..." },
			);
		});
	});

	describe("dev:debug:on", () => {
		it("enables debug mode", () => {
			commands["dev:debug:on"]({}, [], "dev:debug:on", mockProject);

			expect(shell.run).toHaveBeenCalledWith(
				"obsidian dev:debug on",
				{ label: "Enabling debug mode..." },
			);
		});
	});

	describe("dev:debug:off", () => {
		it("disables debug mode", () => {
			commands["dev:debug:off"]({}, [], "dev:debug:off", mockProject);

			expect(shell.run).toHaveBeenCalledWith(
				"obsidian dev:debug off",
				{ label: "Disabling debug mode..." },
			);
		});
	});

	describe("dev:check", () => {
		it("runs the default check command", () => {
			commands["dev:check"]({}, [], "dev:check", mockProject);

			expect(shell.run).toHaveBeenCalledWith(
				"npx tsc --noEmit",
				{ cwd: "/project", label: "Running lint + tsc..." },
			);
		});

		it("uses npm run check when script exists", () => {
			const project = {
				...mockProject,
				scripts: { check: "tsc && eslint" },
			};

			commands["dev:check"]({}, [], "dev:check", project);

			expect(shell.run).toHaveBeenCalledWith(
				"npm run check",
				{ cwd: "/project", label: "Running lint + tsc..." },
			);
		});
	});

	describe("dev:lint", () => {
		it("runs the default lint command", () => {
			commands["dev:lint"]({}, [], "dev:lint", mockProject);

			expect(shell.run).toHaveBeenCalledWith(
				"npx eslint src/",
				{ cwd: "/project", label: "Running ESLint..." },
			);
		});

		it("uses npm run lint when script exists", () => {
			const project = {
				...mockProject,
				scripts: { lint: "eslint ." },
			};

			commands["dev:lint"]({}, [], "dev:lint", project);

			expect(shell.run).toHaveBeenCalledWith(
				"npm run lint",
				{ cwd: "/project", label: "Running ESLint..." },
			);
		});
	});

	describe("dev:fix-frontmatter", () => {
		it("calls fixFrontmatter directly", () => {
			commands["dev:fix-frontmatter"]({}, [], "dev:fix-frontmatter", mockProject);

			expect(fixFrontmatter).toHaveBeenCalledWith(
				expect.objectContaining({ dryRun: false }),
				expect.objectContaining({ disk: expect.anything(), paths: expect.anything(), log: expect.anything() }),
			);
		});

		it("passes dry-run flag", () => {
			commands["dev:fix-frontmatter"]({ "dry-run": true }, [], "dev:fix-frontmatter", mockProject);

			expect(fixFrontmatter).toHaveBeenCalledWith(
				expect.objectContaining({ dryRun: true }),
				expect.anything(),
			);
		});
	});

	describe("dev:rebuild", () => {
		it("delegates to rebuildCli", () => {
			commands["dev:rebuild"]({}, [], "dev:rebuild", mockProject);

			expect(rebuildCli).toHaveBeenCalledWith("/project", shell);
		});

		it("uses empty string when no project", () => {
			commands["dev:rebuild"]({}, [], "dev:rebuild", undefined);

			expect(rebuildCli).toHaveBeenCalledWith("", shell);
		});
	});

	describe("dev:testdata", () => {
		it("calls generateTestData directly", () => {
			commands["dev:testdata"]({}, [], "dev:testdata", mockProject);

			expect(generateTestData).toHaveBeenCalledWith(
				expect.objectContaining({ from: "2025-01", seed: 42, dryRun: false }),
				expect.objectContaining({ disk: expect.anything(), paths: expect.anything(), clock: expect.anything(), log: expect.anything() }),
			);
		});
	});

	describe("dev:errors", () => {
		it("runs the default errors command", () => {
			commands["dev:errors"]({}, [], "dev:errors", mockProject);

			expect(shell.run).toHaveBeenCalledWith(
				"obsidian dev:errors",
				{ cwd: "/project", label: "Opening error stream..." },
			);
		});
	});

	describe("dev:analysis", () => {
		it("calls runAnalysisPipeline directly", () => {
			commands["dev:analysis"]({}, [], "dev:analysis", mockProject);

			expect(runAnalysisPipeline).toHaveBeenCalledWith(
				"/vault/cli",
				expect.objectContaining({ disk: expect.anything(), shell: expect.anything(), paths: expect.anything(), clock: expect.anything(), log: expect.anything() }),
			);
		});
	});
});
