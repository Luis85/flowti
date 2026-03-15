// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from "vitest";
import { fixture, cleanup, shadowQuery, shadowQueryAll, shadowText } from "../../components/test-utils";

import "../../../src/components/test-management/flowti-tm-pyramid";

function makePyramid() {
	return {
		e2e: { count: 5, passRate: 80, trend: "up" as const },
		flow: { count: 12, passRate: 95, trend: "stable" as const },
		unit: { count: 45, passRate: 99, trend: "down" as const },
	};
}

function makeJourneys() {
	return [
		{ name: "Login", type: "functional", stepCount: 10, actors: [], services: [], tools: [], complianceTags: [], jsonPath: "", runHistory: [], lastRunResult: { date: "2026-03-15", totalSteps: 10, passed: 10, failed: 0, skipped: 0, durationMs: 500 } },
		{ name: "Checkout", type: "regression", stepCount: 8, actors: [], services: [], tools: [], complianceTags: [], jsonPath: "", runHistory: [], lastRunResult: { date: "2026-03-14", totalSteps: 8, passed: 6, failed: 2, skipped: 0, durationMs: 800 } },
	];
}

describe("flowti-tm-pyramid", () => {
	afterEach(() => cleanup());

	it("is registered as a custom element", () => {
		expect(customElements.get("flowti-tm-pyramid")).toBeDefined();
	});

	it("renders 3 layer cards", async () => {
		const el = await fixture("flowti-tm-pyramid", { pyramid: makePyramid(), journeys: makeJourneys() });
		const cards = shadowQueryAll(el, ".layer-card");
		expect(cards).toHaveLength(3);
	});

	it("marks first card as active by default", async () => {
		const el = await fixture("flowti-tm-pyramid", { pyramid: makePyramid(), journeys: makeJourneys() });
		const active = shadowQuery(el, ".layer-card.active");
		expect(active).not.toBeNull();
	});

	it("shows trend indicator when baseline exists", async () => {
		const el = await fixture("flowti-tm-pyramid", { pyramid: makePyramid(), journeys: makeJourneys(), hasBaseline: true });
		const trends = shadowQueryAll(el, ".trend");
		expect(trends.length).toBeGreaterThan(0);
	});

	it("clicking a layer card selects it and shows drill-down", async () => {
		const el = await fixture("flowti-tm-pyramid", { pyramid: makePyramid(), journeys: makeJourneys() });
		const cards = shadowQueryAll<HTMLElement>(el, ".layer-card");
		cards[1]?.click();
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const active = shadowQuery(el, ".layer-card.active");
		expect(active?.textContent).toContain("Flow");
	});

	it("E2E drill-down shows journey list", async () => {
		const el = await fixture("flowti-tm-pyramid", { pyramid: makePyramid(), journeys: makeJourneys() });
		const rows = shadowQueryAll(el, ".drilldown-row");
		expect(rows.length).toBeGreaterThan(0);
	});

	it("renders progress bars with correct widths", async () => {
		const el = await fixture("flowti-tm-pyramid", { pyramid: makePyramid(), journeys: makeJourneys() });
		const bar = shadowQuery<HTMLElement>(el, ".pyramid-bar");
		expect(bar?.style.width).toBe("80%");
	});

	it("emits set-baseline event on button click", async () => {
		const handler = vi.fn();
		const el = await fixture("flowti-tm-pyramid", { pyramid: makePyramid(), journeys: makeJourneys() });
		el.addEventListener("set-baseline", handler);
		const btn = shadowQuery<HTMLButtonElement>(el, ".baseline-btn");
		btn?.click();
		expect(handler).toHaveBeenCalledTimes(1);
	});

	it("shows dimmed style when layer count is 0", async () => {
		const pyramid = { ...makePyramid(), flow: { count: 0, passRate: 0, trend: "stable" as const } };
		const el = await fixture("flowti-tm-pyramid", { pyramid, journeys: makeJourneys() });
		const dimmed = shadowQuery(el, ".layer-card.dimmed");
		expect(dimmed).not.toBeNull();
	});

	it("renders empty state when no journeys", async () => {
		const el = await fixture("flowti-tm-pyramid", { pyramid: makePyramid(), journeys: [] });
		const text = shadowText(el);
		expect(text).toContain("No journeys");
	});
});
