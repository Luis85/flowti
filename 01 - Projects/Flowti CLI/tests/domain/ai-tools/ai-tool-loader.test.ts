import { describe, it, expect, vi, beforeEach } from "vitest";
import path from "node:path";
import { createMockFs } from "../../mocks/mock-fs.js";

vi.mock("../../../src/infrastructure/ui.js", () => ({
	RESET: "", BOLD: "", DIM: "", GREEN: "", RED: "", CYAN: "", YELLOW: "",
}));

vi.mock("../../../src/infrastructure/logger.js", () => ({
	log: vi.fn(),
}));

import {
	validateToolDefinition,
	discoverToolFiles,
	loadToolFile,
	loadAiTools,
	scaffoldAiTool,
	generateToolReference,
	AI_TOOLS_DIR,
} from "../../../src/domain/ai-tools/ai-tool-loader.js";

const testPaths = {
	join: (...args: string[]) => args.join("/"),
	basename: (p: string, ext?: string) => { const b = path.basename(p); return ext && b.endsWith(ext) ? b.slice(0, -ext.length) : b; },
	dirname: (p: string) => path.dirname(p).replace(/\\/g, "/"),
	resolve: (...args: string[]) => args.join("/"),
	relative: (_from: string, to: string) => to,
};

const testDeps = { paths: testPaths } as const;

beforeEach(() => vi.clearAllMocks());

// ── validateToolDefinition ──────────────────────────────────────────

describe("validateToolDefinition", () => {
	const validTool = {
		name: "search-docs",
		description: "Search project documentation",
		run: "grep -r $QUERY docs/",
		version: "1.0.0",
		params: [
			{ name: "query", type: "string", description: "Search term", required: true },
		],
		tags: ["search", "docs"],
	};

	it("accepts a valid tool definition", () => {
		const result = validateToolDefinition(validTool);
		expect(result.valid).toBe(true);
		expect(result.errors).toHaveLength(0);
	});

	it("rejects null", () => {
		const result = validateToolDefinition(null);
		expect(result.valid).toBe(false);
		expect(result.errors).toContain("Tool definition must be a JSON object");
	});

	it("rejects arrays", () => {
		const result = validateToolDefinition([]);
		expect(result.valid).toBe(false);
	});

	it("rejects missing name", () => {
		const result = validateToolDefinition({ ...validTool, name: "" });
		expect(result.valid).toBe(false);
		expect(result.errors[0]).toContain("name");
	});

	it("rejects invalid name format", () => {
		const result = validateToolDefinition({ ...validTool, name: "My Tool!" });
		expect(result.valid).toBe(false);
		expect(result.errors[0]).toContain("lowercase");
	});

	it("allows underscores in name", () => {
		const result = validateToolDefinition({ ...validTool, name: "search_docs" });
		expect(result.valid).toBe(true);
	});

	it("rejects missing description", () => {
		const result = validateToolDefinition({ ...validTool, description: "" });
		expect(result.valid).toBe(false);
		expect(result.errors[0]).toContain("description");
	});

	it("rejects missing run command", () => {
		const result = validateToolDefinition({ ...validTool, run: "" });
		expect(result.valid).toBe(false);
		expect(result.errors[0]).toContain("run");
	});

	it("rejects invalid param type", () => {
		const result = validateToolDefinition({
			...validTool,
			params: [{ name: "x", type: "invalid", description: "test" }],
		});
		expect(result.valid).toBe(false);
		expect(result.errors[0]).toContain("invalid \"type\"");
	});

	it("rejects param without name", () => {
		const result = validateToolDefinition({
			...validTool,
			params: [{ name: "", type: "string", description: "test" }],
		});
		expect(result.valid).toBe(false);
		expect(result.errors[0]).toContain('missing "name"');
	});

	it("rejects param without description", () => {
		const result = validateToolDefinition({
			...validTool,
			params: [{ name: "x", type: "string", description: "" }],
		});
		expect(result.valid).toBe(false);
		expect(result.errors[0]).toContain('missing "description"');
	});

	it("warns on non-string version", () => {
		const result = validateToolDefinition({ ...validTool, version: 123 });
		expect(result.valid).toBe(true);
		expect(result.warnings[0]).toContain("version");
	});

	it("warns on non-array tags", () => {
		const result = validateToolDefinition({ ...validTool, tags: "bad" });
		expect(result.valid).toBe(true);
		expect(result.warnings[0]).toContain("tags");
	});

	it("accepts tool with no params", () => {
		const { params: _, ...noParams } = validTool;
		const result = validateToolDefinition(noParams);
		expect(result.valid).toBe(true);
	});

	it("rejects non-array params", () => {
		const result = validateToolDefinition({ ...validTool, params: "bad" });
		expect(result.valid).toBe(false);
		expect(result.errors[0]).toContain("params");
	});

	it("rejects non-string cwd", () => {
		const result = validateToolDefinition({ ...validTool, cwd: 123 });
		expect(result.valid).toBe(false);
		expect(result.errors[0]).toContain("cwd");
	});
});

// ── discoverToolFiles ───────────────────────────────────────────────

