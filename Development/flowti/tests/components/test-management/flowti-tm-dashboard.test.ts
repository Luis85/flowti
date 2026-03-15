// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from "vitest";
import { fixture, cleanup, shadowQuery, shadowQueryAll, shadowText } from "../test-utils";

import "../../../src/components/test-management/flowti-tm-dashboard";

function makePyramid() {
	return {
		e2e: { count: 5, passRate: 80, trend: "up" as const },
		flow: { count: 12, passRate: 95, trend: "stable" as const },
		unit: { count: 45, passRate: 99, trend: "stable" as const },
	};
}

function makeJourneys() {
	return [
		{ name: "Login Flow", type: "functional", lastRunResult: { date: "2026-03-15", totalSteps: 10, passed: 10, failed: 0, skipped: 0, durationMs: 1200 }, runHistory: [] },
		{ name: "Checkout", type: "regression", lastRunResult: { date: "2026-03-14", totalSteps: 8, passed: 6, failed: 2, skipped: 0, durationMs: 800 }, runHistory: [] },
	];
}

describe("flowti-tm-dashboard", () => {
	afterEach(() => cleanup());

	it("is registered as a custom element", () => {
		expect(customElements.get("flowti-tm-dashboard")).toBeDefined();
	});

	it("renders KPI stat cards when journeys provided", async () => {
		const el = await fixture("flowti-tm-dashboard", {
			journeys: makeJourneys(),
			pyramid: makePyramid(),
		});
		const cards = shadowQueryAll(el, ".kpi-card");
		expect(cards.length).toBeGreaterThanOrEqual(3);
	});

	it("renders mini pyramid with 3 rows", async () => {
		const el = await fixture("flowti-tm-dashboard", {
			journeys: makeJourneys(),
			pyramid: makePyramid(),
		});
		const rows = shadowQueryAll(el, ".pyramid-row");
		expect(rows).toHaveLength(3);
	});

	it("renders recent runs section", async () => {
		const el = await fixture("flowti-tm-dashboard", {
			journeys: makeJourneys(),
			pyramid: makePyramid(),
			recentRuns: makeJourneys(),
		});
		const items = shadowQueryAll(el, ".run-item");
		expect(items).toHaveLength(2);
	});

	it("renders empty state when no journeys", async () => {
		const el = await fixture("flowti-tm-dashboard", {
			journeys: [],
			pyramid: makePyramid(),
		});
		const text = shadowText(el);
		expect(text).toContain("No journeys");
	});

	it("emits navigate-to-tab when KPI card clicked", async () => {
		const handler = vi.fn();
		const el = await fixture("flowti-tm-dashboard", {
			journeys: makeJourneys(),
			pyramid: makePyramid(),
		});
		el.addEventListener("navigate-to-tab", handler);
		const card = shadowQuery(el, ".kpi-card");
		card?.click();
		expect(handler).toHaveBeenCalledTimes(1);
	});

	it("shows onboarding callout when onboardingVisible is true", async () => {
		const el = await fixture("flowti-tm-dashboard", {
			journeys: [],
			pyramid: makePyramid(),
			onboardingVisible: true,
		});
		const callout = shadowQuery(el, ".onboarding-callout");
		expect(callout).not.toBeNull();
	});

	it("hides onboarding callout when onboardingVisible is false", async () => {
		const el = await fixture("flowti-tm-dashboard", {
			journeys: [],
			pyramid: makePyramid(),
			onboardingVisible: false,
		});
		const callout = shadowQuery(el, ".onboarding-callout");
		expect(callout).toBeNull();
	});
});
