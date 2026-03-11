import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/infrastructure/filesystem.js", () => ({
	disk: {
		mkdirSync: vi.fn(),
		writeFileSync: vi.fn(),
	},
}));

vi.mock("../../../src/infrastructure/paths.js", () => ({
	paths: {
		join: (...args: string[]) => args.join("/"),
		basename: (p: string) => p.split("/").pop(),
	},
}));

vi.mock("../../../src/infrastructure/shell.js", () => ({
	shell: { runSilent: vi.fn(() => "ok") },
}));

vi.mock("../../../src/infrastructure/input.js", () => ({
	input: { ask: vi.fn(async (_prompt: string, defaultVal: string) => defaultVal) },
}));

vi.mock("../../../src/infrastructure/clock.js", () => ({
	clock: {
		iso: () => "2025-06-15T10:30:00.000Z",
		now: () => new Date("2025-06-15T10:30:00.000Z"),
	},
}));

vi.mock("../../../src/domain/e2e/e2e-helpers.js", () => ({
	yamlStr: (s: string) => `"${s}"`,
}));

vi.mock("../../../src/domain/e2e/e2e-build.js", () => ({
	collectReportSources: vi.fn(() => ({})),
}));

import { disk } from "../../../src/infrastructure/filesystem.js";
import { paths } from "../../../src/infrastructure/paths.js";
import { shell } from "../../../src/infrastructure/shell.js";
import { input } from "../../../src/infrastructure/input.js";
import { clock } from "../../../src/infrastructure/clock.js";
import { collectReportSources } from "../../../src/domain/e2e/e2e-build.js";
import { generateAudit } from "../../../src/domain/e2e/e2e-audit.js";
import type { E2EPaths } from "../../../src/domain/e2e/e2e-paths.js";

const e2e: E2EPaths = {
	projectRoot: "/project",
	testVault: "/vault",
	vaultName: "test-vault",
	pluginId: "flowti-ibde",
	pluginDir: "/vault/.obsidian/plugins/flowti-ibde",
	dataJsonPath: "/vault/.obsidian/plugins/flowti-ibde/data.json",
	reportsDir: "/project/docs/reports",
} as E2EPaths;

const mockLog = vi.fn();
const auditDeps = { disk, paths, shell, input, clock, log: mockLog } as any;

