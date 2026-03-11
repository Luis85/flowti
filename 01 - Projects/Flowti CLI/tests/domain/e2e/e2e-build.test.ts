import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/infrastructure/filesystem.js", () => ({
	disk: {
		existsSync: vi.fn(() => false),
		readFileSync: vi.fn(() => "{}"),
		readdirSync: vi.fn(() => []),
		mkdirSync: vi.fn(),
		writeFileSync: vi.fn(),
		copyFileSync: vi.fn(),
	},
}));

vi.mock("../../../src/infrastructure/paths.js", () => ({
	paths: {
		join: (...args: string[]) => args.join("/"),
		resolve: (...args: string[]) => args.join("/"),
		dirname: (p: string) => p.split("/").slice(0, -1).join("/"),
		basename: (p: string) => p.split("/").pop(),
	},
}));

vi.mock("../../../src/infrastructure/shell.js", () => ({
	shell: { run: vi.fn(() => 0), runSilent: vi.fn(() => null) },
}));

vi.mock("../../../src/infrastructure/logger.js", () => ({
	log: vi.fn(),
}));

vi.mock("../../../src/infrastructure/frontmatter.js", () => ({
	parseFrontmatterContent: vi.fn(() => ({})),
}));

vi.mock("../../../src/infrastructure/pipeline/pipeline-runner.js", () => ({
	runPipeline: vi.fn(async () => ({ passed: 1, failed: 0, skipped: 0 })),
}));

vi.mock("../../../src/domain/e2e/pipelines/increment-pipeline.js", () => ({
	buildIncrementPipeline: vi.fn(() => []),
}));

vi.mock("../../../src/domain/e2e/pipelines/publish-pipeline.js", () => ({
	buildPublishPipeline: vi.fn(() => []),
}));

vi.mock("../../../src/infrastructure/clock.js", () => ({
	clock: { now: () => new Date(), iso: () => "2026-03-08", safeIso: () => "2026-03-08T12-00-00" },
}));

import { disk } from "../../../src/infrastructure/filesystem.js";
import { paths } from "../../../src/infrastructure/paths.js";
import { shell } from "../../../src/infrastructure/shell.js";
import { log as logFn } from "../../../src/infrastructure/logger.js";
import { clock } from "../../../src/infrastructure/clock.js";
import { parseFrontmatterContent } from "../../../src/infrastructure/frontmatter.js";
import { runPipeline } from "../../../src/infrastructure/pipeline/pipeline-runner.js";
import {
	readTestStats,
	readBuildStats,
	collectReportSources,
	quickBuildAndDeploy,
	runIncrementBuild,
	runPublish,
} from "../../../src/domain/e2e/e2e-build.js";
import type { E2EPaths } from "../../../src/domain/e2e/e2e-paths.js";

const buildDeps = { disk, paths, shell, clock, log: logFn } as any;

const mockE2e: E2EPaths = {
	projectRoot: "/project",
	pluginId: "flowti-ibde",
	journeysDir: "/project/tests/e2e/journeys",
	testVault: "/vault-e2e",
	vaultName: "vault-e2e",
	pluginDir: "/vault-e2e/.obsidian/plugins/flowti-ibde",
	dataJsonPath: "/vault-e2e/.obsidian/plugins/flowti-ibde/data.json",
	pluginArtifacts: ["main.js", "manifest.json", "styles.css"],
	testDataCsv: "/vault-e2e/data.csv",
	reportsDir: "/project/docs/reports",
	devRunsDir: "/project/docs/reports/e2e/runs",
	devTracesDir: "/project/docs/reports/e2e/traces",
	devJourneysDir: "/project/docs/journeys",
	vitestResults: "/project/docs/reports/e2e/e2e-results.json",
	dataJsonCandidates: [],
};

beforeEach(() => {
	vi.clearAllMocks();
});

// ── readTestStats ────────────────────────────────────────────────────

