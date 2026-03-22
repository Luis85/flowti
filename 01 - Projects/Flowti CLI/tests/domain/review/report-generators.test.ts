import { describe, it, expect, vi } from "vitest";
import {
	generateTraceabilityReport,
	generateCoverageGapReport,
	generateQualityDashboard,
	generateGateReport,
	generateEvidenceReport,
	generateAuditReport,
	generateRunHistoryReport,
} from "../../../src/domain/review/report-generators.js";
import type { ReportDeps } from "../../../src/domain/review/report-generators.js";
import type { TraceabilityMatrix, TraceabilityGap, CategoryCoverage } from "../../../src/domain/review/traceability.js";
import type { GateEvaluationResult } from "../../../src/domain/review/quality-gates.js";
import type { RunManifest, EvidenceSummary } from "../../../src/domain/review/evidence.js";

// ── Mock deps ────────────────────────────────────────────────────────

function mockDeps(): ReportDeps & { written: { path: string; content: string }[] } {
	const written: { path: string; content: string }[] = [];
	return {
		written,
		disk: {
			mkdirSync: vi.fn(),
			writeFileSync: vi.fn((path: string, content: string) => {
				written.push({ path, content });
			}),
		} as unknown as ReportDeps["disk"],
		paths: {
			dirname: vi.fn((p: string) => p.split("/").slice(0, -1).join("/")),
			join: vi.fn((...parts: string[]) => parts.join("/")),
		} as unknown as ReportDeps["paths"],
		clock: { iso: () => "2026-03-12T10:00:00.000Z", now: () => new Date("2026-03-12T10:00:00.000Z"), ms: () => new Date("2026-03-12T10:00:00.000Z").getTime(), safeIso: () => "2026-03-12T10-00-00" },
	};
}

// ── Fixtures ─────────────────────────────────────────────────────────

function makeMatrix(overrides: Partial<TraceabilityMatrix> = {}): TraceabilityMatrix {
	return {
		rows: [
			{ requirementId: "REQ-001", status: "verified", journeys: ["j1"], steps: ["s1"], lastResult: "pass" },
			{ requirementId: "REQ-002", status: "untested", journeys: [], steps: [] },
		],
		totalRequirements: 10,
		verified: 7,
		failed: 1,
		untested: 2,
		partial: 0,
		coveragePercent: 70,
		...overrides,
	};
}

function makeGaps(): TraceabilityGap[] {
	return [
		{ requirementId: "REQ-002", reason: "no-journey" },
		{ requirementId: "REQ-003", reason: "failed" },
		{ requirementId: "REQ-004", reason: "no-steps" },
	];
}

function makeCategories(): CategoryCoverage[] {
	return [
		{ category: "functionality", total: 5, verified: 4, percent: 80 },
		{ category: "reliability", total: 3, verified: 1, percent: 33 },
		{ category: "security", total: 2, verified: 2, percent: 100 },
	] as CategoryCoverage[];
}

function makeGateResult(overrides: Partial<GateEvaluationResult> = {}): GateEvaluationResult {
	return {
		gates: [
			{ gate: "coverage", passed: true, details: "80% requirement coverage" },
			{ gate: "security", passed: false, details: "2 critical findings" },
		],
		allPassed: false,
		releaseEligible: false,
		capaItems: [
			{
				name: "Fix security findings",
				description: "Resolve 2 critical security vulnerabilities",
				severity: "critical",
				source: "e2e-gate-failure",
				linkedJourney: "security-scan",
				gate: "security",
			},
		],
		...overrides,
	};
}

function makeManifest(overrides: Partial<RunManifest> = {}): RunManifest {
	return {
		runId: "run-001",
		timestamp: "2026-03-12T10:00:00Z",
		project: "test-project",
		environment: { nodeVersion: "20.0.0", platform: "linux" },
		config: {},
		trigger: "manual",
		journeyCount: 5,
		totalSteps: 20,
		passed: 18,
		failed: 1,
		skipped: 1,
		durationMs: 12345,
		...overrides,
	};
}

function makeSummary(overrides: Partial<EvidenceSummary> = {}): EvidenceSummary {
	return {
		runId: "run-001",
		runDir: "/evidence/runs/run-001",
		manifest: makeManifest(),
		artifacts: [
			{ type: "screenshot", path: "/evidence/screenshots/login.png", stepId: "s1", journeyName: "j1", timestamp: "2026-03-12T10:00:00Z" },
			{ type: "log", path: "/evidence/logs/step1.log", stepId: "s2", journeyName: "j1", timestamp: "2026-03-12T10:01:00Z" },
		],
		journeyResults: ["j1"],
		...overrides,
	};
}