describe("discoverToolFiles", () => {
	it("returns empty array when directory does not exist", () => {
		const fs = createMockFs({});
		expect(discoverToolFiles(testDeps, "/vault/.flowti/ai-tools", fs)).toEqual([]);
	});

	it("finds .json files in the ai-tools directory", () => {
		const fs = createMockFs({
			"/vault/.flowti/ai-tools/search.json": "{}",
			"/vault/.flowti/ai-tools/build.json": "{}",
		});
		const result = discoverToolFiles(testDeps, "/vault/.flowti/ai-tools", fs);
		expect(result).toHaveLength(2);
	});

	it("ignores non-json files", () => {
		const fs = createMockFs({
			"/vault/.flowti/ai-tools/readme.txt": "hello",
			"/vault/.flowti/ai-tools/search.json": "{}",
		});
		const result = discoverToolFiles(testDeps, "/vault/.flowti/ai-tools", fs);
		expect(result).toHaveLength(1);
	});
});

// ── loadToolFile ────────────────────────────────────────────────────

describe("loadToolFile", () => {
	const validJson = JSON.stringify({
		name: "search",
		description: "Search docs",
		run: "grep -r term docs/",
	});

	it("loads a valid tool file", () => {
		const fs = createMockFs({ "/vault/.flowti/ai-tools/search.json": validJson });
		const result = loadToolFile(testDeps, "/vault/.flowti/ai-tools/search.json", fs);

		expect(result.valid).toBe(true);
		expect(result.definition.name).toBe("search");
	});

	it("returns invalid for malformed JSON", () => {
		const fs = createMockFs({ "/vault/.flowti/ai-tools/bad.json": "not json" });
		const result = loadToolFile(testDeps, "/vault/.flowti/ai-tools/bad.json", fs);

		expect(result.valid).toBe(false);
		expect(result.errors[0]).toContain("Failed to parse");
	});

	it("returns invalid for bad structure", () => {
		const fs = createMockFs({ "/vault/.flowti/ai-tools/bad.json": '{"name": ""}' });
		const result = loadToolFile(testDeps, "/vault/.flowti/ai-tools/bad.json", fs);

		expect(result.valid).toBe(false);
	});
});

// ── loadAiTools ─────────────────────────────────────────────────────

describe("loadAiTools", () => {
	it("returns empty array when no tools directory", () => {
		const fs = createMockFs({});
		expect(loadAiTools(testDeps, "/vault", fs)).toEqual([]);
	});

	it("loads all tools from the vault ai-tools directory", () => {
		const tool1 = JSON.stringify({ name: "a", description: "A", run: "echo a" });
		const tool2 = JSON.stringify({ name: "b", description: "B", run: "echo b" });
		const fs = createMockFs({
			"/vault/.flowti/ai-tools/a.json": tool1,
			"/vault/.flowti/ai-tools/b.json": tool2,
		});
		const result = loadAiTools(testDeps, "/vault", fs);

		expect(result).toHaveLength(2);
		expect(result[0].valid).toBe(true);
		expect(result[1].valid).toBe(true);
	});
});

// ── scaffoldAiTool ──────────────────────────────────────────────────

describe("scaffoldAiTool", () => {
	it("creates a new tool definition file", () => {
		const fs = createMockFs({});
		const result = scaffoldAiTool(testDeps, "/vault", "my-tool", "A test tool", "echo hello", fs);

		expect("path" in result).toBe(true);
		expect(fs.existsSync("/vault/.flowti/ai-tools/my-tool.json")).toBe(true);

		const def = JSON.parse(fs.readFileSync("/vault/.flowti/ai-tools/my-tool.json", "utf-8"));
		expect(def.name).toBe("my-tool");
		expect(def.run).toBe("echo hello");
	});

	it("rejects invalid tool names", () => {
		const fs = createMockFs({});
		const result = scaffoldAiTool(testDeps, "/vault", "My Tool!", "bad", "echo", fs);
		expect("error" in result).toBe(true);
	});

	it("rejects duplicate tool names", () => {
		const fs = createMockFs({
			"/vault/.flowti/ai-tools/existing.json": "{}",
		});
		const result = scaffoldAiTool(testDeps, "/vault", "existing", "dup", "echo", fs);
		expect("error" in result).toBe(true);
		if ("error" in result) {
			expect(result.error).toContain("already exists");
		}
	});
});

// ── generateToolReference ───────────────────────────────────────────

describe("generateToolReference", () => {
	it("returns empty string for no valid tools", () => {
		expect(generateToolReference([])).toBe("");
	});

	it("generates markdown reference for valid tools", () => {
		const tools = [
			{
				definition: {
					name: "search",
					description: "Search documentation",
					run: "grep -r $QUERY docs/",
					params: [
						{ name: "query", type: "string" as const, description: "Search term", required: true },
					],
					tags: ["search"],
				},
				path: "/vault/.flowti/ai-tools/search.json",
				valid: true,
				errors: [],
			},
		];

		const ref = generateToolReference(tools);
		expect(ref).toContain("# AI Tools");
		expect(ref).toContain("## search");
		expect(ref).toContain("grep -r $QUERY docs/");
		expect(ref).toContain("`query`");
		expect(ref).toContain("(required)");
		expect(ref).toContain("search");
	});

	it("skips invalid tools", () => {
		const tools = [
			{
				definition: { name: "bad", description: "", run: "" },
				path: "/vault/.flowti/ai-tools/bad.json",
				valid: false,
				errors: ["broken"],
			},
		];

		expect(generateToolReference(tools)).toBe("");
	});
});
