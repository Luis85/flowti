// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest";
import "../../../src/components/train/flowti-train-active";

function makeTrain(overrides: Record<string, unknown> = {}) {
	return {
		id: "t1",
		title: "Test Train",
		status: "running",
		thoughts: [{ id: "th1" }, { id: "th2" }],
		createdAt: "2026-03-16T10:00:00Z",
		completedAt: null,
		pausedAt: null,
		durationMinutes: 15,
		trainType: "brainstorm",
		...overrides,
	};
}

describe("flowti-train-active", () => {
	let el: HTMLElement & Record<string, unknown>;

	beforeEach(() => {
		el = document.createElement("flowti-train-active") as HTMLElement & Record<string, unknown>;
		document.body.appendChild(el);
	});

	it("is defined as a custom element", () => {
		expect(customElements.get("flowti-train-active")).toBeDefined();
	});

	it("renders a list of active/paused trains", async () => {
		el.trains = [
			makeTrain({ id: "t1", status: "running", title: "Running Train" }),
			makeTrain({ id: "t2", status: "paused", title: "Paused Train" }),
		];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		const items = shadow.querySelectorAll(".list-item");
		expect(items.length).toBe(2);
	});

	it("renders empty state when no trains", async () => {
		el.trains = [];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		const empty = shadow.querySelector(".empty-state");
		expect(empty).not.toBeNull();
		expect(empty!.textContent).toContain("No active trains");
	});

	it("renders type filter dropdown", async () => {
		el.trains = [makeTrain()];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		const selects = shadow.querySelectorAll("select");
		expect(selects.length).toBeGreaterThanOrEqual(1);
		const typeSelect = shadow.querySelector(".type-filter") as HTMLSelectElement;
		expect(typeSelect).not.toBeNull();
	});

	it("renders sort dropdown", async () => {
		el.trains = [makeTrain()];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		const sortSelect = shadow.querySelector(".sort-select") as HTMLSelectElement;
		expect(sortSelect).not.toBeNull();
	});

	it("renders detail panel when a train is selected", async () => {
		const train = makeTrain({ id: "t1", title: "Selected Train" });
		el.trains = [train];
		el.selectedTrainId = "t1";
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		const detail = shadow.querySelector(".detail-panel");
		expect(detail).not.toBeNull();
		expect(detail!.textContent).toContain("Selected Train");
	});

	it("dispatches open-train on open button click", async () => {
		const train = makeTrain({ id: "t1", title: "Train 1" });
		el.trains = [train];
		el.selectedTrainId = "t1";
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		const openBtn = shadow.querySelector(".btn-open") as HTMLButtonElement;
		expect(openBtn).not.toBeNull();

		let detail: unknown = null;
		el.addEventListener("open-train", ((e: CustomEvent) => { detail = e.detail; }) as EventListener);
		openBtn.click();
		expect(detail).toEqual({ trainId: "t1" });
	});

	it("dispatches resume-train on resume button click for paused train", async () => {
		const train = makeTrain({ id: "t1", status: "paused", title: "Paused" });
		el.trains = [train];
		el.selectedTrainId = "t1";
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		const resumeBtn = shadow.querySelector(".btn-resume") as HTMLButtonElement;
		expect(resumeBtn).not.toBeNull();

		let detail: unknown = null;
		el.addEventListener("resume-train", ((e: CustomEvent) => { detail = e.detail; }) as EventListener);
		resumeBtn.click();
		expect(detail).toEqual({ trainId: "t1" });
	});

	it("dispatches pause-train on pause button click for running train", async () => {
		const train = makeTrain({ id: "t1", status: "running", title: "Running" });
		el.trains = [train];
		el.selectedTrainId = "t1";
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		const pauseBtn = shadow.querySelector(".btn-pause") as HTMLButtonElement;
		expect(pauseBtn).not.toBeNull();

		let detail: unknown = null;
		el.addEventListener("pause-train", ((e: CustomEvent) => { detail = e.detail; }) as EventListener);
		pauseBtn.click();
		expect(detail).toEqual({ trainId: "t1" });
	});

	it("dispatches delete-train on delete button click", async () => {
		const train = makeTrain({ id: "t1" });
		el.trains = [train];
		el.selectedTrainId = "t1";
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		const deleteBtn = shadow.querySelector(".btn-delete") as HTMLButtonElement;
		expect(deleteBtn).not.toBeNull();

		let detail: unknown = null;
		el.addEventListener("delete-train", ((e: CustomEvent) => { detail = e.detail; }) as EventListener);
		deleteBtn.click();
		expect(detail).toEqual({ trainId: "t1" });
	});

	it("filters trains by search text", async () => {
		el.trains = [
			makeTrain({ id: "t1", title: "Brainstorm Ideas" }),
			makeTrain({ id: "t2", title: "Research Topic" }),
		];
		el.searchText = "brain";
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		const items = shadow.querySelectorAll(".list-item");
		expect(items.length).toBe(1);
	});
});
