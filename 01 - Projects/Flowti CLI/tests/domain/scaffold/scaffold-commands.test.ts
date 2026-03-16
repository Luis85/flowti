import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/infrastructure/logger.js", () => ({ log: vi.fn(), warn: vi.fn() }));
vi.mock("../../../src/infrastructure/ui.js", () => ({
	RESET: "", BOLD: "", DIM: "", GREEN: "", RED: "", CYAN: "", YELLOW: "",
}));
vi.mock("../../../src/infrastructure/shell.js", async () => {
	const { mockShellPreset } = await import("../../mocks/mock-presets.js");
	return mockShellPreset();
});
vi.mock("../../../src/infrastructure/input.js", () => ({
	input: { ask: vi.fn(async () => ""), askYesNo: vi.fn(async () => false), waitForEnter: vi.fn(async () => {}) },
}));
vi.mock("../../../src/infrastructure/proc.js", () => ({
	proc: { exit: vi.fn(), argv: () => [], cwd: () => "/", env: () => ({}) },
}));
vi.mock("../../../src/ui/renderers/cli-event-renderer.js", () => ({ attachCliRenderer: vi.fn(() => () => {}) }));

const capturedJson: unknown[] = [];
vi.mock("../../../src/infrastructure/output.js", () => ({
	resolveFormat: vi.fn((flags: Record<string, string | boolean>) => flags.format === "json" ? "json" : "text"),
	printOutput: vi.fn((fmt: string, data: unknown, render: () => void) => {
		if (fmt === "json") {
			capturedJson.push(data);
		} else {
			render();
		}
	}),
}));

vi.mock("../../../src/domain/scaffold/scaffold-service.js", () => ({
	scaffold: vi.fn(() => ({ created: 3, outputPath: "/out/my-project" })),
	scaffoldDryRun: vi.fn(() => ({
		files: ["package.json", "tsconfig.json", "src/main.ts"],
		outputPath: "/out/my-project",
		definition: "flowti-project",
	})),
	listDefinitions: vi.fn(() => []),
	BUNDLED_DEFINITIONS: [],
	getKnownTemplateIds: vi.fn(() => new Set()),
}));

vi.mock("../../../src/domain/scaffold/marketplace.js", () => ({
	buildMarketplaceListing: vi.fn(() => []),
	resolveDefinitionsDir: vi.fn(() => "/project/configs/definitions"),
	importDefinition: vi.fn(() => ({ success: true, targetPath: "/project/configs/definitions/test.json", errors: [] })),
}));

vi.mock("../../../src/infrastructure/filesystem.js", () => ({
	disk: { existsSync: vi.fn(() => false), readFileSync: vi.fn(() => "{}"), readdirSync: vi.fn(() => []), writeFileSync: vi.fn(), mkdirSync: vi.fn() },
}));
vi.mock("../../../src/infrastructure/paths.js", () => ({
	paths: { join: vi.fn((...args: string[]) => args.join("/")), dirname: vi.fn((p: string) => p), basename: vi.fn((p: string) => p.split("/").pop() ?? p) },
}));
vi.mock("../../../src/infrastructure/clock.js", () => ({
	clock: { iso: vi.fn(() => "2026-01-01T00:00:00.000Z"), now: vi.fn(() => new Date()), ms: vi.fn(() => 0), safeIso: vi.fn(() => "2026-01-01T00-00-00-000Z") },
}));
vi.mock("../../../src/infrastructure/config.js", () => ({
	VAULT_ROOT: "/mock/vault",
	PROJECTS_DIR: "/mock/vault/projects",
	cliConfig: { defaultAuthor: "Test Author" },
}));

vi.mock("../../../src/domain/scaffold/marketplace-export.js", () => ({
	exportBundle: vi.fn(() => ({ vault: "test", aiTools: [], plugins: [], scaffolds: [] })),
	saveBundle: vi.fn(),
	loadBundle: vi.fn(),
	importAiToolsFromBundle: vi.fn(() => 0),
}));

vi.mock("../../../src/infrastructure/suggestions.js", () => ({
	showSuggestions: vi.fn(),
	afterScaffold: vi.fn(() => []),
}));

import { commands } from "../../../src/controller/scaffold.controller.js";
import { log } from "../../../src/infrastructure/logger.js";
import { listDefinitions, scaffold, scaffoldDryRun } from "../../../src/domain/scaffold/scaffold-service.js";

beforeEach(() => {
	vi.clearAllMocks();
	capturedJson.length = 0;
});

