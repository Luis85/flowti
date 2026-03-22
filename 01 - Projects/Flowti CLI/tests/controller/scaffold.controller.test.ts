/**
 * scaffold.controller.test.ts — Tests for the scaffold controller.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/domain/scaffold/scaffold-service.js", () => ({
	scaffold: vi.fn(() => ({ created: 5, outputPath: "/projects/my-project" })),
	scaffoldDryRun: vi.fn(() => ({
		files: ["package.json", "src/main.ts", "README.md"],
		outputPath: "/projects/my-project",
		definition: "flowti-project",
	})),
	listDefinitions: vi.fn(() => [
		{ id: "flowti-project", label: "Flowti Project", description: "Standard project scaffold" },
	]),
	BUNDLED_DEFINITIONS: [],
	getKnownTemplateIds: vi.fn(() => ["readme", "gitignore", "package-json"]),
}));
vi.mock("../../src/domain/scaffold/marketplace-export.js", () => ({
	exportBundle: vi.fn(() => ({ aiTools: [], plugins: [], scaffolds: [], vault: "test" })),
	saveBundle: vi.fn(),
	loadBundle: vi.fn(),
	importAiToolsFromBundle: vi.fn(() => 0),
}));
vi.mock("../../src/infrastructure/filesystem.js", () => ({
	disk: { existsSync: vi.fn(() => false), readFileSync: vi.fn(() => "{}"), readdirSync: vi.fn(() => []), writeFileSync: vi.fn(), mkdirSync: vi.fn() },
}));
vi.mock("../../src/infrastructure/paths.js", () => ({
	paths: { join: vi.fn((...args: string[]) => args.join("/")), dirname: vi.fn((p: string) => p), basename: vi.fn((p: string) => p.split("/").pop() ?? p) },
}));
vi.mock("../../src/infrastructure/clock.js", () => ({
	clock: { iso: vi.fn(() => "2026-01-01T00:00:00.000Z"), now: vi.fn(() => new Date()), ms: vi.fn(() => 0), safeIso: vi.fn(() => "2026-01-01T00-00-00-000Z") },
}));
vi.mock("../../src/infrastructure/config.js", () => ({
	VAULT_ROOT: "/vault",
	cliConfig: {},
	PROJECTS_DIR: "/vault/projects",
}));
vi.mock("../../src/infrastructure/suggestions.js", () => ({
	afterScaffold: vi.fn((name: string) => [
		{ label: `cd ${name}`, description: "Enter project directory" },
	]),
}));
vi.mock("../../src/infrastructure/logger.js", () => ({ log: vi.fn() }));
vi.mock("../../src/infrastructure/proc.js", () => ({
	proc: { exit: vi.fn(), argv: () => [], cwd: () => "/", env: () => ({}) },
	pidOps: { isPidAlive: vi.fn(() => false), isPortListening: vi.fn(async () => false), killPid: vi.fn(() => false) },
}));
vi.mock("../../src/domain/scaffold/marketplace.js", () => ({
	buildMarketplaceListing: vi.fn(() => []),
	resolveDefinitionsDir: vi.fn(() => "/project/configs/definitions"),
	importDefinition: vi.fn(() => ({ success: true, targetPath: "/project/configs/definitions/test.json", errors: [] })),
}));
vi.mock("../../src/ui/displays/scaffold-display.js", () => ({
	renderDryRunPreview: vi.fn(),
	renderScaffoldResult: vi.fn(),
	renderDefinitionList: vi.fn(),
	renderExportPreview: vi.fn(),
	renderExportSaved: vi.fn(),
	renderBundleImported: vi.fn(),
	renderMarketplace: vi.fn(),
	renderImportResult: vi.fn(),
}));
vi.mock("../../src/ui/renderers/common-renderers.js", () => ({
	renderError: vi.fn(),
	renderNoProject: vi.fn(),
}));

import { commands } from "../../src/controller/scaffold.controller.js";
import { initializeDeps } from "../../src/infrastructure/command-engine.js";
import { scaffold, scaffoldDryRun, listDefinitions } from "../../src/domain/scaffold/scaffold-service.js";
import { log } from "../../src/infrastructure/logger.js";
import { disk } from "../../src/infrastructure/filesystem.js";
import { paths } from "../../src/infrastructure/paths.js";
import { clock } from "../../src/infrastructure/clock.js";
import { proc, pidOps } from "../../src/infrastructure/proc.js";

const logMock = log as ReturnType<typeof vi.fn>;

const mockProject = {
	name: "test-project",
	path: "/project",
	config: { name: "test", reports: { generators: [] }, health: {} },
	pkg: { name: "test-project", version: "1.0.0", scripts: {} },
	scripts: {},
};

describe("scaffold.controller", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		initializeDeps({
			disk, shell: {} as never, paths, clock, proc, pidOps,
			input: { ask: vi.fn() as never, askYesNo: vi.fn() as never, waitForEnter: vi.fn() as never, askAbortable: vi.fn() as never },
			bus: { emit: vi.fn(), on: vi.fn(), off: vi.fn(), clear: vi.fn() } as never,
			log, warn: vi.fn(),
			worldState: {} as never, workerManager: {} as never, processRunner: {} as never,
		});
	});

	describe("scaffold:new", () => {
		it("calls scaffold with name and default definition", () => {
			commands["scaffold:new"]({ name: "my-app" }, [], "scaffold:new", mockProject);

			expect(scaffold).toHaveBeenCalledOnce();
			expect(scaffold).toHaveBeenCalledWith(
				"/vault/projects",
				expect.any(Object),
				expect.objectContaining({ name: "my-app", definitionId: "flowti-project" }),
				undefined,
			);
		});

		it("passes custom definition ID", () => {
			commands["scaffold:new"](
				{ name: "my-lib", definition: "custom-lib" }, [], "scaffold:new", mockProject,
			);

			expect(scaffold).toHaveBeenCalledWith(
				"/vault/projects",
				expect.any(Object),
				expect.objectContaining({ definitionId: "custom-lib" }),
				undefined,
			);
		});

		it("returns error when --name is missing", () => {
			commands["scaffold:new"]({ format: "json" }, [], "scaffold:new");

			expect(scaffold).not.toHaveBeenCalled();
			expect(logMock).toHaveBeenCalledOnce();
			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("error");
			expect(output.error).toContain("--name");
		});

		it("returns ScaffoldResultModel as JSON", () => {
			commands["scaffold:new"](
				{ name: "my-app", format: "json" }, [], "scaffold:new",
			);

			expect(logMock).toHaveBeenCalledOnce();
			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("created", 5);
			expect(output).toHaveProperty("outputPath", "/projects/my-project");
			expect(output).toHaveProperty("suggestions");
		});

		it("returns dry-run preview when --dry-run flag is set", () => {
			commands["scaffold:new"](
				{ name: "my-app", "dry-run": true, format: "json" }, [], "scaffold:new",
			);

			expect(scaffoldDryRun).toHaveBeenCalledOnce();
			expect(scaffold).not.toHaveBeenCalled();
			expect(logMock).toHaveBeenCalledOnce();
			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("files");
			expect(output.files).toContain("package.json");
		});

		it("returns error when scaffold returns an error", () => {
			(scaffold as ReturnType<typeof vi.fn>).mockReturnValueOnce({ error: "Definition not found" });

			commands["scaffold:new"](
				{ name: "bad-project", format: "json" }, [], "scaffold:new",
			);

			expect(logMock).toHaveBeenCalledOnce();
			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("error", "Definition not found");
		});

		it("passes author and output flags", () => {
			commands["scaffold:new"](
				{ name: "my-app", author: "Jane", output: "/custom/dir" }, [], "scaffold:new",
			);

			expect(scaffold).toHaveBeenCalledWith(
				"/vault/projects",
				expect.any(Object),
				expect.objectContaining({ author: "Jane", outputDir: "/custom/dir" }),
				undefined,
			);
		});
	});

	describe("scaffold:list", () => {
		it("calls listDefinitions", () => {
			commands["scaffold:list"]({}, [], "scaffold:list");

			expect(listDefinitions).toHaveBeenCalledOnce();
		});

		it("returns definitions list as JSON", () => {
			commands["scaffold:list"]({ format: "json" }, [], "scaffold:list");

			expect(logMock).toHaveBeenCalledOnce();
			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("definitions");
			expect(output.definitions).toHaveLength(1);
			expect(output.definitions[0]).toHaveProperty("id", "flowti-project");
			expect(output.definitions[0]).toHaveProperty("label", "Flowti Project");
		});
	});
});
