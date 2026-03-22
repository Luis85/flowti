import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/infrastructure/logger.js", () => ({ log: vi.fn(), warn: vi.fn() }));
vi.mock("../../../src/infrastructure/ui.js", () => ({
	RESET: "", DIM: "", GREEN: "", RED: "", YELLOW: "", CYAN: "",
}));
vi.mock("../../../src/infrastructure/filesystem.js", () => ({
	disk: {
		existsSync: vi.fn(() => false),
		readFileSync: vi.fn(() => "{}"),
		writeFileSync: vi.fn(),
		mkdirSync: vi.fn(),
		readdirSync: vi.fn(() => []),
	},
}));
vi.mock("../../../src/infrastructure/paths.js", () => ({
	paths: {
		join: (...args: string[]) => args.join("/"),
		basename: (p: string, ext?: string) => {
			const b = p.split("/").pop() || "";
			return ext && b.endsWith(ext) ? b.slice(0, -ext.length) : b;
		},
		resolve: (...args: string[]) => args.join("/"),
	},
}));
vi.mock("../../../src/infrastructure/clock.js", () => ({
	clock: { iso: vi.fn(() => "2026-01-01T00:00:00.000Z"), now: vi.fn(() => new Date()), ms: vi.fn(() => 0) },
}));
vi.mock("../../../src/infrastructure/config.js", () => ({
	VAULT_ROOT: "/vault",
	CLI_PROJECT: "/cli",
}));
vi.mock("../../../src/infrastructure/input.js", () => ({
	input: { ask: vi.fn() },
}));
vi.mock("../../../src/infrastructure/menu.js", () => ({
	runMenu: vi.fn(),
}));
// Inline shell mock: per-test vi.mocked(shell.runCaptureStatus) overrides require vi.fn().
// See tests/mocks/mock-presets.ts for the standard mockShellPreset() factory.
vi.mock("../../../src/infrastructure/shell.js", () => ({
	shell: {
		runCaptureStatus: vi.fn(() => ({ exitCode: 0, stdout: "" })),
	},
}));
vi.mock("../../../src/domain/ai-tools/ai-tool-loader.js", () => ({
	loadAiTools: vi.fn(() => []),
	validateToolDefinition: vi.fn(() => ({ valid: true, errors: [], warnings: [] })),
	scaffoldAiTool: vi.fn(() => ({ path: "/vault/.flowti/ai-tools/test.json" })),
	discoverToolFiles: vi.fn(() => []),
	AI_TOOLS_DIR: ".flowti/ai-tools",
}));
vi.mock("../../../src/domain/ai-tools/ai-tool-reference.js", () => ({
	generateAiToolReference: vi.fn(() => ({ save: vi.fn() })),
}));
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

import { log } from "../../../src/infrastructure/logger.js";
import { disk } from "../../../src/infrastructure/filesystem.js";
import { paths } from "../../../src/infrastructure/paths.js";
import { commands } from "../../../src/controller/ai-tools.controller.js";
import {
	substituteParams,
	toToolListItems,
	toToolValidationItems,
} from "../../../src/domain/ai-tools/ai-tool-commands.js";
import { shell } from "../../../src/infrastructure/shell.js";
import {
	loadAiTools,
	validateToolDefinition,
	discoverToolFiles,
} from "../../../src/domain/ai-tools/ai-tool-loader.js";
import { generateAiToolReference } from "../../../src/domain/ai-tools/ai-tool-reference.js";
import type { LoadedAiTool } from "../../../src/domain/ai-tools/ai-tool-types.js";

beforeEach(() => {
	vi.clearAllMocks();
	capturedJson.length = 0;
});

// ── ai:list ──────────────────────────────────────────────────────────

