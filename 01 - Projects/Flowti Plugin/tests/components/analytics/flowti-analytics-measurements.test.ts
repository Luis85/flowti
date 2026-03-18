// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest";
import "../../../src/components/analytics/flowti-analytics-measurements";

function makeMeasurement(overrides: Record<string, unknown> = {}) {
	return {
		id: "m1",
		name: "Total Revenue",
		description: "Monthly revenue total",
		queryId: "q1",
		type: "single",
		measureColumn: "Revenue",
		isFavorite: false,
		createdAt: Date.now(),
		updatedAt: Date.now(),
		...overrides,
	};
}

describe("flowti-analytics-measurements", () => {
	let el: HTMLElement & Record<string, unknown>;

	beforeEach(() => {
		el = document.createElement("flowti-analytics-measurements") as HTMLElement & Record<string, unknown>;
		document.body.appendChild(el);
	});

	it("is defined as a custom element", () => {
		expect(customElements.get("flowti-analytics-measurements")).toBeDefined();
	});

	it("renders measurement list with names and types", async () => {
		el.measurements = [
			makeMeasurement(),
			makeMeasurement({ id: "m2", name: "Monthly Sales", type: "series" }),
		];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		const items = shadow.querySelectorAll(".measurement-item");
		expect(items.length).toBe(2);
		expect(shadow.textContent).toContain("Total Revenue");
		expect(shadow.textContent).toContain("Monthly Sales");
	});

	it("renders empty state when no measurements", async () => {
		el.measurements = [];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		expect(shadow.querySelector(".empty-state")).not.toBeNull();
		expect(shadow.textContent).toContain("No measurements");
	});

	it("highlights selected measurement", async () => {
		el.measurements = [makeMeasurement()];
		el.selectedId = "m1";
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		const selected = shadow.querySelector(".measurement-item--selected");
		expect(selected).not.toBeNull();
	});

	it("renders detail panel for selected measurement", async () => {
		el.measurements = [makeMeasurement()];
		el.selectedId = "m1";
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		expect(shadow.querySelector(".detail-panel")).not.toBeNull();
		expect(shadow.textContent).toContain("Total Revenue");
		expect(shadow.textContent).toContain("single");
	});

	it("filters measurements by searchText", async () => {
		el.measurements = [
			makeMeasurement(),
			makeMeasurement({ id: "m2", name: "Expense Ratio" }),
		];
		el.searchText = "expense";
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		const items = shadow.querySelectorAll(".measurement-item");
		expect(items.length).toBe(1);
		expect(shadow.textContent).toContain("Expense Ratio");
		expect(shadow.textContent).not.toContain("Total Revenue");
	});

	it("dispatches measurement-selected event on item click", async () => {
		el.measurements = [makeMeasurement()];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		let detail: unknown = null;
		el.addEventListener("measurement-selected", ((e: CustomEvent) => { detail = e.detail; }) as EventListener);

		const shadow = el.shadowRoot!;
		const item = shadow.querySelector(".measurement-item") as HTMLElement;
		item.click();
		expect(detail).toEqual({ measurementId: "m1", name: "Total Revenue" });
	});

	it("dispatches create event on create button click", async () => {
		el.measurements = [];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		let fired = false;
		el.addEventListener("create", () => { fired = true; });

		const shadow = el.shadowRoot!;
		const createBtn = shadow.querySelector("[data-action='create']") as HTMLButtonElement;
		expect(createBtn).not.toBeNull();
		createBtn.click();
		expect(fired).toBe(true);
	});

	it("dispatches delete event with measurement id", async () => {
		el.measurements = [makeMeasurement()];
		el.selectedId = "m1";
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		let detail: unknown = null;
		el.addEventListener("delete", ((e: CustomEvent) => { detail = e.detail; }) as EventListener);

		const shadow = el.shadowRoot!;
		const deleteBtn = shadow.querySelector("[data-action='delete']") as HTMLButtonElement;
		expect(deleteBtn).not.toBeNull();
		deleteBtn.click();
		expect(detail).toEqual({ measurementId: "m1" });
	});
});
