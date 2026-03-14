import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/infrastructure/logger.js", () => ({ log: vi.fn() }));
vi.mock("../../../src/infrastructure/ui.js", () => ({
	RESET: "", BOLD: "", DIM: "", GREEN: "", RED: "", YELLOW: "", CYAN: "", BLUE: "", MAGENTA: "", WHITE: "", UNDERLINE: "",
	printHeader: vi.fn(), printSection: vi.fn(), printDivider: vi.fn(),
}));

import { log } from "../../../src/infrastructure/logger.js";
import {
	renderChangeAnalysis, renderReviewClean, renderPipelineResult,
	renderGateResult, renderTraceabilityMatrix, renderCoverageReport,
	renderEvidenceList,
} from "../../../src/ui/displays/review-display.js";
import type {
	ChangeAnalysisModel, ReviewCleanModel, PipelineResultModel,
	GateResultModel, TraceabilityModel, CoverageModel, EvidenceListModel,
} from "../../../src/ui/displays/review-display.js";

const mockLog = log as ReturnType<typeof vi.fn>;
const output = () => mockLog.mock.calls.map((c: unknown[]) => c[0] ?? "").join("\n");

beforeEach(() => { mockLog.mockClear(); });

// ── renderChangeAnalysis ─────────────────────────────────────────────

describe("renderChangeAnalysis", () => {
	it("renders project label and summary", () => {
		const data: ChangeAnalysisModel = {
			projectLabel: "Flowti CLI",
			impact: {
				summary: "3 files changed across 2 domains.",
				changedFiles: [],
				affectedDomains: [],
				suggestedActions: [],
			},
		};
		renderChangeAnalysis(data, log);
		const out = output();
		expect(out).toContain("Change Analysis");
		expect(out).toContain("Flowti CLI");
		expect(out).toContain("3 files changed across 2 domains.");
	});

	it("renders changed files with status", () => {
		const data: ChangeAnalysisModel = {
			projectLabel: "P",
			impact: {
				summary: "Changed.",
				changedFiles: [
					{ path: "src/main.ts", status: "M" },
					{ path: "src/new.ts", status: "A" },
				],
				affectedDomains: [],
				suggestedActions: [],
			},
		};
		renderChangeAnalysis(data, log);
		const out = output();
		expect(out).toContain("Changed files:");
		expect(out).toContain("M");
		expect(out).toContain("src/main.ts");
		expect(out).toContain("A");
		expect(out).toContain("src/new.ts");
	});

	it("does not render changed files section when empty", () => {
		const data: ChangeAnalysisModel = {
			projectLabel: "P",
			impact: { summary: "No changes.", changedFiles: [], affectedDomains: [], suggestedActions: [] },
		};
		renderChangeAnalysis(data, log);
		expect(output()).not.toContain("Changed files:");
	});

	it("renders affected domains", () => {
		const data: ChangeAnalysisModel = {
			projectLabel: "P",
			impact: {
				summary: "Changed.",
				changedFiles: [],
				affectedDomains: ["source", "tests"],
				suggestedActions: [],
			},
		};
		renderChangeAnalysis(data, log);
		expect(output()).toContain("Affected domains:");
		expect(output()).toContain("source, tests");
	});

	it("does not render affected domains when empty", () => {
		const data: ChangeAnalysisModel = {
			projectLabel: "P",
			impact: { summary: "None.", changedFiles: [], affectedDomains: [], suggestedActions: [] },
		};
		renderChangeAnalysis(data, log);
		expect(output()).not.toContain("Affected domains:");
	});

	it("renders suggested actions", () => {
		const data: ChangeAnalysisModel = {
			projectLabel: "P",
			impact: {
				summary: "Changed.",
				changedFiles: [],
				affectedDomains: [],
				suggestedActions: ["build", "test"],
			},
		};
		renderChangeAnalysis(data, log);
		expect(output()).toContain("Suggested actions:");
		expect(output()).toContain("build, test");
	});

	it("does not render suggested actions when empty", () => {
		const data: ChangeAnalysisModel = {
			projectLabel: "P",
			impact: { summary: "None.", changedFiles: [], affectedDomains: [], suggestedActions: [] },
		};
		renderChangeAnalysis(data, log);
		expect(output()).not.toContain("Suggested actions:");
	});
});

// ── renderReviewClean ────────────────────────────────────────────────

describe("renderReviewClean", () => {
	it("renders removed message when vault was removed", () => {
		const data: ReviewCleanModel = { removed: true, vaultPath: "/tmp/test-vault" };
		renderReviewClean(data, log);
		const out = output();
		expect(out).toContain("Removed");
		expect(out).toContain("/tmp/test-vault");
	});

	it("renders warning when vault does not exist", () => {
		const data: ReviewCleanModel = { removed: false, vaultPath: "/tmp/missing-vault" };
		renderReviewClean(data, log);
		const out = output();
		expect(out).toContain("Test vault does not exist");
		expect(out).toContain("/tmp/missing-vault");
	});
});

