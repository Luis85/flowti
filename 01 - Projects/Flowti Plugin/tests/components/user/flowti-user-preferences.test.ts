// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from "vitest";
import "../../../src/components/user/flowti-user-preferences";
import { fixture, cleanup, shadowQuery, shadowQueryAll } from "../test-utils";

interface PreferencesEl extends HTMLElement {
	settings: unknown;
	activePanel: string;
	updateComplete: Promise<boolean>;
}

function makeSettings(overrides: Record<string, unknown> = {}) {
	return {
		sources: {
			enabled: ["subscription.matched", "dataExchange.import.completed"],
		},
		session: {
			activityFilterGlobal: ["node_modules/"],
			customTypes: {},
		},
		train: {
			folder: "trains",
			defaultDuration: 15,
			maxThoughts: 100,
			autoOpenTimeline: true,
		},
		nudge: {
			configs: [],
		},
		...overrides,
	};
}

describe("flowti-user-preferences", () => {
	afterEach(() => cleanup());

	it("is defined as a custom element", () => {
		expect(customElements.get("flowti-user-preferences")).toBeDefined();
	});

	it("renders panel navigation items", async () => {
		const el = await fixture<PreferencesEl>("flowti-user-preferences", {
			settings: makeSettings(),
			activePanel: "",
		});

		const panels = shadowQueryAll(el, ".panel-nav-item");
		expect(panels.length).toBe(4);
	});

	it("highlights active panel", async () => {
		const el = await fixture<PreferencesEl>("flowti-user-preferences", {
			settings: makeSettings(),
			activePanel: "sources",
		});

		const active = shadowQuery(el, ".panel-nav-item--active");
		expect(active).not.toBeNull();
		expect(active!.textContent).toContain("Sources");
	});

	it("dispatches panel-switched on navigation click", async () => {
		const el = await fixture<PreferencesEl>("flowti-user-preferences", {
			settings: makeSettings(),
			activePanel: "",
		});

		let detail: unknown = null;
		el.addEventListener("panel-switched", ((e: CustomEvent) => {
			detail = e.detail;
		}) as EventListener);

		const items = shadowQueryAll(el, ".panel-nav-item");
		if (items.length > 0) {
			items[0].dispatchEvent(new Event("click", { bubbles: true }));
			expect(detail).not.toBeNull();
		}
	});

	it("dispatches setting-changed on toggle interaction", async () => {
		const el = await fixture<PreferencesEl>("flowti-user-preferences", {
			settings: makeSettings(),
			activePanel: "sources",
		});

		let fired = false;
		el.addEventListener("setting-changed", () => { fired = true; });

		const toggle = shadowQuery<HTMLInputElement>(el, ".setting-toggle");
		if (toggle) {
			toggle.checked = !toggle.checked;
			toggle.dispatchEvent(new Event("change", { bubbles: true }));
			expect(fired).toBe(true);
		}
	});

	it("renders sources panel content when active", async () => {
		const el = await fixture<PreferencesEl>("flowti-user-preferences", {
			settings: makeSettings(),
			activePanel: "sources",
		});

		const content = shadowQuery(el, ".panel-content");
		expect(content).not.toBeNull();
		expect(content!.textContent).toContain("Sources");
	});

	it("renders session panel content when active", async () => {
		const el = await fixture<PreferencesEl>("flowti-user-preferences", {
			settings: makeSettings(),
			activePanel: "session",
		});

		const content = shadowQuery(el, ".panel-content");
		expect(content).not.toBeNull();
		expect(content!.textContent).toContain("Session");
	});

	it("renders train panel content when active", async () => {
		const el = await fixture<PreferencesEl>("flowti-user-preferences", {
			settings: makeSettings(),
			activePanel: "train",
		});

		const content = shadowQuery(el, ".panel-content");
		expect(content).not.toBeNull();
		expect(content!.textContent).toContain("Train");
	});

	it("renders nudge panel content when active", async () => {
		const el = await fixture<PreferencesEl>("flowti-user-preferences", {
			settings: makeSettings(),
			activePanel: "nudge",
		});

		const content = shadowQuery(el, ".panel-content");
		expect(content).not.toBeNull();
		expect(content!.textContent).toContain("Nudge");
	});

	it("renders empty state when no panel selected", async () => {
		const el = await fixture<PreferencesEl>("flowti-user-preferences", {
			settings: makeSettings(),
			activePanel: "",
		});

		const placeholder = shadowQuery(el, ".panel-placeholder");
		expect(placeholder).not.toBeNull();
	});
});
