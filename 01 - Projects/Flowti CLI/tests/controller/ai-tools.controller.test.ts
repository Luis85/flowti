/**
 * ai-tools.controller.test.ts — Tests for AI tool management commands.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks (must come BEFORE imports) ─────────────────────────────

vi.mock("../../src/infrastructure/logger.js", () => ({ log: vi.fn() }));
vi.mock("../../src/infrastructure/shell.js", async () => {
	const { mockShellPreset } = await import("../mocks/mock-presets.js");
	return mockShellPreset();
});
vi.mock("../../src/infrastructure/filesystem.js", () => ({
	disk: {
		existsSync: vi.fn(() => true),
		readFileSync: vi.fn(() => "{}"),
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
	clock: { iso: vi.fn(() => "2026-01-01T00:00:00.000Z"), now: vi.fn(() => new Date()), ms: vi.fn(() => 0) },
}));
vi.mock("../../src/infrastructure/config.js", () => ({
	VAULT_ROOT: "/vault",
	CLI_PROJECT: "/vault/cli",
}));
vi.mock("../../src/infrastructure/input.js", () => ({
	input: { ask: vi.fn() },
}));
vi.mock("../../src/infrastructure/proc.js", () => ({
	proc: { exit: vi.fn() },
}));
vi.mock("../../src/infrastructure/output.js", () => ({
	output: { write: vi.fn() },
}));

// Mock domain modules
vi.mock("../../src/domain/ai-tools/ai-tool-loader.js", () => ({
	AI_TOOLS_DIR: ".flowti/ai-tools",
	loadAiTools: vi.fn(() => []),
	validateToolDefinition: vi.fn(() => ({ valid: true, errors: [], warnings: [] })),
	scaffoldAiTool: vi.fn(() => ({ path: "/vault/.flowti/ai-tools/test-tool.json" })),
	discoverToolFiles: vi.fn(() => []),
}));
vi.mock("../../src/domain/ai-tools/ai-tool-reference.js", () => ({
	generateAiToolReference: vi.fn(() => ({ save: vi.fn() })),
}));
vi.mock("../../src/domain/ai-tools/ai-tool-commands.js", () => ({
	substituteParams: vi.fn((cmd: string) => cmd),
}));
vi.mock("../../src/ui/displays/ai-tools-display.js", () => ({
	renderToolList: vi.fn(),
	renderToolValidation: vi.fn(),
	renderToolRunResult: vi.fn(),
	renderDryRun: vi.fn(),
	renderToolNotFound: vi.fn(),
	renderToolInvalid: vi.fn(),
	renderMissingParams: vi.fn(),
	renderMissingToolFlag: vi.fn(),
	renderRunning: vi.fn(),
}));
vi.mock("../../src/ui/renderers/common-renderers.js", () => ({
	renderSuccess: vi.fn(),
	renderError: vi.fn(),
}));

// ── Imports ──────────────────────────────────────────────────────

import { commands } from "../../src/controller/ai-tools.controller.js";
import { initializeDeps } from "../../src/infrastructure/request-response.js";
import { loadAiTools, discoverToolFiles, validateToolDefinition } from "../../src/domain/ai-tools/ai-tool-loader.js";
import { disk } from "../../src/infrastructure/filesystem.js";
import { shell } from "../../src/infrastructure/shell.js";
import { paths } from "../../src/infrastructure/paths.js";
import { clock } from "../../src/infrastructure/clock.js";
import { proc } from "../../src/infrastructure/proc.js";
import { input } from "../../src/infrastructure/input.js";
import { log } from "../../src/infrastructure/logger.js";

const mockProject = {
	name: "test",
	path: "/project",
	config: { name: "test", reports: { generators: [] } },
	scripts: {},
	pkg: null,
};

// ── Tests ────────────────────────────────────────────────────────

describe("ai-tools.controller", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		initializeDeps({ disk, shell, paths, clock, proc, input, bus: { emit: vi.fn(), on: vi.fn(), off: vi.fn(), clear: vi.fn() } as never, log, warn: vi.fn() });
	});

	describe("ai:list", () => {
		it("returns an empty list when no tools are loaded", () => {
			vi.mocked(loadAiTools).mockReturnValue([]);

			commands["ai:list"]({}, [], "ai:list", mockProject);

			expect(loadAiTools).toHaveBeenCalledWith(expect.any(Object), "/vault", disk);
		});

		it("returns tool list items when tools exist", () => {
			vi.mocked(loadAiTools).mockReturnValue([
				{
					definition: {
						name: "lint-fix",
						description: "Auto-fix lint errors",
						run: "eslint --fix .",
						version: "1.0.0",
						params: [{ name: "path", type: "string", description: "Path", required: false }],
						tags: ["lint"],
					},
					valid: true,
					errors: [],
					filePath: "/vault/.flowti/ai-tools/lint-fix.json",
				},
			]);

			commands["ai:list"]({}, [], "ai:list", mockProject);

			expect(loadAiTools).toHaveBeenCalledWith(expect.any(Object), "/vault", disk);
		});
	});

	describe("ai:validate", () => {
		it("returns empty results when no tool files are discovered", () => {
			vi.mocked(discoverToolFiles).mockReturnValue([]);

			commands["ai:validate"]({}, [], "ai:validate", mockProject);

			expect(discoverToolFiles).toHaveBeenCalled();
		});

		it("validates discovered tool files", () => {
			vi.mocked(discoverToolFiles).mockReturnValue([
				"/vault/.flowti/ai-tools/my-tool.json",
			]);
			vi.mocked(disk.readFileSync).mockReturnValue(
				JSON.stringify({ name: "my-tool", description: "A tool", run: "echo hello" }),
			);
			vi.mocked(validateToolDefinition).mockReturnValue({
				valid: true,
				errors: [],
				warnings: [],
			});

			commands["ai:validate"]({}, [], "ai:validate", mockProject);

			expect(disk.readFileSync).toHaveBeenCalledWith(
				"/vault/.flowti/ai-tools/my-tool.json",
				"utf-8",
			);
			expect(validateToolDefinition).toHaveBeenCalled();
		});

		it("handles parse errors gracefully", () => {
			vi.mocked(discoverToolFiles).mockReturnValue([
				"/vault/.flowti/ai-tools/bad.json",
			]);
			vi.mocked(disk.readFileSync).mockReturnValue("not valid json {{{");

			// Should not throw
			commands["ai:validate"]({}, [], "ai:validate", mockProject);

			expect(discoverToolFiles).toHaveBeenCalled();
		});
	});
});
