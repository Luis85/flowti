import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/ui/e2e/e2e-formatters.js", () => ({
	printPrerequisites: vi.fn(),
	printJourneyTable: vi.fn(),
	printStepTable: vi.fn(),
	printExecutionBanner: vi.fn(),
	printSessionSummary: vi.fn(),
	printIncrementSummary: vi.fn(),
	printPublishSummary: vi.fn(),
}));

import { createE2ERenderer } from "../../../src/ui/e2e/e2e-renderer-impl.js";
import {
	printPrerequisites,
	printJourneyTable,
	printStepTable,
	printExecutionBanner,
	printSessionSummary,
	printIncrementSummary,
	printPublishSummary,
} from "../../../src/ui/e2e/e2e-formatters.js";
import type { E2EPaths } from "../../../src/domain/e2e/e2e-paths.js";
import type { PrerequisiteResults, JourneyEntry, SessionConfig, TestStats, BuildStats } from "../../../src/domain/e2e/e2e-types.js";

const mockLog = vi.fn();

beforeEach(() => {
	vi.clearAllMocks();
});

describe("createE2ERenderer", () => {
	it("returns an object with all renderer methods", () => {
		const renderer = createE2ERenderer(mockLog);
		expect(renderer).toHaveProperty("prerequisites");
		expect(renderer).toHaveProperty("journeyTable");
		expect(renderer).toHaveProperty("stepTable");
		expect(renderer).toHaveProperty("executionBanner");
		expect(renderer).toHaveProperty("sessionSummary");
		expect(renderer).toHaveProperty("incrementSummary");
		expect(renderer).toHaveProperty("publishSummary");
	});

	it("returns functions for every method", () => {
		const renderer = createE2ERenderer(mockLog);
		expect(typeof renderer.prerequisites).toBe("function");
		expect(typeof renderer.journeyTable).toBe("function");
		expect(typeof renderer.stepTable).toBe("function");
		expect(typeof renderer.executionBanner).toBe("function");
		expect(typeof renderer.sessionSummary).toBe("function");
		expect(typeof renderer.incrementSummary).toBe("function");
		expect(typeof renderer.publishSummary).toBe("function");
	});
});

describe("renderer.prerequisites", () => {
	it("delegates to printPrerequisites with results, e2e, and log", () => {
		const renderer = createE2ERenderer(mockLog);
		const results: PrerequisiteResults = {
			vaultExists: true,
			artifactsPresent: true,
			missingArtifacts: [],
			cliResponsive: true,
			vaultInstalled: true,
			testDataPresent: true,
		};
		const e2e = { testVault: "/vault" } as E2EPaths;

		renderer.prerequisites(results, e2e);

		expect(printPrerequisites).toHaveBeenCalledOnce();
		expect(printPrerequisites).toHaveBeenCalledWith(results, e2e, mockLog);
	});

	it("passes failing prerequisite results through", () => {
		const renderer = createE2ERenderer(mockLog);
		const results: PrerequisiteResults = {
			vaultExists: false,
			artifactsPresent: false,
			missingArtifacts: ["main.js"],
			cliResponsive: false,
			vaultInstalled: false,
			testDataPresent: false,
		};
		const e2e = { testVault: "/missing" } as E2EPaths;

		renderer.prerequisites(results, e2e);

		expect(printPrerequisites).toHaveBeenCalledWith(results, e2e, mockLog);
	});
});

describe("renderer.journeyTable", () => {
	it("delegates to printJourneyTable with entries and log", () => {
		const renderer = createE2ERenderer(mockLog);
		const entries: JourneyEntry[] = [
			{ slug: "install", name: "Install", chapter: "1", steps: 3, description: "Install the plugin" },
			{ slug: "subscribe", name: "Subscribe", chapter: "2", steps: 5, description: "Subscribe to feeds" },
		];

		renderer.journeyTable(entries);

		expect(printJourneyTable).toHaveBeenCalledOnce();
		expect(printJourneyTable).toHaveBeenCalledWith(entries, mockLog);
	});

	it("handles empty entries array", () => {
		const renderer = createE2ERenderer(mockLog);

		renderer.journeyTable([]);

		expect(printJourneyTable).toHaveBeenCalledWith([], mockLog);
	});
});

describe("renderer.stepTable", () => {
	it("delegates to printStepTable with def, steps, and log", () => {
		const renderer = createE2ERenderer(mockLog);
		const def = { journey: "install", setup: [], teardown: [] };
		const steps = [
			{ id: "step-1", title: "Open vault" },
			{ id: "step-2", title: "Click install" },
		];

		renderer.stepTable(def, steps);

		expect(printStepTable).toHaveBeenCalledOnce();
		expect(printStepTable).toHaveBeenCalledWith(def, steps, mockLog);
	});

	it("handles empty steps array", () => {
		const renderer = createE2ERenderer(mockLog);
		const def = { journey: "empty" };

		renderer.stepTable(def, []);

		expect(printStepTable).toHaveBeenCalledWith(def, [], mockLog);
	});
});

