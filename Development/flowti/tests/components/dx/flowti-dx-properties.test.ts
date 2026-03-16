// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest";
import "../../../src/components/dx/flowti-dx-properties";

function makeProperty(overrides: Record<string, unknown> = {}) {
	return {
		propertyName: "title",
		noteCount: 42,
		uniqueValues: 38,
		hasDoc: false,
		sampleValues: ["Hello World", "Getting Started"],
		...overrides,
	};
}

describe("flowti-dx-properties", () => {
	let el: HTMLElement & Record<string, unknown>;

	beforeEach(() => {
		el = document.createElement("flowti-dx-properties") as HTMLElement & Record<string, unknown>;
		document.body.appendChild(el);
	});

	it("is defined as a custom element", () => {
		expect(customElements.get("flowti-dx-properties")).toBeDefined();
	});

	it("renders empty state when no properties", async () => {
		el.properties = [];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		const empty = shadow.querySelector(".empty-state");
		expect(empty).not.toBeNull();
		expect(empty!.textContent).toContain("No properties found");
	});

	it("renders property list items", async () => {
		el.properties = [
			makeProperty({ propertyName: "title", noteCount: 42 }),
			makeProperty({ propertyName: "author", noteCount: 15 }),
		];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		const items = shadow.querySelectorAll(".list-item");
		expect(items.length).toBe(2);
		expect(items[0].textContent).toContain("title");
		expect(items[0].textContent).toContain("42 notes");
	});

	it("renders detail panel for selected property", async () => {
		el.properties = [
			makeProperty({ propertyName: "title", noteCount: 42, uniqueValues: 38, hasDoc: true }),
		];
		el.selectedId = "title";
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		const header = shadow.querySelector(".detail-header h3");
		expect(header!.textContent).toContain("title");

		const badge = shadow.querySelector(".prop-doc-badge--yes");
		expect(badge).not.toBeNull();
		expect(badge!.textContent).toContain("Documented");

		const values = Array.from(shadow.querySelectorAll(".detail-field__value")).map((e) => e.textContent?.trim());
		expect(values).toContain("42 notes");
		expect(values).toContain("38");
	});

	it("shows 'Create doc' button when undocumented", async () => {
		el.properties = [makeProperty({ propertyName: "title", hasDoc: false })];
		el.selectedId = "title";
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		const btn = shadow.querySelector(".detail-actions button") as HTMLButtonElement;
		expect(btn!.textContent).toContain("Create doc");
	});

	it("shows 'Open doc' button when documented", async () => {
		el.properties = [makeProperty({ propertyName: "title", hasDoc: true })];
		el.selectedId = "title";
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		const btn = shadow.querySelector(".detail-actions button") as HTMLButtonElement;
		expect(btn!.textContent).toContain("Open doc");
	});

	it("renders sample values", async () => {
		el.properties = [
			makeProperty({ propertyName: "title", sampleValues: ["Hello", "World"] }),
		];
		el.selectedId = "title";
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		const tags = Array.from(shadow.querySelectorAll(".sample-tag")).map((e) => e.textContent?.trim());
		expect(tags).toEqual(["Hello", "World"]);
	});

	it("filters properties by searchText", async () => {
		el.properties = [
			makeProperty({ propertyName: "title" }),
			makeProperty({ propertyName: "author" }),
		];
		el.searchText = "auth";
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		const items = shadow.querySelectorAll(".list-item");
		expect(items.length).toBe(1);
		expect(items[0].textContent).toContain("author");
	});

	it("dispatches select-property on list item click", async () => {
		el.properties = [makeProperty({ propertyName: "title" })];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		const item = shadow.querySelector(".list-item") as HTMLElement;

		let detail: unknown = null;
		el.addEventListener("select-property", ((e: CustomEvent) => { detail = e.detail; }) as EventListener);
		item.click();
		expect(detail).toEqual({ propertyName: "title" });
	});

	it("dispatches create-property-doc on create doc button click", async () => {
		el.properties = [makeProperty({ propertyName: "title", hasDoc: false })];
		el.selectedId = "title";
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		const btn = shadow.querySelector(".detail-actions button") as HTMLButtonElement;

		let detail: unknown = null;
		el.addEventListener("create-property-doc", ((e: CustomEvent) => { detail = e.detail; }) as EventListener);
		btn.click();
		expect(detail).toEqual({ propertyName: "title" });
	});
});