describe("ai:list", () => {
	it("logs 'No AI tools found' when no tools exist", () => {
		vi.mocked(loadAiTools).mockReturnValue([]);

		commands["ai:list"]({}, []);

		expect(loadAiTools).toHaveBeenCalledWith(expect.any(Object), "/vault", disk);
		expect(log).toHaveBeenCalledWith(
			expect.stringContaining("No AI tools found"),
		);
	});

	it("logs tool names with checkmarks for valid tools", () => {
		const tools: LoadedAiTool[] = [
			{
				definition: { name: "search", description: "Search docs", run: "grep" },
				path: "/vault/.flowti/ai-tools/search.json",
				valid: true,
				errors: [],
			},
		];
		vi.mocked(loadAiTools).mockReturnValue(tools);

		commands["ai:list"]({}, []);

		expect(log).toHaveBeenCalledWith(expect.stringContaining("search"));
		expect(log).toHaveBeenCalledWith(expect.stringContaining("Search docs"));
	});

	it("logs errors for invalid tools", () => {
		const tools: LoadedAiTool[] = [
			{
				definition: { name: "broken", description: "", run: "" },
				path: "/vault/.flowti/ai-tools/broken.json",
				valid: false,
				errors: ["Missing run field"],
			},
		];
		vi.mocked(loadAiTools).mockReturnValue(tools);

		commands["ai:list"]({}, []);

		expect(log).toHaveBeenCalledWith(expect.stringContaining("Missing run field"));
	});
});

// ── ai:validate ──────────────────────────────────────────────────────

describe("ai:validate", () => {
	it("logs 'No AI tool files found' when no files discovered", () => {
		vi.mocked(discoverToolFiles).mockReturnValue([]);

		commands["ai:validate"]({}, []);

		expect(log).toHaveBeenCalledWith(
			expect.stringContaining("No AI tool files found"),
		);
	});

	it("reads JSON, validates, and logs checkmark for valid file", () => {
		vi.mocked(discoverToolFiles).mockReturnValue(["/vault/.flowti/ai-tools/good.json"]);
		vi.mocked(disk.readFileSync).mockReturnValue(
			JSON.stringify({ name: "good", description: "ok", run: "echo" }) as never,
		);
		vi.mocked(validateToolDefinition).mockReturnValue({
			valid: true,
			errors: [],
			warnings: [],
		});

		commands["ai:validate"]({}, []);

		expect(disk.readFileSync).toHaveBeenCalledWith(
			"/vault/.flowti/ai-tools/good.json",
			"utf-8",
		);
		expect(validateToolDefinition).toHaveBeenCalled();
		// checkmark for valid
		expect(log).toHaveBeenCalledWith(expect.stringContaining("good.json"));
	});

	it("logs parse error message for unparsable JSON", () => {
		vi.mocked(discoverToolFiles).mockReturnValue(["/vault/.flowti/ai-tools/bad.json"]);
		vi.mocked(disk.readFileSync).mockImplementation(() => {
			throw new SyntaxError("Unexpected token");
		});

		commands["ai:validate"]({}, []);

		expect(log).toHaveBeenCalledWith(
			expect.stringContaining("Parse error"),
		);
		expect(log).toHaveBeenCalledWith(
			expect.stringContaining("Unexpected token"),
		);
	});
});

// ── ai:list --json ──────────────────────────────────────────────────

describe("ai:list --json", () => {
	it("outputs JSON array with tool metadata", () => {
		const tools: LoadedAiTool[] = [
			{
				definition: { name: "search", description: "Search docs", run: "grep", version: "1.0", params: [{ name: "query", type: "string", required: true, description: "Search query" }], tags: ["search"] },
				path: "/vault/.flowti/ai-tools/search.json",
				valid: true,
				errors: [],
			},
		];
		vi.mocked(loadAiTools).mockReturnValue(tools);

		commands["ai:list"]({ format: "json" }, []);

		const logCalls = vi.mocked(log).mock.calls.map((c) => c[0]);
		const jsonLine = logCalls.find((c) => typeof c === "string" && c.startsWith("["));
		expect(jsonLine).toBeDefined();
		const data = JSON.parse(jsonLine as string) as Array<Record<string, unknown>>;
		expect(data).toHaveLength(1);
		expect(data[0].name).toBe("search");
		expect(data[0].version).toBe("1.0");
		expect(data[0].run).toBe("grep");
		expect(data[0].valid).toBe(true);
		expect(data[0].tags).toEqual(["search"]);
	});
});

