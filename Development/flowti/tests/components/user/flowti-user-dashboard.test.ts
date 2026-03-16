// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import "../../../src/components/user/flowti-user-dashboard";
import { fixture, cleanup, shadowQuery, shadowQueryAll } from "../test-utils";

interface DashboardEl extends HTMLElement {
	hubStats: unknown[];
	inboxPreview: unknown[];
	activeSession: unknown | null;
	showWelcome: boolean;
	updateComplete: Promise<boolean>;
}

function makeHubStat(overrides: Record<string, unknown> = {}) {
	return {
		hubId: "event-catalog",
		label: "Event Catalog",
		icon: "book",
		statItems: [
			{ label: "Events", value: "42" },
			{ label: "Domains", value: "5" },
		],
		...overrides,
	};
}

function makeInboxItem(overrides: Record<string, unknown> = {}) {
	return {
		id: "inbox-1",
		title: "Test Notification",
		type: "info",
		read: false,
		sourceEvent: "subscription.matched",
		timestamp: "2026-03-16T10:00:00Z",
		...overrides,
	};
}

function makeSession(overrides: Record<string, unknown> = {}) {
	return {
		id: "s1",
		title: "Doc Session",
		type: "documentation",
		status: "running",
		durationMinutes: 25,
		remainingMs: 600000,
		...overrides,
	};
}

describe("flowti-user-dashboard", () => {
	afterEach(() => cleanup());

	it("is defined as a custom element", () => {
		expect(customElements.get("flowti-user-dashboard")).toBeDefined();
	});

	it("renders stat cards from hubStats", async () => {
		const el = await fixture<DashboardEl>("flowti-user-dashboard", {
			hubStats: [makeHubStat(), makeHubStat({ hubId: "train-hub", label: "Train Hub", statItems: [{ label: "Trains", value: "3" }] })],
			inboxPreview: [],
			activeSession: null,
			showWelcome: false,
		});

		const cards = shadowQueryAll(el, ".hub-stat-card");
		expect(cards.length).toBe(2);
	});

	it("renders welcome callout when showWelcome is true", async () => {
		const el = await fixture<DashboardEl>("flowti-user-dashboard", {
			hubStats: [],
			inboxPreview: [],
			activeSession: null,
			showWelcome: true,
		});

		const welcome = shadowQuery(el, ".welcome-callout");
		expect(welcome).not.toBeNull();
		expect(welcome!.textContent).toContain("Welcome");
	});

	it("hides welcome callout when showWelcome is false", async () => {
		const el = await fixture<DashboardEl>("flowti-user-dashboard", {
			hubStats: [],
			inboxPreview: [],
			activeSession: null,
			showWelcome: false,
		});

		const welcome = shadowQuery(el, ".welcome-callout");
		expect(welcome).toBeNull();
	});

	it("renders inbox preview items", async () => {
		const el = await fixture<DashboardEl>("flowti-user-dashboard", {
			hubStats: [],
			inboxPreview: [makeInboxItem(), makeInboxItem({ id: "inbox-2", title: "Second" })],
			activeSession: null,
			showWelcome: false,
		});

		const items = shadowQueryAll(el, ".inbox-preview-item");
		expect(items.length).toBe(2);
	});

	it("renders active session card when set", async () => {
		const el = await fixture<DashboardEl>("flowti-user-dashboard", {
			hubStats: [],
			inboxPreview: [],
			activeSession: makeSession(),
			showWelcome: false,
		});

		const sessionCard = shadowQuery(el, ".active-session-card");
		expect(sessionCard).not.toBeNull();
		expect(sessionCard!.textContent).toContain("Doc Session");
	});

	it("hides active session card when null", async () => {
		const el = await fixture<DashboardEl>("flowti-user-dashboard", {
			hubStats: [],
			inboxPreview: [],
			activeSession: null,
			showWelcome: false,
		});

		const sessionCard = shadowQuery(el, ".active-session-card");
		expect(sessionCard).toBeNull();
	});

	it("dispatches navigate-hub on hub stat card click", async () => {
		const el = await fixture<DashboardEl>("flowti-user-dashboard", {
			hubStats: [makeHubStat()],
			inboxPreview: [],
			activeSession: null,
			showWelcome: false,
		});

		let detail: unknown = null;
		el.addEventListener("navigate-hub", ((e: CustomEvent) => {
			detail = e.detail;
		}) as EventListener);

		const card = shadowQuery(el, ".hub-stat-card");
		card?.dispatchEvent(new Event("click", { bubbles: true }));
		expect(detail).toEqual({ hubId: "event-catalog" });
	});

	it("dispatches open-inbox when inbox preview is clicked", async () => {
		const el = await fixture<DashboardEl>("flowti-user-dashboard", {
			hubStats: [],
			inboxPreview: [makeInboxItem()],
			activeSession: null,
			showWelcome: false,
		});

		let fired = false;
		el.addEventListener("open-inbox", () => { fired = true; });

		const link = shadowQuery(el, ".inbox-view-all");
		link?.dispatchEvent(new Event("click", { bubbles: true }));
		expect(fired).toBe(true);
	});

	it("dispatches open-session on active session card click", async () => {
		const el = await fixture<DashboardEl>("flowti-user-dashboard", {
			hubStats: [],
			inboxPreview: [],
			activeSession: makeSession(),
			showWelcome: false,
		});

		let detail: unknown = null;
		el.addEventListener("open-session", ((e: CustomEvent) => {
			detail = e.detail;
		}) as EventListener);

		const card = shadowQuery(el, ".active-session-card");
		card?.dispatchEvent(new Event("click", { bubbles: true }));
		expect(detail).toEqual({ sessionId: "s1" });
	});

	it("renders empty state when no data at all", async () => {
		const el = await fixture<DashboardEl>("flowti-user-dashboard", {
			hubStats: [],
			inboxPreview: [],
			activeSession: null,
			showWelcome: false,
			isEmpty: true,
		});

		const empty = shadowQuery(el, ".flowti-empty");
		expect(empty).not.toBeNull();
	});
});
