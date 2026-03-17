import { describe, it, expect } from "vitest";
import { checkCompliance, computeScore, getGaps } from "../../../src/domain/testManagement/complianceChecker";
import { COMPLIANCE_CHARACTERISTICS } from "../../../src/domain/testManagement/complianceDefinitions";
import type { ComplianceCharacteristic } from "../../../src/domain/testManagement/types";

describe("checkCompliance", () => {
	it("returns one score per standard (3 total)", () => {
		const scores = checkCompliance(COMPLIANCE_CHARACTERISTICS, {});
		expect(scores).toHaveLength(3);
		expect(scores.map((s) => s.standard)).toEqual(["iso-9001", "iso-27001", "iso-25010"]);
	});

	it("reports all as gaps when no journeys are tagged", () => {
		const scores = checkCompliance(COMPLIANCE_CHARACTERISTICS, {});
		expect(scores[0].covered).toBe(0);
		expect(scores[0].gaps.length).toBe(scores[0].total);
	});

	it("marks covered characteristics from tagged journeys", () => {
		const tags = {
			"Getting Started": ["iso-9001:customer-focus", "iso-25010:usability"],
			"Analytics E2E": ["iso-9001:evidence-based-decisions"],
		};
		const scores = checkCompliance(COMPLIANCE_CHARACTERISTICS, tags);

		const iso9001 = scores.find((s) => s.standard === "iso-9001")!;
		expect(iso9001.covered).toBe(2);
		expect(iso9001.gaps).not.toContain("iso-9001:customer-focus");
		expect(iso9001.gaps).not.toContain("iso-9001:evidence-based-decisions");

		const iso25010 = scores.find((s) => s.standard === "iso-25010")!;
		expect(iso25010.covered).toBe(1);
	});

	it("counts each characteristic only once even if multiple journeys tag it", () => {
		const tags = {
			"Journey A": ["iso-9001:customer-focus"],
			"Journey B": ["iso-9001:customer-focus"],
		};
		const scores = checkCompliance(COMPLIANCE_CHARACTERISTICS, tags);
		const iso9001 = scores.find((s) => s.standard === "iso-9001")!;
		expect(iso9001.covered).toBe(1);
	});
});

describe("computeScore", () => {
	const chars: ComplianceCharacteristic[] = [
		{ id: "a", standard: "iso-9001", name: "A", description: "", guidance: "" },
		{ id: "b", standard: "iso-9001", name: "B", description: "", guidance: "" },
		{ id: "c", standard: "iso-9001", name: "C", description: "", guidance: "" },
	];

	it("computes percentage correctly", () => {
		const score = computeScore("iso-9001", chars, new Set(["a", "c"]));
		expect(score.covered).toBe(2);
		expect(score.total).toBe(3);
		expect(score.percentage).toBe(67);
		expect(score.gaps).toEqual(["b"]);
	});

	it("handles empty characteristics", () => {
		const score = computeScore("iso-9001", [], new Set());
		expect(score.total).toBe(0);
		expect(score.percentage).toBe(0);
	});

	it("100% when all covered", () => {
		const score = computeScore("iso-9001", chars, new Set(["a", "b", "c"]));
		expect(score.percentage).toBe(100);
		expect(score.gaps).toEqual([]);
	});
});

describe("getGaps", () => {
	it("returns full characteristic objects for gap IDs", () => {
		const defs: ComplianceCharacteristic[] = [
			{ id: "a", standard: "iso-9001", name: "A", description: "Desc A", guidance: "Guide A" },
			{ id: "b", standard: "iso-9001", name: "B", description: "Desc B", guidance: "Guide B" },
		];
		const score = { standard: "iso-9001", total: 2, covered: 1, percentage: 50, gaps: ["b"] };
		const gaps = getGaps(score, defs);

		expect(gaps).toHaveLength(1);
		expect(gaps[0].id).toBe("b");
		expect(gaps[0].name).toBe("B");
	});

	it("returns empty array when no gaps", () => {
		const score = { standard: "iso-9001", total: 1, covered: 1, percentage: 100, gaps: [] };
		expect(getGaps(score, [])).toEqual([]);
	});
});