// ── ai:validate --json ──────────────────────────────────────────────

describe("ai:validate --json", () => {
	it("outputs JSON validation results with --format=json", () => {
		vi.mocked(discoverToolFiles).mockReturnValue(["/vault/.flowti/ai-tools/good.json"]);
		vi.mocked(disk.readFileSync).mockReturnValue(
			JSON.stringify({ name: "good", description: "ok", run: "echo" }) as never,
		);
		vi.mocked(validateToolDefinition).mockReturnValue({ valid: true, errors: [], warnings: [] });

		commands["ai:validate"]({ format: "json" }, []);

		const logCalls = vi.mocked(log).mock.calls.map((c) => c[0]);
		const jsonLine = logCalls.find((c) => typeof c === "string" && c.startsWith("["));
		expect(jsonLine).toBeDefined();
		const parsed = JSON.parse(jsonLine as string);
		expect(parsed).toHaveLength(1);
		expect(parsed[0].file).toBe("good.json");
		expect(parsed[0].valid).toBe(true);
	});
});

// ── ai:reference ─────────────────────────────────────────────────────

describe("ai:reference", () => {
	it("generates reference doc, saves it, and logs success", () => {
		const saveFn = vi.fn();
		const tools: LoadedAiTool[] = [
			{
				definition: { name: "my-tool", description: "Desc", run: "echo hi" },
				path: "/vault/.flowti/ai-tools/my-tool.json",
				valid: true,
				errors: [],
			},
		];
		vi.mocked(loadAiTools).mockReturnValue(tools);
		vi.mocked(generateAiToolReference).mockReturnValue({ save: saveFn } as any);

		commands["ai:reference"]({}, [], "ai:reference");

		expect(loadAiTools).toHaveBeenCalledWith(expect.any(Object), "/vault", disk);
		expect(generateAiToolReference).toHaveBeenCalledWith(expect.any(Object), tools);
		expect(saveFn).toHaveBeenCalledWith("/cli/docs/reference/AI Tool Reference.md", disk);
		expect(log).toHaveBeenCalledWith(
			expect.stringContaining("Reference saved"),
		);
	});
});

// ── substituteParams ────────────────────────────────────────────────

describe("substituteParams", () => {
	it("replaces a single placeholder", () => {
		const result = substituteParams("grep {{query}} .", [{ name: "query" }], { query: "hello" });
		expect(result).toBe("grep hello .");
	});

	it("replaces multiple placeholders", () => {
		const result = substituteParams("find {{dir}} -name {{pattern}}", [{ name: "dir" }, { name: "pattern" }], { dir: "src", pattern: "*.ts" });
		expect(result).toBe("find src -name *.ts");
	});

	it("uses default value when flag is missing", () => {
		const result = substituteParams("echo {{msg}}", [{ name: "msg", default: "world" }], {});
		expect(result).toBe("echo world");
	});

	it("uses empty string when no flag and no default", () => {
		const result = substituteParams("echo {{msg}}", [{ name: "msg" }], {});
		expect(result).toBe("echo ");
	});

	it("replaces all occurrences of the same placeholder", () => {
		const result = substituteParams("{{x}} and {{x}}", [{ name: "x" }], { x: "val" });
		expect(result).toBe("val and val");
	});

	it("flag overrides default", () => {
		const result = substituteParams("echo {{msg}}", [{ name: "msg", default: "default" }], { msg: "override" });
		expect(result).toBe("echo override");
	});
});

// ── ai:run ──────────────────────────────────────────────────────────

