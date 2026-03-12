import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockShell } from "../../mocks/mock-shell.js";
import { initializeDeps } from "../../../src/infrastructure/request-response.js";
import { createTestDeps } from "../../mocks/mock-deps.js";

vi.mock("../../../src/infrastructure/ui.js", () => ({
	RESET: "", BOLD: "", DIM: "", GREEN: "", RED: "", CYAN: "", YELLOW: "",
}));

vi.mock("../../../src/infrastructure/logger.js", () => ({
	log: vi.fn(),
	warn: vi.fn(),
}));

vi.mock("../../../src/infrastructure/filesystem.js", () => ({
	disk: {
		existsSync: vi.fn(() => true),
		readFileSync: vi.fn(() => ""),
		readdirSync: vi.fn(() => []),
		writeFileSync: vi.fn(),
		mkdirSync: vi.fn(),
	},
}));

vi.mock("../../../src/infrastructure/paths.js", () => ({
	paths: {
		join: vi.fn((...args: string[]) => args.join("/")),
		resolve: vi.fn((...args: string[]) => args.join("/")),
		relative: vi.fn((_a: string, b: string) => b),
		dirname: vi.fn((p: string) => p),
		basename: vi.fn((p: string) => p.split("/").pop() ?? p),
	},
}));

vi.mock("../../../src/infrastructure/clock.js", () => ({
	clock: { now: () => new Date("2025-06-15T10:00:00Z") },
}));

vi.mock("../../../src/infrastructure/config.js", () => ({
	VAULT_ROOT: "/vault",
	CLI_PROJECT: "/vault/cli",
	PLUGIN_ROOT: "/vault/plugin",
}));

vi.mock("../../../src/infrastructure/request-response.js", async () => {
	const actual = await vi.importActual<typeof import("../../../src/infrastructure/request-response.js")>("../../../src/infrastructure/request-response.js");
	return actual;
});

vi.mock("../../../src/domain/devtools/cli-reload.js", () => ({
	reloadPlugin: vi.fn(() => true),
}));

vi.mock("../../../src/domain/devtools/fix-frontmatter.js", () => ({
	fixFrontmatter: vi.fn(() => ({ fixed: 2, skipped: 1, errors: 0 })),
}));

vi.mock("../../../src/domain/devtools/generate-test-data.js", () => ({
	generateTestData: vi.fn(() => ({ totalRows: 100, filesWritten: 8, files: [] })),
}));

vi.mock("../../../src/domain/devtools/run-analysis.js", () => ({
	runAnalysisPipeline: vi.fn(),
}));

import { commands } from "../../../src/controller/devtools.controller.js";
import { reloadPlugin } from "../../../src/domain/devtools/cli-reload.js";
import { fixFrontmatter } from "../../../src/domain/devtools/fix-frontmatter.js";
import { generateTestData } from "../../../src/domain/devtools/generate-test-data.js";
import { runAnalysisPipeline } from "../../../src/domain/devtools/run-analysis.js";
import type { ProjectContext } from "../../../src/infrastructure/types.js";

function setupShell(opts?: Parameters<typeof createMockShell>[0]) {
	const sh = createMockShell(opts);
	const deps = createTestDeps();
	(deps as Record<string, unknown>).shell = sh;
	initializeDeps(deps);
	return sh;
}

function makeProject(scripts: Record<string, string> = {}): ProjectContext {
	return {
		path: "/test/project",
		pkg: { name: "test", version: "1.0.0", scripts },
		config: { name: "test" },
		scripts,
	};
}

beforeEach(() => vi.clearAllMocks());

describe("devtools commands", () => {
	it("dev:reload calls reloadPlugin with deps", () => {
		const project = makeProject();

		commands["dev:reload"]({}, [], "dev:reload", project);

		expect(reloadPlugin).toHaveBeenCalledWith(undefined, expect.objectContaining({ shell: expect.anything(), log: expect.anything(), warn: expect.anything() }));
	});

	it("dev:console runs console command", () => {
		const sh = setupShell();

		commands["dev:console"]({}, [], "dev:console");

		expect(sh.calls[0].cmd).toBe("obsidian dev:console");
	});

	it("dev:errors runs errors command", () => {
		const sh = setupShell();

		commands["dev:errors"]({}, [], "dev:errors");

		expect(sh.calls[0].cmd).toBe("obsidian dev:errors");
	});

	it("dev:check runs npm run check when script exists", () => {
		const sh = setupShell();
		const project = makeProject({ check: "eslint && tsc" });

		commands["dev:check"]({}, [], "dev:check", project);

		expect(sh.calls[0].cmd).toBe("npm run check");
		expect(sh.calls[0].opts?.cwd).toBe("/test/project");
	});

	it("dev:check falls back to tsc when no check script", () => {
		const sh = setupShell();
		const project = makeProject();

		commands["dev:check"]({}, [], "dev:check", project);

		expect(sh.calls[0].cmd).toBe("npx tsc --noEmit");
	});

	it("dev:lint runs npm run lint when script exists", () => {
		const sh = setupShell();
		const project = makeProject({ lint: "eslint src/" });

		commands["dev:lint"]({}, [], "dev:lint", project);

		expect(sh.calls[0].cmd).toBe("npm run lint");
		expect(sh.calls[0].opts?.cwd).toBe("/test/project");
	});

	it("dev:lint falls back to npx eslint when no lint script", () => {
		const sh = setupShell();
		const project = makeProject();

		commands["dev:lint"]({}, [], "dev:lint", project);

		expect(sh.calls[0].cmd).toBe("npx eslint src/");
	});

	it("dev:fix-frontmatter calls fixFrontmatter directly", () => {
		const project = makeProject();

		commands["dev:fix-frontmatter"]({}, [], "dev:fix-frontmatter", project);

		expect(fixFrontmatter).toHaveBeenCalledWith(
			expect.objectContaining({ dryRun: false }),
			expect.objectContaining({ disk: expect.anything(), paths: expect.anything(), log: expect.anything() }),
		);
	});

	it("dev:fix-frontmatter passes dry-run flag", () => {
		const project = makeProject();

		commands["dev:fix-frontmatter"]({ "dry-run": true }, [], "dev:fix-frontmatter", project);

		expect(fixFrontmatter).toHaveBeenCalledWith(
			expect.objectContaining({ dryRun: true }),
			expect.anything(),
		);
	});

	it("dev:testdata calls generateTestData directly", () => {
		const project = makeProject();

		commands["dev:testdata"]({}, [], "dev:testdata", project);

		expect(generateTestData).toHaveBeenCalledWith(
			expect.objectContaining({ from: "2025-01", seed: 42, dryRun: false }),
			expect.objectContaining({ disk: expect.anything(), paths: expect.anything(), clock: expect.anything(), log: expect.anything() }),
		);
	});

	it("dev:analysis calls runAnalysisPipeline directly", () => {
		commands["dev:analysis"]({}, [], "dev:analysis");

		expect(runAnalysisPipeline).toHaveBeenCalledWith(
			expect.objectContaining({ disk: expect.anything(), shell: expect.anything(), paths: expect.anything(), clock: expect.anything(), log: expect.anything() }),
		);
	});
});
