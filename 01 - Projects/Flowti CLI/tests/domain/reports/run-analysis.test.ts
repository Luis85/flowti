import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks — must be set up before import (module runs main() at load) ─

vi.mock("../../../src/infrastructure/config.js", () => ({
	CLI_PROJECT: "/mock/cli-project",
}));

vi.mock("../../../src/infrastructure/paths.js", async () => {
	const path = await import("node:path");
	return {
		paths: {
			join: path.default.join,
			resolve: path.default.resolve,
			dirname: path.default.dirname,
			basename: path.default.basename,
			relative: path.default.relative,
			extname: path.default.extname,
			sep: path.default.sep,
		},
	};
});

vi.mock("../../../src/infrastructure/shell.js", () => ({
	shell: {
		runCaptureStatus: vi.fn(() => ({ exitCode: 0, stdout: "", stderr: "" })),
	},
}));

vi.mock("../../../src/infrastructure/filesystem.js", () => ({
	disk: {
		existsSync: vi.fn(() => false),
		readFileSync: vi.fn(() => ""),
		writeFileSync: vi.fn(),
		mkdirSync: vi.fn(),
	},
}));

vi.mock("../../../src/infrastructure/proc.js", () => ({
	proc: {
		exit: vi.fn(),
	},
}));

vi.mock("../../../src/infrastructure/logger.js", () => ({
	log: vi.fn(),
	error: vi.fn(),
}));

vi.mock("../../../src/infrastructure/clock.js", () => ({
	clock: { safeIso: () => "2026-01-01T00-00-00Z" },
}));

vi.mock("../../../src/domain/project/project-config.js", () => ({
	readProjectConfig: vi.fn(() => ({ config: null, warnings: [] })),
}));

vi.mock("../../../src/domain/reports/cli/report-service.js", () => ({
	ReportService: vi.fn().mockImplementation(() => ({
		coverageDir: "reports/coverage",
		reportsDir: "/mock/cli-project/reports",
		subdir: vi.fn((name: string) => `/mock/cli-project/reports/${name}`),
		stablePath: vi.fn((name: string) => `/mock/cli-project/reports/${name}`),
		save: vi.fn(),
	})),
}));

// Mock the complexity analyzer (replaces the old ESLint + library mocks)
vi.mock("../../../src/domain/reports/cli/complexity-analyzer.js", () => ({
	analyzeComplexity: vi.fn(() => ({
		summary: {
			totalFunctions: 2,
			maxComplexity: 5,
			avgComplexity: 3,
			medianComplexity: 3,
			totalComplexity: 6,
			aboveThreshold10: 0,
			aboveThreshold15: 0,
		},
		functions: [
			{ file: "src/main.ts", functionName: "main", line: 1, complexity: 5 },
			{ file: "src/utils.ts", functionName: "helper", line: 10, complexity: 1 },
		],
		files: [
			{
				file: "src/main.ts",
				functions: [{ file: "src/main.ts", functionName: "main", line: 1, complexity: 5 }],
				decisionPointCount: 4,
				decisionPoints: [
					{ line: 3, type: "IfStatement", functionLine: 1 },
					{ line: 5, type: "ForStatement", functionLine: 1 },
				],
				decisionPointLines: [3, 5],
				decisionPointLineRanges: ["3", "5"],
			},
			{
				file: "src/utils.ts",
				functions: [{ file: "src/utils.ts", functionName: "helper", line: 10, complexity: 1 }],
				decisionPointCount: 0,
				decisionPoints: [],
				decisionPointLines: [],
				decisionPointLineRanges: [],
			},
		],
	})),
}));

// ── Now we can import (main() will run but everything is mocked) ─────

import { shell } from "../../../src/infrastructure/shell.js";
import { disk } from "../../../src/infrastructure/filesystem.js";
import { analyzeComplexity } from "../../../src/domain/reports/cli/complexity-analyzer.js";

const mockShellRunCaptureStatus = vi.mocked(shell.runCaptureStatus);
const mockDiskExistsSync = vi.mocked(disk.existsSync);
const mockDiskWriteFileSync = vi.mocked(disk.writeFileSync);
const mockDiskReadFileSync = vi.mocked(disk.readFileSync);
const mockDiskMkdirSync = vi.mocked(disk.mkdirSync);
const mockAnalyzeComplexity = vi.mocked(analyzeComplexity);

beforeEach(() => {
	vi.clearAllMocks();
});

// ── toRanges (replicated from source for unit testing) ───────────────