describe("ai:run", () => {
	const validTool: LoadedAiTool = {
		definition: { name: "search", description: "Search files", run: "grep {{query}} .", params: [{ name: "query", type: "string", required: true, description: "Search query" }] },
		path: "/vault/.flowti/ai-tools/search.json",
		valid: true,
		errors: [],
	};

	it("logs error when --tool flag is missing", () => {
		commands["ai:run"]({ format: "json" }, []);

		expect(log).toHaveBeenCalledWith(
			expect.stringContaining("Missing required flag --tool"),
		);
	});

	it("logs error when tool is not found", () => {
		vi.mocked(loadAiTools).mockReturnValue([]);

		commands["ai:run"]({ tool: "nonexistent" }, []);

		expect(log).toHaveBeenCalledWith(expect.stringContaining("Tool not found: nonexistent"));
	});

	it("lists available tools when tool not found", () => {
		vi.mocked(loadAiTools).mockReturnValue([validTool]);

		commands["ai:run"]({ tool: "nonexistent" }, []);

		expect(log).toHaveBeenCalledWith(expect.stringContaining("Available: search"));
	});

	it("logs validation errors for invalid tool", () => {
		const invalid: LoadedAiTool = {
			definition: { name: "bad", description: "", run: "" },
			path: "/vault/.flowti/ai-tools/bad.json",
			valid: false,
			errors: ["Missing run field"],
		};
		vi.mocked(loadAiTools).mockReturnValue([invalid]);

		commands["ai:run"]({ tool: "bad" }, []);

		expect(log).toHaveBeenCalledWith(expect.stringContaining("validation errors"));
		expect(log).toHaveBeenCalledWith(expect.stringContaining("Missing run field"));
	});

	it("logs error when required params are missing", () => {
		vi.mocked(loadAiTools).mockReturnValue([validTool]);

		commands["ai:run"]({ tool: "search" }, []);

		expect(log).toHaveBeenCalledWith(expect.stringContaining("Missing required parameter"));
		expect(log).toHaveBeenCalledWith(expect.stringContaining("--query"));
	});

	it("executes tool successfully", () => {
		vi.mocked(loadAiTools).mockReturnValue([validTool]);
		vi.mocked(shell.runCaptureStatus).mockReturnValue({ exitCode: 0, stdout: "" } as any);

		commands["ai:run"]({ tool: "search", query: "hello" }, []);

		expect(shell.runCaptureStatus).toHaveBeenCalledWith("grep hello .", { cwd: "/vault" });
		expect(log).toHaveBeenCalledWith(expect.stringContaining("completed"));
	});

	it("shows dry-run output without executing", () => {
		vi.mocked(loadAiTools).mockReturnValue([validTool]);

		commands["ai:run"]({ tool: "search", query: "hello", "dry-run": true }, []);

		expect(shell.runCaptureStatus).not.toHaveBeenCalled();
		expect(log).toHaveBeenCalledWith(expect.stringContaining("Dry run"));
		expect(log).toHaveBeenCalledWith(expect.stringContaining("grep hello ."));
	});

	it("logs failure when tool exits non-zero", () => {
		vi.mocked(loadAiTools).mockReturnValue([validTool]);
		vi.mocked(shell.runCaptureStatus).mockReturnValue({ exitCode: 1, stdout: "" } as any);

		commands["ai:run"]({ tool: "search", query: "hello" }, []);

		expect(log).toHaveBeenCalledWith(expect.stringContaining("failed (exit 1)"));
	});

	it("uses tool cwd when defined", () => {
		const toolWithCwd: LoadedAiTool = {
			definition: { name: "lint", description: "Lint", run: "eslint .", cwd: "src" },
			path: "/vault/.flowti/ai-tools/lint.json",
			valid: true,
			errors: [],
		};
		vi.mocked(loadAiTools).mockReturnValue([toolWithCwd]);

		commands["ai:run"]({ tool: "lint" }, []);

		expect(shell.runCaptureStatus).toHaveBeenCalledWith("eslint .", { cwd: "/vault/src" });
	});
});

// ── toToolListItems (pure domain function) ───────────────────────────