describe("renderer.executionBanner", () => {
	it("delegates to printExecutionBanner with config, selectedNames, and log", () => {
		const renderer = createE2ERenderer(mockLog);
		const config: SessionConfig = {
			sessionName: "test-session",
			selectedSlugs: ["install"],
			includeInstaller: true,
			includePrerequisites: false,
			stepFilter: {},
		};
		const selectedNames = ["Install"];

		renderer.executionBanner(config, selectedNames);

		expect(printExecutionBanner).toHaveBeenCalledOnce();
		expect(printExecutionBanner).toHaveBeenCalledWith(config, selectedNames, mockLog);
	});

	it("passes step filters through", () => {
		const renderer = createE2ERenderer(mockLog);
		const config: SessionConfig = {
			sessionName: "filtered",
			selectedSlugs: ["install", "subscribe"],
			includeInstaller: false,
			includePrerequisites: true,
			stepFilter: { install: ["step-1", "step-3"], subscribe: "all" },
		};

		renderer.executionBanner(config, ["Install", "Subscribe"]);

		expect(printExecutionBanner).toHaveBeenCalledWith(config, ["Install", "Subscribe"], mockLog);
	});
});

describe("renderer.sessionSummary", () => {
	it("delegates to printSessionSummary with all arguments and log", () => {
		const renderer = createE2ERenderer(mockLog);
		const stats: TestStats = { totalTests: 10, passed: 8, failed: 1, skipped: 1 };
		const startTime = 1000;

		renderer.sessionSummary("my-session", ["Install", "Subscribe"], startTime, stats);

		expect(printSessionSummary).toHaveBeenCalledOnce();
		expect(printSessionSummary).toHaveBeenCalledWith("my-session", ["Install", "Subscribe"], startTime, stats, mockLog);
	});

	it("passes zero-test stats through", () => {
		const renderer = createE2ERenderer(mockLog);
		const stats: TestStats = { totalTests: 0, passed: 0, failed: 0, skipped: 0 };

		renderer.sessionSummary("empty", [], 0, stats);

		expect(printSessionSummary).toHaveBeenCalledWith("empty", [], 0, stats, mockLog);
	});
});

describe("renderer.incrementSummary", () => {
	it("delegates to printIncrementSummary with exitCode, duration, stats, and log", () => {
		const renderer = createE2ERenderer(mockLog);
		const stats: BuildStats = {
			build: { total_bytes: 102400, plugin_version: "1.0.0", warnings_count: 0 },
			test: null,
			coverage: { line_pct: 85 },
			performance: null,
			cycle: null,
			e2e: null,
			traceability: null,
			unitTests: { totalTests: 50, passed: 48, failed: 2, skipped: 0 },
		};

		renderer.incrementSummary(0, "12.5", stats);

		expect(printIncrementSummary).toHaveBeenCalledOnce();
		expect(printIncrementSummary).toHaveBeenCalledWith(0, "12.5", stats, mockLog);
	});

	it("passes non-zero exit code through", () => {
		const renderer = createE2ERenderer(mockLog);
		const stats: BuildStats = {
			build: null,
			test: null,
			coverage: null,
			performance: null,
			cycle: null,
			e2e: null,
			traceability: null,
			unitTests: { totalTests: 0, passed: 0, failed: 0, skipped: 0 },
		};

		renderer.incrementSummary(1, "5.0", stats);

		expect(printIncrementSummary).toHaveBeenCalledWith(1, "5.0", stats, mockLog);
	});
});

describe("renderer.publishSummary", () => {
	it("delegates to printPublishSummary with exitCode, duration, stats, and log", () => {
		const renderer = createE2ERenderer(mockLog);
		const stats: BuildStats = {
			build: { total_bytes: 204800, plugin_version: "2.0.0", warnings_count: 1 },
			test: null,
			coverage: { line_pct: 90 },
			performance: null,
			cycle: null,
			e2e: null,
			traceability: null,
			unitTests: { totalTests: 100, passed: 99, failed: 1, skipped: 0 },
		};

		renderer.publishSummary(0, "30.2", stats);

		expect(printPublishSummary).toHaveBeenCalledOnce();
		expect(printPublishSummary).toHaveBeenCalledWith(0, "30.2", stats, mockLog);
	});

	it("passes failure exit code through", () => {
		const renderer = createE2ERenderer(mockLog);
		const stats: BuildStats = {
			build: null,
			test: null,
			coverage: null,
			performance: null,
			cycle: null,
			e2e: null,
			traceability: null,
			unitTests: { totalTests: 0, passed: 0, failed: 0, skipped: 0 },
		};

		renderer.publishSummary(2, "0.5", stats);

		expect(printPublishSummary).toHaveBeenCalledWith(2, "0.5", stats, mockLog);
	});
});

describe("log injection", () => {
	it("each renderer instance uses its own log function", () => {
		const log1 = vi.fn();
		const log2 = vi.fn();
		const renderer1 = createE2ERenderer(log1);
		const renderer2 = createE2ERenderer(log2);

		renderer1.journeyTable([]);
		renderer2.journeyTable([]);

		const calls1 = (printJourneyTable as ReturnType<typeof vi.fn>).mock.calls;
		expect(calls1[0][1]).toBe(log1);
		expect(calls1[1][1]).toBe(log2);
	});
});
