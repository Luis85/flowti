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
			ms: () => { time += 100; return time; },
			now: () => new Date(),
			iso: () => "2026-03-08T12:00:00.000Z",
			safeIso: () => "2026-03-08T12-00-00",
		},
	};
});

import * as shellMod from "../../../src/infrastructure/shell.js";
import { commands } from "../../../src/domain/reports/reports.js";
import type { ProjectContext } from "../../../src/infrastructure/types.js";

function makeProject(opts?: {
	allCommand?: string;
	generators?: Array<{ label: string; command: string }>;
	tools?: Record<string, string>;
}): ProjectContext {
	return {
		path: "/test/project",
		pkg: { name: "test", version: "1.0.0" },
		config: {
			name: "test",
			reports: {
				allCommand: opts?.allCommand,
				generators: opts?.generators,
			},
			tools: opts?.tools,
		},
		scripts: {},
	};
}

beforeEach(() => vi.clearAllMocks());

describe("reports commands", () => {
	it("reports runs each generator resiliently", () => {
		const sh = createMockShell();
		Object.assign(shellMod, { shell: sh });
		const project = makeProject({
			generators: [
				{ label: "Test Report", command: "node scripts/generate-test-report.mjs" },
				{ label: "Coverage Report", command: "node scripts/generate-coverage-report.mjs" },
			],
		});

		commands["reports"]({}, [], "reports", project);

		const captureCalls = sh.calls.filter((c) => c.method === "runCaptureStatus");
		expect(captureCalls).toHaveLength(2);
		expect(captureCalls[0].cmd).toContain("test-report");
		expect(captureCalls[1].cmd).toContain("coverage-report");
	});

	it("reports continues when a generator fails", () => {
		const sh = createMockShell({
			exitCodes: { "node scripts/generate-test-report.mjs": 1 },
		});
		Object.assign(shellMod, { shell: sh });
		const project = makeProject({
			generators: [
				{ label: "Test Report", command: "node scripts/generate-test-report.mjs" },
				{ label: "Coverage Report", command: "node scripts/generate-coverage-report.mjs" },
			],
		});

		commands["reports"]({}, [], "reports", project);

		// Both were attempted despite first failing
		const captureCalls = sh.calls.filter((c) => c.method === "runCaptureStatus");
		expect(captureCalls).toHaveLength(2);
	});

	it("reports logs message when no generators configured", async () => {
		const sh = createMockShell();
		Object.assign(shellMod, { shell: sh });
		const { log } = await import("../../../src/infrastructure/logger.js");
		const project = makeProject({ generators: [] });

		commands["reports"]({}, [], "reports", project);

		expect(sh.calls).toHaveLength(0);
		expect(log).toHaveBeenCalled();
	});

	it("reports:audit runs all generators and logs audit summary", async () => {
		const sh = createMockShell();
		Object.assign(shellMod, { shell: sh });
		const { log } = await import("../../../src/infrastructure/logger.js");
		const project = makeProject({
			generators: [
				{ label: "Test Report", command: "node scripts/generate-test-report.mjs" },
			],
		});

		commands["reports:audit"]({}, [], "reports:audit", project);

		const captureCalls = sh.calls.filter((c) => c.method === "runCaptureStatus");
		expect(captureCalls).toHaveLength(1);
		const output = (log as ReturnType<typeof vi.fn>).mock.calls.flat().join(" ");
		expect(output).toContain("Audit complete");
	});

	it("report:* runs matching generator by command content", () => {
		const sh = createMockShell();
		Object.assign(shellMod, { shell: sh });
		const project = makeProject({
			generators: [
				{ label: "Test Report", command: "node scripts/generate-test-report.mjs" },
				{ label: "Coverage Report", command: "node scripts/generate-coverage-report.mjs" },
			],
		});

		commands["report:*"]({}, [], "report:test", project);

		const runCalls = sh.calls.filter((c) => c.method === "run");
		expect(runCalls).toHaveLength(1);
		expect(runCalls[0].cmd).toContain("test-report");
		expect(runCalls[0].opts?.cwd).toBe("/test/project");
	});

	it("report:* logs error for unknown report", async () => {
		const sh = createMockShell();
		Object.assign(shellMod, { shell: sh });
		const { log } = await import("../../../src/infrastructure/logger.js");
		const mockLog = log as ReturnType<typeof vi.fn>;
		const project = makeProject({
			generators: [{ label: "Test Report", command: "node scripts/generate-test-report.mjs" }],
		});

		commands["report:*"]({}, [], "report:nonexistent", project);

		expect(sh.calls).toHaveLength(0);
		const output = mockLog.mock.calls.flat().join(" ");
		expect(output).toContain("Unknown report");
	});
});
