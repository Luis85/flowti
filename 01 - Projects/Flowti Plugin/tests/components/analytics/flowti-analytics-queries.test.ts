// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest";
import "../../../src/components/analytics/flowti-analytics-queries";

function makeSource(overrides: Record<string, unknown> = {}) {
	return {
		path: "data/sales.csv",
		alias: "sales",
		displayName: "Sales",
		...overrides,
	};
}

function makeSavedQuery(overrides: Record<string, unknown> = {}) {
	return {
		id: "q1",
		name: "Revenue Query",
		description: "Sum of revenue by month",
		sources: [{ csvPath: "data/sales.csv", alias: "sales" }],
		joins: [],
		columnTypeHints: [],
		dimensions: [{ column: "Month" }],
		measures: [{ column: "Revenue", function: "SUM", label: "Total Revenue" }],
		createdAt: Date.now(),
		isFavorite: false,
		...overrides,
	};
}

describe("flowti-analytics-queries", () => {
	let el: HTMLElement & Record<string, unknown>;

	beforeEach(() => {
		el = document.createElement("flowti-analytics-queries") as HTMLElement & Record<string, unknown>;
		document.body.appendChild(el);
	});

	it("is defined as a custom element", () => {
		expect(customElements.get("flowti-analytics-queries")).toBeDefined();
	});

	it("renders saved queries list", async () => {
		el.savedQueries = [makeSavedQuery(), makeSavedQuery({ id: "q2", name: "Expense Query" })];
		el.sources = [makeSource()];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		const items = shadow.querySelectorAll(".query-item");
		expect(items.length).toBe(2);
		expect(shadow.textContent).toContain("Revenue Query");
		expect(shadow.textContent).toContain("Expense Query");
	});

	it("renders empty state when no sources and no queries", async () => {
		el.sources = [];
		el.savedQueries = [];
		el.activeQuery = null;
		el.results = null;
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		expect(shadow.querySelector(".empty-state")).not.toBeNull();
	});

	it("renders source panel when sources are provided", async () => {
		el.sources = [makeSource(), makeSource({ path: "data/items.csv", alias: "items", displayName: "Items" })];
		el.savedQueries = [];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		expect(shadow.querySelector(".source-panel")).not.toBeNull();
		expect(shadow.textContent).toContain("Sources");
		expect(shadow.textContent).toContain("2");
	});

	it("renders active query configuration", async () => {
		const query = makeSavedQuery();
		el.sources = [makeSource()];
		el.savedQueries = [query];
		el.activeQuery = query;
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		expect(shadow.textContent).toContain("Revenue Query");
		expect(shadow.textContent).toContain("1 dimension");
		expect(shadow.textContent).toContain("1 measure");
	});

	it("renders results when provided", async () => {
		el.sources = [makeSource()];
		el.savedQueries = [];
		el.activeQuery = makeSavedQuery();
		el.results = {
			columns: ["Month", "Total Revenue"],
			rows: [
				{ Month: "Jan", "Total Revenue": 1000 },
				{ Month: "Feb", "Total Revenue": 1500 },
			],
			groupCount: 2,
			sourceRowCount: 100,
		};
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		expect(shadow.querySelector(".results-panel")).not.toBeNull();
		expect(shadow.textContent).toContain("2 rows");
	});

	it("dispatches select-query event when a query item is clicked", async () => {
		el.savedQueries = [makeSavedQuery()];
		el.sources = [makeSource()];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		let detail: unknown = null;
		el.addEventListener("select-query", ((e: CustomEvent) => { detail = e.detail; }) as EventListener);

		const shadow = el.shadowRoot!;
		const queryItem = shadow.querySelector(".query-item") as HTMLElement;
		expect(queryItem).not.toBeNull();
		queryItem.click();
		expect(detail).toEqual({ queryId: "q1" });
	});

	it("sets activeQuery when a query item is clicked", async () => {
		el.savedQueries = [makeSavedQuery()];
		el.sources = [makeSource()];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		const queryItem = shadow.querySelector(".query-item") as HTMLElement;
		queryItem.click();
		expect(el.activeQuery).not.toBeNull();
		expect((el.activeQuery as Record<string, unknown>).id).toBe("q1");
	});

	it("dispatches run-query event with queryId", async () => {
		el.sources = [makeSource()];
		el.savedQueries = [];
		el.activeQuery = makeSavedQuery();
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		let detail: unknown = null;
		el.addEventListener("run-query", ((e: CustomEvent) => { detail = e.detail; }) as EventListener);

		const shadow = el.shadowRoot!;
		const runBtn = shadow.querySelector("[data-action='run-query']") as HTMLButtonElement;
		expect(runBtn).not.toBeNull();
		runBtn.click();
		expect(detail).toEqual({ queryId: "q1" });
	});

	it("dispatches save-query event with query name", async () => {
		el.sources = [makeSource()];
		el.savedQueries = [];
		el.activeQuery = makeSavedQuery();
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		let detail: unknown = null;
		el.addEventListener("save-query", ((e: CustomEvent) => { detail = e.detail; }) as EventListener);

		const shadow = el.shadowRoot!;
		const saveBtn = shadow.querySelector("[data-action='save-query']") as HTMLButtonElement;
		expect(saveBtn).not.toBeNull();
		saveBtn.click();
		expect(detail).toEqual({ queryId: "q1" });
	});

	it("dispatches delete-query event with query id", async () => {
		el.savedQueries = [makeSavedQuery()];
		el.sources = [];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		let detail: unknown = null;
		el.addEventListener("delete-query", ((e: CustomEvent) => { detail = e.detail; }) as EventListener);

		const shadow = el.shadowRoot!;
		const deleteBtn = shadow.querySelector("[data-action='delete-query']") as HTMLButtonElement;
		expect(deleteBtn).not.toBeNull();
		deleteBtn.click();
		expect(detail).toEqual({ queryId: "q1" });
	});
});
