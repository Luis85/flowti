// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from "vitest";
import "../../../src/components/user/flowti-user-health";
import { fixture, cleanup, shadowQuery, shadowQueryAll } from "../test-utils";

interface HealthEl extends HTMLElement {
	healthItems: unknown[];
	searchText: string;
	selectedId: string | null;
	updateComplete: Promise<boolean>;
}

function makeHealthItem(overrides: Record<string, unknown> = {}) {
	return {
		id: "h1",
		name: "Domain Health",
		description: "Checks domain entity coverage",
		count: 5,
		status: "healthy",
		...overrides,
	};
}

describe("flowti-user-health", () => {
	afterEach(() => cleanup());

	it("is defined as a custom element", () => {
		expect(customElements.get("flowti-user-health")).toBeDefined();
	});

	it("renders health items", async () => {
		const el = await fixture<HealthEl>("flowti-user-health", {
			healthItems: [makeHealthItem(), makeHealthItem({ id: "h2", name: "Service Health" })],
			searchText: "",
			selectedId: null,
		});

		const items = shadowQueryAll(el, ".health-item");
		expect(items.length).toBe(2);
	});

	it("filters items by searchText", async () => {
		const el = await fixture<HealthEl>("flowti-user-health", {
			healthItems: [
				makeHealthItem({ name: "Domain Health", description: "Checks domain entities" }),
				makeHealthItem({ id: "h2", name: "Service Health", description: "Checks service endpoints" }),
			],
			searchText: "domain",
			selectedId: null,
		});

		const items = shadowQueryAll(el, ".health-item");
		expect(items.length).toBe(1);
		expect(items[0].textContent).toContain("Domain Health");
	});

	it("marks selected item", async () => {
		const el = await fixture<HealthEl>("flowti-user-health", {
			healthItems: [makeHealthItem()],
			searchText: "",
			selectedId: "h1",
		});

		const selected = shadowQuery(el, ".health-item--selected");
		expect(selected).not.toBeNull();
	});

	it("dispatches item-selected on click", async () => {
		const el = await fixture<HealthEl>("flowti-user-health", {
			healthItems: [makeHealthItem()],
			searchText: "",
			selectedId: null,
		});

		let detail: unknown = null;
		el.addEventListener("item-selected", ((e: CustomEvent) => {
			detail = e.detail;
		}) as EventListener);

		const item = shadowQuery(el, ".health-item");
		item?.dispatchEvent(new Event("click", { bubbles: true }));
		expect(detail).toEqual({ id: "h1", name: "Domain Health" });
	});

	it("renders detail for selected item", async () => {
		const el = await fixture<HealthEl>("flowti-user-health", {
			healthItems: [makeHealthItem({ name: "Domain Health", description: "Checks domains", count: 5 })],
			searchText: "",
			selectedId: "h1",
		});

		const detail = shadowQuery(el, ".detail-section");
		expect(detail).not.toBeNull();
		expect(detail!.textContent).toContain("Domain Health");
		expect(detail!.textContent).toContain("5");
	});

	it("renders empty state when no items", async () => {
		const el = await fixture<HealthEl>("flowti-user-health", {
			healthItems: [],
			searchText: "",
			selectedId: null,
			isEmpty: true,
		});

		const empty = shadowQuery(el, ".flowti-empty");
		expect(empty).not.toBeNull();
	});

	it("renders count badge on health items", async () => {
		const el = await fixture<HealthEl>("flowti-user-health", {
			healthItems: [makeHealthItem({ count: 42 })],
			searchText: "",
			selectedId: null,
		});

		const badge = shadowQuery(el, ".count-badge");
		expect(badge).not.toBeNull();
		expect(badge!.textContent).toContain("42");
	});
});