// ── renderPipelineResult ─────────────────────────────────────────────

describe("renderPipelineResult", () => {
	it("renders stopped message with explicit reason", () => {
		const data: PipelineResultModel = { stoppedAt: "build", reason: "lint errors found" };
		renderPipelineResult(data, log);
		const out = output();
		expect(out).toContain("Pipeline stopped");
		expect(out).toContain("lint errors found");
	});

	it("renders stopped message with fallback when reason is null", () => {
		const data: PipelineResultModel = { stoppedAt: "test", reason: null };
		renderPipelineResult(data, log);
		const out = output();
		expect(out).toContain("Pipeline stopped");
		expect(out).toContain("test failed");
	});

	it("renders nothing when stoppedAt is null", () => {
		const data: PipelineResultModel = { stoppedAt: null, reason: null };
		renderPipelineResult(data, log);
		expect(mockLog).not.toHaveBeenCalled();
	});
});

// ── renderGateResult ─────────────────────────────────────────────────

describe("renderGateResult", () => {
	it("renders header with project label", () => {
		const data: GateResultModel = {
			projectLabel: "My Project",
			evaluation: { gates: [], allPassed: true, releaseEligible: true, capaItems: [] },
		};
		renderGateResult(data, log);
		const out = output();
		expect(out).toContain("Quality Gates");
		expect(out).toContain("My Project");
	});

	it("renders fallback message when evaluation is null", () => {
		const data: GateResultModel = { projectLabel: "P", evaluation: null };
		renderGateResult(data, log);
		expect(output()).toContain("No gate evaluation available.");
	});

	it("renders custom message when evaluation is null and message provided", () => {
		const data: GateResultModel = { projectLabel: "P", evaluation: null, message: "Gates not configured." };
		renderGateResult(data, log);
		const out = output();
		expect(out).toContain("Gates not configured.");
		expect(out).not.toContain("No gate evaluation available.");
	});

	it("renders passing gates with check icon", () => {
		const data: GateResultModel = {
			projectLabel: "P",
			evaluation: {
				gates: [{ gate: "coverage", passed: true, details: "85% coverage" }],
				allPassed: true,
				releaseEligible: true,
				capaItems: [],
			},
		};
		renderGateResult(data, log);
		const out = output();
		expect(out).toContain("✓");
		expect(out).toContain("coverage");
		expect(out).toContain("85% coverage");
	});

	it("renders failing gates with cross icon", () => {
		const data: GateResultModel = {
			projectLabel: "P",
			evaluation: {
				gates: [{ gate: "security", passed: false, details: "2 critical findings" }],
				allPassed: false,
				releaseEligible: false,
				capaItems: [],
			},
		};
		renderGateResult(data, log);
		const out = output();
		expect(out).toContain("✗");
		expect(out).toContain("security");
		expect(out).toContain("2 critical findings");
	});

	it("renders RELEASE ELIGIBLE when releaseEligible is true", () => {
		const data: GateResultModel = {
			projectLabel: "P",
			evaluation: { gates: [], allPassed: true, releaseEligible: true, capaItems: [] },
		};
		renderGateResult(data, log);
		expect(output()).toContain("RELEASE ELIGIBLE");
	});

	it("renders RELEASE BLOCKED when releaseEligible is false", () => {
		const data: GateResultModel = {
			projectLabel: "P",
			evaluation: { gates: [], allPassed: false, releaseEligible: false, capaItems: [] },
		};
		renderGateResult(data, log);
		expect(output()).toContain("RELEASE BLOCKED");
	});

	it("renders CAPA items when present", () => {
		const data: GateResultModel = {
			projectLabel: "P",
			evaluation: {
				gates: [],
				allPassed: false,
				releaseEligible: false,
				capaItems: [
					{ name: "Fix coverage gap", description: "Coverage below threshold", severity: "high" as const, source: "e2e-gate-failure" as const, gate: "coverage" },
					{ name: "Address security", description: "Critical finding", severity: "critical" as const, source: "e2e-gate-failure" as const, gate: "security" },
				],
			},
		};
		renderGateResult(data, log);
		const out = output();
		expect(out).toContain("Auto-CAPA items:");
		expect(out).toContain("high");
		expect(out).toContain("Fix coverage gap");
		expect(out).toContain("critical");
		expect(out).toContain("Address security");
	});

	it("does not render CAPA section when capaItems is empty", () => {
		const data: GateResultModel = {
			projectLabel: "P",
			evaluation: { gates: [], allPassed: true, releaseEligible: true, capaItems: [] },
		};
		renderGateResult(data, log);
		expect(output()).not.toContain("Auto-CAPA items:");
	});

	it("renders multiple gates", () => {
		const data: GateResultModel = {
			projectLabel: "P",
			evaluation: {
				gates: [
					{ gate: "coverage", passed: true, details: "90%" },
					{ gate: "security", passed: false, details: "1 finding" },
					{ gate: "risk", passed: true, details: "all clear" },
				],
				allPassed: false,
				releaseEligible: false,
				capaItems: [],
			},
		};
		renderGateResult(data, log);
		const out = output();
		expect(out).toContain("coverage");
		expect(out).toContain("security");
		expect(out).toContain("risk");
	});
});

