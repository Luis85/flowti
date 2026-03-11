import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/infrastructure/config.js", () => ({
	CLI_PROJECT: "/project",
}));
vi.mock("../../../src/domain/reports/cli/complexity-analyzer.js", () => ({
	analyzeComplexity: vi.fn(() => ({
		summary: { totalFunctions: 5 },
		functions: [],
		files: [],
	})),
}));
vi.mock("../../../src/domain/project/project-config.js", () => ({
	readProjectConfig: vi.fn(() => ({ config: { reports: { dir: "reports" } } })),
}));

import { generateAnalysisData } from "../../../src/domain/devtools/run-analysis.js";
import { analyzeComplexity } from "../../../src/domain/reports/cli/complexity-analyzer.js";

// ── Inline deps factory ──────────────────────────────────────────────

function makeDeps(existingFiles: Record<string, string> = {}) {
	const written: Record<string, string> = {};
	return {
		disk: {
			existsSync: vi.fn((p: string) => p in existingFiles),
			readFileSync: vi.fn((p: string) => existingFiles[p] ?? ""),
			writeFileSync: vi.fn((p: string, content: string) => { written[p] = content; }),
			mkdirSync: vi.fn(),
			readdirSync: vi.fn(() => []),
		} as any,
		paths: {
			join: (...args: string[]) => args.join("/"),
			relative: (from: string, to: string) => to.replace(from + "/", ""),
		} as any,
		log: vi.fn(),
		written,
	};
}

// ── Coverage fixture ─────────────────────────────────────────────────

const coverageData = {
	"/project/src/main.ts": {
		s: { "0": 1, "1": 0 },
		b: { "0": [1, 0] },
		f: { "0": 1 },
		statementMap: {
			"0": { start: { line: 1 }, end: { line: 1 } },
			"1": { start: { line: 5 }, end: { line: 5 } },
		},
	},
};

const complexityWithDecisionPoints = {
	summary: { totalFunctions: 2 },
	functions: [],
	files: [{
		file: "src/main.ts",
		decisionPointCount: 3,
		decisionPoints: [{ line: 5, type: "if", functionLine: 1 }],
		decisionPointLines: [5],
		decisionPointLineRanges: ["5"],
	}],
};

beforeEach(() => {
	vi.clearAllMocks();
	vi.mocked(analyzeComplexity).mockReturnValue({
		summary: { totalFunctions: 5 },
		functions: [],
		files: [],
	} as any);
});

// ── generateAnalysisData ─────────────────────────────────────────────

