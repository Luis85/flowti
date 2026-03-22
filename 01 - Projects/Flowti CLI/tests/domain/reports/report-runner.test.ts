import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockShell } from "../../mocks/mock-shell.js";

vi.mock("../../../src/infrastructure/ui.js", () => ({
	RESET: "", BOLD: "", DIM: "", GREEN: "", RED: "", CYAN: "", YELLOW: "",
}));

vi.mock("../../../src/infrastructure/shell.js", () => ({
	shell: {},
}));

vi.mock("../../../src/infrastructure/logger.js", () => ({
	log: vi.fn(),
	warn: vi.fn(),
}));

vi.mock("../../../src/infrastructure/clock.js", () => {
	let time = 1000;
	return {
		clock: {
			ms: () => { time += 500; return time; },
			now: () => new Date(),
			iso: () => "2026-03-08T12:00:00.000Z",
			safeIso: () => "2026-03-08T12-00-00",
		},
	};
});

// Mock the generator registry — return controlled outputs
const mockRunGenerator = vi.fn();
const mockHasGenerator = vi.fn();
vi.mock("../../../src/domain/reports/generator-registry.js", () => ({
	runGenerator: mockRunGenerator,
	hasGenerator: mockHasGenerator,
}));


vi.mock("../../../src/infrastructure/filesystem.js", () => ({
	disk: { existsSync: vi.fn(() => false), readFileSync: vi.fn(() => "{}"), writeFileSync: vi.fn() },
}));

vi.mock("../../../src/infrastructure/paths.js", () => ({
	paths: { join: (...args: string[]) => args.join("/") },
}));

vi.mock("../../../src/infrastructure/proc.js", () => ({
	proc: { exit: vi.fn(), env: () => ({}), argv: () => [] },
}));

vi.mock("../../../src/infrastructure/input.js", () => ({
	input: { ask: vi.fn(), askYesNo: vi.fn() },
}));

import * as shellMod from "../../../src/infrastructure/shell.js";
import { disk } from "../../../src/infrastructure/filesystem.js";
import { paths } from "../../../src/infrastructure/paths.js";
import { clock } from "../../../src/infrastructure/clock.js";
import { log, warn } from "../../../src/infrastructure/logger.js";
import { proc } from "../../../src/infrastructure/proc.js";
import { input } from "../../../src/infrastructure/input.js";
import { runAllReports } from "../../../src/domain/reports/pipeline/report-runner.js";
import type { ReportGenerator } from "../../../src/infrastructure/types.js";

const reportDeps = { disk, shell: shellMod.shell, paths, clock, proc, input, log, warn } as any;

beforeEach(() => {
	vi.clearAllMocks();
	mockHasGenerator.mockReturnValue(true);
	mockRunGenerator.mockReturnValue({ success: true, outputPath: "/test/report.md", metrics: {} });
});

const generators: ReportGenerator[] = [
	{ id: "test", label: "Test Report" },
	{ id: "coverage", label: "Coverage Report" },
	{ id: "codebase", label: "Codebase Report" },
];

