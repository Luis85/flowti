// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest";
import "../../../src/components/dx/flowti-dx-exports";

function makeExport(overrides: Record<string, unknown> = {}) {
	return {
		id: "e1",
		name: "Test Export",
		sourcePath: "Notes/Articles",
		sourceType: "folder",
		outputPath: "exports/articles.csv",
		format: "csv",
		noteType: "Article",
		lastRunAt: null,
		...overrides,
	};
}

describe("flowti-dx-exports", () => {
	let el: HTMLElement & Record<string, unknown>;

	beforeEach(() => {
		el = document.createElement("flowti-dx-exports") as HTMLElement & Record<string, unknown>;
		document.body.appendChild(el);
	});

	it("is defined as a custom element", () => {
		expect(customElements.get("flowti-dx-exports")).toBeDefined();
	});

	it("renders empty state when no exports", async () => {
		el.exports = [];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		const empty = shadow.querySelector(".empty-state");
		expect(empty).not.toBeNull();
		expect(empty!.textContent).toContain("No export configurations");
	});

	it("renders export list items", async () => {
		el.exports = [
			makeExport({ id: "e1", name: "Articles Export" }),
			makeExport({ id: "e2", name: "Notes Export" }),
		];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		const items = shadow.querySelectorAll(".list-item");
		expect(items.length).toBe(2);
		expect(items[0].textContent).toContain("Articles Export");
		expect(items[1].textContent).toContain("Notes Export");
	});

	it("renders detail panel for selected export", async () => {
		el.exports = [
			makeExport({ id: "e1", name: "Articles Export", sourcePath: "Notes/Articles", outputPath: "exports/out.csv" }),
		];
		el.selectedId = "e1";
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		const header = shadow.querySelector(".detail-header h3");
		expect(header).not.toBeNull();
		expect(header!.textContent).toContain("Articles Export");

		const values = Array.from(shadow.querySelectorAll(".detail-field__value")).map((e) => e.textContent?.trim());
		expect(values).toContain("Notes/Articles");
		expect(values).toContain("exports/out.csv");
	});

	it("renders format badge", async () => {
		el.exports = [makeExport({ id: "e1", format: "csv" })];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		const badge = shadow.querySelector(".format-badge");
		expect(badge).not.toBeNull();
		expect(badge!.textContent?.trim()).toBe("csv");
	});

	it("filters exports by searchText", async () => {
		el.exports = [
			makeExport({ id: "e1", name: "Articles Export" }),
			makeExport({ id: "e2", name: "Notes Export" }),
		];
		el.searchText = "notes";
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		const items = shadow.querySelectorAll(".list-item");
		expect(items.length).toBe(1);
		expect(items[0].textContent).toContain("Notes Export");
	});

	it("dispatches select-export on list item click", async () => {
		el.exports = [makeExport({ id: "e1" })];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		const item = shadow.querySelector(".list-item") as HTMLElement;

		let detail: unknown = null;
		el.addEventListener("select-export", ((e: CustomEvent) => { detail = e.detail; }) as EventListener);
		item.click();
		expect(detail).toEqual({ exportId: "e1" });
	});

	it("dispatches run-export on run button click", async () => {
		el.exports = [makeExport({ id: "e1" })];
		el.selectedId = "e1";
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		const buttons = Array.from(shadow.querySelectorAll(".detail-actions button")) as HTMLButtonElement[];
		const runBtn = buttons.find((b) => b.textContent?.trim() === "Run");
		expect(runBtn).toBeDefined();

		let detail: unknown = null;
		el.addEventListener("run-export", ((e: CustomEvent) => { detail = e.detail; }) as EventListener);
		runBtn!.click();
		expect(detail).toEqual({ exportId: "e1" });
	});

	it("dispatches delete-export on delete button click", async () => {
		el.exports = [makeExport({ id: "e1" })];
		el.selectedId = "e1";
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		const deleteBtn = shadow.querySelector(".btn-delete") as HTMLButtonElement;
		expect(deleteBtn).not.toBeNull();

		let detail: unknown = null;
		el.addEventListener("delete-export", ((e: CustomEvent) => { detail = e.detail; }) as EventListener);
		deleteBtn.click();
		expect(detail).toEqual({ exportId: "e1" });
	});

	it("dispatches create-export on new button click", async () => {
		el.exports = [makeExport()];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		const newBtn = shadow.querySelector(".toolbar .btn-primary") as HTMLButtonElement;
		expect(newBtn).not.toBeNull();

		let fired = false;
		el.addEventListener("create-export", () => { fired = true; });
		newBtn.click();
		expect(fired).toBe(true);
	});

	it("highlights selected list item", async () => {
		el.exports = [
			makeExport({ id: "e1" }),
			makeExport({ id: "e2" }),
		];
		el.selectedId = "e2";
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		const items = shadow.querySelectorAll(".list-item");
		expect(items[0].classList.contains("list-item--selected")).toBe(false);
		expect(items[1].classList.contains("list-item--selected")).toBe(true);
	});
});
