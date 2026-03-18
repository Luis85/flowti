// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest";
import "../../../src/components/dx/flowti-dx-dashboard";

function makeOp(overrides: Record<string, unknown> = {}) {
	return {
		operationId: "op1",
		type: "import",
		name: "Test Import",
		completed: false,
		success: false,
		progress: null,
		message: "",
		...overrides,
	};
}

describe("flowti-dx-dashboard", () => {
	let el: HTMLElement & Record<string, unknown>;

	beforeEach(() => {
		el = document.createElement("flowti-dx-dashboard") as HTMLElement & Record<string, unknown>;
		document.body.appendChild(el);
	});

	it("is defined as a custom element", () => {
		expect(customElements.get("flowti-dx-dashboard")).toBeDefined();
	});

	it("renders stat cards with correct counts", async () => {
		const ops = [
			makeOp({ operationId: "op1", completed: false }),
			makeOp({ operationId: "op2", completed: true, success: true }),
			makeOp({ operationId: "op3", completed: true, success: false }),
		];
		el.activeOps = ops;
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		const values = Array.from(shadow.querySelectorAll(".stat-card__value")).map((e) => e.textContent?.trim());
		expect(values).toContain("3"); // total
		expect(values).toContain("1"); // running
		expect(values).toContain("1"); // completed
		expect(values).toContain("1"); // failed
	});

	it("renders empty state when no active ops", async () => {
		el.activeOps = [];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		const empty = shadow.querySelector(".empty-state");
		expect(empty).not.toBeNull();
		expect(empty!.textContent).toContain("No active operations");
	});

	it("renders operation cards when ops exist", async () => {
		el.activeOps = [
			makeOp({ operationId: "op1", name: "CSV Import" }),
			makeOp({ operationId: "op2", name: "Pipeline Run" }),
		];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		const cards = shadow.querySelectorAll(".op-card");
		expect(cards.length).toBe(2);
		expect(cards[0].textContent).toContain("CSV Import");
		expect(cards[1].textContent).toContain("Pipeline Run");
	});

	it("renders progress bar for running ops with progress", async () => {
		el.activeOps = [
			makeOp({ operationId: "op1", completed: false, progress: { current: 5, total: 10 } }),
		];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		const progressBar = shadow.querySelector(".progress-bar__fill") as HTMLElement;
		expect(progressBar).not.toBeNull();
		expect(progressBar.style.width).toBe("50%");
	});

	it("renders message for completed ops", async () => {
		el.activeOps = [
			makeOp({ operationId: "op1", completed: true, success: true, message: "3 created, 2 updated" }),
		];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		const msg = shadow.querySelector(".op-message");
		expect(msg).not.toBeNull();
		expect(msg!.textContent).toContain("3 created, 2 updated");
	});

	it("dispatches navigate-tab when a stat card is clicked", async () => {
		el.activeOps = [];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		const statCards = shadow.querySelectorAll(".stat-card--clickable") as NodeListOf<HTMLElement>;
		expect(statCards.length).toBe(4);

		let tabId = "";
		el.addEventListener("navigate-tab", ((e: CustomEvent<{ tabId: string }>) => {
			tabId = e.detail.tabId;
		}) as EventListener);

		statCards[0].click();
		expect(tabId).toBe("pipelines");

		statCards[1].click();
		expect(tabId).toBe("imports");
	});

	it("dispatches open-pipelines event on button click", async () => {
		el.activeOps = [];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		const btn = shadow.querySelector(".empty-state button") as HTMLButtonElement;
		expect(btn).not.toBeNull();

		let fired = false;
		el.addEventListener("open-pipelines", () => { fired = true; });
		btn.click();
		expect(fired).toBe(true);
	});
});