describe("toToolListItems", () => {
	it("returns empty array for empty input", () => {
		expect(toToolListItems([])).toEqual([]);
	});

	it("maps a valid tool to a list item", () => {
		const tools: LoadedAiTool[] = [
			{
				definition: {
					name: "search",
					description: "Search docs",
					run: "grep {{q}} .",
					version: "1.0",
					params: [{ name: "q", type: "string", required: true, description: "Query" }],
					tags: ["search", "util"],
				},
				path: "/vault/.flowti/ai-tools/search.json",
				valid: true,
				errors: [],
			},
		];

		const items = toToolListItems(tools);

		expect(items).toHaveLength(1);
		expect(items[0].name).toBe("search");
		expect(items[0].version).toBe("1.0");
		expect(items[0].description).toBe("Search docs");
		expect(items[0].run).toBe("grep {{q}} .");
		expect(items[0].params).toEqual([{ name: "q", type: "string", required: true, description: "Query" }]);
		expect(items[0].tags).toEqual(["search", "util"]);
		expect(items[0].valid).toBe(true);
		expect(items[0].errors).toEqual([]);
	});

	it("maps version to null when not present", () => {
		const tools: LoadedAiTool[] = [
			{
				definition: { name: "t", description: "", run: "echo" },
				path: "/p",
				valid: true,
				errors: [],
			},
		];

		const items = toToolListItems(tools);

		expect(items[0].version).toBeNull();
	});

	it("defaults params to empty array when not present", () => {
		const tools: LoadedAiTool[] = [
			{
				definition: { name: "t", description: "", run: "echo" },
				path: "/p",
				valid: true,
				errors: [],
			},
		];

		const items = toToolListItems(tools);

		expect(items[0].params).toEqual([]);
	});

	it("defaults tags to empty array when not present", () => {
		const tools: LoadedAiTool[] = [
			{
				definition: { name: "t", description: "", run: "echo" },
				path: "/p",
				valid: true,
				errors: [],
			},
		];

		const items = toToolListItems(tools);

		expect(items[0].tags).toEqual([]);
	});

	it("defaults required to false on params when not set", () => {
		const tools: LoadedAiTool[] = [
			{
				definition: {
					name: "t",
					description: "",
					run: "echo",
					params: [{ name: "x", type: "string", description: "" }],
				},
				path: "/p",
				valid: true,
				errors: [],
			},
		];

		const items = toToolListItems(tools);

		expect(items[0].params[0].required).toBe(false);
	});

	it("maps invalid tool with errors", () => {
		const tools: LoadedAiTool[] = [
			{
				definition: { name: "bad", description: "", run: "" },
				path: "/p",
				valid: false,
				errors: ["Missing run", "Invalid name"],
			},
		];

		const items = toToolListItems(tools);

		expect(items[0].valid).toBe(false);
		expect(items[0].errors).toEqual(["Missing run", "Invalid name"]);
	});

	it("creates a copy of the errors array", () => {
		const origErrors = ["err"];
		const tools: LoadedAiTool[] = [
			{
				definition: { name: "t", description: "", run: "" },
				path: "/p",
				valid: false,
				errors: origErrors,
			},
		];

		const items = toToolListItems(tools);
		items[0].errors.push("extra");

		expect(origErrors).toHaveLength(1);
	});

	it("maps multiple tools", () => {
		const tools: LoadedAiTool[] = [
			{
				definition: { name: "a", description: "A", run: "echo a" },
				path: "/a",
				valid: true,
				errors: [],
			},
			{
				definition: { name: "b", description: "B", run: "echo b" },
				path: "/b",
				valid: false,
				errors: ["bad"],
			},
		];

		const items = toToolListItems(tools);

		expect(items).toHaveLength(2);
		expect(items[0].name).toBe("a");
		expect(items[1].name).toBe("b");
	});
});

// ── toToolValidationItems (pure domain function) ─────────────────────

