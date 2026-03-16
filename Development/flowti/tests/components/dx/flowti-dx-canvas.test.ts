// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest";
import "../../../src/components/dx/flowti-dx-canvas";

function makeCanvas(overrides: Record<string, unknown> = {}) {
	return {
		id: "c1",
		name: "Test Canvas Config",
		canvasPath: "Canvases/test.canvas",
		targetFolder: "Notes/Canvas",
		lastRunAt: null,
		nodeCount: 12,
		...overrides,
	};
}

describe("flowti-dx-canvas", () => {
	let el: HTMLElement & Record<string, unknown>;

	beforeEach(() => {
		el = document.createElement("flowti-dx-canvas") as HTMLElement & Record<string, unknown>;
		document.body.appendChild(el);
	});

	it("is defined as a custom element", () => {
		expect(customElements.get("flowti-dx-canvas")).toBeDefined();
	});

	it("renders empty state when no canvases", async () => {
		el.canvases = [];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		const empty = shadow.querySelector(".empty-state");
		expect(empty).not.toBeNull();
		expect(empty!.textContent).toContain("No canvas import configurations");
	});

	it("renders canvas list items", async () => {
		el.canvases = [
			makeCanvas({ id: "c1", name: "Config A", canvasPath: "Canvases/a.canvas" }),
			makeCanvas({ id: "c2", name: "Config B", canvasPath: "Canvases/b.canvas" }),
		];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		const items = shadow.querySelectorAll(".list-item");
		expect(items.length).toBe(2);
		expect(items[0].textContent).toContain("Config A");
		expect(items[1].textContent).toContain("Config B");
	});

	it("renders detail panel for selected canvas", async () => {
		el.canvases = [
			makeCanvas({ id: "c1", name: "Config A", canvasPath: "Canvases/a.canvas", targetFolder: "Notes/A", nodeCount: 8 }),
		];
		el.selectedId = "c1";
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		const header = shadow.querySelector(".detail-header h3");
		expect(header!.textContent).toContain("Config A");

		const values = Array.from(shadow.querySelectorAll(".detail-field__value")).map((e) => e.textContent?.trim());
		expect(values).toContain("Canvases/a.canvas");
		expect(values).toContain("Notes/A");
		expect(values).toContain("8");
	});

	it("filters canvases by searchText", async () => {
		el.canvases = [
			makeCanvas({ id: "c1", name: "Alpha Config", canvasPath: "Canvases/alpha.canvas" }),
			makeCanvas({ id: "c2", name: "Beta Config", canvasPath: "Canvases/beta.canvas" }),
		];
		el.searchText = "alpha";
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		const items = shadow.querySelectorAll(".list-item");
		expect(items.length).toBe(1);
		expect(items[0].textContent).toContain("Alpha Config");
	});

	it("dispatches select-canvas on list item click", async () => {
		el.canvases = [makeCanvas({ id: "c1" })];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		const item = shadow.querySelector(".list-item") as HTMLElement;

		let detail: unknown = null;
		el.addEventListener("select-canvas", ((e: CustomEvent) => { detail = e.detail; }) as EventListener);
		item.click();
		expect(detail).toEqual({ canvasId: "c1" });
	});

	it("dispatches run-canvas on run button click", async () => {
		el.canvases = [makeCanvas({ id: "c1" })];
		el.selectedId = "c1";
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		const buttons = Array.from(shadow.querySelectorAll(".detail-actions button")) as HTMLButtonElement[];
		const runBtn = buttons.find((b) => b.textContent?.trim() === "Run import");
		expect(runBtn).toBeDefined();

		let detail: unknown = null;
		el.addEventListener("run-canvas", ((e: CustomEvent) => { detail = e.detail; }) as EventListener);
		runBtn!.click();
		expect(detail).toEqual({ canvasId: "c1" });
	});

	it("dispatches open-canvas on open button click", async () => {
		el.canvases = [makeCanvas({ id: "c1", canvasPath: "Canvases/a.canvas" })];
		el.selectedId = "c1";
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		const buttons = Array.from(shadow.querySelectorAll(".detail-actions button")) as HTMLButtonElement[];
		const openBtn = buttons.find((b) => b.textContent?.trim() === "Open canvas");
		expect(openBtn).toBeDefined();

		let detail: unknown = null;
		el.addEventListener("open-canvas", ((e: CustomEvent) => { detail = e.detail; }) as EventListener);
		openBtn!.click();
		expect(detail).toEqual({ canvasPath: "Canvases/a.canvas" });
	});

	it("highlights selected list item", async () => {
		el.canvases = [
			makeCanvas({ id: "c1" }),
			makeCanvas({ id: "c2" }),
		];
		el.selectedId = "c2";
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		const items = shadow.querySelectorAll(".list-item");
		expect(items[0].classList.contains("list-item--selected")).toBe(false);
		expect(items[1].classList.contains("list-item--selected")).toBe(true);
	});
});
