// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest";
import "../../../src/components/dx/flowti-dx-pipelines";

function makePipeline(overrides: Record<string, unknown> = {}) {
	return {
		id: "p1",
		name: "Test Pipeline",
		status: "idle",
		progress: 0,
		message: "",
		sourcePaths: [],
		noteType: "Article",
		...overrides,
	};
}

describe("flowti-dx-pipelines", () => {
	let el: HTMLElement & Record<string, unknown>;

	beforeEach(() => {
		el = document.createElement("flowti-dx-pipelines") as HTMLElement & Record<string, unknown>;
		document.body.appendChild(el);
	});

	it("is defined as a custom element", () => {
		expect(customElements.get("flowti-dx-pipelines")).toBeDefined();
	});

	it("renders empty state when no pipelines", async () => {
		el.operations = [];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		const empty = shadow.querySelector(".empty-state");
		expect(empty).not.toBeNull();
		expect(empty!.textContent).toContain("No pipelines configured");
	});

	it("renders pipeline cards", async () => {
		el.operations = [
			makePipeline({ id: "p1", name: "Import Articles" }),
			makePipeline({ id: "p2", name: "Import Notes" }),
		];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		const cards = shadow.querySelectorAll(".pipeline-card");
		expect(cards.length).toBe(2);
		expect(cards[0].textContent).toContain("Import Articles");
		expect(cards[1].textContent).toContain("Import Notes");
	});

	it("renders progress bar for running pipeline", async () => {
		el.operations = [
			makePipeline({ id: "p1", status: "running", progress: 60 }),
		];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		const fill = shadow.querySelector(".progress-bar__fill") as HTMLElement;
		expect(fill).not.toBeNull();
		expect(fill.style.width).toBe("60%");
	});

	it("renders run button for idle pipelines", async () => {
		el.operations = [makePipeline({ id: "p1", status: "idle" })];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		const btn = shadow.querySelector("button");
		expect(btn).not.toBeNull();
		expect(btn!.textContent).toContain("Run");
	});

	it("does not render run button for running pipelines", async () => {
		el.operations = [makePipeline({ id: "p1", status: "running" })];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		const btn = shadow.querySelector("button");
		expect(btn).toBeNull();
	});

	it("renders message when present", async () => {
		el.operations = [
			makePipeline({ id: "p1", status: "completed", message: "5 created, 3 updated" }),
		];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		const msg = shadow.querySelector(".pipeline-message");
		expect(msg).not.toBeNull();
		expect(msg!.textContent).toContain("5 created, 3 updated");
	});

	it("filters by searchText", async () => {
		el.operations = [
			makePipeline({ id: "p1", name: "Import Articles" }),
			makePipeline({ id: "p2", name: "Export Data" }),
		];
		el.searchText = "article";
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		const cards = shadow.querySelectorAll(".pipeline-card");
		expect(cards.length).toBe(1);
		expect(cards[0].textContent).toContain("Import Articles");
	});

	it("dispatches run-pipeline on button click", async () => {
		el.operations = [makePipeline({ id: "p1", status: "idle" })];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		const btn = shadow.querySelector("button") as HTMLButtonElement;

		let detail: unknown = null;
		el.addEventListener("run-pipeline", ((e: CustomEvent) => { detail = e.detail; }) as EventListener);
		btn.click();
		expect(detail).toEqual({ pipelineId: "p1" });
	});

	it("dispatches select-pipeline on card click", async () => {
		el.operations = [makePipeline({ id: "p1" })];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		const card = shadow.querySelector(".pipeline-card") as HTMLElement;

		let detail: unknown = null;
		el.addEventListener("select-pipeline", ((e: CustomEvent) => { detail = e.detail; }) as EventListener);
		card.click();
		expect(detail).toEqual({ pipelineId: "p1" });
	});

	it("highlights selected pipeline card", async () => {
		el.operations = [
			makePipeline({ id: "p1" }),
			makePipeline({ id: "p2" }),
		];
		el.selectedId = "p2";
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		const cards = shadow.querySelectorAll(".pipeline-card");
		expect(cards[0].classList.contains("pipeline-card--selected")).toBe(false);
		expect(cards[1].classList.contains("pipeline-card--selected")).toBe(true);
	});
});
