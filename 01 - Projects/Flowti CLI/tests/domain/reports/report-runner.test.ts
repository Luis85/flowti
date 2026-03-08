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

import * as shellMod from "../../../src/infrastructure/shell.js";
import { runAllReports } from "../../../src/domain/reports/report-runner.js";
import type { ReportGenerator } from "../../../src/infrastructure/types.js";

beforeEach(() => vi.clearAllMocks());

const generators: ReportGenerator[] = [
	{ label: "Test Report", command: "npx tsx generate-test-report.ts" },
	{ label: "Coverage Report", command: "npx tsx generate-coverage-report.ts" },
	{ label: "Codebase Report", command: "npx tsx generate-codebase-report.ts" },
];

function captureStatusCalls(sh: ReturnType<typeof createMockShell>) {
	return sh.calls.filter((c) => c.method === "runCaptureStatus");
}

describe("runAllReports", () => {
	it("runs all generators and returns results", () => {
		const sh = createMockShell();
		Object.assign(shellMod, { shell: sh });

		const result = runAllReports(generators, "/project");

		expect(captureStatusCalls(sh)).toHaveLength(3);
		expect(result.generators).toHaveLength(3);
		expect(result.passed).toBe(3);
		expect(result.failed).toBe(0);
	});

	it("continues after a generator fails", () => {
		const sh = createMockShell({ exitCodes: { "npx tsx generate-coverage-report.ts": 1 } });
		Object.assign(shellMod, { shell: sh });

		const result = runAllReports(generators, "/project");

		// All 3 were attempted
		expect(captureStatusCalls(sh)).toHaveLength(3);
		expect(result.passed).toBe(2);
		expect(result.failed).toBe(1);
		expect(result.generators[1].exitCode).not.toBe(0);
	});

	it("handles all generators failing", () => {
		const sh = createMockShell({
			exitCodes: Object.fromEntries(generators.map((g) => [g.command, 1])),
		});
		Object.assign(shellMod, { shell: sh });

		const result = runAllReports(generators, "/project");

		expect(captureStatusCalls(sh)).toHaveLength(3);
		expect(result.passed).toBe(0);
		expect(result.failed).toBe(3);
	});

	it("passes correct cwd to each generator", () => {
		const sh = createMockShell();
		Object.assign(shellMod, { shell: sh });

		runAllReports(generators, "/my/project");

		for (const call of captureStatusCalls(sh)) {
			expect(call.opts?.cwd).toBe("/my/project");
		}
	});

	it("records duration per generator", () => {
		const sh = createMockShell();
		Object.assign(shellMod, { shell: sh });

		const result = runAllReports(generators, "/project");

		for (const gen of result.generators) {
			expect(gen.durationMs).toBeGreaterThan(0);
		}
		expect(result.totalDurationMs).toBeGreaterThan(0);
	});

	it("returns empty results for empty generators list", () => {
		const sh = createMockShell();
		Object.assign(shellMod, { shell: sh });

		const result = runAllReports([], "/project");

		expect(captureStatusCalls(sh)).toHaveLength(0);
		expect(result.generators).toHaveLength(0);
		expect(result.passed).toBe(0);
		expect(result.failed).toBe(0);
	});

	it("logs a summary after all generators run", async () => {
		const sh = createMockShell({ exitCodes: { "npx tsx generate-coverage-report.ts": 1 } });
		Object.assign(shellMod, { shell: sh });
		const { log } = await import("../../../src/infrastructure/logger.js");
		const mockLog = log as ReturnType<typeof vi.fn>;

		runAllReports(generators, "/project");

		const output = mockLog.mock.calls.flat().join(" ");
		expect(output).toContain("Report Run Summary");
		expect(output).toContain("2 passed");
		expect(output).toContain("1 failed");
	});

	it("extracts errors from generator output", () => {
		const sh = createMockShell({
			outputs: { "npx tsx generate-test-report.ts": "Error: Cannot find testreport.json\nsome normal line" },
		});
		Object.assign(shellMod, { shell: sh });

		const result = runAllReports(generators, "/project");

		const testGen = result.generators[0];
		expect(testGen.issues.length).toBeGreaterThan(0);
		expect(testGen.issues[0].level).toBe("error");
		expect(testGen.issues[0].message).toContain("Cannot find");
	});

	it("extracts warnings from generator output", () => {
		const sh = createMockShell({
			outputs: { "npx tsx generate-coverage-report.ts": "Warning: low coverage detected\nAll good otherwise" },
		});
		Object.assign(shellMod, { shell: sh });

		const result = runAllReports(generators, "/project");

		const covGen = result.generators[1];
		expect(covGen.issues.some((i) => i.level === "warning")).toBe(true);
	});

	it("logs issues categorized by generator in summary", async () => {
		const sh = createMockShell({
			outputs: {
				"npx tsx generate-test-report.ts": "Error: missing input",
				"npx tsx generate-coverage-report.ts": "Warning: threshold not met",
			},
		});
		Object.assign(shellMod, { shell: sh });
		const { log } = await import("../../../src/infrastructure/logger.js");
		const mockLog = log as ReturnType<typeof vi.fn>;

		runAllReports(generators, "/project");

		const output = mockLog.mock.calls.flat().join(" ");
		expect(output).toContain("Issues by Generator");
		expect(output).toContain("Test Report");
		expect(output).toContain("Coverage Report");
	});

	it("reports total error and warning counts", async () => {
		const sh = createMockShell({
			outputs: {
				"npx tsx generate-test-report.ts": "Error: file not found",
				"npx tsx generate-coverage-report.ts": "Warning: deprecated API\nError: parse failed",
			},
		});
		Object.assign(shellMod, { shell: sh });
		const { log } = await import("../../../src/infrastructure/logger.js");
		const mockLog = log as ReturnType<typeof vi.fn>;

		runAllReports(generators, "/project");

		const output = mockLog.mock.calls.flat().join(" ");
		expect(output).toContain("error(s)");
		expect(output).toContain("warning(s)");
	});
});
