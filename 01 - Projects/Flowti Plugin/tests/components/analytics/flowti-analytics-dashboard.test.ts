// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest";
import "../../../src/components/analytics/flowti-analytics-dashboard";

function makeDashboard(overrides: Record<string, unknown> = {}) {
	return {
		id: "dash-1",
		name: "Test Dashboard",
		description: "A test dashboard",
		tiles: [],
		isFavorite: false,
		createdAt: Date.now(),
		updatedAt: Date.now(),
		...overrides,
	};
}

function makeTile(overrides: Record<string, unknown> = {}) {
	return {
		id: "tile-1",
		queryId: "q1",
		title: "Revenue",
		displayMode: "stat-card",
		row: 0,
		col: 0,
		width: 2,
		height: 1,
		...overrides,
	};
}

describe("flowti-analytics-dashboard", () => {
	let el: HTMLElement & Record<string, unknown>;

	beforeEach(() => {
		el = document.createElement("flowti-analytics-dashboard") as HTMLElement & Record<string, unknown>;
		document.body.appendChild(el);
	});

	it("is defined as a custom element", () => {
		expect(customElements.get("flowti-analytics-dashboard")).toBeDefined();
	});

	it("renders dashboard name and tile count", async () => {
		const tiles = [makeTile(), makeTile({ id: "tile-2", title: "Expenses" })];
		el.dashboard = makeDashboard({ tiles });
		el.tiles = tiles;
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		const nameInput = shadow.querySelector(".dashboard-name-input") as HTMLInputElement;
		expect(nameInput).not.toBeNull();
		expect(nameInput.value).toBe("Test Dashboard");
		expect(shadow.textContent).toContain("2 tiles");
	});

	it("renders empty state when no tiles exist", async () => {
		el.dashboard = makeDashboard();
		el.tiles = [];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		expect(shadow.querySelector(".empty-state")).not.toBeNull();
		expect(shadow.textContent).toContain("No tiles");
	});

	it("renders tile grid when tiles exist", async () => {
		const tiles = [makeTile(), makeTile({ id: "tile-2", title: "Expenses" })];
		el.dashboard = makeDashboard({ tiles });
		el.tiles = tiles;
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		const tileEls = shadow.querySelectorAll(".tile-slot");
		expect(tileEls.length).toBe(2);
	});

	it("renders breadcrumbs when provided", async () => {
		el.dashboard = makeDashboard();
		el.tiles = [];
		el.breadcrumbs = [
			{ level: "list", label: "Dashboards" },
			{ level: "dashboard", label: "Test Dashboard" },
		];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		const crumbs = shadow.querySelectorAll(".breadcrumb-item");
		expect(crumbs.length).toBe(2);
	});

	it("dispatches add-tile event on add button click", async () => {
		el.dashboard = makeDashboard();
		el.tiles = [];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		let fired = false;
		el.addEventListener("add-tile", () => { fired = true; });

		const shadow = el.shadowRoot!;
		const addBtn = shadow.querySelector("[data-action='add-tile']") as HTMLButtonElement;
		expect(addBtn).not.toBeNull();
		addBtn.click();
		expect(fired).toBe(true);
	});

	it("dispatches remove-tile event with tile id", async () => {
		const tiles = [makeTile()];
		el.dashboard = makeDashboard({ tiles });
		el.tiles = tiles;
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		let detail: unknown = null;
		el.addEventListener("remove-tile", ((e: CustomEvent) => { detail = e.detail; }) as EventListener);

		const shadow = el.shadowRoot!;
		const removeBtn = shadow.querySelector("[data-action='remove-tile']") as HTMLButtonElement;
		expect(removeBtn).not.toBeNull();
		removeBtn.click();
		expect(detail).toEqual({ tileId: "tile-1" });
	});

	it("dispatches rename-dashboard event", async () => {
		el.dashboard = makeDashboard();
		el.tiles = [];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		let detail: unknown = null;
		el.addEventListener("rename-dashboard", ((e: CustomEvent) => { detail = e.detail; }) as EventListener);

		const shadow = el.shadowRoot!;
		const nameInput = shadow.querySelector(".dashboard-name-input") as HTMLInputElement;
		expect(nameInput).not.toBeNull();
		nameInput.value = "Renamed Dashboard";
		nameInput.dispatchEvent(new Event("change"));
		expect(detail).toEqual({ dashboardId: "dash-1", name: "Renamed Dashboard" });
	});

	it("dispatches navigate-breadcrumb event on crumb click", async () => {
		el.dashboard = makeDashboard();
		el.tiles = [];
		el.breadcrumbs = [
			{ level: "list", label: "Dashboards", dashboardId: "dash-list" },
			{ level: "dashboard", label: "Test Dashboard", dashboardId: "dash-1" },
		];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		let detail: unknown = null;
		el.addEventListener("navigate-breadcrumb", ((e: CustomEvent) => { detail = e.detail; }) as EventListener);

		const shadow = el.shadowRoot!;
		const crumbs = shadow.querySelectorAll(".breadcrumb-item");
		(crumbs[0] as HTMLElement).click();
		expect(detail).toEqual({ dashboardId: "dash-list", index: 0 });
	});
});