describe("generateAnalysisData", () => {
	it("generates analysis.json without coverage data when coverage-final.json is absent", () => {
		const { disk, paths, log, written } = makeDeps();

		generateAnalysisData("/project", "reports", { disk, paths, log });

		const analysisKey = Object.keys(written).find((k) => k.endsWith("analysis.json"));
		expect(analysisKey).toBeDefined();
		const analysis = JSON.parse(written[analysisKey!]);
		expect(analysis).toHaveProperty("summary");
		expect(analysis).toHaveProperty("files");
	});

	it("does not write coverage-summary.json when coverage-final.json is absent", () => {
		const { disk, paths, log, written } = makeDeps();

		generateAnalysisData("/project", "reports", { disk, paths, log });

		const coverageSummaryKey = Object.keys(written).find((k) => k.endsWith("coverage-summary.json"));
		expect(coverageSummaryKey).toBeUndefined();
	});

	it("generates analysis.json with coverage data when coverage-final.json exists", () => {
		vi.mocked(analyzeComplexity).mockReturnValue(complexityWithDecisionPoints as any);
		const coverageFinalPath = "/project/reports/coverage-final.json";
		const { disk, paths, log, written } = makeDeps({
			[coverageFinalPath]: JSON.stringify(coverageData),
		});

		generateAnalysisData("/project", "reports", { disk, paths, log });

		const analysisKey = Object.keys(written).find((k) => k.endsWith("analysis.json"));
		expect(analysisKey).toBeDefined();
		const analysis = JSON.parse(written[analysisKey!]);
		expect(analysis).toHaveProperty("summary");
		expect(analysis.summary).toHaveProperty("statements");
		expect(analysis.summary).toHaveProperty("branches");
	});

	it("writes complexity-functions.json and decision-points-summary.json", () => {
		const { disk, paths, log, written } = makeDeps();

		generateAnalysisData("/project", "reports", { disk, paths, log });

		const functionsKey = Object.keys(written).find((k) => k.endsWith("complexity-functions.json"));
		const dpKey = Object.keys(written).find((k) => k.endsWith("decision-points-summary.json"));
		expect(functionsKey).toBeDefined();
		expect(dpKey).toBeDefined();
	});

	it("complexity-functions.json contains summary and functions array", () => {
		const { disk, paths, log, written } = makeDeps();

		generateAnalysisData("/project", "reports", { disk, paths, log });

		const functionsKey = Object.keys(written).find((k) => k.endsWith("complexity-functions.json"));
		const parsed = JSON.parse(written[functionsKey!]);
		expect(parsed).toHaveProperty("summary");
		expect(parsed).toHaveProperty("functions");
		expect(Array.isArray(parsed.functions)).toBe(true);
	});

	it("decision-points-summary.json contains totalDecisionPoints in summary", () => {
		vi.mocked(analyzeComplexity).mockReturnValue(complexityWithDecisionPoints as any);
		const { disk, paths, log, written } = makeDeps();

		generateAnalysisData("/project", "reports", { disk, paths, log });

		const dpKey = Object.keys(written).find((k) => k.endsWith("decision-points-summary.json"));
		const parsed = JSON.parse(written[dpKey!]);
		expect(parsed.summary).toHaveProperty("totalDecisionPoints");
		expect(parsed.summary).toHaveProperty("filesWithDecisionPoints");
		expect(parsed.summary.totalDecisionPoints).toBe(3);
	});

	it("merges coverage and complexity data in analysis.json", () => {
		vi.mocked(analyzeComplexity).mockReturnValue(complexityWithDecisionPoints as any);
		const coverageFinalPath = "/project/reports/coverage-final.json";
		const { disk, paths, log, written } = makeDeps({
			[coverageFinalPath]: JSON.stringify(coverageData),
		});

		generateAnalysisData("/project", "reports", { disk, paths, log });

		const analysisKey = Object.keys(written).find((k) => k.endsWith("analysis.json"));
		const analysis = JSON.parse(written[analysisKey!]);

		// Should have coverage summary fields
		expect(analysis.summary).toHaveProperty("statements");
		expect(analysis.summary).toHaveProperty("branches");
		// Should have complexity summary fields
		expect(analysis.summary).toHaveProperty("totalDecisionPoints");
		expect(analysis.summary).toHaveProperty("filesWithDecisionPoints");
		// File entry should contain both coverage and complexity fields
		const mainFile = analysis.files.find((f: { file: string }) => f.file === "src/main.ts");
		expect(mainFile).toBeDefined();
		expect(mainFile).toHaveProperty("statements");
		expect(mainFile).toHaveProperty("decisionPointCount");
		expect(mainFile).toHaveProperty("decisionPoints");
	});

	it("calls analyzeComplexity with correct srcDir", () => {
		const { disk, paths, log } = makeDeps();

		generateAnalysisData("/project", "reports", { disk, paths, log });

		expect(analyzeComplexity).toHaveBeenCalledWith(
			"/project/src",
			"/project",
			expect.objectContaining({ disk, paths, log }),
		);
	});

	it("analysis.json summary includes totalDecisionPoints aggregated from files", () => {
		vi.mocked(analyzeComplexity).mockReturnValue({
			summary: { totalFunctions: 3 },
			functions: [],
			files: [
				{
					file: "src/a.ts",
					decisionPointCount: 4,
					decisionPoints: [],
					decisionPointLines: [],
					decisionPointLineRanges: [],
				},
				{
					file: "src/b.ts",
					decisionPointCount: 2,
					decisionPoints: [],
					decisionPointLines: [],
					decisionPointLineRanges: [],
				},
			],
		} as any);
		const { disk, paths, log, written } = makeDeps();

		generateAnalysisData("/project", "reports", { disk, paths, log });

		const analysisKey = Object.keys(written).find((k) => k.endsWith("analysis.json"));
		const analysis = JSON.parse(written[analysisKey!]);
		expect(analysis.summary.totalDecisionPoints).toBe(6);
		expect(analysis.summary.filesWithDecisionPoints).toBe(2);
	});

	it("analysis.json files list includes all files from complexity result", () => {
		vi.mocked(analyzeComplexity).mockReturnValue({
			summary: { totalFunctions: 2 },
			functions: [],
			files: [
				{
					file: "src/a.ts",
					decisionPointCount: 1,
					decisionPoints: [],
					decisionPointLines: [],
					decisionPointLineRanges: [],
				},
				{
					file: "src/b.ts",
					decisionPointCount: 0,
					decisionPoints: [],
					decisionPointLines: [],
					decisionPointLineRanges: [],
				},
			],
		} as any);
		const { disk, paths, log, written } = makeDeps();

		generateAnalysisData("/project", "reports", { disk, paths, log });

		const analysisKey = Object.keys(written).find((k) => k.endsWith("analysis.json"));
		const analysis = JSON.parse(written[analysisKey!]);
		const fileNames = analysis.files.map((f: { file: string }) => f.file);
		expect(fileNames).toContain("src/a.ts");
		expect(fileNames).toContain("src/b.ts");
	});

	it("uncoveredDecisionPoints identifies decision points on uncovered lines", () => {
		vi.mocked(analyzeComplexity).mockReturnValue(complexityWithDecisionPoints as any);
		const coverageFinalPath = "/project/reports/coverage-final.json";
		const { disk, paths, log, written } = makeDeps({
			[coverageFinalPath]: JSON.stringify(coverageData),
		});

		generateAnalysisData("/project", "reports", { disk, paths, log });

		const analysisKey = Object.keys(written).find((k) => k.endsWith("analysis.json"));
		const analysis = JSON.parse(written[analysisKey!]);
		const mainFile = analysis.files.find((f: { file: string }) => f.file === "src/main.ts");
		expect(mainFile).toHaveProperty("uncoveredDecisionPoints");
		// Line 5 is uncovered (s["1"] === 0), and there's a decision point at line 5
		expect(mainFile.uncoveredDecisionPoints).toHaveLength(1);
		expect(mainFile.uncoveredDecisionPoints[0].line).toBe(5);
	});

	it("writes coverage-summary.json when coverage-final.json exists", () => {
		const coverageFinalPath = "/project/reports/coverage-final.json";
		const { disk, paths, log, written } = makeDeps({
			[coverageFinalPath]: JSON.stringify(coverageData),
		});

		generateAnalysisData("/project", "reports", { disk, paths, log });

		const coverageSummaryKey = Object.keys(written).find((k) => k.endsWith("coverage-summary.json"));
		expect(coverageSummaryKey).toBeDefined();
		const parsed = JSON.parse(written[coverageSummaryKey!]);
		expect(parsed).toHaveProperty("summary");
		expect(parsed).toHaveProperty("files");
	});

	it("logs a message after writing analysis.json", () => {
		const { disk, paths, log } = makeDeps();

		generateAnalysisData("/project", "reports", { disk, paths, log });

		const calls = (log as ReturnType<typeof vi.fn>).mock.calls.flat().join(" ");
		expect(calls).toContain("analysis.json");
	});
});
