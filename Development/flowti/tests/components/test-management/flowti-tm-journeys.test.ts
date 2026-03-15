// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from "vitest";
import { fixture, cleanup, shadowQuery, shadowQueryAll, shadowText } from "../../components/test-utils";

import "../../../src/components/test-management/flowti-tm-journeys";

function makeJourneys() {
	return [
		{
			name: "Login Flow", type: "functional", category: "auth", domain: "security",
			chapter: 1, stepCount: 10, actors: ["user"], services: ["auth-svc"], tools: ["click", "type"],
			jsonPath: "/journeys/login.json", canvasPath: "/journeys/login.canvas",
			complianceTags: ["qms-1"], runHistory: [
				{ date: "2026-03-15", totalSteps: 10, passed: 10, failed: 0, skipped: 0, durationMs: 1200 },
				{ date: "2026-03-14", totalSteps: 10, passed: 9, failed: 1, skipped: 0, durationMs: 1500 },
			],
			lastRunResult: { date: "2026-03-15", totalSteps: 10, passed: 10, failed: 0, skipped: 0, durationMs: 1200 },
		},
		{
			name: "Checkout", type: "regression", domain: "billing", stepCount: 8,
			actors: [], services: [], tools: [], complianceTags: [], jsonPath: "/j/checkout.json",
			runHistory: [], lastRunResult: null,
		},
	];
}

describe("flowti-tm-journeys", () => {
	afterEach(() => cleanup());

	it("is registered as a custom element", () => {
		expect(customElements.get("flowti-tm-journeys")).toBeDefined();
	});

	it("renders journey list", async () => {
		const el = await fixture("flowti-tm-journeys", { journeys: makeJourneys() });
		const rows = shadowQueryAll(el, ".journey-row");
		expect(rows).toHaveLength(2);
	});

	it("shows status badge per journey", async () => {
		const el = await fixture("flowti-tm-journeys", { journeys: makeJourneys() });
		const badges = shadowQueryAll(el, ".status-badge");
		expect(badges.length).toBeGreaterThanOrEqual(2);
	});

	it("clicking journey shows detail panel", async () => {
		const el = await fixture("flowti-tm-journeys", { journeys: makeJourneys() });
		const rows = shadowQueryAll(el, ".journey-row");
		rows[0]?.click();
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const detail = shadowQuery(el, ".detail-panel");
		expect(detail?.textContent).toContain("Login Flow");
	});

	it("detail panel shows run history", async () => {
		const el = await fixture("flowti-tm-journeys", { journeys: makeJourneys() });
		shadowQueryAll(el, ".journey-row")[0]?.click();
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const historyRows = shadowQueryAll(el, ".run-history-row");
		expect(historyRows).toHaveLength(2);
	});

	it("detail panel shows traceability (actors, services, tools)", async () => {
		const el = await fixture("flowti-tm-journeys", { journeys: makeJourneys() });
		shadowQueryAll(el, ".journey-row")[0]?.click();
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const text = shadowText(el);
		expect(text).toContain("user");
		expect(text).toContain("auth-svc");
	});

	it("renders filter controls (type + status)", async () => {
		const el = await fixture("flowti-tm-journeys", { journeys: makeJourneys() });
		const selects = shadowQueryAll(el, "select");
		expect(selects.length).toBeGreaterThanOrEqual(2);
	});

	it("type filter narrows list", async () => {
		const el = await fixture("flowti-tm-journeys", { journeys: makeJourneys() });
		const typeSelect = shadowQueryAll<HTMLSelectElement>(el, "select")[0];
		if (typeSelect) {
			typeSelect.value = "functional";
			typeSelect.dispatchEvent(new Event("change"));
			await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
			const rows = shadowQueryAll(el, ".journey-row");
			expect(rows).toHaveLength(1);
		}
	});

	it("searchText property filters by name", async () => {
		const el = await fixture("flowti-tm-journeys", { journeys: makeJourneys(), searchText: "Login" });
		const rows = shadowQueryAll(el, ".journey-row");
		expect(rows).toHaveLength(1);
	});

	it("emits run-journey event", async () => {
		const handler = vi.fn();
		const el = await fixture("flowti-tm-journeys", { journeys: makeJourneys() });
		el.addEventListener("run-journey", handler);
		shadowQueryAll(el, ".journey-row")[0]?.click();
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const btn = shadowQuery(el, ".run-btn");
		btn?.click();
		expect(handler).toHaveBeenCalledTimes(1);
	});

	it("emits request-review event", async () => {
		const handler = vi.fn();
		const el = await fixture("flowti-tm-journeys", { journeys: makeJourneys() });
		el.addEventListener("request-review", handler);
		shadowQueryAll(el, ".journey-row")[0]?.click();
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const btn = shadowQuery(el, ".review-btn");
		btn?.click();
		expect(handler).toHaveBeenCalledTimes(1);
	});

	it("emits open-builder event", async () => {
		const handler = vi.fn();
		const el = await fixture("flowti-tm-journeys", { journeys: makeJourneys() });
		el.addEventListener("open-builder", handler);
		shadowQueryAll(el, ".journey-row")[0]?.click();
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const btn = shadowQuery(el, ".builder-btn");
		btn?.click();
		expect(handler).toHaveBeenCalledTimes(1);
	});

	it("renders empty state when no journeys", async () => {
		const el = await fixture("flowti-tm-journeys", { journeys: [] });
		const text = shadowText(el);
		expect(text).toContain("No journeys");
	});
});