// ── Helper to extract written content ────────────────────────────────

function getWritten(deps: ReturnType<typeof mockDeps>): string {
	expect(deps.written).toHaveLength(1);
	return deps.written[0].content;
}

function hasFrontmatter(content: string, key: string, value: string): boolean {
	const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
	if (!fmMatch) return false;
	return fmMatch[1].includes(`${key}: ${value}`);
}

// ── generateTraceabilityReport ───────────────────────────────────────

describe("generateTraceabilityReport", () => {
	it("returns the output path", () => {
		const deps = mockDeps();
		const result = generateTraceabilityReport(makeMatrix(), deps, "/out/trace.md");
		expect(result).toBe("/out/trace.md");
	});

	it("writes a file to disk", () => {
		const deps = mockDeps();
		generateTraceabilityReport(makeMatrix(), deps, "/out/trace.md");
		expect(deps.written).toHaveLength(1);
		expect(deps.written[0].path).toBe("/out/trace.md");
	});

	it("includes frontmatter with reportType", () => {
		const deps = mockDeps();
		generateTraceabilityReport(makeMatrix(), deps, "/out/trace.md");
		const content = getWritten(deps);
		expect(content).toContain("---");
		expect(hasFrontmatter(content, "reportType", "traceability-matrix")).toBe(true);
	});

	it("includes frontmatter date", () => {
		const deps = mockDeps();
		generateTraceabilityReport(makeMatrix(), deps, "/out/trace.md");
		const content = getWritten(deps);
		expect(content).toContain("date:");
		expect(content).toContain("2026-03-12T10:00:00.000Z");
	});

	it("includes coverage percentage in frontmatter", () => {
		const deps = mockDeps();
		generateTraceabilityReport(makeMatrix({ coveragePercent: 85 }), deps, "/out/trace.md");
		const content = getWritten(deps);
		expect(content).toContain("85%");
	});

	it("includes summary counts", () => {
		const deps = mockDeps();
		generateTraceabilityReport(makeMatrix(), deps, "/out/trace.md");
		const content = getWritten(deps);
		expect(content).toContain("**Requirements**: 10");
		expect(content).toContain("**Verified**: 7");
		expect(content).toContain("**Failed**: 1");
		expect(content).toContain("**Untested**: 2");
	});

	it("includes table rows for each matrix row", () => {
		const deps = mockDeps();
		generateTraceabilityReport(makeMatrix(), deps, "/out/trace.md");
		const content = getWritten(deps);
		expect(content).toContain("REQ-001");
		expect(content).toContain("verified");
		expect(content).toContain("j1");
		expect(content).toContain("REQ-002");
	});

	it("renders table header with pipe separators", () => {
		const deps = mockDeps();
		generateTraceabilityReport(makeMatrix(), deps, "/out/trace.md");
		const content = getWritten(deps);
		expect(content).toContain("| Requirement | Status | Journey | Step | Last Result |");
	});
});

// ── generateCoverageGapReport ────────────────────────────────────────

describe("generateCoverageGapReport", () => {
	it("returns the output path", () => {
		const deps = mockDeps();
		const result = generateCoverageGapReport(makeMatrix(), makeGaps(), makeCategories(), deps, "/out/gaps.md");
		expect(result).toBe("/out/gaps.md");
	});

	it("includes frontmatter with coverage-gap reportType", () => {
		const deps = mockDeps();
		generateCoverageGapReport(makeMatrix(), makeGaps(), makeCategories(), deps, "/out/gaps.md");
		const content = getWritten(deps);
		expect(hasFrontmatter(content, "reportType", "coverage-gap")).toBe(true);
	});

	it("includes gap count in frontmatter", () => {
		const deps = mockDeps();
		generateCoverageGapReport(makeMatrix(), makeGaps(), [], deps, "/out/gaps.md");
		const content = getWritten(deps);
		expect(hasFrontmatter(content, "gaps", "3")).toBe(true);
	});

	it("includes ISO 25010 category table when categories provided", () => {
		const deps = mockDeps();
		generateCoverageGapReport(makeMatrix(), [], makeCategories(), deps, "/out/gaps.md");
		const content = getWritten(deps);
		expect(content).toContain("ISO 25010 Category Coverage");
		expect(content).toContain("functionality");
		expect(content).toContain("80%");
	});

	it("lists gaps with reason labels", () => {
		const deps = mockDeps();
		generateCoverageGapReport(makeMatrix(), makeGaps(), [], deps, "/out/gaps.md");
		const content = getWritten(deps);
		expect(content).toContain("REQ-002");
		expect(content).toContain("No journey linked");
		expect(content).toContain("REQ-003");
		expect(content).toContain("Last run failed");
		expect(content).toContain("REQ-004");
		expect(content).toContain("No steps verify");
	});

	it("omits gap section when no gaps", () => {
		const deps = mockDeps();
		generateCoverageGapReport(makeMatrix(), [], [], deps, "/out/gaps.md");
		const content = getWritten(deps);
		expect(content).not.toContain("## Gaps");
	});

	it("omits category table when no categories", () => {
		const deps = mockDeps();
		generateCoverageGapReport(makeMatrix(), [], [], deps, "/out/gaps.md");
		const content = getWritten(deps);
		expect(content).not.toContain("ISO 25010 Category Coverage");
	});
});

