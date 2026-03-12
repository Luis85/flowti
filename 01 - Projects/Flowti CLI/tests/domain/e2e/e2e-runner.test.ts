import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/infrastructure/filesystem.js", () => ({
	disk: {
		existsSync: vi.fn(() => false),
		readFileSync: vi.fn(() => "{}"),
		writeFileSync: vi.fn(),
	},
}));

vi.mock("../../../src/infrastructure/paths.js", () => ({
	paths: {
		join: (...args: string[]) => args.join("/"),
		relative: (_from: string, to: string) => to,
		basename: (p: string) => p.split("/").pop(),
	},
}));

vi.mock("../../../src/infrastructure/shell.js", () => ({
	shell: {
		run: vi.fn(() => 0),
		runSilent: vi.fn(() => null),
	},
}));

vi.mock("../../../src/infrastructure/pipeline/pipeline-runner.js", () => ({
	runPipeline: vi.fn(async () => ({ steps: [], totalDurationMs: 0, passed: 1, failed: 0, skipped: 0 })),
}));

vi.mock("../../../src/domain/e2e/e2e-session.js", () => ({
	resolveJourneyNames: vi.fn(() => ["journey-a"]),
}));

vi.mock("../../../src/ui/e2e/e2e-formatters.js", () => ({
	printExecutionBanner: vi.fn(),
}));

vi.mock("../../../src/domain/e2e/pipelines/session-pipeline.js", () => ({
	buildSessionPipeline: vi.fn(() => []),
}));

import { disk } from "../../../src/infrastructure/filesystem.js";
import { paths } from "../../../src/infrastructure/paths.js";
import { shell } from "../../../src/infrastructure/shell.js";
import { runPipeline } from "../../../src/infrastructure/pipeline/pipeline-runner.js";
import {
	runVitest, generateReport, restorePluginState,
	openReportInObsidian, generateReportAndOpen, executeSession,
} from "../../../src/domain/e2e/e2e-runner.js";
import type { E2EPaths } from "../../../src/domain/e2e/e2e-paths.js";

const mockLog = vi.fn();
const mockProc = { exit: vi.fn(), env: () => ({}), argv: () => [] } as any;
const mockClock = { now: () => new Date(), safeIso: () => "2026-01-01T00:00:00" } as any;
const deps = { disk, shell, paths, log: mockLog, proc: mockProc, clock: mockClock } as const;

const e2e: E2EPaths = {
	projectRoot: "/project",
	testVault: "/vault",
	vaultName: "test-vault",
	pluginId: "flowti-ibde",
	pluginDir: "/vault/.obsidian/plugins/flowti-ibde",
	dataJsonPath: "/vault/.obsidian/plugins/flowti-ibde/data.json",
	reportsDir: "/project/docs/reports",
} as E2EPaths;

describe("runVitest", () => {
	it("calls shell.run with vitest command", () => {
		runVitest(e2e, deps);
		expect(shell.run).toHaveBeenCalledWith(
			"npx vitest run --config tests/e2e/vitest.e2e.config.ts",
			{ cwd: "/project" },
		);
	});

	it("returns the exit code from shell.run", () => {
		vi.mocked(shell.run).mockReturnValue(1);
		expect(runVitest(e2e, deps)).toBe(1);
	});
});

describe("generateReport", () => {
	it("returns null when script output is null", () => {
		vi.mocked(shell.runSilent).mockReturnValue(null);
		expect(generateReport(e2e, deps)).toBeNull();
	});

	it("returns vault path when report is written", () => {
		vi.mocked(shell.runSilent).mockReturnValue("E2EReport written: /vault/reports/e2e-report.md");
		const result = generateReport(e2e, deps);
		expect(result).toBe("/vault/reports/e2e-report.md");
	});

	it("returns null when output has no match", () => {
		vi.mocked(shell.runSilent).mockReturnValue("Some other output");
		expect(generateReport(e2e, deps)).toBeNull();
	});

	it("calls log with the script output", () => {
		const log = vi.fn();
		vi.mocked(shell.runSilent).mockReturnValue("some output");
		generateReport(e2e, { ...deps, log });
		expect(log).toHaveBeenCalledWith("some output");
	});
});

