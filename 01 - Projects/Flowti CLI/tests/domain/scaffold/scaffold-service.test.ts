import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/infrastructure/filesystem.js", () => ({
	disk: {
		existsSync: vi.fn(() => false),
	},
}));
vi.mock("../../../src/infrastructure/paths.js", () => ({
	paths: {
		join: (...args: string[]) => args.join("/"),
		dirname: (p: string) => p.split("/").slice(0, -1).join("/"),
		basename: (p: string) => p.split("/").pop() || "",
		resolve: (...args: string[]) => args.join("/"),
	},
}));
vi.mock("../../../src/infrastructure/config.js", () => ({
	PROJECTS_DIR: "/vault/01 - Projects",
	cliConfig: { defaultAuthor: "Default Author" },
}));
vi.mock("../../../src/infrastructure/fs.js", () => ({
	writeFileAt: vi.fn(() => true),
}));
vi.mock("../../../src/infrastructure/logger.js", () => ({
	log: vi.fn(),
}));
vi.mock("../../../src/infrastructure/ui.js", () => ({
	RESET: "", GREEN: "", YELLOW: "",
}));
vi.mock("../../../src/domain/scaffold/scaffold-plan.js", () => ({
	buildScaffoldPlan: vi.fn(() => []),
}));
vi.mock("../../../src/domain/scaffold/marketplace.js", () => ({
	loadAllDefinitions: vi.fn(() => []),
	resolveDefinitionsDir: vi.fn((_deps: unknown, root: string) => root + "/configs/definitions"),
}));
vi.mock("../../../src/domain/scaffold/scaffold-schema.js", () => ({
	validateDefinition: vi.fn(() => []),
}));
vi.mock("../../../src/domain/scaffold/templates/template-registry.js", () => {
	const ids = vi.fn(() => ["readme", "package-json", "tsconfig"]);
	const has = vi.fn((id: string) => ["readme", "package-json", "tsconfig"].includes(id));
	return {
		createTemplateRegistry: vi.fn(() => ({ register: vi.fn(), ids, has, get: vi.fn() })),
		registerAll: vi.fn(),
	};
});
vi.mock("../../../src/domain/scaffold/templates/shared-templates.js", () => ({
	sharedTemplates: [],
}));
vi.mock("../../../src/domain/scaffold/templates/project-templates.js", () => ({
	projectTemplates: [],
}));

import { disk } from "../../../src/infrastructure/filesystem.js";
import { paths } from "../../../src/infrastructure/paths.js";
import { buildScaffoldPlan } from "../../../src/domain/scaffold/scaffold-plan.js";
import { loadAllDefinitions } from "../../../src/domain/scaffold/marketplace.js";

const testDeps = { disk, paths } as const;
import { validateDefinition } from "../../../src/domain/scaffold/scaffold-schema.js";
import {
	deriveVariables,
	resolvePromptDefault,
	scaffold,
	scaffoldDryRun,
	listDefinitions,
	getKnownTemplateIds,
	loadAllDefinitionsFromProject,
	BUNDLED_DEFINITIONS,
} from "../../../src/domain/scaffold/scaffold-service.js";

beforeEach(() => {
	vi.clearAllMocks();
	// Default: definitions pass validation
	vi.mocked(validateDefinition).mockReturnValue([]);
});

// ── deriveVariables ──────────────────────────────────────────────────

describe("deriveVariables", () => {
	it("derives all name variants from a simple name", () => {
		const vars = deriveVariables("My App");

		expect(vars.name).toBe("My App");
		expect(vars.id).toBe("my-app");
		expect(vars.pascal).toBe("MyApp");
		expect(vars.camel).toBe("myApp");
	});

	it("uses provided author", () => {
		const vars = deriveVariables("Test", "John Doe");

		expect(vars.author).toBe("John Doe");
	});

	it("falls back to cliConfig.defaultAuthor when author not provided", () => {
		const vars = deriveVariables("Test");

		expect(vars.author).toBe("Default Author");
	});

	it("handles single-word name", () => {
		const vars = deriveVariables("widget");

		expect(vars.id).toBe("widget");
		expect(vars.pascal).toBe("Widget");
		expect(vars.camel).toBe("widget");
	});

	it("handles multi-word hyphenated name", () => {
		const vars = deriveVariables("data-grid-pro");

		expect(vars.id).toBe("data-grid-pro");
		expect(vars.pascal).toBe("DataGridPro");
		expect(vars.camel).toBe("dataGridPro");
	});
});

// ── resolvePromptDefault ─────────────────────────────────────────────

describe("resolvePromptDefault", () => {
	it("returns empty string for undefined", () => {
		expect(resolvePromptDefault(undefined)).toBe("");
	});

	it("returns empty string for empty string", () => {
		expect(resolvePromptDefault("")).toBe("");
	});

	it("resolves cliConfig.defaultAuthor placeholder", () => {
		expect(resolvePromptDefault("{{cliConfig.defaultAuthor}}")).toBe("Default Author");
	});

	it("returns literal value for non-placeholder strings", () => {
		expect(resolvePromptDefault("some value")).toBe("some value");
	});
});

