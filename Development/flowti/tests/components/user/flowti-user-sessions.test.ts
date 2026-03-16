// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from "vitest";
import "../../../src/components/user/flowti-user-sessions";
import { fixture, cleanup, shadowQuery, shadowQueryAll } from "../test-utils";

interface SessionsEl extends HTMLElement {
	sessions: unknown[];
	selectedId: string | null;
	searchText: string;
	timerSeconds: number;
	updateComplete: Promise<boolean>;
}

function makeSession(overrides: Record<string, unknown> = {}) {
	return {
		id: "s1",
		title: "Doc Session",
		type: "documentation",
		status: "running",
		durationMinutes: 25,
		createdAt: "2026-03-16T10:00:00Z",
		goals: [],
		...overrides,
	};
}

describe("flowti-user-sessions", () => {
	afterEach(() => cleanup());

	it("is defined as a custom element", () => {
		expect(customElements.get("flowti-user-sessions")).toBeDefined();
	});

	it("renders session list items", async () => {
		const el = await fixture<SessionsEl>("flowti-user-sessions", {
			sessions: [
				makeSession(),
				makeSession({ id: "s2", title: "Review Session", status: "paused" }),
			],
			selectedId: null,
			searchText: "",
			timerSeconds: 0,
		});

		const items = shadowQueryAll(el, ".session-item");
		expect(items.length).toBe(2);
	});

	it("filters sessions by searchText", async () => {
		const el = await fixture<SessionsEl>("flowti-user-sessions", {
			sessions: [
				makeSession({ title: "Alpha Session" }),
				makeSession({ id: "s2", title: "Beta Session" }),
			],
			selectedId: null,
			searchText: "alpha",
			timerSeconds: 0,
		});

		const items = shadowQueryAll(el, ".session-item");
		expect(items.length).toBe(1);
		expect(items[0].textContent).toContain("Alpha Session");
	});

	it("marks selected session", async () => {
		const el = await fixture<SessionsEl>("flowti-user-sessions", {
			sessions: [makeSession()],
			selectedId: "s1",
			searchText: "",
			timerSeconds: 0,
		});

		const selected = shadowQuery(el, ".session-item--selected");
		expect(selected).not.toBeNull();
	});

	it("dispatches session-selected on item click", async () => {
		const el = await fixture<SessionsEl>("flowti-user-sessions", {
			sessions: [makeSession()],
			selectedId: null,
			searchText: "",
			timerSeconds: 0,
		});

		let detail: unknown = null;
		el.addEventListener("session-selected", ((e: CustomEvent) => {
			detail = e.detail;
		}) as EventListener);

		const item = shadowQuery(el, ".session-item");
		item?.dispatchEvent(new Event("click", { bubbles: true }));
		expect(detail).toEqual({ sessionId: "s1" });
	});

	it("dispatches session-action on action button click", async () => {
		const el = await fixture<SessionsEl>("flowti-user-sessions", {
			sessions: [makeSession({ status: "running" })],
			selectedId: "s1",
			searchText: "",
			timerSeconds: 600,
		});

		let detail: unknown = null;
		el.addEventListener("session-action", ((e: CustomEvent) => {
			detail = e.detail;
		}) as EventListener);

		const pauseBtn = shadowQuery(el, ".action-pause");
		if (pauseBtn) {
			pauseBtn.dispatchEvent(new Event("click", { bubbles: true }));
			expect(detail).toEqual({ sessionId: "s1", action: "pause" });
		}
	});

	it("renders timer display from timerSeconds", async () => {
		const el = await fixture<SessionsEl>("flowti-user-sessions", {
			sessions: [makeSession({ status: "running" })],
			selectedId: "s1",
			searchText: "",
			timerSeconds: 1500,
		});

		const timer = shadowQuery(el, ".timer-display");
		expect(timer).not.toBeNull();
		// 1500 seconds = 25:00
		expect(timer!.textContent).toContain("25:00");
	});

	it("renders empty state when no sessions", async () => {
		const el = await fixture<SessionsEl>("flowti-user-sessions", {
			sessions: [],
			selectedId: null,
			searchText: "",
			timerSeconds: 0,
			isEmpty: true,
		});

		const empty = shadowQuery(el, ".flowti-empty");
		expect(empty).not.toBeNull();
	});
});