describe("readTestStats", () => {
	it("returns zeros when report file does not exist", () => {
		vi.mocked(disk.existsSync).mockReturnValue(false);
		const stats = readTestStats(mockE2e, buildDeps);
		expect(stats).toEqual({ totalTests: 0, passed: 0, failed: 0, skipped: 0 });
	});

	it("parses vitest JSON format (numTotalTests)", () => {
		vi.mocked(disk.existsSync).mockReturnValue(true);
		vi.mocked(disk.readFileSync).mockReturnValue(JSON.stringify({
			numTotalTests: 100,
			numPassedTests: 95,
			numFailedTests: 3,
			numPendingTests: 2,
		}));

		const stats = readTestStats(mockE2e, buildDeps);
		expect(stats).toEqual({ totalTests: 100, passed: 95, failed: 3, skipped: 2 });
	});

	it("parses testResults array format", () => {
		vi.mocked(disk.existsSync).mockReturnValue(true);
		vi.mocked(disk.readFileSync).mockReturnValue(JSON.stringify({
			testResults: [
				{
					assertionResults: [
						{ status: "passed" },
						{ status: "passed" },
						{ status: "failed" },
					],
				},
				{
					assertionResults: [
						{ status: "passed" },
						{ status: "skipped" },
					],
				},
			],
		}));

		const stats = readTestStats(mockE2e, buildDeps);
		expect(stats).toEqual({ totalTests: 5, passed: 3, failed: 1, skipped: 1 });
	});

	it("skips suites without assertionResults", () => {
		vi.mocked(disk.existsSync).mockReturnValue(true);
		vi.mocked(disk.readFileSync).mockReturnValue(JSON.stringify({
			testResults: [
				{ name: "no-results" },
				{ assertionResults: [{ status: "passed" }] },
			],
		}));

		const stats = readTestStats(mockE2e, buildDeps);
		expect(stats).toEqual({ totalTests: 1, passed: 1, failed: 0, skipped: 0 });
	});

	it("returns zeros on malformed JSON", () => {
		vi.mocked(disk.existsSync).mockReturnValue(true);
		vi.mocked(disk.readFileSync).mockReturnValue("not json");

		const stats = readTestStats(mockE2e, buildDeps);
		expect(stats).toEqual({ totalTests: 0, passed: 0, failed: 0, skipped: 0 });
	});

	it("returns zeros for empty report object", () => {
		vi.mocked(disk.existsSync).mockReturnValue(true);
		vi.mocked(disk.readFileSync).mockReturnValue("{}");

		const stats = readTestStats(mockE2e, buildDeps);
		expect(stats).toEqual({ totalTests: 0, passed: 0, failed: 0, skipped: 0 });
	});
});

// ── readBuildStats ───────────────────────────────────────────────────

describe("readBuildStats", () => {
	it("returns null stats when no report files exist", () => {
		vi.mocked(disk.readdirSync).mockImplementation(() => { throw new Error("ENOENT"); });
		vi.mocked(disk.existsSync).mockReturnValue(false);

		const stats = readBuildStats(mockE2e, buildDeps);
		expect(stats.build).toBeNull();
		expect(stats.test).toBeNull();
		expect(stats.coverage).toBeNull();
		expect(stats.performance).toBeNull();
		expect(stats.cycle).toBeNull();
		expect(stats.e2e).toBeNull();
		expect(stats.traceability).toBeNull();
	});

	it("reads frontmatter from latest report files", () => {
		vi.mocked(disk.readdirSync).mockReturnValue(["2026-03-01.md", "2026-03-08.md"] as unknown as ReturnType<typeof disk.readdirSync>);
		vi.mocked(disk.existsSync).mockReturnValue(false);
		vi.mocked(parseFrontmatterContent).mockReturnValue({ plugin_version: "1.0.0" });

		const stats = readBuildStats(mockE2e, buildDeps);
		// Latest file (reverse sorted) should be used
		expect(stats.build).toEqual({ plugin_version: "1.0.0" });
	});

	it("reads stable e2e and traceability reports when they exist", () => {
		vi.mocked(disk.readdirSync).mockImplementation(() => { throw new Error("ENOENT"); });
		vi.mocked(disk.existsSync).mockImplementation((p: string) =>
			p.includes("E2E Report") || p.includes("Trace Conformance"),
		);
		vi.mocked(parseFrontmatterContent).mockReturnValue({ total_tests: 50 });

		const stats = readBuildStats(mockE2e, buildDeps);
		expect(stats.e2e).toEqual({ total_tests: 50 });
		expect(stats.traceability).toEqual({ total_tests: 50 });
	});
});

// ── collectReportSources ────────────────────────────────────────────

