import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../../src/infrastructure/filesystem.js", () => ({
	disk: {
		existsSync: vi.fn(() => true),
		readFileSync: vi.fn(() => "{}"),
		writeFileSync: vi.fn(),
		mkdirSync: vi.fn(),
		copyFileSync: vi.fn(),
	},
}));
vi.mock("../../../../src/infrastructure/paths.js", () => ({
	paths: {
		join: (...args: string[]) => args.join("/"),
		basename: (p: string) => p.split("/").pop() || "",
		resolve: (...args: string[]) => args.join("/"),
		dirname: (p: string) => p.split("/").slice(0, -1).join("/"),
	},
}));
vi.mock("../../../../src/infrastructure/config.js", () => ({
	CLI_PROJECT: "/project",
}));
vi.mock("../../../../src/infrastructure/clock.js", () => ({
	clock: {
		iso: () => "2026-01-01T00:00:00.000Z",
		ms: () => 1000000,
		now: () => new Date("2026-01-01T00:00:00.000Z"),
		safeIso: () => "2026-01-01T00-00-00.000Z",
	},
}));
vi.mock("../../../../src/domain/project/project-config.js", () => ({
	readProjectConfig: vi.fn(() => ({ config: { reports: { dir: "reports" }, docs: { referenceDir: "docs/reference" } } })),
}));

import { disk } from "../../../../src/infrastructure/filesystem.js";
import { generateTestReport } from "../../../../src/domain/reports/cli/generate-test-report.js";

beforeEach(() => {
	vi.clearAllMocks();
});

describe("generateTestReport", () => {
	it("returns failure when testreport.json does not exist", () => {
		vi.mocked(disk.existsSync).mockReturnValue(false);

		const result = generateTestReport("/project");

		expect(result.success).toBe(false);
		expect(result.outputPath).toBe("");
	});

	it("generates report from valid test data", () => {
		vi.mocked(disk.existsSync).mockReturnValue(true);
		vi.mocked(disk.readFileSync).mockReturnValue(JSON.stringify({
			numPassedTests: 100,
			numFailedTests: 2,
			numPendingTests: 5,
			numTotalTests: 107,
			numTotalTestSuites: 20,
			success: false,
			startTime: 999000,
		}));

		const result = generateTestReport("/project");

		expect(result.success).toBe(true);
		expect(result.outputPath).toBeTruthy();
		expect(result.metrics).toEqual(expect.objectContaining({
			total: 107,
			passed: 100,
			failed: 2,
			skipped: 5,
			suites: 20,
		}));
	});

	it("adds warning when tests failed", () => {
		vi.mocked(disk.existsSync).mockReturnValue(true);
		vi.mocked(disk.readFileSync).mockReturnValue(JSON.stringify({
			numPassedTests: 10,
			numFailedTests: 3,
			numPendingTests: 0,
			numTotalTests: 13,
			success: false,
		}));

		const result = generateTestReport("/project");

		expect(result.warnings).toBeDefined();
		expect(result.warnings![0]).toContain("3 test(s) failed");
	});

	it("has no warnings when all tests pass", () => {
		vi.mocked(disk.existsSync).mockReturnValue(true);
		vi.mocked(disk.readFileSync).mockReturnValue(JSON.stringify({
			numPassedTests: 10,
			numFailedTests: 0,
			numPendingTests: 0,
			numTotalTests: 10,
			success: true,
		}));

		const result = generateTestReport("/project");

		expect(result.warnings).toBeUndefined();
	});

	it("uses testResults array length for suite count when available", () => {
		vi.mocked(disk.existsSync).mockReturnValue(true);
		vi.mocked(disk.readFileSync).mockReturnValue(JSON.stringify({
			numPassedTests: 5,
			numFailedTests: 0,
			numPendingTests: 0,
			testResults: [
				{ name: "a.test.ts", status: "passed", assertionResults: [{ status: "passed" }] },
				{ name: "b.test.ts", status: "passed", assertionResults: [{ status: "passed" }] },
			],
			success: true,
		}));

		const result = generateTestReport("/project");

		expect(result.metrics).toEqual(expect.objectContaining({ suites: 2 }));
	});

	it("passes pipeline context log messages", () => {
		vi.mocked(disk.existsSync).mockReturnValue(true);
		vi.mocked(disk.readFileSync).mockReturnValue(JSON.stringify({
			numPassedTests: 1,
			numFailedTests: 0,
			numPendingTests: 0,
			success: true,
		}));

		const logFn = vi.fn();
		const ctx = { log: logFn, projectPath: "/project", getResults: () => [], pushResult: vi.fn(), getStepResult: vi.fn(), setCommandOutput: vi.fn(), getCommandOutput: vi.fn(), setStepData: vi.fn(), getStepData: vi.fn() };

		generateTestReport("/project", ctx as any);

		expect(logFn).toHaveBeenCalled();
	});
});
