import { describe, it, expect, vi, beforeEach } from "vitest";
import ts from "typescript";

// ── Mocks ────────────────────────────────────────────────────────────

vi.mock("../../../src/infrastructure/filesystem.js", () => ({
	disk: {
		readdirSync: vi.fn(() => []),
		readFileSync: vi.fn(() => ""),
	},
}));

vi.mock("../../../src/infrastructure/paths.js", async () => {
	const path = await import("node:path");
	return {
		paths: {
			join: (...args: string[]) => args.join("/"),
			relative: (from: string, to: string) => path.default.relative(from, to).replace(/\\/g, "/"),
		},
	};
});

import { toRanges, analyzeComplexity, collectSourceFiles } from "../../../src/domain/reports/cli/complexity-analyzer.js";
import { disk } from "../../../src/infrastructure/filesystem.js";
import { paths } from "../../../src/infrastructure/paths.js";

function analyzerDeps() { return { disk, paths } as const; }

const mockReaddirSync = vi.mocked(disk.readdirSync);
const mockReadFileSync = vi.mocked(disk.readFileSync);

beforeEach(() => {
	vi.clearAllMocks();
});

// ── toRanges ─────────────────────────────────────────────────────────

describe("toRanges", () => {
	it("returns empty for empty input", () => {
		expect(toRanges([])).toEqual([]);
	});

	it("returns single number", () => {
		expect(toRanges([7])).toEqual(["7"]);
	});

	it("collapses consecutive lines", () => {
		expect(toRanges([1, 2, 3, 4])).toEqual(["1-4"]);
	});

	it("handles gaps", () => {
		expect(toRanges([1, 2, 5, 6, 10])).toEqual(["1-2", "5-6", "10"]);
	});

	it("handles all non-consecutive", () => {
		expect(toRanges([3, 8, 15])).toEqual(["3", "8", "15"]);
	});
});

// ── collectSourceFiles ───────────────────────────────────────────────

describe("collectSourceFiles", () => {
	it("returns empty when directory is empty", () => {
		mockReaddirSync.mockReturnValue([]);
		expect(collectSourceFiles("/src", analyzerDeps())).toEqual([]);
	});

	it("collects .ts files", () => {
		mockReaddirSync.mockReturnValue([
			{ name: "main.ts", isFile: () => true, isDirectory: () => false },
			{ name: "utils.ts", isFile: () => true, isDirectory: () => false },
		] as any);
		const files = collectSourceFiles("/src", analyzerDeps());
		expect(files).toHaveLength(2);
		expect(files).toContain("/src/main.ts");
		expect(files).toContain("/src/utils.ts");
	});

	it("excludes .d.ts files", () => {
		mockReaddirSync.mockReturnValue([
			{ name: "types.d.ts", isFile: () => true, isDirectory: () => false },
			{ name: "main.ts", isFile: () => true, isDirectory: () => false },
		] as any);
		const files = collectSourceFiles("/src", analyzerDeps());
		expect(files).toHaveLength(1);
		expect(files[0]).toContain("main.ts");
	});

	it("excludes .test.ts and .spec.ts files", () => {
		mockReaddirSync.mockReturnValue([
			{ name: "main.test.ts", isFile: () => true, isDirectory: () => false },
			{ name: "main.spec.ts", isFile: () => true, isDirectory: () => false },
			{ name: "main.ts", isFile: () => true, isDirectory: () => false },
		] as any);
		const files = collectSourceFiles("/src", analyzerDeps());
		expect(files).toHaveLength(1);
	});

	it("excludes .stories.ts files", () => {
		mockReaddirSync.mockReturnValue([
			{ name: "Button.stories.ts", isFile: () => true, isDirectory: () => false },
			{ name: "Button.ts", isFile: () => true, isDirectory: () => false },
		] as any);
		const files = collectSourceFiles("/src", analyzerDeps());
		expect(files).toHaveLength(1);
	});

	it("skips node_modules and __tests__ directories", () => {
		mockReaddirSync.mockImplementation((dir: any) => {
			if (dir === "/src") {
				return [
					{ name: "node_modules", isFile: () => false, isDirectory: () => true },
					{ name: "__tests__", isFile: () => false, isDirectory: () => true },
					{ name: "main.ts", isFile: () => true, isDirectory: () => false },
				] as any;
			}
			return [];
		});
		const files = collectSourceFiles("/src", analyzerDeps());
		expect(files).toHaveLength(1);
	});

	it("recurses into subdirectories", () => {
		mockReaddirSync.mockImplementation((dir: any) => {
			if (dir === "/src") {
				return [
					{ name: "domain", isFile: () => false, isDirectory: () => true },
					{ name: "main.ts", isFile: () => true, isDirectory: () => false },
				] as any;
			}
			if (dir === "/src/domain") {
				return [
					{ name: "service.ts", isFile: () => true, isDirectory: () => false },
				] as any;
			}
			return [];
		});
		const files = collectSourceFiles("/src", analyzerDeps());
		expect(files).toHaveLength(2);
	});
});