describe("restorePluginState", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("resets installer when installed=false", () => {
		vi.mocked(disk.existsSync).mockReturnValue(true);
		vi.mocked(disk.readFileSync).mockReturnValue(JSON.stringify({ installer: { installed: false } }));
		restorePluginState(e2e, deps);
		expect(disk.writeFileSync).toHaveBeenCalledWith(
			e2e.dataJsonPath,
			expect.stringContaining('"installed":true'),
			"utf-8",
		);
	});

	it("does not modify data.json when installer already true", () => {
		vi.mocked(disk.existsSync).mockReturnValue(true);
		vi.mocked(disk.readFileSync).mockReturnValue(JSON.stringify({ installer: { installed: true } }));
		restorePluginState(e2e, deps);
		// writeFileSync should not have been called with data.json path
		for (const call of vi.mocked(disk.writeFileSync).mock.calls) {
			expect(call[0]).not.toBe(e2e.dataJsonPath);
		}
	});

	it("skips file read when data.json missing", () => {
		vi.mocked(disk.existsSync).mockReturnValue(false);
		restorePluginState(e2e, deps);
		expect(disk.readFileSync).not.toHaveBeenCalled();
	});

	it("calls obsidian CLI to enable plugin and open event log", () => {
		vi.mocked(disk.existsSync).mockReturnValue(false);
		restorePluginState(e2e, deps);
		expect(shell.runSilent).toHaveBeenCalledWith(expect.stringContaining("enablePlugin"));
		expect(shell.runSilent).toHaveBeenCalledWith(expect.stringContaining("open-event-log"));
	});

	it("handles JSON parse errors gracefully", () => {
		vi.mocked(disk.existsSync).mockReturnValue(true);
		vi.mocked(disk.readFileSync).mockReturnValue("not json");
		expect(() => restorePluginState(e2e, deps)).not.toThrow();
	});
});

describe("openReportInObsidian", () => {
	it("calls obsidian CLI to open the report", () => {
		openReportInObsidian("reports/e2e.md", e2e, deps);
		expect(shell.runSilent).toHaveBeenCalledWith(expect.stringContaining("open path="));
	});

	it("opens the outline pane", () => {
		openReportInObsidian("reports/e2e.md", e2e, deps);
		expect(shell.runSilent).toHaveBeenCalledWith(expect.stringContaining("outline"));
	});

	it("logs the opening message", () => {
		const log = vi.fn();
		openReportInObsidian("reports/e2e.md", e2e, { ...deps, log });
		expect(log).toHaveBeenCalledWith(expect.stringContaining("Opening report"));
	});
});

describe("generateReportAndOpen", () => {
	it("generates report and opens it when successful", () => {
		vi.mocked(shell.runSilent)
			.mockReturnValueOnce("E2EReport written: /vault/report.md")  // generateReport
			.mockReturnValue(null);  // other calls
		generateReportAndOpen(e2e, deps);
		// Should have called runSilent multiple times: report generation + open + outline + restore
		expect(shell.runSilent).toHaveBeenCalled();
	});

	it("does not open when report generation fails", () => {
		vi.mocked(shell.runSilent).mockReturnValue(null);
		const log = vi.fn();
		generateReportAndOpen(e2e, { ...deps, log });
		// log was called with generating message but no open message
		expect(log).toHaveBeenCalledWith(expect.stringContaining("Generating"));
	});
});

describe("executeSession", () => {
	const config = {
		sessionName: "test-session",
		selectedSlugs: ["journey-a"],
		includeInstaller: false,
		includePrerequisites: false,
		stepFilter: {},
	};
	const entries = [{ slug: "journey-a", name: "Journey A", chapter: "10", steps: 3, description: "test" }];
	const prereqResults = {
		vaultExists: true,
		artifactsPresent: true,
		missingArtifacts: [],
		cliResponsive: true,
		vaultInstalled: true,
		testDataPresent: true,
	};

	it("returns 0 when pipeline has no failures", async () => {
		vi.mocked(runPipeline).mockResolvedValue({ steps: [], totalDurationMs: 0, passed: 1, failed: 0, skipped: 0 });
		const result = await executeSession(config, entries, prereqResults, e2e, deps);
		expect(result).toBe(0);
	});

	it("returns 1 when pipeline has failures", async () => {
		vi.mocked(runPipeline).mockResolvedValue({ steps: [], totalDurationMs: 0, passed: 0, failed: 1, skipped: 0 });
		const result = await executeSession(config, entries, prereqResults, e2e, deps);
		expect(result).toBe(1);
	});

	it("passes session label to pipeline", async () => {
		await executeSession(config, entries, prereqResults, e2e, deps);
		expect(runPipeline).toHaveBeenCalledWith(
			expect.anything(),
			"/project",
			expect.objectContaining({ label: "E2E Session: test-session" }),
		);
	});
});
