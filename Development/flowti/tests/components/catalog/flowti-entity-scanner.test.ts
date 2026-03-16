// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest";
import "../../../src/components/catalog/flowti-entity-scanner";
import type { FlowtiEntityScanner } from "../../../src/components/catalog/flowti-entity-scanner";

function createElement(): FlowtiEntityScanner {
	return document.createElement("flowti-entity-scanner") as unknown as FlowtiEntityScanner;
}

describe("FlowtiEntityScanner", () => {
	let el: FlowtiEntityScanner;

	beforeEach(() => {
		el = createElement();
	});

	it("is defined as a custom element", () => {
		expect(customElements.get("flowti-entity-scanner")).toBeDefined();
	});

	it("has default empty entities array", () => {
		expect(el.entities).toEqual([]);
	});

	it("has default empty searchText", () => {
		expect(el.searchText).toBe("");
	});

	it("has default null selectedId", () => {
		expect(el.selectedId).toBeNull();
	});

	it("has default empty entityType", () => {
		expect(el.entityType).toBe("");
	});

	describe("rendering", () => {
		it("shows empty state when no entities", async () => {
			document.body.appendChild(el);
			await el.updateComplete;
			const shadow = el.shadowRoot!;
			const emptyState = shadow.querySelector(".empty-state");
			expect(emptyState).not.toBeNull();
			document.body.removeChild(el);
		});

		it("renders entity list items", async () => {
			el.entities = [
				{ id: "domain-1", name: "Auth", description: "Authentication domain", count: 5 },
				{ id: "domain-2", name: "User", description: "User management", count: 3 },
			];
			document.body.appendChild(el);
			await el.updateComplete;
			const shadow = el.shadowRoot!;
			const items = shadow.querySelectorAll(".list-item");
			expect(items.length).toBe(2);
			document.body.removeChild(el);
		});

		it("renders count badge on each item", async () => {
			el.entities = [
				{ id: "d1", name: "Auth", description: "", count: 12 },
			];
			document.body.appendChild(el);
			await el.updateComplete;
			const shadow = el.shadowRoot!;
			const badge = shadow.querySelector(".count-badge");
			expect(badge).not.toBeNull();
			expect(badge!.textContent!.trim()).toBe("12");
			document.body.removeChild(el);
		});

		it("highlights selected item", async () => {
			el.entities = [
				{ id: "d1", name: "Auth", description: "", count: 5 },
				{ id: "d2", name: "User", description: "", count: 3 },
			];
			el.selectedId = "d2";
			document.body.appendChild(el);
			await el.updateComplete;
			const shadow = el.shadowRoot!;
			const selected = shadow.querySelector(".list-item--selected");
			expect(selected).not.toBeNull();
			expect(selected!.textContent).toContain("User");
			document.body.removeChild(el);
		});

		it("filters items by searchText", async () => {
			el.entities = [
				{ id: "d1", name: "Auth", description: "Authentication", count: 5 },
				{ id: "d2", name: "User", description: "Management", count: 3 },
			];
			el.searchText = "auth";
			document.body.appendChild(el);
			await el.updateComplete;
			const shadow = el.shadowRoot!;
			const items = shadow.querySelectorAll(".list-item");
			expect(items.length).toBe(1);
			expect(items[0].textContent).toContain("Auth");
			document.body.removeChild(el);
		});

		it("renders entity detail for selected item", async () => {
			el.entities = [
				{ id: "d1", name: "Auth", description: "Authentication domain", count: 5 },
			];
			el.selectedId = "d1";
			document.body.appendChild(el);
			await el.updateComplete;
			const shadow = el.shadowRoot!;
			const detail = shadow.querySelector(".detail-panel");
			expect(detail).not.toBeNull();
			expect(detail!.textContent).toContain("Auth");
			expect(detail!.textContent).toContain("Authentication domain");
			document.body.removeChild(el);
		});
	});

	describe("events", () => {
		it("dispatches entity-selected on click", async () => {
			el.entities = [
				{ id: "d1", name: "Auth", description: "", count: 5 },
			];
			document.body.appendChild(el);
			await el.updateComplete;

			let fired = false;
			let detail: unknown = null;
			el.addEventListener("entity-selected", ((e: CustomEvent) => {
				fired = true;
				detail = e.detail;
			}) as EventListener);

			const shadow = el.shadowRoot!;
			const item = shadow.querySelector(".list-item") as HTMLElement;
			item.click();

			expect(fired).toBe(true);
			expect(detail).toEqual({ id: "d1", name: "Auth" });
			document.body.removeChild(el);
		});
	});
});