describe("runAllReports", () => {
	it("runs all generators and returns results", async () => {
		const result = await runAllReports(generators, "/project", reportDeps);

		expect(mockRunGenerator).toHaveBeenCalledTimes(3);
		expect(result.generators).toHaveLength(3);
		expect(result.passed).toBe(3);
		expect(result.failed).toBe(0);
	});

	it("continues after a generator fails", async () => {
		mockRunGenerator
			.mockReturnValueOnce({ success: true, outputPath: "", metrics: {} })
			.mockReturnValueOnce({ success: false, outputPath: "", metrics: {} })
			.mockReturnValueOnce({ success: true, outputPath: "", metrics: {} });

		const result = await runAllReports(generators, "/project", reportDeps);

		expect(mockRunGenerator).toHaveBeenCalledTimes(3);
		expect(result.passed).toBe(2);
		expect(result.failed).toBe(1);
	});

	it("handles all generators failing", async () => {
		mockRunGenerator.mockReturnValue({ success: false, outputPath: "", metrics: {} });

		const result = await runAllReports(generators, "/project", reportDeps);

		expect(mockRunGenerator).toHaveBeenCalledTimes(3);
		expect(result.passed).toBe(0);
		expect(result.failed).toBe(3);
	});

	it("passes correct projectPath to each generator", async () => {
		await runAllReports(generators, "/my/project", reportDeps);

		for (const call of mockRunGenerator.mock.calls) {
			expect(call[1]).toBe("/my/project");
		}
	});

	it("records duration per generator", async () => {
		const result = await runAllReports(generators, "/project", reportDeps);

		for (const gen of result.generators) {
			expect(gen.durationMs).toBeGreaterThan(0);
		}
		expect(result.totalDurationMs).toBeGreaterThan(0);
	});

	it("returns empty results for empty generators list", async () => {
		const result = await runAllReports([], "/project", reportDeps);

		expect(mockRunGenerator).not.toHaveBeenCalled();
		expect(result.generators).toHaveLength(0);
		expect(result.passed).toBe(0);
		expect(result.failed).toBe(0);
	});

	it("logs a summary after all generators run", async () => {
		mockRunGenerator
			.mockReturnValueOnce({ success: true, outputPath: "", metrics: {} })
			.mockReturnValueOnce({ success: false, outputPath: "", metrics: {} })
			.mockReturnValueOnce({ success: true, outputPath: "", metrics: {} });
		const { log } = await import("../../../src/infrastructure/logger.js");
		const mockLog = log as ReturnType<typeof vi.fn>;

		await runAllReports(generators, "/project", reportDeps);

		const output = mockLog.mock.calls.flat().join(" ");
		expect(output).toContain("Report Run Summary");
		expect(output).toContain("2 passed");
		expect(output).toContain("1 failed");
	});

	it("catches exceptions from generators", async () => {
		mockRunGenerator
			.mockReturnValueOnce({ success: true, outputPath: "", metrics: {} })
			.mockImplementationOnce(() => { throw new Error("Generator crashed"); })
			.mockReturnValueOnce({ success: true, outputPath: "", metrics: {} });

		const result = await runAllReports(generators, "/project", reportDeps);

		expect(result.passed).toBe(2);
		expect(result.failed).toBe(1);
		expect(result.generators[1].error).toContain("Generator crashed");
	});

	it("handles unknown generator ID gracefully", async () => {
		mockHasGenerator.mockReturnValue(false);
		mockRunGenerator.mockReturnValue(null);

		const unknownGens: ReportGenerator[] = [{ id: "nonexistent", label: "Unknown" }];
		const result = await runAllReports(unknownGens, "/project", reportDeps);

		expect(result.failed).toBe(1);
		expect(result.generators[0].error).toContain("Unknown generator: \"nonexistent\"");
	});

	it("falls back to external command when no internal generator exists", async () => {
		mockHasGenerator.mockReturnValue(false);
		const sh = createMockShell();
		Object.assign(shellMod, { shell: sh });

		const externalGens: ReportGenerator[] = [
			{ label: "Custom Report", command: "node scripts/generate-custom.mjs" },
		];

		const result = await runAllReports(externalGens, "/project", { ...reportDeps, shell: shellMod.shell });

		expect(result.passed).toBe(1);
		const captureCalls = sh.calls.filter((c) => c.method === "runCaptureStatus");
		expect(captureCalls).toHaveLength(1);
		expect(captureCalls[0].cmd).toBe("node scripts/generate-custom.mjs");
	});

	it("records generator IDs in results", async () => {
		const result = await runAllReports(generators, "/project", reportDeps);

		expect(result.generators[0].id).toBe("test");
		expect(result.generators[1].id).toBe("coverage");
		expect(result.generators[2].id).toBe("codebase");
	});

	it("runs prerequisites before the generator", async () => {
		const sh = createMockShell();
		Object.assign(shellMod, { shell: sh });

		const gens: ReportGenerator[] = [
			{ id: "test", label: "Test Report", prerequisites: ["npm run test:coverage"] },
		];
		const result = await runAllReports(gens, "/project", { ...reportDeps, shell: shellMod.shell });

		const captureCalls = sh.calls.filter((c) => c.method === "runCaptureStatus");
		expect(captureCalls).toHaveLength(1);
		expect(captureCalls[0].cmd).toBe("npm run test:coverage");
		expect(result.passed).toBe(1);
	});

	it("deduplicates shared prerequisites across generators", async () => {
		const sh = createMockShell();
		Object.assign(shellMod, { shell: sh });

		const gens: ReportGenerator[] = [
			{ id: "test", label: "Test Report", prerequisites: ["npm run test:coverage"] },
			{ id: "coverage", label: "Coverage Report", prerequisites: ["npm run test:coverage"] },
		];
		await runAllReports(gens, "/project", { ...reportDeps, shell: shellMod.shell });

		const captureCalls = sh.calls.filter((c) => c.method === "runCaptureStatus");
		expect(captureCalls).toHaveLength(1);
	});

	it("fails the generator when a prerequisite fails", async () => {
		const sh = createMockShell({ exitCodes: { "npm run broken": 1 } });
		Object.assign(shellMod, { shell: sh });

		const gens: ReportGenerator[] = [
			{ id: "test", label: "Test Report", prerequisites: ["npm run broken"] },
		];
		const result = await runAllReports(gens, "/project", { ...reportDeps, shell: shellMod.shell });

		expect(result.failed).toBe(1);
		expect(result.generators[0].error).toContain("Prerequisite failed");
		// Generator should NOT have been called
		expect(mockRunGenerator).not.toHaveBeenCalled();
	});

	it("runs in phased mode when parallel option is set", async () => {
		const result = await runAllReports(generators, "/project", reportDeps, { parallel: true });

		expect(mockRunGenerator).toHaveBeenCalledTimes(3);
		expect(result.passed).toBe(3);
		expect(result.failed).toBe(0);
	});

	it("phased mode respects dependency ordering", async () => {
		const phasedGens: ReportGenerator[] = [
			{ id: "test", label: "Test Report" },
			{ id: "status", label: "Status Report", dependencies: ["test"] },
		];

		const result = await runAllReports(phasedGens, "/project", reportDeps, { parallel: true });

		expect(result.passed).toBe(2);
		// test should run before status
		const testIdx = result.generators.findIndex((g) => g.id === "test");
		const statusIdx = result.generators.findIndex((g) => g.id === "status");
		expect(testIdx).toBeLessThan(statusIdx);
	});

});