describe("collectReportSources", () => {
	it("returns empty when no reports exist", () => {
		vi.mocked(disk.readdirSync).mockImplementation(() => { throw new Error("ENOENT"); });
		vi.mocked(disk.existsSync).mockReturnValue(false);

		const sources = collectReportSources(mockE2e, buildDeps);
		expect(Object.keys(sources)).toHaveLength(0);
	});

	it("collects timestamped and stable report sources", () => {
		vi.mocked(disk.readdirSync).mockReturnValue(["report.md"] as unknown as ReturnType<typeof disk.readdirSync>);
		vi.mocked(disk.existsSync).mockReturnValue(true);
		vi.mocked(parseFrontmatterContent).mockReturnValue({ status: "pass" });

		const sources = collectReportSources(mockE2e, buildDeps);
		expect(sources.build).toBeDefined();
		expect(sources.build.fm).toEqual({ status: "pass" });
		expect(sources.e2e).toBeDefined();
		expect(sources.traceability).toBeDefined();
	});
});

// ── quickBuildAndDeploy ─────────────────────────────────────────────

describe("quickBuildAndDeploy", () => {
	it("returns 0 on successful build and deploy", () => {
		vi.mocked(shell.run).mockReturnValue(0);
		vi.mocked(disk.existsSync).mockReturnValue(true);

		const result = quickBuildAndDeploy(mockE2e, buildDeps);
		expect(result).toBe(0);
		expect(shell.run).toHaveBeenCalledWith("node esbuild.config.mjs --production", expect.objectContaining({ cwd: "/project" }));
	});

	it("returns build exit code on failure without deploying", () => {
		vi.mocked(shell.run).mockReturnValue(1);

		const result = quickBuildAndDeploy(mockE2e, buildDeps);
		expect(result).toBe(1);
		expect(disk.copyFileSync).not.toHaveBeenCalled();
	});

	it("copies artifacts to test vault plugin dir", () => {
		vi.mocked(shell.run).mockReturnValue(0);
		vi.mocked(disk.existsSync).mockReturnValue(true);

		quickBuildAndDeploy(mockE2e, buildDeps);
		expect(disk.copyFileSync).toHaveBeenCalledTimes(3);
	});

	it("skips missing artifacts without failing", () => {
		vi.mocked(shell.run).mockReturnValue(0);
		vi.mocked(disk.existsSync).mockReturnValue(false);

		const result = quickBuildAndDeploy(mockE2e, buildDeps);
		expect(result).toBe(0);
		expect(disk.copyFileSync).not.toHaveBeenCalled();
	});

	it("handles Obsidian reload when plugin is available", () => {
		vi.mocked(shell.run).mockReturnValue(0);
		vi.mocked(disk.existsSync).mockReturnValue(true);
		vi.mocked(shell.runSilent).mockReturnValue("reloaded");

		quickBuildAndDeploy(mockE2e, buildDeps);
		expect(shell.runSilent).toHaveBeenCalledWith(expect.stringContaining("flowti-ibde"));
	});
});

// ── runIncrementBuild / runPublish (pipeline-based) ─────────────────

describe("runIncrementBuild", () => {
	it("returns 0 when pipeline has no failures", async () => {
		vi.mocked(runPipeline).mockResolvedValue({ passed: 2, failed: 0, skipped: 0 } as never);
		const result = await runIncrementBuild(mockE2e, buildDeps);
		expect(result).toBe(0);
	});

	it("returns 1 when pipeline has failures", async () => {
		vi.mocked(runPipeline).mockResolvedValue({ passed: 1, failed: 1, skipped: 0 } as never);
		const result = await runIncrementBuild(mockE2e, buildDeps);
		expect(result).toBe(1);
	});
});

describe("runPublish", () => {
	it("returns 0 when pipeline succeeds", async () => {
		vi.mocked(runPipeline).mockResolvedValue({ passed: 1, failed: 0, skipped: 0 } as never);
		const result = await runPublish(mockE2e, buildDeps);
		expect(result).toBe(0);
	});

	it("returns 1 when pipeline fails", async () => {
		vi.mocked(runPipeline).mockResolvedValue({ passed: 0, failed: 1, skipped: 0 } as never);
		const result = await runPublish(mockE2e, buildDeps);
		expect(result).toBe(1);
	});
});