// ── generateQualityDashboard ─────────────────────────────────────────

describe("generateQualityDashboard", () => {
	it("returns the output path", () => {
		const deps = mockDeps();
		const result = generateQualityDashboard(makeMatrix(), makeCategories(), makeGateResult(), deps, "/out/dash.md", "MyProject");
		expect(result).toBe("/out/dash.md");
	});

	it("includes quality-dashboard reportType in frontmatter", () => {
		const deps = mockDeps();
		generateQualityDashboard(makeMatrix(), makeCategories(), null, deps, "/out/dash.md");
		const content = getWritten(deps);
		expect(hasFrontmatter(content, "reportType", "quality-dashboard")).toBe(true);
	});

	it("shows RELEASE BLOCKED when gate not eligible", () => {
		const deps = mockDeps();
		generateQualityDashboard(makeMatrix(), [], makeGateResult({ releaseEligible: false }), deps, "/out/dash.md");
		const content = getWritten(deps);
		expect(content).toContain("RELEASE BLOCKED");
	});

	it("shows RELEASE ELIGIBLE when gate passes", () => {
		const deps = mockDeps();
		generateQualityDashboard(makeMatrix(), [], makeGateResult({ releaseEligible: true }), deps, "/out/dash.md");
		const content = getWritten(deps);
		expect(content).toContain("RELEASE ELIGIBLE");
	});

	it("shows NOT EVALUATED when no gate result", () => {
		const deps = mockDeps();
		generateQualityDashboard(makeMatrix(), [], null, deps, "/out/dash.md");
		const content = getWritten(deps);
		expect(content).toContain("NOT EVALUATED");
	});

	it("includes ISO 25010 scores with status labels", () => {
		const deps = mockDeps();
		generateQualityDashboard(makeMatrix(), makeCategories(), null, deps, "/out/dash.md");
		const content = getWritten(deps);
		expect(content).toContain("functionality");
		expect(content).toContain("Good");    // 80%
		expect(content).toContain("Needs Work"); // 33%
	});

	it("includes project name in heading", () => {
		const deps = mockDeps();
		generateQualityDashboard(makeMatrix(), [], null, deps, "/out/dash.md", "Flowti");
		const content = getWritten(deps);
		expect(content).toContain("Quality Dashboard — Flowti");
	});

	it("uses Project as default when no project name", () => {
		const deps = mockDeps();
		generateQualityDashboard(makeMatrix(), [], null, deps, "/out/dash.md");
		const content = getWritten(deps);
		expect(content).toContain("Quality Dashboard — Project");
	});

	it("includes gate details when gate result provided", () => {
		const deps = mockDeps();
		generateQualityDashboard(makeMatrix(), [], makeGateResult(), deps, "/out/dash.md");
		const content = getWritten(deps);
		expect(content).toContain("coverage");
		expect(content).toContain("security");
	});

	it("shows fallback message when no category data", () => {
		const deps = mockDeps();
		generateQualityDashboard(makeMatrix(), [], null, deps, "/out/dash.md");
		const content = getWritten(deps);
		expect(content).toContain("No ISO 25010 category data available");
	});
});

// ── generateGateReport ───────────────────────────────────────────────

