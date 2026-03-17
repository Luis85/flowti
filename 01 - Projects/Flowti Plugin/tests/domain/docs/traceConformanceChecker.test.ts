import { describe, it, expect } from "vitest";
import { checkConformance } from "../../../src/domain/docs/traceConformanceChecker";
import type { DocumentMeta } from "../../../src/domain/docs/traceTypes";

function doc(id: string, type: DocumentMeta["type"], fm: Record<string, unknown>): DocumentMeta {
	return { id, type, frontmatter: fm };
}

describe("checkConformance", () => {
	describe("inbox items", () => {
		it("flags inbox items without parent link", () => {
			const docs = [doc("Feature Request", "inbox", { stage: "planned" })];
			const report = checkConformance(docs);

			expect(report.gaps_found).toBe(1);
			expect(report.gaps[0].gapType).toBe("unlinked_inbox");
			expect(report.gaps[0].documentId).toBe("Feature Request");
		});

		it("does not flag inbox items with parent link", () => {
			const docs = [doc("Feature Request", "inbox", { stage: "planned", parent: "[[Some PRD]]" })];
			const report = checkConformance(docs);
			expect(report.gaps_found).toBe(0);
		});

		it("does not flag backlog inbox items without parent", () => {
			const docs = [doc("Raw Idea", "inbox", { stage: "backlog" })];
			const report = checkConformance(docs);
			expect(report.gaps_found).toBe(0);
		});
	});

	describe("PBIs", () => {
		it("flags delivered PBI without delivered_in", () => {
			const docs = [doc("PBI-ONB-001", "pbi", { stage: "delivered", feature: "[[PRD]]" })];
			const report = checkConformance(docs);

			expect(report.gaps_found).toBe(1);
			expect(report.gaps[0].gapType).toBe("delivered_without_cycle");
		});

		it("does not flag delivered PBI with delivered_in", () => {
			const docs = [doc("PBI-ONB-001", "pbi", {
				stage: "delivered",
				feature: "[[PRD]]",
				delivered_in: "[[Cycle 50]]",
			})];
			const report = checkConformance(docs);
			expect(report.gaps_found).toBe(0);
		});

		it("flags PBI without feature link", () => {
			const docs = [doc("PBI-ONB-001", "pbi", { stage: "planned" })];
			const report = checkConformance(docs);

			expect(report.gaps.some((g) => g.gapType === "orphaned_pbi")).toBe(true);
		});

		it("does not flag planned PBI without delivered_in", () => {
			const docs = [doc("PBI-ONB-001", "pbi", { stage: "planned", feature: "[[PRD]]" })];
			const report = checkConformance(docs);
			expect(report.gaps_found).toBe(0);
		});
	});

	describe("cycles", () => {
		it("flags completed cycle without PBI refs", () => {
			const docs = [doc("Cycle 50", "cycle", { stage: "done", pbis: [] })];
			const report = checkConformance(docs);

			expect(report.gaps_found).toBe(1);
			expect(report.gaps[0].gapType).toBe("cycle_without_pbi_refs");
		});

		it("does not flag completed cycle with PBI refs", () => {
			const docs = [doc("Cycle 50", "cycle", { stage: "done", pbis: ["PBI-A"] })];
			const report = checkConformance(docs);
			expect(report.gaps_found).toBe(0);
		});

		it("does not flag planning cycle without PBI refs", () => {
			const docs = [doc("Cycle 51", "cycle", { stage: "planning", pbis: [] })];
			const report = checkConformance(docs);
			expect(report.gaps_found).toBe(0);
		});
	});

	describe("tech debt", () => {
		it("flags resolved TD without resolved_in", () => {
			const docs = [doc("TD-87", "tech_debt", { status: "resolved" })];
			const report = checkConformance(docs);

			expect(report.gaps_found).toBe(1);
			expect(report.gaps[0].gapType).toBe("resolved_debt_without_cycle");
		});

		it("does not flag resolved TD with resolved_in", () => {
			const docs = [doc("TD-87", "tech_debt", { status: "resolved", resolved_in: "[[Cycle 50]]" })];
			const report = checkConformance(docs);
			expect(report.gaps_found).toBe(0);
		});

		it("does not flag open TD without resolved_in", () => {
			const docs = [doc("TD-127", "tech_debt", { status: "open" })];
			const report = checkConformance(docs);
			expect(report.gaps_found).toBe(0);
		});

		it("handles stage field as fallback for status", () => {
			const docs = [doc("TD-87", "tech_debt", { stage: "resolved" })];
			const report = checkConformance(docs);

			expect(report.gaps_found).toBe(1);
			expect(report.gaps[0].gapType).toBe("resolved_debt_without_cycle");
		});
	});

	describe("aggregate", () => {
		it("counts documents_scanned correctly", () => {
			const docs = [
				doc("A", "inbox", { stage: "planned", parent: "[[PRD]]" }),
				doc("B", "pbi", { stage: "planned", feature: "[[PRD]]" }),
				doc("C", "cycle", { stage: "done", pbis: ["PBI-A"] }),
			];
			const report = checkConformance(docs);
			expect(report.documents_scanned).toBe(3);
		});

		it("returns zero gaps for well-connected documents", () => {
			const docs = [
				doc("Idea", "inbox", { stage: "delivered", parent: "[[PRD]]" }),
				doc("PBI-ONB-001", "pbi", { stage: "delivered", feature: "[[PRD]]", delivered_in: "[[Cycle 50]]" }),
				doc("Cycle 50", "cycle", { stage: "done", pbis: ["PBI-ONB-001"] }),
				doc("TD-87", "tech_debt", { status: "resolved", resolved_in: "[[Cycle 50]]" }),
			];
			const report = checkConformance(docs);
			expect(report.gaps_found).toBe(0);
		});

		it("returns empty report for empty input", () => {
			const report = checkConformance([]);
			expect(report.documents_scanned).toBe(0);
			expect(report.gaps_found).toBe(0);
			expect(report.gaps).toEqual([]);
		});
	});
});
