import { describe, it, expect } from "vitest";
import { computeEnrichments } from "../../../src/domain/docs/traceLinkEnricher";
import type { DocumentMeta } from "../../../src/domain/docs/traceTypes";

function doc(id: string, type: DocumentMeta["type"], fm: Record<string, unknown>): DocumentMeta {
	return { id, type, frontmatter: fm };
}

describe("computeEnrichments", () => {
	it("adds planned_in when PBI appears in cycle's pbis array", () => {
		const docs = [
			doc("PBI-ONB-016 Command Catalog", "pbi", { stage: "planned", feature: "[[PRD]]" }),
			doc("Cycle 50 - User Activation", "cycle", {
				stage: "done",
				pbis: ["PBI-ONB-016: Command Catalog"],
			}),
		];

		const actions = computeEnrichments(docs);

		expect(actions).toHaveLength(1);
		expect(actions[0].documentId).toBe("PBI-ONB-016 Command Catalog");
		expect(actions[0].property).toBe("planned_in");
		expect(actions[0].value).toBe("Cycle 50 - User Activation");
	});

	it("skips planned_in when PBI already has it", () => {
		const docs = [
			doc("PBI-ONB-016 Command Catalog", "pbi", {
				stage: "planned",
				feature: "[[PRD]]",
				planned_in: "[[Cycle 50]]",
			}),
			doc("Cycle 50 - User Activation", "cycle", {
				stage: "done",
				pbis: ["PBI-ONB-016: Command Catalog"],
			}),
		];

		const actions = computeEnrichments(docs);
		expect(actions).toHaveLength(0);
	});

	it("adds resolved_in when TD appears in cycle's tech_debt array", () => {
		const docs = [
			doc("TD-87 Knowledge base expansion", "tech_debt", { status: "resolved" }),
			doc("Cycle 50 - User Activation", "cycle", {
				stage: "done",
				tech_debt: ["TD-87"],
			}),
		];

		const actions = computeEnrichments(docs);

		expect(actions).toHaveLength(1);
		expect(actions[0].documentId).toBe("TD-87 Knowledge base expansion");
		expect(actions[0].property).toBe("resolved_in");
		expect(actions[0].value).toBe("Cycle 50 - User Activation");
	});

	it("handles numeric tech_debt entries", () => {
		const docs = [
			doc("TD-87 Knowledge base expansion", "tech_debt", { status: "resolved" }),
			doc("Cycle 50 - User Activation", "cycle", {
				stage: "done",
				tech_debt: [87],
			}),
		];

		const actions = computeEnrichments(docs);

		expect(actions).toHaveLength(1);
		expect(actions[0].property).toBe("resolved_in");
	});

	it("skips resolved_in when TD already has it", () => {
		const docs = [
			doc("TD-87 Knowledge base expansion", "tech_debt", {
				status: "resolved",
				resolved_in: "[[Cycle 50]]",
			}),
			doc("Cycle 50 - User Activation", "cycle", {
				stage: "done",
				tech_debt: ["TD-87"],
			}),
		];

		const actions = computeEnrichments(docs);
		expect(actions).toHaveLength(0);
	});

	it("skips resolved_in when TD is not resolved", () => {
		const docs = [
			doc("TD-127 Performance observability", "tech_debt", { status: "open" }),
			doc("Cycle 50 - User Activation", "cycle", {
				stage: "done",
				tech_debt: ["TD-127"],
			}),
		];

		const actions = computeEnrichments(docs);
		expect(actions).toHaveLength(0);
	});

	it("returns empty for well-connected documents", () => {
		const docs = [
			doc("PBI-ONB-016 Command Catalog", "pbi", {
				stage: "delivered",
				feature: "[[PRD]]",
				planned_in: "[[Cycle 50]]",
			}),
			doc("TD-87 KB expansion", "tech_debt", {
				status: "resolved",
				resolved_in: "[[Cycle 50]]",
			}),
			doc("Cycle 50 - User Activation", "cycle", {
				stage: "done",
				pbis: ["PBI-ONB-016: Command Catalog"],
				tech_debt: ["TD-87"],
			}),
		];

		const actions = computeEnrichments(docs);
		expect(actions).toHaveLength(0);
	});

	it("returns empty for empty input", () => {
		const actions = computeEnrichments([]);
		expect(actions).toHaveLength(0);
	});

	it("handles PBI with no extractable ID", () => {
		const docs = [
			doc("Random Document", "pbi", { stage: "planned", feature: "[[PRD]]" }),
			doc("Cycle 50", "cycle", { stage: "done", pbis: ["PBI-ONB-016: Something"] }),
		];

		const actions = computeEnrichments(docs);
		expect(actions).toHaveLength(0);
	});
});