// ── renderTraceabilityMatrix ─────────────────────────────────────────

describe("renderTraceabilityMatrix", () => {
	function makeMatrix(overrides: Partial<TraceabilityModel["matrix"]> = {}): TraceabilityModel["matrix"] {
		return {
			rows: [],
			totalRequirements: 10,
			verified: 6,
			failed: 1,
			untested: 2,
			partial: 1,
			coveragePercent: 80,
			...overrides,
		};
	}

	it("renders header with project label", () => {
		const data: TraceabilityModel = {
			matrix: makeMatrix(),
			validation: { valid: true, errors: [], warnings: [] },
			projectLabel: "Flowti CLI",
		};
		renderTraceabilityMatrix(data, log);
		const out = output();
		expect(out).toContain("Traceability Matrix");
		expect(out).toContain("Flowti CLI");
	});

	it("renders requirement counts and coverage", () => {
		const data: TraceabilityModel = {
			matrix: makeMatrix({ totalRequirements: 20, verified: 15, partial: 2, failed: 1, untested: 2, coveragePercent: 90 }),
			validation: { valid: true, errors: [], warnings: [] },
			projectLabel: "P",
		};
		renderTraceabilityMatrix(data, log);
		const out = output();
		expect(out).toContain("20 total");
		expect(out).toContain("90%");
	});

	it("renders validation errors", () => {
		const data: TraceabilityModel = {
			matrix: makeMatrix(),
			validation: { valid: false, errors: ["Missing requirement REQ-01", "Orphan journey J-03"], warnings: [] },
			projectLabel: "P",
		};
		renderTraceabilityMatrix(data, log);
		const out = output();
		expect(out).toContain("Validation errors:");
		expect(out).toContain("Missing requirement REQ-01");
		expect(out).toContain("Orphan journey J-03");
	});

	it("renders validation warnings", () => {
		const data: TraceabilityModel = {
			matrix: makeMatrix(),
			validation: { valid: true, errors: [], warnings: ["Low coverage on domain X"] },
			projectLabel: "P",
		};
		renderTraceabilityMatrix(data, log);
		const out = output();
		expect(out).toContain("Warnings:");
		expect(out).toContain("Low coverage on domain X");
	});

	it("does not render errors or warnings when empty", () => {
		const data: TraceabilityModel = {
			matrix: makeMatrix(),
			validation: { valid: true, errors: [], warnings: [] },
			projectLabel: "P",
		};
		renderTraceabilityMatrix(data, log);
		const out = output();
		expect(out).not.toContain("Validation errors:");
		expect(out).not.toContain("Warnings:");
	});

	it("renders matrix rows", () => {
		const data: TraceabilityModel = {
			matrix: makeMatrix({
				rows: [
					{ requirementId: "REQ-001", status: "verified", journeys: ["J-01"], steps: ["step-a"] },
					{ requirementId: "REQ-002", status: "failed", journeys: ["J-02"], steps: ["step-b"] },
				],
			}),
			validation: { valid: true, errors: [], warnings: [] },
			projectLabel: "P",
		};
		renderTraceabilityMatrix(data, log);
		const out = output();
		expect(out).toContain("Requirement");
		expect(out).toContain("Status");
		expect(out).toContain("REQ-001");
		expect(out).toContain("verified");
		expect(out).toContain("J-01");
		expect(out).toContain("REQ-002");
		expect(out).toContain("failed");
	});

	it("renders dash when journey or step is missing", () => {
		const data: TraceabilityModel = {
			matrix: makeMatrix({
				rows: [{ requirementId: "REQ-003", status: "untested", journeys: [], steps: [] }],
			}),
			validation: { valid: true, errors: [], warnings: [] },
			projectLabel: "P",
		};
		renderTraceabilityMatrix(data, log);
		const out = output();
		expect(out).toContain("—");
	});

	it("does not render row table header when rows are empty", () => {
		const data: TraceabilityModel = {
			matrix: makeMatrix({ rows: [] }),
			validation: { valid: true, errors: [], warnings: [] },
			projectLabel: "P",
		};
		renderTraceabilityMatrix(data, log);
		expect(output()).not.toContain("Journey");
	});
});

// ── renderCoverageReport ─────────────────────────────────────────────

