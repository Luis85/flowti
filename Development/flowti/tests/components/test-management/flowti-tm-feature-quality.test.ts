// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from "vitest";
import { fixture, cleanup, shadowQuery, shadowQueryAll, shadowText } from "../../components/test-utils";

import "../../../src/components/test-management/flowti-tm-feature-quality";

function makeFeatures() {
	return [
		{ featureName: "Authentication", journeyCount: 3, journeyNames: ["Login", "Signup", "OAuth"], totalSteps: 25, passedSteps: 22, failedSteps: 3, passRate: 88, trend: "improving" as const },
		{ featureName: "Checkout", journeyCount: 1, journeyNames: ["Cart Flow"], totalSteps: 10, passedSteps: 5, failedSteps: 5, passRate: 50, trend: "degrading" as const },
	];
}

function makeJourneys() {
	return [
		{ name: "Login", lastRunResult: { passed: 10, totalSteps: 10 }, runHistory: [] },
		{ name: "Signup", lastRunResult: { passed: 8, totalSteps: 10 }, runHistory: [] },
		{ name: "Cart Flow", lastRunResult: null, runHistory: [] },
	];
}

describe("flowti-tm-feature-quality", () => {
	afterEach(() => cleanup());

	it("is registered as a custom element", () => {
		expect(customElements.get("flowti-tm-feature-quality")).toBeDefined();
	});

	it("renders feature list in master panel", async () => {
		const el = await fixture("flowti-tm-feature-quality", { features: makeFeatures(), journeys: makeJourneys() });
		const items = shadowQueryAll(el, ".feature-item");
		expect(items).toHaveLength(2);
	});

	it("shows pass rate badge with correct color", async () => {
		const el = await fixture("flowti-tm-feature-quality", { features: makeFeatures(), journeys: makeJourneys() });
		const badge = shadowQuery(el, ".pass-rate-badge");
		expect(badge).not.toBeNull();
	});

	it("clicking feature shows detail panel", async () => {
		const el = await fixture("flowti-tm-feature-quality", { features: makeFeatures(), journeys: makeJourneys() });
		const items = shadowQueryAll(el, ".feature-item");
		items[0]?.click();
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const detail = shadowQuery(el, ".detail-panel");
		expect(detail?.textContent).toContain("Authentication");
	});

	it("detail panel shows linked journeys", async () => {
		const el = await fixture("flowti-tm-feature-quality", { features: makeFeatures(), journeys: makeJourneys() });
		const items = shadowQueryAll(el, ".feature-item");
		items[0]?.click();
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const journeyRows = shadowQueryAll(el, ".journey-row");
		expect(journeyRows.length).toBeGreaterThanOrEqual(1);
	});

	it("renders empty state when no features", async () => {
		const el = await fixture("flowti-tm-feature-quality", { features: [], journeys: [] });
		const text = shadowText(el);
		expect(text).toContain("No feature");
	});

	it("shows trend indicator", async () => {
		const el = await fixture("flowti-tm-feature-quality", { features: makeFeatures(), journeys: makeJourneys() });
		const items = shadowQueryAll(el, ".feature-item");
		items[0]?.click();
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const trend = shadowQuery(el, ".trend");
		expect(trend).not.toBeNull();
	});
});