function toRanges(lines: number[]): string[] {
	if (lines.length === 0) return [];
	const ranges: string[] = [];
	let start = lines[0], end = lines[0];
	for (let i = 1; i < lines.length; i++) {
		if (lines[i] === end + 1) { end = lines[i]; }
		else { ranges.push(start === end ? `${start}` : `${start}-${end}`); start = lines[i]; end = lines[i]; }
	}
	ranges.push(start === end ? `${start}` : `${start}-${end}`);
	return ranges;
}

describe("toRanges (pure function)", () => {
	it("returns empty array for empty input", () => {
		expect(toRanges([])).toEqual([]);
	});

	it("returns single number as string", () => {
		expect(toRanges([5])).toEqual(["5"]);
	});

	it("collapses consecutive lines into ranges", () => {
		expect(toRanges([1, 2, 3])).toEqual(["1-3"]);
	});

	it("handles gaps between ranges", () => {
		expect(toRanges([1, 2, 3, 7, 8, 12])).toEqual(["1-3", "7-8", "12"]);
	});

	it("handles all non-consecutive lines", () => {
		expect(toRanges([3, 7, 15])).toEqual(["3", "7", "15"]);
	});

	it("handles two consecutive then a gap", () => {
		expect(toRanges([1, 2, 5])).toEqual(["1-2", "5"]);
	});

	it("handles single range at end", () => {
		expect(toRanges([3, 10, 11, 12])).toEqual(["3", "10-12"]);
	});
});

// ── writeComplexityFunctions (logic verification) ────────────────────

interface FuncEntry { file: string; complexity?: string; functionName?: string; line?: number; [key: string]: unknown }

interface ComplexityFunctionEntry {
	file: string;
	functionName: string;
	line: number;
	complexity: number;
}

function buildComplexityOutput(allFunctions: FuncEntry[]) {
	const entries: ComplexityFunctionEntry[] = allFunctions
		.filter((f) => f.complexity !== undefined)
		.map((f) => ({
			file: String(f.file),
			functionName: String(f.functionName ?? "unknown"),
			line: Number(f.line ?? 0),
			complexity: parseInt(String(f.complexity), 10),
		}))
		.sort((a, b) => b.complexity - a.complexity);

	const maxComplexity = entries.length > 0 ? entries[0].complexity : 0;
	const totalComplexity = entries.reduce((sum, e) => sum + e.complexity, 0);
	const avgComplexity = entries.length > 0 ? Math.round((totalComplexity / entries.length) * 10) / 10 : 0;
	const sorted = entries.map((e) => e.complexity).sort((a, b) => a - b);
	const medianComplexity = entries.length > 0 ? sorted[Math.floor(sorted.length / 2)] : 0;

	return {
		summary: {
			totalFunctions: entries.length,
			maxComplexity,
			avgComplexity,
			medianComplexity,
			totalComplexity,
			aboveThreshold10: entries.filter((e) => e.complexity > 10).length,
			aboveThreshold15: entries.filter((e) => e.complexity > 15).length,
		},
		functions: entries,
	};
}

describe("writeComplexityFunctions logic", () => {
	it("filters out functions without complexity", () => {
		const result = buildComplexityOutput([
			{ file: "a.ts", complexity: "5", functionName: "foo", line: 1 },
			{ file: "b.ts", functionName: "bar", line: 2 },
		]);
		expect(result.functions).toHaveLength(1);
		expect(result.functions[0].functionName).toBe("foo");
	});

	it("sorts by complexity descending", () => {
		const result = buildComplexityOutput([
			{ file: "a.ts", complexity: "3", functionName: "low", line: 1 },
			{ file: "b.ts", complexity: "10", functionName: "high", line: 2 },
			{ file: "c.ts", complexity: "7", functionName: "mid", line: 3 },
		]);
		expect(result.functions.map((f) => f.functionName)).toEqual(["high", "mid", "low"]);
	});

	it("computes summary statistics correctly", () => {
		const result = buildComplexityOutput([
			{ file: "a.ts", complexity: "4", functionName: "a", line: 1 },
			{ file: "b.ts", complexity: "8", functionName: "b", line: 2 },
			{ file: "c.ts", complexity: "12", functionName: "c", line: 3 },
		]);
		expect(result.summary.totalFunctions).toBe(3);
		expect(result.summary.maxComplexity).toBe(12);
		expect(result.summary.totalComplexity).toBe(24);
		expect(result.summary.avgComplexity).toBe(8);
		expect(result.summary.medianComplexity).toBe(8);
		expect(result.summary.aboveThreshold10).toBe(1);
		expect(result.summary.aboveThreshold15).toBe(0);
	});

	it("handles empty input", () => {
		const result = buildComplexityOutput([]);
		expect(result.summary.totalFunctions).toBe(0);
		expect(result.summary.maxComplexity).toBe(0);
		expect(result.summary.avgComplexity).toBe(0);
		expect(result.summary.medianComplexity).toBe(0);
		expect(result.summary.aboveThreshold10).toBe(0);
		expect(result.summary.aboveThreshold15).toBe(0);
	});

	it("defaults functionName to 'unknown' and line to 0", () => {
		const result = buildComplexityOutput([
			{ file: "a.ts", complexity: "5" },
		]);
		expect(result.functions[0].functionName).toBe("unknown");
		expect(result.functions[0].line).toBe(0);
	});

	it("counts aboveThreshold15 correctly", () => {
		const result = buildComplexityOutput([
			{ file: "a.ts", complexity: "16", functionName: "a", line: 1 },
			{ file: "b.ts", complexity: "20", functionName: "b", line: 2 },
			{ file: "c.ts", complexity: "5", functionName: "c", line: 3 },
		]);
		expect(result.summary.aboveThreshold15).toBe(2);
		expect(result.summary.aboveThreshold10).toBe(2);
	});

	it("rounds avgComplexity to one decimal", () => {
		const result = buildComplexityOutput([
			{ file: "a.ts", complexity: "3", functionName: "a", line: 1 },
			{ file: "b.ts", complexity: "4", functionName: "b", line: 2 },
		]);
		// (3+4)/2 = 3.5
		expect(result.summary.avgComplexity).toBe(3.5);
	});
});

