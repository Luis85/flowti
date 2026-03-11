/**
 * health.controller.test.ts — Tests for the health controller.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const MOCK_SNAPSHOT = {
	name: "test-project",
	source: { files: 42, testFiles: 20 },
	tests: { total: 100, passed: 98, failed: 2, suites: 10 },
	coverage: { lines: 85, branches: 70, functions: 80 },
	build: { success: true, durationMs: 1200 },
	lint: { errors: 0, warnings: 3 },
	git: { branch: "main", status: "clean" },
	security: null,
	components: 5,
};

const MOCK_SCORE = {
	overall: 82,
	grade: "B",
	categories: { tests: 90, coverage: 80, build: 100, lint: 85, security: 50, git: 100 },
};

vi.mock("../../src/domain/health/health.js", () => ({
	collectHealth: vi.fn(() => MOCK_SNAPSHOT),
}));
vi.mock("../../src/domain/health/health-scoring.js", () => ({
	scoreHealth: vi.fn(() => MOCK_SCORE),
	DEFAULT_THRESHOLDS: {
		coverage: { min: 80, target: 95 },
		lint: { maxErrors: 0, maxWarnings: 10 },
		tests: { minPassed: 100 },
	},
}));
vi.mock("../../src/domain/health/health-trends.js", () => ({
	saveSnapshot: vi.fn(() => "/project/reports/health/2026-03-10.json"),
	loadHistory: vi.fn(() => [
		{ timestamp: "2026-03-09", snapshot: MOCK_SNAPSHOT, score: MOCK_SCORE },
	]),
	buildTrend: vi.fn(() => ({
		current: { timestamp: "", snapshot: MOCK_SNAPSHOT, score: MOCK_SCORE },
		previous: null,
		deltas: [{ metric: "overall", previous: 78, current: 82, delta: 4, indicator: "\u25b2" }],
	})),
}));
vi.mock("../../src/domain/health/tech-debt.js", () => ({
	estimateDebt: vi.fn(() => ({
		totalHours: 12,
		items: [
			{ area: "coverage", severity: "medium", estimateHours: 8, description: "Increase line coverage to 95%" },
			{ area: "lint", severity: "low", estimateHours: 4, description: "Fix 3 lint warnings" },
		],
	})),
}));
vi.mock("../../src/infrastructure/filesystem.js", () => ({
	disk: {
		existsSync: vi.fn(() => false),
		readFileSync: vi.fn(() => ""),
		writeFileSync: vi.fn(),
		mkdirSync: vi.fn(),
		readdirSync: vi.fn(() => []),
	},
}));
vi.mock("../../src/infrastructure/paths.js", () => ({
	paths: {
		join: (...args: string[]) => args.join("/"),
		relative: (_from: string, to: string) => to.replace("/project/", ""),
		isAbsolute: (p: string) => p.startsWith("/"),
		resolve: (...args: string[]) => args.join("/"),
	},
}));
vi.mock("../../src/infrastructure/shell.js", () => ({
	shell: { run: vi.fn(() => 0), runSilent: vi.fn(() => null), runCaptureStatus: vi.fn(() => ({ exitCode: 0, stdout: "" })) },
}));
vi.mock("../../src/infrastructure/clock.js", () => ({
	clock: { iso: () => "2026-03-10T00:00:00.000Z", now: () => new Date("2026-03-10"), ms: () => 0, safeIso: () => "" },
}));
vi.mock("../../src/infrastructure/logger.js", () => ({ log: vi.fn() }));
vi.mock("../../src/infrastructure/proc.js", () => ({
	proc: { exit: vi.fn(), argv: () => [], cwd: () => "/", env: () => ({}) },
}));
vi.mock("../../src/ui/health-display.js", () => ({
	renderHealthDashboard: vi.fn(),
	renderSnapshotSaved: vi.fn(),
	renderHealthHistory: vi.fn(),
	renderDebtEstimate: vi.fn(),
}));
vi.mock("../../src/ui/common-renderers.js", () => ({
	renderError: vi.fn(),
	renderNoProject: vi.fn(),
}));

import { commands } from "../../src/controller/health.controller.js";
import { collectHealth } from "../../src/domain/health/health.js";
import { scoreHealth } from "../../src/domain/health/health-scoring.js";
import { saveSnapshot, loadHistory, buildTrend } from "../../src/domain/health/health-trends.js";
import { estimateDebt } from "../../src/domain/health/tech-debt.js";
import { log } from "../../src/infrastructure/logger.js";

const logMock = log as ReturnType<typeof vi.fn>;

const mockProject = {
	name: "test-project",
	path: "/project",
	config: { name: "test", reports: { generators: [] }, health: {} },
	pkg: { name: "test-project", version: "1.0.0", scripts: {} },
	scripts: {},
};

describe("health.controller", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("health", () => {
		it("calls collectHealth with the project context", () => {
			commands.health({}, [], "health", mockProject);

			expect(collectHealth).toHaveBeenCalledOnce();
			expect(collectHealth).toHaveBeenCalledWith(expect.any(Object), mockProject);
		});

		it("calls scoreHealth with snapshot and thresholds", () => {
			commands.health({}, [], "health", mockProject);

			expect(scoreHealth).toHaveBeenCalledOnce();
			expect(scoreHealth).toHaveBeenCalledWith(
				MOCK_SNAPSHOT,
				expect.objectContaining({ coverage: expect.objectContaining({ min: 80 }) }),
			);
		});

		it("calls buildTrend with current and history", () => {
			commands.health({}, [], "health", mockProject);

			expect(loadHistory).toHaveBeenCalledWith(expect.any(Object), "/project");
			expect(buildTrend).toHaveBeenCalledOnce();
			expect(buildTrend).toHaveBeenCalledWith(
				expect.objectContaining({ snapshot: MOCK_SNAPSHOT, score: MOCK_SCORE }),
				expect.any(Array),
			);
		});

		it("returns HealthViewModel as JSON with score and trend", () => {
			commands.health({ format: "json" }, [], "health", mockProject);

			expect(logMock).toHaveBeenCalledOnce();
			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("score");
			expect(output.score).toHaveProperty("overall", 82);
			expect(output.score).toHaveProperty("grade", "B");
			expect(output).toHaveProperty("trend");
			expect(output.trend).toHaveLength(1);
		});

		it("returns NoProjectModel when no project is provided", () => {
			commands.health({ format: "json" }, [], "health", undefined);

			expect(collectHealth).not.toHaveBeenCalled();
			expect(logMock).toHaveBeenCalledOnce();
			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("command", "health");
		});

		it("uses project health thresholds when configured", () => {
			const projectWithThresholds = {
				...mockProject,
				config: {
					...mockProject.config,
					health: {
						thresholds: {
							coverage: { min: 90, target: 98 },
						},
					},
				},
			};

			commands.health({}, [], "health", projectWithThresholds);

			expect(scoreHealth).toHaveBeenCalledWith(
				MOCK_SNAPSHOT,
				expect.objectContaining({ coverage: { min: 90, target: 98 } }),
			);
		});
	});

	describe("health:snapshot", () => {
		it("calls saveSnapshot with project path, snapshot, and score", () => {
			commands["health:snapshot"]({}, [], "health:snapshot", mockProject);

			expect(collectHealth).toHaveBeenCalledOnce();
			expect(scoreHealth).toHaveBeenCalledOnce();
			expect(saveSnapshot).toHaveBeenCalledOnce();
			expect(saveSnapshot).toHaveBeenCalledWith(expect.any(Object), "/project", MOCK_SNAPSHOT, MOCK_SCORE);
		});

		it("returns relative path as JSON", () => {
			commands["health:snapshot"](
				{ format: "json" }, [], "health:snapshot", mockProject,
			);

			expect(logMock).toHaveBeenCalledOnce();
			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("relativePath");
		});

		it("returns NoProjectModel when no project", () => {
			commands["health:snapshot"](
				{ format: "json" }, [], "health:snapshot", undefined,
			);

			expect(saveSnapshot).not.toHaveBeenCalled();
			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("command", "health:snapshot");
		});
	});

	describe("health:history", () => {
		it("calls loadHistory with project path", () => {
			commands["health:history"]({}, [], "health:history", mockProject);

			expect(loadHistory).toHaveBeenCalledOnce();
			expect(loadHistory).toHaveBeenCalledWith(expect.any(Object), "/project");
		});

		it("returns history array as JSON", () => {
			commands["health:history"](
				{ format: "json" }, [], "health:history", mockProject,
			);

			expect(logMock).toHaveBeenCalledOnce();
			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(Array.isArray(output)).toBe(true);
			expect(output).toHaveLength(1);
			expect(output[0]).toHaveProperty("timestamp", "2026-03-09");
		});

		it("returns NoProjectModel when no project", () => {
			commands["health:history"](
				{ format: "json" }, [], "health:history", undefined,
			);

			expect(loadHistory).not.toHaveBeenCalled();
		});
	});

	describe("debt:estimate", () => {
		it("calls estimateDebt with snapshot and score", () => {
			commands["debt:estimate"]({}, [], "debt:estimate", mockProject);

			expect(collectHealth).toHaveBeenCalledOnce();
			expect(scoreHealth).toHaveBeenCalledOnce();
			expect(estimateDebt).toHaveBeenCalledOnce();
			expect(estimateDebt).toHaveBeenCalledWith(MOCK_SNAPSHOT, MOCK_SCORE);
		});

		it("returns debt estimate as JSON", () => {
			commands["debt:estimate"](
				{ format: "json" }, [], "debt:estimate", mockProject,
			);

			expect(logMock).toHaveBeenCalledOnce();
			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("totalHours", 12);
			expect(output).toHaveProperty("items");
			expect(output.items).toHaveLength(2);
		});

		it("returns NoProjectModel when no project", () => {
			commands["debt:estimate"](
				{ format: "json" }, [], "debt:estimate", undefined,
			);

			expect(estimateDebt).not.toHaveBeenCalled();
		});
	});
});