describe("scaffold:list", () => {
	it("logs 'No scaffold definitions' when empty", () => {
		vi.mocked(listDefinitions).mockReturnValue([]);

		commands["scaffold:list"]({}, []);

		expect(log).toHaveBeenCalledWith(expect.stringContaining("No scaffold definitions"));
	});

	it("logs definition labels for text output", () => {
		vi.mocked(listDefinitions).mockReturnValue([
			{ id: "flowti-project", label: "Flowti Project", description: "Standard project", files: [], variables: [] },
		] as any);

		commands["scaffold:list"]({}, []);

		expect(log).toHaveBeenCalledWith(expect.stringContaining("flowti-project"));
	});

	it("outputs JSON array with --format=json", () => {
		vi.mocked(listDefinitions).mockReturnValue([
			{ id: "flowti-project", label: "Flowti Project", description: "Standard project", files: [], variables: [] },
			{ id: "obsidian-plugin", label: "Obsidian Plugin", description: "Plugin scaffold", files: [], variables: [] },
		] as any);

		commands["scaffold:list"]({ format: "json" }, []);

		const logCalls = vi.mocked(log).mock.calls.map((c) => c[0]);
		const jsonLine = logCalls.find((c) => typeof c === "string" && c.startsWith("{"));
		expect(jsonLine).toBeDefined();
		const data = JSON.parse(jsonLine as string) as { definitions: Array<Record<string, unknown>> };
		expect(data.definitions).toHaveLength(2);
		expect(data.definitions[0].id).toBe("flowti-project");
		expect(data.definitions[0].label).toBe("Flowti Project");
		expect(data.definitions[1].id).toBe("obsidian-plugin");
	});
});

describe("scaffold:new", () => {
	it("logs error when --name is missing", () => {
		commands["scaffold:new"]({ format: "json" }, []);

		expect(log).toHaveBeenCalledWith(
			expect.stringContaining("Missing required flag --name"),
		);
	});

	it("calls scaffold and logs success", () => {
		commands["scaffold:new"]({ name: "my-project" }, []);

		expect(scaffold).toHaveBeenCalledWith("/mock/vault/projects", expect.any(Object), expect.objectContaining({ name: "my-project" }), "Test Author");
		expect(log).toHaveBeenCalledWith(expect.stringContaining("Scaffolded"));
	});

	it("logs error when scaffold returns error", () => {
		vi.mocked(scaffold).mockReturnValueOnce({ error: "Already exists" });

		commands["scaffold:new"]({ name: "my-project" }, []);

		expect(log).toHaveBeenCalledWith(expect.stringContaining("Already exists"));
	});
});

describe("scaffold:new --dry-run", () => {
	it("shows file preview without writing", () => {
		commands["scaffold:new"]({ name: "my-project", "dry-run": true }, []);

		expect(scaffoldDryRun).toHaveBeenCalledWith("/mock/vault/projects", expect.any(Object), expect.objectContaining({ name: "my-project" }), "Test Author");
		expect(scaffold).not.toHaveBeenCalled();
		expect(log).toHaveBeenCalledWith(expect.stringContaining("Dry run"));
	});

	it("lists files that would be created", () => {
		commands["scaffold:new"]({ name: "my-project", "dry-run": true }, []);

		const calls = vi.mocked(log).mock.calls.map(([msg]) => String(msg));
		expect(calls.some((m) => m.includes("package.json"))).toBe(true);
		expect(calls.some((m) => m.includes("tsconfig.json"))).toBe(true);
		expect(calls.some((m) => m.includes("src/main.ts"))).toBe(true);
	});

	it("outputs JSON with --dry-run --format=json", () => {
		commands["scaffold:new"]({ name: "my-project", "dry-run": true, format: "json" }, []);

		const logCalls = vi.mocked(log).mock.calls.map((c) => c[0]);
		const jsonLine = logCalls.find((c) => typeof c === "string" && c.startsWith("{"));
		expect(jsonLine).toBeDefined();
		const data = JSON.parse(jsonLine as string) as Record<string, unknown>;
		expect(data.definition).toBe("flowti-project");
		expect(data.files).toEqual(["package.json", "tsconfig.json", "src/main.ts"]);
	});

	it("shows error on dry-run when definition is unknown", () => {
		vi.mocked(scaffoldDryRun).mockReturnValueOnce({ error: "Unknown scaffold definition" });

		commands["scaffold:new"]({ name: "my-project", "dry-run": true }, []);

		expect(log).toHaveBeenCalledWith(expect.stringContaining("Unknown scaffold definition"));
	});
});