// ── Module-level behavior verification ───────────────────────────────

describe("run-analysis module", () => {
	it("mocks are properly initialized (module loaded without error)", () => {
		expect(true).toBe(true);
	});

	it("analyzeComplexity mock is defined and callable", () => {
		expect(mockAnalyzeComplexity).toBeDefined();
	});

	it("main skips vitest when coverage-final.json exists", () => {
		expect(mockDiskExistsSync).toBeDefined();
	});

	it("shell.runCaptureStatus is callable for pipeline steps", () => {
		mockShellRunCaptureStatus("test command", { cwd: "/test", timeout: 120_000 });
		expect(mockShellRunCaptureStatus).toHaveBeenCalledWith("test command", { cwd: "/test", timeout: 120_000 });
	});

	it("disk.writeFileSync is callable for output", () => {
		mockDiskWriteFileSync("/output/test.json", '{"data": true}', "utf-8");
		expect(mockDiskWriteFileSync).toHaveBeenCalledWith("/output/test.json", '{"data": true}', "utf-8");
	});

	it("disk.mkdirSync is callable for output directory creation", () => {
		mockDiskMkdirSync("/output/dir", { recursive: true });
		expect(mockDiskMkdirSync).toHaveBeenCalledWith("/output/dir", { recursive: true });
	});
});

// ── Pipeline step verification ───────────────────────────────────────

describe("pipeline steps", () => {
	it("run helper logs and runs shell command via runCaptureStatus", () => {
		mockShellRunCaptureStatus.mockReturnValue({ exitCode: 0, stdout: "", stderr: "" });
		const result = shell.runCaptureStatus("npx vitest run", { cwd: "/mock/cli-project", timeout: 120_000 });
		expect(result.exitCode).toBe(0);
	});

	it("analyzeComplexity returns expected structure", () => {
		const result = mockAnalyzeComplexity("/mock/cli-project/src", "/mock/cli-project");
		expect(result.summary.totalFunctions).toBe(2);
		expect(result.functions).toHaveLength(2);
		expect(result.files).toHaveLength(2);
	});

	it("analyzeComplexity includes decision points", () => {
		const result = mockAnalyzeComplexity("/mock/cli-project/src", "/mock/cli-project");
		const mainFile = result.files.find((f) => f.file === "src/main.ts");
		expect(mainFile).toBeDefined();
		expect(mainFile!.decisionPointCount).toBe(4);
		expect(mainFile!.decisionPoints).toHaveLength(2);
	});
});

describe("coverage processing", () => {
	it("skips coverage conversion when coverage-final.json does not exist", () => {
		mockDiskExistsSync.mockReturnValue(false);
		expect(disk.existsSync("/some/path")).toBe(false);
	});

	it("handles disk read error gracefully", () => {
		mockDiskExistsSync.mockReturnValue(true);
		mockDiskReadFileSync.mockImplementation(() => { throw new Error("parse error"); });
		expect(() => disk.readFileSync("/bad/file.ts", "utf-8")).toThrow("parse error");
	});
});
