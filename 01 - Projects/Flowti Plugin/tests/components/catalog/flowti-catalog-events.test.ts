// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest";
import "../../../src/components/catalog/flowti-catalog-events";
import type { FlowtiCatalogEvents, CatalogEventEntry, CatalogCategory } from "../../../src/components/catalog/flowti-catalog-events";

function createElement(): FlowtiCatalogEvents {
	return document.createElement("flowti-catalog-events") as unknown as FlowtiCatalogEvents;
}

function makeEvent(overrides: Partial<CatalogEventEntry> = {}): CatalogEventEntry {
	return {
		type: "user.created",
		description: "User was created",
		category: "User",
		domain: "auth",
		services: "AuthService",
		isExcluded: false,
		isNotified: false,
		...overrides,
	};
}

function makeCategory(overrides: Partial<CatalogCategory> = {}): CatalogCategory {
	return {
		name: "User",
		visible: true,
		...overrides,
	};
}

describe("FlowtiCatalogEvents", () => {
	let el: FlowtiCatalogEvents;

	beforeEach(() => {
		el = createElement();
	});

	it("is defined as a custom element", () => {
		expect(customElements.get("flowti-catalog-events")).toBeDefined();
	});

	it("has default empty events array", () => {
		expect(el.events).toEqual([]);
	});

	it("has default empty categories array", () => {
		expect(el.categories).toEqual([]);
	});

	it("has default empty excludedTypes set", () => {
		expect(el.excludedTypes).toEqual(new Set());
	});

	it("has default empty notifiedTypes set", () => {
		expect(el.notifiedTypes).toEqual(new Set());
	});

	it("has default empty searchText", () => {
		expect(el.searchText).toBe("");
	});

	describe("rendering", () => {
		it("shows empty state when no events", async () => {
			document.body.appendChild(el);
			await el.updateComplete;
			const shadow = el.shadowRoot!;
			const emptyState = shadow.querySelector(".empty-state");
			expect(emptyState).not.toBeNull();
			document.body.removeChild(el);
		});

		it("renders category groups from events", async () => {
			el.events = [
				makeEvent({ category: "User", type: "user.created" }),
				makeEvent({ category: "User", type: "user.updated" }),
				makeEvent({ category: "Auth", type: "auth.login" }),
			];
			el.categories = [
				makeCategory({ name: "User" }),
				makeCategory({ name: "Auth" }),
			];
			document.body.appendChild(el);
			await el.updateComplete;
			const shadow = el.shadowRoot!;
			const groups = shadow.querySelectorAll(".category-group");
			expect(groups.length).toBe(2);
			document.body.removeChild(el);
		});

		it("renders event items within categories", async () => {
			el.events = [
				makeEvent({ category: "User", type: "user.created" }),
				makeEvent({ category: "User", type: "user.updated" }),
			];
			el.categories = [makeCategory({ name: "User" })];
			document.body.appendChild(el);
			await el.updateComplete;
			const shadow = el.shadowRoot!;
			const items = shadow.querySelectorAll(".event-item");
			expect(items.length).toBe(2);
			document.body.removeChild(el);
		});

		it("renders dot legend", async () => {
			el.events = [makeEvent()];
			el.categories = [makeCategory()];
			document.body.appendChild(el);
			await el.updateComplete;
			const shadow = el.shadowRoot!;
			const legend = shadow.querySelector(".dot-legend");
			expect(legend).not.toBeNull();
			expect(legend!.textContent).toContain("hidden");
			expect(legend!.textContent).toContain("notified");
			document.body.removeChild(el);
		});

		it("marks excluded events with hidden dot", async () => {
			el.events = [makeEvent({ type: "user.created", isExcluded: true })];
			el.categories = [makeCategory()];
			el.excludedTypes = new Set(["user.created"]);
			document.body.appendChild(el);
			await el.updateComplete;
			const shadow = el.shadowRoot!;
			const hiddenDot = shadow.querySelector(".dot-hidden");
			expect(hiddenDot).not.toBeNull();
			document.body.removeChild(el);
		});

		it("marks notified events with notified dot", async () => {
			el.events = [makeEvent({ type: "user.created", isNotified: true })];
			el.categories = [makeCategory()];
			el.notifiedTypes = new Set(["user.created"]);
			document.body.appendChild(el);
			await el.updateComplete;
			const shadow = el.shadowRoot!;
			const notifiedDot = shadow.querySelector(".dot-notified");
			expect(notifiedDot).not.toBeNull();
			document.body.removeChild(el);
		});

		it("filters events by searchText", async () => {
			el.events = [
				makeEvent({ type: "user.created", category: "User" }),
				makeEvent({ type: "auth.login", category: "Auth", description: "Login event" }),
			];
			el.categories = [
				makeCategory({ name: "User" }),
				makeCategory({ name: "Auth" }),
			];
			el.searchText = "login";
			document.body.appendChild(el);
			await el.updateComplete;
			const shadow = el.shadowRoot!;
			const items = shadow.querySelectorAll(".event-item");
			expect(items.length).toBe(1);
			expect(items[0].textContent).toContain("auth.login");
			document.body.removeChild(el);
		});

		it("collapses a category when toggle-category is clicked", async () => {
			el.events = [
				makeEvent({ type: "user.created", category: "User" }),
			];
			el.categories = [makeCategory({ name: "User" })];
			document.body.appendChild(el);
			await el.updateComplete;

			const shadow = el.shadowRoot!;
			// Initially events are visible
			let items = shadow.querySelectorAll(".event-item");
			expect(items.length).toBe(1);

			// Click the category header to collapse
			const header = shadow.querySelector(".category-header") as HTMLElement;
			header.click();
			await el.updateComplete;

			// Events should be hidden when collapsed
			items = shadow.querySelectorAll(".event-item");
			expect(items.length).toBe(0);
			document.body.removeChild(el);
		});
	});

	describe("events", () => {
		it("dispatches toggle-category when category header is clicked", async () => {
			el.events = [makeEvent({ category: "User", type: "user.created" })];
			el.categories = [makeCategory({ name: "User" })];
			document.body.appendChild(el);
			await el.updateComplete;

			let fired = false;
			let detail: unknown = null;
			el.addEventListener("toggle-category", ((e: CustomEvent) => {
				fired = true;
				detail = e.detail;
			}) as EventListener);

			const shadow = el.shadowRoot!;
			const header = shadow.querySelector(".category-header") as HTMLElement;
			header.click();

			expect(fired).toBe(true);
			expect(detail).toEqual({ category: "User", collapsed: true });
			document.body.removeChild(el);
		});

		it("dispatches select-event when an event item is clicked", async () => {
			el.events = [makeEvent({ category: "User", type: "user.created", domain: "auth" })];
			el.categories = [makeCategory({ name: "User" })];
			document.body.appendChild(el);
			await el.updateComplete;

			let fired = false;
			let detail: unknown = null;
			el.addEventListener("select-event", ((e: CustomEvent) => {
				fired = true;
				detail = e.detail;
			}) as EventListener);

			const shadow = el.shadowRoot!;
			const eventItem = shadow.querySelector(".event-item") as HTMLElement;
			eventItem.click();

			expect(fired).toBe(true);
			expect(detail).toEqual({ type: "user.created", category: "User", domain: "auth" });
			document.body.removeChild(el);
		});

		it("dispatches toggle-setting when settings button is clicked", async () => {
			el.events = [makeEvent()];
			el.categories = [makeCategory()];
			document.body.appendChild(el);
			await el.updateComplete;

			let fired = false;
			el.addEventListener("toggle-setting", ((e: CustomEvent) => {
				fired = true;
			}) as EventListener);

			const shadow = el.shadowRoot!;
			const settingsBtn = shadow.querySelector(".settings-toggle") as HTMLElement;
			if (settingsBtn) {
				settingsBtn.click();
				expect(fired).toBe(true);
			}
			document.body.removeChild(el);
		});
	});

	describe("settings panel", () => {
		it("toggles settings visibility on button click", async () => {
			el.events = [makeEvent()];
			el.categories = [makeCategory()];
			document.body.appendChild(el);
			await el.updateComplete;

			const shadow = el.shadowRoot!;
			const settingsBtn = shadow.querySelector(".settings-toggle") as HTMLElement;
			expect(settingsBtn).not.toBeNull();

			// Settings panel should be hidden initially
			let panel = shadow.querySelector(".settings-panel");
			expect(panel).toBeNull();

			// Click to show
			settingsBtn.click();
			await el.updateComplete;
			panel = shadow.querySelector(".settings-panel");
			expect(panel).not.toBeNull();

			// Click to hide
			settingsBtn.click();
			await el.updateComplete;
			panel = shadow.querySelector(".settings-panel");
			expect(panel).toBeNull();

			document.body.removeChild(el);
		});
	});
});
