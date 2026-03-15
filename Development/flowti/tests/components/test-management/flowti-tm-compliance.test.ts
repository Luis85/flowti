// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from "vitest";
import { fixture, cleanup, shadowQuery, shadowQueryAll, shadowText } from "../../components/test-utils";

import "../../../src/components/test-management/flowti-tm-compliance";

function makeScores() {
	return [
		{ standard: "iso-9001", total: 6, covered: 4, percentage: 67, gaps: ["gap1", "gap2"] },
		{ standard: "iso-27001", total: 5, covered: 5, percentage: 100, gaps: [] },
		{ standard: "iso-25010", total: 8, covered: 2, percentage: 25, gaps: ["g1", "g2", "g3", "g4", "g5", "g6"] },
	];
}

function makeCharacteristics() {
	return {
		"iso-9001": [
			{ id: "qms-1", standard: "iso-9001", name: "Customer Focus", description: "Desc", guidance: "Guide" },
			{ id: "qms-2", standard: "iso-9001", name: "Process Approach", description: "Desc", guidance: "Guide" },
		],
		"iso-27001": [
			{ id: "isms-1", standard: "iso-27001", name: "Risk Assessment", description: "Desc", guidance: "Guide" },
		],
		"iso-25010": [],
	};
}

function makeJourneys() {
	return [
		{ name: "Login", complianceTags: ["qms-1"], runHistory: [] },
		{ name: "Checkout", complianceTags: [], runHistory: [] },
	];
}

describe("flowti-tm-compliance", () => {
	afterEach(() => cleanup());

	it("is registered as a custom element", () => {
		expect(customElements.get("flowti-tm-compliance")).toBeDefined();
	});

	it("renders 3 standard cards", async () => {
		const el = await fixture("flowti-tm-compliance", {
			scores: makeScores(),
			characteristicsByStandard: makeCharacteristics(),
			journeys: makeJourneys(),
		});
		const cards = shadowQueryAll<HTMLElement>(el, ".standard-card");
		expect(cards).toHaveLength(3);
	});

	it("shows coverage percentage on each card", async () => {
		const el = await fixture("flowti-tm-compliance", {
			scores: makeScores(),
			characteristicsByStandard: makeCharacteristics(),
			journeys: makeJourneys(),
		});
		const text = shadowText(el);
		expect(text).toContain("67%");
		expect(text).toContain("100%");
	});

	it("clicking standard card shows characteristics detail", async () => {
		const el = await fixture("flowti-tm-compliance", {
			scores: makeScores(),
			characteristicsByStandard: makeCharacteristics(),
			journeys: makeJourneys(),
		});
		const cards = shadowQueryAll<HTMLElement>(el, ".standard-card");
		cards[0]?.click();
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const chars = shadowQueryAll<HTMLElement>(el, ".characteristic-row");
		expect(chars).toHaveLength(2);
	});

	it("expanding characteristic shows description and guidance", async () => {
		const el = await fixture("flowti-tm-compliance", {
			scores: makeScores(),
			characteristicsByStandard: makeCharacteristics(),
			journeys: makeJourneys(),
		});
		const cards = shadowQueryAll<HTMLElement>(el, ".standard-card");
		cards[0]?.click();
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const rows = shadowQueryAll<HTMLElement>(el, ".characteristic-row");
		rows[0]?.click();
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const text = shadowText(el);
		expect(text).toContain("Guide");
	});

	it("shows tagged journeys for covered characteristics", async () => {
		const el = await fixture("flowti-tm-compliance", {
			scores: makeScores(),
			characteristicsByStandard: makeCharacteristics(),
			journeys: makeJourneys(),
		});
		const cards = shadowQueryAll<HTMLElement>(el, ".standard-card");
		cards[0]?.click();
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const rows = shadowQueryAll<HTMLElement>(el, ".characteristic-row");
		rows[0]?.click();
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const tags = shadowQueryAll(el, ".compliance-tag");
		expect(tags.length).toBeGreaterThan(0);
	});

	it("emits remove-tag event when tag remove clicked", async () => {
		const handler = vi.fn();
		const el = await fixture("flowti-tm-compliance", {
			scores: makeScores(),
			characteristicsByStandard: makeCharacteristics(),
			journeys: makeJourneys(),
		});
		el.addEventListener("remove-tag", handler);
		shadowQueryAll<HTMLElement>(el, ".standard-card")[0]?.click();
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		shadowQueryAll<HTMLElement>(el, ".characteristic-row")[0]?.click();
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const removeBtn = shadowQuery<HTMLElement>(el, ".tag-remove");
		removeBtn?.click();
		expect(handler).toHaveBeenCalledTimes(1);
	});

	it("emits add-tag event when journey tagged", async () => {
		const handler = vi.fn();
		const el = await fixture("flowti-tm-compliance", {
			scores: makeScores(),
			characteristicsByStandard: makeCharacteristics(),
			journeys: makeJourneys(),
		});
		el.addEventListener("add-tag", handler);
		shadowQueryAll<HTMLElement>(el, ".standard-card")[0]?.click();
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		shadowQueryAll<HTMLElement>(el, ".characteristic-row")[1]?.click();
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const tagBtn = shadowQuery<HTMLElement>(el, ".tag-journey-btn");
		if (tagBtn) {
			tagBtn.click();
			await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
			const option = shadowQuery<HTMLElement>(el, ".journey-option");
			option?.click();
			expect(handler).toHaveBeenCalledTimes(1);
		}
	});
});
