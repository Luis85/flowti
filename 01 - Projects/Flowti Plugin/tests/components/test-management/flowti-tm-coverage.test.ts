// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from "vitest";
import { fixture, cleanup, shadowQuery, shadowQueryAll, shadowText } from "../../components/test-utils";

import "../../../src/components/test-management/flowti-tm-coverage";

function makeCoverageEntries() {
	return [
		{ prdName: "User Auth", prdStage: "active", domain: "security", journeyCount: 3, journeyNames: ["Login", "Signup", "OAuth"], status: "covered" as const },
		{ prdName: "Payments", prdStage: "draft", domain: "billing", journeyCount: 1, journeyNames: ["Checkout"], status: "partial" as const },
		{ prdName: "Reports", prdStage: "active", domain: "analytics", journeyCount: 0, journeyNames: [], status: "uncovered" as const },
	];
}

describe("flowti-tm-coverage", () => {
	afterEach(() => cleanup());

	it("is registered as a custom element", () => {
		expect(customElements.get("flowti-tm-coverage")).toBeDefined();
	});

	it("renders PRD list in master panel", async () => {
		const el = await fixture("flowti-tm-coverage", { coverageEntries: makeCoverageEntries() });
		const rows = shadowQueryAll<HTMLElement>(el, ".prd-row");
		expect(rows).toHaveLength(3);
	});

	it("shows coverage status badges (covered/partial/uncovered)", async () => {
		const el = await fixture("flowti-tm-coverage", { coverageEntries: makeCoverageEntries() });
		const badges = shadowQueryAll(el, ".coverage-badge");
		expect(badges).toHaveLength(3);
	});

	it("clicking PRD shows detail panel", async () => {
		const el = await fixture("flowti-tm-coverage", { coverageEntries: makeCoverageEntries() });
		const rows = shadowQueryAll<HTMLElement>(el, ".prd-row");
		rows[0]?.click();
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const detail = shadowQuery(el, ".detail-panel");
		expect(detail?.textContent).toContain("User Auth");
	});

	it("detail panel shows linked journeys", async () => {
		const el = await fixture("flowti-tm-coverage", { coverageEntries: makeCoverageEntries() });
		const rows = shadowQueryAll<HTMLElement>(el, ".prd-row");
		rows[0]?.click();
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const text = shadowText(el);
		expect(text).toContain("Login");
	});

	it("detail panel shows domain coverage bars", async () => {
		const el = await fixture("flowti-tm-coverage", { coverageEntries: makeCoverageEntries() });
		const rows = shadowQueryAll<HTMLElement>(el, ".prd-row");
		rows[0]?.click();
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const domainRows = shadowQueryAll(el, ".domain-row");
		expect(domainRows.length).toBeGreaterThanOrEqual(1);
	});

	it("renders coverage gaps section", async () => {
		const el = await fixture("flowti-tm-coverage", { coverageEntries: makeCoverageEntries() });
		const rows = shadowQueryAll<HTMLElement>(el, ".prd-row");
		rows[0]?.click();
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const gaps = shadowQuery(el, ".gaps-section");
		expect(gaps).not.toBeNull();
	});

	it("renders empty state when no entries", async () => {
		const el = await fixture("flowti-tm-coverage", { coverageEntries: [] });
		const text = shadowText(el);
		expect(text).toContain("No PRD");
	});
});
