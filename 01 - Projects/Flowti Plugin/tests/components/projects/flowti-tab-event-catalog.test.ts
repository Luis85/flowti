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

	it("renders sub-tabs for entity types", async () => {
		await el.updateComplete;
		const shadow = el.shadowRoot!;
		expect(shadow.textContent).toContain("Domains");
		expect(shadow.textContent).toContain("Services");
		expect(shadow.textContent).toContain("Events");
		expect(shadow.textContent).toContain("Flows");
	});

	it("defaults to domains sub-tab", async () => {
		await el.updateComplete;
		const activeBtn = el.shadowRoot!.querySelector(".sub-tab--active");
		expect(activeBtn?.textContent?.trim()).toBe("Domains");
	});

	it("switches sub-tab on click", async () => {
		await el.updateComplete;
		const btns = el.shadowRoot!.querySelectorAll(".sub-tab");
		(btns[2] as HTMLElement)?.click();
		await el.updateComplete;
		const active = el.shadowRoot!.querySelector(".sub-tab--active");
		expect(active?.textContent?.trim()).toBe("Events");
	});

	it("shows entity list when entities provided", async () => {
		el.entities = [{ name: "Auth", type: "Domain", status: "active", date: "2026-03-20", path: "p.md" }];
		await el.updateComplete;
		expect(el.shadowRoot!.textContent).toContain("Auth");
	});

	it("shows empty state when no entities", async () => {
		el.entities = [];
		await el.updateComplete;
		expect(el.shadowRoot!.textContent).toContain("No domains yet");
	});

	it("toggles add form on Add button click", async () => {
		await el.updateComplete;
		const addBtn = el.shadowRoot!.querySelector(".add-entity-btn") as HTMLElement;
		addBtn?.click();
		await el.updateComplete;
		const form = el.shadowRoot!.querySelector(".add-form");
		expect(form).not.toBeNull();
	});

	it("dispatches catalog-entity-create on form submit", async () => {
		el.activeSubTab = "domains";
		await el.updateComplete;
		let detail: unknown = null;
		el.addEventListener("catalog-entity-create", ((e: CustomEvent) => { detail = e.detail; }) as EventListener);

		const addBtn = el.shadowRoot!.querySelector(".add-entity-btn") as HTMLElement;
		addBtn?.click();
		await el.updateComplete;

		const nameInput = el.shadowRoot!.querySelector(".entity-name-input") as HTMLInputElement;
		if (nameInput) {
			nameInput.value = "TestDomain";
			const submitBtn = el.shadowRoot!.querySelector(".entity-submit-btn") as HTMLElement;
			submitBtn?.click();
			expect(detail).toEqual({ entityType: "domains", definition: expect.objectContaining({ name: "TestDomain" }) });
		}
	});

	it("dispatches catalog-list-refresh on tab switch", async () => {
		await el.updateComplete;
		let detail: unknown = null;
		el.addEventListener("catalog-list-refresh", ((e: CustomEvent) => { detail = e.detail; }) as EventListener);
		const btns = el.shadowRoot!.querySelectorAll(".sub-tab");
		(btns[1] as HTMLElement)?.click();
		expect(detail).toEqual({ entityType: "services" });
	});

	it("dispatches open-project-note when entity row clicked", async () => {
		el.entities = [{ name: "Auth", type: "Domain", status: "active", date: "2026-03-20", path: "docs/catalog/domains/auth.md" }];
		await el.updateComplete;
		let detail: unknown = null;
		el.addEventListener("open-project-note", ((e: CustomEvent) => { detail = e.detail; }) as EventListener);
		const row = el.shadowRoot!.querySelector(".entity-row") as HTMLElement;
		row?.click();
		expect(detail).toEqual({ path: "docs/catalog/domains/auth.md" });
	});
});
