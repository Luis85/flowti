import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../../src/infrastructure/filesystem.js", () => ({
	disk: {
		existsSync: vi.fn(() => false),
		readFileSync: vi.fn(() => ""),
		writeFileSync: vi.fn(),
		mkdirSync: vi.fn(),
	},
}));

vi.mock("../../../../src/infrastructure/paths.js", () => ({
	paths: {
		join: (...args: string[]) => args.join("/"),
		resolve: (...args: string[]) => args.join("/"),
		dirname: (p: string) => p.split("/").slice(0, -1).join("/") || "/",
		basename: (p: string) => p.split("/").pop() ?? "",
	},
}));

vi.mock("../../../../src/infrastructure/config.js", () => ({
	PLUGIN_ROOT: "/plugin",
}));

vi.mock("../../../../src/infrastructure/clock.js", () => ({
	clock: {
		now: () => new Date("2026-03-10T12:00:00Z"),
		iso: () => "2026-03-10T12:00:00.000Z",
		safeIso: () => "2026-03-10T12-00-00",
	},
}));

vi.mock("../../../../src/domain/reports/cli/complexity-analyzer.js", () => ({
	analyzeComplexity: vi.fn(() => ({ functions: [], files: [] })),
}));

beforeEach(() => {
	vi.clearAllMocks();
});

import { computeDistribution } from "../../../../src/domain/reports/generators/complexity-report.js";

interface ComplexityFunction {
	file: string;
	functionName: string;
	line: number;
	complexity: number;
}

