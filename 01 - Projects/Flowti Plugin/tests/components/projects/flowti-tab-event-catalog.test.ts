// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import "../../../src/components/projects/flowti-tab-event-catalog.js";

type LitEl = HTMLElement & Record<string, unknown> & { updateComplete: Promise<boolean> };

describe("flowti-tab-event-catalog", () => {
	let el: LitEl;

	beforeEach(() => {
		el = document.createElement("flowti-tab-event-catalog") as LitEl;
		document.body.appendChild(el);
	});

	afterEach(() => { el.remove(); });

	it("is defined as a custom element", () => {
		expect(customElements.get("flowti-tab-event-catalog")).toBeDefined();
	});

	it("renders select options for entity types", async () => {
		await el.updateComplete;
		const shadow = el.shadowRoot!;
		expect(shadow.textContent).toContain("Domains");
		expect(shadow.textContent).toContain("Services");
		expect(shadow.textContent).toContain("Events");
		expect(shadow.textContent).toContain("Flows");
	});

	it("defaults to domains in the select", async () => {
		await el.updateComplete;
		const select = el.shadowRoot!.querySelector("select") as HTMLSelectElement;
		expect(select?.value).toBe("domains");
	});

	it("switches entity type on select change", async () => {
		await el.updateComplete;
		let detail: unknown = null;
		el.addEventListener("catalog-list-refresh", ((e: CustomEvent) => { detail = e.detail; }) as EventListener);
		const select = el.shadowRoot!.querySelector("select") as HTMLSelectElement;
		select.value = "events";
		select.dispatchEvent(new Event("change"));
		expect(detail).toEqual({ entityType: "events" });
	});

	it("shows entity list when entities provided", async () => {
		el.entities = [{ name: "Auth", type: "Domain", status: "active", date: "2026-03-20", path: "p.md" }];
		await el.updateComplete;
		expect(el.shadowRoot!.textContent).toContain("Auth");
	});

	it("shows empty list when no entities", async () => {
		el.entities = [];
		await el.updateComplete;
		const list = el.shadowRoot!.querySelector(".list");
		expect(list).not.toBeNull();
		expect(list!.children.length).toBe(0);
	});

	it("dispatches catalog-entity-create on Create button click", async () => {
		await el.updateComplete;
		let detail: unknown = null;
		el.addEventListener("catalog-entity-create", ((e: CustomEvent) => { detail = e.detail; }) as EventListener);

		const input = el.shadowRoot!.getElementById("ce-name") as HTMLInputElement;
		if (input) {
			input.value = "TestDomain";
			const createBtn = Array.from(el.shadowRoot!.querySelectorAll("button")).find((b) => b.textContent?.trim() === "Create") as HTMLElement;
			createBtn?.click();
			expect(detail).toEqual({ entityType: "domains", definition: expect.objectContaining({ name: "TestDomain" }) });
		}
	});

	it("dispatches catalog-list-refresh on Refresh button click", async () => {
		await el.updateComplete;
		let detail: unknown = null;
		el.addEventListener("catalog-list-refresh", ((e: CustomEvent) => { detail = e.detail; }) as EventListener);
		const refreshBtn = Array.from(el.shadowRoot!.querySelectorAll("button")).find((b) => b.textContent?.trim() === "Refresh") as HTMLElement;
		refreshBtn?.click();
		expect(detail).toEqual({ entityType: "domains" });
	});

	it("shows entity names and statuses in the list", async () => {
		el.entities = [{ name: "Auth", type: "Domain", status: "active", date: "2026-03-20", path: "docs/catalog/domains/auth.md" }];
		await el.updateComplete;
		const list = el.shadowRoot!.querySelector(".list");
		expect(list).not.toBeNull();
		expect(list!.textContent).toContain("Auth");
		expect(list!.textContent).toContain("active");
	});
});
