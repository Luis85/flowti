// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest";
import "../../../src/components/dx/flowti-dx-imports";

function makeImport(overrides: Record<string, unknown> = {}) {
	return {
		id: "i1",
		name: "Test Import",
		sourcePath: "data/articles.csv",
		targetFolder: "Articles",
		noteType: "Article",
		lastRunAt: null,
		...overrides,
	};
}

describe("flowti-dx-imports", () => {
	let el: HTMLElement & Record<string, unknown>;

	beforeEach(() => {
		el = document.createElement("flowti-dx-imports") as HTMLElement & Record<string, unknown>;
		document.body.appendChild(el);
	});

	it("is defined as a custom element", () => {
		expect(customElements.get("flowti-dx-imports")).toBeDefined();
	});

	it("renders empty state when no imports", async () => {
		el.imports = [];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		const empty = shadow.querySelector(".empty-state");
		expect(empty).not.toBeNull();
		expect(empty!.textContent).toContain("No import configurations");
	});

	it("renders import list items", async () => {
		el.imports = [
			makeImport({ id: "i1", name: "Articles Import", sourcePath: "data/articles.csv" }),
			makeImport({ id: "i2", name: "Notes Import", sourcePath: "data/notes.csv" }),
		];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		const items = shadow.querySelectorAll(".list-item");
		expect(items.length).toBe(2);
		expect(items[0].textContent).toContain("Articles Import");
		expect(items[1].textContent).toContain("Notes Import");
	});

	it("renders detail panel for selected import", async () => {
		el.imports = [
			makeImport({ id: "i1", name: "Articles Import", sourcePath: "data/articles.csv", targetFolder: "Notes/Articles" }),
		];
		el.selectedId = "i1";
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		const header = shadow.querySelector(".detail-header h3");
		expect(header).not.toBeNull();
		expect(header!.textContent).toContain("Articles Import");

		const values = Array.from(shadow.querySelectorAll(".detail-field__value")).map((e) => e.textContent?.trim());
		expect(values).toContain("data/articles.csv");
		expect(values).toContain("Notes/Articles");
	});

	it("filters imports by searchText", async () => {
		el.imports = [
			makeImport({ id: "i1", name: "Articles Import", sourcePath: "data/articles.csv" }),
			makeImport({ id: "i2", name: "Notes Import", sourcePath: "data/notes.csv" }),
		];
		el.searchText = "article";
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		const items = shadow.querySelectorAll(".list-item");
		expect(items.length).toBe(1);
		expect(items[0].textContent).toContain("Articles Import");
	});

	it("dispatches select-import on list item click", async () => {
		el.imports = [makeImport({ id: "i1" })];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		const item = shadow.querySelector(".list-item") as HTMLElement;

		let detail: unknown = null;
		el.addEventListener("select-import", ((e: CustomEvent) => { detail = e.detail; }) as EventListener);
		item.click();
		expect(detail).toEqual({ importId: "i1" });
	});

	it("dispatches run-import on run button click", async () => {
		el.imports = [makeImport({ id: "i1" })];
		el.selectedId = "i1";
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		const buttons = Array.from(shadow.querySelectorAll(".detail-actions button")) as HTMLButtonElement[];
		const runBtn = buttons.find((b) => b.textContent?.trim() === "Run");
		expect(runBtn).toBeDefined();

		let detail: unknown = null;
		el.addEventListener("run-import", ((e: CustomEvent) => { detail = e.detail; }) as EventListener);
		runBtn!.click();
		expect(detail).toEqual({ importId: "i1" });
	});

	it("dispatches delete-import on delete button click", async () => {
		el.imports = [makeImport({ id: "i1" })];
		el.selectedId = "i1";
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		const buttons = Array.from(shadow.querySelectorAll(".detail-actions button")) as HTMLButtonElement[];
		const deleteBtn = buttons.find((b) => b.classList.contains("btn-delete"));
		expect(deleteBtn).toBeDefined();

		let detail: unknown = null;
		el.addEventListener("delete-import", ((e: CustomEvent) => { detail = e.detail; }) as EventListener);
		deleteBtn!.click();
		expect(detail).toEqual({ importId: "i1" });
	});

	it("dispatches create-import on new button click", async () => {
		el.imports = [makeImport()];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		const newBtn = shadow.querySelector(".toolbar .btn-primary") as HTMLButtonElement;
		expect(newBtn).not.toBeNull();

		let fired = false;
		el.addEventListener("create-import", () => { fired = true; });
		newBtn.click();
		expect(fired).toBe(true);
	});

	it("highlights selected list item", async () => {
		el.imports = [
			makeImport({ id: "i1" }),
			makeImport({ id: "i2" }),
		];
		el.selectedId = "i2";
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		const items = shadow.querySelectorAll(".list-item");
		expect(items[0].classList.contains("list-item--selected")).toBe(false);
		expect(items[1].classList.contains("list-item--selected")).toBe(true);
	});
});