// ── analyzeComplexity ────────────────────────────────────────────────

describe("analyzeComplexity", () => {
	function setupSingleFile(filename: string, content: string): void {
		mockReaddirSync.mockReturnValue([
			{ name: filename, isFile: () => true, isDirectory: () => false },
		] as any);
		mockReadFileSync.mockReturnValue(content);
	}

	it("returns empty result for empty directory", () => {
		mockReaddirSync.mockReturnValue([]);
		const result = analyzeComplexity("/src", "/project", analyzerDeps());
		expect(result.summary.totalFunctions).toBe(0);
		expect(result.functions).toHaveLength(0);
		expect(result.files).toHaveLength(0);
	});

	it("detects a simple function with complexity 1", () => {
		setupSingleFile("simple.ts", `function greet() { return "hello"; }`);
		const result = analyzeComplexity("/src", "/src", analyzerDeps());
		expect(result.functions).toHaveLength(1);
		expect(result.functions[0].functionName).toBe("greet");
		expect(result.functions[0].complexity).toBe(1);
	});

	it("counts if-statement as a decision point", () => {
		setupSingleFile("if.ts", `function check(x: number) { if (x > 0) { return true; } return false; }`);
		const result = analyzeComplexity("/src", "/src", analyzerDeps());
		expect(result.functions[0].complexity).toBe(2); // 1 base + 1 if
	});

	it("counts for-loop as a decision point", () => {
		setupSingleFile("loop.ts", `function loop(arr: number[]) { for (const x of arr) { x; } }`);
		const result = analyzeComplexity("/src", "/src", analyzerDeps());
		expect(result.functions[0].complexity).toBe(2); // 1 base + 1 for-of
	});

	it("counts while loop as a decision point", () => {
		setupSingleFile("while.ts", `function wait(x: number) { while (x > 0) { x--; } }`);
		const result = analyzeComplexity("/src", "/src", analyzerDeps());
		expect(result.functions[0].complexity).toBe(2);
	});

	it("counts switch cases as decision points", () => {
		setupSingleFile("switch.ts", [
			"function classify(x: number) {",
			"  switch (x) {",
			"    case 1: return 'one';",
			"    case 2: return 'two';",
			"    default: return 'other';",
			"  }",
			"}",
		].join("\n"));
		const result = analyzeComplexity("/src", "/src", analyzerDeps());
		// 1 base + 2 case clauses (default is DefaultClause, not CaseClause)
		expect(result.functions[0].complexity).toBe(3);
	});

	it("counts ternary expression as a decision point", () => {
		setupSingleFile("ternary.ts", `function abs(x: number) { return x > 0 ? x : -x; }`);
		const result = analyzeComplexity("/src", "/src", analyzerDeps());
		expect(result.functions[0].complexity).toBe(2);
	});

	it("counts logical operators as decision points", () => {
		setupSingleFile("logical.ts", `function check(a: boolean, b: boolean) { return a && b || false; }`);
		const result = analyzeComplexity("/src", "/src", analyzerDeps());
		// 1 base + 1 && + 1 ||
		expect(result.functions[0].complexity).toBe(3);
	});

	it("counts nullish coalescing as a decision point", () => {
		setupSingleFile("nullish.ts", `function fallback(x: string | null) { return x ?? "default"; }`);
		const result = analyzeComplexity("/src", "/src", analyzerDeps());
		expect(result.functions[0].complexity).toBe(2);
	});

	it("counts catch clause as a decision point", () => {
		setupSingleFile("catch.ts", `function safe() { try { throw 1; } catch (e) { return null; } }`);
		const result = analyzeComplexity("/src", "/src", analyzerDeps());
		expect(result.functions[0].complexity).toBe(2);
	});

	it("handles multiple functions in one file", () => {
		setupSingleFile("multi.ts", [
			"function a() { return 1; }",
			"function b(x: number) { if (x) { return x; } return 0; }",
		].join("\n"));
		const result = analyzeComplexity("/src", "/src", analyzerDeps());
		expect(result.functions).toHaveLength(2);
		// a has complexity 1, b has complexity 2
		// functions are sorted descending by complexity
		expect(result.functions[0].complexity).toBe(2);
		expect(result.functions[1].complexity).toBe(1);
	});

	it("detects arrow functions assigned to const", () => {
		setupSingleFile("arrow.ts", `const greet = () => "hello";`);
		const result = analyzeComplexity("/src", "/src", analyzerDeps());
		expect(result.functions).toHaveLength(1);
		expect(result.functions[0].functionName).toBe("greet");
	});

	it("detects method declarations", () => {
		setupSingleFile("method.ts", [
			"class Foo {",
			"  bar() { return 1; }",
			"}",
		].join("\n"));
		const result = analyzeComplexity("/src", "/src", analyzerDeps());
		expect(result.functions).toHaveLength(1);
		expect(result.functions[0].functionName).toBe("bar");
	});

	it("detects constructor with class name", () => {
		setupSingleFile("ctor.ts", [
			"class MyService {",
			"  constructor() {}",
			"}",
		].join("\n"));
		const result = analyzeComplexity("/src", "/src", analyzerDeps());
		expect(result.functions).toHaveLength(1);
		expect(result.functions[0].functionName).toBe("MyService.constructor");
	});

	it("detects getter and setter", () => {
		setupSingleFile("accessor.ts", [
			"class Foo {",
			"  private _x = 0;",
			"  get x() { return this._x; }",
			"  set x(v: number) { this._x = v; }",
			"}",
		].join("\n"));
		const result = analyzeComplexity("/src", "/src", analyzerDeps());
		expect(result.functions).toHaveLength(2);
		const names = result.functions.map((f) => f.functionName).sort();
		expect(names).toEqual(["get x", "set x"]);
	});

	it("computes summary statistics", () => {
		setupSingleFile("stats.ts", [
			"function a() { return 1; }",
			"function b(x: number) { if (x > 0) { if (x > 10) { return 'big'; } return 'small'; } return 'neg'; }",
		].join("\n"));
		const result = analyzeComplexity("/src", "/src", analyzerDeps());
		expect(result.summary.totalFunctions).toBe(2);
		expect(result.summary.maxComplexity).toBe(3); // b: 1 base + 2 ifs
		expect(result.summary.totalComplexity).toBe(4); // 1 + 3
	});

	it("populates file analysis with decision points", () => {
		setupSingleFile("dp.ts", `function check(x: number) { if (x > 0) { for (let i = 0; i < x; i++) {} } }`);
		const result = analyzeComplexity("/src", "/src", analyzerDeps());
		expect(result.files).toHaveLength(1);
		const file = result.files[0];
		expect(file.decisionPointCount).toBe(2); // if + for
		expect(file.decisionPoints).toHaveLength(2);
		expect(file.decisionPoints[0].type).toBe("IfStatement");
		expect(file.decisionPoints[1].type).toBe("ForStatement");
	});

	it("computes decision point line ranges", () => {
		setupSingleFile("ranges.ts", [
			"function check(x: number) {",
			"  if (x > 0) {",
			"    if (x > 10) {",
			"      return 'big';",
			"    }",
			"  }",
			"}",
		].join("\n"));
		const result = analyzeComplexity("/src", "/src", analyzerDeps());
		const file = result.files[0];
		expect(file.decisionPointLines).toHaveLength(2);
		expect(file.decisionPointLineRanges.length).toBeGreaterThan(0);
	});

	it("handles complex nested structures", () => {
		setupSingleFile("nested.ts", [
			"function process(items: any[]) {",
			"  for (const item of items) {",
			"    if (item.type === 'a') {",
			"      while (item.retries > 0) {",
			"        try {",
			"          item.run();",
			"        } catch (e) {",
			"          item.retries--;",
			"        }",
			"      }",
			"    }",
			"  }",
			"}",
		].join("\n"));
		const result = analyzeComplexity("/src", "/src", analyzerDeps());
		// 1 base + for-of + if + while + catch = 5
		expect(result.functions[0].complexity).toBe(5);
	});

	it("uses relative paths in output", () => {
		mockReaddirSync.mockReturnValue([
			{ name: "main.ts", isFile: () => true, isDirectory: () => false },
		] as any);
		mockReadFileSync.mockReturnValue("function x() {}");
		const result = analyzeComplexity("/project/src", "/project", analyzerDeps());
		expect(result.functions[0].file).toBe("src/main.ts");
	});
});
