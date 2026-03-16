// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from "vitest";
import "../../../src/components/user/flowti-user-inbox";
import { fixture, cleanup, shadowQuery, shadowQueryAll } from "../test-utils";

interface InboxEl extends HTMLElement {
	items: unknown[];
	selectedId: string | null;
	searchText: string;
	updateComplete: Promise<boolean>;
}

function makeItem(overrides: Record<string, unknown> = {}) {
	return {
		id: "i1",
		title: "Test Notification",
		type: "info",
		read: false,
		sourceEvent: "subscription.matched",
		timestamp: "2026-03-16T10:00:00Z",
		description: "A test notification",
		...overrides,
	};
}

describe("flowti-user-inbox", () => {
	afterEach(() => cleanup());

	it("is defined as a custom element", () => {
		expect(customElements.get("flowti-user-inbox")).toBeDefined();
	});

	it("renders inbox items", async () => {
		const el = await fixture<InboxEl>("flowti-user-inbox", {
			items: [makeItem(), makeItem({ id: "i2", title: "Second" })],
			selectedId: null,
			searchText: "",
		});

		const items = shadowQueryAll(el, ".inbox-item");
		expect(items.length).toBe(2);
	});

	it("filters items by searchText", async () => {
		const el = await fixture<InboxEl>("flowti-user-inbox", {
			items: [
				makeItem({ title: "Alpha Notification" }),
				makeItem({ id: "i2", title: "Beta Notification" }),
			],
			selectedId: null,
			searchText: "alpha",
		});

		const items = shadowQueryAll(el, ".inbox-item");
		expect(items.length).toBe(1);
		expect(items[0].textContent).toContain("Alpha");
	});

	it("marks unread items", async () => {
		const el = await fixture<InboxEl>("flowti-user-inbox", {
			items: [makeItem({ read: false }), makeItem({ id: "i2", read: true })],
			selectedId: null,
			searchText: "",
		});

		const unread = shadowQueryAll(el, ".inbox-item--unread");
		expect(unread.length).toBe(1);
	});

	it("marks selected item", async () => {
		const el = await fixture<InboxEl>("flowti-user-inbox", {
			items: [makeItem()],
			selectedId: "i1",
			searchText: "",
		});

		const selected = shadowQuery(el, ".inbox-item--selected");
		expect(selected).not.toBeNull();
	});

	it("dispatches item-selected on click", async () => {
		const el = await fixture<InboxEl>("flowti-user-inbox", {
			items: [makeItem()],
			selectedId: null,
			searchText: "",
		});

		let detail: unknown = null;
		el.addEventListener("item-selected", ((e: CustomEvent) => {
			detail = e.detail;
		}) as EventListener);

		const item = shadowQuery(el, ".inbox-item");
		item?.dispatchEvent(new Event("click", { bubbles: true }));
		expect(detail).toEqual({ itemId: "i1" });
	});

	it("dispatches mark-read on mark-read button click", async () => {
		const el = await fixture<InboxEl>("flowti-user-inbox", {
			items: [makeItem({ read: false })],
			selectedId: "i1",
			searchText: "",
		});

		let detail: unknown = null;
		el.addEventListener("mark-read", ((e: CustomEvent) => {
			detail = e.detail;
		}) as EventListener);

		const btn = shadowQuery(el, ".action-mark-read");
		if (btn) {
			btn.dispatchEvent(new Event("click", { bubbles: true }));
			expect(detail).toEqual({ itemId: "i1" });
		}
	});

	it("dispatches dismiss on dismiss button click", async () => {
		const el = await fixture<InboxEl>("flowti-user-inbox", {
			items: [makeItem()],
			selectedId: "i1",
			searchText: "",
		});

		let detail: unknown = null;
		el.addEventListener("dismiss", ((e: CustomEvent) => {
			detail = e.detail;
		}) as EventListener);

		const btn = shadowQuery(el, ".action-dismiss");
		if (btn) {
			btn.dispatchEvent(new Event("click", { bubbles: true }));
			expect(detail).toEqual({ itemId: "i1" });
		}
	});

	it("renders empty state", async () => {
		const el = await fixture<InboxEl>("flowti-user-inbox", {
			items: [],
			selectedId: null,
			searchText: "",
			isEmpty: true,
		});

		const empty = shadowQuery(el, ".flowti-empty");
		expect(empty).not.toBeNull();
	});

	it("renders detail panel for selected item", async () => {
		const el = await fixture<InboxEl>("flowti-user-inbox", {
			items: [makeItem({ title: "Important Alert", description: "Needs attention" })],
			selectedId: "i1",
			searchText: "",
		});

		const detail = shadowQuery(el, ".detail-panel");
		expect(detail).not.toBeNull();
		expect(detail!.textContent).toContain("Important Alert");
		expect(detail!.textContent).toContain("Needs attention");
	});
});
