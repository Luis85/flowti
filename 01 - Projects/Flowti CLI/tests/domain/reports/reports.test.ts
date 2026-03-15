import { describe, it, expect, vi, beforeEach } from "vitest";

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

vi.mock("../../../src/infrastructure/proc.js", () => ({
	proc: { exit: vi.fn(), cwd: () => "/mock", argv: () => [], env: () => ({}) },
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

// Mock the unified generator registry
const mockRunGenerator = vi.fn();
const mockHasGenerator = vi.fn();
vi.mock("../../../src/domain/reports/generator-registry.js", () => ({
	runGenerator: (...args: unknown[]) => mockRunGenerator(...args),
	hasGenerator: (...args: unknown[]) => mockHasGenerator(...args),
}));

// Mock the doc runner (docs command now delegates to pipeline)
const mockRunAllDocs = vi.fn();
vi.mock("../../../src/domain/reports/pipeline/doc-runner.js", () => ({
	runAllDocs: (...args: unknown[]) => mockRunAllDocs(...args),
}));

vi.mock("../../../src/infrastructure/request-response.js", async () => {
	const actual = await vi.importActual<typeof import("../../../src/infrastructure/request-response.js")>("../../../src/infrastructure/request-response.js");
	return actual;
});

vi.mock("../../../src/infrastructure/paths.js", () => ({
	paths: {
		join: (...args: string[]) => args.join("/"),
		basename: (p: string) => p.split("/").pop() || "",
	},
}));

vi.mock("../../../src/infrastructure/filesystem.js", () => ({
	disk: {
		readFileSync: vi.fn(() => ""),
		readdirSync: vi.fn(() => []),
	},
}));

vi.mock("../../../src/infrastructure/deps.js", () => ({
	createDefaultDeps: () => ({ disk: {}, paths: {}, clock: {}, log: () => {} }),
}));

vi.mock("../../../src/domain/reports/cli/report-service.js", () => ({
	ReportService: vi.fn().mockImplementation(() => ({ reportsDir: "/test/reports" })),
}));

vi.mock("../../../src/domain/reports/export/report-archive.js", () => ({
	discoverArchiveCategories: vi.fn(() => []),
}));

vi.mock("../../../src/domain/reports/export/report-diff.js", () => ({
	diffReports: vi.fn(),
}));

vi.mock("../../../src/domain/reports/export/html-export.js", () => ({
	exportReportToHtml: vi.fn(),
}));

import { initializeDeps } from "../../../src/infrastructure/command-engine.js";
import { createTestDeps } from "../../mocks/mock-deps.js";
import { createMockShell } from "../../mocks/mock-shell.js";
import { commands } from "../../../src/controller/reports.controller.js";
import { log } from "../../../src/infrastructure/logger.js";
import type { ProjectContext } from "../../../src/infrastructure/types.js";

function makeProject(opts?: {
	generators?: Array<{ id?: string; label: string; command?: string }>;
	docs?: { generators?: Array<{ label: string; command: string }> };
}): ProjectContext {
	return {
		path: "/test/project",
		pkg: { name: "test", version: "1.0.0" },
		config: {
			name: "test",
			reports: {
				generators: opts?.generators,
			},
			docs: opts?.docs,
		},
		scripts: {},
	};
}

beforeEach(() => {
	vi.clearAllMocks();
	mockHasGenerator.mockReturnValue(true);
	mockRunGenerator.mockReturnValue({ success: true, outputPath: "/test/report.md", metrics: {} });
	mockRunAllDocs.mockResolvedValue({ generators: [], totalDurationMs: 100, passed: 2, failed: 0 });
	const deps = createTestDeps();
	(deps as Record<string, unknown>).log = log;
	initializeDeps(deps);
});

describe("reports commands", () => {
	it("reports runs all generators via registry", async () => {
		const project = makeProject({
			generators: [
				{ id: "test", label: "Test Report" },
				{ id: "coverage", label: "Coverage Report" },
			],
		});

		await commands["reports"]({}, [], "reports", project);

		expect(mockRunGenerator).toHaveBeenCalledTimes(2);
		expect(mockRunGenerator).toHaveBeenCalledWith("test", "/test/project", expect.anything(), expect.anything());
		expect(mockRunGenerator).toHaveBeenCalledWith("coverage", "/test/project", expect.anything(), expect.anything());
	});

	it("reports continues when a generator fails", async () => {
		mockRunGenerator
			.mockReturnValueOnce({ success: false, outputPath: "", metrics: {} })
			.mockReturnValueOnce({ success: true, outputPath: "", metrics: {} });

		const project = makeProject({
			generators: [
				{ id: "test", label: "Test Report" },
				{ id: "coverage", label: "Coverage Report" },
			],
		});

		await commands["reports"]({}, [], "reports", project);

		expect(mockRunGenerator).toHaveBeenCalledTimes(2);
	});

	it("reports logs message when no generators configured", async () => {
		const { log } = await import("../../../src/infrastructure/logger.js");
		const project = makeProject({ generators: [] });

		await commands["reports"]({}, [], "reports", project);

		expect(mockRunGenerator).not.toHaveBeenCalled();
		expect(log).toHaveBeenCalled();
	});

	it("reports:audit runs all generators and logs audit summary", async () => {
		const { log } = await import("../../../src/infrastructure/logger.js");
		const project = makeProject({
			generators: [{ id: "test", label: "Test Report" }],
		});

		await commands["reports:audit"]({}, [], "reports:audit", project);

		expect(mockRunGenerator).toHaveBeenCalledTimes(1);
		const output = (log as ReturnType<typeof vi.fn>).mock.calls.flat().join(" ");
		expect(output).toContain("Audit complete");
	});

	it("report:* runs matching internal generator by ID", () => {
		const project = makeProject({
			generators: [{ id: "test", label: "Test Report" }],
		});

		commands["report:*"]({}, [], "report:test", project);

		expect(mockRunGenerator).toHaveBeenCalledWith("test", "/test/project", expect.anything());
	});

	it("report:* falls back to external command when not in registry", () => {
		mockHasGenerator.mockReturnValue(false);
		const sh = createMockShell();
		const deps = createTestDeps();
		(deps as Record<string, unknown>).shell = sh;
		(deps as Record<string, unknown>).log = log;
		initializeDeps(deps);

		const project = makeProject({
			generators: [{ id: "custom", label: "Custom Report", command: "node scripts/generate-custom.mjs" }],
		});

		commands["report:*"]({}, [], "report:custom", project);

		const runCalls = sh.calls.filter((c) => c.method === "run");
		expect(runCalls).toHaveLength(1);
		expect(runCalls[0].cmd).toContain("generate-custom");
	});

	it("report:* logs error for unknown report", async () => {
		mockHasGenerator.mockReturnValue(false);
		const sh = createMockShell();
		const deps = createTestDeps();
		(deps as Record<string, unknown>).shell = sh;
		(deps as Record<string, unknown>).log = log;
		initializeDeps(deps);
		const mockLog = log as ReturnType<typeof vi.fn>;
		const project = makeProject({
			generators: [{ id: "test", label: "Test Report" }],
		});

		commands["report:*"]({}, [], "report:nonexistent", project);

		expect(sh.calls).toHaveLength(0);
		const output = mockLog.mock.calls.flat().join(" ");
		expect(output).toContain("Unknown report");
	});

	it("docs delegates to runAllDocs with config generators", async () => {
		const project = makeProject({
			docs: {
				generators: [{ label: "TypeDoc", command: "npm run typedoc" }],
			},
		});

		await commands["docs"]({}, [], "docs", project);

		expect(mockRunAllDocs).toHaveBeenCalledWith(
			[{ label: "TypeDoc", command: "npm run typedoc" }],
			[],
			"/test/project",
			expect.anything(),
			undefined,
		);
	});

	it("docs passes empty array when no config generators", async () => {
		const project = makeProject({ docs: {} });

		await commands["docs"]({}, [], "docs", project);

		expect(mockRunAllDocs).toHaveBeenCalledWith([], [], "/test/project", expect.anything(), undefined);
	});

	it("docs works without docs config", async () => {
		const project = makeProject();

		await commands["docs"]({}, [], "docs", project);

		expect(mockRunAllDocs).toHaveBeenCalledWith([], [], "/test/project", expect.anything(), undefined);
	});
});
