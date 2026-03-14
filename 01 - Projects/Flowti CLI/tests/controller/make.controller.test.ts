/**
 * make.controller.test.ts — Tests for make (scaffolding) commands.
 *
 * The make controller aggregates component-commands and component-edit.
 * We test the delegated commands through the controller's exported commands map.
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
		existsSync: vi.fn(() => false),
		readFileSync: vi.fn(() => "---\nstatus: draft\n---\nBody"),
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
}));
vi.mock("../../src/infrastructure/proc.js", () => ({
	proc: { exit: vi.fn(() => { throw new Error("process.exit"); }) },
}));
vi.mock("../../src/infrastructure/output.js", () => ({
	output: { write: vi.fn() },
}));
vi.mock("../../src/infrastructure/frontmatter.js", () => ({
	splitFrontmatter: vi.fn((content: string) => {
		if (!content.startsWith("---")) return null;
		return { frontmatter: { status: "draft" }, body: "Body" };
	}),
	joinFrontmatter: vi.fn((_fm: Record<string, unknown>, body: string) => `---\nstatus: active\n---\n${body}`),
}));

// Mock domain modules
vi.mock("../../src/domain/make/naming.js", () => ({
	toKebab: vi.fn((s: string) => s.toLowerCase().replace(/\s+/g, "-")),
	toPascal: vi.fn((s: string) => s.charAt(0).toUpperCase() + s.slice(1)),
	toCamel: vi.fn((s: string) => s.charAt(0).toLowerCase() + s.slice(1)),
}));
vi.mock("../../src/domain/make/templates/file-writer.js", () => ({
	createFileWriter: vi.fn(() => ({
		write: vi.fn(),
		created: 3,
	})),
}));
vi.mock("../../src/domain/make/component/component-plan.js", () => ({
	buildComponentPlan: vi.fn(() => [
		{ path: "components/my-component/my-component.ts", content: "// component" },
		{ path: "components/my-component/my-component.test.ts", content: "// test" },
		{ path: "components/my-component/my-component.md", content: "---\n---" },
	]),
}));
vi.mock("../../src/domain/make/component/component-registry.js", () => ({
	loadComponentDefinitions: vi.fn(() => [
		{ id: "component", label: "Component", templates: [] },
		{ id: "c4-system", label: "C4 System", templates: [] },
		{ id: "c4-container", label: "C4 Container", templates: [] },
		{ id: "c4-component", label: "C4 Component", templates: [] },
		{ id: "c4-person", label: "C4 Person", templates: [] },
	]),
	createComponentTemplateRegistry: vi.fn(() => ({})),
}));
vi.mock("../../src/infrastructure/suggestions.js", () => ({
	showSuggestions: vi.fn(),
	afterMakeComponent: vi.fn(() => []),
}));
vi.mock("../../src/ui/renderers/common-renderers.js", () => ({
	renderSuccess: vi.fn(),
	renderError: vi.fn(),
}));
vi.mock("../../src/ui/renderers/make-renderers.js", () => ({
	renderComponentAdding: vi.fn(),
}));

// ── Imports ──────────────────────────────────────────────────────

import { commands } from "../../src/controller/make.controller.js";
import { initializeDeps } from "../../src/infrastructure/request-response.js";
import { proc } from "../../src/infrastructure/proc.js";
import { disk } from "../../src/infrastructure/filesystem.js";
import { paths } from "../../src/infrastructure/paths.js";
import { shell } from "../../src/infrastructure/shell.js";
import { log } from "../../src/infrastructure/logger.js";
import { renderError, renderSuccess } from "../../src/ui/renderers/common-renderers.js";

const mockProject = {
	name: "test",
	path: "/project",
	config: { name: "test", reports: { generators: [] } },
	scripts: {},
	pkg: null,
};

// ── Tests ────────────────────────────────────────────────────────

describe("make.controller", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		initializeDeps({
			disk, shell, paths, proc,
			clock: { iso: () => "", now: () => new Date(), ms: () => 0, safeIso: () => "" },
			input: { ask: vi.fn() as never, askYesNo: vi.fn() as never, waitForEnter: vi.fn() as never },
			bus: { emit: vi.fn(), on: vi.fn(), off: vi.fn(), clear: vi.fn() } as never,
			log, warn: vi.fn(),
		});
	});

	it("exports all expected command keys", () => {
		expect(commands).toHaveProperty("make:component");
		expect(commands).toHaveProperty("make:system");
		expect(commands).toHaveProperty("make:container");
		expect(commands).toHaveProperty("make:c4-component");
		expect(commands).toHaveProperty("make:person");
		expect(commands).toHaveProperty("edit:component");
	});

	describe("make:component", () => {
		it("requires --name flag", () => {
			expect(() => commands["make:component"]({}, [], "make:component", mockProject)).toThrow("process.exit");

			expect(renderError).toHaveBeenCalledWith(
				expect.any(Function),
				expect.objectContaining({ error: "--name is required." }),
			);
			expect(proc.exit).toHaveBeenCalledWith(1);
		});

		it("requires a project context", () => {
			expect(() => commands["make:component"]({ name: "Foo" }, [], "make:component", undefined)).toThrow("process.exit");

			expect(renderError).toHaveBeenCalledWith(
				expect.any(Function),
				expect.objectContaining({ error: "No project selected." }),
			);
			expect(proc.exit).toHaveBeenCalledWith(1);
		});

		it("prevents duplicate components", () => {
			vi.mocked(disk.existsSync).mockReturnValue(true);

			expect(() => commands["make:component"]({ name: "UserProfile" }, [], "make:component", mockProject)).toThrow("process.exit");

			expect(renderError).toHaveBeenCalledWith(
				expect.any(Function),
				expect.objectContaining({ error: expect.stringContaining("already exists") }),
			);
			expect(proc.exit).toHaveBeenCalledWith(1);
		});

		it("creates component files when name is valid", () => {
			vi.mocked(disk.existsSync).mockReturnValue(false);

			commands["make:component"]({ name: "UserProfile" }, [], "make:component", mockProject);

			expect(renderSuccess).toHaveBeenCalledWith(
				expect.any(Function),
				expect.objectContaining({ message: expect.stringContaining("Created") }),
			);
		});
	});

	describe("make:system", () => {
		it("creates a C4 system component", () => {
			vi.mocked(disk.existsSync).mockReturnValue(false);

			commands["make:system"](
				{ name: "PaymentGateway", description: "Handles payments" },
				[],
				"make:system",
				mockProject,
			);

			expect(renderSuccess).toHaveBeenCalled();
		});
	});

	describe("make:container", () => {
		it("creates a C4 container component", () => {
			vi.mocked(disk.existsSync).mockReturnValue(false);

			commands["make:container"](
				{ name: "ApiServer", technology: "Node.js" },
				[],
				"make:container",
				mockProject,
			);

			expect(renderSuccess).toHaveBeenCalled();
		});
	});

	describe("edit:component", () => {
		it("requires --name flag", () => {
			expect(() => commands["edit:component"]({}, [], "edit:component", mockProject)).toThrow("process.exit");

			expect(renderError).toHaveBeenCalledWith(
				expect.any(Function),
				expect.objectContaining({ error: "--name is required." }),
			);
		});

		it("requires a project context", () => {
			expect(() => commands["edit:component"]({ name: "Foo" }, [], "edit:component", undefined)).toThrow("process.exit");

			expect(renderError).toHaveBeenCalledWith(
				expect.any(Function),
				expect.objectContaining({ error: "No project selected." }),
			);
		});

		it("errors when component does not exist", () => {
			vi.mocked(disk.existsSync).mockReturnValue(false);

			expect(() => commands["edit:component"]({ name: "Missing", "prop.status": "active" }, [], "edit:component", mockProject)).toThrow("process.exit");

			expect(renderError).toHaveBeenCalledWith(
				expect.any(Function),
				expect.objectContaining({ error: expect.stringContaining("not found") }),
			);
		});

		it("errors when no --prop.* flags are given", () => {
			vi.mocked(disk.existsSync).mockReturnValue(true);

			expect(() => commands["edit:component"]({ name: "Existing" }, [], "edit:component", mockProject)).toThrow("process.exit");

			expect(renderError).toHaveBeenCalledWith(
				expect.any(Function),
				expect.objectContaining({ error: "No properties specified." }),
			);
		});

		it("updates frontmatter properties", () => {
			vi.mocked(disk.existsSync).mockReturnValue(true);

			commands["edit:component"](
				{ name: "Existing", "prop.status": "active", "prop.technology": "React" },
				[],
				"edit:component",
				mockProject,
			);

			expect(renderSuccess).toHaveBeenCalledWith(
				expect.any(Function),
				expect.objectContaining({ message: expect.stringContaining("Updated") }),
			);
			expect(disk.writeFileSync).toHaveBeenCalled();
		});
	});
});
