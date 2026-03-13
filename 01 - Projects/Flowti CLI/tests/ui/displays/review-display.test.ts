import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/infrastructure/logger.js", () => ({ log: vi.fn() }));
vi.mock("../../../src/infrastructure/ui.js", () => ({
	RESET: "", BOLD: "", DIM: "", GREEN: "", RED: "", YELLOW: "", CYAN: "", BLUE: "", MAGENTA: "", WHITE: "", UNDERLINE: "",
	printHeader: vi.fn(), printSection: vi.fn(), printDivider: vi.fn(),
}));

import { log } from "../../../src/infrastructure/logger.js";
import { renderChangeAnalysis, renderReviewClean } from "../../../src/ui/displays/review-display.js";
import type { ChangeAnalysisModel, ReviewCleanModel } from "../../../src/ui/displays/review-display.js";

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
		renderChangeAnalysis(data);
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
		renderChangeAnalysis(data);
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
		renderChangeAnalysis(data);
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
		renderChangeAnalysis(data);
		expect(output()).toContain("Affected domains:");
		expect(output()).toContain("source, tests");
	});

	it("does not render affected domains when empty", () => {
		const data: ChangeAnalysisModel = {
			projectLabel: "P",
			impact: { summary: "None.", changedFiles: [], affectedDomains: [], suggestedActions: [] },
		};
		renderChangeAnalysis(data);
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
		renderChangeAnalysis(data);
		expect(output()).toContain("Suggested actions:");
		expect(output()).toContain("build, test");
	});

	it("does not render suggested actions when empty", () => {
		const data: ChangeAnalysisModel = {
			projectLabel: "P",
			impact: { summary: "None.", changedFiles: [], affectedDomains: [], suggestedActions: [] },
		};
		renderChangeAnalysis(data);
		expect(output()).not.toContain("Suggested actions:");
	});
});

// ── renderReviewClean ────────────────────────────────────────────────

describe("renderReviewClean", () => {
	it("renders removed message when vault was removed", () => {
		const data: ReviewCleanModel = { removed: true, vaultPath: "/tmp/test-vault" };
		renderReviewClean(data);
		const out = output();
		expect(out).toContain("Removed");
		expect(out).toContain("/tmp/test-vault");
	});

	it("renders warning when vault does not exist", () => {
		const data: ReviewCleanModel = { removed: false, vaultPath: "/tmp/missing-vault" };
		renderReviewClean(data);
		const out = output();
		expect(out).toContain("Test vault does not exist");
		expect(out).toContain("/tmp/missing-vault");
	});
});