describe("generateGateReport", () => {
	it("returns the output path", () => {
		const deps = mockDeps();
		const result = generateGateReport(makeGateResult(), deps, "/out/gates.md");
		expect(result).toBe("/out/gates.md");
	});

	it("includes gate-report reportType in frontmatter", () => {
		const deps = mockDeps();
		generateGateReport(makeGateResult(), deps, "/out/gates.md");
		const content = getWritten(deps);
		expect(hasFrontmatter(content, "reportType", "gate-report")).toBe(true);
	});

	it("includes allPassed and releaseEligible in frontmatter", () => {
		const deps = mockDeps();
		generateGateReport(makeGateResult(), deps, "/out/gates.md");
		const content = getWritten(deps);
		expect(hasFrontmatter(content, "allPassed", "false")).toBe(true);
		expect(hasFrontmatter(content, "releaseEligible", "false")).toBe(true);
	});

	it("includes gate results table with PASS/FAIL", () => {
		const deps = mockDeps();
		generateGateReport(makeGateResult(), deps, "/out/gates.md");
		const content = getWritten(deps);
		expect(content).toContain("| coverage | PASS |");
		expect(content).toContain("| security | FAIL |");
	});

	it("includes CAPA items section when present", () => {
		const deps = mockDeps();
		generateGateReport(makeGateResult(), deps, "/out/gates.md");
		const content = getWritten(deps);
		expect(content).toContain("Auto-Generated CAPA Items");
		expect(content).toContain("Fix security findings");
		expect(content).toContain("critical");
		expect(content).toContain("Journey: security-scan");
	});

	it("omits CAPA section when no items", () => {
		const deps = mockDeps();
		generateGateReport(makeGateResult({ capaItems: [] }), deps, "/out/gates.md");
		const content = getWritten(deps);
		expect(content).not.toContain("Auto-Generated CAPA Items");
	});

	it("shows Release Eligible: Yes when eligible", () => {
		const deps = mockDeps();
		generateGateReport(makeGateResult({ releaseEligible: true, capaItems: [] }), deps, "/out/gates.md");
		const content = getWritten(deps);
		expect(content).toContain("**Release Eligible**: Yes");
	});
});

// ── generateEvidenceReport ───────────────────────────────────────────

describe("generateEvidenceReport", () => {
	it("returns the output path", () => {
		const deps = mockDeps();
		const result = generateEvidenceReport(makeSummary(), deps, "/out/evidence.md");
		expect(result).toBe("/out/evidence.md");
	});

	it("includes evidence-summary reportType in frontmatter", () => {
		const deps = mockDeps();
		generateEvidenceReport(makeSummary(), deps, "/out/evidence.md");
		const content = getWritten(deps);
		expect(hasFrontmatter(content, "reportType", "evidence-summary")).toBe(true);
	});

	it("includes runId in frontmatter", () => {
		const deps = mockDeps();
		generateEvidenceReport(makeSummary(), deps, "/out/evidence.md");
		const content = getWritten(deps);
		expect(hasFrontmatter(content, "runId", "run-001")).toBe(true);
	});

	it("includes artifact count in frontmatter", () => {
		const deps = mockDeps();
		generateEvidenceReport(makeSummary(), deps, "/out/evidence.md");
		const content = getWritten(deps);
		expect(hasFrontmatter(content, "artifacts", "2")).toBe(true);
	});

	it("includes manifest metadata", () => {
		const deps = mockDeps();
		generateEvidenceReport(makeSummary(), deps, "/out/evidence.md");
		const content = getWritten(deps);
		expect(content).toContain("**Run ID**: run-001");
		expect(content).toContain("**Project**: test-project");
		expect(content).toContain("**Platform**: linux");
		expect(content).toContain("**Duration**: 12345ms");
	});

	it("includes artifact table", () => {
		const deps = mockDeps();
		generateEvidenceReport(makeSummary(), deps, "/out/evidence.md");
		const content = getWritten(deps);
		expect(content).toContain("| screenshot | j1 | s1 |");
		expect(content).toContain("| log | j1 | s2 |");
	});

	it("shows fallback when no artifacts", () => {
		const deps = mockDeps();
		generateEvidenceReport(makeSummary({ artifacts: [] }), deps, "/out/evidence.md");
		const content = getWritten(deps);
		expect(content).toContain("No artifacts collected.");
	});
});

// ── generateAuditReport ──────────────────────────────────────────────

