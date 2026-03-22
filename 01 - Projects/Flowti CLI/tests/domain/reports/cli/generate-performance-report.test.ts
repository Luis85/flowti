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
	PLUGIN_ROOT: "/plugin",
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

import type { ReportDeps } from "../../../../src/infrastructure/deps.js";
import { disk } from "../../../../src/infrastructure/filesystem.js";
import { paths } from "../../../../src/infrastructure/paths.js";
import { clock } from "../../../../src/infrastructure/clock.js";
import { generatePerformanceReport } from "../../../../src/domain/reports/cli/generate-performance-report.js";

const mockShell = { run: vi.fn(() => ({ stdout: "", stderr: "", exitCode: 0, success: true })) };
const mockDeps: ReportDeps = { disk, paths, clock, shell: mockShell as any, log: () => {} };

// The two data.json candidate paths produced by the mock paths implementation:
//   resolve("/plugin", "..", "..", ".obsidian", "plugins", "flowti-ibde", "data.json")
//   → "/plugin/../../.obsidian/plugins/flowti-ibde/data.json"
//   join("/plugin", "data.json")
//   → "/plugin/data.json"
const DATA_JSON_CANDIDATE_1 = "/plugin/../../.obsidian/plugins/flowti-ibde/data.json";
const DATA_JSON_CANDIDATE_2 = "/plugin/data.json";

beforeEach(() => {
	vi.clearAllMocks();
});

describe("generatePerformanceReport", () => {
	it("returns success even when no data.json found (warns about no measurements)", () => {
		vi.mocked(disk.existsSync).mockImplementation((p: string) => {
			if (p === DATA_JSON_CANDIDATE_1 || p === DATA_JSON_CANDIDATE_2) return false;
			return true;
		});

		const result = generatePerformanceReport("/project", mockDeps);

		expect(result.success).toBe(true);
		expect(result.warnings).toBeDefined();
		expect(result.warnings!.some(w => /no startup measurements/i.test(w))).toBe(true);
	});

	it("returns success with startup metrics from valid data.json", () => {
		vi.mocked(disk.existsSync).mockReturnValue(true);
		vi.mocked(disk.readFileSync).mockReturnValue(JSON.stringify({
			perfAggregator: {
				startupHistory: [100, 200, 150, 180, 120],
			},
		}) as never);

		const result = generatePerformanceReport("/project", mockDeps);

		expect(result.success).toBe(true);
		expect(result.metrics).toEqual(expect.objectContaining({
			measurements: 5,
			startup_p50: expect.any(Number),
			startup_p95: expect.any(Number),
		}));
	});

	it("warns when no startup measurements found", () => {
		vi.mocked(disk.existsSync).mockReturnValue(true);
		vi.mocked(disk.readFileSync).mockReturnValue(JSON.stringify({
			perfAggregator: {
				startupHistory: [],
			},
		}) as never);

		const result = generatePerformanceReport("/project", mockDeps);

		expect(result.success).toBe(true);
		expect(result.warnings).toBeDefined();
		expect(result.warnings!.some(w => /no startup measurements/i.test(w))).toBe(true);
	});

	it("warns when p95 exceeds 5000ms threshold", () => {
		vi.mocked(disk.existsSync).mockReturnValue(true);
		vi.mocked(disk.readFileSync).mockReturnValue(JSON.stringify({
			perfAggregator: {
				startupHistory: [6000, 7000, 8000],
			},
		}) as never);

		const result = generatePerformanceReport("/project", mockDeps);

		expect(result.success).toBe(true);
		expect(result.warnings).toBeDefined();
		expect(result.warnings!.some(w => /5000ms threshold/i.test(w))).toBe(true);
	});

	it("has no warnings when measurements are healthy", () => {
		vi.mocked(disk.existsSync).mockReturnValue(true);
		vi.mocked(disk.readFileSync).mockReturnValue(JSON.stringify({
			perfAggregator: {
				startupHistory: [100, 200, 150, 180, 120],
			},
		}) as never);

		const result = generatePerformanceReport("/project", mockDeps);

		expect(result.success).toBe(true);
		expect(result.warnings).toBeUndefined();
	});

	it("passes pipeline context log messages", () => {
		vi.mocked(disk.existsSync).mockReturnValue(true);
		vi.mocked(disk.readFileSync).mockReturnValue(JSON.stringify({
			perfAggregator: {
				startupHistory: [100, 200, 150, 180, 120],
			},
		}) as never);

		const logFn = vi.fn();
		const ctx = {
			log: logFn,
			projectPath: "/project",
			getResults: () => [],
			pushResult: vi.fn(),
			getStepResult: vi.fn(),
			setCommandOutput: vi.fn(),
			getCommandOutput: vi.fn(),
			setStepData: vi.fn(),
			getStepData: vi.fn(),
		};

		generatePerformanceReport("/project", mockDeps, ctx as any);

		expect(logFn).toHaveBeenCalled();
	});
});
