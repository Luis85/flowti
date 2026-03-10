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

// Mock the unified generator registry
const mockRunGenerator = vi.fn();
const mockHasGenerator = vi.fn();
const mockRunReference = vi.fn();
const mockListReferenceIds = vi.fn();
vi.mock("../../../src/domain/reports/generator-registry.js", () => ({
	runGenerator: (...args: unknown[]) => mockRunGenerator(...args),
	hasGenerator: (...args: unknown[]) => mockHasGenerator(...args),
	runReference: (...args: unknown[]) => mockRunReference(...args),
	listReferenceIds: () => mockListReferenceIds(),
}));

import * as shellMod from "../../../src/infrastructure/shell.js";
import { commands } from "../../../src/domain/reports/reports.js";
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
	mockRunReference.mockReturnValue({ success: true, outputPath: "/test/ref.md", metrics: {} });
	mockListReferenceIds.mockReturnValue(["cli-reference", "entity-reference"]);
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
		expect(mockRunGenerator).toHaveBeenCalledWith("test", "/test/project", expect.anything());
		expect(mockRunGenerator).toHaveBeenCalledWith("coverage", "/test/project", expect.anything());
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

		expect(mockRunGenerator).toHaveBeenCalledWith("test", "/test/project");
	});

	it("report:* falls back to external command when not in registry", () => {
		mockHasGenerator.mockReturnValue(false);
		const sh = createMockShell();
		Object.assign(shellMod, { shell: sh });

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
		Object.assign(shellMod, { shell: sh });
		const { log } = await import("../../../src/infrastructure/logger.js");
		const mockLog = log as ReturnType<typeof vi.fn>;
		const project = makeProject({
			generators: [{ id: "test", label: "Test Report" }],
		});

		commands["report:*"]({}, [], "report:nonexistent", project);

		expect(sh.calls).toHaveLength(0);
		const output = mockLog.mock.calls.flat().join(" ");
		expect(output).toContain("Unknown report");
	});

	it("docs runs config generators via shell", () => {
		const sh = createMockShell();
		Object.assign(shellMod, { shell: sh });

		const project = makeProject({
			docs: {
				generators: [{ label: "TypeDoc", command: "npm run typedoc" }],
			},
		});

		commands["docs"]({}, [], "docs", project);

		const captureCalls = sh.calls.filter((c) => c.method === "runCaptureStatus");
		expect(captureCalls).toHaveLength(1);
		expect(captureCalls[0].cmd).toBe("npm run typedoc");
	});

	it("docs runs built-in reference generators", () => {
		const sh = createMockShell();
		Object.assign(shellMod, { shell: sh });

		const project = makeProject({ docs: {} });

		commands["docs"]({}, [], "docs", project);

		expect(mockRunReference).toHaveBeenCalledWith("cli-reference", "/test/project");
		expect(mockRunReference).toHaveBeenCalledWith("entity-reference", "/test/project");
	});

	it("docs works without docs config", () => {
		const sh = createMockShell();
		Object.assign(shellMod, { shell: sh });

		const project = makeProject();

		commands["docs"]({}, [], "docs", project);

		// Still runs built-in references
		expect(mockRunReference).toHaveBeenCalledTimes(2);
	});
});
