import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/infrastructure/logger.js", () => ({ log: vi.fn() }));
vi.mock("../../src/infrastructure/ui.js", () => ({
	RESET: "", BOLD: "", DIM: "", GREEN: "", RED: "", YELLOW: "", CYAN: "", BLUE: "", MAGENTA: "", WHITE: "", UNDERLINE: "",
	printHeader: vi.fn(), printSection: vi.fn(), printDivider: vi.fn(),
}));

import { log } from "../../src/infrastructure/logger.js";
import {
	renderNoGenerators,
	renderAuditResult,
	renderReportDiff,
	renderHtmlExport,
	renderUnknownReport,
} from "../../src/ui/reports-display.js";
import type { ReportDiff } from "../../src/domain/reports/report-diff.js";

const mockLog = log as ReturnType<typeof vi.fn>;
const output = () => mockLog.mock.calls.map((c: unknown[]) => c[0] ?? "").join("\n");

beforeEach(() => { mockLog.mockClear(); });

// ── renderNoGenerators ───────────────────────────────────────────────

describe("renderNoGenerators", () => {
	it("renders the message", () => {
		renderNoGenerators({ message: "No generators configured." });
		expect(output()).toContain("No generators configured.");
	});
});

// ── renderAuditResult ────────────────────────────────────────────────

describe("renderAuditResult", () => {
	it("renders passed and failed counts", () => {
		renderAuditResult({ passed: 5, failed: 2 });
		const out = output();
		expect(out).toContain("Audit complete");
		expect(out).toContain("5 passed");
		expect(out).toContain("2 failed");
	});

	it("renders zero counts", () => {
		renderAuditResult({ passed: 0, failed: 0 });
		expect(output()).toContain("0 passed, 0 failed");
	});
});

// ── renderReportDiff ─────────────────────────────────────────────────

describe("renderReportDiff", () => {
	it("renders empty message when no diffs", () => {
		renderReportDiff([]);
		expect(output()).toContain("No metric changes between latest reports.");
	});

	it("renders category and file names", () => {
		const diffs: ReportDiff[] = [{
			category: "tests",
			previousFile: "report-2026-01.md",
			currentFile: "report-2026-02.md",
			deltas: [],
			unchanged: [],
		}];
		renderReportDiff(diffs);
		const out = output();
		expect(out).toContain("Report Diff");
		expect(out).toContain("tests");
		expect(out).toContain("report-2026-01.md → report-2026-02.md");
	});

	it("renders deltas with formatted values", () => {
		const diffs: ReportDiff[] = [{
			category: "coverage",
			previousFile: "a.md",
			currentFile: "b.md",
			deltas: [{ key: "lines", previous: 80, current: 90, delta: 10, formatted: "+10" }],
			unchanged: [],
		}];
		renderReportDiff(diffs);
		const out = output();
		expect(out).toContain("+10");
		expect(out).toContain("lines");
		expect(out).toContain("(80 → 90)");
	});

	it("renders negative deltas", () => {
		const diffs: ReportDiff[] = [{
			category: "tests",
			previousFile: "a.md",
			currentFile: "b.md",
			deltas: [{ key: "failures", previous: 5, current: 2, delta: -3, formatted: "-3" }],
			unchanged: [],
		}];
		renderReportDiff(diffs);
		expect(output()).toContain("-3");
		expect(output()).toContain("failures");
	});

	it("renders unchanged metrics count (singular)", () => {
		const diffs: ReportDiff[] = [{
			category: "tests",
			previousFile: "a.md",
			currentFile: "b.md",
			deltas: [],
			unchanged: ["total"],
		}];
		renderReportDiff(diffs);
		expect(output()).toContain("1 unchanged metric");
		expect(output()).not.toContain("metrics");
	});

	it("renders unchanged metrics count (plural)", () => {
		const diffs: ReportDiff[] = [{
			category: "tests",
			previousFile: "a.md",
			currentFile: "b.md",
			deltas: [],
			unchanged: ["total", "passed"],
		}];
		renderReportDiff(diffs);
		expect(output()).toContain("2 unchanged metrics");
	});

	it("does not render unchanged line when empty", () => {
		const diffs: ReportDiff[] = [{
			category: "tests",
			previousFile: "a.md",
			currentFile: "b.md",
			deltas: [{ key: "x", previous: 1, current: 2, delta: 1, formatted: "+1" }],
			unchanged: [],
		}];
		renderReportDiff(diffs);
		expect(output()).not.toContain("unchanged");
	});

	it("renders multiple diff categories", () => {
		const diffs: ReportDiff[] = [
			{ category: "tests", previousFile: "a.md", currentFile: "b.md", deltas: [], unchanged: [] },
			{ category: "coverage", previousFile: "c.md", currentFile: "d.md", deltas: [], unchanged: [] },
		];
		renderReportDiff(diffs);
		const out = output();
		expect(out).toContain("tests");
		expect(out).toContain("coverage");
	});
});

// ── renderHtmlExport ─────────────────────────────────────────────────

describe("renderHtmlExport", () => {
	it("renders exported entries", () => {
		renderHtmlExport({
			exported: [{ title: "Test Report", outputPath: "out/test.html" }],
			outputDir: "out/",
		});
		const out = output();
		expect(out).toContain("Test Report → out/test.html");
		expect(out).toContain("1 report exported to out/");
	});

	it("renders plural reports", () => {
		renderHtmlExport({
			exported: [
				{ title: "A", outputPath: "out/a.html" },
				{ title: "B", outputPath: "out/b.html" },
			],
			outputDir: "out/",
		});
		expect(output()).toContain("2 reports exported");
	});

	it("renders singular report for count 1", () => {
		renderHtmlExport({
			exported: [{ title: "A", outputPath: "out/a.html" }],
			outputDir: "out/",
		});
		expect(output()).toContain("1 report exported");
		expect(output()).not.toContain("1 reports");
	});
});

// ── renderUnknownReport ──────────────────────────────────────────────

describe("renderUnknownReport", () => {
	it("renders unknown report ID and available list", () => {
		renderUnknownReport({ reportId: "foo", available: "test, coverage, summary" });
		const out = output();
		expect(out).toContain("Unknown report: foo");
		expect(out).toContain("Available: test, coverage, summary");
	});
});
