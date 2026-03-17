// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest";
import "../../../src/components/train/flowti-train-dashboard";

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

describe("flowti-train-dashboard", () => {
	let el: HTMLElement & Record<string, unknown>;

	beforeEach(() => {
		el = document.createElement("flowti-train-dashboard") as HTMLElement & Record<string, unknown>;
		document.body.appendChild(el);
	});

	it("is defined as a custom element", () => {
		expect(customElements.get("flowti-train-dashboard")).toBeDefined();
	});

	it("renders stat cards with correct counts", async () => {
		const trains = [
			makeTrain({ id: "t1", status: "running", thoughts: [{ id: "th1" }] }),
			makeTrain({ id: "t2", status: "paused", thoughts: [{ id: "th2" }, { id: "th3" }] }),
			makeTrain({ id: "t3", status: "completed", thoughts: [{ id: "th4" }] }),
		];
		el.trains = trains;
		el.activeTrain = trains[0];
		el.pausedTrain = trains[1];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		const cards = shadow.querySelectorAll(".stat-card");
		expect(cards.length).toBe(4);

		const values = Array.from(shadow.querySelectorAll(".stat-card__value")).map((e) => e.textContent?.trim());
		expect(values).toContain("3"); // total trains
		expect(values).toContain("2"); // active (running + paused)
		expect(values).toContain("1"); // completed
		expect(values).toContain("4"); // total thoughts
	});

	it("renders 'Currently Running' callout when activeTrain is set", async () => {
		const active = makeTrain({ status: "running", title: "My Running Train" });
		el.trains = [active];
		el.activeTrain = active;
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		const callout = shadow.querySelector(".running-callout");
		expect(callout).not.toBeNull();
		expect(callout!.textContent).toContain("Currently Running");
		expect(callout!.textContent).toContain("My Running Train");
	});

	it("renders 'Paused' callout when pausedTrain is set and no active", async () => {
		const paused = makeTrain({ status: "paused", title: "My Paused Train" });
		el.trains = [paused];
		el.activeTrain = null;
		el.pausedTrain = paused;
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		const callout = shadow.querySelector(".paused-callout");
		expect(callout).not.toBeNull();
		expect(callout!.textContent).toContain("Paused");
		expect(callout!.textContent).toContain("My Paused Train");
	});

	it("renders empty state when no trains exist", async () => {
		el.trains = [];
		el.activeTrain = null;
		el.pausedTrain = null;
		el.isEmpty = true;
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		const empty = shadow.querySelector(".flowti-empty");
		expect(empty).not.toBeNull();
	});

	it("renders start-ride callout when no running or paused trains", async () => {
		const completed = makeTrain({ status: "completed" });
		el.trains = [completed];
		el.activeTrain = null;
		el.pausedTrain = null;
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		const startCallout = shadow.querySelector(".start-callout");
		expect(startCallout).not.toBeNull();
		expect(startCallout!.textContent).toContain("Start a ride");
	});

	it("dispatches start-train CustomEvent on start button click", async () => {
		el.trains = [makeTrain({ status: "completed" })];
		el.activeTrain = null;
		el.pausedTrain = null;
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		const startBtn = shadow.querySelector(".start-callout button") as HTMLButtonElement;
		expect(startBtn).not.toBeNull();

		let fired = false;
		el.addEventListener("start-train", () => { fired = true; });
		startBtn.click();
		expect(fired).toBe(true);
	});
});
