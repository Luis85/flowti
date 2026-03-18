// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest";
import "../../../src/components/dx/flowti-dx-types";

function makeType(overrides: Record<string, unknown> = {}) {
	return {
		name: "Article",
		description: "A content article",
		properties: ["title", "author", "date"],
		filePath: "Types/Type - Article.md",
		pipelineCount: 2,
		...overrides,
	};
}

describe("flowti-dx-types", () => {
	let el: HTMLElement & Record<string, unknown>;

	beforeEach(() => {
		el = document.createElement("flowti-dx-types") as HTMLElement & Record<string, unknown>;
		document.body.appendChild(el);
	});

	it("is defined as a custom element", () => {
		expect(customElements.get("flowti-dx-types")).toBeDefined();
	});

	it("renders empty state when no types", async () => {
		el.types = [];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		const empty = shadow.querySelector(".empty-state");
		expect(empty).not.toBeNull();
		expect(empty!.textContent).toContain("No note types defined yet");
	});

	it("renders type list items", async () => {
		el.types = [
			makeType({ name: "Article", properties: ["title", "author"] }),
			makeType({ name: "Note", properties: ["title"] }),
		];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		const items = shadow.querySelectorAll(".list-item");
		expect(items.length).toBe(2);
		expect(items[0].textContent).toContain("Article");
		expect(items[0].textContent).toContain("2 properties");
		expect(items[1].textContent).toContain("Note");
	});

	it("renders detail panel for selected type", async () => {
		el.types = [
			makeType({ name: "Article", description: "A content article", properties: ["title", "author", "date"], pipelineCount: 3 }),
		];
		el.selectedId = "Article";
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		const header = shadow.querySelector(".detail-header h3");
		expect(header).not.toBeNull();
		expect(header!.textContent).toContain("Article");

		const desc = shadow.querySelector(".detail-description");
		expect(desc!.textContent).toContain("A content article");

		const tags = Array.from(shadow.querySelectorAll(".property-tag")).map((e) => e.textContent?.trim());
		expect(tags).toEqual(["title", "author", "date"]);

		const count = shadow.querySelector(".pipeline-count");
		expect(count!.textContent).toContain("3 pipeline(s)");
	});

	it("filters types by searchText", async () => {
		el.types = [
			makeType({ name: "Article", description: "content piece" }),
			makeType({ name: "Note", description: "quick capture" }),
		];
		el.searchText = "article";
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		const items = shadow.querySelectorAll(".list-item");
		expect(items.length).toBe(1);
		expect(items[0].textContent).toContain("Article");
	});

	it("dispatches select-type on list item click", async () => {
		el.types = [makeType({ name: "Article" })];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		const item = shadow.querySelector(".list-item") as HTMLElement;

		let detail: unknown = null;
		el.addEventListener("select-type", ((e: CustomEvent) => { detail = e.detail; }) as EventListener);
		item.click();
		expect(detail).toEqual({ typeName: "Article" });
	});

	it("dispatches open-type on button click", async () => {
		el.types = [makeType({ name: "Article", filePath: "Types/Type - Article.md" })];
		el.selectedId = "Article";
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		const btn = shadow.querySelector("button") as HTMLButtonElement;
		expect(btn!.textContent).toContain("Open definition");

		let detail: unknown = null;
		el.addEventListener("open-type", ((e: CustomEvent) => { detail = e.detail; }) as EventListener);
		btn.click();
		expect(detail).toEqual({ typeName: "Article", filePath: "Types/Type - Article.md" });
	});
});