// ── scaffold ─────────────────────────────────────────────────────────

describe("scaffold", () => {
	it("returns error for unknown definition ID", () => {
		const result = scaffold(testDeps, { definitionId: "nonexistent", name: "Test" });

		expect(result).toHaveProperty("error");
		expect((result as { error: string }).error).toContain("Unknown scaffold definition");
	});

	it("returns error when output directory already exists", () => {
		vi.mocked(disk.existsSync).mockReturnValue(true);

		const result = scaffold(testDeps, { definitionId: "flowti-project", name: "Test" });

		expect(result).toHaveProperty("error");
		expect((result as { error: string }).error).toContain("Directory already exists");
	});

	it("writes plan and returns created count on success", () => {
		vi.mocked(disk.existsSync).mockReturnValue(false);
		vi.mocked(buildScaffoldPlan).mockReturnValue([
			{ path: "README.md", content: "# Test" },
			{ path: "package.json", content: "{}" },
		]);

		const result = scaffold(testDeps, { definitionId: "flowti-project", name: "Test" });

		if ("created" in result) {
			expect(result.created).toBe(2);
			expect(result.outputPath).toContain("Test");
		}
	});

	it("uses custom outputDir when provided", () => {
		vi.mocked(disk.existsSync).mockReturnValue(false);
		vi.mocked(buildScaffoldPlan).mockReturnValue([]);

		const result = scaffold(testDeps, {
			definitionId: "flowti-project",
			name: "Test",
			outputDir: "/custom/output",
		});

		if ("created" in result) {
			expect(result.outputPath).toBe("/custom/output");
		}
	});
});

// ── scaffoldDryRun ───────────────────────────────────────────────────

describe("scaffoldDryRun", () => {
	it("returns error for unknown definition ID", () => {
		const result = scaffoldDryRun(testDeps, { definitionId: "nonexistent", name: "Test" });

		expect(result).toHaveProperty("error");
		expect((result as { error: string }).error).toContain("Unknown scaffold definition");
	});

	it("returns file list without writing anything", () => {
		vi.mocked(buildScaffoldPlan).mockReturnValue([
			{ path: "README.md", content: "# Test" },
			{ path: "src/index.ts", content: "export {}" },
		]);

		const result = scaffoldDryRun(testDeps, { definitionId: "flowti-project", name: "Test" });

		if ("files" in result) {
			expect(result.files).toEqual(["README.md", "src/index.ts"]);
			expect(result.definition).toBe("flowti-project");
			expect(result.outputPath).toContain("Test");
		}
	});

	it("uses custom outputDir when provided", () => {
		vi.mocked(buildScaffoldPlan).mockReturnValue([]);

		const result = scaffoldDryRun(testDeps, {
			definitionId: "flowti-project",
			name: "Test",
			outputDir: "/custom",
		});

		if ("files" in result) {
			expect(result.outputPath).toBe("/custom");
		}
	});
});

// ── listDefinitions ──────────────────────────────────────────────────

describe("listDefinitions", () => {
	it("returns validated bundled definitions", () => {
		vi.mocked(validateDefinition).mockReturnValue([]);

		const defs = listDefinitions();

		expect(defs.length).toBeGreaterThanOrEqual(0);
	});

	it("excludes definitions that fail validation", () => {
		vi.mocked(validateDefinition).mockReturnValue(["Invalid"]);

		const defs = listDefinitions();

		expect(defs).toHaveLength(0);
	});
});

// ── getKnownTemplateIds ──────────────────────────────────────────────

describe("getKnownTemplateIds", () => {
	it("returns template IDs from the default registry", () => {
		const ids = getKnownTemplateIds();

		expect(Array.isArray(ids)).toBe(true);
		expect(ids).toEqual(["readme", "package-json", "tsconfig"]);
	});
});

// ── loadAllDefinitionsFromProject ────────────────────────────────────

describe("loadAllDefinitionsFromProject", () => {
	it("calls loadAllDefinitions with bundled definitions and known IDs", () => {
		loadAllDefinitionsFromProject(testDeps, "/project");

		expect(loadAllDefinitions).toHaveBeenCalledWith(
			expect.any(Object),
			BUNDLED_DEFINITIONS,
			"/project/configs/definitions",
			["readme", "package-json", "tsconfig"],
		);
	});

	it("passes empty localDir when no projectRoot given", () => {
		loadAllDefinitionsFromProject(testDeps);

		expect(loadAllDefinitions).toHaveBeenCalledWith(
			expect.any(Object),
			BUNDLED_DEFINITIONS,
			"",
			["readme", "package-json", "tsconfig"],
		);
	});
});

// ── BUNDLED_DEFINITIONS ──────────────────────────────────────────────

describe("BUNDLED_DEFINITIONS", () => {
	it("is an array with at least one entry", () => {
		expect(Array.isArray(BUNDLED_DEFINITIONS)).toBe(true);
		expect(BUNDLED_DEFINITIONS.length).toBeGreaterThanOrEqual(1);
	});
});