describe("generateAuditReport", () => {
	it("returns the output path", () => {
		const deps = mockDeps();
		const result = generateAuditReport(makeMatrix(), makeGateResult(), [makeManifest()], deps, "/out/audit.md", "Flowti");
		expect(result).toBe("/out/audit.md");
	});

	it("includes audit-report reportType in frontmatter", () => {
		const deps = mockDeps();
		generateAuditReport(makeMatrix(), null, [], deps, "/out/audit.md");
		const content = getWritten(deps);
		expect(hasFrontmatter(content, "reportType", "audit-report")).toBe(true);
	});

	it("includes standards in frontmatter", () => {
		const deps = mockDeps();
		generateAuditReport(makeMatrix(), null, [], deps, "/out/audit.md");
		const content = getWritten(deps);
		expect(content).toContain("ISO 9001");
		expect(content).toContain("ISO 27001");
		expect(content).toContain("ISO 25010");
		expect(content).toContain("IREB");
	});

	it("includes traceability section (IREB)", () => {
		const deps = mockDeps();
		generateAuditReport(makeMatrix(), null, [], deps, "/out/audit.md");
		const content = getWritten(deps);
		expect(content).toContain("Requirements Traceability (IREB");
		expect(content).toContain("**Total Requirements**: 10");
	});

	it("includes quality gates section when gate result present", () => {
		const deps = mockDeps();
		generateAuditReport(makeMatrix(), makeGateResult(), [], deps, "/out/audit.md");
		const content = getWritten(deps);
		expect(content).toContain("Quality Gates (ISO 9001");
		expect(content).toContain("coverage");
		expect(content).toContain("Release Eligible");
	});

	it("shows not configured when no gate result", () => {
		const deps = mockDeps();
		generateAuditReport(makeMatrix(), null, [], deps, "/out/audit.md");
		const content = getWritten(deps);
		expect(content).toContain("Quality gates not configured.");
	});

	it("includes CAPA section when gate has items", () => {
		const deps = mockDeps();
		generateAuditReport(makeMatrix(), makeGateResult(), [], deps, "/out/audit.md");
		const content = getWritten(deps);
		expect(content).toContain("Corrective Actions (ISO 9001");
		expect(content).toContain("Fix security findings");
	});

	it("shows no corrective actions when none", () => {
		const deps = mockDeps();
		generateAuditReport(makeMatrix(), makeGateResult({ capaItems: [] }), [], deps, "/out/audit.md");
		const content = getWritten(deps);
		expect(content).toContain("No corrective actions required.");
	});

	it("includes evidence runs table", () => {
		const deps = mockDeps();
		generateAuditReport(makeMatrix(), null, [makeManifest()], deps, "/out/audit.md");
		const content = getWritten(deps);
		expect(content).toContain("Evidence (ISO 9001");
		expect(content).toContain("run-001");
	});

	it("shows no runs message when empty", () => {
		const deps = mockDeps();
		generateAuditReport(makeMatrix(), null, [], deps, "/out/audit.md");
		const content = getWritten(deps);
		expect(content).toContain("No evidence runs recorded.");
	});

	it("limits evidence table to 10 runs", () => {
		const deps = mockDeps();
		const runs = Array.from({ length: 15 }, (_, i) => makeManifest({ runId: `run-${String(i).padStart(3, "0")}` }));
		generateAuditReport(makeMatrix(), null, runs, deps, "/out/audit.md");
		const content = getWritten(deps);
		expect(content).toContain("run-009");
		expect(content).not.toContain("run-010");
	});
});

// ── generateRunHistoryReport ─────────────────────────────────────────

describe("generateRunHistoryReport", () => {
	it("returns the output path", () => {
		const deps = mockDeps();
		const result = generateRunHistoryReport([makeManifest()], deps, "/out/history.md");
		expect(result).toBe("/out/history.md");
	});

	it("includes run-history reportType in frontmatter", () => {
		const deps = mockDeps();
		generateRunHistoryReport([makeManifest()], deps, "/out/history.md");
		const content = getWritten(deps);
		expect(hasFrontmatter(content, "reportType", "run-history")).toBe(true);
	});

	it("includes totalRuns in frontmatter", () => {
		const deps = mockDeps();
		generateRunHistoryReport([makeManifest(), makeManifest({ runId: "run-002" })], deps, "/out/history.md");
		const content = getWritten(deps);
		expect(hasFrontmatter(content, "totalRuns", "2")).toBe(true);
	});

	it("includes run history table with duration", () => {
		const deps = mockDeps();
		generateRunHistoryReport([makeManifest({ durationMs: 30000 })], deps, "/out/history.md");
		const content = getWritten(deps);
		expect(content).toContain("run-001");
		expect(content).toContain("30s");
	});

	it("includes all table columns", () => {
		const deps = mockDeps();
		generateRunHistoryReport([makeManifest()], deps, "/out/history.md");
		const content = getWritten(deps);
		expect(content).toContain("| Run ID | Date | Journeys | Passed | Failed | Duration |");
	});

	it("handles empty runs list", () => {
		const deps = mockDeps();
		generateRunHistoryReport([], deps, "/out/history.md");
		const content = getWritten(deps);
		expect(hasFrontmatter(content, "totalRuns", "0")).toBe(true);
		expect(content).not.toContain("| run-");
	});
});