describe("generateAudit", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(collectReportSources).mockReturnValue({});
		vi.mocked(input.ask).mockImplementation(async (_p: string, d: string) => d);
		vi.mocked(disk.mkdirSync).mockReturnValue(undefined);
		vi.mocked(disk.writeFileSync).mockReturnValue(undefined);
		vi.mocked(shell.runSilent).mockReturnValue("ok");
	});

	it("uses date-based default name", async () => {
		await generateAudit(e2e, auditDeps);
		expect(input.ask).toHaveBeenCalledWith("Audit name", "2025-06-15-audit");
	});

	it("creates audit directories", async () => {
		await generateAudit(e2e, auditDeps);
		expect(disk.mkdirSync).toHaveBeenCalledWith(
			expect.stringContaining("Audits/2025-06-15-audit"),
			{ recursive: true },
		);
	});

	it("writes audit file to vault and project", async () => {
		await generateAudit(e2e, auditDeps);
		expect(disk.writeFileSync).toHaveBeenCalledTimes(2);
		// First call: vault path
		expect(vi.mocked(disk.writeFileSync).mock.calls[0][0]).toContain("Audits/2025-06-15-audit");
		// Second call: dev mirror
		expect(vi.mocked(disk.writeFileSync).mock.calls[1][0]).toContain("docs/reports/e2e/audits");
	});

	it("opens audit in obsidian", async () => {
		await generateAudit(e2e, auditDeps);
		expect(shell.runSilent).toHaveBeenCalledWith(expect.stringContaining("obsidian vault="));
	});

	it("includes YAML frontmatter with type E2EAudit", async () => {
		await generateAudit(e2e, auditDeps);
		const content = vi.mocked(disk.writeFileSync).mock.calls[0][1] as string;
		expect(content).toContain("type: E2EAudit");
		expect(content).toContain("---");
	});

	it("includes overall_status pass when no failures", async () => {
		vi.mocked(collectReportSources).mockReturnValue({});
		await generateAudit(e2e, auditDeps);
		const content = vi.mocked(disk.writeFileSync).mock.calls[0][1] as string;
		expect(content).toContain("overall_status: pass");
	});

	it("includes overall_status fail when test failures exist", async () => {
		vi.mocked(collectReportSources).mockReturnValue({
			test: { file: "test.md", fm: { failed: 3 } },
		});
		await generateAudit(e2e, auditDeps);
		const content = vi.mocked(disk.writeFileSync).mock.calls[0][1] as string;
		expect(content).toContain("overall_status: fail");
	});

	it("includes build metrics in frontmatter", async () => {
		vi.mocked(collectReportSources).mockReturnValue({
			build: { file: "build.md", fm: { total_bytes: 102400, duration_ms: 5000, warnings_count: 2, errors_count: 0 } },
		});
		await generateAudit(e2e, auditDeps);
		const content = vi.mocked(disk.writeFileSync).mock.calls[0][1] as string;
		expect(content).toContain("build_size_kb: 100");
		expect(content).toContain("build_duration_ms: 5000");
		expect(content).toContain("build_warnings: 2");
	});

	it("includes unit test metrics", async () => {
		vi.mocked(collectReportSources).mockReturnValue({
			test: { file: "test.md", fm: { total: 100, passed: 95, failed: 5, skipped: 0, suites: 10 } },
		});
		await generateAudit(e2e, auditDeps);
		const content = vi.mocked(disk.writeFileSync).mock.calls[0][1] as string;
		expect(content).toContain("unit_tests_total: 100");
		expect(content).toContain("unit_tests_passed: 95");
		expect(content).toContain("unit_tests_failed: 5");
	});

	it("includes E2E metrics", async () => {
		vi.mocked(collectReportSources).mockReturnValue({
			e2e: { file: "e2e.md", fm: { total_tests: 50, passed: 48, failed: 2, journeys: 5, total_actions: 200 } },
		});
		await generateAudit(e2e, auditDeps);
		const content = vi.mocked(disk.writeFileSync).mock.calls[0][1] as string;
		expect(content).toContain("e2e_tests_total: 50");
		expect(content).toContain("e2e_journeys: 5");
	});

	it("renders build section with metrics table", async () => {
		vi.mocked(collectReportSources).mockReturnValue({
			build: { file: "build.md", fm: { total_bytes: 51200, duration_ms: 3000 } },
		});
		await generateAudit(e2e, auditDeps);
		const content = vi.mocked(disk.writeFileSync).mock.calls[0][1] as string;
		expect(content).toContain("## Build");
		expect(content).toContain("Bundle Size");
	});

	it("renders no build section when no build report", async () => {
		vi.mocked(collectReportSources).mockReturnValue({});
		await generateAudit(e2e, auditDeps);
		const content = vi.mocked(disk.writeFileSync).mock.calls[0][1] as string;
		expect(content).toContain("No build report available");
	});

	it("renders test section with success callout when no failures", async () => {
		vi.mocked(collectReportSources).mockReturnValue({
			test: { file: "test.md", fm: { total: 100, passed: 100, failed: 0, suites: 10, skipped: 0 } },
		});
		await generateAudit(e2e, auditDeps);
		const content = vi.mocked(disk.writeFileSync).mock.calls[0][1] as string;
		expect(content).toContain("## Unit Tests");
		expect(content).toContain("[!success]");
	});

	it("renders test section with danger callout when failures", async () => {
		vi.mocked(collectReportSources).mockReturnValue({
			test: { file: "test.md", fm: { total: 100, passed: 95, failed: 5, suites: 10, skipped: 0 } },
		});
		await generateAudit(e2e, auditDeps);
		const content = vi.mocked(disk.writeFileSync).mock.calls[0][1] as string;
		expect(content).toContain("[!danger]");
	});

	it("renders report sources section with available links", async () => {
		vi.mocked(collectReportSources).mockReturnValue({
			build: { file: "/reports/build.md", fm: {} },
			test: { file: "/reports/test.md", fm: {} },
		});
		await generateAudit(e2e, auditDeps);
		const content = vi.mocked(disk.writeFileSync).mock.calls[0][1] as string;
		expect(content).toContain("## Report Sources");
		expect(content).toContain("Build:");
		expect(content).toContain("Tests:");
	});

	it("logs progress messages", async () => {
		const log = vi.fn();
		await generateAudit(e2e, { ...auditDeps, log });
		expect(log).toHaveBeenCalledWith(expect.stringContaining("Generating audit"));
		expect(log).toHaveBeenCalledWith(expect.stringContaining("Audit written"));
	});

	it("uses custom audit name from user input", async () => {
		vi.mocked(input.ask).mockResolvedValue("custom-audit");
		await generateAudit(e2e, auditDeps);
		const content = vi.mocked(disk.writeFileSync).mock.calls[0][1] as string;
		expect(content).toContain("custom-audit");
	});

	it("includes cycle in frontmatter when available", async () => {
		vi.mocked(collectReportSources).mockReturnValue({
			cycle: { file: "cycle.md", fm: { cycle: 42 } },
		});
		await generateAudit(e2e, auditDeps);
		const content = vi.mocked(disk.writeFileSync).mock.calls[0][1] as string;
		expect(content).toContain("cycle: 42");
	});

	it("handles obsidian open failure gracefully", async () => {
		vi.mocked(shell.runSilent).mockReturnValue(null);
		const log = vi.fn();
		await generateAudit(e2e, { ...auditDeps, log });
		expect(log).toHaveBeenCalledWith(expect.stringContaining("Could not open"));
	});
});