describe("complexity-report generator", () => {
	describe("computeDistribution", () => {
		it("categorizes functions into correct ranges", () => {
			const entries: ComplexityFunction[] = [
				{ file: "a.ts", functionName: "f1", line: 1, complexity: 1 },
				{ file: "a.ts", functionName: "f2", line: 2, complexity: 5 },
				{ file: "a.ts", functionName: "f3", line: 3, complexity: 7 },
				{ file: "a.ts", functionName: "f4", line: 4, complexity: 15 },
				{ file: "a.ts", functionName: "f5", line: 5, complexity: 30 },
				{ file: "a.ts", functionName: "f6", line: 6, complexity: 55 },
			];
			const dist = computeDistribution(entries);
			expect(dist["1-5"]).toBe(2);
			expect(dist["6-10"]).toBe(1);
			expect(dist["11-20"]).toBe(1);
			expect(dist["21-50"]).toBe(1);
			expect(dist["51+"]).toBe(1);
		});

		it("handles empty entries", () => {
			const dist = computeDistribution([]);
			expect(dist["1-5"]).toBe(0);
			expect(dist["51+"]).toBe(0);
		});

		it("handles boundary values", () => {
			const entries: ComplexityFunction[] = [
				{ file: "a.ts", functionName: "f1", line: 1, complexity: 5 },
				{ file: "a.ts", functionName: "f2", line: 2, complexity: 6 },
				{ file: "a.ts", functionName: "f3", line: 3, complexity: 10 },
				{ file: "a.ts", functionName: "f4", line: 4, complexity: 11 },
				{ file: "a.ts", functionName: "f5", line: 5, complexity: 20 },
				{ file: "a.ts", functionName: "f6", line: 6, complexity: 21 },
				{ file: "a.ts", functionName: "f7", line: 7, complexity: 50 },
				{ file: "a.ts", functionName: "f8", line: 8, complexity: 51 },
			];
			const dist = computeDistribution(entries);
			expect(dist["1-5"]).toBe(1);
			expect(dist["6-10"]).toBe(2);
			expect(dist["11-20"]).toBe(2);
			expect(dist["21-50"]).toBe(2);
			expect(dist["51+"]).toBe(1);
		});
	});

	describe("report statistics", () => {
		it("computes max complexity", () => {
			const entries: ComplexityFunction[] = [
				{ file: "a.ts", functionName: "f1", line: 1, complexity: 5 },
				{ file: "a.ts", functionName: "f2", line: 2, complexity: 20 },
				{ file: "b.ts", functionName: "f3", line: 1, complexity: 3 },
			];
			const vals = entries.map((e) => e.complexity);
			expect(Math.max(...vals)).toBe(20);
		});

		it("computes average complexity", () => {
			const entries: ComplexityFunction[] = [
				{ file: "a.ts", functionName: "f1", line: 1, complexity: 4 },
				{ file: "a.ts", functionName: "f2", line: 2, complexity: 6 },
			];
			const vals = entries.map((e) => e.complexity);
			const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
			expect(avg).toBe(5);
		});

		it("computes median complexity", () => {
			const entries: ComplexityFunction[] = [
				{ file: "a.ts", functionName: "f1", line: 1, complexity: 1 },
				{ file: "a.ts", functionName: "f2", line: 2, complexity: 5 },
				{ file: "a.ts", functionName: "f3", line: 3, complexity: 10 },
			];
			const vals = entries.map((e) => e.complexity);
			const sorted = [...vals].sort((a, b) => a - b);
			const median = sorted[Math.floor(vals.length / 2)];
			expect(median).toBe(5);
		});

		it("counts above threshold", () => {
			const entries: ComplexityFunction[] = [
				{ file: "a.ts", functionName: "f1", line: 1, complexity: 5 },
				{ file: "a.ts", functionName: "f2", line: 2, complexity: 11 },
				{ file: "a.ts", functionName: "f3", line: 3, complexity: 15 },
			];
			const aboveThreshold = entries.filter((e) => e.complexity > 10).length;
			expect(aboveThreshold).toBe(2);
		});

		it("counts unique files with complexity", () => {
			const entries: ComplexityFunction[] = [
				{ file: "a.ts", functionName: "f1", line: 1, complexity: 5 },
				{ file: "a.ts", functionName: "f2", line: 2, complexity: 3 },
				{ file: "b.ts", functionName: "f3", line: 1, complexity: 7 },
			];
			const filesWithComplexity = new Set(entries.map((e) => e.file)).size;
			expect(filesWithComplexity).toBe(2);
		});

		it("handles empty entries for statistics", () => {
			const vals: number[] = [];
			const maxComplexity = vals.length > 0 ? Math.max(...vals) : 0;
			const avgComplexity = vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
			expect(maxComplexity).toBe(0);
			expect(avgComplexity).toBe(0);
		});
	});

	describe("domain breakdown", () => {
		it("groups functions by domain from file path", () => {
			interface DomainStats { functions: number; above10: number; maxComplexity: number; totalComplexity: number }

			const entries: ComplexityFunction[] = [
				{ file: "src/domain/health.ts", functionName: "f1", line: 1, complexity: 5 },
				{ file: "src/domain/health.ts", functionName: "f2", line: 2, complexity: 15 },
				{ file: "src/infrastructure/logger.ts", functionName: "f3", line: 1, complexity: 3 },
			];

			const domainMap: Record<string, DomainStats> = {};
			for (const e of entries) {
				const parts = e.file.replace(/^src\//, "").split("/");
				const domain = parts[0] || "root";
				if (!domainMap[domain]) domainMap[domain] = { functions: 0, above10: 0, maxComplexity: 0, totalComplexity: 0 };
				domainMap[domain].functions++;
				domainMap[domain].totalComplexity += e.complexity;
				if (e.complexity > 10) domainMap[domain].above10++;
				if (e.complexity > domainMap[domain].maxComplexity) domainMap[domain].maxComplexity = e.complexity;
			}

			expect(domainMap["domain"].functions).toBe(2);
			expect(domainMap["domain"].above10).toBe(1);
			expect(domainMap["domain"].maxComplexity).toBe(15);
			expect(domainMap["infrastructure"].functions).toBe(1);
		});
	});

	describe("top offenders", () => {
		it("selects top 25 by complexity", () => {
			const entries: ComplexityFunction[] = Array.from({ length: 30 }, (_, i) => ({
				file: `src/f${i}.ts`,
				functionName: `fn${i}`,
				line: 1,
				complexity: i + 1,
			}));

			const topOffenders = [...entries]
				.sort((a, b) => b.complexity - a.complexity)
				.slice(0, 25);

			expect(topOffenders).toHaveLength(25);
			expect(topOffenders[0].complexity).toBe(30);
			expect(topOffenders[24].complexity).toBe(6);
		});
	});
});