describe("toToolValidationItems", () => {
	it("returns empty array when no tool files discovered", () => {
		vi.mocked(discoverToolFiles).mockReturnValue([]);

		const items = toToolValidationItems({ disk, paths }, "/vault");

		expect(items).toEqual([]);
		expect(discoverToolFiles).toHaveBeenCalledWith(expect.any(Object), "/vault/.flowti/ai-tools", disk);
	});

	it("validates a valid tool definition", () => {
		vi.mocked(discoverToolFiles).mockReturnValue([
			"/vault/.flowti/ai-tools/search.json",
		]);
		vi.mocked(disk.readFileSync).mockReturnValue(
			JSON.stringify({ name: "search", description: "s", run: "grep" }) as never,
		);
		vi.mocked(validateToolDefinition).mockReturnValue({ valid: true, errors: [], warnings: [] });

		const items = toToolValidationItems({ disk, paths }, "/vault");

		expect(items).toHaveLength(1);
		expect(items[0]).toEqual({
			file: "search.json",
			valid: true,
			errors: [],
			warnings: [],
		});
	});

	it("reports errors and warnings from validation", () => {
		vi.mocked(discoverToolFiles).mockReturnValue([
			"/vault/.flowti/ai-tools/bad.json",
		]);
		vi.mocked(disk.readFileSync).mockReturnValue(JSON.stringify({ name: "bad" }) as never);
		vi.mocked(validateToolDefinition).mockReturnValue({
			valid: false,
			errors: ["Missing run field"],
			warnings: ["No description"],
		});

		const items = toToolValidationItems({ disk, paths }, "/vault");

		expect(items[0].valid).toBe(false);
		expect(items[0].errors).toEqual(["Missing run field"]);
		expect(items[0].warnings).toEqual(["No description"]);
	});

	it("handles JSON parse error gracefully", () => {
		vi.mocked(discoverToolFiles).mockReturnValue([
			"/vault/.flowti/ai-tools/corrupt.json",
		]);
		vi.mocked(disk.readFileSync).mockImplementation(() => {
			throw new SyntaxError("Unexpected end of JSON input");
		});

		const items = toToolValidationItems({ disk, paths }, "/vault");

		expect(items[0]).toEqual({
			file: "corrupt.json",
			valid: false,
			errors: ["Parse error: Unexpected end of JSON input"],
			warnings: [],
		});
	});

	it("handles non-Error thrown value", () => {
		vi.mocked(discoverToolFiles).mockReturnValue([
			"/vault/.flowti/ai-tools/weird.json",
		]);
		vi.mocked(disk.readFileSync).mockImplementation(() => {
			throw 42;
		});

		const items = toToolValidationItems({ disk, paths }, "/vault");

		expect(items[0].errors[0]).toBe("Parse error: 42");
	});

	it("validates multiple tool files", () => {
		vi.mocked(discoverToolFiles).mockReturnValue([
			"/vault/.flowti/ai-tools/good.json",
			"/vault/.flowti/ai-tools/bad.json",
		]);
		vi.mocked(disk.readFileSync)
			.mockReturnValueOnce(JSON.stringify({ name: "good" }) as never)
			.mockImplementationOnce(() => { throw new SyntaxError("parse fail"); });
		vi.mocked(validateToolDefinition).mockReturnValue({ valid: true, errors: [], warnings: [] });

		const items = toToolValidationItems({ disk, paths }, "/vault");

		expect(items).toHaveLength(2);
		expect(items[0].file).toBe("good.json");
		expect(items[0].valid).toBe(true);
		expect(items[1].file).toBe("bad.json");
		expect(items[1].valid).toBe(false);
	});

	it("copies errors and warnings arrays (mutation safe)", () => {
		const origErrors = ["e"];
		const origWarnings = ["w"];
		vi.mocked(discoverToolFiles).mockReturnValue([
			"/vault/.flowti/ai-tools/t.json",
		]);
		vi.mocked(disk.readFileSync).mockReturnValue("{}" as never);
		vi.mocked(validateToolDefinition).mockReturnValue({
			valid: false,
			errors: origErrors,
			warnings: origWarnings,
		});

		const items = toToolValidationItems({ disk, paths }, "/vault");
		items[0].errors.push("x");
		items[0].warnings.push("x");

		expect(origErrors).toHaveLength(1);
		expect(origWarnings).toHaveLength(1);
	});
});
