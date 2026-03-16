// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest";
import "../../../src/components/train/flowti-train-history";

function makeTrain(overrides: Record<string, unknown> = {}) {
	return {
		id: "t1",
		title: "Completed Train",
		status: "completed",
		thoughts: [{ id: "th1" }, { id: "th2" }],
		createdAt: "2026-03-16T10:00:00Z",
		completedAt: "2026-03-16T11:00:00Z",
		pausedAt: null,
		durationMinutes: 60,
		trainType: "brainstorm",
		...overrides,
	};
}

describe("flowti-train-history", () => {
	let el: HTMLElement & Record<string, unknown>;

	beforeEach(() => {
		el = document.createElement("flowti-train-history") as HTMLElement & Record<string, unknown>;
		document.body.appendChild(el);
	});

	it("is defined as a custom element", () => {
		expect(customElements.get("flowti-train-history")).toBeDefined();
	});

	it("renders a list of completed trains", async () => {
		el.trains = [
			makeTrain({ id: "t1", title: "Train A" }),
			makeTrain({ id: "t2", title: "Train B" }),
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
		expect(empty!.textContent).toContain("No completed trains");
	});

	it("renders detail panel when a train is selected", async () => {
		const train = makeTrain({ id: "t1", title: "Selected History Train" });
		el.trains = [train];
		el.selectedTrainId = "t1";
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		const detail = shadow.querySelector(".detail-panel");
		expect(detail).not.toBeNull();
		expect(detail!.textContent).toContain("Selected History Train");
	});

	it("shows completedAt in detail panel", async () => {
		const train = makeTrain({ id: "t1", completedAt: "2026-03-16T11:00:00Z" });
		el.trains = [train];
		el.selectedTrainId = "t1";
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		const detail = shadow.querySelector(".detail-panel");
		expect(detail!.textContent).toContain("Completed:");
	});

	it("dispatches open-train on open button click", async () => {
		const train = makeTrain({ id: "t1" });
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
			makeTrain({ id: "t1", title: "Brainstorm Session" }),
			makeTrain({ id: "t2", title: "Research Deep Dive" }),
		];
		el.searchText = "research";
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		const items = shadow.querySelectorAll(".list-item");
		expect(items.length).toBe(1);
	});
});