describe("renderCoverageReport", () => {
	function makeMatrix(overrides: Partial<CoverageModel["matrix"]> = {}): CoverageModel["matrix"] {
		return {
			rows: [],
			totalRequirements: 10,
			verified: 7,
			failed: 1,
			untested: 2,
			partial: 0,
			coveragePercent: 80,
			...overrides,
		};
	}

	it("renders header with project label", () => {
		const data: CoverageModel = { matrix: makeMatrix(), gaps: [], byCategory: [], projectLabel: "CLI" };
		renderCoverageReport(data, log);
		const out = output();
		expect(out).toContain("Requirement Coverage");
		expect(out).toContain("CLI");
	});

	it("renders requirement summary counts", () => {
		const data: CoverageModel = {
			matrix: makeMatrix({ totalRequirements: 20, verified: 14, partial: 2, failed: 1, untested: 3, coveragePercent: 85 }),
			gaps: [],
			byCategory: [],
			projectLabel: "P",
		};
		renderCoverageReport(data, log);
		const out = output();
		expect(out).toContain("20 total");
		expect(out).toContain("85%");
		expect(out).toContain("Untested: 3");
		expect(out).toContain("Failed: 1");
	});

	it("renders category coverage with progress bars", () => {
		const data: CoverageModel = {
			matrix: makeMatrix(),
			gaps: [],
			byCategory: [
				{ category: "functionality" as never, total: 10, verified: 8, percent: 80 },
				{ category: "reliability" as never, total: 5, verified: 3, percent: 60 },
			],
			projectLabel: "P",
		};
		renderCoverageReport(data, log);
		const out = output();
		expect(out).toContain("ISO 25010 Category Coverage:");
		expect(out).toContain("functionality");
		expect(out).toContain("80%");
		expect(out).toContain("8/10");
		expect(out).toContain("reliability");
		expect(out).toContain("60%");
		expect(out).toContain("3/5");
	});

	it("does not render category section when empty", () => {
		const data: CoverageModel = { matrix: makeMatrix(), gaps: [], byCategory: [], projectLabel: "P" };
		renderCoverageReport(data, log);
		expect(output()).not.toContain("ISO 25010 Category Coverage:");
	});

	it("renders gaps with no-journey reason", () => {
		const data: CoverageModel = {
			matrix: makeMatrix(),
			gaps: [{ requirementId: "REQ-005", reason: "no-journey" }],
			byCategory: [],
			projectLabel: "P",
		};
		renderCoverageReport(data, log);
		const out = output();
		expect(out).toContain("Gaps:");
		expect(out).toContain("REQ-005");
		expect(out).toContain("No journey linked");
	});

	it("renders gaps with failed reason", () => {
		const data: CoverageModel = {
			matrix: makeMatrix(),
			gaps: [{ requirementId: "REQ-006", reason: "failed" }],
			byCategory: [],
			projectLabel: "P",
		};
		renderCoverageReport(data, log);
		expect(output()).toContain("Last run failed");
	});

	it("renders gaps with no-steps reason", () => {
		const data: CoverageModel = {
			matrix: makeMatrix(),
			gaps: [{ requirementId: "REQ-007", reason: "no-steps" }],
			byCategory: [],
			projectLabel: "P",
		};
		renderCoverageReport(data, log);
		expect(output()).toContain("No steps verify");
	});

	it("does not render gaps section when empty", () => {
		const data: CoverageModel = { matrix: makeMatrix(), gaps: [], byCategory: [], projectLabel: "P" };
		renderCoverageReport(data, log);
		expect(output()).not.toContain("Gaps:");
	});
});

// ── renderEvidenceList ───────────────────────────────────────────────

describe("renderEvidenceList", () => {
	it("renders header with project label", () => {
		const data: EvidenceListModel = { runs: ["run-001"], projectLabel: "CLI" };
		renderEvidenceList(data, log);
		const out = output();
		expect(out).toContain("Evidence Runs");
		expect(out).toContain("CLI");
	});

	it("renders empty state when no runs", () => {
		const data: EvidenceListModel = { runs: [], projectLabel: "P" };
		renderEvidenceList(data, log);
		const out = output();
		expect(out).toContain("No evidence runs found.");
	});

	it("does not render total count when no runs", () => {
		const data: EvidenceListModel = { runs: [], projectLabel: "P" };
		renderEvidenceList(data, log);
		expect(output()).not.toContain("run(s) total");
	});

	it("renders run entries and total count", () => {
		const data: EvidenceListModel = { runs: ["run-001", "run-002", "run-003"], projectLabel: "P" };
		renderEvidenceList(data, log);
		const out = output();
		expect(out).toContain("run-001");
		expect(out).toContain("run-002");
		expect(out).toContain("run-003");
		expect(out).toContain("3 run(s) total");
	});
});
